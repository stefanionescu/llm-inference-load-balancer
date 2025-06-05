import { Env, EndpointHandler } from './types.js';
import { validateApiToken } from './auth.js';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class Router {
  private routes: Map<string, EndpointHandler>;

  constructor() {
    this.routes = new Map();
  }

  add(path: string, handler: EndpointHandler) {
    this.routes.set(path, handler);
  }

  async handle(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const handler = this.routes.get(url.pathname);
      
      if (!handler) {
        throw new ApiError('Not Found', 404);
      }
  
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }
  
      // Skip auth validation for health endpoint
      if (url.pathname !== '/health') {
        await validateApiToken(request, env);
      }
  
      const response = await handler(request, env);
      
      // Add CORS headers to all responses
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      
      return new Response(response.body, {
        status: response.status,
        headers
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        return Response.json({ error: error.message }, {
          status: error.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (error instanceof Error) {
        const status = error.message.includes('API token') ? 401 : 500;
        return Response.json({ error: error.message }, {
          status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Fallback for unknown error types
      return Response.json({ error: 'Internal Server Error' }, {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}