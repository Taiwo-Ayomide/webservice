const Recipe = require("../Model/Recipe");
const router = require("express").Router();
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('./cloudinaryConfig');
const { verifyToken, verifyTokenAndAdmin } = require('./verifyToken');
const { initializeRedis } = require("./redisClient");

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload to Cloudinary
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

// POST - Upload new recipe
router.post('/upload', verifyTokenAndAdmin, upload.single('imageFile'), async (req, res) => {
    const imageFile = req.file;
    const { backgroundstory, ingredients, steps } = req.body;

    if (!imageFile || !backgroundstory || !ingredients || !steps) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Upload to Cloudinary
        const imageUrl = await uploadToCloudinary(imageFile.buffer);

        // Create a new recipe document
        const newRecipe = new Recipe({
            imageUrl,
            backgroundstory,
            ingredients,
            steps,
        });

        // Save to MongoDB
        await newRecipe.save();

        // Initialize Redis client and invalidate cache for recipes
        const redisClient = await initializeRedis();
        await redisClient.del('recipes');  // Clear all recipes cache

        res.status(201).json({ message: 'Recipe uploaded successfully', recipe: newRecipe });
    } catch (error) {
        console.error('Error saving recipe:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            res.status(400).json({ error: 'Validation failed', messages: errors });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// GET ALL RECIPES (with Redis caching)
router.get("/", async (req, res) => {
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 6; // Default to 6 recipes per page

    try {
        const redisClient = await initializeRedis();

        // Check if recipes are cached in Redis
        const cachedRecipes = await redisClient.get('recipes');
        if (cachedRecipes) {
            console.log("Recipes fetched from cache:", cachedRecipes);  // Log cache hit
            return res.status(200).json(JSON.parse(cachedRecipes)); // Return cached recipes
        }

        console.log("Recipes not found in cache, fetching from MongoDB...");

        // Fetch recipes from MongoDB
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

        // Cache recipes for future use
        await redisClient.set('recipes', JSON.stringify({ recipes, totalRecipes, totalPages: Math.ceil(totalRecipes / limit), currentPage: page }), 'EX', 3600);
        console.log("Recipes cached in Redis:", recipes);  // Log what is being cached

    } catch (error) {
        console.error("Error fetching recipes:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// GET ONE RECIPE (with Redis caching)
router.get("/find/:id", async (req, res) => {
    const recipeId = req.params.id;
    try {
        const redisClient = await initializeRedis();

        // Check if the single recipe is cached in Redis
        const cachedRecipe = await redisClient.get(`recipe:${recipeId}`);
        if (cachedRecipe) {
            return res.status(200).json(JSON.parse(cachedRecipe)); // Return cached recipe
        }

        // If not cached, fetch from MongoDB
        const recipe = await Recipe.findById(recipeId);
        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found" });
        }

        // Cache the recipe in Redis for future use
        await redisClient.set(`recipe:${recipeId}`, JSON.stringify(recipe), 'EX', 3600); // Cache for 1 hour

        res.status(200).json(recipe);
    } catch (error) {
        res.status(500).json(error);
    }
});

// UPDATE RECIPE
router.put("/update/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const recipeId = req.params.id;
        const updatedRecipe = await Recipe.findByIdAndUpdate(
            recipeId,
            { $set: req.body },
            { new: true }
        );

        // Invalidate the cache for this specific recipe
        const redisClient = await initializeRedis();
        await redisClient.del(`recipe:${recipeId}`);

        // Optionally, invalidate all recipes cache
        await redisClient.del('recipes');

        res.status(200).json(updatedRecipe);
    } catch (error) {
        res.status(500).json(error);
    }
});

// DELETE RECIPE
router.delete("/delete/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const recipeId = req.params.id;

        // Delete the recipe from MongoDB
        await Recipe.findByIdAndDelete(recipeId);

        // Invalidate the cache for this specific recipe
        const redisClient = await initializeRedis();
        await redisClient.del(`recipe:${recipeId}`);

        // Optionally, invalidate all recipes cache
        await redisClient.del('recipes');

        res.status(200).json("Recipe deleted successfully");
    } catch (error) {
        res.status(500).json(error);
    }
});

module.exports = router;
