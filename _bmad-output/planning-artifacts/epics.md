---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-szabalymester-tarsasjatek-asszisztens-2026-07-18/prd.md
  - _bmad-output/planning-artifacts/prds/prd-szabalymester-tarsasjatek-asszisztens-2026-07-18/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-szabalymester-tarsasjatek-asszisztens-2026-07-18/ARCHITECTURE-SPINE.md
---

# Szabálymester - Epic Breakdown

## Overview

Ez a dokumentum a **Szabálymester** követelményeit (PRD FR/NFR) és az architektúra-döntéseket
(spine AD-1..AD-11) implementálható epikekre és story-kra bontja a Developer-agent számára.
A forrás a végleges PRD, a `addendum.md` és az architektúra-spine.

## Requirements Inventory

### Functional Requirements

- **FR-1**: Korpusz-dokumentum beolvasása és front matter validálása (kanonikus `section`, egyedi `source`); a parse determinisztikus és unit-tesztelt.
- **FR-2**: Zaj-szűrés és normalizálás; a `content_hash` a normalizált törzsből képződik.
- **FR-3**: Batch embedding és pgvector-tárolás; dokumentum + chunkjai egy tranzakcióban, CASCADE.
- **FR-4**: Hash-alapú inkrementális frissítés; változatlan korpuszon 0 embedding-hívás; törölt → `deleted` + audit + újraélesztés; ütemezett (cron) és kézi trigger.
- **FR-5**: Kényszerített teljes újraépítés (`--rebuild`); pipeline-verzió eltérése rebuildet követel.
- **FR-6**: Szakasz-alapú, heading-aware darabolás méretkeretig; hosszú nem-lista bekezdés mondathatáron.
- **FR-7**: Játéknév + szakasz kontextus-fejléc a `content`-be sütve (embed-bemenet).
- **FR-8**: Lista-integritás, törpe-összevonás, szakaszon belüli átfedés (szakasz-határon nincs).
- **FR-9**: Determinisztikus, unit-tesztelt chunkolás (`(markdown, opciók) → Chunk[]`, TDD).
- **FR-10**: HyDE magyar hipotetikus válasz; hiba → fallback az eredeti kérdésre.
- **FR-11**: Egységes embedding-modell a kérdésre és a dokumentumokra; váltás → `--rebuild`.
- **FR-12**: Tág háló (`WIDE_NET`=20) koszinusz-vektorkeresés `active` chunkokban; üres → jelzés.
- **FR-13**: Átrangsorolás (rerank) kis modellel, strukturált (Zod) kimenet, top-`KEEP_TOP`=5.
- **FR-14**: Fokozatos degradáció; a kereső tool sosem dob a felhasználó felé.
- **FR-15**: Tool-use loop és `searchRules` tool forrás-payloaddal; `execute` sosem dob (`ToolOutcome`).
- **FR-16**: A válasz kizárólag a visszakapott chunkokból (grounding-prompt blokk).
- **FR-17**: Kötelező forrásmegjelölés (játék + szakasz + URL) minden érdemi válaszban.
- **FR-18**: Explicit nemleges válasz üres találatnál (negatív teszt), kitalált szabály nélkül.
- **FR-19**: Magyar nyelvű válasz.
- **FR-20**: Golden set (≥8 pozitív + 2 negatív, gold szakasszal); `raw` vs. `full` összevetés.
- **FR-21**: Retrieval-trace (HyDE-szöveg, távolságok, rerank-pontok, kontextusméret).
- **FR-22**: Debug-parancsok (`debug:sources`, `debug:search [--full]`).
- **FR-23**: Token-használat naplózása minden modellhíváson → költségbecslés.
- **FR-24**: Fail-fast env-validáció (Zod) az entry pointokon; titkok `.env`-ből.
- **FR-25**: Env-ből felülírható modell-routing.

### NonFunctional Requirements

- **NFR-1**: Nyelv — korpusz + HyDE + válasz magyar (nyelvi rés elkerülése).
- **NFR-2**: Robusztusság — a retrieval a felhasználó felé sosem dob; minden lépés degradálódik.
- **NFR-3**: Determinizmus/tesztelhetőség — chunkolás ÉS dokumentum-parse unit-tesztelt; Zod a határokon (env, tool-input, LLM-output).
- **NFR-4**: Megfigyelhetőség — minden retrieval-lépés trace-t ír; keresés a generálástól külön nézhető.
- **NFR-5**: Konzisztencia — dokumentum-nyilvántartás + chunkok egy tranzakcióban; nincs árva chunk.
- **NFR-6**: Provider-rezíliencia — HyDE és rerank külön providernél, függetlenül degradálódnak.

