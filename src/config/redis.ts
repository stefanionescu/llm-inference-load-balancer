import { createClient, RedisClientType } from 'redis';
import { Env } from '../types.js';
import { REDIS_HEALTH_CHECK_INTERVAL_MS } from '../config.js';

let redisClient: RedisClientType | null = null;

export async function initializeRedis(env: Env): Promise<RedisClientType> {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  console.log('Initializing Redis connection...');
  
  redisClient = createClient({
    password: env.REDIS_PASSWORD,
    socket: {
      host: env.REDIS_REST_URL,
      port: parseInt(env.REDIS_REST_PORT)
    }
  });

  redisClient.on('error', err => console.error('Redis Client Error:', err));
  redisClient.on('connect', () => console.log('Redis connected'));
  redisClient.on('reconnecting', () => console.log('Redis reconnecting...'));
  redisClient.on('ready', () => console.log('Redis ready'));
  redisClient.on('end', () => console.log('Redis connection ended'));

  await redisClient.connect();
  
  // Periodic health check
  setInterval(async () => {
    try {
      if (redisClient?.isOpen) {
        await redisClient.ping();
      } else {
        console.log('Redis connection lost, attempting to reconnect...');
        await redisClient?.connect();
      }
    } catch (error) {
      console.error('Redis health check failed:', error);
    }
  }, REDIS_HEALTH_CHECK_INTERVAL_MS);

  return redisClient;
}

export function getRedisClient(): RedisClientType | null {
  return redisClient;
} 