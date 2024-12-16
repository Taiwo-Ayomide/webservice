const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const cluster = require("cluster");
const os = require("os");
const { initializeRedis } = require("./route/redisClient");

// Routes
const userRoute = require("./route/user");
const blogRoute = require("./route/blog");
const ebookRoute = require("./route/ebook");
const podcastRoute = require("./route/podcast");
const cartRoute = require("./route/cart");
const recipeRoute = require("./route/recipe");
const paystackPayment = require("./route/payment");

dotenv.config();
const app = express();

// Redis Client Initialization
initializeRedis().then((redisClient) => {
  // Optionally: You can store `redisClient` in a global variable if needed across routes
  app.locals.redisClient = redisClient;

  // Clustering for Multi-Core Usage
  if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    console.log(`Master cluster setting up ${numCPUs} workers...`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    // When a worker dies, fork a new one
    cluster.on("exit", (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died`);
    });
  } else {
    // Worker processes have to listen to the port
    const PORT = process.env.PORT || 5000;

    // Rate Limiter Configuration
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: "Too many requests, try again after 15 minutes",
    });

    app.use(limiter);

    // CORS Configuration
    const allowedOrigins = [
      "http://localhost:3000",
      "https://titoscornerbrand.vercel.app",
      "https://titoscorneradmin.vercel.app",
    ];

    app.use(
      cors({
        origin: (origin, callback) => {
          if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
      })
    );

    // Middleware
    app.use(express.json());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // MongoDB Connection
    mongoose
      .connect(process.env.MONGODB_API)
      .then(() => console.log("MongoDB Connected Successfully"))
      .catch((err) => console.error("MongoDB Connection Error:", err));

    // Test Route
    app.get("/test", (req, res) => {
      res.send("Welcome to the backend world");
    });

    // API Routes
    app.use("/api/users", userRoute);
    app.use("/api/blogs", blogRoute);
    app.use("/api/books", ebookRoute);
    app.use("/api/podcast", podcastRoute);
    app.use("/api/cart", cartRoute);
    app.use("/api/recipe", recipeRoute);
    app.use("/api/checkout", paystackPayment);

    // Start Server
    app.listen(PORT, () => {
      console.log(`Worker ${process.pid} started, Server listening on port ${PORT}`);
    });
  }
}).catch((err) => {
  console.error("Redis initialization failed:", err);
});
