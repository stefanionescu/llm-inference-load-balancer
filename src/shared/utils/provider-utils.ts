export interface TimeoutController {
  signal: AbortSignal;
  cleanup: () => void;
}

export function createTimeoutController(
  timeoutMs: number,
  clientSignal?: AbortSignal
): TimeoutController {
  // Create timeout controller
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // If there's no client signal, just return the timeout controller
  if (!clientSignal) {
    return {
      signal: timeoutController.signal,
      cleanup: () => clearTimeout(timeoutId)
    };
  }

  // Create a new controller that aborts if either signal aborts
  const controller = new AbortController();
  
  // Abort if timeout occurs
  timeoutController.signal.addEventListener('abort', () => {
    controller.abort(new Error('Request timeout'));
    clearTimeout(timeoutId);
  });

  // Abort if client disconnects
  clientSignal.addEventListener('abort', () => {
    controller.abort(clientSignal.reason);
    clearTimeout(timeoutId);
  });

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId)
  };
}

export function handleProviderError(error: unknown, providerName: string): Response {
  console.error(`${providerName} error:`, error);
  
  if (error instanceof Error) {
    if (error.message === 'Request aborted by client') {
      return new Response(null, { status: 499 }); // Client Closed Request
    }
    if (error.message === 'Request timeout') {
      return new Response('Request timeout', { status: 408 });
    }
    if (error.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    if (error.message.includes('rate_limit') || error.message.includes('quota_exceeded')) {
      return new Response('Rate limit exceeded', { status: 429 });
    }
  }
  
  throw error;
}

export async function createStreamResponse(
  response: Response,
  clientSignal?: AbortSignal,
  onComplete?: () => Promise<void>
): Promise<Response> {
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  let isDone = false;

  clientSignal?.addEventListener('abort', async () => {
    if (!isDone) {
      await reader.cancel();
      await writer.abort(clientSignal.reason || new Error('Stream aborted'));
    }
  });

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          isDone = true;
          if (onComplete) {
            await onComplete();
          }
          await writer.close();
          break;
        }
        await writer.write(value);
      }
    } catch (error) {
      if (!isDone) {
        await writer.abort(error as Error);
      }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

export function standardizeErrorResponse(error: unknown): Response {
  if (error instanceof Error && error.name === 'AbortError') {
    return new Response(
      JSON.stringify({
        error: 'Request aborted',
        timestamp: new Date().toISOString()
      }), {
        status: 499,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  if (error instanceof Error) {
    if (error.message.includes('Redis') || error.message.includes('connection')) {
      return new Response(
        JSON.stringify({
          error: 'Load balancer error',
          details: error.message,
          timestamp: new Date().toISOString()
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (error.message.includes('timeout')) {
      return new Response(
        JSON.stringify({
          error: 'Request timeout',
          timestamp: new Date().toISOString()
        }), {
          status: 408,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  return new Response(
    JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
} 