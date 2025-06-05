import { RoleplayProviderRequestParams } from "../../types.js";
import { EnhancedBaseProvider } from "../../shared/enhanced-base-provider.js";
import { ROLEPLAY_MODELS } from "../../config/models/roleplay-models.js";
import { ROLEPLAY_PROVIDER_URLS } from "../../config/provider-urls.js";
import { ROLEPLAY_TIMEOUT_MS } from "../../config.js";
import {
  ROLEPLAY_TOP_P,
  ROLEPLAY_TEMPERATURE,
  ROLEPLAY_TOP_K,
  ROLEPLAY_PRESENCE_PENALTY,
  ROLEPLAY_FREQUENCY_PENALTY,
  ROLEPLAY_STOP_SEQUENCES,
  ROLEPLAY_PROMPT_TRUNCATE_LENGTH
} from "../../config.js";

export class FireworksProvider extends EnhancedBaseProvider<RoleplayProviderRequestParams> {
  name = 'fireworks';
  protected baseURL = ROLEPLAY_PROVIDER_URLS.fireworks;
  protected timeoutMs = ROLEPLAY_TIMEOUT_MS;

  protected getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
      model: ROLEPLAY_MODELS.fireworks,
      messages: formattedMessages,
      max_tokens: maxTokens,
      temperature: ROLEPLAY_TEMPERATURE,
      top_p: ROLEPLAY_TOP_P,
      top_k: ROLEPLAY_TOP_K,
      presence_penalty: ROLEPLAY_PRESENCE_PENALTY,
      frequency_penalty: ROLEPLAY_FREQUENCY_PENALTY,
      stream,
      stop: ROLEPLAY_STOP_SEQUENCES,
      n: 1,
      prompt_truncate_len: ROLEPLAY_PROMPT_TRUNCATE_LENGTH
    };
  }
}