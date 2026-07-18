import { describe, expect, it } from 'vitest';
import { aggregateUsage } from './agent';
import { emptyTraceEntry, type ToolOutcome } from './tool-outcome';

const report = (tokens: number): ToolOutcome => ({
  status: 'ok',
  content: 'x',
  report: { ...emptyTraceEntry('q'), usage: { tokens } },
});

describe('aggregateUsage', () => {
  it('a retrieval-hívások és a válasz-modell tokenjeit összegzi (AD-11)', () => {
    expect(aggregateUsage([report(10), report(5)], 100)).toEqual({ tokens: 115 });
  });

  it('tool-hívás nélkül csak a válasz-modell tokenje', () => {
    expect(aggregateUsage([], 42)).toEqual({ tokens: 42 });
  });
});
