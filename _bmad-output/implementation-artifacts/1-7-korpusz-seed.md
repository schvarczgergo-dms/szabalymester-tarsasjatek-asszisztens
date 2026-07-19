---
baseline_commit: 7c4ea3f
---

# Story 1.7: Korpusz-seed (a tudásbázis feltöltése valós szabályokkal)

Status: done

> **Lezárás (2026-07-18):** a korpusz a jogtiszta **CC BY-SA 4.0** (angol Wikipédia + Wikibooks)
> megközelítéssel készült el — 28 játék, **54 dokumentum, ~17 600 szó**, attribúcióval; ez
> felváltotta a korábbi jelölt minta/placeholder tartalmat (a hivatalos kiadói szabálykönyvek
> jogi kockázata miatt). Élesben ingestelve (Ollama). Részletek: `seed/README.md`,
> `docs/golden-set.md` §5. A HF3 korpusz-követelménye (20–30 dok, ~15 000 szó) teljesül.

## Story

As a tartalomgazda/üzemeltető,
I want a hivatalos magyar szabályok kurált, front-matteres markdown-korpuszát a `seed/rules/`-ben,
so that az ingest valós, kereshető tudásbázist épít, és a golden set kiértékelhető (az Epic 1 célja csak így teljesül).

> **Utólag felvett story (correct-course, 2026-07-18).** A korpusz az FR-1 bemenete, de a
> pipeline-story-k (1.1–1.6) nem állítják elő. A **valós szabályszöveg hivatalos forrásból** származik
> — NEM generált (ez a grounding, AD-1 alapja). Ezért a story két rétegű: (A) **ágens-végezhető**
> váz + konvenció + validáció + (kulcs birtokában) élő ingest; (B) **tartalomgazda-feladat** a
> tényleges szabályszöveg beszerzése/konvertálása. A (B) nem automatizálható hallucináció nélkül.

## Acceptance Criteria

1. **Struktúra és konvenció (AD-10):** létezik a `seed/rules/` mappa; egy fájl = egy `(game, section)` dokumentum; dokumentált fájlnév-konvenció (pl. `catan-jatekmenet.md`) és front matter-sablon (`title`, `game`, `source`, `section`). A konvenció a `seed/rules/README.md`-ben (vagy a repo README megfelelő szakaszában) rögzített.
2. **Front matter-validáció (FR-1):** minden `seed/rules/*.md` átmegy a `parseDocument`-en — valid, kötelező front matter (`title`, `game`, `source`, `section` a kanonikus öt érték egyike), nem üres normalizált törzs, **egyedi `source`** (nincs duplikátum; a Story 1.6 duplikátum-guardja is ezt védi). Ezt egy **automatikus teszt/validátor** ellenőrzi a tényleges korpuszfájlokon.
3. **Lefedettség (terv §2, golden-set):** a korpusz a `docs/golden-set.md` javasolt játékaira épül (Catan, Carcassonne, Ticket to Ride, Pandémia, 7 Csoda, Azul, Splendor, King of Tokyo), releváns szakaszokra bontva → **~24–28 dokumentum**, > 15 000 szó. (MVP-küszöb: legalább a golden-set 8+2 kérdéséhez szükséges játékok/szakaszok jelen vannak.)
4. **Hitelesség és legalitás (AD-1):** a tartalom KIZÁRÓLAG hivatalos magyar szabálykönyvekből származik (Gémklub / kiadói oldal / BGG *Files*); a `source` mező a letöltési URL (provenance → grounding). Kitalált/összefoglalt-fejből szabály TILOS.
5. **Élő ingest (kulcs-kötött):** valós `OPENAI_API_KEY`-jel a `pnpm ingest` végigfut a korpuszon; a betöltött dokumentumok/chunkok ellenőrizhetők (közvetlen SQL-lekérdezés vagy a későbbi `debug:sources`, Story 3.1). A struktúra + validáció (AC-1, AC-2) kulcs NÉLKÜL is kész és zöld.

## Tasks / Subtasks

- [x] **T1: `seed/rules/` váz + konvenció** (AC: 1) — ÁGENS-VÉGEZHETŐ
  - [x] `seed/rules/` mappa létrehozása; `seed/README.md` a fájlnév- és front matter-konvencióval, a kanonikus `section`-értékekkel, kitöltött példával és a placeholder-figyelmeztetéssel.
  - [x] Front matter-sablon (másolható blokk) a README-ben.
- [x] **T2: Korpusz-validátor teszt** (AC: 2) — ÁGENS-VÉGEZHETŐ
  - [x] `src/ingest/corpus.spec.ts`: beolvassa a `seed/rules/*.md`-t, mindegyikre `parseDocument` hibamentes, a `source`-ok egyediek, a `section` kanonikus. Üres korpusznál `it.runIf` beszédes jelzés (nincs hamis zöld).
  - [x] A teszt a zöld-kapu része (6 assert + 1 skip a jelenlegi minta-korpuszon).
