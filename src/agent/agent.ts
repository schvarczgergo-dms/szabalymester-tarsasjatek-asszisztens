import { generateText, stepCountIs } from 'ai';
import type { Config } from '../config';
import { createProviders } from '../providers';
import { createRetriever, type RetrieveDeps } from '../rag/retrieve';
import { AGENT_SYSTEM_PROMPT } from './prompt';
import { createSearchRulesTool } from './search-rules-tool';
import type { ToolOutcome } from './tool-outcome';

/** A tool-use loop felső korlátja (AD-8: az agent korlátozott lépésszámmal fut). */
export const AGENT_MAX_STEPS = 5;

export interface AgentAnswer {
  answer: string;
  /** A tool-hívások teljes kimenete (trace-csatorna) — Story 3.1 debug / eval. */
  reports: ToolOutcome[];
  usage: { tokens: number };
}

/** Tiszta usage-aggregálás (AD-11): a retrieval-hívások + a válasz-modell tokenjei. */
export function aggregateUsage(reports: ToolOutcome[], answerTokens: number): { tokens: number } {
  const retrievalTokens = reports.reduce((sum, r) => sum + r.report.usage.tokens, 0);
  return { tokens: retrievalTokens + answerTokens };
}

/**
 * A grounded agent (AD-1, AD-7, AD-8): tool-use loop a Vercel AI SDK-ra. A válasz-modellt a
 * `config.answerProvider`/`answerModel` adja (élesben Anthropic, lokálisan Ollama). A modell CSAK
 * a `searchRules` `content`-jét látja; a `report`-ok a trace-be gyűlnek. A válasz MAGYAR (prompt).
 */
export async function askRules(
  question: string,
  config: Config,
  deps: RetrieveDeps,
): Promise<AgentAnswer> {
  const providers = createProviders(config);
  // OpenAI-oldalon a Chat Completions API (Ollama-kompatibilis a tool-loopban; a Responses API
  // `item_reference` elemeit az Ollama nem támogatja). Valós OpenAI-jal is működik.
  const model =
    config.answerProvider === 'openai'
      ? providers.openai.chat(config.answerModel)
      : providers.anthropic(config.answerModel);

  const reports: ToolOutcome[] = [];
  const searchRules = createSearchRulesTool(
    deps,
    { wideNet: config.wideNet, keepTop: config.keepTop, maxDistance: config.relevanceMaxDistance },
    (outcome) => reports.push(outcome),
  );

  const result = await generateText({
    model,
    system: AGENT_SYSTEM_PROMPT,
    prompt: question,
    tools: { searchRules },
    stopWhen: stepCountIs(AGENT_MAX_STEPS),
  });

  return {
    answer: result.text,
    reports,
    usage: aggregateUsage(reports, result.usage?.totalTokens ?? 0),
  };
}

/** Kényelmi factory: pg-store + retrieval-deps + a grounded agent egy `ask` függvénnyel. */
export function createAgent(config: Config): {
  ask: (question: string) => Promise<AgentAnswer>;
  close: () => Promise<void>;
} {
  const { deps, close } = createRetriever(config);
  return { ask: (question) => askRules(question, config, deps), close };
}
