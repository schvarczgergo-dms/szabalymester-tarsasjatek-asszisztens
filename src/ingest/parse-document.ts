import { createHash } from 'node:crypto';
import { z } from 'zod';

/** A szabálykönyv kanonikus szakaszai — egyezik a `db/schema.sql` `section` CHECK-jével. */
export const SECTIONS = ['attekintes', 'elokeszules', 'jatekmenet', 'pontozas', 'gyik'] as const;
export type Section = (typeof SECTIONS)[number];

/** A korpusz-dokumentum front mattere. */
export interface FrontMatter {
  title: string;
  game: string;
  source: string;
  section: Section;
}

/** Egy beolvasott dokumentum: validált front matter + normalizált törzs. */
export interface ParsedDocument {
  frontMatter: FrontMatter;
  body: string;
}

/** Parse-hiba — beszédes, magyar üzenettel, fail-fast (nem áll le némán). */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

const frontMatterSchema = z.object({
  title: z.string().min(1),
  game: z.string().min(1),
  source: z.string().min(1),
  section: z.enum(SECTIONS),
});

/** A vezető `---\n…\n---\n` front matter blokk + a maradék törzs. */
const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/** Determinisztikus zaj-minták (kiadói/jogi sor, kiadói URL); a csak-illusztráció sort külön kezeljük. */
const NOISE_PATTERNS: RegExp[] = [/©/, /minden jog fenntartva/i, /gemklub\.hu/i];

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^!\[.*\]\(.*\)$/.test(trimmed)) return true; // csak-illusztráció sor
  return NOISE_PATTERNS.some((re) => re.test(trimmed));
}

/** A `\r\n`/`\r` sorvégeket `\n`-re alakítja. */
function toLf(raw: string): string {
  return raw.replace(/\r\n?/g, '\n');
}

/** Ha van front matter, a törzset adja vissza; egyébként a teljes szöveget (lenient). */
function stripFrontMatter(lf: string): string {
  const match = FRONT_MATTER_RE.exec(lf);
  return match ? (match[2] ?? '') : lf;
}

/**
 * A hash és a chunker EGYETLEN közös forrása (AD-5): front-matter-strip → zaj-szűrés →
 * `\r\n`→`\n` → soronkénti trailing-WS trim → 3+ üres sor összevonása → záró trim.
 * Kisbetűsítés NÉLKÜL. Tiszta, determinisztikus függvény.
 */
export function normalize(raw: string): string {
  const body = stripFrontMatter(toLf(raw));
  const cleaned = body
    .split('\n')
    .filter((line) => !isNoiseLine(line))
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

/** A normalizált törzs SHA-256 hash-e (hex) — az inkrementális frissítés alapja. */
export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** A front matter blokk `kulcs: érték` sorait objektummá alakítja (dependency-mentes). */
function parseFrontMatterBlock(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      // Idézőjel nélküli értéknél a záró ` # …` inline kommentet levágjuk.
      const comment = value.indexOf(' #');
      if (comment !== -1) value = value.slice(0, comment).trim();
    }
    result[key] = value;
  }
  return result;
}

/**
 * Beolvas és validál egy korpusz-dokumentumot (fail-fast). A front matter kötelező és
 * validált; a törzs a {@link normalize} kimenete.
 *
 * @throws {ParseError} ha hiányzik a front matter, vagy egy mező hiányzik/érvénytelen.
 */
export function parseDocument(raw: string): ParsedDocument {
  const lf = toLf(raw);
  const match = FRONT_MATTER_RE.exec(lf);
  if (!match) {
    throw new ParseError('Hiányzó front matter — a dokumentum nem `---` blokkal kezdődik.');
  }

  const parsed = frontMatterSchema.safeParse(parseFrontMatterBlock(match[1] ?? ''));
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(gyökér)'}: ${issue.message}`)
      .join('; ');
    throw new ParseError(`Érvénytelen front matter: ${fields}`);
  }

  return { frontMatter: parsed.data, body: normalize(raw) };
}
