import { pathToFileURL } from 'node:url';
import { createAgent, type AgentAnswer } from './agent/agent';
import { loadConfig } from './config';
import type { RetrievedSourceRecord } from './agent/tool-outcome';
import { createPgDb, createStore, type DocumentSummary, type SearchHit } from './rag/store';
import { createRetriever, retrieve, type RetrievalTrace } from './rag/retrieve';

/** A parancssori argumentumok feldolgozása — tiszta, tesztelt. */
export type CliCommand =
  | { command: 'ask'; question: string }
  | { command: 'debug:sources' }
  | { command: 'debug:search'; question: string; full: boolean }
  | { command: 'help' }
  | { command: 'error'; message: string };

const USAGE = [
  'Használat:',
  '  pnpm cli ask "<kérdés>"',
  '  pnpm debug:sources',
  '  pnpm debug:search "<kérdés>" [--full]',
].join('\n');

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
  if (cmd === 'debug:sources') {
    return { command: 'debug:sources' };
  }
  if (cmd === 'debug:search') {
    const full = rest.includes('--full');
    const question = rest
      .filter((a) => a !== '--full')
      .join(' ')
      .trim();
    if (question === '') {
      return { command: 'error', message: `Hiányzó kérdés. ${USAGE}` };
    }
    return { command: 'debug:search', question, full };
  }
  return { command: 'error', message: `Ismeretlen parancs: ${cmd}.\n${USAGE}` };
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

/** A tudásbázis dokumentumainak listája (debug:sources). */
export function formatDocumentList(docs: DocumentSummary[]): string {
  if (docs.length === 0) return 'A tudásbázis üres.';
  const lines = [`Dokumentumok (${docs.length}):`];
  for (const d of docs) {
    lines.push(`- ${d.game} · ${d.section} — ${d.chunkCount} chunk [${d.status}]`);
  }
  return lines.join('\n');
}

/** Egy keresés (nyers vagy teljes) találatai + opcionális trace (debug:search). */
export function formatSearchResult(
  label: string,
  hits: SearchHit[],
  trace?: RetrievalTrace,
): string {
  const lines = [`=== ${label} ===`];
  if (trace) {
    const hyde = trace.hydeText.replace(/\s+/g, ' ').slice(0, 120);
    lines.push(`HyDE: ${hyde}${trace.hydeFallback ? ' [fallback]' : ''}`);
    lines.push(
      `rerank-pontok: [${trace.rerankScores.join(', ')}]${trace.rerankFallback ? ' [fallback]' : ''}`,
    );
    lines.push(`kontextus: ${trace.contextChars} karakter`);
  }
  if (hits.length === 0) {
    lines.push('(nincs találat)');
  } else {
    hits.forEach((h, i) => {
      lines.push(`${i + 1}. ${h.game} · ${h.section} (táv: ${h.distance.toFixed(3)}) ${h.source}`);
    });
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

  if (parsed.command === 'debug:sources') {
    const db = createPgDb(config.databaseUrl);
    const store = createStore(db, { dimensions: config.embeddingDimensions });
    try {
      console.log(formatDocumentList(await store.list()));
    } finally {
      await db.end();
    }
    return;
  }

  if (parsed.command === 'debug:search') {
    const { deps, close } = createRetriever(config);
    try {
      if (parsed.full) {
        const result = await retrieve(parsed.question, deps, {
          wideNet: config.wideNet,
          keepTop: config.keepTop,
          maxDistance: config.relevanceMaxDistance,
        });
        console.log(
          formatSearchResult('TELJES pipeline (HyDE + rerank)', result.hits, result.trace),
        );
      } else {
        const { vectors } = await deps.embed([parsed.question]);
        const vector = vectors[0];
        const hits = vector ? await deps.search(vector, config.keepTop) : [];
        console.log(formatSearchResult('NYERS vektorkeresés', hits));
      }
    } finally {
      await close();
    }
    return;
  }

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
