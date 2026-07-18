import { Pool } from 'pg';

/**
 * Tárolási hiba — beszédes, magyar üzenettel. A dimenzió-eltérés a beírás ELŐTT bukik
 * (nem a DB-nél némán), így árva/rossz vektor nem kerül a tudásbázisba (AD-3, AD-5).
 */
export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

/** Egy dokumentum-nyilvántartás sor bemenete (a `knowledge_documents` mezői). */
export interface DocumentInput {
  source: string;
  title: string;
  game: string;
  section: string;
  contentHash: string;
}

/** Egy tárolandó chunk: a `content` MÁR fejléces (AD-4), az `embedding` a `content` vektora. */
export interface ChunkInput {
  chunkIndex: number;
  heading: string;
  content: string;
  embedding: number[];
}

/** Egy keresési találat a grounding-forrással (játék + szakasz + source). */
export interface SearchHit {
  content: string;
  heading: string | null;
  chunkIndex: number;
  source: string;
  game: string;
  section: string;
  distance: number;
}

/** Egy dokumentum-összefoglaló (debug/list). */
export interface DocumentSummary {
  source: string;
  title: string;
  game: string;
  section: string;
  chunkCount: number;
  status: string;
}

/** A szinkron-döntéshez szükséges minimum: a source, a tárolt hash és a státusz. */
export interface SyncDocument {
  source: string;
  contentHash: string;
  status: string;
}

type Row = Record<string, unknown>;
type QueryResult = { rows: Row[] };

/** Egy tranzakció-kliens portja (a `pg.PoolClient` szűk metszete). */
export interface DbClient {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  release(): void;
}

/** A DB portja (a `pg.Pool` szűk metszete) — teszthez injektálható fake-kel. */
export interface Db {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  connect(): Promise<DbClient>;
}

export interface StoreOptions {
  /** A várt embedding-dimenzió (a `config.embeddingDimensions`); a beírandó vektorok ezt teljesítik. */
  dimensions: number;
}

export interface Store {
  insert(
    doc: DocumentInput,
    chunks: ChunkInput[],
  ): Promise<{ documentId: number; chunkCount: number }>;
  search(embedding: number[], topK: number): Promise<SearchHit[]>;
  list(): Promise<DocumentSummary[]>;
  /** A szinkron-döntéshez: minden dokumentum source + content_hash + status. */
  listForSync(): Promise<SyncDocument[]>;
  /** Soft-delete (audit): a chunkokat törli, a dokumentum-sort `status='deleted'`-re állítja (megtartja). */
  markDeleted(source: string): Promise<void>;
  delete(source: string): Promise<void>;
}

/** `number[]` → pgvector-literál (`'[0.1,0.2,…]'`), paraméterként `::vector`-ral castolva. */
export function toVector(values: number[]): string {
  return `[${values.join(',')}]`;
}

const INSERT_DOCUMENT_SQL = `
  INSERT INTO knowledge_documents (source, title, game, section, content_hash, chunk_count, status, indexed_at)
  VALUES ($1, $2, $3, $4, $5, $6, 'active', now())
  ON CONFLICT (source) DO UPDATE SET
    title = EXCLUDED.title,
    game = EXCLUDED.game,
    section = EXCLUDED.section,
    content_hash = EXCLUDED.content_hash,
    chunk_count = EXCLUDED.chunk_count,
    status = 'active',
    indexed_at = now()
  RETURNING id
`;

const INSERT_CHUNK_SQL = `
  INSERT INTO knowledge_chunks (document_id, chunk_index, heading, content, embedding)
  VALUES ($1, $2, $3, $4, $5::vector)
`;

const SEARCH_SQL = `
  SELECT c.content, c.heading, c.chunk_index, d.source, d.game, d.section,
         (c.embedding <=> $1::vector) AS distance
  FROM knowledge_chunks c
  JOIN knowledge_documents d ON d.id = c.document_id
  WHERE d.status = 'active'
  ORDER BY c.embedding <=> $1::vector
  LIMIT $2
`;

const LIST_SQL = `
  SELECT source, title, game, section, chunk_count, status
  FROM knowledge_documents
  ORDER BY source
`;

const DELETE_SQL = `DELETE FROM knowledge_documents WHERE source = $1`;

const LIST_FOR_SYNC_SQL = `SELECT source, content_hash, status FROM knowledge_documents`;

const MARK_DELETED_CHUNKS_SQL = `
  DELETE FROM knowledge_chunks
  WHERE document_id = (SELECT id FROM knowledge_documents WHERE source = $1)
`;

