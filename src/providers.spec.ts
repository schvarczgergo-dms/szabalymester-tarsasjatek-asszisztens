import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { anthropicOptions, openAIOptions } from './providers';

const baseEnv = {
  OPENAI_API_KEY: 'sk-openai',
  ANTHROPIC_API_KEY: 'sk-ant',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
} satisfies NodeJS.ProcessEnv;

describe('provider base-URL override', () => {
  it('base-URL nélkül csak az apiKey megy (igazi felhő)', () => {
    const config = loadConfig(baseEnv);
    expect(openAIOptions(config)).toEqual({ apiKey: 'sk-openai' });
    expect(anthropicOptions(config)).toEqual({ apiKey: 'sk-ant' });
  });

  it('base-URL kitöltve → a helyi Ollama / LiteLLM végpontra mutat', () => {
    const config = loadConfig({
      ...baseEnv,
      OPENAI_BASE_URL: 'http://localhost:11434/v1',
      ANTHROPIC_BASE_URL: 'http://localhost:4000/v1',
    });
    expect(openAIOptions(config)).toEqual({
      apiKey: 'sk-openai',
      baseURL: 'http://localhost:11434/v1',
    });
    expect(anthropicOptions(config)).toEqual({
      apiKey: 'sk-ant',
      baseURL: 'http://localhost:4000/v1',
    });
  });

  it('üres/whitespace base-URL → nincs override (a defaultra esik)', () => {
    const config = loadConfig({ ...baseEnv, OPENAI_BASE_URL: '   ', ANTHROPIC_BASE_URL: '' });
    expect(openAIOptions(config).baseURL).toBeUndefined();
    expect(anthropicOptions(config).baseURL).toBeUndefined();
  });
});
