export const CONTENT_USAGE_CHECK_PROMPT = `You check if a piece of text has references, ideas, very specific words/meanings from other pieces of text. Your output MUST be formatted as {"references": ["boolean1", "boolean2", "boolean3", ...]} where each boolean is true if the text we verify has a reference or meaning/words taken from one of the other texts mentioned by the user. The user will provide the input data in this format: {"text_to_verify": "text", "texts_to_verify_against": ["text1", "text2", "text3", ...]}. An example of an output: {"references": [true, false, true]}. Another example of a valid output: {"references": [false, false]}.`;
export const CONTENT_USAGE_TIMEOUT_MS = 10000;

export const ROLEPLAY_TIMEOUT_MS = 60000;
export const ROLEPLAY_PROMPT_TRUNCATE_LENGTH = 10000;
export const ROLEPLAY_TOP_P = 1;
export const ROLEPLAY_TEMPERATURE = 0.7;
export const ROLEPLAY_TOP_K = 40;
export const ROLEPLAY_PRESENCE_PENALTY = 0.5;
export const ROLEPLAY_FREQUENCY_PENALTY = 0.5;
export const ROLEPLAY_STOP_SEQUENCES = ["<|eot_id|>", "Human:", "Assistant:"];
export const ROLEPLAY_MIN_TOKENS = 100;
export const ROLEPLAY_LENGTH_PENALTY = 1;
export const ROLEPLAY_REPETITION_PENALTY = 1;

// Rate limiting configuration
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute
export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60; // Retry after 60 seconds

// Server configuration
export const REDIS_HEALTH_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
export const SERVER_SHUTDOWN_TIMEOUT_MS = 10 * 1000; // 10 seconds