# RAG-pipeline: megvalósítási terv

> A projekt: saját tudásbázis + chunking-stratégia + teljes keresési pipeline
> (HyDE + rerank) + grounding + architektúra-spec a tudásbázis karbantartásáról.
> Ez a dokumentum a **tervezet** — a kód a BMAD-workflow-val készül (ld. `bmad-workflow.md`).

## 1. Use case

A projekt neve: **Szabálymester** — egy társasjáték-szabály asszisztens.

A use case: a játékos természetes nyelven kérdez egy szabályhelyzetről ("elfogyott a
húzópakli, mi történik?"), az agent a hivatalos szabálykönyvekből válaszol, **magyarul**,
a **forrás megjelölésével** (melyik játék, melyik szabálykönyv-szakasz). Ha a kérdésre a
tudásbázisban nincs válasz (pl. olyan játékról kérdez, ami nincs a korpuszban), az agent
ezt **kimondja**, nem talál ki szabályt.

Miért erős ez a domain a RAG szempontjából:

- **Grounding + negatív teszt**: a nyelvi modell a specifikus szabályokat gyakran
  hallucinálja (összekeveri a kiadásokat, kitalál pontszámokat) — így látványosan
  bizonyítható, hogy az agent CSAK a tudásbázisból válaszol. A negatív teszt triviális:
  egy játékról kérdezünk, ami nincs a korpuszban.
- **HyDE**: a laikus kérdés ("mi van, ha nem tudok lépni?") messze esik a szabálykönyv
  nyelvétől ("Ha egy játékos nem tud érvényes lépést tenni, passzol…").
- **Rerank**: az élhelyzet-szabályok elrejtve az általános szabályok között — a vektor-top
  gyakran az általános szakaszt hozza, a konkrét választ a rerank emeli előre.
- **Erős tagoltság**: a szabálykönyvek szabványos szakaszai (Előkészület / Játékmenet /
  Pontozás / Játék vége / Gyakori kérdések) — a szakasz-alapú chunking-stratégiát ez
  közvetlenül alátámasztja.
- **Anafora**: "húzz 2 lapot", "dobj a kockával" — a chunk a **játék neve** nélkül nem
  azonosítható. Ez indokolja a kontextus-fejléces chunkolást (ld. `chunking-strategia.md`).

Nyelv: **magyar korpusz + magyar válaszok**. A magyar disztribúció (Gémklub) a legtöbb
nagy címhez ad hivatalos magyar szabálykönyv-PDF-et; a válaszok is magyarul készülnek.

## 2. A tudásbázis (korpusz)

> **Végleges állapot (2026-07-18):** az eredeti terv hivatalos magyar szabálykönyv-PDF-eket
> feltételezett, de ezek **jogvédettek** (a nyilvános repóba tenni kockázatos). Ezért a korpusz
> **jogtiszta, CC BY-SA 4.0** forrásból készült (angol Wikipédia + némi Wikibooks). Az alábbi
> eredeti terv-leírást ez váltja fel; a részletek: `seed/README.md`.

- **~22 népszerű társasjáték** (a 8 golden-set mag: Catan, Carcassonne, Ticket to Ride, Pandemic,
  7 Wonders, Azul, Splendor, King of Tokyo + további címek a korpusz-mélységhez). **Gloomhaven
  szándékosan kimarad** (a negatív teszt „nincs a korpuszban" próbája).
- A szabály-releváns szakaszokra szűrve (áttekintés + játékmenet; az előkészület/pontozás gyakran
  a Wikipédia „Gameplay" szakasza alá ágyazva) → **54 dokumentum, ~17 600 szó**.
- **Forrás:** angol Wikipédia/Wikibooks, **CC BY-SA 4.0**; minden fájl elején attribúció, a `source`
  mezőben a cikk-URL + szakasz-horgony (provenance → grounding). A hivatalos, jogvédett kiadói
  szabálykönyveket NEM használjuk.
- **Nyelv:** a korpusz **angol**, a válasz **magyar** (kereszt-nyelvű RAG; a HyDE a korpusz nyelvén
  generál — `CORPUS_LANGUAGE`, hogy a keresztnyelvi rés ne rontsa a keresést).
- Formátum: markdown, front matterrel (ld. lent).

Front matter minden korpusz-dokumentumon:

```yaml
---
title: Catan – Előkészület
game: Catan (A telepesek)
source: https://www.gemklub.hu/.../catan-szabaly.pdf
section: elokeszules            # attekintes | elokeszules | jatekmenet | pontozas | gyik
---
```

A `game` mező kulcsszerepű: ez kerül a chunk kontextus-fejlécébe (a játék neve minden
chunk vektorába), és ezen lehet szűrni/csoportosítani a debugban.

## 3. Célarchitektúra — áttekintés

```
                        ┌─────────────────────────────────────────────┐
                        │                INGEST (offline)             │
  seed/rules/*.md ──────►  parse (front matter) → tisztítás →         │
                        │  chunkolás (játéknév-fejléc) → embedding →  │
                        │  pgvector                                    │
                        └─────────────────────────────────────────────┘

                        ┌─────────────────────────────────────────────┐
  kérdés ──► agent ────►│           RETRIEVAL (a searchRules tool)    │
                        │  1. HyDE — hipotetikus szabály-válasz (HU)  │
                        │  2. embedding — a HyDE-szöveg vektora       │
                        │  3. pgvector top-20 (koszinusz-távolság)    │
                        │  4. rerank — kis modell pontoz, top-5 marad │
                        │  5. kontextus + FORRÁS → a válasz-modellnek │
                        └─────────────────────────────────────────────┘
                                        │
  válasz ◄── grounding: forrás (játék + szakasz) kötelező; nincs találat → kimondja
```

## 4. Projektstruktúra (tervezett)

A "egy fogalom = egy könyvtár" elvet követjük (ld. `szabalyok.md`), de **Nx nélkül** —
egy egyszerű pnpm workspace elég (kevesebb tooling-súrlódás, a lényeg a RAG):

```
szabalymester-tarsasjatek-asszisztens/
├── docs/
│   ├── ARCHITEKTURA.md          # tudásbázis-karbantartás terve + ábra
│   ├── chunking-strategia.md    # chunking-döntések + indoklás
│   ├── routing.md               # multi-provider szereposztás + indoklás
│   ├── golden-set.md            # tesztkérdések + módszertan (eredményekkel bővül)
│   ├── koltsegbecsles.md        # költség-módszertan (a README-be kerül a végszám)
│   ├── tervezesi-mintak.md      # RAG-pipeline tervezési minták (repo-független)
│   ├── szabalyok.md             # kód- és projektkonvenciók
│   ├── bmad-workflow.md         # hogyan készül a kód (BMAD)
│   ├── tovabbfejlesztes.md      # opcionális bővítések két ütemben
│   └── abra/                    # architektúra-ábra (Mermaid → PNG)
├── src/
│   ├── ingest/
│   │   ├── parse-document.ts    # front matter + tisztítás
│   │   ├── chunk.ts             # a saját chunking-stratégia (unit-tesztelt!)
│   │   ├── chunk.spec.ts
│   │   └── ingest.ts            # a teljes ingest-futás (CLI: pnpm ingest)
│   ├── rag/
│   │   ├── embed.ts             # embedding (egy + batch)
│   │   ├── store.ts             # pgvector: insert / search / list / delete
│   │   ├── hyde.ts              # hipotetikus szabály-válasz (magyar)
│   │   ├── rerank.ts            # átrangsorolás (generateObject + Zod)
│   │   └── retrieve.ts          # a pipeline zenekari partitúrája + trace
│   ├── agent/
│   │   ├── agent.ts             # tool-use loop (Vercel AI SDK)
│   │   ├── prompt.ts            # system prompt (<grounding> blokkal!)
│   │   └── search-rules-tool.ts
│   ├── eval/
│   │   ├── golden-set.json      # az 5-10 kérdés (+ negatív)
│   │   └── run-golden-set.ts    # nyers vs. teljes pipeline, táblázatos kimenet
│   ├── config.ts                # env-validáció Zod-dal, fail-fast
│   └── cli.ts                   # kérdés-válasz belépési pont + debug parancsok
├── seed/rules/                  # a ~24-28 szabály-markdown (front matterrel)
├── db/
│   └── schema.sql               # knowledge_documents + knowledge_chunks
├── docker-compose.yml           # pgvector/pgvector:pg17
├── .env.example
├── package.json
├── CLAUDE.md                    # Claude Code belépő (olvasási sorrend + architektúra)
├── AGENTS.md                    # tool-független belépő (a CLAUDE.md-re + docs/-ra mutat)
└── README.md                    # futtatás + költségbecslés + dokumentum-térkép
```

Kulcsdöntések a struktúrában:

1. **Nincs Nx / monorepo** — egyetlen package, `src/` alatti fogalmi mappákkal.
2. **Nincs ORM** — a séma egyetlen `schema.sql` (két táblánk van: dokumentum-nyilván­
   tartás + chunkok, ld. `ARCHITEKTURA.md`).
3. **`eval/` mappa a golden setnek** — első osztályú komponens, futtatható scripttel.
4. **Domain-specifikus réteg** — a korpusz, a séma `game` mezője, a promptok és a golden
   set mind társasjáték-specifikus.

## 5. A keresési pipeline — elemek és tervezett megvalósítás

| Elem | Terv | Kulcsdöntés |
|---|---|---|
| Embedding + tárolás | OpenAI `text-embedding-3-small` (1536 dim) + **pgvector** | bevált választás; a magyar szövegen is jól működik; a kérdés és a doksik UGYANAZZAL a modellel |
| HyDE | olcsó/kicsi modell ír 2-3 mondatos **magyar** hipotetikus szabály-választ, EZT embeddeljük | hibánál fallback az eredeti kérdésre |
| Rerank | tág háló (top-20) → kis modell 0-10 pontoz (`generateObject` + Zod) → top-5 | hibánál fallback a vektorsorrendre |
| Grounding | `<grounding>` prompt-blokk + a tool minden chunkhoz forrást ad (játék + szakasz + URL) + üres találatnál explicit "nincs információm" | negatív teszt bizonyítja |
| Multi-provider routing | legalább 2 provider, szereposztás a `routing.md`-ben | olcsó keres, drága válaszol |

Számszerű alapbeállítások (a golden set futásai alapján hangolhatók):

- `WIDE_NET = 20` (vektorkeresés), `KEEP_TOP = 5` (a modellnek)
- chunk célméret: ld. `chunking-strategia.md`
- embedding batch: 100 chunk / API-hívás

## 6. Observability (debug-láthatóság)

Alapelv: "ha rossz a válasz, először a retrievalt nézd". Terv:

- minden retrieval-lépés trace-t ír (HyDE-szöveg, távolságok, rerank-pontok,
  kontextus-méret) — konzolra és JSONL-fájlba
- CLI debug-parancsok:
  - `pnpm debug:sources` — mely szabály-dokumentumok, hány chunkban
  - `pnpm debug:search "<kérdés>"` — nyers vektorkeresés
  - `pnpm debug:search "<kérdés>" --full` — teljes pipeline (HyDE + rerank)
- a golden set futtató (`run-golden-set.ts`) pontosan ezt a két módot veti össze

## 7. Tesztelés

- **Unit**: a chunkolás determinisztikus → `chunk.spec.ts` (határok, átfedés,
  vészfék hosszú bekezdésre, sorszámozás, játéknév-fejléc)
- **Golden set**: 5-10 kérdés + negatív; nyers vs. teljes pipeline összevetés
  dokumentálva (ld. `golden-set.md`)
- unit tesztek a document-parse-ra (front matter) — determinisztikus

## 8. Komponens-térkép

| Komponens | Hol |
|---|---|
| Működő repo: ingest + pipeline + agent + futtatási instrukciók | `src/` + `README.md` |
| Chunking-stratégia + indoklás | `docs/chunking-strategia.md` |
| Golden set + nyers vs. teljes + negatív teszt | `docs/golden-set.md` + `src/eval/` |
| Multi-provider szereposztás | `docs/routing.md` |
| `docs/ARCHITEKTURA.md` + ábra | `docs/ARCHITEKTURA.md` + `docs/abra/` |
| Költségbecslés | `README.md` (módszertan: `docs/koltsegbecsles.md`) |
