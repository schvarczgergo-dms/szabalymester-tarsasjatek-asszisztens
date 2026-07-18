import { describe, expect, it } from 'vitest';
import { goldInTopK, goldRank, reordered, type HitMeta } from './evaluate';

const h = (game: string, section: string, distance = 0.2): HitMeta => ({ game, section, distance });
const gold = { game: 'Catan', section: 'jatekmenet' };

describe('goldInTopK', () => {
  it('igaz, ha a gold a top-k-ban van', () => {
    const hits = [h('Azul', 'jatekmenet'), h('Catan', 'jatekmenet')];
    expect(goldInTopK(gold, hits, 5)).toBe(true);
    expect(goldInTopK(gold, hits, 1)).toBe(false); // csak a top-1-ben nézve nincs ott
  });

  it('hamis, ha a gold nincs a listában', () => {
    expect(goldInTopK(gold, [h('Azul', 'jatekmenet')], 5)).toBe(false);
  });
});

describe('goldRank', () => {
  it('1-alapú rang, −1 ha nincs', () => {
    expect(goldRank(gold, [h('Azul', 'jatekmenet'), h('Catan', 'jatekmenet')])).toBe(2);
    expect(goldRank(gold, [h('Azul', 'jatekmenet')])).toBe(-1);
  });
});

describe('reordered', () => {
  it('igaz, ha a top-1 más a nyers és a teljes között', () => {
    const raw = [h('7 Wonders', 'jatekmenet')];
    const full = [h('Catan', 'jatekmenet')];
    expect(reordered(raw, full)).toBe(true);
  });

  it('hamis, ha a top-1 ugyanaz', () => {
    const raw = [h('Catan', 'jatekmenet', 0.5)];
    const full = [h('Catan', 'jatekmenet', 0.2)];
    expect(reordered(raw, full)).toBe(false);
  });
});
