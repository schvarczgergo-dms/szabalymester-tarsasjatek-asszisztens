import { describe, expect, it } from 'vitest';
import { CLOUD_PRICES_USD_PER_MTOKEN, LOCAL_PRICES_USD_PER_MTOKEN, estimateCostUsd } from './cost';

describe('estimateCostUsd', () => {
  it('lokális módban minden ingyenes', () => {
    expect(estimateCostUsd({ embedding: 28518, answer: 8000 }, LOCAL_PRICES_USD_PER_MTOKEN)).toBe(
      0,
    );
  });

  it('felhő módban a szerepenkénti tokent az ár-táblával aggregálja', () => {
    // 1M válasz-token * 9 USD/1M = 9 USD; 1M embedding * 0.02 = 0.02 USD
    const usd = estimateCostUsd(
      { embedding: 1_000_000, answer: 1_000_000 },
      CLOUD_PRICES_USD_PER_MTOKEN,
    );
    expect(usd).toBeCloseTo(9.02, 5);
  });

  it('a hiányzó szerepeket 0-nak veszi', () => {
    expect(estimateCostUsd({}, CLOUD_PRICES_USD_PER_MTOKEN)).toBe(0);
  });

  it('a válasz-modell dominál (AD-11 megfigyelés)', () => {
    const tokens = { embedding: 300, hyde: 200, rerank: 3000, answer: 4500 };
    const answerOnly = estimateCostUsd({ answer: tokens.answer }, CLOUD_PRICES_USD_PER_MTOKEN);
    const total = estimateCostUsd(tokens, CLOUD_PRICES_USD_PER_MTOKEN);
    expect(answerOnly / total).toBeGreaterThan(0.8); // a válasz-modell a költség >80%-a
  });
});
