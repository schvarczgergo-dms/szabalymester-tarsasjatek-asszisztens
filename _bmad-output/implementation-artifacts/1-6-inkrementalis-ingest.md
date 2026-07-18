---
baseline_commit: c67edbb
---

# Story 1.6: Inkrementális ingest-futás

Status: ready-for-dev

## Story

As a üzemeltető,
I want hash-alapú inkrementális ingestet `--rebuild` opcióval,
so that csak a változott tartalom vektorizálódik újra, és a frissítés olcsó, konzisztens.

## Acceptance Criteria

1. **Hash-alapú változásérzékelés (FR-4, AD-5):** a `pnpm ingest` a `seed/rules/*.md` korpuszt beolvassa, minden dokumentumra `contentHash(normalize(raw))`-t számol, és a `knowledge_documents.content_hash`-sel összeveti: **egyező hash → kihagyás (0 embedding-hívás)**; **eltérő → módosult** (régi chunkok törlése + újra-chunk + újra-embedding EGY tranzakcióban); **nincs a DB-ben → új**.
2. **Törlés soft-delete audit-nyommal + újraélesztés (FR-4, AD-5):** a forrásból eltűnt (a korpuszban már nem szereplő) dokumentum `status = deleted`-re vált, a chunkjai törlődnek (`chunk_count = 0`), a dokumentum-sor audit-nyomként MEGMARAD; a visszatérő forrás a meglévő sort újraéleszti (`status = active`), és a **hash dönt** az újravektorizálásról.
3. **`--rebuild` és pipeline-verzió (FR-5):** `pnpm ingest --rebuild` a hash-től FÜGGETLENÜL mindent újravektorizál (minden jelen lévő dokumentum újra-chunk + újra-embedding). A `PIPELINE_VERSION` konstans változása is teljes újraépítést KÖVETEL — ezt a dokumentáció/`--rebuild` kényszeríti ki (a tárolt `pipeline_version` oszlop + auto-detektálás spine-Deferred, itt NEM épül).
4. **Usage-naplózás (FR-23 részben, AD-11):** minden embedding-hívás usage-e (token) aggregálódik, és a futás végén egy összesítő riport íródik (új/módosult/kihagyott/törölt dokumentumok száma + embedding-hívások + token). A retrieval/válasz usage a Story 2.x/3.3.
5. **Determinizmus + tesztelhetőség (NFR-3, NFR-2):** a szinkron-döntés (`skip|insert|update|delete`) tiszta, injektált fake-ekkel (korpusz-olvasó, embedder, store) **unit-tesztelt** — valós OpenAI-kulcs és korpuszfájlok nélkül. A `pnpm ingest` (fs + OpenAI + pg wiring) vékony, kézzel futtatható belépőpont; egy hiba egy dokumentumon nem dönti el a teljes futást (a hiba beszédesen jelződik).

## Tasks / Subtasks

- [ ] **T1: Store bővítése a szinkronhoz** (AC: 1, 2) — UPDATE `src/rag/store.ts` (+ `store.spec.ts`)
  - [ ] `listForSync() → { source, contentHash, status }[]` — a döntéshez kell a meglévő hash + státusz (a `list()` ezt nem adja). Paraméterezett SQL.
  - [ ] `markDeleted(source)` — soft-delete: `UPDATE knowledge_documents SET status='deleted', chunk_count=0 WHERE source=$1` + a chunkok törlése (CASCADE-t nem vált ki az UPDATE, ezért explicit `DELETE FROM knowledge_chunks ... WHERE document_id=(SELECT id ...)` egy tranzakcióban). A dokumentum-sor MEGMARAD (audit).
  - [ ] Tesztek: `listForSync`/`markDeleted` helyes paraméterezett SQL + `markDeleted` tranzakció-sorrend fake klienssel.
- [ ] **T2: `src/ingest/ingest.spec.ts` — a szinkron-döntés tesztjei (TDD, RED)** (AC: 1, 2, 3, 5)
  - [ ] `planSync(corpus, existing, { rebuild }) → { toUpsert, toDelete, toSkip }` PURE függvény tesztjei:
  - [ ] egyező hash → `toSkip` (nincs embedding); eltérő hash → `toUpsert`; új source → `toUpsert`.
  - [ ] a korpuszból eltűnt `active` dokumentum → `toDelete`; a visszatérő (korpuszban újra ott lévő) dokumentum → `toUpsert` (nem marad deleted).
  - [ ] `rebuild: true` → minden jelen lévő dokumentum `toUpsert`, `toSkip` üres (a hash-t nem nézi).
  - [ ] `runIngest` integrációs tesztje injektált fake-ekkel: a `toSkip` dokumentumokra NEM hív embeddert; a riport-számok stimmelnek; egy dokumentum parse-hibája nem állítja le a többit.
