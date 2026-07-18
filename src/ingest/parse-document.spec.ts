import { describe, expect, it } from 'vitest';
import { ParseError, contentHash, normalize, parseDocument } from './parse-document';

const validDoc = `---
title: Catan – Előkészület
game: Catan (A telepesek)
source: https://example.com/catan.pdf
section: elokeszules
---

# Előkészület

Keverd meg a lapokat.
`;

describe('parseDocument', () => {
  it('érvényes dokumentumot beolvas', () => {
    const doc = parseDocument(validDoc);
    expect(doc.frontMatter.title).toBe('Catan – Előkészület');
    expect(doc.frontMatter.game).toBe('Catan (A telepesek)');
    expect(doc.frontMatter.source).toBe('https://example.com/catan.pdf');
    expect(doc.frontMatter.section).toBe('elokeszules');
    expect(doc.body).toContain('Keverd meg a lapokat.');
    expect(doc.body).not.toContain('title:');
  });

  it('hiányzó front matterre ParseError', () => {
    expect(() => parseDocument('# Csak törzs\n')).toThrowError(ParseError);
  });

  it('hiányzó kötelező mezőre ParseError a mező nevével', () => {
    const noGame = validDoc.replace('game: Catan (A telepesek)\n', '');
    expect(() => parseDocument(noGame)).toThrowError(/game/);
  });

  it('érvénytelen section-re ParseError a mező nevével', () => {
    const badSection = validDoc.replace('section: elokeszules', 'section: rossz-ertek');
    expect(() => parseDocument(badSection)).toThrowError(ParseError);
    expect(() => parseDocument(badSection)).toThrowError(/section/);
  });

  it('a section soron lévő inline kommentet levágja', () => {
    const withComment = validDoc.replace(
      'section: elokeszules',
      'section: elokeszules   # attekintes | elokeszules | jatekmenet',
    );
    expect(parseDocument(withComment).frontMatter.section).toBe('elokeszules');
  });

  it('üres törzsre (csak front matter) ParseError', () => {
    expect(() =>
      parseDocument('---\ntitle: x\ngame: y\nsource: s\nsection: gyik\n---\n'),
    ).toThrowError(ParseError);
  });
});

describe('normalize', () => {
  const wrap = (body: string) => `---\ntitle: x\ngame: y\nsource: s\nsection: gyik\n---\n\n${body}`;

  it('CRLF-et LF-re cserél', () => {
    expect(
      normalize(
        '---\r\ntitle: x\r\ngame: y\r\nsource: s\r\nsection: gyik\r\n---\r\n\r\nA\r\nB\r\n',
      ),
    ).toBe('A\nB');
  });

  it('a soronkénti trailing whitespace-t levágja', () => {
    expect(normalize(wrap('Sor egy   \nSor kettő\t\n'))).toBe('Sor egy\nSor kettő');
  });

  it('a 3+ üres sort egyre vonja össze', () => {
    expect(normalize(wrap('A\n\n\n\nB\n'))).toBe('A\n\nB');
  });

  it('a zaj-sorokat (©, kiadói URL, csak-kép) kiszűri', () => {
    const out = normalize(
      wrap(
        'Szabály.\n© 2020 Kiadó\nMinden jog fenntartva.\nwww.gemklub.hu\n![kép](kep.png)\nVége.\n',
      ),
    );
    expect(out).toContain('Szabály.');
    expect(out).toContain('Vége.');
    expect(out).not.toContain('©');
    expect(out).not.toContain('gemklub');
    expect(out).not.toContain('![kép]');
  });

  it('NEM kisbetűsít', () => {
    expect(normalize(wrap('Catan RABLÓ Város\n'))).toBe('Catan RABLÓ Város');
  });

  it('determinisztikus', () => {
    expect(normalize(validDoc)).toBe(normalize(validDoc));
  });

  it('a két kép közti szöveget megtartja (non-greedy kép-szűrés)', () => {
    expect(normalize(wrap('![a](x.png) Dobj a kockával ![b](y.png)\n'))).toContain(
      'Dobj a kockával',
    );
  });
});

describe('contentHash', () => {
  it('whitespace-változásra stabil, tartalomváltozásra nem', () => {
    const base = contentHash(normalize(validDoc));
    const withWs = contentHash(
      normalize(validDoc.replace('Keverd meg a lapokat.', 'Keverd meg a lapokat.   ')),
    );
    expect(withWs).toBe(base);
    const changed = contentHash(
      normalize(validDoc.replace('Keverd meg a lapokat.', 'Keverd meg 2 lapot.')),
    );
    expect(changed).not.toBe(base);
  });

  it('kiadói-sor hozzáadására a hash nem változik', () => {
    const base = contentHash(normalize(validDoc));
    const withNoise = contentHash(
      normalize(validDoc.replace('Keverd meg a lapokat.', 'Keverd meg a lapokat.\n© 2020 Kiadó')),
    );
    expect(withNoise).toBe(base);
  });
});
