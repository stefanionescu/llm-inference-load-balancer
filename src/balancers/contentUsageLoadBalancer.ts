import { RedisClientType } from "redis";
import { 
  Env, 
  ContentUsageLLMProvider,
  ContentUsageProviderRequestParams,
  ProviderProfile
} from "../types.js";
import { BaseLoadBalancer, EnhancedProviderConfig, SelectedProvider } from "../shared/base-load-balancer.js";

// Import content usage providers
import { OpenAIProvider } from "../providers/content-usage-providers/openai.js";
import { AnthropicProvider } from "../providers/content-usage-providers/anthropic.js";

export interface ContentUsageLoadBalancerParams {
  prompt: string | object;
  systemPrompt: string;
  maxTokens: number;
  env: Env;
  stream: boolean;
  signal?: AbortSignal;
}

export class LoadBalancer extends BaseLoadBalancer<ContentUsageLLMProvider, ContentUsageLoadBalancerParams> {

  constructor(env: Env, redis: RedisClientType) {
    const providerConfigs = {
      openai: env.OPENAI_CONFIGS,
      anthropic: env.ANTHROPIC_CONFIGS
    };

    super(env, redis, providerConfigs);
  }

  protected getLoadBalancerName(): string {
    return 'Content Usage LoadBalancer';
  }

  protected getRedisScriptName(): string {
    return 'simple-provider-selection';
  }

  protected parseProviderConfigs(configs: Record<string, string | undefined>): Record<string, EnhancedProviderConfig[]> {
    const configMap: Record<string, EnhancedProviderConfig[]> = {};
    
    Object.entries(configs).forEach(([key, configStr]) => {
      configMap[key] = this.parseConfig(configStr, key);
    });

    console.log('Provider Configs:', {
      openAI: { count: configMap.openai?.length || 0, quotas: configMap.openai?.map(c => c.maxRequestsPerMinute) || [] },
      anthropic: { count: configMap.anthropic?.length || 0, quotas: configMap.anthropic?.map(c => c.maxRequestsPerMinute) || [] }
    });

    return configMap;
  }

  protected initializeProviders(configMap: Record<string, EnhancedProviderConfig[]>): Map<string, ContentUsageLLMProvider> {
    const providerEntries = Object.entries(configMap)
      .filter(([_, configs]) => configs.length > 0)
      .map(([name, configs]): [string, ContentUsageLLMProvider] => {
        const profiles = this.createProfiles(name, configs);
        
        switch(name) {
          case 'openai': return ['openai', new OpenAIProvider(profiles)];
          case 'anthropic': return ['anthropic', new AnthropicProvider(profiles)];
          default: throw new Error(`Unknown provider: ${name}`);
        }
      });

    return new Map(providerEntries);
  }

  protected getProviderProfiles(): Record<string, any[]> {
    return {
      openai: this.providers.get('openai')?.getProfiles().map(p => p.quota.maxRequestsPerMinute) || [],
      anthropic: this.providers.get('anthropic')?.getProfiles().map(p => p.quota.maxRequestsPerMinute) || []
    };
  }

  protected getProviderForProfiles(provider: ContentUsageLLMProvider): ProviderProfile[] {
    return provider.getProfiles();
  }

  protected async executeProviderRequest(
    selected: SelectedProvider<ContentUsageLLMProvider>,
    params: ContentUsageLoadBalancerParams,
    requestTimestamp: number
  ): Promise<Response> {
    const requestId = crypto.randomUUID();
    console.log(`Starting request ${requestId} to ${selected.provider.name}`);

    const providerParams: ContentUsageProviderRequestParams = {
      prompt: params.prompt,
      systemPrompt: params.systemPrompt,
      maxTokens: params.maxTokens,
      env: params.env,
      profileId: selected.profileId,
      stream: params.stream,
      apiKey: selected.apiKey,
      signal: params.signal
    };

    if (params.signal?.aborted) {
      console.log('Request aborted before provider selection');
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

    const response = params.stream ? 
      await selected.provider.streamResponse(providerParams) :
      await selected.provider.regularResponse(providerParams);

    if (!response.ok) {
      console.error(`Provider ${selected.provider.name} returned status ${response.status}`);
      return new Response(
        JSON.stringify({
          error: `Provider error: ${response.status}`,
          timestamp: new Date().toISOString()
        }),
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create a wrapper response that marks the request complete when it finishes
    const originalBody = response.body;
    
    if (params.stream && originalBody) {
      // Store reference to markRequestComplete method and selected profile
      const markComplete = this.markRequestComplete.bind(this);
      const profileId = selected.profileId;
      
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
        flush: async function() {
          try {
            await markComplete(profileId, requestTimestamp);
          } catch (error) {
            console.error('Error marking request complete:', error);
          }
        }
      });

      // Add abort signal handler for cleanup
      params.signal?.addEventListener('abort', async () => {
        console.log(`Request ${requestId} aborted, cleaning up...`);
        try {
          await markComplete(profileId, requestTimestamp);
        } catch (error) {
          console.error('Error cleaning up aborted request:', error);
        }
      });

      return new Response(originalBody.pipeThrough(transformStream), {
        headers: response.headers,
        status: response.status
      });
    } else {
      // For non-streaming responses, mark complete immediately
      try {
        await this.markRequestComplete(selected.profileId, requestTimestamp);
      } catch (error) {
        console.error('Error marking request complete:', error);
      }
      return response;
    }
  }
}