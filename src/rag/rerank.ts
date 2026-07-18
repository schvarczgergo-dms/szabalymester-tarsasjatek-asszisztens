import { generateObject } from 'ai';
import { z } from 'zod';
import type { Config } from '../config';
import { createProviders } from '../providers';

/** A rerank strukturált kimenete — a rendszer-határon Zod-validált (AD-8). */
export const rerankSchema = z.object({
  scores: z.array(z.object({ index: z.number().int(), score: z.number() })),
});

/** Egy rerank-hívás portja — a valós `generateObject` köré, teszthez injektálható fake-kel. */
export type RerankGenerateFn = (args: {
  question: string;
  candidates: string[];
}) => Promise<{ object: unknown; usage: { tokens: number } }>;

export interface RerankItem {
  index: number;
  score: number;
}

export interface RerankResult {
  ranked: RerankItem[];
  usage: { tokens: number };
  /** Igaz, ha a rerank elhasalt/érvénytelen volt, és a vektorsorrendre estünk vissza. */
  usedFallback: boolean;
}

export interface RerankDeps {
  generate: RerankGenerateFn;
}

/**
 * Átrangsorolás (FR-13, AD-2, AD-7): egy kis modell a kérdés fényében pontozza a jelölteket,
 * strukturált, Zod-validált kimenettel. Hiba VAGY érvénytelen kimenet esetén a bemeneti
 * (vektor-)sorrendre esik vissza (`score: -1`) — SOHA nem dob.
 */
export async function rerankChunks(
  question: string,
  candidates: string[],
  deps: RerankDeps,
  opts: { keepTop?: number } = {},
): Promise<RerankResult> {
  const keepTop = opts.keepTop ?? candidates.length;

  const fallback = (): RerankResult => ({
    ranked: candidates.map((_, index) => ({ index, score: -1 })).slice(0, keepTop),
    usage: { tokens: 0 },
    usedFallback: true,
  });

  try {
    const { object, usage } = await deps.generate({ question, candidates });
    const parsed = rerankSchema.safeParse(object);
    if (!parsed.success) {
      // Érvénytelen kimenet: vektorsorrend-fallback, de a hívás usage-ét megőrizzük (AD-11).
      return { ...fallback(), usage: { tokens: usage.tokens } };
    }

    const scoreByIndex = new Map<number, number>();
    for (const { index, score } of parsed.data.scores) {
      if (index >= 0 && index < candidates.length) {
        scoreByIndex.set(index, score);
      }
    }

    const ranked = candidates
      .map((_, index) => ({ index, score: scoreByIndex.get(index) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, keepTop);

    return { ranked, usage: { tokens: usage.tokens }, usedFallback: false };
  } catch {
    return fallback();
  }
}

/**
 * Alapértelmezett rerank-hívás a Vercel AI SDK-ra (Anthropic `config.rerankModel`). Külön
 * providernél fut, mint a HyDE (AD-7); a modellnév kizárólag a `config`-ból (AD-6).
 */
export function createAnthropicRerankGenerate(config: Config): RerankGenerateFn {
  const { anthropic } = createProviders(config);
  return async ({ question, candidates }) => {
    const numbered = candidates.map((text, index) => `[${index}] ${text}`).join('\n\n');
    const { object, usage } = await generateObject({
      model: anthropic(config.rerankModel),
      schema: rerankSchema,
      system:
        'Pontozd 0–10 skálán, mennyire válaszolja meg az egyes szövegrészletek a kérdést. ' +
        'Minden jelölthez adj egy pontszámot az indexével. Csak a megadott indexeket használd.',
      prompt: `Kérdés: ${question}\n\nJelöltek:\n${numbered}`,
    });
    return { object, usage: { tokens: usage.totalTokens ?? 0 } };
  };
}
