import { describe, expect, it } from 'vitest';
import { formatAnswer, formatDocumentList, formatSearchResult, parseCliArgs } from './cli';
import type { AgentAnswer } from './agent/agent';
import { emptyTraceEntry, type RetrievedSourceRecord } from './agent/tool-outcome';
import type { DocumentSummary, SearchHit } from './rag/store';

describe('parseCliArgs', () => {
  it('ask + idézőjeles kérdés', () => {
    expect(parseCliArgs(['ask', 'Catanban mi történik, ha 7-est dobok?'])).toEqual({
      command: 'ask',
      question: 'Catanban mi történik, ha 7-est dobok?',
    });
  });

  it('ask + több szavas (nem idézőjeles) kérdés összefűzve', () => {
    expect(parseCliArgs(['ask', 'mi', 'történik', 'ha', '7-est', 'dobok'])).toEqual({
      command: 'ask',
      question: 'mi történik ha 7-est dobok',
    });
  });

  it('argumentum nélkül → help', () => {
    expect(parseCliArgs([]).command).toBe('help');
    expect(parseCliArgs(['help']).command).toBe('help');
  });

  it('ask kérdés nélkül → error', () => {
    expect(parseCliArgs(['ask']).command).toBe('error');
    expect(parseCliArgs(['ask', '   ']).command).toBe('error');
  });

  it('ismeretlen parancs → error', () => {
    const r = parseCliArgs(['foo']);
    expect(r.command).toBe('error');
  });

  it('debug:sources', () => {
    expect(parseCliArgs(['debug:sources'])).toEqual({ command: 'debug:sources' });
  });

  it('debug:search --full flaggel és kérdéssel', () => {
    expect(parseCliArgs(['debug:search', '7-est', 'dobok', '--full'])).toEqual({
      command: 'debug:search',
      question: '7-est dobok',
      full: true,
    });
  });

  it('debug:search --full nélkül (nyers)', () => {
    const r = parseCliArgs(['debug:search', 'kérdés']);
    expect(r).toEqual({ command: 'debug:search', question: 'kérdés', full: false });
  });

  it('debug:search kérdés nélkül → error', () => {
    expect(parseCliArgs(['debug:search', '--full']).command).toBe('error');
  });
});

const doc = (game: string, section: string, chunkCount: number): DocumentSummary => ({
  source: `s-${game}`,
  title: `${game} – ${section}`,
  game,
  section,
  chunkCount,
  status: 'active',
});

const shit = (game: string, distance: number): SearchHit => ({
  content: 'x',
  heading: null,
  chunkIndex: 0,
  source: `https://ex/${game}`,
  game,
  section: 'jatekmenet',
  distance,
});

describe('formatDocumentList', () => {
  it('felsorolja a dokumentumokat chunk-számmal és státusszal', () => {
    const out = formatDocumentList([doc('Catan', 'jatekmenet', 5)]);
    expect(out).toContain('Catan · jatekmenet');
    expect(out).toContain('5 chunk');
    expect(out).toContain('[active]');
  });

  it('üres tudásbázis', () => {
    expect(formatDocumentList([])).toMatch(/üres/i);
  });
});

describe('formatSearchResult', () => {
  it('nyers: találatok távolsággal', () => {
    const out = formatSearchResult('NYERS', [shit('Catan', 0.21)]);
    expect(out).toContain('NYERS');
    expect(out).toContain('Catan · jatekmenet');
    expect(out).toContain('0.210');
  });

  it('teljes: a trace-t is kiírja (HyDE, rerank-pontok)', () => {
    const out = formatSearchResult('TELJES', [shit('Azul', 0.19)], {
      hydeText: 'hipotetikus válasz',
      hydeFallback: false,
      distances: [0.19],
      rerankScores: [9, 5],
      rerankFallback: false,
      contextChars: 100,
      empty: false,
      usage: { tokens: 12 },
    });
    expect(out).toMatch(/hyde/i);
    expect(out).toContain('hipotetikus válasz');
    expect(out).toContain('9, 5');
    expect(out).toContain('100 karakter');
  });
});

const source = (game: string, section: string, url: string): RetrievedSourceRecord => ({
  source: url,
  game,
  section,
  heading: null,
});

const answer = (text: string, sources: RetrievedSourceRecord[]): AgentAnswer => ({
  answer: text,
  reports: [{ status: 'ok', content: 'x', report: { ...emptyTraceEntry('q'), sources } }],
  usage: { tokens: 0 },
});

describe('formatAnswer', () => {
  it('kiírja a választ és a forrásokat (játék · szakasz · URL)', () => {
    const out = formatAnswer(
      answer('A rablót lépteted.', [source('Catan', 'jatekmenet', 'https://ex/catan#jatekmenet')]),
    );
    expect(out).toContain('A rablót lépteted.');
    expect(out).toMatch(/források/i);
    expect(out).toContain('Catan · jatekmenet');
    expect(out).toContain('https://ex/catan#jatekmenet');
  });

  it('a forrásokat egyedizi', () => {
    const s = source('Catan', 'jatekmenet', 'https://ex/catan#jatekmenet');
    const out = formatAnswer(answer('szöveg', [s, s]));
    expect(out.match(/Catan · jatekmenet/g)).toHaveLength(1);
  });

  it('források nélkül csak a választ adja', () => {
    const out = formatAnswer(answer('Erről nincs információm a tudásbázisban.', []));
    expect(out).toContain('nincs információm');
    expect(out).not.toMatch(/források/i);
  });
});
