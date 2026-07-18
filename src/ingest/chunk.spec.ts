import { describe, expect, it } from 'vitest';
import { chunkDocument } from './chunk';
import type { ParsedDocument } from './parse-document';

const doc = (body: string, game = 'Catan'): ParsedDocument => ({
  frontMatter: { title: 't', game, source: 's', section: 'jatekmenet' },
  body,
});

describe('chunkDocument', () => {
  it('rövid dokumentum egyetlen chunk', () => {
    const chunks = chunkDocument(doc('Rövid szabály.'));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[0]!.content).toContain('Rövid szabály.');
  });

  it('minden chunk a játéknév-fejléccel kezdődik + breadcrumb', () => {
    const chunks = chunkDocument(doc('## Építkezés\n\nSzabály.'), { dwarfChars: 0 });
    expect(chunks[0]!.content.startsWith('Catan')).toBe(true);
    expect(chunks[0]!.content).toContain('Catan > Építkezés');
    expect(chunks[0]!.heading).toBe('Építkezés');
  });

  it('alcímnél új chunk, a breadcrumb a heading-ben', () => {
    const chunks = chunkDocument(doc('## Egy\n\nAAAA.\n\n## Kettő\n\nBBBB.'), { dwarfChars: 0 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.heading).toBe('Egy');
    expect(chunks[1]!.heading).toBe('Kettő');
  });

  it('a ### alcím breadcrumbja tartalmazza a szülőt', () => {
    const chunks = chunkDocument(doc('## Építkezés\n\n### Város\n\nVárost építesz.'), {
      dwarfChars: 0,
    });
    expect(chunks.at(-1)!.heading).toBe('Építkezés > Város');
  });

  it('a lista nem vágódik ketté (atomi, akár a korlát felett)', () => {
    const chunks = chunkDocument(doc('## Lépések\n\n1. Egy\n2. Kettő\n3. Három'), {
      dwarfChars: 0,
      maxChars: 5,
    });
    const listChunk = chunks.find((c) => c.content.includes('Egy'))!;
    expect(listChunk.content).toContain('Kettő');
    expect(listChunk.content).toContain('Három');
  });

  it('a törpe-szakasz összevonódik a következővel', () => {
    const long = 'Hosszabb szakasz szövege. '.repeat(15);
    const chunks = chunkDocument(doc(`## Törpe\n\nX.\n\n## Nagy\n\n${long}`));
    const dwarfChunk = chunks.find((c) => c.content.includes('X.'))!;
    expect(dwarfChunk.heading).toBe('Nagy');
    expect(chunks.every((c) => c.heading !== 'Törpe')).toBe(true);
  });

  it('szakaszon belüli átfedés; szakasz-határon nincs', () => {
    const within = chunkDocument(doc('## S\n\nP1P1P1.\n\nP2P2P2.\n\nP3P3P3.'), {
      dwarfChars: 0,
      targetChars: 8,
    });
    expect(within.length).toBeGreaterThan(1);
    expect(within[1]!.content).toContain('P1P1P1.'); // az előző utolsó bekezdése átjön

    const across = chunkDocument(doc('## A\n\nPa.\n\n## B\n\nPb.'), { dwarfChars: 0 });
    const bChunk = across.find((c) => c.heading === 'B')!;
    expect(bChunk.content).not.toContain('Pa.');
  });

  it('hosszú, nem-lista bekezdés mondathatáron vágódik', () => {
    const chunks = chunkDocument(doc('Alfa alfa. Béta béta. Gamma gamma.'), { maxChars: 12 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.content).toContain('Alfa alfa.');
    expect(chunks[0]!.content).not.toContain('Gamma');
  });

  it('a chunkIndex folytonos', () => {
    const chunks = chunkDocument(doc('## A\n\nPa.\n\n## B\n\nPb.\n\n## C\n\nPc.'), {
      dwarfChars: 0,
    });
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it('determinisztikus', () => {
    const body = '## A\n\nPa.\n\n## B\n\n1. Egy\n2. Kettő';
    expect(chunkDocument(doc(body))).toEqual(chunkDocument(doc(body)));
  });
});
