import { describe, expect, it, vi } from 'vitest';
import { retrieve, type RetrieveDeps } from './retrieve';
import type { SearchHit } from './store';
import type { HydeResult } from './hyde';
import type { RerankResult } from './rerank';

const q = 'Mi történik, ha 7-est dobok?';

const hit = (i: number, game: string, section: string): SearchHit => ({
  content: `chunk-${i}`,
  heading: `H${i}`,
  chunkIndex: i,
  source: `s${i}`,
  game,
  section,
  distance: 0.1 * i,
});

const okHyde = (): Promise<HydeResult> =>
  Promise.resolve({ text: 'hipotetikus válasz', usage: { tokens: 5 }, usedFallback: false });

const okEmbed = () => Promise.resolve({ vectors: [[0.1, 0.2, 0.3]], usage: { tokens: 1 } });

function deps(over: Partial<RetrieveDeps> = {}): RetrieveDeps {
  return {
    hyde: okHyde,
    embed: okEmbed,
    search: () =>
      Promise.resolve([
        hit(0, 'Catan', 'jatekmenet'),
        hit(1, 'Catan', 'pontozas'),
        hit(2, 'Azul', 'jatekmenet'),
      ]),
    rerank: (_q, cands, opts): Promise<RerankResult> =>
      Promise.resolve({
        ranked: [
          { index: 2, score: 9 },
          { index: 0, score: 5 },
          { index: 1, score: 1 },
        ].slice(0, opts.keepTop),
        usage: { tokens: 3 },
        usedFallback: false,
      }),
    ...over,
  };
}

describe('retrieve', () => {
  it('teljes út: HyDE → embed → tág háló → rerank → top-K, forrásokkal és trace-szel', async () => {
    const result = await retrieve(q, deps(), { wideNet: 20, keepTop: 3 });

    expect(result.empty).toBe(false);
    expect(result.sources.map((s) => s.source)).toEqual(['s2', 's0', 's1']);
    expect(result.context).toContain('chunk-2');
    expect(result.trace.hydeText).toBe('hipotetikus válasz');
    expect(result.trace.hydeFallback).toBe(false);
    expect(result.trace.distances).toHaveLength(3);
    expect(result.trace.rerankScores).toEqual([9, 5, 1]);
    expect(result.trace.contextChars).toBeGreaterThan(0);
    expect(result.trace.usage.tokens).toBe(9); // HyDE 5 + embed 1 + rerank 3 (AD-11)
  });

  it('keepTop levágás a végső kontextusra', async () => {
    const result = await retrieve(q, deps(), { wideNet: 20, keepTop: 2 });
    expect(result.sources).toHaveLength(2);
    expect(result.sources.map((s) => s.source)).toEqual(['s2', 's0']);
  });

  it('üres tág háló → empty=true, a rerank kihagyva', async () => {
    const rerank = vi.fn();
    const result = await retrieve(q, deps({ search: () => Promise.resolve([]), rerank }), {
      wideNet: 20,
      keepTop: 5,
    });

    expect(result.empty).toBe(true);
    expect(result.sources).toEqual([]);
    expect(rerank).not.toHaveBeenCalled();
    expect(result.trace.empty).toBe(true);
  });

  it('HyDE-fallback tükröződik a trace-ben', async () => {
    const hyde = (): Promise<HydeResult> =>
      Promise.resolve({ text: q, usage: { tokens: 0 }, usedFallback: true });
    const result = await retrieve(q, deps({ hyde }), { wideNet: 20, keepTop: 3 });
    expect(result.trace.hydeFallback).toBe(true);
  });

  it('a retrieve SOHA nem dob: search-hiba → graceful empty (AD-2)', async () => {
    const result = await retrieve(q, deps({ search: () => Promise.reject(new Error('DB down')) }), {
      wideNet: 20,
      keepTop: 5,
    });
    expect(result.empty).toBe(true);
    expect(result.sources).toEqual([]);
  });

  it('a retrieve SOHA nem dob: embed-hiba → graceful empty (AD-2)', async () => {
    const result = await retrieve(
      q,
      deps({ embed: () => Promise.reject(new Error('embed down')) }),
      {
        wideNet: 20,
        keepTop: 5,
      },
    );
    expect(result.empty).toBe(true);
  });
});
