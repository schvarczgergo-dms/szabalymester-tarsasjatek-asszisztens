---
baseline_commit: 44a673b
---

# Story 3.1: Debug-parancsok és trace-láthatóság

Status: done

## Story

As a fejlesztő,
I want külön parancsokat a tudásbázis és a keresés megnézésére,
so that a RAG-hibákat előbb a retrievalben tudom keresni, nem a generálásban.

## Acceptance Criteria

1. **`pnpm debug:sources` (FR-22):** felsorolja a `knowledge_documents`-et (játék · szakasz · chunk-szám · státusz), így látszik, mi van a tudásbázisban.
2. **`pnpm debug:search "<kérdés>" [--full]` (FR-21, FR-22, NFR-4):** `--full` nélkül a **nyers vektorkeresést** (a kérdés közvetlen embeddingje → top-K, távolságokkal), `--full`-lal a **teljes pipeline-t** (HyDE + rerank) mutatja a trace-adatokkal (HyDE-szöveg, távolságok, rerank-pontok, kontextusméret).
3. **Trace strukturált (NFR-4):** a kimenet a `RetrievalTrace`-ből dolgozik (nem ad-hoc `console.log` a pipeline belsejében).
4. **Tesztelhetőség (NFR-3):** a parancs-parszolás és a formázó függvények tiszta, unit-tesztelt egységek; a tényleges lekérdezés élő/integrációs.

## Tasks / Subtasks

- [x] **T1: `src/cli.ts` bővítése (+ `cli.spec.ts`) — TDD** — `parseCliArgs` (debug:sources, debug:search + `--full`), `formatDocumentList`, `formatSearchResult` (trace-szel); `main` dispatch (sources → `store.list`; search nyers `embed`+`search` / `--full` `retrieve`). 8 új unit teszt.
- [x] **T2: `package.json` scriptek** — `debug:sources`, `debug:search`.
- [x] **T3: Zöld-kapu** — `pnpm test` + `typecheck · lint · format:check` zöld.
- [x] **T4: Éles smoke** — `debug:sources` (aktív + soft-delete audit látszik), `debug:search` nyers (magyar→angol gyenge, táv ~0.48–0.53) — a golden-set (3.2) baseline-ja.

## Dev Notes

### Kényszerek
- **NFR-4 (megfigyelhetőség):** a keresés a generálástól KÜLÖN nézhető; a `debug:search` a nyers és a teljes pipeline-t is mutatja. [Source: ARCHITECTURE-SPINE.md#Consistency, docs/tervezesi-mintak.md#6]
- **AD-9:** a `cli` a kompozíciós gyökér — a `rag/store` és `rag/retrieve` innen hívható. [Source: #AD-9]

### Bemenet és interfészek
- **`src/rag/store.ts`:** `createPgDb(databaseUrl)`, `createStore(db,{dimensions}).list()` → `DocumentSummary[]`; `search(embedding, topK)`.
- **`src/rag/retrieve.ts`:** `createRetriever(config) → { deps, close }`; `retrieve(q, deps, opts)`; a nyers kereséshez `deps.embed([q])` + `deps.search(vec, wideNet)`.
- **`src/cli.ts` (2.3):** a meglévő `parseCliArgs`/`main` bővítése.

### 🚨 Gotcha-k
1. **Nyers vs. teljes:** a nyers a kérdést KÖZVETLENÜL embeddeli (nincs HyDE, nincs rerank); a teljes a `retrieve`-et hívja. A kettő különbsége a golden-set (3.2) lényege.
2. **A debug NE dömpingelje a teljes chunk-tartalmat** — elég a metaadat (játék · szakasz · távolság · rerank-pont) + a HyDE-szöveg; így a kimenet átlátható és a korpusz-terjedelem sem probléma.
3. **`close()` finally** — a pg-pool bezárása.

### Project Structure Notes
- Módosul: `src/cli.ts` (+ `cli.spec.ts`), `package.json`. Nincs új modul (a `cli.ts` a Structural Seed szerint a debug-parancsok helye is).

### References
- [Source: epics.md#Story-3.1] AC-k; [Source: prd.md#FR-21, #FR-22, #NFR-4]; [Source: docs/tervezesi-mintak.md#6].
- Bemenet: `src/rag/store.ts`, `src/rag/retrieve.ts`, `src/cli.ts`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`) — Cursorból.

### Debug Log References

- Unit: `cli.spec.ts` +8 teszt (debug parse + formázók); teljes csomag zöld.
- Éles smoke: `debug:sources` (aktív + deleted audit), `debug:search` nyers (magyar→angol táv ~0.48–0.53).

### Completion Notes List

- `src/cli.ts` bővítve: `debug:sources` (`store.list` → dokumentum-lista chunk-számmal/státusszal), `debug:search "<q>" [--full]` (nyers: a kérdés közvetlen embeddingje + `search`; teljes: `retrieve` HyDE+rerank + trace). `formatDocumentList`/`formatSearchResult` tiszta, tesztelt.
- `package.json`: `debug:sources`, `debug:search` scriptek.
- A `debug:sources` a soft-delete audit-sorokat is mutatja (deleted, 0 chunk) — az AD-5 audit-nyom láthatósága.

### File List

- `src/cli.ts` (módosítva), `src/cli.spec.ts` (módosítva), `package.json` (módosítva)

### Change Log

- 2026-07-18: Story 3.1 implementálva — `debug:sources` + `debug:search [--full]` (nyers vs. teljes pipeline, trace-szel), TDD 8 új teszt, élő smoke. Status → done.
