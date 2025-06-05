export const ROLEPLAY_PROVIDER_URLS = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  together: 'https://api.together.xyz/v1/chat/completions',
  fireworks: 'https://api.fireworks.ai/inference/v1/chat/completions',
  replicate: 'https://api.replicate.com/v1/models/meta/meta-llama-3.3-70b-instruct/predictions',
  hyperbolic: 'https://api.hyperbolic.xyz/v1/chat/completions',
  deepinfra: 'https://api.deepinfra.com/v1/openai/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  awanllm: 'https://api.awanllm.com/v1/chat/completions',
  klusterai: 'https://api.kluster.ai/v1/chat/completions',
  avianio: 'https://api.avian.io/v1/chat/completions',
  lambdalabs: 'https://api.lambdalabs.com/v1/chat/completions',
  novita: 'https://api.novita.ai/v3/openai/chat/completions',
  inferencenet: 'https://api.inference.net/v1/chat/completions'
} as const;

export const CONTENT_USAGE_PROVIDER_URLS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages'
} as const; 