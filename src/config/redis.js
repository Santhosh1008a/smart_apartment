const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient;

const initRedis = async () => {
  if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    await redisClient.connect();
    logger.info('Connected to Redis Cache');
  } else {
    logger.info('No REDIS_URL provided in .env, skipping Redis setup (Running smoothly without cache)');
  }
};

const getCache = async (key) => {
  if (!redisClient) return null;
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

const setCache = async (key, value, expiresInSeconds = 300) => {
  if (!redisClient) return;
  await redisClient.setEx(key, expiresInSeconds, JSON.stringify(value));
};

const clearCache = async (prefix) => {
    if (!redisClient) return;
    const keys = await redisClient.keys(`${prefix}*`);
    if(keys.length > 0) {
        await redisClient.del(keys);
    }
}

module.exports = { initRedis, getCache, setCache, clearCache };
