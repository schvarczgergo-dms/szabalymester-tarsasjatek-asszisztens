import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentHash, parseDocument } from './parse-document';
import { chunkDocument, type ChunkOptions } from './chunk';
import { loadConfig } from '../config';
import { checkEmbeddingDimensions, createOpenAIEmbedBatch, embedTexts } from '../rag/embed';
import {
  createPgDb,
  createStore,
  type ChunkInput,
  type DocumentInput,
  type SyncDocument,
} from '../rag/store';

/**
 * A pipeline verziója. A chunker/embedding-stratégia változásakor NÖVELD — ilyenkor a hash-ek
 * érvénytelenek, és teljes újraépítés kell (`pnpm ingest --rebuild`). A tárolt `pipeline_version`
 * oszlop + auto-detektálás spine-Deferred; v1-ben ez dokumentált, kézi `--rebuild`-kényszer.
 */
export const PIPELINE_VERSION = '1';

/** A korpusz mappája a repo gyökeréhez képest. */
const CORPUS_DIR = 'seed/rules';

/** Egy beolvasott korpusz-fájl (nyers tartalom + a fájl-forrás, hibajelentéshez). */
export interface CorpusEntry {
  source: string;
  raw: string;
}

/** A szinkron-döntés eredménye — csak source-ok (a tényleges tartalom a hívónál marad). */
export interface SyncPlan {
  toUpsert: string[];
  toDelete: string[];
  toSkip: string[];
}

/** Az ingest által használt store-metszet (AD-9: ingest → rag). */
export interface IngestStore {
  listForSync(): Promise<SyncDocument[]>;
  insert(
    doc: DocumentInput,
    chunks: ChunkInput[],
  ): Promise<{ documentId: number; chunkCount: number }>;
  markDeleted(source: string): Promise<void>;
}

/** Az embedding-hívás metszete (a Story 1.5 `embedTexts` köré). */
export type IngestEmbed = (
  texts: string[],
) => Promise<{ vectors: number[][]; usage: { tokens: number } }>;

export interface IngestDeps {
  readCorpus: () => Promise<CorpusEntry[]>;
  embed: IngestEmbed;
  store: IngestStore;
  chunkOptions?: ChunkOptions;
  log?: (message: string) => void;
}

export interface IngestReport {
  newDocs: number;
  changedDocs: number;
  revivedDocs: number;
  skipped: number;
  deleted: number;
  embeddedChunks: number;
  tokens: number;
  failed: { source: string; error: string }[];
}

/**
 * Tiszta szinkron-döntés (FR-4, FR-5): a korpusz-hash-ek és a DB-állapot alapján osztályoz.
 * - `active` + egyező hash → skip (0 embedding-hívás)
 * - új / módosult / korábban `deleted` (a chunkok elvesztek) → upsert
 * - `active`, de a korpuszból eltűnt → delete (soft, audit)
 * - `rebuild` → minden jelen lévő dokumentum upsert (a hash-t nem nézi)
 */
export function planSync(
  corpus: { source: string; hash: string }[],
  existing: SyncDocument[],
  opts: { rebuild?: boolean } = {},
): SyncPlan {
  const rebuild = opts.rebuild ?? false;
  const existingBySource = new Map(existing.map((doc) => [doc.source, doc]));
  const corpusSources = new Set(corpus.map((entry) => entry.source));

  const toUpsert: string[] = [];
  const toSkip: string[] = [];
  for (const entry of corpus) {
    const prev = existingBySource.get(entry.source);
    const unchanged =
      !rebuild && prev !== undefined && prev.status === 'active' && prev.contentHash === entry.hash;
    if (unchanged) {
      toSkip.push(entry.source);
    } else {
      toUpsert.push(entry.source);
    }
  }

  const toDelete: string[] = [];
  for (const doc of existing) {
    if (doc.status === 'active' && !corpusSources.has(doc.source)) {
      toDelete.push(doc.source);
    }
  }

  return { toUpsert, toDelete, toSkip };
}

interface PreparedDoc {
  source: string;
  document: DocumentInput;
  chunks: { chunkIndex: number; heading: string; content: string }[];
  hash: string;
}

/**
 * Inkrementális ingest-futás (FR-4, FR-5, AD-5, AD-11). A `toSkip` dokumentumok NEM
 * vektorizálódnak újra; a `toUpsert`-ek chunk-`content`-jei EGY batch-embeddingben mennek,
 * dokumentumonként tranzakcióban tárolódnak; a `toDelete`-ek soft-delete-elődnek. Egy
 * dokumentum hibája nem állítja le a futást (a hiba a riportba kerül).
 */
