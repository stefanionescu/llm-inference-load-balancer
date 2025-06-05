import { EndpointHandler, Env } from '../types.js';

interface HealthStatus {
  status: string;
  redis: {
    connected: boolean;
    status: string;
  };
  timestamp: string;
}

export const healthCheck: EndpointHandler = async (request, env: Env) => {
  try {
    const redisClient = env.redis;
    let redisStatus: HealthStatus['redis'] = {
      connected: false,
      status: 'disconnected'
    };

    // Check Redis connection
    if (redisClient?.isOpen) {
      try {
        await redisClient.ping();
        redisStatus = {
          connected: true,
          status: 'connected'
        };
      } catch (error) {
        redisStatus = {
          connected: false,
          status: 'error: failed to ping'
        };
      }
    }

    const healthStatus: HealthStatus = {
      status: redisStatus.connected ? 'healthy' : 'degraded',
      redis: redisStatus,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: redisStatus.connected ? 200 : 503,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const errorResponse = {
      status: 'unhealthy',
      redis: {
        connected: false,
        status: 'error: failed to check'
      },
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};