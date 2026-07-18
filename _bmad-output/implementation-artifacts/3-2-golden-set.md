---
baseline_commit: 06e1290
---

# Story 3.2: Golden set és nyers-vs-teljes kiértékelés

Status: ready-for-dev

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

- [ ] **T1: `src/eval/golden-set.json`** (AC: 1) — 8 pozitív (a korpuszban lévő játékok, gold = jellemzően `jatekmenet`) + 2 negatív (Gloomhaven; abszurd/lefedetlen Catan-adat).
- [ ] **T2: `src/eval/evaluate.ts` (+ `.spec.ts`) — tiszta kiértékelő** (AC: 3, 5)
  - [ ] `goldInTopK(gold, hits, k)` → boolean; `detectReorder(rawHits, fullHits)` → boolean/leírás.
  - [ ] Tesztek a kulcs-esetekre.
- [ ] **T3: `src/eval/run-golden-set.ts`** (AC: 2, 4) — betölti a golden setet; kérdésenként `raw` (`embed`+`search`) és `full` (`retrieve`); markdown-táblázatot ír `docs/golden-set-eredmenyek.md`-be + összegzést a konzolra (metrikák).
- [ ] **T4: `package.json` — `eval:golden-set` script.**
- [ ] **T5: Zöld-kapu** — `pnpm test` + `typecheck · lint · format:check` zöld.
- [ ] **T6: Éles futtatás** (Ollama) — `pnpm eval:golden-set`; az eredmények + elemzés a `docs/golden-set-eredmenyek.md`-be; a metrikák (≥7/8, ≥1 átrendezés, 2 negatív) kiértékelve, őszintén.

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

### Debug Log References

### Completion Notes List

### File List

### Change Log
