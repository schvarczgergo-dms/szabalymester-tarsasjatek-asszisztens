import { describe, expect, it, vi } from 'vitest';
import { EmbedError, checkEmbeddingDimensions, embedTexts, type EmbedBatchFn } from './embed';

/** Determinisztikus fake embedder: minden szöveghez azonos hosszú vektort ad, a usage a darabszámmal arányos. */
const fakeBatch =
  (dim: number): EmbedBatchFn =>
  (values) =>
    Promise.resolve({
      embeddings: values.map((_, i) => Array.from({ length: dim }, () => i)),
      usage: { tokens: values.length },
    });

describe('embedTexts', () => {
  it('≤100-as batchekre bont: 250 szöveg → 3 hívás (100+100+50)', async () => {
    const spy = vi.fn(fakeBatch(4));
    const texts = Array.from({ length: 250 }, (_, i) => `t${i}`);

    const { vectors } = await embedTexts(texts, { embedBatch: spy, dimensions: 4 });

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls[0]![0]).toHaveLength(100);
    expect(spy.mock.calls[1]![0]).toHaveLength(100);
    expect(spy.mock.calls[2]![0]).toHaveLength(50);
    expect(vectors).toHaveLength(250);
  });

  it('a kimeneti vektorok sorrendje = a bemeneti sorrend', async () => {
    // A fake az adott batchen belüli indexet írja a vektorba; a globális sorrend a batchelés után is stabil.
    const batch: EmbedBatchFn = (values) =>
      Promise.resolve({ embeddings: values.map((v) => [Number(v)]), usage: { tokens: 0 } });
    const texts = ['0', '1', '2', '3'];

    const { vectors } = await embedTexts(texts, { embedBatch: batch, dimensions: 1, batchSize: 2 });

    expect(vectors).toEqual([[0], [1], [2], [3]]);
  });

  it('aggregálja a usage token-számot a batchek között', async () => {
    const { usage } = await embedTexts(['a', 'b', 'c'], {
      embedBatch: fakeBatch(2),
      dimensions: 2,
      batchSize: 2,
    });
    expect(usage.tokens).toBe(3); // 2 + 1
  });

  it('üres bemenet → üres kimenet, 0 hívás', async () => {
    const spy = vi.fn(fakeBatch(4));
    const { vectors, usage } = await embedTexts([], { embedBatch: spy, dimensions: 4 });
    expect(vectors).toEqual([]);
    expect(usage.tokens).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('érvénytelen batch-méret (0) beszédes hibát dob, nem fut végtelen ciklusba', async () => {
    await expect(
      embedTexts(['x'], { embedBatch: fakeBatch(4), dimensions: 4, batchSize: 0 }),
    ).rejects.toThrow(EmbedError);
  });

  it('dimenzió-guard: a várttól eltérő hosszú vektor beszédes hibát dob', async () => {
    const badBatch: EmbedBatchFn = (values) =>
      Promise.resolve({ embeddings: values.map(() => [0, 0, 0]), usage: { tokens: 0 } });

    await expect(embedTexts(['x'], { embedBatch: badBatch, dimensions: 1536 })).rejects.toThrow(
      EmbedError,
    );
  });
});

describe('checkEmbeddingDimensions', () => {
  it('a séma dimenziójával egyező konfiguráció átmegy', () => {
    expect(() => checkEmbeddingDimensions(1536, 1536)).not.toThrow();
  });

  it('eltérő konfigurált dimenzió fail-fast hibát ad (AD-3)', () => {
    expect(() => checkEmbeddingDimensions(3072, 1536)).toThrow(EmbedError);
  });
});
