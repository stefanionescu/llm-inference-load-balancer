import http from 'http';
import { 
  RATE_LIMIT_WINDOW_MS, 
  RATE_LIMIT_MAX_REQUESTS, 
  RATE_LIMIT_RETRY_AFTER_SECONDS 
} from '../config.js';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = (req: http.IncomingMessage): boolean => {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const existing = rateLimitMap.get(ip);
  
  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  existing.count++;
  return true;
};

export const createRateLimitResponse = (corsHeaders: Record<string, string>) => {
  return {
    statusCode: 429,
    headers: { 
      'Content-Type': 'application/json',
      'Retry-After': RATE_LIMIT_RETRY_AFTER_SECONDS.toString(),
      ...corsHeaders 
    },
    body: JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: RATE_LIMIT_RETRY_AFTER_SECONDS
    })
  };
}; 