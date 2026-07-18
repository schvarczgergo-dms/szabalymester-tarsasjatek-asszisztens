/** A golden-set kiértékelésének tiszta, determinisztikus segédfüggvényei. */

export interface Gold {
  game: string;
  section: string;
}

export interface HitMeta {
  game: string;
  section: string;
  distance: number;
}

const isGold =
  (gold: Gold) =>
  (hit: HitMeta): boolean =>
    hit.game === gold.game && hit.section === gold.section;

/** A gold találat benne van-e a top-`k`-ban? */
export function goldInTopK(gold: Gold, hits: HitMeta[], k: number): boolean {
  return hits.slice(0, k).some(isGold(gold));
}

/** A gold találat 1-alapú rangja (−1, ha nincs a listában). */
export function goldRank(gold: Gold, hits: HitMeta[]): number {
  const index = hits.findIndex(isGold(gold));
  return index === -1 ? -1 : index + 1;
}

/** Átrendezett-e a top-1 a nyers és a teljes pipeline között (a rerank/HyDE hatása)? */
export function reordered(rawHits: HitMeta[], fullHits: HitMeta[]): boolean {
  const raw = rawHits[0];
  const full = fullHits[0];
  if (raw === undefined || full === undefined) return raw !== full;
  return raw.game !== full.game || raw.section !== full.section;
}
