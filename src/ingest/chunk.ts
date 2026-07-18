import type { ParsedDocument } from './parse-document';

/** A keresés atomi egysége. A `content` a játéknév-fejléccel EGYÜTT az embed-bemenet (AD-4). */
export interface Chunk {
  chunkIndex: number;
  heading: string; // breadcrumb a dokumentumon belül ('' ha nincs alcím)
  content: string; // `${game} > ${heading}\n\n${szöveg}` (alcím nélkül `${game}\n\n${szöveg}`)
}

/** Chunkolási paraméterek (kiindulás; a golden set alapján hangolható). */
export interface ChunkOptions {
  targetChars?: number; // ~1000
  maxChars?: number; // ~1500
  dwarfChars?: number; // ~200
}

interface Block {
  text: string;
  isList: boolean;
}

interface DocSection {
  breadcrumb: string;
  blocks: Block[];
}

const HEADING_RE = /^(#{2,3})\s+(.*)$/;
const LIST_LINE_RE = /^\s*([-*]|\d+\.)\s/;

/** Üres sorok mentén blokkokra bont; egy blokk lista, ha MINDEN nem-üres sora lista-sor. */
function blockify(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];
  const flush = (): void => {
    const text = buffer.join('\n').trim();
    if (text !== '') {
      const nonEmpty = buffer.filter((line) => line.trim() !== '');
      const isList = nonEmpty.length > 0 && nonEmpty.every((line) => LIST_LINE_RE.test(line));
      blocks.push({ text, isList });
    }
    buffer = [];
  };
  for (const line of lines) {
    if (line.trim() === '') flush();
    else buffer.push(line);
  }
  flush();
  return blocks;
}

/** A törzset a `##`/`###` alcímek mentén szakaszokra bontja, breadcrumb-bal. */
function splitIntoSections(body: string): DocSection[] {
  const sections: DocSection[] = [];
  const stack: string[] = [];
  let breadcrumb = '';
  let lines: string[] = [];
  const push = (): void => {
    const blocks = blockify(lines);
    if (blocks.length > 0) sections.push({ breadcrumb, blocks });
    lines = [];
  };
  for (const line of body.split('\n')) {
    const match = HEADING_RE.exec(line);
    if (match) {
      push();
      const level = (match[1] ?? '').length;
      const title = (match[2] ?? '').trim();
      if (level === 2) {
        stack.length = 0;
        stack.push(title);
      } else {
        if (stack.length >= 2) stack.length = 1;
        stack.push(title);
      }
      breadcrumb = stack.join(' > ');
    } else {
      lines.push(line);
    }
  }
  push();
  return sections;
}

/** Hosszú bekezdést mondathatáron (`.!?`) darabol, `max` alá csomagolva. */
function splitSentences(text: string, max: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [text];
  const pieces: string[] = [];
  let buffer = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (buffer !== '' && buffer.length + 1 + sentence.length > max) {
      pieces.push(buffer);
      buffer = sentence;
    } else {
      buffer = buffer === '' ? sentence : `${buffer} ${sentence}`;
    }
  }
  if (buffer !== '') pieces.push(buffer);
  return pieces;
}

/** Egy szakasz blokkjait chunk-szövegekké csomagolja (lista atomi; átfedés az utolsó bekezdéssel). */
function packBlocks(blocks: Block[], target: number, max: number): string[] {
  const out: string[] = [];
  let current: Block[] = [];
  const len = (): number =>
    current.reduce((n, b) => n + b.text.length, 0) + (current.length - 1) * 2;

  const emit = (overlap: boolean): void => {
    if (current.length === 0) return;
    out.push(current.map((b) => b.text).join('\n\n'));
    const lastParagraph = [...current].reverse().find((b) => !b.isList);
    current = overlap && lastParagraph ? [lastParagraph] : [];
  };

  for (const block of blocks) {
    if (block.isList) {
      if (current.length > 0) emit(false); // a lista előtt lezárjuk a folyót (átfedés nélkül)
      out.push(block.text); // a lista saját, atomi chunk (akár max felett)
      current = [];
      continue;
    }
    if (block.text.length > max) {
      if (current.length > 0) emit(false);
      for (const piece of splitSentences(block.text, max)) out.push(piece);
      continue;
    }
    if (current.length > 0 && len() + 2 + block.text.length > target) emit(true);
    current.push(block);
  }
  emit(false);
  return out;
}

function formatHeader(game: string, breadcrumb: string): string {
  return breadcrumb === '' ? game : `${game} > ${breadcrumb}`;
}

/**
 * A saját chunking-stratégia: szakasz-alapú darabolás játéknév-fejléccel, lista-integritással,
 * törpe-összevonással és szakaszon belüli átfedéssel. Tiszta, determinisztikus függvény (AD-4).
 */
export function chunkDocument(doc: ParsedDocument, options: ChunkOptions = {}): Chunk[] {
  const target = options.targetChars ?? 1000;
  const max = options.maxChars ?? 1500;
  const dwarf = options.dwarfChars ?? 200;
  const game = doc.frontMatter.game;

  const sections = splitIntoSections(doc.body);
  const chunks: Chunk[] = [];
  let index = 0;
  let carry: Block[] = [];

  sections.forEach((section, i) => {
    const blocks = [...carry, ...section.blocks];
    carry = [];
    const total = blocks.reduce((n, b) => n + b.text.length, 0);
    const isLast = i === sections.length - 1;
    if (total < dwarf && !isLast) {
      carry = blocks; // törpe-szakasz: a következőbe visszük
      return;
    }
    const header = formatHeader(game, section.breadcrumb);
    for (const text of packBlocks(blocks, target, max)) {
      chunks.push({
        chunkIndex: index++,
        heading: section.breadcrumb,
        content: `${header}\n\n${text}`,
      });
    }
  });

  return chunks;
}
