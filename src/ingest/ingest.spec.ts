import { describe, expect, it, vi } from 'vitest';
import { planSync, runIngest, type CorpusEntry, type IngestStore } from './ingest';
import { contentHash } from './parse-document';
import type { SyncDocument } from '../rag/store';

const md = (source: string, body: string, extra: Partial<Record<string, string>> = {}): string =>
  `---\ntitle: ${extra.title ?? 't'}\ngame: ${extra.game ?? 'Catan'}\nsource: ${source}\nsection: ${extra.section ?? 'jatekmenet'}\n---\n${body}`;

/** A normalizált törzs hash-e egy adott markdownhoz (a DB-beli tárolt hash szimulálásához). */
const hashOf = (source: string, body: string): string =>
  contentHash(md(source, body).replace(/^---[\s\S]*?---\n/, '')); // a body normalizált — a front matter nélkül

describe('planSync', () => {
  const corpus = [
    { source: 'a', hash: 'h-a' },
    { source: 'b', hash: 'h-b' },
  ];

  it('egyező hash + active → skip; eltérő hash → upsert; új source → upsert', () => {
    const existing: SyncDocument[] = [
      { source: 'a', contentHash: 'h-a', status: 'active' }, // változatlan
      { source: 'b', contentHash: 'REGI', status: 'active' }, // módosult
    ];
    const plan = planSync(corpus, existing);
    expect(plan.toSkip).toEqual(['a']);
    expect(plan.toUpsert.sort()).toEqual(['b']);
  });

  it('a korpuszból eltűnt active dokumentum → delete', () => {
    const existing: SyncDocument[] = [
      { source: 'a', contentHash: 'h-a', status: 'active' },
      { source: 'b', contentHash: 'h-b', status: 'active' },
      { source: 'c', contentHash: 'h-c', status: 'active' }, // már nincs a korpuszban
    ];
    const plan = planSync(corpus, existing);
    expect(plan.toDelete).toEqual(['c']);
  });

  it('visszatérő (korábban deleted) dokumentum → upsert (újraélesztés), nem skip', () => {
    const existing: SyncDocument[] = [
      { source: 'a', contentHash: 'h-a', status: 'deleted' }, // ugyanaz a hash, de deleted → a chunkok elvesztek
      { source: 'b', contentHash: 'h-b', status: 'active' },
    ];
    const plan = planSync(corpus, existing);
    expect(plan.toUpsert).toContain('a');
    expect(plan.toSkip).not.toContain('a');
    expect(plan.toDelete).toEqual([]);
  });

  it('rebuild: minden jelen lévő dokumentum upsert, skip üres', () => {
    const existing: SyncDocument[] = [{ source: 'a', contentHash: 'h-a', status: 'active' }];
    const plan = planSync(corpus, existing, { rebuild: true });
    expect(plan.toUpsert.sort()).toEqual(['a', 'b']);
    expect(plan.toSkip).toEqual([]);
  });
});

function fakeStore(existing: SyncDocument[]) {
  return {
    listForSync: vi.fn(() => Promise.resolve(existing)),
    insert: vi.fn(() => Promise.resolve({ documentId: 1, chunkCount: 1 })),
    markDeleted: vi.fn(() => Promise.resolve()),
  } satisfies IngestStore & Record<string, unknown>;
}

describe('runIngest', () => {
  it('változatlan korpuszon NEM hív embeddert (0 embedding-hívás)', async () => {
    const raw = md('a', 'Szabály A.');
    const store = fakeStore([
      { source: 'a', contentHash: hashOf('a', 'Szabály A.'), status: 'active' },
    ]);
    const embed = vi.fn(() => Promise.resolve({ vectors: [], usage: { tokens: 0 } }));

    const report = await runIngest({
      readCorpus: () => Promise.resolve([{ source: 'a', raw }]),
      embed,
      store,
    });

    expect(embed).not.toHaveBeenCalled();
    expect(report.skipped).toBe(1);
    expect(report.newDocs + report.changedDocs + report.revivedDocs).toBe(0);
  });

  it('új + törölt: embeddel egyszer, insertel, a hiányzót markDeleted-eli, a riport stimmel', async () => {
    const rawNew = md('new', 'Új szabály egy.\n\nMásik bekezdés.');
    const store = fakeStore([
      { source: 'gone', contentHash: 'x', status: 'active' }, // nincs a korpuszban → delete
    ]);
    const embed = vi.fn((texts: string[]) =>
      Promise.resolve({ vectors: texts.map(() => [0.1]), usage: { tokens: texts.length } }),
    );

    const report = await runIngest({
      readCorpus: () => Promise.resolve([{ source: 'new', raw: rawNew }]),
      embed,
      store,
    });

    expect(embed).toHaveBeenCalledTimes(1);
    expect(store.insert).toHaveBeenCalledTimes(1);
    expect(store.markDeleted).toHaveBeenCalledWith('gone');
    expect(report.newDocs).toBe(1);
    expect(report.deleted).toBe(1);
    expect(report.tokens).toBeGreaterThan(0);
  });

  it('üres korpusz: NEM töröl (biztonsági védelem a tudásbázis kiürítése ellen)', async () => {
    const store = fakeStore([
      { source: 'a', contentHash: 'h', status: 'active' },
      { source: 'b', contentHash: 'h', status: 'active' },
    ]);
    const embed = vi.fn(() => Promise.resolve({ vectors: [], usage: { tokens: 0 } }));

    const report = await runIngest({
      readCorpus: () => Promise.resolve<CorpusEntry[]>([]),
      embed,
      store,
    });

    expect(store.markDeleted).not.toHaveBeenCalled();
    expect(report.deleted).toBe(0);
  });

  it('duplikált source a korpuszban → a második hibás, nem írja felül némán (AD-10)', async () => {
    const store = fakeStore([]);
    const embed = vi.fn((texts: string[]) =>
      Promise.resolve({ vectors: texts.map(() => [0.1]), usage: { tokens: 1 } }),
    );

    const report = await runIngest({
      readCorpus: () =>
        Promise.resolve<CorpusEntry[]>([
          { source: 'dup', raw: md('dup', 'Első.') },
          { source: 'dup', raw: md('dup', 'Második, ütköző.') },
        ]),
      embed,
      store,
    });

    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]!.error).toMatch(/duplik/i);
    expect(store.insert).toHaveBeenCalledTimes(1);
  });

  it('egy dokumentum parse-hibája nem állítja le a többit (hiba-izoláció)', async () => {
    const good = md('good', 'Jó szabály.');
    const bad = 'nincs front matter, csak szöveg';
    const store = fakeStore([]);
    const embed = vi.fn((texts: string[]) =>
      Promise.resolve({ vectors: texts.map(() => [0.1]), usage: { tokens: 1 } }),
    );

    const report = await runIngest({
      readCorpus: () =>
        Promise.resolve<CorpusEntry[]>([
          { source: 'bad', raw: bad },
          { source: 'good', raw: good },
        ]),
      embed,
      store,
    });

    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]!.source).toBe('bad');
    expect(store.insert).toHaveBeenCalledTimes(1); // a 'good' beírt
  });
});
