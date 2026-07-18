import { describe, expect, it, vi } from 'vitest';
import { generateHyde, type HydeGenerateFn } from './hyde';

const q = 'Catanban mi történik, ha 7-est dobok?';

describe('generateHyde', () => {
  it('a generált magyar hipotetikus választ adja vissza (nem fallback)', async () => {
    const generate: HydeGenerateFn = () =>
      Promise.resolve({ text: 'Ha 7-est dobsz, a rablót lépteted...', usage: { tokens: 42 } });

    const result = await generateHyde(q, { generate });

    expect(result.text).toContain('rablót');
    expect(result.usedFallback).toBe(false);
    expect(result.usage.tokens).toBe(42);
  });

  it('hiba esetén az EREDETI kérdésre esik vissza, nem dob (AD-2)', async () => {
    const generate = vi.fn<HydeGenerateFn>(() => Promise.reject(new Error('provider down')));

    const result = await generateHyde(q, { generate });

    expect(result.text).toBe(q);
    expect(result.usedFallback).toBe(true);
    expect(result.usage.tokens).toBe(0);
  });

  it('üres/whitespace kimenet → fallback az eredeti kérdésre', async () => {
    const generate: HydeGenerateFn = () => Promise.resolve({ text: '   ', usage: { tokens: 3 } });

    const result = await generateHyde(q, { generate });

    expect(result.text).toBe(q);
    expect(result.usedFallback).toBe(true);
  });
});
