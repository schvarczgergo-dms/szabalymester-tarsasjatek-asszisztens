import type { ToolOutcome } from '../agent/tool-outcome';

/** Az ügyfélkérés két kimenete: grounded auto-válasz, vagy emberi kapu. */
export type CustomerPath = 'auto' | 'escalate';

/** Miért ment a kérés az emberi kapuhoz (a jegy `reason` mezője). */
export type EscalateReason =
  | 'empty_retrieval'
  | 'retrieval_error'
  | 'no_search'
  | 'agent_error'
  | 'game_mismatch';

export type PathDecision =
  | { path: 'auto' }
  | { path: 'escalate'; reason: EscalateReason };

/**
 * Az agent tool-kimenetéből dönt: van-e grounded találat. A keresés üres/hibás ága
 * (a meglévő absztenció) itt NEM „nincs infóm” a vendégnek, hanem jegy a játékmesternek.
 * Ha van találat, de a chunk játékneve nincs a kérdésben (Catan-chunk Gloomhaven-kérdésre),
 * az is eszkalál — a demo Gloomhaven-ága ettől nem auto-hallucinál.
 */
export function decidePath(reports: ToolOutcome[], question = ''): PathDecision {
  if (reports.length === 0) {
    return { path: 'escalate', reason: 'no_search' };
  }
  if (reports.some((r) => r.status === 'error')) {
    return { path: 'escalate', reason: 'retrieval_error' };
  }
  if (reports.some((r) => r.status === 'ok')) {
    if (question.trim() !== '' && !sourceGameMatchesQuestion(question, reports)) {
      return { path: 'escalate', reason: 'game_mismatch' };
    }
    return { path: 'auto' };
  }
  return { path: 'escalate', reason: 'empty_retrieval' };
}

const MIN_GAME_NAME_CHARS = 4;

/** A találat játékneve szerepel-e a kérdésben (Catan → Catanban). A 2–3 betűs nevek (Go) nem szűrnek. */
function sourceGameMatchesQuestion(question: string, reports: ToolOutcome[]): boolean {
  const q = question.toLocaleLowerCase('hu-HU');
  const names = reports.flatMap((r) =>
    r.report.sources.map((s) => {
      const raw = s.game.trim();
      const paren = raw.indexOf(' (');
      return paren === -1 ? raw : raw.slice(0, paren);
    }),
  );
  const long = [...new Set(names)].filter((n) => n.length >= MIN_GAME_NAME_CHARS);
  if (long.length === 0) return true;
  return long.some((n) => q.includes(n.toLocaleLowerCase('hu-HU')));
}

/** A retrieval összesített státusza a kérésnaplóba. */
export function retrievalStatus(reports: ToolOutcome[]): 'ok' | 'empty' | 'error' | 'none' {
  if (reports.length === 0) return 'none';
  if (reports.some((r) => r.status === 'error')) return 'error';
  if (reports.some((r) => r.status === 'ok')) return 'ok';
  return 'empty';
}

/** A legközelebbi találat koszinusz-távolsága (méréshez); üres keresésnél `null`. */
export function minDistance(reports: ToolOutcome[]): number | null {
  const distances = reports.flatMap((r) => r.report.distances);
  if (distances.length === 0) return null;
  return Math.min(...distances);
}
