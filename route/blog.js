const Blog = require("../Model/Blog");
const router = require("express").Router();
const { verifyTokenAndAdmin } = require('./verifyToken');


// POST
router.post("/post", verifyTokenAndAdmin, async (req, res) => {
    const newBlog = new Blog ({
        headline: req.body.headline,
        description: req.body.description,
        author: req.body.author,
    });

    try {
        const savedBlog = await newBlog.save();
        res.status(200).json(savedBlog);
    } catch (error) {
        res.status(500).json(error);
    }
});



// GET ALL BLOG
router.get("/", async (req, res) => {
    try {
        const blog = await Blog.find();
        res.status(200).json(blog);
    } catch (error) {
        res.status(500).json(error);
    }
});



// GET ONE BLOG
router.get("/find/:id", async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        res.status(200).json(blog);
    } catch (error) {
        res.status(500).json(error);
    }
});



// UPDATE
router.put("/update/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const blog = await Blog.findByIdAndUpdate(
            req.params.id,
            {
                $set: req.body,
            },
            { new: true },
        );
        res.status(200).json(blog);
    } catch (error) {
        res.status(500).json(error);
    }
});



// DELETE
router.delete("/delete/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        await Blog.findByIdAndDelete(
            req.params.id
        );
        res.status(200).json("Data Deleted Successfully");
    } catch (error) {
        res.status(500).json(error);
    }
});



module.exports = router;