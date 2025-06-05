export const CONTENT_USAGE_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307'
} as const;

export type ContentUsageProviderName = keyof typeof CONTENT_USAGE_MODELS; 