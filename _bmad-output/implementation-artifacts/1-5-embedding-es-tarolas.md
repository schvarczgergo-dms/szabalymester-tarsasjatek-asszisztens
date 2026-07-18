---
baseline_commit: 61d17ab
---

# Story 1.5: Embedding és tárolás

Status: review

## Story

As a fejlesztő,
I want batch-embeddinget és a store-réteget dimenzió-védelemmel,
so that a chunkok kereshetően, a modellel egyező dimenzióban kerülnek pgvectorba.

## Acceptance Criteria

1. **Egyetlen embedding-tér (AD-3, FR-11):** egy `embed`-modul a `config.embeddingModel`-lel vektorizál; UGYANEZ hívódik majd a kérdésre (Story 2.1) és a dokumentumokra — a modellnév kizárólag `config.ts`-ből jön, nincs beégetve. Batch-hívás (≤100 szöveg/hívás), a bemenetek sorrendje = a kimeneti vektorok sorrendje.
2. **Dimenzió-védelem, fail-fast (AD-3):** a modell által visszaadott vektor hossza meg kell egyezzen `config.embeddingDimensions`-szel ÉS a séma `vector(1536)`-jével; bármely eltérés beszédes magyar hibát dob a vektor tárolása ELŐTT (nem a DB-nél, némán). A `config.embeddingDimensions ≠ 1536` (a séma rögzített dimenziója) is fail-fast hibát ad.
3. **Tranzakciós tárolás (FR-3, NFR-5, AD-5):** a `store.insert` egy dokumentumot ÉS a chunkjait EGY tranzakcióban írja (`knowledge_documents` sor + `knowledge_chunks` sorok + `chunk_count`/`indexed_at` frissítés); hibánál teljes ROLLBACK — a kereső sosem lát fél-kész dokumentumot vagy árva chunkot.
4. **Store-műveletek:** `insert` (fenti, upsert `source`-ra: meglévő dokumentum chunkjait törli és újraírja egy tranzakcióban), `search` (koszinusz-közelség top-K CSAK `active` dokumentumok chunkjain, találatonként forrás-payload: `game`, `section`, `source`, `heading`, `distance`), `list` (dokumentumok + `chunk_count` + `status`), `delete` (dokumentum `source`-ra → chunkok CASCADE). Minden DB-művelet **paraméterezett SQL**, nyers string-interpoláció nélkül.
5. **Determinisztikus, unit-tesztelt seamek (NFR-3):** a tiszta részek (dimenzió-guard, pgvector-literál formázás, batch-darabolás, tranzakció-vezérlés BEGIN→COMMIT / hibán ROLLBACK) injektált fake-ekkel unit-tesztelve, valós OpenAI-kulcs és élő DB nélkül. Az élő DB-verifikáció (szintetikus vektorral, kulcs nélkül) opcionális kiegészítő, nem a teszt-kapu része.

## Tasks / Subtasks

- [x] **T1: Függőségek felvétele** (AC: 1, 3) — UPDATE `package.json`
  - [x] `ai` (Vercel AI SDK v7 → `7.0.31`) + `@ai-sdk/openai` (`4.0.16`, embedding-porthoz).
  - [x] `pg` (`8.22.0`) + `@types/pg` (`8.20.0`, devDependency) — paraméterezett SQL, tranzakció; nincs ORM (spine).
  - [x] `pnpm install` fut, a lockfile frissül.
- [x] **T2: `src/rag/embed.spec.ts` — előbb a tesztek (TDD, RED)** (AC: 1, 2, 5)
  - [x] batch-darabolás: 250 szöveg → 3 hívás (100+100+50); a kimeneti sorrend = a bemeneti sorrend.
  - [x] dimenzió-guard: a `config.embeddingDimensions`-től eltérő hosszú vektor beszédes hibát dob.
  - [x] a modellnév a `config`-ból jön (injektált fake embedder megkapja); üres input → üres kimenet, 0 hívás.
- [x] **T3: `src/rag/embed.ts` — implementáció (GREEN)** (AC: 1, 2)
  - [x] `embedTexts(texts, deps) → { vectors: number[][]; usage }`; `deps` = injektálható `embedBatch` (a valós OpenAI `embedMany`-t a `createOpenAIEmbedBatch(config)` factory adja).
  - [x] ≤100-as batch; minden batch után dimenzió-assert (`vector.length === config.embeddingDimensions`), eltérésnél `EmbedError` (magyar). `checkEmbeddingDimensions` a séma vs. konfiguráció fail-fast (AD-3).
  - [x] a `usage` (token) aggregálva visszaadva a hívónak (AD-11 előkészítés; a naplózás Story 1.6/3.3).
