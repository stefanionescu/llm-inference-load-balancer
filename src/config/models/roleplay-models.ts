export const ROLEPLAY_MODELS = {
  groq: 'llama-3.3-70b-versatile',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  fireworks: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
  replicate: 'meta/meta-llama-3.3-70b-instruct',
  hyperbolic: 'meta-llama/Meta-Llama-3.3-70B-Instruct',
  deepinfra: 'meta-llama/Llama-3.3-70B-Instruct',
  openrouter: 'meta-llama/llama-3.3-70b-instruct',
  awanllm: 'Meta-Llama-3.3-70B-Instruct',
  klusterai: 'klusterai/Meta-Llama-3.3-70B-Instruct-Turbo',
  avianio: 'meta-llama/Meta-Llama-3.3-70B-Instruct',
  lambdalabs: 'meta-llama/Meta-Llama-3.3-70B-Instruct',
  novita: 'meta-llama/llama-3.3-70b-instruct',
  inferencenet: 'meta-llama/llama-3.3-70b-instruct/fp-16'
} as const;

export type RoleplayProviderName = keyof typeof ROLEPLAY_MODELS; 