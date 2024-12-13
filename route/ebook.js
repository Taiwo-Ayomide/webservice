const Ebook = require("../Model/Ebook");
const router = require("express").Router();
const multer = require('multer');
const path = require("path");
const fs = require("fs");
const streamifier = require('streamifier');
const cloudinary = require('./cloudinaryConfig');
const { verifyTokenAndAdmin } = require('./verifyToken');
const { initializeRedis } = require("./redisClient");

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: "books" },
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

// POST - Create Ebook
router.post('/post', verifyTokenAndAdmin, upload.single('imageFile'), async (req, res) => {
    const { title, description, price, pages, preview } = req.body;
    const imageFile = req.file;

    if (!imageFile || !title || !description || !price || !pages || !preview) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Upload to Cloudinary
        const imageUrl = await uploadToCloudinary(imageFile.buffer, imageFile.originalname);
        console.log(imageUrl);

        // Create a new Ebook document
        const newBook = new Ebook({
            imageUrl,
            title,
            description,
            price,
            pages,
            preview,
        });

        // Save to MongoDB
        await newBook.save();

        // Invalidate the cache for all eBooks (as new data is added)
        const redisClient = await initializeRedis();
        await redisClient.del('ebooks');

        res.status(201).json({ message: 'Ebook uploaded successfully', book: newBook });
    } catch (error) {
        console.error('Error saving ebook:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', messages: errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET ALL EBOOK
router.get("/", async (req, res) => {
    try {
        // Initialize Redis Client
        const redisClient = await initializeRedis();
        if (!redisClient) {
            return res.status(500).json({ error: "Redis client initialization failed" });
        }

        // Get pagination parameters from the query string
        const page = parseInt(req.query.page) || 1;  // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10;  // Default to 10 items per page if not provided

        // Calculate the number of items to skip
        const skip = (page - 1) * limit;

        // Check if the paginated eBooks are cached in Redis
        const cacheKey = `ebooks:page:${page}:limit:${limit}`;
        const cachedEbooks = await redisClient.get(cacheKey);
        if (cachedEbooks) {
            console.log("Ebooks fetched from cache for page:", page);  // Log cache hit
            return res.status(200).json(JSON.parse(cachedEbooks));  // Return cached eBooks
        }

        console.log("Ebooks not found in cache, fetching from MongoDB...");

        // Fetch paginated results from MongoDB
        const ebooks = await Ebook.find()
            .skip(skip)  // Skip the first `skip` items
            .limit(limit);  // Limit the results to `limit` items

        if (!ebooks || ebooks.length === 0) {
            return res.status(404).json({ message: "No ebooks found" });
        }

        // Get the total number of eBooks for pagination metadata
        const totalEbooks = await Ebook.countDocuments();

        // Create pagination metadata
        const pagination = {
            page,
            limit,
            totalItems: totalEbooks,
            totalPages: Math.ceil(totalEbooks / limit),  // Calculate total pages
        };

        console.log("Fetched ebooks from MongoDB:", ebooks);

        // Cache the paginated eBooks for future use
        await redisClient.set(cacheKey, JSON.stringify({ ebooks, pagination }), 'EX', 3600); // Cache for 1 hour
        console.log("Ebooks cached in Redis:", ebooks);  // Log what is being cached

        // Return the ebooks and pagination metadata
        res.status(200).json({ ebooks, pagination });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});


// GET ONE EBOOK
router.get("/find/:id", async (req, res) => {
    const ebookId = req.params.id;
    try {
        const redisClient = await initializeRedis();

        // Check if the single eBook is cached in Redis
        const cachedEbook = await redisClient.get(`ebook:${ebookId}`);
        if (cachedEbook) {
            return res.status(200).json(JSON.parse(cachedEbook)); // Return cached eBook
        }

        // If not cached, fetch from MongoDB
        const ebook = await Ebook.findById(ebookId);
        if (!ebook) {
            return res.status(404).json({ error: "Ebook not found" });
        }

        // Cache the eBook in Redis for future use
        await redisClient.set(`ebook:${ebookId}`, JSON.stringify(ebook), 'EX', 3600); // Cache for 1 hour

        res.status(200).json(ebook);
    } catch (error) {
        res.status(500).json(error);
    }
});

// UPDATE EBOOK
router.put("/update/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const ebookId = req.params.id;
        const updatedEbook = await Ebook.findByIdAndUpdate(
            ebookId,
            { $set: req.body },
            { new: true }
        );

        // Invalidate the cache for this specific eBook
        const redisClient = await initializeRedis();
        await redisClient.del(`ebook:${ebookId}`);

        // Optionally, invalidate all eBooks cache
        await redisClient.del('ebooks');

        res.status(200).json(updatedEbook);
    } catch (error) {
        res.status(500).json(error);
    }
});

// DELETE EBOOK
router.delete("/delete/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const ebookId = req.params.id;

        // Delete the Ebook from MongoDB
        await Ebook.findByIdAndDelete(ebookId);

        // Invalidate the cache for this specific eBook
        const redisClient = await initializeRedis();
        await redisClient.del(`ebook:${ebookId}`);

        // Optionally, invalidate all eBooks cache
        await redisClient.del('ebooks');

        res.status(200).json("Ebook deleted successfully");
    } catch (error) {
        res.status(500).json(error);
    }
});

module.exports = router;