### Additional Requirements

_Az architektúra-spine-ból (AD-1..AD-11) és a Stack-ből — a story-kat kötő kényszerek:_

- **Greenfield, külső starter nélkül**: pnpm workspace, TypeScript strict; „egy fogalom = egy könyvtár": `src/{ingest,rag,agent,eval}` + `config.ts` + `cli.ts`; a teszt a kód mellett (`*.spec.ts`).
- **Stack (web-ellenőrzött, 2026-07)**: Node 24 LTS · TS 5.9 · pnpm 11 · `ai` (Vercel AI SDK) v7 + `@ai-sdk/openai` + `@ai-sdk/anthropic` · Zod 4 · Vitest 4 · tsx · PostgreSQL 17 + pgvector 0.8.
- **Modell-szereposztás (env-felülírható)**: `text-embedding-3-small` · HyDE `gpt-5.4-nano` · rerank `claude-haiku-4-5` · válasz `claude-sonnet-5`.
- **Infrastruktúra**: `docker-compose` (pgvector/pg17); `db/schema.sql` (`knowledge_documents` + `knowledge_chunks`, `vector(1536)`, FK CASCADE, `section`/`status` CHECK); titkok `.env`.
- **AD-kényszerek**: AD-1 grounding · AD-2 retrieval-sosem-dob · AD-3 egy embedding-tér + dimenzió-egyezés (config fail-fast) · AD-4 chunk-fejléc a `content`-ben + parse/chunk determinizmus · AD-5 tranzakció + egyetlen `normalize()` + soft-delete audit/revival + cron/kézi trigger · AD-6 config fail-fast + env-felülírás · AD-7 routing + külön providerek · AD-8 `ToolOutcome` egyetlen Zod-típus (`content` + `report: TraceEntry` + `status`) · AD-9 függőségi irány (nincs kör; RAG az agentnek csak toolként) · AD-10 dokumentum-granularitás: 1 fájl = 1 `(game, section)`, a chunk a szekciót örökli · AD-11 usage-naplózás minden modellhíváson.
- **TDD-kötelezettség**: a chunkolás és a dokumentum-parse determinisztikus → **előbb a unit tesztek**.

### UX Design Requirements

_Nincs UX-dokumentum; a v1 terminál/CLI-alapú (PRD Non-Goals). Nem alkalmazandó._

### FR Coverage Map

- **FR-1, FR-2** → Epic 1 — dokumentum-parse + zaj-szűrés/normalizálás
- **FR-3, FR-4, FR-5** → Epic 1 — embedding + pgvector-tárolás, inkrementális frissítés, `--rebuild`
- **FR-6, FR-7, FR-8, FR-9** → Epic 1 — chunkolás (szakasz-alapú, fejléc, lista-integritás, determinizmus)
- **FR-24, FR-25** → Epic 1 — fail-fast config + env-felülírható routing (alapozás)
- **FR-10, FR-11, FR-12, FR-13, FR-14** → Epic 2 — HyDE, egységes embedding, tág háló, rerank, degradáció
- **FR-15, FR-16, FR-17, FR-18, FR-19** → Epic 2 — agent/tool, grounding, forrásmegjelölés, negatív teszt, magyar válasz
- **FR-20, FR-21, FR-22, FR-23** → Epic 3 — golden set, trace, debug-parancsok, usage/költség

_NFR-1..NFR-6 keresztmetsző: minden epikben érvényesül (nyelv, robusztusság, determinizmus,
megfigyelhetőség, konzisztencia, provider-rezíliencia). Az AD-1..AD-11 a story-kat kötő invariáns._

## Epic List

### Epic 1: Kereshető tudásbázis (ingest-pipeline)

A hivatalos magyar szabálykönyvek betöltése, tisztítása, determinisztikus chunkolása
(játéknév-fejléccel), embeddingje és kereshető tárolása pgvectorban — hash-alapú
inkrementális frissítéssel. A végén létezik egy lekérdezhető, karbantartható tudásbázis
(a projektváz, a séma és a fail-fast konfiguráció is itt áll fel).

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-24, FR-25

