---
baseline_commit: 2770aa2
---

# Story 1.4: Determinisztikus chunkolás játéknév-fejléccel

Status: review

## Story

As a fejlesztő,
I want szakasz-alapú chunkolást játéknév-fejléccel, TDD-vel,
so that a keresés játékok között is elkülönít, és a szabály-egységek nem törnek szét.

## Acceptance Criteria

1. Szakasz-alapú (heading-aware) darabolás: a `##`/`###` alcímek mentén; a hosszú, nem-lista bekezdés a felső korlát (`maxChars`) felett mondathatáron vágódik (FR-6).
2. Minden chunk `content`-je = `Játék > breadcrumb\n\n<szöveg>` (alcím nélkül `Játék\n\n<szöveg>`); a `game` a `ParsedDocument.frontMatter`-ből, a breadcrumb a markdown alcím-útból; a chunk `heading` mezője a breadcrumb (FR-7, AD-4, AD-10).
3. Lista-integritás (számozott/pontozott lista egyben, akár a felső korlát felett is), törpe-szakasz (< `dwarfChars`) összevonása a következővel, szakaszon belüli átfedés (az utolsó bekezdés átmegy), szakasz-határon NINCS átfedés; a `chunkIndex` folytonos (FR-8).
4. `chunkDocument(doc, opts) → Chunk[]` tiszta, determinisztikus függvény, **unit-tesztelt** (TDD); a kulcsdöntéseket külön tesztek fedik (FR-9, NFR-3, AD-4).

## Tasks / Subtasks

- [x] **T1: `src/ingest/chunk.spec.ts` — előbb a tesztek (TDD, RED)** (AC: 1-4)
  - [x] rövid dokumentum → egyetlen chunk; alcímnél új chunk + a breadcrumb a `heading`-ben.
  - [x] **játéknév-fejléc**: minden chunk `content`-je a `game`-mel kezdődik.
  - [x] lista nem vágódik ketté (egy számozott lépéslista egy chunkban, akár a korlát felett).
  - [x] törpe-szakasz összevonódik a következővel.
  - [x] szakaszon belüli vágásnál átfedés (utolsó bekezdés); szakasz-határon nincs.
  - [x] hosszú, nem-lista bekezdés mondathatáron vágódik.
  - [x] `chunkIndex` folytonos a dokumentumon belül; determinizmus (kétszeri hívás azonos).
- [x] **T2: `src/ingest/chunk.ts` — implementáció (GREEN)** (AC: 1-4)
  - [x] Típusok: `Chunk` (`chunkIndex`, `heading`, `content`), `ChunkOptions` (`targetChars`=1000, `maxChars`=1500, `dwarfChars`=200). Bemenet: `ParsedDocument` (a `1.3` `parse-document`-ből).
  - [x] Szakaszokra bontás alcím-stack szerint (breadcrumb `' > '`-vel); blokkok (bekezdés/lista) üres sor mentén; lista = minden nem-üres sora `^\s*([-*]|\d+\.)\s`.
  - [x] Csomagolás `targetChars`-ig; lista atomi (korlát felett is); hosszú bekezdés mondathatáron (`. ! ?`) vágva `maxChars`-ig; törpe-szakasz carry-forward a következőbe; szakaszon belüli átfedés az utolsó bekezdéssel.
  - [x] `content` = `formatHeader(game, breadcrumb)\n\n<szöveg>`; `chunkIndex` globális folytonos.
- [x] **T3: Zöld-kapu** (AC: 4) — `pnpm test` (a régi 28 + újak) + `typecheck · lint · format:check` zöld.

## Dev Notes

### Kényszerek

- **AD-4 (fejléc + determinizmus):** a `content` a fejléccel EGYÜTT az embed-bemenet; tiszta függvény, TDD. [Source: ARCHITECTURE-SPINE.md#AD-4]
- **AD-10:** a `section` a dokumentumtól jön (a `ParsedDocument.frontMatter.section`), a chunker NEM `##`-ból parse-olja a szekciót; a breadcrumb a markdown alcím-út (finomabb, mint a szekció). [Source: #AD-10]
- **Bemenet:** a `1.3` `parseDocument` kimenete (`{ frontMatter: { game, section, … }, body }`); a `body` már normalizált (nincs front matter, nincs zaj). Importáld a típust `import type`-tal.
- Paraméterek (kiindulás): `targetChars ~1000`, `maxChars ~1500`, `dwarfChars ~200` (chunking-strategia). A golden set később hangolhatja — env-be most NEM kell tenni.

### 🚨 Gotcha-k

1. **`verbatimModuleSyntax`:** `import type { ParsedDocument } from './parse-document'`.
2. **`noUncheckedIndexedAccess`:** a `split`/match indexelést óvatosan (`?? ''`).
3. **Determinizmus:** nincs `Date`/`random`; a kimenet csak a bemenettől függ. Egy teszt kétszer hívja és egyenlőséget vár.
4. **Ne túlbonyolítsd:** nincs LLM-alapú semantic chunking, nincs mondat-ablakozás (spine Non-Goals). Determinista, szabály-alapú darabolás.

### Project Structure Notes

- Új: `src/ingest/chunk.ts` + `src/ingest/chunk.spec.ts`. A `parse-document.ts`-t csak importálod (nem módosítod).

### Testing Standards

- Vitest, TDD, spec a kód mellett; explicit string/objektum bemenetek. Fedendő: a 8 kulcs-eset (ld. chunking-strategia §4) + a fejléc-formátum.

### References

- [Source: epics.md#Story-1.4]; [chunking-strategia.md] (a teljes stratégia + a 8 teszt); [ARCHITECTURE-SPINE.md#AD-4, #AD-10].
- Bemenet: [parse-document.ts] (`ParsedDocument`, `Section`).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- RED: `pnpm test` a `chunk.ts` előtt → spec import bukik. GREEN után 38/38 (13 config + 15 parse + 10 chunk).
- Zöld-kapu: typecheck · lint · format:check mind zöld.

### Completion Notes List

- `src/ingest/chunk.ts`: `chunkDocument(ParsedDocument, ChunkOptions) → Chunk[]`, tiszta/determinisztikus (AD-4).
- Szakasz-alapú (heading-stack breadcrumb), lista-integritás (atomi, max felett is), törpe-szakasz carry-forward, szakaszon belüli átfedés (utolsó bekezdés), szakasz-határon nincs, hosszú bekezdés mondathatáron, folytonos `chunkIndex`.
- `content` = `game > breadcrumb\n\n<szöveg>` (AD-4 fejléc a content-be sütve); a szekció a dokumentumtól (AD-10) — a chunker a markdown breadcrumbot használja, nem a front-matter szekciót.
- 10 unit teszt fedi a chunking-strategia 8 kulcs-esetét + a fejléc-formátumot + determinizmust.

### File List

- `src/ingest/chunk.ts` (új)
- `src/ingest/chunk.spec.ts` (új)

### Change Log

- 2026-07-18: Story 1.4 implementálva — determinisztikus chunkolás játéknév-fejléccel, TDD, 38/38 teszt. Status → review.