export async function runIngest(
  deps: IngestDeps,
  opts: { rebuild?: boolean } = {},
): Promise<IngestReport> {
  const failed: { source: string; error: string }[] = [];
  const entries = await deps.readCorpus();

  // Parse + chunk + hash — hiba-izolálva dokumentumonként; a duplikált source is hiba (AD-10).
  const prepared: PreparedDoc[] = [];
  const seenSources = new Set<string>();
  for (const entry of entries) {
    try {
      const parsed = parseDocument(entry.raw);
      const source = parsed.frontMatter.source;
      if (seenSources.has(source)) {
        failed.push({
          source,
          error: `Duplikált source a korpuszban: ${source} — egy fájl = egy (game, section) (AD-10).`,
        });
        continue;
      }
      seenSources.add(source);
      const hash = contentHash(parsed.body);
      const chunks = chunkDocument(parsed, deps.chunkOptions);
      prepared.push({
        source: parsed.frontMatter.source,
        hash,
        chunks,
        document: {
          source: parsed.frontMatter.source,
          title: parsed.frontMatter.title,
          game: parsed.frontMatter.game,
          section: parsed.frontMatter.section,
          contentHash: hash,
        },
      });
    } catch (error) {
      failed.push({ source: entry.source, error: (error as Error).message });
    }
  }

  const existing = await deps.store.listForSync();
  const existingBySource = new Map(existing.map((doc) => [doc.source, doc]));
  const plan = planSync(
    prepared.map((doc) => ({ source: doc.source, hash: doc.hash })),
    existing,
    opts,
  );

  const upsertSet = new Set(plan.toUpsert);
  const upserts = prepared.filter((doc) => upsertSet.has(doc.source));

  // Egyetlen batch-embedding az összes upsert-chunkra (az ≤100 batchelést az embedTexts intézi).
  const allTexts = upserts.flatMap((doc) => doc.chunks.map((chunk) => chunk.content));
  let vectors: number[][] = [];
  let tokens = 0;
  if (allTexts.length > 0) {
    const result = await deps.embed(allTexts);
    vectors = result.vectors;
    tokens = result.usage.tokens;
  }

  let newDocs = 0;
  let changedDocs = 0;
  let revivedDocs = 0;
  let cursor = 0;
  for (const doc of upserts) {
    const chunkInputs: ChunkInput[] = doc.chunks.map((chunk) => {
      const embedding = vectors[cursor];
      cursor += 1;
      if (embedding === undefined) {
        throw new Error(
          `Hiányzó embedding-vektor a(z) ${doc.source} chunkjához (index ${cursor - 1}).`,
        );
      }
      return {
        chunkIndex: chunk.chunkIndex,
        heading: chunk.heading,
        content: chunk.content,
        embedding,
      };
    });
    try {
      await deps.store.insert(doc.document, chunkInputs);
      const prev = existingBySource.get(doc.source);
      if (prev === undefined) newDocs += 1;
      else if (prev.status !== 'active') revivedDocs += 1;
      else changedDocs += 1;
    } catch (error) {
      failed.push({ source: doc.source, error: (error as Error).message });
    }
  }

  // Biztonsági védelem: üres korpusz esetén NE töröljük a teljes tudásbázist (elgépelt út /
  // hiányzó seed/rules → readCorpus üres). A tömeges soft-delete-et csak nem-üres korpusz váltja ki.
  let deleted = 0;
  if (entries.length === 0 && plan.toDelete.length > 0) {
    deps.log?.(
      'Figyelem: üres korpusz — a törlési fázis kihagyva (biztonsági védelem a tudásbázis kiürítése ellen).',
    );
  } else {
    for (const source of plan.toDelete) {
      try {
        await deps.store.markDeleted(source);
        deleted += 1;
      } catch (error) {
        failed.push({ source, error: (error as Error).message });
      }
    }
  }

  const report: IngestReport = {
    newDocs,
    changedDocs,
    revivedDocs,
    skipped: plan.toSkip.length,
    deleted,
    embeddedChunks: allTexts.length,
    tokens,
    failed,
  };

  deps.log?.(
    `Ingest kész (pipeline ${PIPELINE_VERSION}): ` +
      `${newDocs} új, ${changedDocs} módosult, ${revivedDocs} újraélesztett, ` +
      `${report.skipped} kihagyott, ${deleted} törölt; ${report.embeddedChunks} chunk embeddelve ` +
      `(${tokens} token)${failed.length > 0 ? `, ${failed.length} hibás` : ''}.`,
  );

  return report;
}

/** Az fs-alapú korpusz-olvasó: a `seed/rules/*.md` fájlok tartalma. */
async function readCorpusFromFs(): Promise<CorpusEntry[]> {
  let files: string[];
  try {
    files = await readdir(CORPUS_DIR);
  } catch {
    return [];
  }
  const mdFiles = files.filter((name) => name.endsWith('.md'));
  return Promise.all(
    mdFiles.map(async (name) => {
      const filePath = path.join(CORPUS_DIR, name);
      return { source: filePath, raw: await readFile(filePath, 'utf8') };
    }),
  );
}

/** A `pnpm ingest [--rebuild]` belépőpont: fail-fast config + valós fs/OpenAI/pg wiring. */
async function main(): Promise<void> {
  const config = loadConfig();
  checkEmbeddingDimensions(config.embeddingDimensions, config.schemaVectorDim);

  const rebuild = process.argv.includes('--rebuild');
  const embedBatch = createOpenAIEmbedBatch(config);
  const db = createPgDb(config.databaseUrl);
  const store = createStore(db, { dimensions: config.embeddingDimensions });

  try {
    await runIngest(
      {
        readCorpus: readCorpusFromFs,
        embed: (texts) => embedTexts(texts, { embedBatch, dimensions: config.embeddingDimensions }),
        store,
        log: (message) => console.log(message),
      },
      { rebuild },
    );
  } finally {
    await db.end();
  }
}

// Közvetlen futtatáskor (tsx src/ingest/ingest.ts) indul; importáláskor (teszt) nem.
// A pathToFileURL cross-platform (Windows `file:///C:/...` is helyesen illeszkedik).
const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
