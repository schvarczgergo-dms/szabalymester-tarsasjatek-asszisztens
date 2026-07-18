/** Token-alapú költségbecslés (AD-11, FR-23). Tiszta, hálózat nélkül — a usage-ből aggregál. */

export type ModelRole = 'embedding' | 'hyde' | 'rerank' | 'answer';

/**
 * Felhő ár-tábla — USD / 1M token, nagyságrendi (a spine modelljei, 2026). A rerank/válasz
 * érték az input+output durva átlaga. A pontos szám provider-árlistától függ; a projekcióhoz elég.
 */
export const CLOUD_PRICES_USD_PER_MTOKEN: Record<ModelRole, number> = {
  embedding: 0.02, // text-embedding-3-small
  hyde: 0.2, // gpt-nano szint
  rerank: 1.5, // claude-haiku szint
  answer: 9.0, // claude-sonnet szint
};

/** Lokális mód (Ollama) — minden szerep ingyenes. */
export const LOCAL_PRICES_USD_PER_MTOKEN: Record<ModelRole, number> = {
  embedding: 0,
  hyde: 0,
  rerank: 0,
  answer: 0,
};

/** Szerepenkénti tokenből becsült összköltség (USD). */
export function estimateCostUsd(
  tokensByRole: Partial<Record<ModelRole, number>>,
  prices: Record<ModelRole, number>,
): number {
  let usd = 0;
  for (const role of Object.keys(prices) as ModelRole[]) {
    const tokens = tokensByRole[role] ?? 0;
    usd += (tokens / 1_000_000) * prices[role];
  }
  return usd;
}
