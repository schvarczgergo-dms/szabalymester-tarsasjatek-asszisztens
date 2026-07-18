---
baseline_commit: b230367
---

# Story 1.3: Dokumentum-parse

Status: review

## Story

As a fejlesztő,
I want determinisztikus, unit-tesztelt dokumentum-parse-ot,
so that a korpusz megbízhatóan, zaj nélkül kerül a pipeline-ba, és a hash stabil.

## Acceptance Criteria

1. A parse validálja a kötelező front mattert (`title`, `game`, `source`, `section`); érvénytelen `section` vagy hiányzó mező **beszédes hibát** ad (a mezőt/fájlt megnevezve), a futás nem áll le némán (FR-1).
2. Egyetlen tiszta `normalize(raw) → string` állítja elő a törzset (front-matter-strip → zaj-szűrés → `\r\n`/`\r`→`\n` → soronkénti trailing-WS trim → 3+ üres sor összevonása → záró trim; **kisbetűsítés NÉLKÜL**); ebből származik a `content_hash` és a chunker bemenete (FR-2, AD-5).
3. A parse és a `normalize` **determinisztikus** (`(string) → …` tiszta függvény) és **unit-tesztelt**; a validálás és a normalizálás határeseteit tesztek fedik (NFR-3, AD-4).

## Tasks / Subtasks

