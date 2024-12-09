const router = require("express").Router();
const User = require("../Model/User");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const { verifyTokenAndAdmin } = require('./verifyToken');


// REGISTER
router.post("/register", async (req, res) => {
    try {
        const { fullname, email, nationality, password } = req.body;
        
        // Let's encrypt the password
        const encryptedPassword = CryptoJS.AES.encrypt(password, process.env.PASS_SEC).toString();

        // Create new user instance
        const newUser = new User({
            fullname,
            email,
            nationality,
            password: encryptedPassword
        });

        // Save user to database
        const savedUser = await newUser.save();
        
        // Send success response
        res.status(200).json(savedUser);
    } catch (error) {
        // Send error response
        res.status(500).json({ message: error.message });
    }
});



// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    // !user && res.status(400).json("wrong information");
    if (!user) {
        return res.status(400).json("Wrong Email")
    }



    const hashpassword = CryptoJS.AES.decrypt(
        user.password,
        process.env.PASS_SEC,
    );
    const originalPassword = hashpassword.toString(CryptoJS.enc.Utf8);


    if (originalPassword !== password) {
        return res.status(401).json("Wrong password")
    }

    const accessToken = jwt.sign(
        {
            id: user._id,
            isAdmin: user.isAdmin,
        }, 
        process.env.JWT_SEC,
        { expiresIn: "3d" },

    );
    const { password:_, ...others } = user._doc;

    res.status(200).json({ ...others, accessToken });

  } catch (error) {
    res.status(500).json(error.message); 
  }

});


// GET ALL USERS
router.get("/", async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json(error);
    }
});


// GET ONE USER
router.get("/find/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.status(200).json(user);

    } catch (error) {
        res.status(500).json(error);
    }
});



// UPDATE
router.put("/update/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                $set: req.body,
            },
            { new: true },
        );

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json(error)
    }
});



// DELETE
router.delete("/delete/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json("Data Deleted Successfully");
    } catch (error) {
        res.status(500).json(error);
    }
});


module.exports = router;