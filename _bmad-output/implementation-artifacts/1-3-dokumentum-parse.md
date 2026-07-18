# Story 1.3: Dokumentum-parse

Status: ready-for-dev

## Story

As a fejlesztő,
I want determinisztikus, unit-tesztelt dokumentum-parse-ot,
so that a korpusz megbízhatóan, zaj nélkül kerül a pipeline-ba, és a hash stabil.

## Acceptance Criteria

1. A parse validálja a kötelező front mattert (`title`, `game`, `source`, `section`); érvénytelen `section` vagy hiányzó mező **beszédes hibát** ad (a mezőt/fájlt megnevezve), a futás nem áll le némán (FR-1).
2. Egyetlen tiszta `normalize(raw) → string` állítja elő a törzset (front-matter-strip → zaj-szűrés → `\r\n`/`\r`→`\n` → soronkénti trailing-WS trim → 3+ üres sor összevonása → záró trim; **kisbetűsítés NÉLKÜL**); ebből származik a `content_hash` és a chunker bemenete (FR-2, AD-5).
3. A parse és a `normalize` **determinisztikus** (`(string) → …` tiszta függvény) és **unit-tesztelt**; a validálás és a normalizálás határeseteit tesztek fedik (NFR-3, AD-4).

## Tasks / Subtasks

- [ ] **T1: `src/ingest/parse-document.spec.ts` — előbb a tesztek (TDD, RED)** (AC: 1, 2, 3)
  - [ ] `parseDocument`: érvényes dokumentum → helyes `frontMatter` + `body`; hiányzó front matter → `ParseError`; hiányzó/érvénytelen mező (`section` nem a kanonikus öt) → `ParseError` a mező nevével.
  - [ ] `normalize`: `\r\n`/`\r` → `\n`; soronkénti trailing whitespace levágva; 3+ egymást követő üres sor 1-re; front matter eltávolítva; zaj-sorok (©/„Minden jog fenntartva"/kiadói URL) kiszűrve; **NEM** kisbetűsít.
  - [ ] determinizmus: ugyanaz a bemenet mindig ugyanaz a kimenet; `contentHash(normalize(x))` stabil, és whitespace/kiadói-sor változásra NEM változik, érdemi tartalomváltozásra IGEN.
- [ ] **T2: `src/ingest/parse-document.ts` — implementáció (GREEN)** (AC: 1, 2, 3)
  - [ ] Típusok: `Section` (`'attekintes'|'elokeszules'|'jatekmenet'|'pontozas'|'gyik'` — egyezik a `db/schema.sql` CHECK-jével), `FrontMatter` (`title,game,source,section`), `ParsedDocument` (`frontMatter`, `body`), `ParseError extends Error`.
  - [ ] Front matter: **dependency-mentes** parse — a vezető `---\n…\n---\n` blokk kivágása regexszel; a flat `kulcs: érték` sorok objektummá; a törzs a maradék. (NE húzz be új YAML-libet — a front matter lapos; ha később nem-lapos kell, akkor jön `js-yaml`.)
  - [ ] Validáció **Zod-dal** (a `config.ts` mintája szerint): a `FrontMatter` séma; hiányzó/rossz mező → `ParseError` beszédes, magyar, a mezőt (és ha van, a `source`-ot) megnevező üzenettel.
  - [ ] `normalize(raw)`: az AC-2 lépéssora, tiszta függvény; a `stripNoise` determinisztikus regex-készlet (©/copyright, „Minden jog fenntartva", `www.gemklub`/kiadói URL, csak-illusztráció `![...]()` sor). `contentHash(text)`: `node:crypto` `createHash('sha256')` hex.
  - [ ] `parseDocument(raw)`: front matter kivágás → Zod-validáció → `{ frontMatter, body: normalize(raw) }`.
- [ ] **T3: Zöld-kapu** (AC: 3)
  - [ ] `pnpm test` (a régi 13 + az újak) zöld; `pnpm typecheck && pnpm lint && pnpm format:check` zöld.

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

### Debug Log References

### Completion Notes List

### File List
