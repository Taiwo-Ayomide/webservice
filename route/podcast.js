const express = require('express');
const multer = require('multer');
const cloudinary = require('./cloudinaryConfig');
const Podcast = require('../Model/Podcast');
const router = express.Router();
const streamifier = require('streamifier');
const { verifyTokenAndAdmin } = require('./verifyToken');
const { initializeRedis } = require("./redisClient");

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: "audios" },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.secure_url);
                }
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
};

// POST - Upload new podcast
router.post('/upload', verifyTokenAndAdmin, upload.single('audioFile'), async (req, res) => {
    const { title, description, producers } = req.body;
    const audioFile = req.file;

    if (!title || !description || !producers || !audioFile) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Upload to Cloudinary
        const audioUrl = await uploadToCloudinary(audioFile.buffer);

        // Create a new podcast document
        const newPodcast = new Podcast({
            title,
            description,
            producers: producers.split(',').map(producer => producer.trim()), // Assuming producers are sent as comma-separated values
            audioUrl
        });

        // Save to MongoDB
        await newPodcast.save();

        // Initialize Redis client and invalidate cache for podcasts
        const redisClient = await initializeRedis();
        await redisClient.del('podcasts');  // Clear all podcasts cache

        res.status(201).json({ message: 'Podcast uploaded successfully', podcast: newPodcast });
    } catch (error) {
        console.error('Error saving podcast:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            res.status(400).json({ error: 'Validation failed', messages: errors });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// GET ALL PODCASTS
router.get("/", async (req, res) => {
    try {
        const redisClient = await initializeRedis();

        // Get pagination parameters from the query string
        const page = parseInt(req.query.page) || 1;  // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10;  // Default to 10 items per page if not provided

        // Calculate the number of items to skip
        const skip = (page - 1) * limit;

        // Check if the paginated podcasts are cached in Redis
        const cacheKey = `podcasts:page:${page}:limit:${limit}`;
        const cachedPodcasts = await redisClient.get(cacheKey);
        if (cachedPodcasts) {
            console.log("Podcasts fetched from cache for page:", page);  // Log cache hit
            return res.status(200).json(JSON.parse(cachedPodcasts));  // Return cached podcasts
        }

        console.log("Podcasts not found in cache, fetching from MongoDB...");

        // Fetch paginated podcasts from MongoDB
        const podcasts = await Podcast.find()
            .skip(skip)  // Skip the first `skip` items
            .limit(limit);  // Limit the results to `limit` items

        if (!podcasts || podcasts.length === 0) {
            return res.status(404).json({ message: "No podcasts found" });
        }

        // Get the total number of podcasts for pagination metadata
        const totalPodcasts = await Podcast.countDocuments();

        // Create pagination metadata
        const pagination = {
            page,
            limit,
            totalItems: totalPodcasts,
            totalPages: Math.ceil(totalPodcasts / limit),  // Calculate total pages
        };

        console.log("Fetched podcasts from MongoDB:", podcasts);

        // Cache the paginated podcasts for future use
        await redisClient.set(cacheKey, JSON.stringify({ podcasts, pagination }), 'EX', 3600); // Cache for 1 hour
        console.log("Podcasts cached in Redis:", podcasts);  // Log what is being cached

        // Return the podcasts and pagination metadata
        res.status(200).json({ podcasts, pagination });
    } catch (error) {
        console.error("Error fetching podcasts:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// GET ONE PODCAST
router.get("/find/:id", async (req, res) => {
    const podcastId = req.params.id;
    try {
        const redisClient = await initializeRedis();

        // Check if the single podcast is cached in Redis
        const cachedPodcast = await redisClient.get(`podcast:${podcastId}`);
        if (cachedPodcast) {
            return res.status(200).json(JSON.parse(cachedPodcast)); // Return cached podcast
        }

        // If not cached, fetch from MongoDB
        const podcast = await Podcast.findById(podcastId);
        if (!podcast) {
            return res.status(404).json({ error: "Podcast not found" });
        }

        // Cache the podcast in Redis for future use
        await redisClient.set(`podcast:${podcastId}`, JSON.stringify(podcast), 'EX', 3600); // Cache for 1 hour

        res.status(200).json(podcast);
    } catch (error) {
        res.status(500).json(error);
    }
});

// UPDATE PODCAST
router.put("/update/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const podcastId = req.params.id;
        const updatedPodcast = await Podcast.findByIdAndUpdate(
            podcastId,
            { $set: req.body },
            { new: true }
        );

        // Invalidate the cache for this specific podcast
        const redisClient = await initializeRedis();
        await redisClient.del(`podcast:${podcastId}`);

        // Optionally, invalidate all podcasts cache
        await redisClient.del('podcasts');

        res.status(200).json(updatedPodcast);
    } catch (error) {
        res.status(500).json(error);
    }
});

// DELETE PODCAST
router.delete("/delete/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const podcastId = req.params.id;

        // Delete the podcast from MongoDB
        await Podcast.findByIdAndDelete(podcastId);

        // Invalidate the cache for this specific podcast
        const redisClient = await initializeRedis();
        await redisClient.del(`podcast:${podcastId}`);

        // Optionally, invalidate all podcasts cache
        await redisClient.del('podcasts');

        res.status(200).json("Podcast deleted successfully");
    } catch (error) {
        res.status(500).json(error);
    }
});

module.exports = router;