### Epic 2: Kérdés → grounded válasz

A felhasználó magyar kérdésére a rendszer a tudásbázisból ad tömör, forrásmegjelölt
(játék + szakasz + URL) választ: HyDE → embedding → tág háló → rerank → grounded
agent-válasz, fokozatos degradációval. Üres találatnál kimondja, hogy nincs információja.
Ez a termék elsődleges felhasználói értéke (CLI-belépőponttal).

**FRs covered:** FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19

### Epic 3: Bizonyított minőség, láthatóság és költség

A rendszer minősége mérhetővé és a keresés hibakereshetővé válik: golden set (nyers vs.
teljes pipeline + negatív tesztek), retrieval-trace, debug-parancsok és a mért
token-/költségbecslés. A végén bizonyított a grounding és a retrieval-minőség.

**FRs covered:** FR-20, FR-21, FR-22, FR-23

---

## Epic 1: Kereshető tudásbázis (ingest-pipeline)

A hivatalos magyar szabálykönyvek betöltésétől a kereshető, karbantartható pgvector-tudásbázisig.

### Story 1.1: Projektváz és fail-fast konfiguráció

As a fejlesztő,
I want egy felállított projektvázat validált konfigurációval,
So that a rendszer determinisztikusan és biztonságosan indul, és a többi story erre épülhet.

**Acceptance Criteria:**

**Given** egy friss klón,
**When** `pnpm install` és a toolchain (TypeScript strict, Vitest, ESLint, Prettier) fut,
**Then** a `pnpm typecheck`, `pnpm test`, `pnpm lint` zölden fut, és a `docker compose up -d` elindítja a pgvector/pg17 konténert.
**And** a `config.ts` Zod-dal, fail-fast módon validálja az env-et (kötelező titkok + `DATABASE_URL`), a titkok `.env`-ből jönnek, a modellnevek env-ből felülírhatók (FR-24, FR-25, AD-6).
**And** hiányzó kötelező titokra a rendszer a változó nevét megnevező hibával, indulás előtt leáll.

### Story 1.2: Tudásbázis-séma

As a fejlesztő,
I want a `knowledge_documents` + `knowledge_chunks` sémát pgvectorral,
So that a dokumentumok és a chunkjaik konzisztensen, kereshetően tárolhatók.

**Acceptance Criteria:**

**Given** a futó pgvector-adatbázis,
**When** a `db/schema.sql` alkalmazódik,
**Then** létrejön a `knowledge_documents` (`source` UNIQUE, `game`, `section` CHECK az öt kanonikus értékre, `content_hash`, `status` CHECK `active|deleted`, `chunk_count`, `indexed_at`) és a `knowledge_chunks` (`document_id` FK **ON DELETE CASCADE**, `chunk_index`, `heading`, `content`, `embedding vector(1536)`).
**And** a séma idempotens (újrafuttatható), és dokumentum törlésekor a chunkjai CASCADE törlődnek (NFR-5, AD-5).
**And** a `section` kizárólag dokumentum-tulajdon; egy korpuszfájl egy `(game, section)` dokumentum (AD-10).

### Story 1.3: Dokumentum-parse (front matter + normalizálás)

As a fejlesztő,
I want determinisztikus, unit-tesztelt dokumentum-parse-ot,
So that a korpusz megbízhatóan, zaj nélkül kerül a pipeline-ba, és a hash stabil.

**Acceptance Criteria:**

**Given** egy korpusz-markdown front matterrel,
**When** a parse lefut,
**Then** validálja a kötelező mezőket (`title`, `game`, `source`, `section`); érvénytelen `section`/hiányzó mező beszédes hibát ad, a futás nem áll le némán (FR-1).
**And** egyetlen tiszta `normalize(raw) → string` (front-matter-strip, `\r\n`→`\n`, trailing-WS trim, kisbetűsítés nélkül) állítja elő a törzset, amelyből a `content_hash` és a chunker bemenete is származik (FR-2, AD-5).
**And** a parse determinisztikus és unit-tesztelt (a validálás és a normalizálás határeseteit tesztek fedik) (NFR-3).

### Story 1.4: Determinisztikus chunkolás játéknév-fejléccel