- [ ] **T3: `src/ingest/ingest.ts` — orchestráció (GREEN)** (AC: 1, 2, 3, 4)
  - [ ] `PIPELINE_VERSION` konstans (kommentben: változása `--rebuild`-et követel — spine-Deferred a tárolt oszlop).
  - [ ] `planSync(...)` tiszta döntés (a fenti szignatúra); a hash-összevetés a `contentHash(parsed.body)` és az `existing` `content_hash` közt.
  - [ ] `runIngest(deps, opts)`: beolvas → parse-ol (`parseDocument`) → chunkol (`chunkDocument`) → a `toUpsert` chunk-`content`-jeit **egyszer** batch-embeddeli (`embedTexts`) → `store.insert` (tranzakció, upsert+revival) → `toDelete`-re `store.markDeleted` → usage aggregálás → `IngestReport`.
  - [ ] `deps` = injektált külvilág: `readCorpus` (fs `seed/rules/*.md`), `embed` (a `createOpenAIEmbedBatch`+`embedTexts` köré), `store`. A tiszta lépések (`parseDocument`, `chunkDocument`, `contentHash`) közvetlen import.
  - [ ] Beszédes hiba-izoláció: egy dokumentum hibája a riportba kerül, a futás a többivel folytatódik (NFR-2 szellemében).
- [ ] **T4: `pnpm ingest` belépőpont + `--rebuild`** (AC: 3) — UPDATE `package.json`
  - [ ] `"ingest": "tsx src/ingest/ingest.ts"`; a `main()` `loadConfig()`-gal (fail-fast), a valós deps-szel, `process.argv`-ból a `--rebuild` flaggel; a végén a riportot kiírja.
- [ ] **T5: Zöld-kapu** (AC: 5) — `pnpm test` (60 + újak) + `pnpm typecheck · lint · format:check` zöld.
- [ ] **T6 (opcionális): Élő ingest-próba** — CSAK ha van `seed/rules` korpusz ÉS `OPENAI_API_KEY`. Egyébként dokumentáltan halasztva (a korpusz-seed külön feladat); a döntés-logikát a unit tesztek fedik.

## Dev Notes

### Kényszerek

