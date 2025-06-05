import { Env, EndpointHandler, RoleplayRequestBody, RoleplayMessage } from '../types.js';
import { LoadBalancer } from '../balancers/roleplayLoadBalancer.js';
import { 
  validateHttpMethod, 
  validateRedisConnection, 
  createAbortController, 
  handleRequestError,
  validateRequiredField
} from '../shared/utils/endpoint-utils.js';

export const roleplayBalancer: EndpointHandler = async (request: Request, env: Env) => {
  // Validate HTTP method
  const methodValidation = validateHttpMethod(request);
  if (!methodValidation.success) {
    return methodValidation.response!;
  }

  // Check Redis connection
  const redisValidation = validateRedisConnection(env);
  if (!redisValidation.success) {
    return redisValidation.response!;
  }

  // Add abort signal handling
  const abortController = createAbortController(request);
  const { signal } = abortController;
  let responseStarted = false;

  try {
    const body = await request.json() as RoleplayRequestBody;

    // Validate required fields
    const systemPromptValidation = validateRequiredField(body, 'systemPrompt');
    if (!systemPromptValidation.success) {
      return systemPromptValidation.response!;
    }

    const messagesValidation = validateRequiredField(body, 'messages', 'array');
    if (!messagesValidation.success) {
      return messagesValidation.response!;
    }

    // Validate message format
    const isValidMessage = (msg: RoleplayMessage): boolean => {
      return (
        ['user', 'assistant', 'system'].includes(msg.role) &&
        Array.isArray(msg.content) &&
        msg.content.length > 0 &&
        msg.content.every(c => c.type === 'text' && typeof c.text === 'string')
      );
    };

    if (!body.messages.every(isValidMessage)) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation error',
          details: 'Invalid message format',
          timestamp: new Date().toISOString()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const maxTokens = body.maxTokens || 200;
    const stream = body.stream ?? true;

    // Create load balancer with Redis instance
    const loadBalancer = new LoadBalancer(env, env.redis!);
    responseStarted = true;
    
    return await loadBalancer.getResponse({
      messages: body.messages,
      systemPrompt: body.systemPrompt,
      maxTokens: Math.floor(maxTokens),
      env,
      stream,
      signal
    });

  } catch (error) {
    const errorResponse = handleRequestError(error, responseStarted);
    if (errorResponse) {
      return errorResponse;
    }
    
    // If response already started, let the error propagate
    throw error;
  }
};