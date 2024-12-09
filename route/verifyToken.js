const jwt = require("jsonwebtoken");
const User = require("../Model/User");


const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.token;
        if (!authHeader || !authHeader.startsWith("Bearer")) {
            return res.status(401).json({
                success: false,
                message: "No authentication provided"
            });
        }
    
        const token = authHeader.split(" ")[1];
        const decode = jwt.verify(token, process.env.JWT_SEC);
        
        const user = await User.findById(decode.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }
    
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "Invalid authentication token"
        });
    }
};

const verifyTokenAndAuthorization = (req, res, next) => {
    verifyToken(req, res, () => {
        if(req.user.id === req.params.id || req.user.isAdmin) {
            next()
        } else {
            res.status(403).json("You are not allow to do that!");
        }
    });
}

const verifyPaymentToken = (req, res, next) => {
    verifyToken(req, res, () => {
        if(req.user.id === req.params.id || req.user.isPaid) {
            next()
        } else {
            res.status(403).json("You are not allow to do that!");
        }
    });
}

const verifyTokenAndAdmin = async (req, res, next) => {
    try {
        await verifyToken(req, res, async () => {
            if (req.user.isAdmin) {
                next();
            } else {
                res.status(403).json({
                    success: false,
                    message: "Access denied. Admin privileges required."
                });
            }
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "Authentication failed"
        });
    }
};


module.exports = {
    verifyToken,
    verifyTokenAndAuthorization,
    verifyPaymentToken,
    verifyTokenAndAdmin
};