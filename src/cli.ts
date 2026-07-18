import { pathToFileURL } from 'node:url';
import { createAgent, type AgentAnswer } from './agent/agent';
import { loadConfig } from './config';
import type { RetrievedSourceRecord } from './agent/tool-outcome';

/** A parancssori argumentumok feldolgozása — tiszta, tesztelt. */
export type CliCommand =
  | { command: 'ask'; question: string }
  | { command: 'help' }
  | { command: 'error'; message: string };

const USAGE = 'Használat: pnpm cli ask "<kérdés>"';

export function parseCliArgs(args: string[]): CliCommand {
  const [cmd, ...rest] = args;
  if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    return { command: 'help' };
  }
  if (cmd === 'ask') {
    const question = rest.join(' ').trim();
    if (question === '') {
      return { command: 'error', message: `Hiányzó kérdés. ${USAGE}` };
    }
    return { command: 'ask', question };
  }
  return { command: 'error', message: `Ismeretlen parancs: ${cmd}. ${USAGE}` };
}

/** A retrieval-reportokból egyedi forrás-lista (a felszínre került chunkok forrásai). */
function uniqueSources(result: AgentAnswer): RetrievedSourceRecord[] {
  const seen = new Set<string>();
  const sources: RetrievedSourceRecord[] = [];
  for (const outcome of result.reports) {
    for (const source of outcome.report.sources) {
      if (!seen.has(source.source)) {
        seen.add(source.source);
        sources.push(source);
      }
    }
  }
  return sources;
}

/** A válasz + a felhasznált források kiírható szövege (grounding a CLI-n is látszik). */
export function formatAnswer(result: AgentAnswer): string {
  const lines = [result.answer.trim()];
  const sources = uniqueSources(result);
  if (sources.length > 0) {
    lines.push('', 'Források:');
    for (const s of sources) {
      lines.push(`- ${s.game} · ${s.section}${s.source ? ` (${s.source})` : ''}`);
    }
  }
  return lines.join('\n');
}

/** A `pnpm cli ask "<kérdés>"` belépőpont: fail-fast config → grounded agent → formázott válasz. */
async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.command === 'help') {
    console.log(USAGE);
    return;
  }
  if (parsed.command === 'error') {
    console.error(parsed.message);
    process.exit(1);
    return;
  }

  const config = loadConfig();
  const agent = createAgent(config);
  try {
    const result = await agent.ask(parsed.question);
    console.log(formatAnswer(result));
  } finally {
    await agent.close();
  }
}

// Közvetlen futtatáskor (tsx src/cli.ts) indul; importáláskor (teszt) nem.
const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
