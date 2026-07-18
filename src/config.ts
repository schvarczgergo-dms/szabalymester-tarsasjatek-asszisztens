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

/** Üres vagy csak-whitespace értéket `undefined`-dé alakít (így az opcionális mezők
 *  a `.default()`-ra esnek vissza, nem hasalnak el); a stringeket trimmeli. */
const blankToUndefined = (value: unknown): unknown => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed === '' || trimmed == null ? undefined : trimmed;
};

/** Kötelező, nem üres string; undefined/üres/whitespace egyaránt beszédes hibát ad (Zod 4).
 *  A titok trimmelődik (a másolásból ragadt whitespace nem okoz gondot). A hibaüzenet az
 *  ENV-változó nevét a {@link loadConfig} hibaépítője adja hozzá (ld. KEY_TO_ENV). */
const required = () =>
  z.preprocess(
    (value) => (value == null ? '' : String(value).trim()),
    z.string().min(1, 'hiányzik vagy üres — állítsd be a .env-ben'),
  );

/** Opcionális, nem üres string alapértelmezéssel; üres/whitespace érték → default. */
const withDefault = (fallback: string) =>
  z.preprocess(blankToUndefined, z.string().min(1).default(fallback));

/** Pozitív egész env-változó alapértelmezéssel; üres/whitespace → default. */
const positiveInt = (fallback: number) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int('egész számnak kell lennie')
      .positive('pozitív számnak kell lennie')
      .default(fallback),
  );

/** A séma-kulcsok → ENV-változónevek leképezése (a hibaüzenetek az ENV-nevet mutatják). */
const KEY_TO_ENV: Record<string, string> = {
  openaiApiKey: 'OPENAI_API_KEY',
  anthropicApiKey: 'ANTHROPIC_API_KEY',
  databaseUrl: 'DATABASE_URL',
  embeddingModel: 'EMBEDDING_MODEL',
  embeddingDimensions: 'EMBEDDING_DIMENSIONS',
  hydeModel: 'HYDE_MODEL',
  rerankModel: 'RERANK_MODEL',
  answerModel: 'ANSWER_MODEL',
  wideNet: 'WIDE_NET',
  keepTop: 'KEEP_TOP',
};

const configSchema = z.object({
  // Titkok — a rendszer nem indul el nélkülük.
  openaiApiKey: required(),
  anthropicApiKey: required(),
  databaseUrl: required(),

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
      .map((issue) => {
        const key = String(issue.path[0] ?? '');
        const envName = KEY_TO_ENV[key] ?? key ?? '(gyökér)';
        return `  - ${envName}: ${issue.message}`;
      })
      .join('\n');
    throw new ConfigError(`Hibás vagy hiányzó környezeti változók:\n${issues}`);
  }

  return parsed.data;
}
