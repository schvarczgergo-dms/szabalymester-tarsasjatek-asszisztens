---
baseline_commit: 10ed0aa
---

# Story 3.1: Debug-parancsok és trace-láthatóság

Status: ready-for-dev

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

- [ ] **T1: `src/cli.ts` bővítése (+ `cli.spec.ts`) — TDD** (AC: 1, 2, 4)
  - [ ] `parseCliArgs` új parancsai: `debug:sources`, `debug:search` (`--full` flag + kérdés összefűzve).
  - [ ] `formatDocumentList(docs)` és `formatSearchResult(label, hits, trace?)` tiszta formázók.
  - [ ] `main()` dispatch: `debug:sources` → `store.list()`; `debug:search` → nyers (`embed`+`search`) vagy `--full` (`retrieve`), a trace kiírásával.
  - [ ] Tesztek: `parseCliArgs` (debug:sources, debug:search --full/kérdéssel); a formázók (dokumentum-lista, találat-lista távolsággal).
- [ ] **T2: `package.json` scriptek** (AC: 1, 2) — `"debug:sources": "tsx src/cli.ts debug:sources"`, `"debug:search": "tsx src/cli.ts debug:search"`.
- [ ] **T3: Zöld-kapu** (AC: 4) — `pnpm test` + `typecheck · lint · format:check` zöld.
- [ ] **T4 (opcionális): Éles smoke** — `pnpm debug:sources` és `pnpm debug:search "..." --full` az Ollamán.

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

### Debug Log References

### Completion Notes List

### File List

### Change Log