- **AD-5 (inkrementális mag):** a változatlan dokumentum NEM vektorizálódik újra (hash-egyezés); a módosult dokumentum cseréje (régi chunk-törlés + új insert + hash-update) EGY tranzakcióban atomi; a törölt dokumentum `status='deleted'` **audit-nyomként megmarad**, a chunkjai törlődnek; a visszatérő forrás a meglévő sort újraéleszti, a hash dönt. [Source: ARCHITECTURE-SPINE.md#AD-5, docs/ARCHITEKTURA.md#2]
- **FR-5 / pipeline-verzió:** `--rebuild` a hash-független teljes újraépítés útja; a `pipeline_version` tárolt oszlop + auto-detektálás **spine-Deferred** — most `PIPELINE_VERSION` konstans + dokumentált `--rebuild`-kényszer. NE adj hozzá sémaoszlopot. [Source: #Deferred, epics.md#Story-1.6]
- **AD-11 (usage):** minden embedding-hívás usage-e aggregálódik és riportálódik; az `embedTexts` MÁR visszaadja a token-usage-t (Story 1.5). [Source: #AD-11]
- **AD-9 (függőségi irány):** az `ingest` importálja a `rag/embed`-et és a `rag/store`-t (ingest → rag); NE fordítva. A tiszta parse/chunk a `src/ingest/`-ből. [Source: #AD-9]

### Bemenet és interfészek (a meglévő kódból)

- **`src/ingest/parse-document.ts`:** `parseDocument(raw) → ParsedDocument` (fail-fast), `normalize(raw)`, `contentHash(text) → hex SHA-256`. A hash a `parsed.body`-ból: `contentHash(parsed.body)`.
- **`src/ingest/chunk.ts`:** `chunkDocument(ParsedDocument, ChunkOptions?) → Chunk[]` (a `content` fejléces — ezt kell embeddelni és tárolni).
- **`src/rag/embed.ts` (Story 1.5):** `embedTexts(texts, { embedBatch, dimensions })` batch + dimenzió-guard + usage; `createOpenAIEmbedBatch(config)` a valós hívás; `checkEmbeddingDimensions(config.embeddingDimensions)` a wiringben fail-fast.
- **`src/rag/store.ts` (Story 1.5):** `createStore(db, { dimensions })` → `insert(doc, chunks)` (tranzakciós upsert+revival: az `insert` `ON CONFLICT(source)` már `status='active'`-ra állít → az újraélesztés ingyen jön), `search`, `list`, `delete`. **Ez a story bővíti** `listForSync`-kel és `markDeleted`-tel.
- **`src/config.ts`:** `loadConfig()` (fail-fast), `embeddingModel`, `embeddingDimensions`, `databaseUrl`.
- **Séma:** `knowledge_documents.content_hash` (a hash tárolása); `status active|deleted`. Nincs `pipeline_version` oszlop (Deferred).

### 🚨 Gotcha-k

1. **Nincs `seed/rules` korpusz és nincs valós OpenAI-kulcs** → a valós `pnpm ingest` most nem fut le CI-ben. Ezért a **döntés-logika (`planSync`) tiszta és unit-tesztelt** injektált fake-ekkel; a fs+OpenAI+pg wiring vékony `main()`. Az élő próba (T6) opcionális/halasztott.
2. **A revival majdnem ingyen:** a Story 1.5 `insert` `ON CONFLICT(source) DO UPDATE ... status='active'` — a visszatérő dokumentum újra-insertje automatikusan újraéleszt. A `markDeleted` csak az eltűnt dokumentumokra fut.
3. **`markDeleted` ≠ `delete`:** a `delete` (hard) a dokumentum-sort is törli; a `markDeleted` (soft) MEGTARTJA a sort (audit) és csak a chunkokat törli + `status='deleted'`. Az UPDATE nem vált ki CASCADE-et → a chunk-törlés explicit, egy tranzakcióban.
4. **Batch-embedding egyszer:** a `toUpsert` dokumentumok ÖSSZES chunk-`content`-jét egy `embedTexts`-hívásba gyűjtsd (a ≤100 batchelést az `embedTexts` intézi), majd oszd vissza dokumentumonként a `chunk_index` szerint — ne dokumentumonként külön hívj feleslegesen.
5. **`verbatimModuleSyntax` / `noUncheckedIndexedAccess`:** `import type`; a vektor-visszaosztásnál az indexelés óvatos.
6. **Scope:** nincs HyDE/rerank/retrieve/agent (Story 2.x), nincs cron-scheduler kód (a spine szerint a cron a futtató környezet dolga — a kód `pnpm ingest`-ként kézzel ÉS cronból is hívható; NE írj node-cron schedulert).

### Project Structure Notes

- Új: `src/ingest/ingest.ts` (+ `ingest.spec.ts`). Módosul: `src/rag/store.ts` (+ `store.spec.ts`) — `listForSync`, `markDeleted`; `package.json` — `ingest` script.
- „Egy fogalom = egy könyvtár"; az ingest-orchestráció a `src/ingest/`-ben, a tárolás/embedding a `src/rag/`-ban marad (AD-9).

### Testing Standards

- Vitest, TDD, spec a kód mellett. A `planSync` tiszta döntés → sok kis eset (skip/insert/update/delete/revive/rebuild). A `runIngest` fake-ekkel: a `toSkip` NEM hív embeddert (0 hívás asszert), a riport-számok, a hiba-izoláció. Ne írj tesztet, ami valós OpenAI-t/korpuszt igényel a zöld-kapuhoz.

### References

- [Source: epics.md#Story-1.6] AC-k; [Source: prd.md#FR-4, #FR-5, #FR-23].
- [Source: ARCHITECTURE-SPINE.md#AD-5] inkrementális/tranzakció/soft-delete; [#AD-9] függőségi irány; [#AD-11] usage; [#Deferred] pipeline_version.
- [Source: docs/ARCHITEKTURA.md#2, #4] a négy kulcskérdés (változás/új/törölt/trigger) + költség-hatás.
- Bemenet: `src/ingest/parse-document.ts`, `src/ingest/chunk.ts`, `src/rag/embed.ts`, `src/rag/store.ts`, `src/config.ts`.
- Előző story tanulságai: [1-5-embedding-es-tarolas.md#Dev-Notes] (embed/store API, injektálható seamek, dimenzió-guard, tranzakció-teszt fake klienssel).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log
