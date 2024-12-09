const Recipe = require("../Model/Recipe");
const router = require("express").Router();
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('./cloudinaryConfig');
const { verifyToken, verifyTokenAndAdmin } = require('./verifyToken');


// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: "recipes" },
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

router.post('/upload', verifyTokenAndAdmin, upload.single('imageFile'), async (req, res) => {
    const imageFile = req.file;
    const { backgroundstory, ingredients, steps } = req.body;

    if (!imageFile || !backgroundstory || !ingredients || !steps) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Upload to Cloudinary
        const imageUrl = await uploadToCloudinary(imageFile.buffer, imageFile.originalname);

        // Create a new recipe document
        const newRecipe = new Recipe({
            imageUrl,
            backgroundstory,
            ingredients,
            steps,
        });

        // Save to MongoDB
        await newRecipe.save();

        res.status(201).json({ message: 'Recipe uploaded successfully', recipe: newRecipe });
    } catch (error) {
        console.error('Error saving recipe:', error);

        if (error.name === 'ValidationError') {
            // Extract validation error messages
            const errors = Object.values(error.errors).map(err => err.message);
            res.status(400).json({ error: 'Validation failed', messages: errors });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});


// GET ALL RECIPES
router.get("/", async (req, res) => {
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 6; // Default to 6 recipes per page

    try {
        const recipes = await Recipe.find()
            .skip((page - 1) * limit) // Skip previous pages
            .limit(limit); // Limit number of recipes per page
        const totalRecipes = await Recipe.countDocuments(); // Total number of recipes

        res.status(200).json({
            recipes,
            totalRecipes,
            totalPages: Math.ceil(totalRecipes / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json(error);
    }
});




// GET ONE RECIPE
router.get("/find/:id", async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        res.status(200).json(recipe);
    } catch (error) {
        res.status(500).json(error);
    }
});



// UPDATE
router.put("/update/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const recipe = await Recipe.findByIdAndUpdate(
            req.params.id,
            {
                $set: req.body,
            },
            { new: true }
        );
        res.status(200).json(recipe);
    } catch (error) {
        res.status(500).json(error);
    }
});



// DELETE
router.delete("/delete/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        await Recipe.findByIdAndDelete(
            req.params.id
            );
        res.status(200).json("Data Deleted Successfully");
    } catch (error) {
        res.status(500).json(error);
    }
});



module.exports = router;