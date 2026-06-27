import { createClient } from 'redis';
import { config } from '../config/env.js';

const redisUrl = config.redisUrl;
export const redisClient = redisUrl ? createClient({ url: redisUrl }) : null;
export const redisSubClient = redisUrl ? redisClient.duplicate() : null;

export const redisStatus = {
  isActive: false
};

if (redisClient) {
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
    redisStatus.isActive = false;
  });
}

export async function connectRedis(onConnect) {
  if (!redisClient) return;
  try {
    await Promise.all([
      redisClient.connect(),
      redisSubClient.connect(),
    ]);
    console.log('Connected to Redis Cache.');
    redisStatus.isActive = true;
    if (onConnect) onConnect();
  } catch (err) {
    console.warn('Redis connection failed. Caching + Socket adapter disabled:', err.message);
    redisStatus.isActive = false;
  }
}

export async function getCache(key) {
  if (!redisStatus.isActive || !redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis read error:', err);
    return null;
  }
}

export async function setCache(key, value, ttlSeconds = 300) {
  if (!redisStatus.isActive || !redisClient) return;
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    console.error('Redis write error:', err);
  }
}

export async function invalidateCache(key) {
  if (!redisStatus.isActive || !redisClient) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error('Redis delete error:', err);
  }
}