As a fejlesztő,
I want szakasz-alapú chunkolást játéknév-fejléccel, TDD-vel,
So that a keresés játékok között is elkülönít, és a szabály-egységek nem törnek szét.

**Acceptance Criteria:**

**Given** egy normalizált dokumentum és a `(game, section)`,
**When** a `chunk(markdown, opciók)` lefut,
**Then** a szakasz-alapú (heading-aware) darabolás méretkeretig történik; a hosszú, nem-lista bekezdés mondathatáron vágódik (FR-6).
**And** minden chunk `content`-je = `fejléc ("Játék > Szakasz > alcím") + törzs`, és ez az embed-bemenet (FR-7, AD-4); a szekciót a chunk a dokumentumától kapja, nem `##`-ból (AD-10).
**And** a listák egyben maradnak, a törpe-szakasz (< ~200 karakter) összevonódik, a szakaszon belüli vágásnál van átfedés, szakasz-határon nincs; a sorszám folytonos (FR-8).
**And** a chunkolás determinisztikus, és a kulcsdöntéseket (fejléc jelenléte, lista-integritás, törpe-összevonás, átfedés, mondathatár, folytonos sorszám) unit-tesztek fedik (FR-9, NFR-3, TDD).

### Story 1.5: Embedding és tárolás

As a fejlesztő,
I want batch-embeddinget és a store-réteget dimenzió-védelemmel,
So that a chunkok kereshetően, a modellel egyező dimenzióban kerülnek pgvectorba.

**Acceptance Criteria:**

**Given** chunkok és a konfigurált embedding-modell,
**When** az `embed` (batch) és a `store` (insert/search/list/delete) fut,
**Then** a kérdést és a dokumentumokat ugyanaz az embedding-modell vektorizálja (FR-11, AD-3).
**And** az embedding dimenziója a modellből származik és meg kell egyeznie a séma `vector(N)`-jével; eltérésnél a `config.ts` fail-fast hibát ad (AD-3).
**And** a dokumentum + chunkjai egy tranzakcióban íródnak; a kereső sosem lát fél-kész dokumentumot (FR-3, NFR-5).

### Story 1.6: Inkrementális ingest-futás

As a üzemeltető,
I want hash-alapú inkrementális ingestet `--rebuild` opcióval,
So that csak a változott tartalom vektorizálódik újra, és a frissítés olcsó, konzisztens.

**Acceptance Criteria:**

**Given** egy korpusz és egy meglévő tudásbázis,
**When** a `pnpm ingest` (ütemezetten vagy kézzel) lefut,
**Then** a változatlan dokumentumok kimaradnak (0 embedding-hívás), a módosultak régi chunkjai törlődnek és újraíródnak egy tranzakcióban (FR-4, AD-5).
**And** a forrásból eltűnt dokumentum `status = deleted` audit-nyomként megmarad, a visszatérő forrás újraéleszti a sort (a hash dönt) (FR-4, AD-5).
**And** `--rebuild` mindent újravektorizál a hash-től függetlenül; a pipeline-verzió eltérése is teljes újraépítést követel (FR-5).
**And** minden modellhívás naplózza a token-használatot (usage) (FR-23 részben, AD-11).

## Epic 2: Kérdés → grounded válasz

A magyar kérdéstől a forrásmegjelölt, grounded válaszig — a termék magja.

### Story 2.1: Keresési pipeline (HyDE → rerank → kontextus)

As a fejlesztő,
I want a kétlépcsős retrieval-pipeline-t HyDE-vel és rerankkel, fallbackekkel és trace-szel,
So that a laikus kérdésre is a releváns szabály-chunkok kerülnek elő megbízhatóan.

**Acceptance Criteria:**

