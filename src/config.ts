import 'dotenv/config';
import { z } from 'zod';

/**
 * Konfigurációs hiba — az env-validáció fail-fast módon dobja, beszédes magyar
 * üzenettel. Az entry pointok (cli.ts, ingest.ts) a legelső lépésben hívják a
 * {@link loadConfig}-ot, így a hiányzó/rossz beállítás azonnal, egyértelműen kiderül.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Kötelező, nem üres string; undefined és üres érték egyaránt beszédes hibát ad (Zod 4). */
const required = (name: string) =>
  z.preprocess(
    (value) => (value == null ? '' : value),
    z.string().min(1, `${name} hiányzik vagy üres — állítsd be a .env-ben`),
  );

/** Opcionális, nem üres string alapértelmezéssel. */
const withDefault = (fallback: string) => z.string().min(1).default(fallback);

/** Pozitív egész env-változó (stringből konvertálva) alapértelmezéssel. */
const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const configSchema = z.object({
  // Titkok — a rendszer nem indul el nélkülük.
  openaiApiKey: required('OPENAI_API_KEY'),
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  databaseUrl: required('DATABASE_URL'),

  // Modell-szereposztás (az architektúra-spine web-ellenőrzött értékei) — mind felülírható env-ből.
  embeddingModel: withDefault('text-embedding-3-small'),
  embeddingDimensions: positiveInt(1536),
  hydeModel: withDefault('gpt-5.4-nano'),
  rerankModel: withDefault('claude-haiku-4-5'),
  answerModel: withDefault('claude-sonnet-5'),

  // Keresési pipeline paraméterei.
  wideNet: positiveInt(20),
  keepTop: positiveInt(5),
});

/** A validált, típusos konfiguráció. */
export type Config = z.infer<typeof configSchema>;

/**
 * Beolvassa és validálja a konfigurációt a környezeti változókból (fail-fast).
 * Alapból a `process.env`-ből dolgozik; teszthez átadható explicit env-objektum.
 *
 * @throws {ConfigError} ha bármelyik kötelező változó hiányzik, vagy egy érték érvénytelen.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse({
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    databaseUrl: env.DATABASE_URL,
    embeddingModel: env.EMBEDDING_MODEL,
    embeddingDimensions: env.EMBEDDING_DIMENSIONS,
    hydeModel: env.HYDE_MODEL,
    rerankModel: env.RERANK_MODEL,
    answerModel: env.ANSWER_MODEL,
    wideNet: env.WIDE_NET,
    keepTop: env.KEEP_TOP,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(gyökér)'}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(`Hibás vagy hiányzó környezeti változók:\n${issues}`);
  }

  return parsed.data;
}
