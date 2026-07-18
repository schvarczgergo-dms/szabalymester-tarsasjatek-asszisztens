import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { Config } from './config';

/**
 * Provider-réteg (ports & adapters). A modellhívások egységes portja a Vercel AI SDK; az
 * OpenAI- és Anthropic-adapter base-URL-je env-ből felülírható, így a fizetős felhő helyett
 * helyi Ollama (OpenAI-kompatibilis) ill. LiteLLM proxy (Anthropic-kompatibilis) is használható,
 * a kód érintése nélkül (ld. docs/local-mode.md). [AD-6, AD-7]
 */
export interface ProviderOptions {
  apiKey: string;
  baseURL?: string;
}

/** Az OpenAI-adapter beállításai (embedding + HyDE); base-URL kitöltve → helyi Ollama `/v1`. */
export function openAIOptions(config: Config): ProviderOptions {
  return {
    apiKey: config.openaiApiKey,
    ...(config.openaiBaseUrl !== undefined ? { baseURL: config.openaiBaseUrl } : {}),
  };
}

/** Az Anthropic-adapter beállításai (rerank + válasz); base-URL kitöltve → LiteLLM `/v1`. */
export function anthropicOptions(config: Config): ProviderOptions {
  return {
    apiKey: config.anthropicApiKey,
    ...(config.anthropicBaseUrl !== undefined ? { baseURL: config.anthropicBaseUrl } : {}),
  };
}

/** A konfigurált OpenAI + Anthropic provider-példányok (base-URL override-dal, ha van). */
export function createProviders(config: Config): {
  openai: ReturnType<typeof createOpenAI>;
  anthropic: ReturnType<typeof createAnthropic>;
} {
  return {
    openai: createOpenAI(openAIOptions(config)),
    anthropic: createAnthropic(anthropicOptions(config)),
  };
}
