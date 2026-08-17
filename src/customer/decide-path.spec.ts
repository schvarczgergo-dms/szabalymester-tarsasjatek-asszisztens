import { describe, expect, it } from 'vitest';
import { emptyTraceEntry, type ToolOutcome } from '../agent/tool-outcome';
import { decidePath, minDistance, retrievalStatus } from './decide-path';

const outcome = (
  status: ToolOutcome['status'],
  distances: number[] = [],
  game?: string,
): ToolOutcome => ({
  status,
  content: status === 'ok' ? 'találat' : 'nincs',
  report: {
    ...emptyTraceEntry('q'),
    distances,
    empty: status !== 'ok',
    sources:
      game === undefined
        ? []
        : [{ source: `https://ex/${game}`, game, section: 'jatekmenet', heading: null }],
  },
});

describe('decidePath', () => {
  it('grounded találat → auto', () => {
    expect(decidePath([outcome('ok', [0.2])])).toEqual({ path: 'auto' });
  });

  it('a kérdés játéka egyezik a chunkkal → auto', () => {
    expect(decidePath([outcome('ok', [0.2], 'Catan')], 'Catanban mi történik, ha 7-est dobok?')).toEqual({
      path: 'auto',
    });
  });

  it('más játék chunkja a kérdéshez → eszkaláció (game_mismatch)', () => {
    expect(
      decidePath([outcome('ok', [0.2], 'Catan')], 'Hogyan kell játszani a Gloomhavennel?'),
    ).toEqual({ path: 'escalate', reason: 'game_mismatch' });
  });

  it('Catan-kérdés Carcassonne-chunkkal → game_mismatch', () => {
    expect(decidePath([outcome('ok', [0.18], 'Carcassonne')], 'Catanban mi történik, ha 7-est dobok?')).toEqual({
      path: 'escalate',
      reason: 'game_mismatch',
    });
  });

  it('rövid játéknév (Go) nem szűr tévesen', () => {
    expect(decidePath([outcome('ok', [0.2], 'Go')], 'Hogyan kell játszani?')).toEqual({ path: 'auto' });
  });

  it('üres keresés → eszkaláció (empty_retrieval)', () => {
    expect(decidePath([outcome('empty')])).toEqual({
      path: 'escalate',
      reason: 'empty_retrieval',
    });
  });

  it('keresési hiba → eszkaláció (retrieval_error)', () => {
    expect(decidePath([outcome('error')])).toEqual({
      path: 'escalate',
      reason: 'retrieval_error',
    });
  });

  it('tool-hívás nélkül → eszkaláció (no_search)', () => {
    expect(decidePath([])).toEqual({ path: 'escalate', reason: 'no_search' });
  });

  it('hiba megelőzi a találatot: error + ok → eszkaláció', () => {
    expect(decidePath([outcome('error'), outcome('ok', [0.1])])).toEqual({
      path: 'escalate',
      reason: 'retrieval_error',
    });
  });
});

describe('retrievalStatus', () => {
  it('ok / empty / error / none', () => {
    expect(retrievalStatus([outcome('ok')])).toBe('ok');
    expect(retrievalStatus([outcome('empty')])).toBe('empty');
    expect(retrievalStatus([outcome('error')])).toBe('error');
    expect(retrievalStatus([])).toBe('none');
  });
});

describe('minDistance', () => {
  it('a legkisebb távolságot adja; üres listánál null', () => {
    expect(minDistance([outcome('ok', [0.4, 0.2, 0.9])])).toBe(0.2);
    expect(minDistance([outcome('empty')])).toBeNull();
  });
});
