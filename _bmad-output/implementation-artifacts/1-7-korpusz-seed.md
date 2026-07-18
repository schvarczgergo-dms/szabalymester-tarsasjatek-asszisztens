---
baseline_commit: 2e40ead
---

# Story 1.7: Korpusz-seed (a tudásbázis feltöltése valós szabályokkal)

Status: ready-for-dev

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

- [ ] **T1: `seed/rules/` váz + konvenció** (AC: 1) — ÁGENS-VÉGEZHETŐ
  - [ ] `seed/rules/` mappa létrehozása; `seed/rules/README.md` a fájlnév- és front matter-konvencióval, a kanonikus `section`-értékekkel és egy kitöltött példával.
  - [ ] Front matter-sablon (másolható blokk) a README-ben.
- [ ] **T2: Korpusz-validátor teszt** (AC: 2) — ÁGENS-VÉGEZHETŐ (TDD-barát)
  - [ ] `seed/rules.spec.ts` (vagy `src/ingest/corpus.spec.ts`): beolvassa a `seed/rules/*.md`-t, mindegyikre `parseDocument` hibamentesen fut, a `source`-ok egyediek, a `section` kanonikus. **Üres korpusznál a teszt egyértelmű `skip`/útmutató** (ne legyen hamis zöld úgy, hogy nincs adat).
  - [ ] A teszt a zöld-kapu része, amint van legalább 1 seed-fájl.
- [ ] **T3: Korpusz-tartalom összeállítása** (AC: 3, 4) — TARTALOMGAZDA (nem automatizálható)
  - [ ] A 8 játék hivatalos magyar szabálykönyveinek beszerzése (Gémklub/kiadó/BGG), PDF→markdown konvertálás.
  - [ ] Szakaszokra bontás (`attekintes`/`elokeszules`/`jatekmenet`/`pontozas`/`gyik`), front matter felvétele (`source` = letöltési URL), kiadói zaj kézi átnézése (a normalizálás a többit viszi).
  - [ ] Legalább a golden-set kérdéseihez szükséges játékok/szakaszok lefedése.
- [ ] **T4: Élő ingest + verifikáció** (AC: 5) — KULCS-KÖTÖTT
  - [ ] `.env` valós `OPENAI_API_KEY`-jel; `docker compose up -d`; `pnpm ingest`.
  - [ ] Verifikáció: a `knowledge_documents`/`knowledge_chunks` a várt sorokat tartalmazza (SQL-lekérdezés vagy a Story 3.1 `debug:sources`); `pnpm ingest` másodszor → 0 embedding (hash-egyezés, Story 1.6).
- [ ] **T5: Zöld-kapu** (AC: 1, 2) — `pnpm test` (a korpusz-validátorral) + `typecheck · lint · format:check` zöld.

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

### Debug Log References

### Completion Notes List

### File List

### Change Log
