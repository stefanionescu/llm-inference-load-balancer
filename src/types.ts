import { RedisClientType } from "redis";

export interface Env {
  API_TOKEN: string;
  OPENAI_CONFIGS: string; 
  ANTHROPIC_CONFIGS: string | undefined;
  GROQ_CONFIGS: string | undefined;
  TOGETHER_CONFIGS: string | undefined; 
  FIREWORKS_CONFIGS: string | undefined;
  REPLICATE_CONFIGS: string | undefined; 
  HYPERBOLIC_CONFIGS: string | undefined; 
  KLUSTER_AI_CONFIGS: string | undefined;
  DEEPINFRA_CONFIGS: string | undefined; 
  AVIAN_IO_CONFIGS: string | undefined;
  OPENROUTER_CONFIGS: string | undefined;
  AWAN_CONFIGS: string | undefined;
  LAMBDA_LABS_CONFIGS: string | undefined;
  CLARIFAI_CONFIGS: string | undefined;
  NOVITA_AI_CONFIGS: string | undefined;
  INFERENCE_NET_CONFIGS: string | undefined;
  REDIS_REST_PORT: string;
  REDIS_REST_URL: string;
  REDIS_PASSWORD: string;
  redis?: RedisClientType;
}

export interface BaseProviderRequestParams {
  env: Env;
  profileId: string;
  apiKey: string;
  stream: boolean;
  signal?: AbortSignal;
}

export interface ContentUsageProviderRequestParams extends BaseProviderRequestParams {
  prompt: string | object;
  systemPrompt: string;
  maxTokens: number;
}

export interface RoleplayProviderRequestParams extends BaseProviderRequestParams {
  messages: RoleplayMessage[];
  systemPrompt: string;
  maxTokens: number;
}

export interface ProviderProfile {
  id: string;
  apiKey: string;
  quota: {
    maxRequestsPerMinute: number;
    maxConcurrentRequests?: number;
    maxRequestsPerSecond?: number;
  };
}

export interface ContentUsageLLMProvider {
  name: string;
  getProfiles(): ProviderProfile[];
  streamResponse(params: ContentUsageProviderRequestParams): Promise<Response>;
  regularResponse(params: ContentUsageProviderRequestParams): Promise<Response>;
}

export interface RoleplayLLMProvider {
  name: string;
  getProfiles(): ProviderProfile[];
  streamResponse(params: RoleplayProviderRequestParams): Promise<Response>;
  regularResponse(params: RoleplayProviderRequestParams): Promise<Response>;
}

export interface EnvProviderConfig {
  apiKey: string;
  maxRequestsPerMinute: number;
  maxConcurrentRequests?: number;
}

export interface EndpointHandler {
  (request: Request, env: Env): Promise<Response>;
}

export interface RequestBody {
  prompt: string;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface ProviderState {
  currentRequests: number;
  lastResetTimestamp: number;
  profileStates: Record<string, {
    currentRequests: number;
    pendingRequests: number;
    lastUpdateTimestamp: number;
  }>;
}

export interface AnthropicContent {
  text: string;
  type: 'text';
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContent[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicTransformedResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    index: number;
    finish_reason: string;
  }>;
  id: string;
  model: string;
  created: number;
}

export interface RoleplayMessageContent {
  type: 'text';
  text: string;
}

export interface RoleplayMessage {
  role: 'user' | 'assistant';
  content: RoleplayMessageContent[];
}

export interface RoleplayRequestBody {
  messages: RoleplayMessage[];
  maxTokens?: number;
  stream?: boolean;
  systemPrompt: string;
}

export interface FireworksMessage {
  role: string;
  content: string;
}

export interface FireworksChoice {
  index: number;
  message: FireworksMessage;
  finish_reason: string;
}

export interface FireworksResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: FireworksChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface TogetherMessage {
  role: string;
  content: string;
}

export interface TogetherChoice {
  index: number;
  message: TogetherMessage;
  finish_reason: string;
}

export interface TogetherResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: TogetherChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ReplicateResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GroqChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  logprobs: null;
  finish_reason: string;
}

export interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GroqChoice[];
  usage: {
    queue_time: number;
    prompt_tokens: number;
    prompt_time: number;
    completion_tokens: number;
    completion_time: number;
    total_tokens: number;
    total_time: number;
  };
  system_fingerprint: string;
}

export interface HyperbolicMessage {
  role: string;
  content: string;
}

export interface HyperbolicChoice {
  index: number;
  message?: HyperbolicMessage;
  delta?: Partial<HyperbolicMessage>;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

export interface HyperbolicUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface HyperbolicResponse {
  id: string;
  object: "chat.completion" | "chat.completion.chunk";
  created: number;
  model: string;
  choices: HyperbolicChoice[];
  usage?: HyperbolicUsage;
}

export interface DeepInfraResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: "stop" | "length";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMAPIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface NovitaResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message?: {
      role: string;
      content: string;
    };
    delta?: {
      content?: string;
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface InferenceNetResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message?: {
      role: string;
      content: string;
    };
    delta?: {
      content?: string;
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}