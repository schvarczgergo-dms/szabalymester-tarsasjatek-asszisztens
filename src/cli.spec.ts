import { describe, expect, it } from 'vitest';
import { formatAnswer, parseCliArgs } from './cli';
import type { AgentAnswer } from './agent/agent';
import { emptyTraceEntry, type RetrievedSourceRecord } from './agent/tool-outcome';

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