const MARK_DELETED_DOC_SQL = `
  UPDATE knowledge_documents SET status = 'deleted', chunk_count = 0, indexed_at = now()
  WHERE source = $1
`;

function assertDimensions(chunks: ChunkInput[], dimensions: number): void {
  for (const chunk of chunks) {
    if (chunk.embedding.length !== dimensions) {
      throw new StoreError(
        `A(z) ${chunk.chunkIndex}. chunk embedding-dimenziója ${chunk.embedding.length}, ` +
          `de a séma/konfiguráció ${dimensions}-t vár (AD-3). A dokumentum nem íródik be.`,
      );
    }
  }
}

/**
 * A tárolási réteg (`insert`/`search`/`list`/`delete`). Minden DB-mutáció paraméterezett SQL,
 * a dokumentum + chunkjai egy tranzakcióban (AD-5) — a kereső sosem lát fél-kész dokumentumot.
 */
export function createStore(db: Db, options: StoreOptions): Store {
  const { dimensions } = options;

  return {
    async insert(doc, chunks) {
      // A dimenzió-védelem a DB megnyitása ELŐTT (fail-fast, nincs fél-kész tranzakció).
      assertDimensions(chunks, dimensions);

      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(INSERT_DOCUMENT_SQL, [
          doc.source,
          doc.title,
          doc.game,
          doc.section,
          doc.contentHash,
          chunks.length,
        ]);
        const idRow = result.rows[0];
        if (idRow === undefined) {
          throw new StoreError('A dokumentum-beszúrás nem adott vissza id-t.');
        }
        const documentId = Number(idRow.id);

        await client.query('DELETE FROM knowledge_chunks WHERE document_id = $1', [documentId]);
        for (const chunk of chunks) {
          await client.query(INSERT_CHUNK_SQL, [
            documentId,
            chunk.chunkIndex,
            chunk.heading,
            chunk.content,
            toVector(chunk.embedding),
          ]);
        }

        await client.query('COMMIT');
        return { documentId, chunkCount: chunks.length };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async search(embedding, topK) {
      // A kérdés-vektor is az egyetlen embedding-térben él (AD-3) — rossz dimenzió fail-fast,
      // nem egy értelmetlen DB-hiba a `::vector` castnál.
      if (embedding.length !== dimensions) {
        throw new StoreError(
          `A keresési vektor dimenziója ${embedding.length}, de a konfiguráció ${dimensions}-t vár (AD-3).`,
        );
      }
      const result = await db.query(SEARCH_SQL, [toVector(embedding), topK]);
      return result.rows.map((row) => ({
        content: String(row.content ?? ''),
        heading: row.heading == null ? null : String(row.heading),
        chunkIndex: Number(row.chunk_index),
        source: String(row.source ?? ''),
        game: String(row.game ?? ''),
        section: String(row.section ?? ''),
        distance: Number(row.distance),
      }));
    },

    async list() {
      const result = await db.query(LIST_SQL);
      return result.rows.map((row) => ({
        source: String(row.source ?? ''),
        title: String(row.title ?? ''),
        game: String(row.game ?? ''),
        section: String(row.section ?? ''),
        chunkCount: Number(row.chunk_count),
        status: String(row.status ?? ''),
      }));
    },

    async listForSync() {
      const result = await db.query(LIST_FOR_SYNC_SQL);
      return result.rows.map((row) => ({
        source: String(row.source ?? ''),
        contentHash: String(row.content_hash ?? ''),
        status: String(row.status ?? ''),
      }));
    },

    async markDeleted(source) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query(MARK_DELETED_CHUNKS_SQL, [source]);
        await client.query(MARK_DELETED_DOC_SQL, [source]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async delete(source) {
      await db.query(DELETE_SQL, [source]);
    },
  };
}

/**
 * Az alapértelmezett `pg.Pool`-alapú DB-adapter a `config.databaseUrl`-ből. Vékony réteg a
 * {@link Db} port fölött — a tranzakció-logika a {@link createStore}-ban, unit-tesztelve.
 */
export function createPgDb(databaseUrl: string): Db & { end(): Promise<void> } {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    query: (sql, params) => pool.query(sql, params),
    connect: async () => {
      const client = await pool.connect();
      return {
        query: (sql, params) => client.query(sql, params),
        release: () => {
          client.release();
        },
      };
    },
    end: () => pool.end(),
  };
}
