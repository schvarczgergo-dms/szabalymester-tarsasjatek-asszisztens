import { generateText } from 'ai';
import type { Config } from '../config';
import { createProviders } from '../providers';

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

const HYDE_SYSTEM_HU =
  'Te egy társasjáték-szabály szakértő vagy. A felhasználó kérdésére írj egy rövid (2-3 mondatos), ' +
  'magabiztos, MAGYAR nyelvű, szabálykönyv-szerű hipotetikus választ. A tartalom lehet pontatlan — ' +
  'a cél csak a szabálykönyv szóhasználatának közelítése a kereséshez. Ne kérdezz vissza, ne magyarázz.';

const HYDE_SYSTEM_EN =
  'You are a board game rules expert. Write a short (2-3 sentence), confident, ENGLISH, ' +
  'rulebook-style hypothetical answer to the user question. The content may be inaccurate — the ' +
  'goal is only to approximate rulebook wording for search. Do not ask back, do not explain.';

/**
 * Alapértelmezett HyDE-generátor a Vercel AI SDK-ra (OpenAI `config.hydeModel`). A HyDE a KORPUSZ
 * nyelvén generál (`config.corpusLanguage`) — a nyelvi rés elkerülésére, hogy a HyDE-vektor a
 * korpusz chunkjai közé essen. A modellnév a `config`-ból (AD-6); külön provider a reranktól (AD-7).
 */
export function createOpenAIHydeGenerate(config: Config): HydeGenerateFn {
  const { openai } = createProviders(config);
  const system = config.corpusLanguage === 'en' ? HYDE_SYSTEM_EN : HYDE_SYSTEM_HU;
  return async (question) => {
    const { text, usage } = await generateText({
      // Chat Completions API (nem a Responses API): Ollama-kompatibilis, és valós OpenAI-jal is működik.
      model: openai.chat(config.hydeModel),
      system,
      prompt: question,
    });
    return { text, usage: { tokens: usage.totalTokens ?? 0 } };
  };
}
