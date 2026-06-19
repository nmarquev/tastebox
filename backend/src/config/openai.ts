// Ensure env vars are loaded before reading them
import './env';
import OpenAI from 'openai';

// Provider base URL. Leave empty for OpenAI; set to https://openrouter.ai/api/v1 for OpenRouter.
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || undefined;

// Default text model. On OpenRouter use the provider-prefixed id (e.g. "openai/gpt-4o-mini").
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Vision-capable model used for multimodal (PDF page images) requests.
// Falls back to OPENAI_MODEL so a single var is enough when the main model already supports vision.
export const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || OPENAI_MODEL;

// Creates an OpenAI SDK client pointed at the configured provider.
// Works transparently with OpenRouter (OpenAI-compatible API) when OPENAI_BASE_URL is set.
export function createOpenAIClient(
  options: ConstructorParameters<typeof OpenAI>[0] = {}
): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Variable de entorno OPENAI_API_KEY es requerida');
  }

  return new OpenAI({
    apiKey,
    ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
    ...options,
  });
}
