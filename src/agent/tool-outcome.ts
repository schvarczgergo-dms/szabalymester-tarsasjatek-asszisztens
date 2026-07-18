import { z } from 'zod';

/**
 * A tool-réteg közös szerződése (AD-8). Minden `execute*` pontosan egy {@link ToolOutcome}-ot ad:
 * a modell KIZÁRÓLAG a `content`-et látja, a teljes `report` (trace-csatorna) a megfigyelhetőséghez
 * (Story 3.1 debug, eval) megy. Az `execute*` SOHA nem dob — a hiba is `ToolOutcome` (`status: error`).
 */

/** Egy felszínre került forrás (grounding: játék + szakasz + source-URL). */
export const retrievedSourceSchema = z.object({
  source: z.string(),
  game: z.string(),
  section: z.string(),
  heading: z.string().nullable(),
});
export type RetrievedSourceRecord = z.infer<typeof retrievedSourceSchema>;

/** A tool teljes, strukturált kimenete a trace-csatornára (a modell NEM látja) — AD-8 `report`. */
export const traceEntrySchema = z.object({
  query: z.string(),
  hydeText: z.string(),
  hydeFallback: z.boolean(),
  distances: z.array(z.number()),
  rerankScores: z.array(z.number()),
  rerankFallback: z.boolean(),
  contextChars: z.number(),
  empty: z.boolean(),
  usage: z.object({ tokens: z.number() }),
  sources: z.array(retrievedSourceSchema),
});
export type TraceEntry = z.infer<typeof traceEntrySchema>;

/** A tool egységes kimenete: `status` diszkriminátor + modell-látható `content` + trace `report`. */
export const toolOutcomeSchema = z.object({
  status: z.enum(['ok', 'empty', 'error']),
  content: z.string(),
  report: traceEntrySchema,
});
export type ToolOutcome = z.infer<typeof toolOutcomeSchema>;

/** Minimális trace-bejegyzés (üres/hiba ághoz, amikor nincs valódi retrieval-eredmény). */
export function emptyTraceEntry(query: string): TraceEntry {
  return {
    query,
    hydeText: query,
    hydeFallback: false,
    distances: [],
    rerankScores: [],
    rerankFallback: false,
    contextChars: 0,
    empty: true,
    usage: { tokens: 0 },
    sources: [],
  };
}
