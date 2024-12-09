const Cart = require("../Model/Cart");
const router = require("express").Router();
const { verifyToken } = require('./verifyToken');




// POST
router.post("/", verifyToken, async (req, res) => {
    const newCart = new Cart ({
        cover: req.body.cover,
        title: req.body.title,
        price: req.body.price,
    });


    try {
        const savedCart = await newCart.save();
        res.status(200).json(savedCart);
    } catch (error) {
        res.status(500).json(error);
    }
});



// GET ALL ORDERS
router.get("/", verifyToken, async (req, res) => {
    try {
        const cart = await Cart.find();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json(error);
    }
});



// GET ONE ORDER
router.get("/find/:id", verifyToken, async (req, res) => {
    try {
        const cart = await Cart.findById(req.params.id);
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json(error);
    }
});



// UPDATE
router.put("/update/:id", verifyToken, async (req, res) => {
    try {
        const cart = await Cart.findByIdAndUpdate(
            req.params.id,
            {
                $set: req.body,
            },
            { new: true },
        );
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json(error);
    }
});



// DELETE
router.delete("/delete/:id", verifyToken, async (req, res) => {
    try {
        await Cart.findByIdAndDelete(
            req.params.id
            );
        res.status(200).json("Data Deleted Successfully");
    } catch (error) {
        res.status(500).json(error);
    }
});



module.exports = router;