- [~] **T3: Korpusz-tartalom összeállítása** (AC: 3, 4) — RÉSZLEGES (minta kész; hiteles tartalom = tartalomgazda)
  - [x] **Minta-korpusz** (jelölten NEM hiteles, `sample.invalid` source): Catan (elokeszules/jatekmenet/pontozas) + Azul (jatekmenet/pontozas) — 5 dokumentum parafrazált mintatartalommal.
  - [x] **Vázfájlok a maradék 6 játékhoz** (Carcassonne, Ticket to Ride, Pandémia, 7 Csoda, Splendor, King of Tokyo), egyenként 4 szakasz (attekintes/elokeszules/jatekmenet/pontozas) = 24 fájl; helyes front matter + szakasz-alcímek + „kitöltendő" placeholder törzs. Összesen **29 dokumentum** (mind a 8 spec-játék felvéve).
  - [ ] A HIVATALOS magyar szabálykönyvek tartalmának beemelése a vázakba/mintákba (tartalomgazda; nem automatizálható hallucináció/másolás nélkül).
- [~] **T4: Élő ingest + verifikáció** (AC: 5) — RÉSZLEGES (szintetikus e2e kész; valós kulcs függőben)
  - [x] **Szintetikus élő futás** (OpenAI nélkül): `runIngest` a valós fs-olvasóval + determinisztikus ál-embedderrel + valós pg store-ral → 5 dokumentum / 17 chunk betöltve; keresés helyes forrás-payloaddal; MÁSODIK futás 0 embed, 5 kihagyott (hash-inkrementalitás élesben igazolva).
  - [ ] Valós `OPENAI_API_KEY`-es `pnpm ingest` (a tényleges embedding-vektorokkal) — kulcs meglétekor.
- [x] **T5: Zöld-kapu** (AC: 1, 2) — `pnpm test` (72 → 78 + 1 skip) + `typecheck · lint · format:check` zöld.

## Dev Notes

### Kényszerek

