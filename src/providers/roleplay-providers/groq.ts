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

export class GroqProvider extends EnhancedBaseProvider<RoleplayProviderRequestParams> {
  name = 'groq';
  protected baseURL = ROLEPLAY_PROVIDER_URLS.groq;
  protected timeoutMs = ROLEPLAY_TIMEOUT_MS;

  protected getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  protected formatRequestBody(params: RoleplayProviderRequestParams): object {
    const { messages, systemPrompt, maxTokens, stream } = params;
    const stopSequences = ROLEPLAY_STOP_SEQUENCES.slice(0, 4);
    
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
      model: ROLEPLAY_MODELS.groq,
      messages: formattedMessages,
      max_tokens: maxTokens,
      temperature: ROLEPLAY_TEMPERATURE,
      top_p: ROLEPLAY_TOP_P,
      presence_penalty: ROLEPLAY_PRESENCE_PENALTY,
      frequency_penalty: ROLEPLAY_FREQUENCY_PENALTY,
      stop: stopSequences,
      stream
    };
  }

}