- [x] **T4: `src/rag/store.spec.ts` — előbb a tesztek (TDD, RED)** (AC: 3, 4, 5)
  - [x] pgvector-literál: `number[] → '[0.1,0.2,…]'` formázás (unit).
  - [x] tranzakció-vezérlés fake klienssel: `insert` → `BEGIN` … `COMMIT`; a chunkok a dokumentum-sor UTÁN íródnak; a művelet közbeni hibánál `ROLLBACK` és a hiba tovább dobódik.
  - [x] upsert: meglévő `source` esetén a régi chunkok törlő SQL-je lefut az újraírás előtt (a fake kliens rögzíti a hívássorrendet).
  - [x] `search`/`list`/`delete` a helyes paraméterezett SQL-t adják (paraméterek a `$1,$2…` helyőrzőkön, nem interpolálva).
- [x] **T5: `src/rag/store.ts` — implementáció (GREEN)** (AC: 3, 4)
  - [x] `Db`/`DbClient` port (`query`, tranzakcióhoz `connect`); a valós `pg.Pool`-t a `createPgDb(databaseUrl)` adapter adja, teszthez injektálható fake.
  - [x] `insert(doc, chunks)`: dimenzió-guard (DB-nyitás ELŐTT) → `BEGIN` → upsert `knowledge_documents` (`ON CONFLICT (source)`) → régi chunkok törlése → chunkok beszúrása (`embedding::vector`) → `chunk_count`/`indexed_at` frissítés (az upsertben) → `COMMIT`; hibán `ROLLBACK` + `release`.
  - [x] `search(embedding, topK)`: `ORDER BY embedding <=> $1::vector LIMIT $2`, JOIN `knowledge_documents`-re a forrás-payloadért, `WHERE d.status = 'active'`.
  - [x] `list()`: dokumentumok `source, title, game, section, chunk_count, status`; `delete(source)`: dokumentum-törlés → CASCADE.
- [x] **T6: Zöld-kapu** (AC: 5) — `pnpm test` (42 → 58) + `pnpm typecheck · lint · format:check` zöld.
- [x] **T7 (opcionális): Élő DB-verifikáció szintetikus vektorral** (AC: 3, 4) — kulcs nélkül
  - [x] a futó DB-n (Story 1.2) szintetikus 1536-dim vektorral: `insert` (dok + 2 chunk egy tranzakcióban) → `search` 2 találat helyes payloaddal → `list` `chunk_count=2` → `delete` → CASCADE chunk-szám 2→0. NEM hívott OpenAI-t.

## Dev Notes

### Kényszerek

