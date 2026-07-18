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
const BULLET_RE = /^\s*[-*]\s/;

/** Üres sorok mentén blokkokra bont; egy blokk lista, ha MINDEN nem-üres sora lista-sor. */
function blockify(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];
  const flush = (): void => {
    const text = buffer.join('\n').trim();
    if (text !== '') {
      const nonEmpty = buffer.filter((line) => line.trim() !== '');
      // Lista, ha MINDEN nem-üres sora lista-sor ÉS (több soros VAGY felsorolásjeles) — így az
      // egysoros, számmal+ponttal kezdődő próza ("2024. óta…") nem minősül tévesen listának.
      const isList =
        nonEmpty.length > 0 &&
        nonEmpty.every((line) => LIST_LINE_RE.test(line)) &&
        (nonEmpty.length >= 2 || BULLET_RE.test(nonEmpty[0] ?? ''));
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

/** A törzset a `##`/`###` alcímek mentén szakaszokra bontja, breadcrumb-bal. A H2/H3 külön
 *  slot: a `###` a legutóbbi `##` alá fészkel; `##` nélküli testvér-`###`-ek nem ágyazódnak. */
function splitIntoSections(body: string): DocSection[] {
  const sections: DocSection[] = [];
  let h2 = '';
  let h3 = '';
  let lines: string[] = [];
  const breadcrumb = (): string => [h2, h3].filter((s) => s !== '').join(' > ');
  const push = (crumb: string): void => {
    const blocks = blockify(lines);
    if (blocks.length > 0) sections.push({ breadcrumb: crumb, blocks });
    lines = [];
  };
  for (const line of body.split('\n')) {
    const match = HEADING_RE.exec(line);
    if (match) {
      push(breadcrumb()); // az eddigi sorok a heading ELŐTTI breadcrumbhoz tartoznak
      const level = (match[1] ?? '').length;
      const title = (match[2] ?? '').trim();
      if (level === 2) {
        h2 = title;
        h3 = '';
      } else {
        h3 = title;
      }
    } else {
      lines.push(line);
    }
  }
  push(breadcrumb());
  return sections;
}

/** Utolsó mentsvár: szóhatáron `max` alá tördel (ha egy mondat maga hosszabb `max`-nál). */
function hardSplit(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const pieces: string[] = [];
  let buffer = '';
  for (const word of text.split(/\s+/)) {
    if (word === '') continue;
    if (buffer !== '' && buffer.length + 1 + word.length > max) {
      pieces.push(buffer);
      buffer = word;
    } else {
      buffer = buffer === '' ? word : `${buffer} ${word}`;
    }
  }
  if (buffer !== '') pieces.push(buffer);
  return pieces.length > 0 ? pieces : [text];
}

/** Hosszú bekezdést mondathatáron (`.!?`) darabol, `max` alá csomagolva — tartalomvesztés
 *  nélkül (a `split` mindent megtart), és garantáltan `<= max` (szóhatár-fallback). */
function splitSentences(text: string, max: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const packed: string[] = [];
  let buffer = '';
  for (const sentence of sentences) {
    if (sentence === '') continue;
    if (buffer !== '' && buffer.length + 1 + sentence.length > max) {
      packed.push(buffer);
      buffer = sentence;
    } else {
      buffer = buffer === '' ? sentence : `${buffer} ${sentence}`;
    }
  }
  if (buffer !== '') packed.push(buffer);
  return packed.flatMap((piece) => hardSplit(piece, max));
}

/** Egy szakasz blokkjait chunk-szövegekké csomagolja: lista atomi; hosszú bekezdés mondathatáron;
 *  szakaszon belüli átfedés az utolsó bekezdéssel — de a chunk sosem lépi túl `max`-ot. */
function packBlocks(blocks: Block[], target: number, max: number): string[] {
  const out: string[] = [];
  let current: Block[] = [];
  const currentLen = (): number =>
    current.reduce((n, b) => n + b.text.length, 0) + Math.max(0, current.length - 1) * 2;
  const flush = (): void => {
    if (current.length > 0) out.push(current.map((b) => b.text).join('\n\n'));
  };
  const lastParagraph = (): Block | undefined => [...current].reverse().find((b) => !b.isList);

  for (const block of blocks) {
    if (block.isList) {
      flush();
      out.push(block.text); // a lista saját, atomi chunk (akár max felett)
      current = [];
      continue;
    }
    if (block.text.length > max) {
      flush();
      current = [];
      for (const piece of splitSentences(block.text, max)) out.push(piece);
      continue;
    }
    if (current.length === 0) {
      current = [block];
      continue;
    }
    if (currentLen() + 2 + block.text.length <= target) {
      current.push(block);
      continue;
    }
    // Új chunk kell: az átfedő bekezdést CSAK akkor visszük át, ha a párja belefér `max`-ba.
    const overlap = lastParagraph();
    flush();
    current =
      overlap && overlap.text.length + 2 + block.text.length <= max ? [overlap, block] : [block];
  }
  flush();
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
