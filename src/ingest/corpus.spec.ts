import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTIONS, parseDocument } from './parse-document';

/** A korpusz-mappa a repo gyökeréhez képest (a vitest a gyökérből fut). */
const CORPUS_DIR = path.resolve(process.cwd(), 'seed', 'rules');

const files = existsSync(CORPUS_DIR)
  ? readdirSync(CORPUS_DIR).filter((name) => name.endsWith('.md'))
  : [];

const read = (name: string): string => readFileSync(path.join(CORPUS_DIR, name), 'utf8');

describe('korpusz-validátor (seed/rules)', () => {
  // Beszédes jelzés üres korpuszon — NE legyen hamis zöld úgy, hogy nincs adat (Story 1.7 T3).
  it.runIf(files.length === 0)(
    'nincs seed-fájl — a korpusz még nincs feltöltve (ld. seed/README.md)',
    () => {
      expect(files.length).toBe(0);
    },
  );

  it.each(files)('%s valid front matterrel parse-olható', (name) => {
    const doc = parseDocument(read(name));
    expect(doc.frontMatter.title.length).toBeGreaterThan(0);
    expect(doc.frontMatter.game.length).toBeGreaterThan(0);
    expect(doc.frontMatter.source.length).toBeGreaterThan(0);
    expect(SECTIONS).toContain(doc.frontMatter.section);
    expect(doc.body.length).toBeGreaterThan(0);
  });

  it.runIf(files.length > 0)('a source-ok egyediek a korpuszban (AD-10, hash-kulcs)', () => {
    const sources = files.map((name) => parseDocument(read(name)).frontMatter.source);
    expect(new Set(sources).size).toBe(sources.length);
  });
});
