import { embedMany } from 'ai';
import type { Config } from '../config';
import { createProviders } from '../providers';

/**
 * A séma `vector(N)` rögzített dimenziója (`db/schema.sql`). Az embedding-modell
 * kimenetének ezzel KELL egyeznie — a dimenzió a rendszer egyetlen embedding-tere (AD-3).
 */
export const SCHEMA_VECTOR_DIM = 1536;

/** Alapértelmezett batch-méret: egy embedding-hívásban legfeljebb ennyi szöveg. */
export const DEFAULT_BATCH_SIZE = 100;

/** Embedding-hiba — beszédes, magyar üzenettel, fail-fast (a rossz dimenzió nem jut a DB-ig). */
export class EmbedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbedError';
  }
}

/** Egy batch-embedding hívás portja — a valós `embedMany` köré, teszthez injektálható fake-kel. */
export type EmbedBatchFn = (
  values: string[],
) => Promise<{ embeddings: number[][]; usage: { tokens: number } }>;

export interface EmbedDeps {
  /** A batch-embedding hívás (default: OpenAI `embedMany` a `config.embeddingModel`-lel). */
  embedBatch: EmbedBatchFn;
  /** A várt vektor-dimenzió (a `config.embeddingDimensions`). */
  dimensions: number;
  /** Egy hívás max. mérete (default {@link DEFAULT_BATCH_SIZE}). */
  batchSize?: number;
}

export interface EmbeddedResult {
  vectors: number[][];
  usage: { tokens: number };
}

/**
 * Fail-fast dimenzió-ellenőrzés (AD-3): a konfigurált embedding-dimenziónak egyeznie kell a
 * séma `vector(N)`-jével, különben a beírt vektorok némán ütköznének a DB-vel.
 *
 * @throws {EmbedError} ha a konfigurált dimenzió eltér a sémáétól.
 */
export function checkEmbeddingDimensions(
  configured: number,
  schema: number = SCHEMA_VECTOR_DIM,
): void {
  if (configured !== schema) {
    throw new EmbedError(
      `Az embedding-dimenzió (${configured}) nem egyezik a séma vector(${schema})-jével. ` +
        `Állítsd az EMBEDDING_DIMENSIONS-t ${schema}-re, vagy migráld a sémát és futtass --rebuild-et (AD-3).`,
    );
  }
}

/** Tömb ≤`size` méretű, sorrendtartó szeletekre bontása. */
function chunkInto<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * Szövegek batch-embeddingje egyetlen embedding-térben (AD-3). A bemenetek sorrendje =
 * a kimeneti vektorok sorrendje; minden vektor dimenziója ellenőrzött (fail-fast), a
 * token-usage a batchek között aggregálódik (AD-11 előkészítés).
 *
 * @throws {EmbedError} ha egy visszakapott vektor hossza nem `deps.dimensions`.
 */
export async function embedTexts(texts: string[], deps: EmbedDeps): Promise<EmbeddedResult> {
  const { embedBatch, dimensions } = deps;
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new EmbedError(`A batch-méret pozitív egész kell legyen, kapott: ${batchSize}.`);
  }

  const vectors: number[][] = [];
  let tokens = 0;

  for (const batch of chunkInto(texts, batchSize)) {
    const { embeddings, usage } = await embedBatch(batch);
    tokens += usage.tokens;
    for (const vector of embeddings) {
      if (vector.length !== dimensions) {
        throw new EmbedError(
          `A modell ${vector.length} dimenziós vektort adott, de a várt dimenzió ${dimensions} (AD-3). ` +
            `Ellenőrizd az EMBEDDING_MODEL és az EMBEDDING_DIMENSIONS összhangját.`,
        );
      }
      vectors.push(vector);
    }
  }

  return { vectors, usage: { tokens } };
}

/**
 * Az alapértelmezett, OpenAI-alapú batch-embedder a Vercel AI SDK-ra (`embedMany`). A kérdést és a
 * dokumentumokat UGYANEZ vektorizálja (AD-3) — a modellnév kizárólag a `config`-ból jön (AD-6).
 */
export function createOpenAIEmbedBatch(config: Config): EmbedBatchFn {
  const model = createProviders(config).openai.embedding(config.embeddingModel);
  return async (values) => {
    const { embeddings, usage } = await embedMany({ model, values });
    return { embeddings, usage: { tokens: usage.tokens } };
  };
}
