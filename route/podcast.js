const express = require('express');
const multer = require('multer');
const cloudinary = require('./cloudinaryConfig');
const Podcast = require('../Model/Podcast');
const router = express.Router();
const streamifier = require('streamifier');
const { verifyTokenAndAdmin } = require('./verifyToken');



// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

router.post('/upload', verifyTokenAndAdmin, upload.single('audioFile'), async (req, res) => {
    const { title, description, producers } = req.body;
    const audioFile = req.file;

    if (!title || !description || !producers || !audioFile) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Upload to Cloudinary
        const audioUrl = await uploadToCloudinary(audioFile.buffer, audioFile.originalname);

        // Create a new audio document
        const newAudio = new Podcast({
            title,
            description,
            producers: producers.split(',').map(producer => producer.trim()), // Assuming producers are sent as comma-separated values
            audioUrl
        });

        // Save to MongoDB
        await newAudio.save();

        res.status(201).json({ message: 'Audio uploaded successfully', audio: newAudio });
    } catch (error) {
        console.error('Error saving audio:', error);

        if (error.name === 'ValidationError') {
            // Extract validation error messages
            const errors = Object.values(error.errors).map(err => err.message);
            res.status(400).json({ error: 'Validation failed', messages: errors });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});



// GET ALL PODCAST
router.get("/", async (req, res) => {
    try {
        const podcast = await Podcast.find();
        res.status(200).json(podcast);
    } catch (error) {
        res.status(500).json(error);
    }
});


// GET ONE PODCAST
router.get("/find/:id", async (req, res) => {
    try {
        const podcast = await Podcast.findById(req.params.id);
        res.status(200).json(podcast);
    } catch (error) {
        res.status(500).json(error)
    }
});



// UPDATE
router.put("/update/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const podcast = await Podcast.findByIdAndUpdate(
            req.params.id,
            {
                $set: req.body
            },
            { new: true },
        );
        res.status(200).json(podcast);
    } catch (error) {
        res.status(500).json(error);
    }
});



// DELETE
router.delete("/delete/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        await Podcast.findByIdAndDelete(req.params.id);
        res.status(200).json("Data Deleted Successfully");
    } catch (error) {
        res.status(500).json(error);
    }
});



module.exports = router;