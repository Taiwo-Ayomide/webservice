const express = require("express");
const Blog = require("../Model/Blog");
const router = express.Router();
const { verifyTokenAndAdmin } = require('./verifyToken');
const { initializeRedis } = require("./redisClient");  // Assuming this is set up for Redis caching

// POST - Admin only (Create a new Blog)
router.post("/post", verifyTokenAndAdmin, async (req, res) => {
    const { headline, description, author } = req.body;

    // Validate required fields
    if (!headline || !description || !author) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const newBlog = new Blog({
        headline,
        description,
        author,
    });

    try {
        const savedBlog = await newBlog.save();
        res.status(201).json(savedBlog);  // 201 indicates resource was created successfully
    } catch (error) {
        console.error('Error saving blog:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// GET ALL BLOGS - With Redis caching
router.get("/", async (req, res) => {
    try {
        const redisClient = await initializeRedis();

        // Get pagination parameters from the query string
        const page = parseInt(req.query.page) || 1;  // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10;  // Default to 10 blogs per page if not provided

        // Calculate the number of items to skip
        const skip = (page - 1) * limit;

        // Check if the paginated blogs are cached in Redis
        const cacheKey = `blogs:page:${page}:limit:${limit}`;
        const cachedBlogs = await redisClient.get(cacheKey);
        if (cachedBlogs) {
            console.log("Blogs fetched from cache for page:", page);  // Log cache hit
            return res.status(200).json(JSON.parse(cachedBlogs));  // Return cached blogs
        }

        console.log("Blogs not found in cache, fetching from MongoDB...");

        // Fetch paginated blogs from MongoDB
        const blogs = await Blog.find()
            .skip(skip)  // Skip the first `skip` blogs
            .limit(limit);  // Limit the results to `limit` blogs

        if (!blogs || blogs.length === 0) {
            return res.status(404).json({ message: "No blogs found" });
        }

        // Get the total number of blogs for pagination metadata
        const totalBlogs = await Blog.countDocuments();

        // Create pagination metadata
        const pagination = {
            page,
            limit,
            totalItems: totalBlogs,
            totalPages: Math.ceil(totalBlogs / limit),  // Calculate total pages
        };

        console.log("Fetched blogs from MongoDB:", blogs);

        // Cache the paginated blogs for future use
        await redisClient.set(cacheKey, JSON.stringify({ blogs, pagination }), 'EX', 3600); // Cache for 1 hour
        console.log("Blogs cached in Redis:", blogs);  // Log what is being cached

        // Return the blogs and pagination metadata
        res.status(200).json({ blogs, pagination });
    } catch (error) {
        console.error("Error fetching blogs:", error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});


// GET ONE BLOG - With Redis caching
router.get("/find/:id", async (req, res) => {
    const blogId = req.params.id;
    try {
        // Initialize Redis Client
        const redisClient = await initializeRedis();

        // Check if the single blog is cached in Redis
        const cachedBlog = await redisClient.get(`blog:${blogId}`);
        if (cachedBlog) {
            console.log("Blog fetched from cache");
            return res.status(200).json(JSON.parse(cachedBlog));  // Return cached blog
        }

        // Fetch from MongoDB
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        // Cache the blog in Redis for future use
        await redisClient.set(`blog:${blogId}`, JSON.stringify(blog), 'EX', 3600); // Cache for 1 hour
        console.log("Blog cached in Redis:", blog);

        res.status(200).json(blog);
    } catch (error) {
        console.error("Error fetching blog:", error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// UPDATE - Admin only
router.put("/update/:id", verifyTokenAndAdmin, async (req, res) => {
    const blogId = req.params.id;
    try {
        const updatedBlog = await Blog.findByIdAndUpdate(
            blogId,
            { $set: req.body },
            { new: true }
        );

        if (!updatedBlog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        // Invalidate the cache for this specific blog
        const redisClient = await initializeRedis();
        await redisClient.del(`blog:${blogId}`);

        // Optionally, invalidate all blogs cache
        await redisClient.del('blogs');

        res.status(200).json(updatedBlog);
    } catch (error) {
        console.error("Error updating blog:", error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// DELETE - Admin only
router.delete("/delete/:id", verifyTokenAndAdmin, async (req, res) => {
    const blogId = req.params.id;
    try {
        const deletedBlog = await Blog.findByIdAndDelete(blogId);
        if (!deletedBlog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        // Invalidate the cache for this specific blog
        const redisClient = await initializeRedis();
        await redisClient.del(`blog:${blogId}`);

        // Optionally, invalidate all blogs cache
        await redisClient.del('blogs');

        res.status(200).json({ message: "Blog deleted successfully" });
    } catch (error) {
        console.error("Error deleting blog:", error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
