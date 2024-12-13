const { createClient } = require("redis");

let redisClient;

const initializeRedis = async () => {
  if (!redisClient) {
    redisClient = createClient({
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
    });

    redisClient.on("error", (err) => {
      console.error("Redis Client Error", err);
    });

    try {
      await redisClient.connect();
      console.log("Connected to Redis Cloud");
    } catch (err) {
      console.error("Redis Connection Failed:", err);
    }
  }

  return redisClient;
};

module.exports = { initializeRedis };
