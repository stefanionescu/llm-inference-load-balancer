import { RedisClientType } from 'redis';
import { 
  Env,
  RoleplayLLMProvider,
  RoleplayProviderRequestParams,
  RoleplayMessage,
  ProviderProfile
} from "../types.js";
import { BaseLoadBalancer, EnhancedProviderConfig, SelectedProvider } from "../shared/base-load-balancer.js";

// Import all roleplay providers
import { GroqProvider } from "../providers/roleplay-providers/groq.js";
import { TogetherProvider } from "../providers/roleplay-providers/together.js";
import { FireworksProvider } from "../providers/roleplay-providers/fireworks.js";
import { ReplicateProvider } from "../providers/roleplay-providers/replicate.js";
import { HyperbolicProvider } from "../providers/roleplay-providers/hyperbolic.js";
import { DeepInfraProvider } from "../providers/roleplay-providers/deepinfra.js";
import { OpenRouterProvider } from "../providers/roleplay-providers/openrouter.js";
import { AwanLLMProvider } from "../providers/roleplay-providers/awanllm.js";
import { KlusterAIProvider } from "../providers/roleplay-providers/klusterai.js";
import { AvianIOProvider } from "../providers/roleplay-providers/avianio.js";
import { LambdaLabsProvider } from "../providers/roleplay-providers/lambdalabs.js";
import { NovitaProvider } from "../providers/roleplay-providers/novita.js";
import { InferenceNetProvider } from "../providers/roleplay-providers/inferencenet.js";

export interface RoleplayLoadBalancerParams {
  messages: RoleplayMessage[];
  systemPrompt: string;
  maxTokens: number;
  env: Env;
  stream: boolean;
  signal?: AbortSignal;
}

export class LoadBalancer extends BaseLoadBalancer<RoleplayLLMProvider, RoleplayLoadBalancerParams> {
  
  constructor(env: Env, redis: RedisClientType) {
    const providerConfigs = {
      groq: env.GROQ_CONFIGS,
      together: env.TOGETHER_CONFIGS,
      fireworks: env.FIREWORKS_CONFIGS,
      replicate: env.REPLICATE_CONFIGS,
      klusterai: env.KLUSTER_AI_CONFIGS,
      hyperbolic: env.HYPERBOLIC_CONFIGS,
      deepinfra: env.DEEPINFRA_CONFIGS,
      openrouter: env.OPENROUTER_CONFIGS,
      awan: env.AWAN_CONFIGS,
      avianio: env.AVIAN_IO_CONFIGS,
      lambdalabs: env.LAMBDA_LABS_CONFIGS,
      novita: env.NOVITA_AI_CONFIGS,
      inference_net: env.INFERENCE_NET_CONFIGS,
    };

    super(env, redis, providerConfigs);
  }

  protected getLoadBalancerName(): string {
    return 'Roleplay LoadBalancer';
  }

  protected getRedisScriptName(): string {
    return 'provider-selection';
  }

  protected parseProviderConfigs(configs: Record<string, string | undefined>): Record<string, EnhancedProviderConfig[]> {
    const configMap: Record<string, EnhancedProviderConfig[]> = {};
    
    Object.entries(configs).forEach(([key, configStr]) => {
      configMap[key] = this.parseConfig(configStr, key);
    });

    console.log('Provider Configs:', Object.entries(configMap).reduce((acc, [key, configs]) => ({
      ...acc,
      [key]: { 
        count: configs.length, 
        quotas: configs.map((c: EnhancedProviderConfig) => ({
          rpm: c.maxRequestsPerMinute,
          concurrent: c.maxConcurrentRequests
        }))
      }
    }), {}));

    return configMap;
  }

  protected initializeProviders(configMap: Record<string, EnhancedProviderConfig[]>): Map<string, RoleplayLLMProvider> {
    const providerEntries = Object.entries(configMap)
      .filter(([_, configs]) => configs.length > 0)
      .map(([name, configs]): [string, RoleplayLLMProvider] => {
        const profiles = this.createProfiles(name, configs);
        
        switch(name) {
          case 'groq': return ['groq', new GroqProvider(profiles)];
          case 'together': return ['together', new TogetherProvider(profiles)];
          case 'fireworks': return ['fireworks', new FireworksProvider(profiles)];
          case 'replicate': return ['replicate', new ReplicateProvider(profiles)];
          case 'hyperbolic': return ['hyperbolic', new HyperbolicProvider(profiles)];
          case 'deepinfra': return ['deepinfra', new DeepInfraProvider(profiles)];
          case 'openrouter': return ['openrouter', new OpenRouterProvider(profiles)];
          case 'awan': return ['awan', new AwanLLMProvider(profiles)];
          case 'klusterai': return ['klusterai', new KlusterAIProvider(profiles)];
          case 'avianio': return ['avianio', new AvianIOProvider(profiles)];
          case 'lambdalabs': return ['lambdalabs', new LambdaLabsProvider(profiles)];
          case 'novita': return ['novita', new NovitaProvider(profiles)];
          case 'inference_net': return ['inference_net', new InferenceNetProvider(profiles)];
          default: throw new Error(`Unknown provider: ${name}`);
        }
      });

    return new Map(providerEntries);
  }

  protected getProviderProfiles(): Record<string, any[]> {
    return Object.fromEntries(
      Array.from(this.providers.entries()).map(([name, provider]) => [
        name,
        provider.getProfiles().map(p => ({
          quota: p.quota.maxRequestsPerMinute,
          maxConcurrent: p.quota.maxConcurrentRequests,
          maxRequestsPerSecond: p.quota.maxRequestsPerSecond
        }))
      ])
    );
  }

  protected getProviderForProfiles(provider: RoleplayLLMProvider): ProviderProfile[] {
    return provider.getProfiles();
  }

  protected async executeProviderRequest(
    selected: SelectedProvider<RoleplayLLMProvider>,
    params: RoleplayLoadBalancerParams,
    requestTimestamp: number
  ): Promise<Response> {
    const requestId = crypto.randomUUID();
    console.log(`Starting request ${requestId} to ${selected.provider.name}`);
    
    const providerParams: RoleplayProviderRequestParams = {
      messages: params.messages,
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

    // Add abort signal handler for cleanup
    params.signal?.addEventListener('abort', async () => {
      console.log(`Request ${requestId} aborted, cleaning up...`);
      try {
        await this.markRequestComplete(selected.profileId, requestTimestamp);
      } catch (error) {
        console.error('Error cleaning up aborted request:', error);
      }
    });

    const response = params.stream ? 
      await selected.provider.streamResponse(providerParams) :
      await selected.provider.regularResponse(providerParams);

    if (!response.ok) {
      console.error(`Provider ${selected.provider.name} returned status ${response.status}`);
      return new Response(
        JSON.stringify({
          error: `Provider error: ${response.status}`,
          timestamp: new Date().toISOString()
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (params.stream && response.body) {
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
        flush: async () => {
          await this.markRequestComplete(selected.profileId, requestTimestamp);
        }
      });

      return new Response(response.body.pipeThrough(transformStream), {
        headers: response.headers,
        status: response.status
      });
    }
    
    await this.markRequestComplete(selected.profileId, requestTimestamp);
    return response;
  }
}