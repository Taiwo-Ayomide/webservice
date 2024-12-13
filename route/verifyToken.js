const jwt = require("jsonwebtoken");
const User = require("../Model/User");
const initializeRedis = require('../index');

// Utility for handling async errors
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware to verify token
const verifyToken = asyncHandler(async (req, res, next) => {
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
});

// Generalized conditional verification
const verifyConditional = condition => asyncHandler((req, res, next) => {
    if (condition(req)) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: "Access denied. Insufficient privileges."
        });
    }
});

// Middleware to verify token and authorization
const verifyTokenAndAuthorization = verifyConditional(req =>
    req.user.id === req.params.id || req.user.isAdmin
);

// Middleware to verify payment status
const verifyPaymentToken = verifyConditional(req =>
    req.user.id === req.params.id || req.user.isPaid
);

// Middleware to verify admin privileges
const verifyTokenAndAdmin = verifyConditional(req => req.user.isAdmin);

// Caching middleware with Redis
const cacheMiddleware = asyncHandler(async (req, res, next) => {
    const redisClient = await initializeRedis();
    if (!redisClient) {
        console.error('Redis client is not initialized');
        return next(); 
    }

    const key = req.originalUrl; 
    const cachedData = await redisClient.get(key); 

    if (cachedData) {
        // Send cached response if it exists
        return res.json(JSON.parse(cachedData));
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = async function (data) {
        await redisClient.setEx(key, 60 * 60 * 24, JSON.stringify(data)); // Cache for 24 hours
        return originalJson.call(this, data); // Send response
    };

    next();
});

// Error handling middleware (Optional addition)
const errorHandler = (err, req, res, next) => {
    console.error('Middleware error:', err.stack || err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
};

// Export all middleware
module.exports = {
    verifyToken,
    verifyTokenAndAuthorization,
    verifyPaymentToken,
    verifyTokenAndAdmin,
    cacheMiddleware,
    errorHandler
};
