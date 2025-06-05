import { ContentUsageProviderRequestParams } from "../../types.js";
import { EnhancedBaseProvider } from "../../shared/enhanced-base-provider.js";
import { CONTENT_USAGE_MODELS } from "../../config/models/content-usage-models.js";
import { CONTENT_USAGE_PROVIDER_URLS } from "../../config/provider-urls.js";
import { CONTENT_USAGE_TIMEOUT_MS } from "../../config.js";

export class AnthropicProvider extends EnhancedBaseProvider<ContentUsageProviderRequestParams> {
  name = 'anthropic';
  protected baseURL = CONTENT_USAGE_PROVIDER_URLS.anthropic;
  protected timeoutMs = CONTENT_USAGE_TIMEOUT_MS;

  protected getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  protected formatRequestBody(params: ContentUsageProviderRequestParams): object {
    const { prompt, systemPrompt, maxTokens, stream } = params;
    return {
      model: CONTENT_USAGE_MODELS.anthropic,
      system: systemPrompt,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{
        role: 'user',
        content: typeof prompt === 'object' ? JSON.stringify(prompt) : prompt
      }],
      stream
    };
  }

  protected parseRegularResponse(responseText: string): any {
    try {
      const response = JSON.parse(responseText);
      
      // Extract only content from Anthropic response, no metadata
      if (response.content && response.content[0] && response.content[0].text) {
        return {
          content: response.content[0].text
        };
      }
      
      throw new Error('Invalid Anthropic response format');
    } catch (error) {
      throw new Error('Response parsing failed');
    }
  }
}