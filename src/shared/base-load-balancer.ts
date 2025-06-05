import { RedisClientType } from 'redis';
import { Env, ProviderProfile, EnvProviderConfig } from '../types.js';
import { executeProviderSelection, markRequestComplete } from './utils/redis-utils.js';
import { standardizeErrorResponse } from './utils/provider-utils.js';

export interface EnhancedProviderConfig extends EnvProviderConfig {
  maxConcurrentRequests?: number;
  maxRequestsPerSecond?: number;
}

export interface SelectedProvider<T> {
  provider: T;
  profileId: string;
  apiKey: string;
}

export abstract class BaseLoadBalancer<TProvider, TParams> {
  protected providers: Map<string, TProvider>;

  constructor(
    protected env: Env,
    protected redis: RedisClientType,
    providerConfigs: Record<string, string | undefined>
  ) {
    console.log(`Initializing ${this.getLoadBalancerName()}`);
    
    const configMap = this.parseProviderConfigs(providerConfigs);
    this.providers = this.initializeProviders(configMap);
  }

  protected abstract getLoadBalancerName(): string;
  protected abstract parseProviderConfigs(configs: Record<string, string | undefined>): Record<string, EnhancedProviderConfig[]>;
  protected abstract initializeProviders(configMap: Record<string, EnhancedProviderConfig[]>): Map<string, TProvider>;
  protected abstract getRedisScriptName(): string;
  protected abstract getProviderProfiles(): Record<string, any[]>;
  protected abstract executeProviderRequest(
    selected: SelectedProvider<TProvider>,
    params: TParams,
    requestTimestamp: number
  ): Promise<Response>;

  protected parseConfig(configStr: string | undefined, providerName: string): EnhancedProviderConfig[] {
    if (!configStr) {
      console.log(`No config provided for ${providerName}`);
      return [];
    }
    
    try {
      const parsed = JSON.parse(configStr);
      if (!Array.isArray(parsed)) {
        console.error(`Invalid config format for ${providerName}: expected array`);
        return [];
      }
      return parsed;
    } catch (error) {
      console.error(`Invalid JSON for ${providerName} config:`, error);
      return [];
    }
  }

  protected createProfiles(name: string, configs: EnhancedProviderConfig[]): ProviderProfile[] {
    return configs.map((config, idx) => ({
      id: `${name}-${idx}`,
      apiKey: config.apiKey,
      quota: { 
        maxRequestsPerMinute: config.maxRequestsPerMinute,
        maxConcurrentRequests: config.maxConcurrentRequests,
        maxRequestsPerSecond: config.maxRequestsPerSecond
      }
    }));
  }

  protected async selectProviderProfile(): Promise<SelectedProvider<TProvider> | null> {
    try {
      const profilesData = this.getProviderProfiles();
      const result = await executeProviderSelection(
        this.redis,
        profilesData,
        this.getRedisScriptName()
      );

      if (!result || !Array.isArray(result)) {
        console.log('No available providers found');
        return null;
      }

      const [providerName, profileIdx, requestCount, quota, pendingCount, rps, currentRps] = result as [string, number, number, number, number, number | undefined, number | undefined];
      const provider = this.providers.get(providerName);
      
      if (!provider) {
        console.error(`Provider ${providerName} not found`);
        return null;
      }

      const providerProfiles = this.getProviderForProfiles(provider);
      const profile = providerProfiles[profileIdx];
      if (!profile) {
        console.error(`Profile ${profileIdx} not found for provider ${providerName}`);
        return null;
      }

      console.log(
        `Provider Selected: ${providerName} | ` + 
        `Quota: ${quota}/min${rps ? ` | ${currentRps}/${rps}/sec` : ''} | ` + 
        `Current Usage: ${requestCount} calls | ` +
        (pendingCount !== undefined ? `Pending Requests: ${pendingCount} | ` : '') +
        `Usage %: ${(requestCount / quota * 100).toFixed(2)}%`
      );

      return {
        provider,
        profileId: `${providerName}-${profileIdx}`,
        apiKey: profile.apiKey
      };

    } catch (error) {
      console.error('Provider selection failed:', error);
      throw error;
    }
  }

  protected abstract getProviderForProfiles(provider: TProvider): ProviderProfile[];

  protected async markRequestComplete(profileId: string, requestTimestamp: number): Promise<void> {
    const withPending = this.getRedisScriptName() === 'provider-selection';
    await markRequestComplete(this.redis, profileId, requestTimestamp, withPending);
  }

  async getResponse(params: TParams): Promise<Response> {
    try {
      const selected = await Promise.race([
        this.selectProviderProfile(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Provider selection timeout')), 5000))
      ]);
      
      if (!selected) {
        return new Response(
          JSON.stringify({
            error: 'All providers are at capacity or selection timed out',
            timestamp: new Date().toISOString()
          }), { 
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const requestTimestamp = Date.now();
      return await this.executeProviderRequest(selected, params, requestTimestamp);

    } catch (error) {
      console.error(`Error in ${this.getLoadBalancerName()} getResponse:`, error);
      return standardizeErrorResponse(error);
    }
  }
} 