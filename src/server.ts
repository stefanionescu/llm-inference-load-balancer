import { EndpointHandler, Env } from './types.js';
import { Router } from './router.js';

import { errorHandler } from './middleware/errorHandler.js';
import { rateLimitMiddleware, createRateLimitResponse } from './middleware/rateLimiter.js';

import { contentUsageVerificationBalancer } from './endpoints/content-usage-balancer.js';
import { roleplayBalancer } from './endpoints/roleplay-balancer.js';
import { healthCheck } from "./endpoints/health.js";

import { initializeRedis, getRedisClient } from './config/redis.js';
import { nodeToFetchRequest, fetchToNodeResponse } from './utils/requestUtils.js';

import dotenv from 'dotenv';
import http from 'http';
import helmet from 'helmet';
import pinoHttpModule from 'pino-http';
import { SERVER_SHUTDOWN_TIMEOUT_MS } from './config.js';

dotenv.config();

// Set up Pino logger
const pinoHttp = (pinoHttpModule as any).default || pinoHttpModule;

const pinoMiddleware = pinoHttp({
  // Use pino-pretty for development/local environments
  transport:
    process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  level: 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

// Initialize helmet with defaults (just like Express)
const helmetMiddleware = helmet();

// Initialize router
const router = new Router();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Start server function
async function startServer() {
  try {
    // Environment validation and initialization
    const env: Env = {
      API_TOKEN: process.env.API_TOKEN!,
      OPENAI_CONFIGS: process.env.OPENAI_CONFIGS!,
      ANTHROPIC_CONFIGS: process.env.ANTHROPIC_CONFIGS,
      GROQ_CONFIGS: process.env.GROQ_CONFIGS,
      TOGETHER_CONFIGS: process.env.TOGETHER_CONFIGS,
      FIREWORKS_CONFIGS: process.env.FIREWORKS_CONFIGS,
      REPLICATE_CONFIGS: process.env.REPLICATE_CONFIGS,
      HYPERBOLIC_CONFIGS: process.env.HYPERBOLIC_CONFIGS,
      DEEPINFRA_CONFIGS: process.env.DEEPINFRA_CONFIGS,
      OPENROUTER_CONFIGS: process.env.OPENROUTER_CONFIGS,
      AWAN_CONFIGS: process.env.AWAN_CONFIGS,
      CLARIFAI_CONFIGS: process.env.CLARIFAI_CONFIGS,
      LAMBDA_LABS_CONFIGS: process.env.LAMBDA_LABS_CONFIGS,
      AVIAN_IO_CONFIGS: process.env.AVIAN_IO_CONFIGS,
      KLUSTER_AI_CONFIGS: process.env.KLUSTER_AI_CONFIGS,
      NOVITA_AI_CONFIGS: process.env.NOVITA_AI_CONFIGS,
      INFERENCE_NET_CONFIGS: process.env.INFERENCE_NET_CONFIGS,
      REDIS_REST_URL: process.env.REDIS_REST_URL!,
      REDIS_REST_PORT: process.env.REDIS_REST_PORT!,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD!,
    };

    // Initialize Redis
    const redis = await initializeRedis(env);
    
    // Register routes
    router.add('/verify-content-usage', contentUsageVerificationBalancer);
    router.add('/roleplay', roleplayBalancer);
    router.add('/health', healthCheck);

    // Create HTTP server
    const server = http.createServer(async (req, res) => {
      try {
        // Apply security headers (helmet)
        helmetMiddleware(req as any, res as any, () => {});
        
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, corsHeaders);
          res.end();
          return;
        }

        // Apply rate limiting
        if (!rateLimitMiddleware(req)) {
          const rateLimitResponse = createRateLimitResponse(corsHeaders);
          res.writeHead(rateLimitResponse.statusCode, rateLimitResponse.headers);
          res.end(rateLimitResponse.body);
          return;
        }
    
        // Apply Pino logging
        pinoMiddleware(req, res);
        
        const fetchRequest = await nodeToFetchRequest(req);
        // Pass redis client to router
        const fetchResponse = await router.handle(fetchRequest, { ...env, redis });
        await fetchToNodeResponse(fetchResponse, res, corsHeaders);
      } catch (error) {
        errorHandler(error, res);
      }
    });

    // Start the server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Graceful shutdown handling
    const shutdown = async () => {
      console.log('Shutting down server...');
      server.close(async () => {
        console.log('HTTP server closed');
        const redisClient = getRedisClient();
        if (redisClient?.isOpen) {
          await redisClient.quit();
          console.log('Redis connection closed');
        }
        process.exit(0);
      });

      // Force close after timeout
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, SERVER_SHUTDOWN_TIMEOUT_MS);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exit(1);
});

// Add type for Router.getHandler
declare module './router.js' {
  interface Router {
    getHandler(path: string): EndpointHandler | undefined;
  }
}