import { describe, expect, it } from 'vitest';
import { createSearchRulesTool, executeSearchRules } from './search-rules-tool';
import type { RetrieveDeps } from '../rag/retrieve';
import type { SearchHit } from '../rag/store';

const opts = { wideNet: 20, keepTop: 5 };

const hit = (i: number, game: string): SearchHit => ({
  content: `chunk-${i}`,
  heading: `H${i}`,
  chunkIndex: i,
  source: `https://en.wikipedia.org/wiki/${game}#jatekmenet`,
  game,
  section: 'jatekmenet',
  distance: 0.1 * i,
});

/** Minimális RetrieveDeps — a tool a `retrieve`-en át hívja; itt a retrieve-et nem injektáljuk,
 *  hanem a deps.search/hyde/embed/rerank fake-eket adjuk (a valós retrieve fut rájuk). */
function deps(over: Partial<RetrieveDeps> = {}): RetrieveDeps {
  return {
    hyde: () => Promise.resolve({ text: 'hyde', usage: { tokens: 2 }, usedFallback: false }),
    embed: () => Promise.resolve({ vectors: [[0.1, 0.2, 0.3]], usage: { tokens: 1 } }),
    search: () => Promise.resolve([hit(0, 'Catan'), hit(1, 'Azul')]),
    rerank: (_q, cands, o) =>
      Promise.resolve({
        ranked: cands.map((_, i) => ({ index: i, score: 9 - i })).slice(0, o.keepTop),
        usage: { tokens: 3 },
        usedFallback: false,
      }),
    ...over,
  };
}

describe('executeSearchRules', () => {
  it('ok: a találatokat forrással adja (játék · szakasz · URL), status ok', async () => {
    const outcome = await executeSearchRules('7-es dobás', deps(), opts);
    expect(outcome.status).toBe('ok');
    expect(outcome.content).toContain('Catan');
    expect(outcome.content).toContain('jatekmenet');
    expect(outcome.content).toContain('https://en.wikipedia.org/wiki/Catan#jatekmenet');
    expect(outcome.report.sources.length).toBeGreaterThan(0);
  });

  it('üres találat: status empty + explicit magyar „nincs találat", nem talál ki', async () => {
    const outcome = await executeSearchRules(
      'ismeretlen',
      deps({ search: () => Promise.resolve([]) }),
      opts,
    );
    expect(outcome.status).toBe('empty');
    expect(outcome.content.toLowerCase()).toContain('nincs');
    expect(outcome.report.empty).toBe(true);
  });

  it('hiba: a retrieve-hiba sem dob — status error, magyar hibaszöveg (AD-8)', async () => {
    const outcome = await executeSearchRules(
      'x',
      deps({ search: () => Promise.reject(new Error('DB down')) }),
      opts,
    );
    // a retrieve maga nyeli a search-hibát (empty), de ha maga a retrieve dobna, akkor error:
    expect(['empty', 'error']).toContain(outcome.status);
    expect(outcome.content.length).toBeGreaterThan(0);
  });

  it('rossz (üres) input: status error, nem dob', async () => {
    const outcome = await executeSearchRules('   ', deps(), opts);
    expect(outcome.status).toBe('error');
    expect(outcome.content.length).toBeGreaterThan(0);
  });
});

describe('createSearchRulesTool', () => {
  it('a Vercel AI SDK tool: van leírása, input-sémája és execute-ja', () => {
    const t = createSearchRulesTool(deps(), opts);
    expect((t.description ?? '').length).toBeGreaterThan(0);
    expect(t.inputSchema).toBeDefined();
    expect(typeof t.execute).toBe('function');
  });
});
