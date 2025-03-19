import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
  }
});


redisClient.on("error", (err) => console.error("Redis Error:", err.message));
redisClient.on("connect", () => console.log("Redis Connected"));

export default redisClient;
