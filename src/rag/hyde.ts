import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { Config } from '../config';

/** Egy HyDE-generálás portja — a valós `generateText` köré, teszthez injektálható fake-kel. */
export type HydeGenerateFn = (
  question: string,
) => Promise<{ text: string; usage: { tokens: number } }>;

export interface HydeResult {
  /** A keresésre használt szöveg: a HyDE-válasz, vagy fallbackként az eredeti kérdés. */
  text: string;
  usage: { tokens: number };
  /** Igaz, ha a HyDE elhasalt/üres volt, és az eredeti kérdésre estünk vissza. */
  usedFallback: boolean;
}

export interface HydeDeps {
  generate: HydeGenerateFn;
}

/**
 * HyDE (FR-10, AD-2): egy olcsó modell rövid, magyar, szabálykönyv-szerű hipotetikus
 * választ ír, amit a keresésre vektorizálunk. Hiba vagy üres kimenet esetén az EREDETI
 * kérdésre esik vissza — SOHA nem dob (a retrieval a felhasználó felé nem hasal el).
 */
export async function generateHyde(question: string, deps: HydeDeps): Promise<HydeResult> {
  try {
    const { text, usage } = await deps.generate(question);
    if (text.trim() === '') {
      return { text: question, usage: { tokens: 0 }, usedFallback: true };
    }
    return { text, usage, usedFallback: false };
  } catch {
    return { text: question, usage: { tokens: 0 }, usedFallback: true };
  }
}

const HYDE_SYSTEM =
  'Te egy társasjáték-szabály szakértő vagy. A felhasználó kérdésére írj egy rövid (2-3 mondatos), ' +
  'magabiztos, MAGYAR nyelvű, szabálykönyv-szerű hipotetikus választ. A tartalom lehet pontatlan — ' +
  'a cél csak a szabálykönyv szóhasználatának közelítése a kereséshez. Ne kérdezz vissza, ne magyarázz.';

/**
 * Alapértelmezett HyDE-generátor a Vercel AI SDK-ra (OpenAI `config.hydeModel`). A modellnév
 * kizárólag a `config`-ból (AD-6); a HyDE külön providernél fut, mint a rerank (AD-7).
 */
export function createOpenAIHydeGenerate(config: Config): HydeGenerateFn {
  return async (question) => {
    const { text, usage } = await generateText({
      model: openai(config.hydeModel),
      system: HYDE_SYSTEM,
      prompt: question,
    });
    return { text, usage: { tokens: usage.totalTokens ?? 0 } };
  };
}
