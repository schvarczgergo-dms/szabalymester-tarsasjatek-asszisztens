---
baseline_commit: dadaae7
---

# Story 3.3: Token-/költség-naplózás és becslés

Status: done

## Story

As a üzemeltető,
I want a token-használat naplózását és egy költségbecslést,
so that ismert az ingest és egy kérdés valós költsége.

## Acceptance Criteria

1. **Usage-naplózás (FR-23, AD-11):** minden modellhívás usage-e elérhető és aggregálható — ez a pipeline-ban már megvan (`embedTexts` → tokens; `retrieve` trace usage; `agent` `aggregateUsage`; `ingest` riport token). A story ezt költséggé aggregálja.
2. **Költség-aggregálás:** tiszta `estimateCostUsd(tokensByRole, prices)` függvény — szerep szerinti tokenből (embedding/HyDE/rerank/válasz) + ár-táblából dollár; unit-tesztelt.
3. **README-be a mért számok (SM-4):** az ingest és egy kérdés mért token-száma + költsége a README-ben; a válasz-modell dominanciája látszik; a lokális (Ollama = $0) és a felhő-projekció is szerepel.
4. **README futtatási instrukciók (HF3 leadandó):** docker + ingest + cli + eval + debug parancsok, lokális és felhő módra.

## Tasks / Subtasks

- [x] **T1: `src/eval/cost.ts` (+ `.spec.ts`)** — `estimateCostUsd` + felhő/lokális ár-tábla; 4 unit teszt (köztük a válasz-modell >80% dominancia).
- [x] **T2: README frissítés** — „Futtatás" (valós parancsok, lokális + felhő) és „Költségbecslés" (mért: ingest ~28,5K token; kérdés ~7-8K, ~85% válasz; lokális $0 + felhő-projekció táblázat); intro + korpusz-leírás frissítve (CC BY-SA Wikipédia, 54 dok).
- [x] **T3: Zöld-kapu** — `pnpm test` 183 pass +1 skip; `typecheck · lint · format:check` zöld.

## Dev Notes

### Kényszerek
- **AD-11:** minden modellhívás usage-e naplózódik; a költség ebből aggregálódik. A usage-plumbing kész (1.5/1.6/2.1/2.2) — itt a költség-réteg + a README-számok. [Source: ARCHITECTURE-SPINE.md#AD-11]
- **SM-4:** a mért ingest- és kérdés-költség a README-be, a válasz-modell dominanciájával. [Source: epics.md#Story-3.3]

### Mért számok (a session futásaiból)
- **Ingest:** 54 dok / 157 chunk → **~28,5K embedding-token** (Ollama nomic-embed-text; lokálisan $0).
- **Egy kérdés (teljes pipeline):** ~7-8K token (HyDE + embedding + rerank + válasz); lokálisan $0.
- **Felhő-projekció** (spine-modellek): a válasz-modell (Claude Sonnet) dominál (~80-90%); nagyságrend a `docs/koltsegbecsles.md` szerint (~$0.02-0.03/kérdés).

### 🚨 Gotcha-k
1. **Lokálisan a valós költség $0** (Ollama) — ezt őszintén így írjuk; a felhő-projekció külön, jelölve.
2. **A `cost.ts` tiszta** (nincs hálózat) — ár-tábla + tokenből dollár; a valós per-modell bontás a felhő-mód usage-éből jönne (a lokális aggregátum egy szám).

### Project Structure Notes
- Új: `src/eval/cost.ts` (+spec). Módosul: `README.md` (Futtatás + Költségbecslés + intro/korpusz frissítés).

### References
- [Source: epics.md#Story-3.3, prd.md#FR-23, ARCHITECTURE-SPINE.md#AD-11]; [Source: docs/koltsegbecsles.md] (módszertan).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`) — Cursorból.

### Debug Log References

- Unit: `cost.spec.ts` 4 teszt; teljes csomag 183 pass + 1 skip; typecheck/lint/format zöld.

### Completion Notes List

- `src/eval/cost.ts`: `estimateCostUsd(tokensByRole, prices)` tiszta aggregáló + `CLOUD_PRICES`/`LOCAL_PRICES` ár-tábla. A usage-plumbing (embed/retrieve/agent/ingest) már megvolt (AD-11); ez a költség-réteg.
- `README.md`: valós „Futtatás" (docker → ingest → cli → debug → eval → test; lokális + felhő) és „Költségbecslés" (mért tokenek táblázatban, lokális $0 + felhő-projekció, válasz-modell ~85% dominancia). Az intro/korpusz-leírás a valós állapotra frissítve (CC BY-SA, 54 dok, kereszt-nyelvű).
- **Lokális futás valós költsége $0** (Ollama); a felhő-szám projekció (a `docs/koltsegbecsles.md` módszertanával).

### File List

- `src/eval/cost.ts`, `src/eval/cost.spec.ts` (új)
- `README.md` (módosítva — intro, korpusz, Futtatás, Költségbecslés)

### Change Log

- 2026-07-18: Story 3.3 implementálva — költség-aggregáló (`cost.ts`) + README valós futtatás/költség szekciók (mért tokenek, lokális $0 + felhő-projekció). Status → done. Ezzel az Epic 3 kész.
