import { describe, expect, it, vi } from 'vitest';
import { rerankChunks, type RerankGenerateFn } from './rerank';

const q = 'Mi történik, ha 7-est dobok?';
const candidates = ['általános kockadobás', 'a rabló mozgatása 7-esnél', 'építkezés'];

describe('rerankChunks', () => {
  it('a rerank-pontok szerint átrendez (a legrelevánsabb elöl)', async () => {
    const generate: RerankGenerateFn = () =>
      Promise.resolve({
        object: {
          scores: [
            { index: 0, score: 2 },
            { index: 1, score: 9 },
            { index: 2, score: 1 },
          ],
        },
        usage: { tokens: 30 },
      });

    const result = await rerankChunks(q, candidates, { generate });

    expect(result.ranked.map((r) => r.index)).toEqual([1, 0, 2]);
    expect(result.usedFallback).toBe(false);
    expect(result.usage.tokens).toBe(30);
  });

  it('keepTop levágás', async () => {
    const generate: RerankGenerateFn = () =>
      Promise.resolve({
        object: {
          scores: [
            { index: 2, score: 8 },
            { index: 0, score: 5 },
            { index: 1, score: 1 },
          ],
        },
        usage: { tokens: 10 },
      });

    const result = await rerankChunks(q, candidates, { generate }, { keepTop: 2 });

    expect(result.ranked).toHaveLength(2);
    expect(result.ranked.map((r) => r.index)).toEqual([2, 0]);
  });

  it('érvénytelen LLM-kimenet → vektorsorrend-fallback (score -1), nem dob', async () => {
    const generate: RerankGenerateFn = () =>
      Promise.resolve({ object: { valami: 'rossz' }, usage: { tokens: 7 } });

    const result = await rerankChunks(q, candidates, { generate });

    expect(result.usedFallback).toBe(true);
    expect(result.ranked.map((r) => r.index)).toEqual([0, 1, 2]);
    expect(result.ranked.every((r) => r.score === -1)).toBe(true);
    expect(result.usage.tokens).toBe(7); // a hívás usage-e megőrizve a validációs fallbacken (AD-11)
  });

  it('hiba esetén → vektorsorrend-fallback, nem dob (AD-2)', async () => {
    const generate = vi.fn<RerankGenerateFn>(() => Promise.reject(new Error('rerank down')));

    const result = await rerankChunks(q, candidates, { generate }, { keepTop: 2 });

    expect(result.usedFallback).toBe(true);
    expect(result.ranked.map((r) => r.index)).toEqual([0, 1]);
  });
});