- **AD-1 (grounding):** a korpusz a válaszok EGYETLEN forrása — a tartalom hitelessége nem opcionális; kitalált szabály a termék lényegét rombolja. Az agent NE generáljon szabályszöveget. [Source: ARCHITECTURE-SPINE.md#AD-1, prd.md#FR-17..18]
- **AD-10 (dokumentum-granularitás):** egy fájl = egy `(game, section)`; a `section` dokumentum-tulajdon, a chunker örökli. A fájlnév ezt tükrözze. [Source: #AD-10]
- **FR-1:** kötelező front matter (`title`, `game`, `source`, `section`); érvénytelen `section`/hiányzó mező → a `parseDocument` beszédesen elutasít (nem áll le némán). [Source: prd.md#FR-1]
- **Legalitás:** csak publikus, hivatalos magyar szabálykönyv; a `source` a letöltési URL. [Source: docs/terv.md#2]

### Bemenet és interfészek (a meglévő kódból)

- **`src/ingest/parse-document.ts`:** `parseDocument(raw)` a validátor magja; `SECTIONS = ['attekintes','elokeszules','jatekmenet','pontozas','gyik']`; a front matter sémája (`title`, `game`, `source`, `section`).
- **`src/ingest/ingest.ts` (Story 1.6):** `readCorpusFromFs()` a `seed/rules/*.md`-t olvassa; a `pnpm ingest [--rebuild]` a belépőpont. A duplikált `source` és az üres-korpusz már védve (1.6 review).
- **`docs/terv.md` §2, `docs/golden-set.md`:** a lefedettség és a játék/szakasz-lista forrása; a golden-set gold szakaszai a korpuszhoz igazodnak (a tényleges golden-set a Story 3.2).

### 🚨 Gotcha-k

1. **Ne hallucinálj szabályt.** A T3 tartalom emberi/tartalomgazda feladat. Az agent segíthet a struktúrában, a sablonban, a validátorban és a konvertált szöveg *formázásában* — de a szabály tényleges tartalmát hivatalos forrásból kell venni.
2. **A `source` egyedi és stabil** (a hash-alapú frissítés kulcsa, Story 1.6). Két fájl azonos `source`-szal ütközés.
3. **A validátor ne adjon hamis zöldet üres korpuszon** — ha nincs seed-fájl, a teszt legyen `skip`/beszédes, ne „0 fájl → OK".
4. **`section` a fájlé, nem a `##`-é** (AD-10): a fájlnév és a front matter `section` hordozza; a markdown `##`/`###` csak breadcrumb a chunkernek.
5. **Élő ingest kulcsot és költséget jelent** — a teljes korpusz embeddingje centes nagyságrend (routing.md/koltsegbecsles.md), de valós API-hívás; a hash miatt a második futás ingyen.

### Project Structure Notes

- Új: `seed/rules/` (+ `README.md`), a korpuszfájlok, egy korpusz-validátor spec. Nem módosul futó kód (a pipeline kész); ez adat + validáció.

### Testing Standards

- A validátor a tényleges `seed/rules/*.md`-n fut (integrációs jellegű, de determinista: fs-olvasás + `parseDocument`). Kulcs/DB nem kell hozzá. Az élő ingest (T4) manuális, kulcs-kötött.

### Nyitott döntés

- **Konvertálás módja** (PDF→markdown): kézi vs. eszközös (pl. `pandoc`/`pdf`-eszköz) — a tartalomgazda dönti; a minőség (tagoltság, zajmentesség) számít, nem az eszköz.
- **A story elfogadása:** az AC-1/AC-2/AC-5(struktúra) ágens-zölddé tehető most; az AC-3/AC-4 (tényleges tartalom) és az AC-5 (élő ingest) a tartalom + kulcs meglétekor zárható. Érdemes lehet a story-t két lépcsőben elfogadni (váz most, tartalom külön).

### References

- [Source: epics.md#Story-1.7]; [Source: docs/terv.md#2] (korpusz-spec); [Source: docs/golden-set.md#2] (játék/szakasz-lista).
- [Source: ARCHITECTURE-SPINE.md#AD-1, #AD-10]; [Source: prd.md#FR-1].
- Bemenet: `src/ingest/parse-document.ts`, `src/ingest/ingest.ts`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`) — Cursorból.

### Debug Log References

- `pnpm test src/ingest/corpus.spec.ts` → 6 passed + 1 skipped (üres-korpusz jelző).
- Szintetikus élő ingest (temp `tsx` szkript, OpenAI nélkül, futtatás után törölve): 1. futás 5 dok / 17 chunk betöltve; `search` helyes payload; 2. futás `skipped: 5`, `embeddedChunks: 0` (az ál-embedder meg sem hívódott).
- Teljes kapu: `pnpm test` 78 passed + 1 skipped, `typecheck` · `lint` · `format:check` zöld.

### Completion Notes List

- **Kész (ágens):** `seed/README.md` (konvenció + placeholder-figyelmeztetés + front matter-sablon); `src/ingest/corpus.spec.ts` korpusz-validátor (`parseDocument`, kanonikus `section`, egyedi `source`, üres-korpusz `it.runIf` jelzés).
- **Kész (minta):** 5 db jelölten NEM hiteles minta-dokumentum (`sample.invalid` source) — Catan (3 szakasz) + Azul (2 szakasz). Kizárólag a pipeline végponti kipróbálásához; éles használat előtt cserélendő hivatalos tartalomra.
- **Igazolva élesben (szintetikus):** a teljes ingest-lánc (parse → chunk → embed → store → search) a valós pgvectoron lefut; a hash-alapú inkrementalitás (2. futás 0 embed) élesben is működik.
- **Függőben (nem ágens):** a hiteles, hivatalos korpusz-tartalom (tartalomgazda) és a valós `OPENAI_API_KEY`-es ingest (AC-3, AC-4). Emiatt a story `in-progress` marad — a váz és a validáció kész, a tartalom + éles kulcs külön.

### File List

- `seed/README.md` (új — konvenció + figyelmeztetés)
- `seed/rules/catan-*.md` (3, MINTA-tartalom), `seed/rules/azul-*.md` (2, MINTA-tartalom)
- `seed/rules/{carcassonne,ticket-to-ride,pandemia,7-csoda,splendor,king-of-tokyo}-{attekintes,elokeszules,jatekmenet,pontozas}.md` (24, VÁZ + „kitöltendő" placeholder)
- `src/ingest/corpus.spec.ts` (új — korpusz-validátor, 29 dokumentumon zöld)

### Change Log

- 2026-07-18: Story 1.7 részleges (correct-course után) — `seed/` váz + konvenció-README, korpusz-validátor teszt, jelölt minta-korpusz (Catan+Azul, 5 dok), szintetikus élő ingest-igazolás (5 dok/17 chunk, hash-inkrementalitás). Kapu zöld (78+1 skip). Hiteles tartalom + valós kulcs függőben → Status marad in-progress.
- 2026-07-18: A maradék 6 spec-játék (Carcassonne, Ticket to Ride, Pandémia, 7 Csoda, Splendor, King of Tokyo) vázfájljai felvéve (4 szakasz/játék = 24 fájl, „kitöltendő" placeholder) — mind a 8 spec-játék jelen, 29 dokumentum; validátor zöld. Hiteles tartalom továbbra is tartalomgazda-feladat.
