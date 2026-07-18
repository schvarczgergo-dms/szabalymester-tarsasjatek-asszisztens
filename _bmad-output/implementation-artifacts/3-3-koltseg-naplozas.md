---
baseline_commit: 1b4bb76
---

# Story 3.3: Token-/költség-naplózás és becslés

Status: ready-for-dev

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

- [ ] **T1: `src/eval/cost.ts` (+ `.spec.ts`)** (AC: 2) — `estimateCostUsd(tokensByRole, prices)` + alap ár-tábla (felhő) + lokális (0). Unit-teszt.
- [ ] **T2: README frissítés** (AC: 3, 4) — „Futtatás" (valós parancsok, lokális + felhő) és „Költségbecslés" (mért tokenek: ingest ~28,5K; egy kérdés ~7-8K, ~85% válasz-modell; lokális $0 + felhő-projekció). A stale „tervezési fázis" + korpusz-leírás (most Wikipédia CC BY-SA) frissítése.
- [ ] **T3: Zöld-kapu** — `pnpm test` + `typecheck · lint · format:check` zöld.

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

### Debug Log References

### Completion Notes List

### File List

### Change Log