- **AD-3 (egyetlen embedding-tér + dimenzió):** a kérdést és a dokumentumokat UGYANAZ a modell vektorizálja; a dimenzió a modellből jön, és meg kell egyeznie a séma `vector(1536)`-jével — eltérés a `config`/embed határon fail-fast, NEM a DB-nél némán. [Source: ARCHITECTURE-SPINE.md#AD-3]
- **AD-5 (tranzakciós konzisztencia):** dokumentum + chunkjai egy tranzakcióban; a dokumentum-csere (delete+insert+hash-update) atomi; árva chunk / fél-kész dokumentum tilos. [Source: #AD-5]
- **AD-9 (függőségi irány):** az `embed`/`store` a `src/rag/`-ban él, a `config`-ra támaszkodik; az `ingest` (Story 1.6) fogja importálni — most NE importáld fordítva. Nincs kör. [Source: #AD-9]
- **AD-11 (usage):** minden modellhívás usage-e naplózható legyen — az `embed` ADJA VISSZA a usage-t; a tényleges aggregálás/naplózás a Story 1.6/3.3. Most csak a visszaadás kell.
- **Konvenció:** DB-mutáció KIZÁRÓLAG paraméterezett SQL-lel, tranzakción belül; a `content` (fejléces) az embed-bemenet és a tárolt szöveg is (AD-4 — a fejléc már a `chunk.content`-ben van, ne told hozzá újra). [Source: #Consistency-Conventions, #AD-4]

### Bemenet és interfészek (a meglévő kódból)

- **Chunk** (`src/ingest/chunk.ts`): `{ chunkIndex: number; heading: string; content: string }` — a `content` MÁR tartalmazza a játéknév-fejlécet; EZT embeddeld és tárold. `import type`-tal.
- **ParsedDocument / FrontMatter** (`src/ingest/parse-document.ts`): `frontMatter: { title, game, source, section }` adja a `knowledge_documents` mezőit; a `content_hash` a normalizált törzs SHA-256-ja (a hash-számítás már a Story 1.3-ban van — a store CSAK tárolja a kapott hash-t, a Story 1.6 köti be az inkrementális logikát).
- **Config** (`src/config.ts`): `embeddingModel`, `embeddingDimensions` (1536), `databaseUrl`. A `loadConfig(env?)` injektálható env-vel — kövesd ezt a mintát (a `Pool`/embedder is injektálható legyen a teszthez).
- **Séma** (`db/schema.sql`): `knowledge_documents(source UNIQUE, title, game, section, content_hash, chunk_count, status, indexed_at)` + `knowledge_chunks(document_id FK CASCADE, chunk_index, heading, content, embedding vector(1536), UNIQUE(document_id, chunk_index))`. A chunkon NINCS `section` (AD-10) — a forrás-payload a dokumentum-sorból JOIN-nal jön.

### 🚨 Gotcha-k

1. **Új függőségek — ez az első modell- és DB-hívó story.** A `package.json` eddig csak `dotenv`+`zod`. Fel kell venni: `ai` + `@ai-sdk/openai` (embedding), `pg` + `@types/pg` (DB). Ne találj ki más klienst (nincs ORM — spine).
2. **Nincs valós OpenAI-kulcs és nincs `seed/rules` korpusz** → a valós embedding-hívás nem verifikálható a CI-ben. Ezért **injektálható seamek** (fake embedder, fake pg-kliens) — a logika kulcs/DB nélkül unit-tesztelhető. Az élő OpenAI-hívás manuális/halasztott.
3. **pgvector-formátum:** a `number[]`-t `'[0.1,0.2,…]'` literálként add át `$n`-en, cast `::vector` — ne JS-tömbként (a `pg` nem tudja vektorrá). Paraméterezve, nem interpolálva.
4. **`verbatimModuleSyntax`:** `import type` a típusokra (`Chunk`, `ParsedDocument`, `Config`). **`noUncheckedIndexedAccess`:** batch-szeletelésnél az indexelést óvatosan.
5. **Determinizmus a tesztben:** a fake embedder adjon determinisztikus vektort (pl. hossz = `embeddingDimensions`), a fake pg-kliens rögzítse a `query` hívások (szöveg + paraméterek) sorrendjét — így a tranzakció-sorrend és a paraméterezettség asszertálható.
6. **Ne bővítsd a scope-ot:** az inkrementális/hash-alapú kihagyás, a `--rebuild`, a cron-trigger és a usage-naplózás a **Story 1.6** — itt CSAK az `embed` + `store` primitívek és a dimenzió-védelem. A HyDE/rerank/retrieve a Story 2.1.

### Nyitott döntés (dev döntheti, jelölje a Completion Notesban)

- **pg-kliens:** `pg` (node-postgres) az alap ajánlás (mainstream, paraméterezett SQL, `pool.connect()` tranzakcióhoz). Ha a dev a `postgres` (porsager) mellett dönt, indokolja — de a spine „nincs ORM" kényszere mindkettőnél teljesül.
- **Halasztott (Story 1.2 review-ból):** `vector(1536) ↔ EMBEDDING_DIMENSIONS` fail-fast — EZ a story valósítja meg (AC-2).

### Project Structure Notes

- Új: `src/rag/embed.ts` (+ `embed.spec.ts`), `src/rag/store.ts` (+ `store.spec.ts`). Ez az első `src/rag/` modul. Módosul: `package.json` (függőségek).
- „Egy fogalom = egy könyvtár"; a fájlnév hordozza a szerepét. A közös pg-`Pool` létrehozása a `store.ts`-ben (a `config.databaseUrl`-ből), injektálhatóan.

### Testing Standards

- Vitest, TDD, spec a kód mellett. A determinisztikus/tiszta seameket fedd (dimenzió-guard, pgvector-literál, batch-darabolás, tranzakció-vezérlés fake klienssel). Ne írj tesztet, ami valós OpenAI-t vagy élő DB-t igényel a zöld-kapuhoz. Az élő DB-verifikáció (T7) opcionális, kézi, szintetikus vektorral, kulcs nélkül.

### References

- [Source: epics.md#Story-1.5] AC-k; [Source: prd.md#FR-3, #FR-11].
- [Source: ARCHITECTURE-SPINE.md#AD-3] embedding-tér + dimenzió; [#AD-5] tranzakció/CASCADE; [#AD-9] függőségi irány; [#AD-11] usage; [#Stack] verziók; [#Structural-Seed] rag/ elhelyezés.
- [Source: docs/ARCHITEKTURA.md#2.2] insert/módosítás tranzakcióban; [Source: docs/routing.md#3] embedding-modell indoklás (batch, 1536, magyar).
- Bemenet: `src/ingest/chunk.ts` (`Chunk`), `src/ingest/parse-document.ts` (`ParsedDocument`, `FrontMatter`), `src/config.ts` (`Config`), `db/schema.sql`.
- Előző story tanulságai: [1-4-determinisztikus-chunkolas.md#Dev-Notes] (TDD-ritmus, `import type`, `noUncheckedIndexedAccess`), [1-2-tudasbazis-sema.md#Dev-Notes] (séma, CASCADE, Windows/pnpm shell-gotchák).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`) — Cursorból (Claude Code limit után folytatva).

### Debug Log References

- RED: `pnpm test src/rag/embed.spec.ts` és `.../store.spec.ts` az implementáció előtt → import bukik ("no tests").
- GREEN: `embed.spec.ts` 7/7, `store.spec.ts` 9/9; teljes csomag 42 → **58** teszt zöld.
- Zöld-kapu: `pnpm typecheck` OK, `pnpm lint` OK, `pnpm format:check` OK (a 4 új fájl `pnpm format`-tal formázva).
- T7 élő DB (szintetikus 1536-dim vektor, OpenAI nélkül): `INSERT → {documentId, chunkCount:2}`, `SEARCH` 2 találat, `LIST` `chunk_count:2`, `DELETE` → chunk-szám 2→0 (CASCADE). Ideiglenes verify-szkript futtatás után törölve.

### Completion Notes List

- `src/rag/embed.ts`: `embedTexts(texts, deps)` tiszta batchelő (≤100), sorrendtartó, per-vektor dimenzió-guard (`EmbedError`), usage-aggregálás. `checkEmbeddingDimensions` a séma (`SCHEMA_VECTOR_DIM=1536`) vs. konfiguráció fail-fast (AD-3). `createOpenAIEmbedBatch(config)` a valós `embedMany` + `openai.embedding(config.embeddingModel)` köré (a modellnév csak configból — AD-6); a hálózati rész vékony factory, nem unit-tesztelt.
- `src/rag/store.ts`: `Db`/`DbClient` port + `createPgDb(databaseUrl)` `pg.Pool`-adapter. `createStore(db, {dimensions})`: `insert` egy tranzakcióban (dimenzió-guard a DB-nyitás előtt; `BEGIN`→upsert dok `ON CONFLICT(source)`→régi chunkok törlése→chunkok→`COMMIT`; hibán `ROLLBACK`+`release`), `search` koszinusz `<=>` csak `active` dokumentumokon forrás-payloaddal, `list`, `delete` (CASCADE). Minden mutáció paraméterezett SQL, a vektor `$n::vector` literálként.
- **Döntés:** pg-kliens = `pg` (node-postgres) — mainstream, paraméterezett SQL, `pool.connect()` tranzakcióhoz; a spine „nincs ORM" kényszere teljesül.
- **AD-3 fail-fast** (halasztva a Story 1.2 review-ból) megvalósítva: kétszintű — konfiguráció↔séma (`checkEmbeddingDimensions`) + modell-kimenet↔konfiguráció (embed) + store-beírás↔konfiguráció (`assertDimensions`).
- Scope tartva: nincs inkrementális/hash-kihagyás, `--rebuild`, cron, usage-naplózás (Story 1.6); nincs HyDE/rerank/retrieve (Story 2.1).

### File List

- `src/rag/embed.ts` (új)
- `src/rag/embed.spec.ts` (új)
- `src/rag/store.ts` (új)
- `src/rag/store.spec.ts` (új)
- `package.json` (módosítva — `ai`, `@ai-sdk/openai`, `pg` deps + `@types/pg` devDep)
- `pnpm-lock.yaml` (módosítva — új függőségek)

### Change Log

- 2026-07-18: Story 1.5 implementálva — `rag/embed` (batch + dimenzió-guard + usage) és `rag/store` (tranzakciós insert/search/list/delete, pgvector), TDD 16 új teszt (42→58), élő DB-verifikáció szintetikus vektorral. Status → review.
