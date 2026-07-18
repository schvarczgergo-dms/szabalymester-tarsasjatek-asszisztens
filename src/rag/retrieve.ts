import type { Config } from '../config';
import { createOpenAIEmbedBatch, embedTexts } from './embed';
import { createOpenAIHydeGenerate, generateHyde, type HydeResult } from './hyde';
import { createRerankGenerate, rerankChunks, type RerankResult } from './rerank';
import { createPgDb, createStore, type SearchHit, type Store } from './store';

/** Egy felszínre került forrás (grounding: játék + szakasz + source-URL). */
export interface RetrievedSource {
  source: string;
  game: string;
  section: string;
  heading: string | null;
}

/** Strukturált retrieval-trace (NFR-4) — program által olvasható, nem `console.log`. */
export interface RetrievalTrace {
  hydeText: string;
  hydeFallback: boolean;
  distances: number[];
  rerankScores: number[];
  rerankFallback: boolean;
  contextChars: number;
  empty: boolean;
  /** A retrieval modellhívásainak aggregált token-usage-e (HyDE + embedding + rerank) — AD-11. */
  usage: { tokens: number };
}

export interface RetrievalResult {
  context: string;
  sources: RetrievedSource[];
  hits: SearchHit[];
  trace: RetrievalTrace;
  empty: boolean;
}

export interface RetrieveDeps {
  hyde: (question: string) => Promise<HydeResult>;
  embed: (texts: string[]) => Promise<{ vectors: number[][]; usage: { tokens: number } }>;
  search: (embedding: number[], topK: number) => Promise<SearchHit[]>;
  rerank: (
    question: string,
    candidates: string[],
    opts: { keepTop: number },
  ) => Promise<RerankResult>;
}

export interface RetrieveOptions {
  wideNet: number;
  keepTop: number;
}

function emptyResult(trace: RetrievalTrace): RetrievalResult {
  return { context: '', sources: [], hits: [], trace: { ...trace, empty: true }, empty: true };
}

/**
 * A kétlépcsős retrieval-pipeline (FR-10..14, AD-2, AD-3, AD-7): HyDE → embedding → tág háló →
 * rerank → top-K kontextus + források + trace. Minden lépésnek fallbackje van; a `retrieve` a
 * hívó felé SOHA nem dob — hibánál/üres találatnál `empty` eredményt ad.
 */
export async function retrieve(
  question: string,
  deps: RetrieveDeps,
  opts: RetrieveOptions,
): Promise<RetrievalResult> {
  const trace: RetrievalTrace = {
    hydeText: question,
    hydeFallback: false,
    distances: [],
    rerankScores: [],
    rerankFallback: false,
    contextChars: 0,
    empty: false,
    usage: { tokens: 0 },
  };

  // 1) HyDE (saját fallbackje van; a biztonság kedvéért itt is védve).
  let hydeText = question;
  try {
    const hyde = await deps.hyde(question);
    hydeText = hyde.text;
    trace.hydeText = hyde.text;
    trace.hydeFallback = hyde.usedFallback;
    trace.usage.tokens += hyde.usage.tokens;
  } catch {
    trace.hydeFallback = true;
  }

  // 2) Embedding — a HyDE-szöveget UGYANAZ a modell vektorizálja (AD-3). Hiba → nincs keresés.
  let vector: number[] | undefined;
  try {
    const embedded = await deps.embed([hydeText]);
    vector = embedded.vectors[0];
    trace.usage.tokens += embedded.usage.tokens;
  } catch {
    vector = undefined;
  }
  if (vector === undefined) {
    return emptyResult(trace);
  }

  // 3) Tág háló — koszinusz-keresés az active chunkokon. Hiba → üres.
  let hits: SearchHit[] = [];
  try {
    hits = await deps.search(vector, opts.wideNet);
  } catch {
    hits = [];
  }
  trace.distances = hits.map((hit) => hit.distance);
  if (hits.length === 0) {
    return emptyResult(trace);
  }

  // 4) Rerank (saját fallbackje van) → top-K.
  let reranked: RerankResult;
  try {
    reranked = await deps.rerank(
      question,
      hits.map((hit) => hit.content),
      { keepTop: opts.keepTop },
    );
  } catch {
    reranked = {
      ranked: hits.map((_, index) => ({ index, score: -1 })).slice(0, opts.keepTop),
      usage: { tokens: 0 },
      usedFallback: true,
    };
  }
  trace.rerankScores = reranked.ranked.map((item) => item.score);
  trace.rerankFallback = reranked.usedFallback;
  trace.usage.tokens += reranked.usage.tokens;

  const topHits = reranked.ranked
    .map((item) => hits[item.index])
    .filter((hit): hit is SearchHit => hit !== undefined);

  const context = topHits
    .map((hit) => `[${hit.game} · ${hit.section}] ${hit.content}`)
    .join('\n\n---\n\n');
  trace.contextChars = context.length;

  const sources: RetrievedSource[] = topHits.map((hit) => ({
    source: hit.source,
    game: hit.game,
    section: hit.section,
    heading: hit.heading,
  }));

  return { context, sources, hits: topHits, trace, empty: topHits.length === 0 };
}

/**
 * Az alapértelmezett retrieval-deps a valós providerekkel (a `config`-ból): HyDE OpenAI-n,
 * rerank Anthropic-on (AD-7), embedding OpenAI-n (AD-3). A `store` a hívótól jön (megosztható).
 */
export function createRetrieveDeps(config: Config, store: Store): RetrieveDeps {
  const embedBatch = createOpenAIEmbedBatch(config);
  const hydeGenerate = createOpenAIHydeGenerate(config);
  const rerankGenerate = createRerankGenerate(config);
  return {
    hyde: (question) => generateHyde(question, { generate: hydeGenerate }),
    embed: (texts) => embedTexts(texts, { embedBatch, dimensions: config.embeddingDimensions }),
    search: (embedding, topK) => store.search(embedding, topK),
    rerank: (question, candidates, opts) =>
      rerankChunks(question, candidates, { generate: rerankGenerate }, opts),
  };
}

/** Kényelmi factory: a `config.databaseUrl`-ből pg-store + a valós retrieval-deps. */
export function createRetriever(config: Config): {
  deps: RetrieveDeps;
  close: () => Promise<void>;
} {
  const db = createPgDb(config.databaseUrl);
  const store = createStore(db, { dimensions: config.embeddingDimensions });
  return { deps: createRetrieveDeps(config, store), close: () => db.end() };
}
