import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config';
import { createRetriever, retrieve } from '../rag/retrieve';
import type { SearchHit } from '../rag/store';
import { goldInTopK, goldRank, reordered, type Gold, type HitMeta } from './evaluate';

interface GoldenQuestion {
  id: string;
  type: 'positive' | 'negative';
  question: string;
  gold: Gold | null;
  note?: string;
}

const toMeta = (hits: SearchHit[]): HitMeta[] =>
  hits.map((h) => ({ game: h.game, section: h.section, distance: h.distance }));

const fmtHits = (hits: HitMeta[]): string =>
  hits.length === 0
    ? '(nincs)'
    : hits.map((h) => `${h.game}·${h.section} (${h.distance.toFixed(3)})`).join('; ');

async function main(): Promise<void> {
  const config = loadConfig();
  const gs = JSON.parse(readFileSync(path.resolve('src', 'eval', 'golden-set.json'), 'utf8')) as {
    questions: GoldenQuestion[];
  };
  console.log(`[eval] ${gs.questions.length} kérdés, korpusz-nyelv=${config.corpusLanguage}`);

  const { deps, close } = createRetriever(config);
  const rows: string[] = [];
  let positives = 0;
  let goldHits = 0;
  let reorderCount = 0;
  const negativeNotes: string[] = [];

  try {
    for (const q of gs.questions) {
      const embedded = await deps.embed([q.question]);
      const vector = embedded.vectors[0];
      const rawHits = toMeta(vector ? await deps.search(vector, config.keepTop) : []);

      const full = await retrieve(q.question, deps, {
        wideNet: config.wideNet,
        keepTop: config.keepTop,
        maxDistance: config.relevanceMaxDistance,
      });
      const fullHits = toMeta(full.hits);
      const hyde = full.trace.hydeText.replace(/\s+/g, ' ').slice(0, 70);
      console.log(`[eval] ${q.id} kész`);

      if (q.type === 'positive' && q.gold) {
        positives += 1;
        const inTop5 = goldInTopK(q.gold, fullHits, 5);
        if (inTop5) goldHits += 1;
        if (reordered(rawHits, fullHits)) reorderCount += 1;
        const rRank = goldRank(q.gold, rawHits);
        const fRank = goldRank(q.gold, fullHits);
        rows.push(
          `### ${q.id} — ${q.question}\n\n` +
            `- **Gold:** ${q.gold.game} · ${q.gold.section} — nyers rang: ${rRank === -1 ? '—' : rRank}, teljes rang: ${fRank === -1 ? '—' : fRank}, **gold a top-5-ben:** ${inTop5 ? 'IGEN' : 'NEM'}\n` +
            `- **HyDE:** ${hyde}\n` +
            `- **Nyers top-${config.keepTop}:** ${fmtHits(rawHits)}\n` +
            `- **Teljes top-${config.keepTop}:** ${fmtHits(fullHits)}\n`,
        );
      } else {
        const top = fullHits[0];
        const verdict = full.empty
          ? 'ÜRES (absztenció — helyes)'
          : `top-táv ${top ? top.distance.toFixed(3) : '—'} (nincs gold; a válasz-modellnek absztenálnia kell)`;
        negativeNotes.push(`- ${q.id}: ${verdict}`);
        rows.push(
          `### ${q.id} — ${q.question} (NEGATÍV)\n\n` +
            `- **Várt:** absztenció (nincs a korpuszban)\n` +
            `- **HyDE:** ${hyde}\n` +
            `- **Teljes top-${config.keepTop}:** ${fmtHits(fullHits)} → ${verdict}\n`,
        );
      }
    }
  } finally {
    await close();
  }

  const doc =
    `# Golden set — eredmények (generált)\n\n` +
    `Modell: embedding=\`${config.embeddingModel}\`, HyDE=\`${config.hydeModel}\`, ` +
    `rerank/válasz=\`${config.answerModel}\` (${config.answerProvider}); ` +
    `korpusz-nyelv=${config.corpusLanguage}, relevancia-küszöb=${config.relevanceMaxDistance ?? 'nincs'}.\n\n` +
    `## Összegzés\n\n` +
    `- Pozitív gold a teljes pipeline top-5-ében: **${goldHits}/${positives}** (SM-1 cél: ≥7/8).\n` +
    `- Átrendezés (nyers vs. teljes top-1) esetek: **${reorderCount}** (SM-2 cél: ≥1).\n` +
    `- Negatív tesztek:\n${negativeNotes.join('\n')}\n\n` +
    `## Kérdésenként (nyers vs. teljes)\n\n` +
    rows.join('\n');

  writeFileSync(path.resolve('docs', 'golden-set-eredmenyek.md'), doc, 'utf8');
  console.log(
    `Golden set kész: ${goldHits}/${positives} pozitív gold a full top-5-ben; ${reorderCount} átrendezés. ` +
      `Eredmény: docs/golden-set-eredmenyek.md`,
  );
}

main().catch((error: unknown) => {
  console.error('[eval] HIBA:', error instanceof Error ? error.message : error);
  process.exit(1);
});
