# Story 1.2: Tudásbázis-séma

Status: ready-for-dev

## Story

As a fejlesztő,
I want a `knowledge_documents` + `knowledge_chunks` sémát pgvectorral,
so that a dokumentumok és a chunkjaik konzisztensen, kereshetően tárolhatók.

## Acceptance Criteria

1. A `db/schema.sql` alkalmazásakor létrejön a `knowledge_documents` (`source` UNIQUE, `game`, `section` CHECK az öt kanonikus értékre, `content_hash`, `status` CHECK `active|deleted`, `chunk_count`, `indexed_at`) és a `knowledge_chunks` (`document_id` FK **ON DELETE CASCADE**, `chunk_index`, `heading`, `content`, `embedding vector(1536)`).
2. A séma **idempotens** (újrafuttatható hiba nélkül, csak NOTICE).
3. Dokumentum törlésekor a chunkjai **CASCADE** törlődnek; árva chunk nem maradhat (NFR-5, AD-5).
4. A `section` kizárólag dokumentum-tulajdon; egy korpuszfájl egy `(game, section)` dokumentum — a `knowledge_chunks`-on NINCS `section` oszlop, a chunk a dokumentumtól örökli (AD-10).
5. A séma friss klónon (initdb-mount) és meglévő adatbázison (`pnpm db:schema`) is alkalmazható; a `docker-compose config -q` OK marad.

## Tasks / Subtasks

- [ ] **T1: `db/schema.sql`** (AC: 1, 2, 3, 4)
  - [ ] `CREATE EXTENSION IF NOT EXISTS vector;`
  - [ ] `knowledge_documents` tábla `IF NOT EXISTS`-szel: `id serial PK`, `source text NOT NULL UNIQUE`, `title text NOT NULL`, `game text NOT NULL`, `section text NOT NULL CHECK (section IN ('attekintes','elokeszules','jatekmenet','pontozas','gyik'))`, `content_hash text NOT NULL`, `chunk_count int NOT NULL DEFAULT 0`, `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted'))`, `indexed_at timestamptz NOT NULL DEFAULT now()`.
  - [ ] `knowledge_chunks` tábla `IF NOT EXISTS`-szel: `id serial PK`, `document_id int NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE`, `chunk_index int NOT NULL`, `heading text`, `content text NOT NULL`, `embedding vector(1536) NOT NULL`, `UNIQUE (document_id, chunk_index)`.
  - [ ] Indexek `IF NOT EXISTS`-szel: `idx_documents_game`, `idx_documents_status`, `idx_chunks_document`.
  - [ ] **NINCS** approximate (HNSW/IVFFlat) vektor-index — a kis korpuszon a pontos seq-scan gyors, a golden-set pontos top-K-t igényel (ld. spine Deferred); kommentben jelezd, hova kerülne nagyobb korpusznál.
- [ ] **T2: `docker-compose.yml` bővítése** (AC: 5) — UPDATE
  - [ ] A `db` service `volumes` alá: `- ./db/schema.sql:/docker-entrypoint-initdb.d/schema.sql:ro` (friss klónnál az initdb automatikusan lefuttatja).
- [ ] **T3: `db:schema` script** (AC: 5) — UPDATE `package.json`
  - [ ] `"db:schema": "docker compose exec -T db psql -U szabalymester -d szabalymester -f /docker-entrypoint-initdb.d/schema.sql"`
- [ ] **T4: Élő DB-verifikáció** (AC: 1-4)
  - [ ] `docker compose up -d` (a mount miatt újralétrehozza a konténert; a `pgdata` kötet megmarad), majd `pnpm db:schema`.
  - [ ] `\d knowledge_documents` és `\d knowledge_chunks`: oszlopok, FK CASCADE, indexek, CHECK-ek helyesek.
  - [ ] Idempotencia: `pnpm db:schema` másodszor → csak NOTICE, nincs hiba.
  - [ ] CASCADE: tranzakcióban insert dokumentum + chunk (`array_fill(0.1, ARRAY[1536])::vector`), majd dokumentum-törlés → chunk-szám 1→0; ROLLBACK.
  - [ ] CHECK: rossz `section` és rossz `status` insert elutasítva.

## Dev Notes

### Forrás és kényszerek

- **ERD + kanonikus séma:** [Source: ARCHITECTURE-SPINE.md#Structural-Seed] (ERD) és [#AD-5] (tranzakciós konzisztencia, CASCADE, `content_hash` a normalizált törzsből — a hash-számítás maga a Story 1.3/1.6, itt csak az oszlop).
- **AD-10 (dokumentum-granularitás):** a `section` dokumentum-szintű; a `knowledge_chunks`-on szándékosan NINCS `section`. A `heading` a chunk breadcrumbja (finomabb, mint a szakasz), az AD-4 fejléc a `content`-be van sütve — a `heading` csak megjelenítéshez/debughoz.
- **AD-3:** az `embedding vector(1536)` dimenziója a `config.embeddingDimensions` (1536) defaulttal egyezik; a dimenzió-egyezés fail-fast ellenőrzése a Story 1.5 (embed) feladata, itt a séma rögzíti a 1536-ot.

### 🚨 Kritikus gotcha-k (a Story 1.1 tanulságaiból)

1. **`db:schema` script — beégetett user/db, NEM nested shell.** A korábbi `sh -c 'psql -U "$POSTGRES_USER" ...'` forma a pnpm/Windows shellen `Unterminated quoted string`-gel elhasal. Használd a beégetett `-U szabalymester -d szabalymester` formát (a compose alapértelmezései).
2. **A mount csak friss kötetnél fut automatikusan.** Mivel a `pgdata` kötet a Story 1.1-ből már létezik és nem üres, a `docker compose up -d` újralétrehozza a konténert (felveszi a mountot), de az initdb NEM fut újra → a sémát a `pnpm db:schema` alkalmazza. (Friss klónnál viszont az initdb automatikusan lefuttatja.)
3. **Idempotencia:** minden `CREATE ... IF NOT EXISTS`; a `CREATE EXTENSION IF NOT EXISTS vector` másodszor NOTICE-t ad (nem hiba).
4. **A DB már fut** (`szabalymester-db`, Story 1.1) — nem kell nulláról indítani.

### Project Structure Notes

- Új: `db/schema.sql`. Módosul: `docker-compose.yml` (mount), `package.json` (`db:schema` script).
- „Egy fogalom = egy könyvtár": a séma egyetlen `db/schema.sql` (nincs ORM). [Source: ARCHITECTURE-SPINE.md#Structural-Seed]

### Testing Standards

- Ez **infrastruktúra/SQL**, nincs determinisztikus függvény → nem Vitest-unit, hanem **élő DB-verifikáció** (T4): struktúra (`\d`), idempotencia, CASCADE, CHECK. A Vitest-teszt itt nem alkalmazandó (a chunk/parse determinisztikus tesztjei a Story 1.3/1.4-ben jönnek). Ne írj öncélú „mock" tesztet a sémára.

### References

- [Source: epics.md#Story-1.2] AC-k.
- [Source: prd.md#FR-3] tranzakciós tárolás; [#NFR-5] konzisztencia.
- [Source: ARCHITECTURE-SPINE.md#AD-5] tranzakció + CASCADE; [#AD-10] dokumentum-granularitás; [#Structural-Seed] ERD.
- Előző story tanulságai: [1-1-projektvaz-es-konfiguracio.md#Dev-Notes] (docker, db:schema minta).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
