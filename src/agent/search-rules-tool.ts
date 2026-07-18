import { tool } from 'ai';
import { z } from 'zod';
import { retrieve, type RetrieveDeps, type RetrieveOptions } from '../rag/retrieve';
import { emptyTraceEntry, type ToolOutcome, type TraceEntry } from './tool-outcome';

/** A tool modell-felé eső input-sémája (Zod-határvalidáció, AD-8). */
export const searchRulesInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('A keresendő szabálykérdés vagy kulcsszavak (a felhasználó kérdéséből).'),
});

/**
 * A `searchRules` tool logikája (AD-8): meghívja a retrieval-pipeline-t, és egységes
 * {@link ToolOutcome}-ot ad. SOHA nem dob — üres találat → `empty`, bármely hiba → `error`,
 * mindkettő beszédes MAGYAR `content`-tel. A `content` a modell-látható rész (chunkok forrással),
 * a `report` a teljes trace a mellékcsatornára.
 */
export async function executeSearchRules(
  query: string,
  deps: RetrieveDeps,
  opts: RetrieveOptions,
): Promise<ToolOutcome> {
  if (typeof query !== 'string' || query.trim() === '') {
    return {
      status: 'error',
      content: 'Hibás keresés: üres kérdést kaptam. Adj meg egy konkrét szabálykérdést.',
      report: emptyTraceEntry(String(query ?? '')),
    };
  }

  try {
    const result = await retrieve(query, deps, opts);
    const report: TraceEntry = { query, ...result.trace, sources: result.sources };

    if (result.empty || result.hits.length === 0) {
      return {
        status: 'empty',
        content: 'A tudásbázisban nincs erre vonatkozó találat.',
        report,
      };
    }

    const content = result.hits
      .map(
        (hit, i) =>
          `[${i + 1}] Forrás: ${hit.game} · ${hit.section} (${hit.source})\n${hit.content}`,
      )
      .join('\n\n');

    return { status: 'ok', content, report };
  } catch {
    return {
      status: 'error',
      content:
        'A keresés közben hiba történt a tudásbázisban. Ezért erre most nem tudok válaszolni.',
      report: emptyTraceEntry(query),
    };
  }
}

/**
 * A `searchRules` tool a Vercel AI SDK-hoz. A modell CSAK a `content` stringet kapja vissza;
 * a teljes {@link ToolOutcome} (a `report` trace-szel) az `onReport` mellékcsatornára megy (AD-8).
 */
export function createSearchRulesTool(
  deps: RetrieveDeps,
  opts: RetrieveOptions,
  onReport?: (outcome: ToolOutcome) => void,
) {
  return tool({
    description:
      'Keresés a hivatalos társasjáték-szabály tudásbázisban. MINDIG hívd meg, mielőtt válaszolsz, ' +
      'a felhasználó kérdéséből képzett kereséssel. Csak a visszaadott találatokból válaszolj.',
    inputSchema: searchRulesInputSchema,
    execute: async ({ query }) => {
      const outcome = await executeSearchRules(query, deps, opts);
      onReport?.(outcome);
      return outcome.content;
    },
  });
}
