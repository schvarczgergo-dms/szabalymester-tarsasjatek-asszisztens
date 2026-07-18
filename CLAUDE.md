# Szabálymester — Claude Code útmutató

RAG-alapú társasjáték-szabály asszisztens: természetes nyelvű kérdésre a hivatalos
szabálykönyvekből válaszol, **magyarul**, forrásmegjelöléssel (játék + szakasz). Ha nincs
találat, kimondja — nem talál ki szabályt.

Ez a fájl a belépő. A részletek a `docs/`-ban élnek — **azok az igazság forrása**, ne
duplikáld őket ide, hanem dolgozz belőlük.

## Megvalósítási állapot (2026-07-18 — végleges)

A pipeline **kész és fut** (Epic 1–3 mind `done`; ld. `_bmad-output/implementation-artifacts/sprint-status.yaml`).
Néhány terv-eltérés, amit a végleges állapot tükröz:

- **Korpusz:** a hivatalos, jogvédett magyar szabálykönyvek helyett **jogtiszta, CC BY-SA 4.0**
  forrás (angol Wikipédia + némi Wikibooks), attribúcióval — ~22 játék, **54 dokumentum, ~17 600 szó**
  (`seed/rules/`, `seed/README.md`). A korpusz **angol**, a válasz **magyar** (kereszt-nyelvű RAG;
  a HyDE a korpusz nyelvén generál — `CORPUS_LANGUAGE`).
- **Lokális, ingyenes mód:** a modellek futtathatók helyi **Ollamán** (provider base-URL override
  + per-szerep `*_PROVIDER` választó, LiteLLM nélkül) vagy felhőben — `docs/local-mode.md`.
- **Grounded absztenció:** relevancia-küszöb (`RELEVANCE_MAX_DISTANCE`) → gyenge találatnál a
  keresés üres, az agent kimondja, hogy nincs információ (a negatív teszt modell-függetlenül átmegy).
- **Golden set mérve:** `pnpm eval:golden-set` — eredmény és őszinte elemzés: `docs/golden-set.md` §5,
  `docs/golden-set-eredmenyek.md`. A lokális kis modell (qwen2.5:3b) korlátozza a válasz-pontosságot;
  éles minőséghez erős felhő-modell.

## Olvasási sorrend (mielőtt kódolsz)

1. `docs/terv.md` — a teljes terv (use case, korpusz, célarchitektúra, projektstruktúra, pipeline)
2. `docs/bmad-workflow.md` — **ebben a story-sorrendben építs** (12 story)
3. `docs/szabalyok.md` — kód- és projektkonvenciók (KÖTELEZŐ betartani)
4. `docs/tervezesi-mintak.md` — a RAG-pipeline tervezési mintái
5. Téma-specifikus: `docs/chunking-strategia.md`, `docs/routing.md`, `docs/golden-set.md`,
   `docs/ARCHITEKTURA.md`, `docs/koltsegbecsles.md`
6. `docs/tovabbfejlesztes.md` — opcionális bővítések, CSAK ha külön kérik (ne az alapba)

## Stack

TypeScript (strict) · Node LTS · pnpm · PostgreSQL 17 + pgvector (docker-compose) ·
Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) · Zod · Vitest · tsx.
Nincs Nx, nincs ORM (egy `db/schema.sql`).

## Architektúra (cél)

A `src/` fogalmi mappákra bomlik: `ingest/`, `rag/`, `agent/`, `eval/`, plus `config.ts`
és `cli.ts`. A teljes bontás: `docs/terv.md` §4.

### Egy agent = prompt + toolok + loop

A közös loop (`src/agent/agent.ts`) a Vercel AI SDK-ra épül (`streamText`/`generateText`
+ `stopWhen: stepCountIs(n)`), lépésenkénti trace-szel. Egy agent vékony definíció:
system prompt (`agent/prompt.ts`, `<grounding>` blokkal) + toolkészlet + korlátok
(maxSteps, maxOutputTokens). A RAG a modell felé **egy tool**: `searchRules`.

### RAG-pipeline

- **Ingest** (offline, `src/ingest/`): `seed/rules/*.md` → parse (front matter) →
  tisztítás → chunkolás (szakasz + **játéknév-fejléc**) → embedding (batch) → pgvector.
- **Retrieval** (`src/rag/retrieve.ts`): HyDE (magyar hipotetikus válasz) → embedding →
  pgvector tág háló (top-20) → rerank (kis modell, top-5) → kontextus + forrás a
  válasz-modellnek. Minden lépésnek olcsóbb fallbackje van; a retrieval **sosem dob**.

