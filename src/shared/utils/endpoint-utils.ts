import { Env } from '../../types.js';

export interface EndpointResponse {
  success: boolean;
  response?: Response;
  error?: string;
}

export function validateHttpMethod(request: Request, expectedMethod: string = 'POST'): EndpointResponse {
  if (request.method !== expectedMethod) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }
  return { success: true };
}

export function validateRedisConnection(env: Env): EndpointResponse {
  if (!env.redis?.isOpen) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: 'Service unavailable',
          details: 'Database connection not available',
          timestamp: new Date().toISOString()
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }
  return { success: true };
}

export function createAbortController(request: Request): AbortController {
  const abortController = new AbortController();
  
  request.signal.addEventListener('abort', () => {
    console.log('Client disconnected, aborting request');
    abortController.abort();
  });
  
  return abortController;
}

export function handleRequestError(error: unknown, responseStarted: boolean): Response | null {
  console.error('Request error:', error);
  
  // Only send error response if headers haven't been sent
  if (!responseStarted) {
    if (error instanceof SyntaxError) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          details: 'Invalid JSON payload',
          timestamp: new Date().toISOString()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Don't send error response for aborted requests
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(null, { status: 499 }); // Client Closed Request
    }

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: 'Unexpected error occurred',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  return null; // Let the error propagate if response already started
}

export function validateRequiredField(
  body: any,
  fieldName: string,
  fieldType: 'string' | 'array' | 'object' = 'string'
): EndpointResponse {
  if (!body || !body[fieldName]) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ 
          error: 'Validation error',
          details: `${fieldName} is required`,
          timestamp: new Date().toISOString()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }

  if (fieldType === 'array' && (!Array.isArray(body[fieldName]) || body[fieldName].length === 0)) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ 
          error: 'Validation error',
          details: `${fieldName} must be a non-empty array`,
          timestamp: new Date().toISOString()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }

  return { success: true };
} 