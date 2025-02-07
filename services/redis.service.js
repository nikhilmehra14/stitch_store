import redis from "redis";

const useRedis = process.env.REDIS_URL !== undefined;

let redisClient;
if (useRedis) {
  redisClient = redis.createClient({ url: process.env.REDIS_URL });

  redisClient.on("error", (err) => console.error("Redis Client Error:", err));

  (async () => {
    try {
      await redisClient.connect();
      console.log("Connected to Redis");
    } catch (error) {
      console.error("Failed to connect to Redis. Falling back to in-memory storage.");
    }
  })();
}

const memoryStore = new Map();

const setDataWithExpiryInMemory = (key, value, expiryInSeconds) => {
  const expiryTime = Date.now() + expiryInSeconds * 1000;
  console.log("Expiry time: ", expiryTime, expiryInSeconds);
  memoryStore.set(key, { value, expiryTime });
  console.log("Data set in memory:", { key, value, expiryTime });

  setTimeout(() => {
    memoryStore.delete(key);
    console.log(`Key expired and removed from memory: ${key}`);
  }, expiryInSeconds * 1000);
};

const getDataFromMemory = (key) => {
  console.log(`Retrieving key from memory: ${key}`);
  const item = memoryStore.get(key);

  if (!item) {
    console.log(`Key not found in memory: ${key}`);
    return null;
  }

  if (Date.now() > item.expiryTime) {
    memoryStore.delete(key);
    console.log(`Key expired in memory: ${key}`);
    return null;
  }

  console.log("Data retrieved from memory:", item);
  return item.value;
};

const deleteDataFromMemory = (key) => {
  memoryStore.delete(key);
  console.log(`Key deleted from memory: ${key}`);
};

export const setDataWithExpiry = async (key, value, expiryInSeconds) => {
  if (useRedis && redisClient?.isOpen) {
    try {
      await redisClient.setEx(key, expiryInSeconds, JSON.stringify(value));
      console.log(`Data set in Redis: ${key}`);
    } catch (error) {
      console.error("Error setting data in Redis:", error);
      throw error;
    }
  } else {
    console.warn("Using in-memory store for setDataWithExpiry");
    setDataWithExpiryInMemory(key, value, expiryInSeconds);
  }
};

export const getData = async (key) => {
  if (useRedis && redisClient?.isOpen) {
    try {
      const data = await redisClient.get(key);
      console.log(`Data retrieved from Redis: ${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Error getting data from Redis:", error);
      throw error;
    }
  } else {
    console.warn("Using in-memory store for getData");
    return getDataFromMemory(key);
  }
};

export const deleteData = async (key) => {
  if (useRedis && redisClient?.isOpen) {
    try {
      await redisClient.del(key);
      console.log(`Key deleted from Redis: ${key}`);
    } catch (error) {
      console.error("Error deleting data from Redis:", error);
      throw error;
    }
  } else {
    console.warn("Using in-memory store for deleteData");
    deleteDataFromMemory(key);
  }
};
