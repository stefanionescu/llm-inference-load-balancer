import { Env } from './types.js';

export async function validateApiToken(request: Request, env: Env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error("API token required");
  }

  const token = authHeader.split(' ')[1];
  if (token !== env.API_TOKEN) {
    throw new Error("Invalid API token");
  }
}