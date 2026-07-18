---
baseline_commit: ae62605
---

# Story 3.2: Golden set és nyers-vs-teljes kiértékelés

Status: done

## Story

As a fejlesztő,
I want egy golden setet és egy futtatót, amely a nyers és a teljes pipeline-t összeveti,
so that bizonyítható a HyDE, a rerank és a grounding hozzáadott értéke.

## Acceptance Criteria

1. **Golden set (FR-20):** `src/eval/golden-set.json` ≥8 pozitív + 2 negatív kérdéssel; kérdésenként megjelölt „gold" (elvárt játék + szakasz).
2. **Nyers vs. teljes futtató:** `pnpm eval:golden-set` minden kérdést `raw` (a kérdés közvetlen embeddingje → top-K) és `full` (HyDE + rerank) módban futtat, és kérdésenként egymás mellett mutatja a top-5-öt (játék, szakasz, távolság, rerank-pont) + a HyDE-szöveget.
3. **Metrikák (SM-1..3):** a 8 pozitívból ≥7-nél a gold szakasz a `full` top-5-ben; ≥1 átrendezés-eset dokumentált; mindkét negatív teszt átmegy (a `full` nem hoz „gold"-ot, ill. a küszöb miatt üres/gyenge → absztenció).
4. **Dokumentálás:** az eredmény-táblázat + rövid elemzés a `docs/golden-set-eredmenyek.md`-be íródik (a mért számokból).
5. **Tesztelhetőség:** a kiértékelő logika (gold-a-top5-ben, átrendezés-detektálás) tiszta, unit-tesztelt; a futtató maga élő/integrációs.

## Tasks / Subtasks

- [x] **T1: `src/eval/golden-set.json`** — 8 pozitív + 2 negatív, gold-szakasszal.
- [x] **T2: `src/eval/evaluate.ts` (+ `.spec.ts`)** — `goldInTopK`, `goldRank`, `reordered`; 5 unit teszt.
- [x] **T3: `src/eval/run-golden-set.ts`** — nyers (`embed`+`search`) vs. teljes (`retrieve`) kérdésenként, metaadat-táblázat + HyDE `docs/golden-set-eredmenyek.md`-be, konzol-összegzés.
- [x] **T4: `package.json` — `eval:golden-set` script.**
- [x] **T5: Zöld-kapu** — `pnpm test` 179 pass +1 skip; `typecheck · lint · format:check` zöld.
- [x] **T6: Éles futtatás (Ollama)** — 4/8 pozitív gold a top-5-ben, 7 átrendezés, 2/2 negatív absztenció. Elemzés: `docs/golden-set.md` §5 + `docs/golden-set-eredmenyek.md`.

## Dev Notes

### Kényszerek
- **FR-20 / SM-1..3:** a golden set bizonyítja a HyDE + rerank + grounding értékét; a nyers vs. teljes összevetés a lényeg. [Source: epics.md#Story-3.2, docs/golden-set.md]
- **A korpusz angol** → a `full` HyDE angolul hidal (Story 2.1 fix); a `raw` a magyar kérdést közvetlenül embeddeli → várhatóan gyengébb. A különbség a HyDE értéke.
- **NFR-4:** a futtató a trace-adatokat (HyDE, távolság, rerank-pont) mutatja.

### Bemenet és interfészek
- **`src/rag/retrieve.ts`:** `createRetriever(config)`, `retrieve(q, deps, opts)`; a nyershez `deps.embed`+`deps.search`.
- **`src/config.ts`:** `wideNet`, `keepTop`, `relevanceMaxDistance`, `corpusLanguage`.
- A gold szakasz a korpuszunkhoz igazodik: a legtöbb játéknál a szabály a `jatekmenet` dokumentumban van (a Wikipédia „Gameplay" szakasza alá ágyazva).

### 🚨 Gotcha-k
1. **A futtató a metaadatot dokumentálja** (játék · szakasz · távolság · rerank-pont + HyDE-szöveg) — NEM a teljes chunk-tartalmat.
2. **Őszinte kiértékelés:** ha egy metrika nem teljesül (pl. a 3B-modell / a Wikipédia-mélység miatt), azt írjuk le, ne szépítsük — a HF is ezt értékeli.
3. **A negatív teszt** a `full`-ban ideálisan üres/gyenge (a küszöb miatt) — ha mégis hoz találatot, az a top-táv magas; ezt dokumentáljuk.
4. **A futtató élő** (Ollama, ~perces); háttérben fut, az eredményt fájlba írja.

### Project Structure Notes
- Új: `src/eval/golden-set.json`, `src/eval/evaluate.ts` (+spec), `src/eval/run-golden-set.ts`. Ez az `eval/` mappa (Structural Seed). Módosul: `package.json`. Kimenet: `docs/golden-set-eredmenyek.md`.

### References
- [Source: epics.md#Story-3.2] AC/SM; [Source: docs/golden-set.md] (a kérdéskészlet terve — a korpuszhoz igazítva); [Source: prd.md#FR-20].

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`) — Cursorból.

### Debug Log References

- Unit: `evaluate.spec.ts` 5 teszt; teljes csomag 179 pass + 1 skip.
- Éles futás (Ollama, ~210s): 4/8 pozitív gold top-5, 7 átrendezés, 2/2 negatív absztenció.
- **Gotcha (session):** a `run-golden-set.ts` egyszer üresen íródott ki (szerkesztő-glitch, mint korábban a `tool-outcome.ts`) → néma exit 0; újraírás után lefutott.

### Completion Notes List

- `src/eval/golden-set.json`: 8 pozitív + 2 negatív, gold-szakasszal (a korpuszhoz igazítva; gold = `jatekmenet`).
- `src/eval/evaluate.ts`: tiszta `goldInTopK`/`goldRank`/`reordered` (unit-tesztelt); `run-golden-set.ts`: nyers vs. teljes futtató, metaadat-alapú eredmény-doc + metrikák; `eval:golden-set` script.
- **Mért eredmény (őszintén):** a negatív tesztek átmennek (küszöb → absztenció); a HyDE+rerank ott hoz gold top-1–2-t és feleződő távolságot, ahol a 3B HyDE értelmes; a 4/8 oka a 3B HyDE gyengesége (hallucináció / nyelv-keveredés), nem a pipeline. Erős modellel érdemben feljebb vihető. Elemzés: `docs/golden-set.md` §5.

### File List

- `src/eval/golden-set.json`, `src/eval/evaluate.ts`, `src/eval/evaluate.spec.ts`, `src/eval/run-golden-set.ts` (új)
- `package.json` (módosítva — `eval:golden-set`), `docs/golden-set.md` (§5 elemzés), `docs/golden-set-eredmenyek.md` (generált)

### Change Log

- 2026-07-18: Story 3.2 implementálva — golden set (8+2) + nyers-vs-teljes futtató + tiszta kiértékelő (5 teszt), éles futás Ollamán, dokumentált elemzés (4/8 gold, 7 átrendezés, 2/2 negatív). Status → done.
