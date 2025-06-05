import { ContentUsageProviderRequestParams } from "../../types.js";
import { EnhancedBaseProvider } from "../../shared/enhanced-base-provider.js";
import { CONTENT_USAGE_MODELS } from "../../config/models/content-usage-models.js";
import { CONTENT_USAGE_PROVIDER_URLS } from "../../config/provider-urls.js";
import { CONTENT_USAGE_TIMEOUT_MS } from "../../config.js";

export class OpenAIProvider extends EnhancedBaseProvider<ContentUsageProviderRequestParams> {
  name = 'openai';
  protected baseURL = CONTENT_USAGE_PROVIDER_URLS.openai;
  protected timeoutMs = CONTENT_USAGE_TIMEOUT_MS;

  protected getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  protected formatRequestBody(params: ContentUsageProviderRequestParams): object {
    const { prompt, systemPrompt, maxTokens, stream } = params;
    return {
      model: CONTENT_USAGE_MODELS.openai,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: typeof prompt === 'object' ? JSON.stringify(prompt) : prompt
        }
      ],
      stream,
      max_tokens: maxTokens,
      temperature: 0.1,
      response_format: { type: "text" }
    };
  }
}