### Tool-réteg

Egy tool = egy könyvtár mindennel, ami hozzá kell. A tool-fájl tartalmazza a modell-felé
eső leírást, a Zod-határvalidációt és a factory-t. Az `execute*` **soha nem dob** —
`ToolOutcome`-ot ad vissza (a rossz LLM-input is a mi magyar hibaszövegünk lesz). Egy
`report` mellékcsatorna küldi a teljes kimenetet a trace-be (a modell csak a `content`-et
látja). Új tool = egy új könyvtár + egy sor a toolsetben.

### Tárolás és frissítés

pgvector, két tábla: `knowledge_documents` (nyilvántartás: `game`, `section`,
`content_hash`, `status`) + `knowledge_chunks` (`embedding vector(1536)`, `document_id`
FK, CASCADE). Az inkrementális frissítés **hash-alapú** — a változatlan dokumentum nem
vektorizálódik újra. Részletek: `docs/ARCHITEKTURA.md`.

### Grounding és routing

- **Grounding** kétszintű: a system prompt `<grounding>` blokkja + a tool minden
  találathoz forrást ad (játék + szakasz + URL), üres találatnál explicit "nincs
  információ" üzenet.
- **Routing**: olcsó modell keres (HyDE, rerank), erős modell válaszol; a kérdést és a
  dokumentumokat UGYANAZZAL az embedding-modellel vektorizáljuk. Szereposztás: `docs/routing.md`.

### Config-határ

`src/config.ts`: env-validáció Zod-dal, fail-fast; a titkok `.env`-ből jönnek.

## Kemény szabályok

- **Struktúra**: egy fogalom = egy könyvtár; a fájlnév hordozza a szerepét
  (`*-tool.ts`, `*-prompt.ts`, `*.spec.ts`). Részletek: `docs/szabalyok.md`.
- **TypeScript**: strict; `unknown` a külső inputra (nem `any`); Zod-validáció a
  rendszer-határokon, fail-fast.
- **Promptok**: template literálként, egy blokkban; a system prompt XML-szerű tagekkel
  (`<role>`, `<task>`, `<grounding>`, `<schema>`, `<rules>`, `<tools>`).
- **Grounding**: a válasz KIZÁRÓLAG a visszakapott chunkokból; minden találat forrással
  (játék + szakasz + URL); üres találatnál az agent mondja ki, hogy nincs információja.
- **Routing**: olcsó modell keres (HyDE, rerank), erős modell válaszol; a kérdést és a
  dokumentumokat UGYANAZZAL az embedding-modellel vektorizáld. Szereposztás: `docs/routing.md`.
- **Chunkolás**: determinisztikus → **előbb a unit tesztek** (TDD), utána az implementáció.
- **Nyelv**: magyar korpusz + magyar válasz; a HyDE-szöveg is magyar.
- **Biztonság**: titkok `.env`-ben (soha a repóba); paraméterezett SQL.
- **Git**: Conventional Commits; egy story = egy feature branch + kicsi, fókuszált commitok.

## Munkamenet

- A `docs/bmad-workflow.md` story-sorrendjében haladj; minden story önállóan zöldre vihető.
- Minden story végén: `pnpm test` zöld + a story elfogadási kritériuma.
- Ismeretlen vagy ritka API/lib előtt olvass dokumentációt — ne találgass CLI-flageket.
- A golden set és a költség **valós futásból** töltődik; az eredményeket írd vissza a
  `docs/golden-set.md`-be és a `README.md`-be.

## Parancsok (tervezett — a kód elkészültével élesednek)

```bash
pnpm install
docker compose up -d           # Postgres + pgvector
pnpm ingest                    # korpusz → chunk → embed → pgvector
pnpm cli ask "Catanban mi történik, ha 7-est dobok?"
pnpm test                      # unit tesztek (chunkolás, parse)
pnpm eval:golden-set           # nyers vs. teljes pipeline összevetés
pnpm debug:search "..." --full # retrieval-láthatóság (HyDE + rerank)
```

## Amit NE

- Ne másolj külső repót 1:1 — a döntéseket a `docs/` indokolja, azt kövesd.
- Ne engedd a modellt fejből szabályt válaszolni (grounding!).
- Ne tegyél titkot/kulcsot a repóba.
- Az opcionális bővítéseket (`docs/tovabbfejlesztes.md`) ne keverd az alap-pipeline-ba.