- [x] **T1: `src/ingest/parse-document.spec.ts` — előbb a tesztek (TDD, RED)** (AC: 1, 2, 3)
  - [x] `parseDocument`: érvényes dokumentum → helyes `frontMatter` + `body`; hiányzó front matter → `ParseError`; hiányzó/érvénytelen mező (`section` nem a kanonikus öt) → `ParseError` a mező nevével.
  - [x] `normalize`: `\r\n`/`\r` → `\n`; soronkénti trailing whitespace levágva; 3+ egymást követő üres sor 1-re; front matter eltávolítva; zaj-sorok (©/„Minden jog fenntartva"/kiadói URL) kiszűrve; **NEM** kisbetűsít.
  - [x] determinizmus: ugyanaz a bemenet mindig ugyanaz a kimenet; `contentHash(normalize(x))` stabil, és whitespace/kiadói-sor változásra NEM változik, érdemi tartalomváltozásra IGEN.
- [x] **T2: `src/ingest/parse-document.ts` — implementáció (GREEN)** (AC: 1, 2, 3)
  - [x] Típusok: `Section` (`'attekintes'|'elokeszules'|'jatekmenet'|'pontozas'|'gyik'` — egyezik a `db/schema.sql` CHECK-jével), `FrontMatter` (`title,game,source,section`), `ParsedDocument` (`frontMatter`, `body`), `ParseError extends Error`.
  - [x] Front matter: **dependency-mentes** parse — a vezető `---\n…\n---\n` blokk kivágása regexszel; a flat `kulcs: érték` sorok objektummá; a törzs a maradék. (NE húzz be új YAML-libet — a front matter lapos; ha később nem-lapos kell, akkor jön `js-yaml`.)
  - [x] Validáció **Zod-dal** (a `config.ts` mintája szerint): a `FrontMatter` séma; hiányzó/rossz mező → `ParseError` beszédes, magyar, a mezőt (és ha van, a `source`-ot) megnevező üzenettel.
  - [x] `normalize(raw)`: az AC-2 lépéssora, tiszta függvény; a `stripNoise` determinisztikus regex-készlet (©/copyright, „Minden jog fenntartva", `www.gemklub`/kiadói URL, csak-illusztráció `![...]()` sor). `contentHash(text)`: `node:crypto` `createHash('sha256')` hex.
  - [x] `parseDocument(raw)`: front matter kivágás → Zod-validáció → `{ frontMatter, body: normalize(raw) }`.
- [x] **T3: Zöld-kapu** (AC: 3)
  - [x] `pnpm test` (a régi 13 + az újak) zöld; `pnpm typecheck && pnpm lint && pnpm format:check` zöld.

## Dev Notes

### Kulcs-döntések és kényszerek

- **AD-5 — egyetlen `normalize()`:** ez a hash ÉS a chunker közös forrása; így a whitespace/kiadói-sor változása NEM triggerel újravektorizálást, csak az érdemi tartalom. Ezt egy teszt is asszertálja (contentHash stabilitás). [Source: ARCHITECTURE-SPINE.md#AD-5]
- **AD-4 — determinizmus + teszt:** a parse tiszta `(string) → ParsedDocument` függvény, TDD-vel (előbb a spec). [Source: ARCHITECTURE-SPINE.md#AD-4]
- **AD-10 — `section`:** a parse a dokumentum `section`-jét adja vissza; a chunker ezt kapja inputként (nem `##`-ból). A `Section` enum egyezik a `db/schema.sql` CHECK-jével. [Source: ARCHITECTURE-SPINE.md#AD-10]
- **Kisbetűsítés NÉLKÜL:** a normalizálás megőrzi a kis/nagybetűt (a szabály-szöveg jelentése számít); csak whitespace/zaj-normalizálás.

### 🚨 Gotcha-k (az 1.1/1.2 tanulságaiból)

1. **Zod 4:** nincs `required_error` — a `config.ts` `required()`/preprocess mintáját kövesd; hibaaggregáció egyetlen `ParseError`-ba, a mezőt megnevezve.
2. **Ne húzz be új függőséget** (a dev-story különben HALT-ol): a front matter lapos, saját mini-parser elég; a hash `node:crypto` (beépített).
3. **`verbatimModuleSyntax`:** típus-importra `import type`; `node:crypto` import a `node:` prefixszel.
4. **`noUncheckedIndexedAccess`:** a regex-match/`split` eredményét óvatosan indexeld (lehet `undefined`).

### Project Structure Notes

- Új: `src/ingest/parse-document.ts` + `src/ingest/parse-document.spec.ts` (a teszt a kód mellett). Ez az első fájl a `src/ingest/` alatt. [Source: ARCHITECTURE-SPINE.md#Structural-Seed]
- Nincs UPDATE-fájl (tisztán új modul); a `config.ts`-t csak mintaként olvasd, ne módosítsd.

### Testing Standards

- Vitest, TDD (RED → GREEN), spec a kód mellett; `describe/it/expect` importból. Explicit string-bemenetek (nincs fájlrendszer-függés a unit-tesztben). Fedendő élek: hiányzó front matter, hiányzó mező, rossz `section`, CRLF, trailing WS, több üres sor, zaj-sor, hash-stabilitás (whitespace-változás vs. tartalomváltozás), kis/nagybetű megőrzése.

### References

- [Source: epics.md#Story-1.3] AC-k (FR-1, FR-2, NFR-3).
- [Source: prd.md#FR-1] parse/validálás; [#FR-2] zaj-szűrés + normalizálás.
- [Source: ARCHITECTURE-SPINE.md#AD-4] determinizmus/teszt; [#AD-5] normalize/hash; [#AD-10] section.
- [Source: db/schema.sql] `section` CHECK értékek (a `Section` enum forrása).
- Előző story-k: [1-1…md] (config.ts Zod-minta), [1-2…md] (section enum).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- RED: `pnpm test` a `parse-document.ts` előtt → a spec import bukik (13 config zöld).
- GREEN: implementáció után 25/25 teszt (13 config + 12 parse).
- Zöld-kapu: `typecheck · lint · format:check · test` mind zöld.

### Completion Notes List

- `src/ingest/parse-document.ts` (első fájl a `src/ingest/` alatt): `parseDocument`, `normalize`, `contentHash`, `Section`/`FrontMatter`/`ParsedDocument`/`ParseError`.
- **AD-5:** egyetlen `normalize()` (front-matter-strip → zaj-szűrés → `\r\n`→`\n` → trailing-WS → 3+ üres sor összevonás → trim, kisbetűsítés NÉLKÜL) a hash ÉS a chunker közös forrása; teszt igazolja, hogy a whitespace-változás nem, a tartalomváltozás igen módosítja a `contentHash`-t.
- **Dependency-mentes** front-matter parse (lapos `kulcs: érték`, idézőjel- és inline-komment-kezeléssel); a hash `node:crypto`. Nem kellett új függőség.
- Zod-validáció a `config.ts` mintája szerint; hiba → `ParseError` a mezőt megnevezve. A `Section` enum egyezik a `db/schema.sql` CHECK-jével (AD-10).
- 12 unit teszt fedi: érvényes doc, hiányzó front matter, hiányzó mező, rossz section, inline komment, CRLF, trailing WS, üres sorok, zaj-szűrés, kis/nagybetű-megőrzés, determinizmus, hash-stabilitás.

### File List

- `src/ingest/parse-document.ts` (új)
- `src/ingest/parse-document.spec.ts` (új)

### Change Log

- 2026-07-18: Story 1.3 implementálva — dokumentum-parse + normalize + contentHash, TDD (RED→GREEN), 25/25 teszt. Status → review.
