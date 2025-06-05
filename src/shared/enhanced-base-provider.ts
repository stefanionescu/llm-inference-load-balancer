import { ProviderProfile } from "../types.js";
import { createTimeoutController, handleProviderError, createStreamResponse } from "./utils/provider-utils.js";

export interface BaseProviderRequestParams {
  apiKey: string;
  stream: boolean;
  signal?: AbortSignal;
}

export abstract class EnhancedBaseProvider<TParams extends BaseProviderRequestParams> {
  abstract name: string;
  protected abstract baseURL: string;
  protected profiles: ProviderProfile[];
  protected abstract timeoutMs: number;

  constructor(profiles: ProviderProfile[]) {
    this.profiles = profiles;
  }

  getProfiles(): ProviderProfile[] {
    return this.profiles;
  }

  protected abstract getHeaders(apiKey: string): Record<string, string>;
  protected abstract formatRequestBody(params: TParams): object;

  protected async makeRequest(params: TParams): Promise<Response> {
    const { signal, cleanup } = createTimeoutController(this.timeoutMs, params.signal);
    
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getHeaders(params.apiKey),
        body: JSON.stringify(this.formatRequestBody(params)),
        signal
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`${this.name} API error: ${JSON.stringify(error)}`);
      }

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Check if it was a timeout or client abort
          if (error.message === 'Request timeout') {
            throw new Error('Request timeout');
          } else {
            throw new Error('Request aborted by client');
          }
        }
      }
      throw error;
    } finally {
      cleanup();
    }
  }

  async streamResponse(params: TParams): Promise<Response> {
    try {
      const response = await this.makeRequest({ ...params, stream: true });

      if (response.status === 429) {
        console.warn(`${this.name} rate limit reached`);
        return response;
      }

      return await createStreamResponse(
        response,
        params.signal
      );

    } catch (error) {
      return handleProviderError(error, this.name);
    }
  }

  async regularResponse(params: TParams): Promise<Response> {
    const { signal, cleanup } = createTimeoutController(this.timeoutMs, params.signal);
    
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getHeaders(params.apiKey),
        body: JSON.stringify(this.formatRequestBody({ ...params, stream: false })),
        signal
      });

      if (response.status === 429) {
        console.warn(`${this.name} rate limit reached`);
        return response;
      }

      const responseText = await response.text();
      const parsedResponse = this.parseRegularResponse(responseText);

      return new Response(JSON.stringify(parsedResponse), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 200
      });

    } catch (error) {
      return handleProviderError(error, this.name);
    } finally {
      cleanup();
    }
  }

  protected parseRegularResponse(responseText: string): any {
    try {
      const response = JSON.parse(responseText);
      
      // Extract only the content, filtering out all provider metadata
      if (response.choices && response.choices[0] && response.choices[0].message) {
        return {
          content: response.choices[0].message.content
        };
      }
      
      // Fallback for other response formats
      return response;
    } catch (error) {
      throw new Error('Response parsing failed');
    }
  }
} 