import { describe, expect, it, vi } from 'vitest';
import {
  StoreError,
  createStore,
  toVector,
  type ChunkInput,
  type Db,
  type DbClient,
  type DocumentInput,
} from './store';

const doc: DocumentInput = {
  source: 'https://example/catan/jatekmenet',
  title: 'Catan – Játékmenet',
  game: 'Catan',
  section: 'jatekmenet',
  contentHash: 'abc123',
};

const chunk = (chunkIndex: number, dim = 3): ChunkInput => ({
  chunkIndex,
  heading: `H${chunkIndex}`,
  content: `Catan\n\nSzabály ${chunkIndex}.`,
  embedding: Array.from({ length: dim }, () => 0.1),
});

interface Call {
  sql: string;
  params: unknown[];
}

/** Rögzítő fake DB: a tranzakció-kliens és a pool hívásait sorrendben naplózza. */
function makeFakeDb(opts: { failOn?: RegExp; rows?: Record<string, unknown>[] } = {}) {
  const clientCalls: Call[] = [];
  const poolCalls: Call[] = [];
  let connectCount = 0;
  const release = vi.fn();

  const client: DbClient = {
    query: (sql: string, params: unknown[] = []) => {
      clientCalls.push({ sql, params });
      if (opts.failOn?.test(sql)) return Promise.reject(new Error('DB boom'));
      const rows = /RETURNING id/i.test(sql) ? [{ id: 42 }] : [];
      return Promise.resolve({ rows });
    },
    release,
  };

  const db: Db = {
    query: (sql: string, params: unknown[] = []) => {
      poolCalls.push({ sql, params });
      return Promise.resolve({ rows: opts.rows ?? [] });
    },
    connect: () => {
      connectCount += 1;
      return Promise.resolve(client);
    },
  };

  return { db, clientCalls, poolCalls, release, connectCount: () => connectCount };
}

const keywords = (calls: Call[]): string[] =>
  calls.map((c) => {
    const s = c.sql.toUpperCase();
    if (s.startsWith('BEGIN')) return 'BEGIN';
    if (s.startsWith('COMMIT')) return 'COMMIT';
    if (s.startsWith('ROLLBACK')) return 'ROLLBACK';
    if (s.includes('INSERT INTO KNOWLEDGE_DOCUMENTS')) return 'INSERT_DOC';
    if (s.includes('DELETE FROM KNOWLEDGE_CHUNKS')) return 'DELETE_CHUNKS';
    if (s.includes('INSERT INTO KNOWLEDGE_CHUNKS')) return 'INSERT_CHUNK';
    return 'OTHER';
  });

describe('toVector', () => {
  it('a number[]-t pgvector-literállá formázza', () => {
    expect(toVector([0.1, 0.2, -0.3])).toBe('[0.1,0.2,-0.3]');
  });
});

