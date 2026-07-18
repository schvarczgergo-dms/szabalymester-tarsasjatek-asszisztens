import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

/** Minimális, érvényes env — csak a kötelező titkok. */
const validEnv = {
  OPENAI_API_KEY: 'sk-teszt',
  ANTHROPIC_API_KEY: 'sk-ant-teszt',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
} satisfies NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('a kötelező titkokat beolvassa', () => {
    const config = loadConfig(validEnv);
    expect(config.openaiApiKey).toBe('sk-teszt');
    expect(config.anthropicApiKey).toBe('sk-ant-teszt');
    expect(config.databaseUrl).toBe('postgresql://user:pass@localhost:5432/db');
  });

  it('az elhagyott opcionális mezőkre a spine alapértelmezéseit adja', () => {
    const config = loadConfig(validEnv);
    expect(config.embeddingModel).toBe('text-embedding-3-small');
    expect(config.embeddingDimensions).toBe(1536);
    expect(config.hydeModel).toBe('gpt-5.4-nano');
    expect(config.rerankModel).toBe('claude-haiku-4-5');
    expect(config.answerModel).toBe('claude-sonnet-5');
    expect(config.wideNet).toBe(20);
    expect(config.keepTop).toBe(5);
  });

  it('a modellneveket env-ből felülírja', () => {
    const config = loadConfig({ ...validEnv, ANSWER_MODEL: 'claude-opus-4-8' });
    expect(config.answerModel).toBe('claude-opus-4-8');
  });

  it('a numerikus paramétereket stringből számmá konvertálja', () => {
    const config = loadConfig({ ...validEnv, WIDE_NET: '30', KEEP_TOP: '7' });
    expect(config.wideNet).toBe(30);
    expect(config.keepTop).toBe(7);
  });

  it('hiányzó kötelező titokra ConfigError-t dob, a változó nevével', () => {
    const { OPENAI_API_KEY: _omitted, ...withoutKey } = validEnv;
    expect(() => loadConfig(withoutKey)).toThrowError(ConfigError);
    expect(() => loadConfig(withoutKey)).toThrowError(/OPENAI_API_KEY/);
  });

  it('üres kötelező titokra is fail-fast', () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: '' })).toThrowError(ConfigError);
  });

  it('érvénytelen numerikus értékre ConfigError-t dob', () => {
    expect(() => loadConfig({ ...validEnv, WIDE_NET: 'nem-szam' })).toThrowError(ConfigError);
  });

  it('nem pozitív pipeline-paramétert elutasít', () => {
    expect(() => loadConfig({ ...validEnv, KEEP_TOP: '0' })).toThrowError(ConfigError);
  });

  it('a csak-whitespace kötelező titkot elutasítja', () => {
    expect(() => loadConfig({ ...validEnv, OPENAI_API_KEY: '   ' })).toThrowError(ConfigError);
  });

  it('a titkot trimmeli', () => {
    const config = loadConfig({ ...validEnv, ANTHROPIC_API_KEY: '  sk-ant-x  ' });
    expect(config.anthropicApiKey).toBe('sk-ant-x');
  });

  it('az üres opcionális modellnév a defaultra esik vissza', () => {
    const config = loadConfig({ ...validEnv, EMBEDDING_MODEL: '', ANSWER_MODEL: '   ' });
    expect(config.embeddingModel).toBe('text-embedding-3-small');
    expect(config.answerModel).toBe('claude-sonnet-5');
  });

  it('az üres/whitespace numerikus paraméter a defaultra esik vissza', () => {
    const config = loadConfig({ ...validEnv, WIDE_NET: '', KEEP_TOP: '  ' });
    expect(config.wideNet).toBe(20);
    expect(config.keepTop).toBe(5);
  });

  it('a numerikus hiba az ENV-változó nevét nevezi meg', () => {
    expect(() => loadConfig({ ...validEnv, WIDE_NET: 'nem-szam' })).toThrowError(/WIDE_NET/);
  });
});