**Given** egy magyar kérdés,
**When** a `retrieve` lefut,
**Then** egy olcsó modell magyar HyDE-választ ír, amit ugyanaz az embedding-modell vektorizál; a tág háló (top-20) koszinusz-keresést egy kis modell top-5-re rangsorolja át (strukturált, Zod-validált kimenet) (FR-10, FR-11, FR-12, FR-13).
**And** minden lépésnek fallbackje van (HyDE-hiba → eredeti kérdés; rerank-hiba → vektorsorrend; üres → explicit „nincs találat"); a pipeline a felhasználó felé sosem dob (FR-14, NFR-2).
**And** a HyDE és a rerank külön providernél fut, függetlenül degradálódva (NFR-6, AD-7).
**And** minden lépés strukturált trace-t ír (HyDE-szöveg, távolságok, rerank-pontok, kontextusméret) (NFR-4).

### Story 2.2: Grounded agent és `searchRules` tool

As a játékos,
I want forrásmegjelölt, grounded választ a szabálykérdésemre,
So that megbízhatóan eldönthetem a szabályhelyzetet, és tudom, ha valamiről nincs adat.

**Acceptance Criteria:**

**Given** a keresési pipeline és egy szabálykérdés,
**When** az agent (tool-use loop) meghívja a `searchRules` toolt,
**Then** a tool minden találathoz forrást ad (játék + szakasz + URL), és `ToolOutcome`-ot ad vissza (sosem dob; rossz inputból is magyar hibaszöveg) (FR-15, AD-8).
**And** a válasz kizárólag a visszakapott chunkokból származik (`<grounding>` prompt-blokk), és minden érdemi válasz megjelöli a forrást (FR-16, FR-17, AD-1).
**And** üres találatnál az agent explicit kimondja, hogy nincs információja, kitalált szabály/forrás nélkül (FR-18, negatív teszt).
**And** a válasz magyar nyelvű (FR-19).

### Story 2.3: CLI-belépőpont a kérdés-válaszhoz

As a játékos,
I want egy egyszerű parancssori belépőpontot,
So that természetes nyelven kérdezhetek és azonnal grounded választ kapok.

**Acceptance Criteria:**

**Given** a felállt agent és tudásbázis,
**When** `pnpm cli ask "<kérdés>"` fut,
**Then** a rendszer lefuttatja a teljes pipeline-t és kiírja a magyar, forrásmegjelölt választ.
**And** a korpuszban nem szereplő játékra/adatra a válasz explicit nemleges (negatív teszt a CLI-n át is).

## Epic 3: Bizonyított minőség, láthatóság és költség

A minőség mérhetővé, a keresés hibakereshetővé, a költség ismertté válik.

### Story 3.1: Debug-parancsok és trace-láthatóság

As a fejlesztő,
I want külön parancsokat a tudásbázis és a keresés megnézésére,
So that a RAG-hibákat előbb a retrievalben tudom keresni, nem a generálásban.

**Acceptance Criteria:**

**Given** egy feltöltött tudásbázis,
**When** `pnpm debug:sources`, illetve `pnpm debug:search "<kérdés>" [--full]` fut,
**Then** a `debug:sources` felsorolja a dokumentumokat és chunk-számukat (FR-22).
**And** a `debug:search` a nyers vektorkeresést, `--full`-lal a teljes pipeline-t (HyDE + rerank) mutatja, a trace-adatokkal (FR-21, FR-22, NFR-4).

### Story 3.2: Golden set és nyers-vs-teljes kiértékelés

As a fejlesztő,
I want egy golden setet és egy futtatót, amely a nyers és a teljes pipeline-t összeveti,
So that bizonyítható a HyDE, a rerank és a grounding hozzáadott értéke.

**Acceptance Criteria:**

**Given** a `golden-set.json` (≥8 pozitív + 2 negatív, kérdésenként megjelölt gold szakasszal),
**When** a `pnpm eval:golden-set` lefut,
**Then** minden kérdést `raw` és `full` módban futtat, és kérdésenként egymás mellett mutatja a top-5-öt (játék, szakasz, távolság, rerank-pont) + a HyDE-szöveget (FR-20).
**And** a 8 pozitívból legalább 7-nél a gold szakasz a `full` top-5-ben van; legalább egy átrendezés-eset dokumentált; mindkét negatív teszt átmegy (SM-1, SM-2, SM-3).

### Story 3.3: Token-/költség-naplózás és becslés

As a üzemeltető,
I want a token-használat naplózását és egy költségbecslést,
So that ismert az ingest és egy kérdés valós költsége.

**Acceptance Criteria:**

**Given** modellhívások az ingest és a retrieval során,
**When** a futások lezajlanak,
**Then** minden modellhívás usage-e naplózódik, és a rendszer ebből költséget aggregál (FR-23, AD-11).
**And** a mért ingest- és kérdés-költség (a válasz-modell dominanciájával) a README-be kerül (SM-4).
