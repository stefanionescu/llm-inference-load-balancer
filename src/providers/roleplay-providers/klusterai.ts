import { RoleplayProviderRequestParams } from "../../types.js";
import { EnhancedBaseProvider } from "../../shared/enhanced-base-provider.js";
import { ROLEPLAY_MODELS } from "../../config/models/roleplay-models.js";
import { ROLEPLAY_PROVIDER_URLS } from "../../config/provider-urls.js";
import { ROLEPLAY_TIMEOUT_MS } from "../../config.js";
import {
  ROLEPLAY_TOP_P,
  ROLEPLAY_TEMPERATURE,
  ROLEPLAY_PRESENCE_PENALTY,
  ROLEPLAY_FREQUENCY_PENALTY,
  ROLEPLAY_STOP_SEQUENCES
} from "../../config.js";

export class KlusterAIProvider extends EnhancedBaseProvider<RoleplayProviderRequestParams> {
  name = 'klusterai';
  protected baseURL = ROLEPLAY_PROVIDER_URLS.klusterai;
  protected timeoutMs = ROLEPLAY_TIMEOUT_MS;

  protected getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
  }

  protected formatRequestBody(params: RoleplayProviderRequestParams): object {
    const { messages, systemPrompt, maxTokens, stream } = params;
    
    const formattedMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content[0].text
      }))
    ];

    return {
      model: ROLEPLAY_MODELS.klusterai,
      messages: formattedMessages,
      max_completion_tokens: maxTokens,
      temperature: ROLEPLAY_TEMPERATURE,
      top_p: ROLEPLAY_TOP_P,
      presence_penalty: ROLEPLAY_PRESENCE_PENALTY,
      frequency_penalty: ROLEPLAY_FREQUENCY_PENALTY,
      stop: ROLEPLAY_STOP_SEQUENCES,
      stream
    };
  }

  protected parseRegularResponse(responseText: string): any {
    const data = JSON.parse(responseText);
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in KlusterAI response');
    }

    return { content };
  }
} 