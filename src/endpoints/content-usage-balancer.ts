import { Env, EndpointHandler, RequestBody } from '../types.js';
import { CONTENT_USAGE_CHECK_PROMPT } from '../config.js';
import { LoadBalancer } from '../balancers/contentUsageLoadBalancer.js';
import { 
  validateHttpMethod, 
  validateRedisConnection, 
  createAbortController, 
  handleRequestError,
  validateRequiredField
} from '../shared/utils/endpoint-utils.js';

export const contentUsageVerificationBalancer: EndpointHandler = async (request: Request, env: Env) => {
  // Validate HTTP method
  const methodValidation = validateHttpMethod(request);
  if (!methodValidation.success) {
    return methodValidation.response!;
  }

  // Validate Redis connection
  const redisValidation = validateRedisConnection(env);
  if (!redisValidation.success) {
    return redisValidation.response!;
  }

  // Add abort signal handling
  const abortController = createAbortController(request);
  const { signal } = abortController;
  let responseStarted = false;

  try {
    // Parse and validate request body
    const body = await request.json() as RequestBody;
    
    // Validate required fields
    const promptValidation = validateRequiredField(body, 'prompt');
    if (!promptValidation.success) {
      return promptValidation.response!;
    }

    const maxTokens = body.maxTokens || 40;
    const stream = body.stream ?? true;
    const systemPrompt = body.systemPrompt || CONTENT_USAGE_CHECK_PROMPT;

    // Initialize load balancer with Redis instance
    const loadBalancer = new LoadBalancer(env, env.redis!);
    responseStarted = true;
    
    return await loadBalancer.getResponse({
      prompt: body.prompt,
      systemPrompt,
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