describe('createStore.insert', () => {
  it('egy tranzakcióban ír: BEGIN → dok → chunk-törlés → chunkok → COMMIT', async () => {
    const f = makeFakeDb();
    const store = createStore(f.db, { dimensions: 3 });

    await store.insert(doc, [chunk(0), chunk(1)]);

    expect(keywords(f.clientCalls)).toEqual([
      'BEGIN',
      'INSERT_DOC',
      'DELETE_CHUNKS',
      'INSERT_CHUNK',
      'INSERT_CHUNK',
      'COMMIT',
    ]);
    expect(f.release).toHaveBeenCalledTimes(1);
  });

  it('upsert: a régi chunkok törlése az új chunkok beírása ELŐTT fut', async () => {
    const f = makeFakeDb();
    const store = createStore(f.db, { dimensions: 3 });

    await store.insert(doc, [chunk(0)]);

    const kw = keywords(f.clientCalls);
    expect(kw.indexOf('DELETE_CHUNKS')).toBeLessThan(kw.indexOf('INSERT_CHUNK'));
    const docCall = f.clientCalls.find((c) => /INSERT INTO knowledge_documents/i.test(c.sql));
    expect(docCall?.sql).toMatch(/ON CONFLICT/i);
  });

  it('hibánál ROLLBACK, a hiba tovább dobódik, a kliens felszabadul', async () => {
    const f = makeFakeDb({ failOn: /INSERT INTO knowledge_chunks/i });
    const store = createStore(f.db, { dimensions: 3 });

    await expect(store.insert(doc, [chunk(0)])).rejects.toThrow('DB boom');

    const kw = keywords(f.clientCalls);
    expect(kw).toContain('ROLLBACK');
    expect(kw).not.toContain('COMMIT');
    expect(f.release).toHaveBeenCalledTimes(1);
  });

  it('dimenzió-guard: rossz hosszú embedding → StoreError, DB-t meg sem nyitja', async () => {
    const f = makeFakeDb();
    const store = createStore(f.db, { dimensions: 1536 });

    await expect(store.insert(doc, [chunk(0, 3)])).rejects.toThrow(StoreError);
    expect(f.connectCount()).toBe(0);
  });

  it('paraméterezett SQL: az embedding a chunk-insert utolsó paramétere, vektor-literálként', async () => {
    const f = makeFakeDb();
    const store = createStore(f.db, { dimensions: 3 });

    await store.insert(doc, [chunk(0)]);

    const chunkCall = f.clientCalls.find((c) => /INSERT INTO knowledge_chunks/i.test(c.sql));
    expect(chunkCall?.sql).toContain('$5::vector');
    expect(chunkCall?.params[4]).toBe('[0.1,0.1,0.1]');
  });
});

describe('createStore.search', () => {
  it('koszinusz-közelség csak active dokumentumokon, forrás-payloaddal', async () => {
    const f = makeFakeDb({
      rows: [
        {
          content: 'Catan\n\nSzabály.',
          heading: 'Építkezés',
          chunk_index: 2,
          source: 's',
          game: 'Catan',
          section: 'jatekmenet',
          distance: 0.12,
        },
      ],
    });
    const store = createStore(f.db, { dimensions: 3 });

    const hits = await store.search([0.1, 0.2, 0.3], 5);

    const sql = f.poolCalls[0]!.sql;
    expect(sql).toContain('<=>');
    expect(sql).toMatch(/status\s*=\s*'active'/i);
    expect(f.poolCalls[0]!.params).toEqual(['[0.1,0.2,0.3]', 5]);
    expect(hits[0]).toMatchObject({ game: 'Catan', section: 'jatekmenet', distance: 0.12 });
  });

  it('a rossz dimenziójú keresési vektor fail-fast (AD-3), a DB-t meg sem hívja', async () => {
    const f = makeFakeDb();
    const store = createStore(f.db, { dimensions: 1536 });

    await expect(store.search([0.1, 0.2, 0.3], 5)).rejects.toThrow(StoreError);
    expect(f.poolCalls).toHaveLength(0);
  });
});

describe('createStore.list / delete', () => {
  it('list: a dokumentumokat chunk-számmal és státusszal adja', async () => {
    const f = makeFakeDb({
      rows: [
        {
          source: 's',
          title: 't',
          game: 'Catan',
          section: 'jatekmenet',
          chunk_count: 7,
          status: 'active',
        },
      ],
    });
    const store = createStore(f.db, { dimensions: 3 });

    const docs = await store.list();

    expect(f.poolCalls[0]!.sql).toMatch(/from knowledge_documents/i);
    expect(docs[0]).toMatchObject({ chunkCount: 7, status: 'active' });
  });

  it('delete: paraméterezett törlés source-ra (CASCADE a chunkokra)', async () => {
    const f = makeFakeDb();
    const store = createStore(f.db, { dimensions: 3 });

    await store.delete('s');

    expect(f.poolCalls[0]!.sql).toMatch(/delete from knowledge_documents where source = \$1/i);
    expect(f.poolCalls[0]!.params).toEqual(['s']);
  });
});
