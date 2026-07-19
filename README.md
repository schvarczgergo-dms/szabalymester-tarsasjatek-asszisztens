# Szabálymester — RAG-alapú társasjáték-szabály asszisztens

> Természetes nyelvű társasjáték-szabály kérdésekre válaszol a tudásbázisból, **magyarul**,
> forrásmegjelöléssel (játék + szakasz + URL). A pipeline **működik**: ingest → keresés
> (HyDE + rerank) → grounded agent-válasz + CLI + golden-set kiértékelés. A modellek
> futtathatók **helyi Ollamán** (ingyenes, ld. `docs/local-mode.md`) vagy felhőben (OpenAI + Anthropic).

## A projekt egy mondatban

Működő RAG-pipeline társasjáték-szabályokra: 28 játék **jogtiszta, CC BY-SA 4.0** forrásból
(angol Wikipédia/Wikibooks, 54 dokumentum) a tudásbázisban, saját chunking-stratégia
(szakasz-alapú, játéknév-fejléc), teljes keresési pipeline (HyDE + rerank), grounding
forráshivatkozással, multi-provider routing, kereszt-nyelvű RAG (angol korpusz → magyar válasz)
— plusz külön architektúra-spec a tudásbázis karbantartásáról.

## Miért ez a domain?

- **Grounding bizonyítható**: a nyelvi modell a specifikus szabályokat gyakran
  hallucinálja → látszik, hogy az agent CSAK a tudásbázisból válaszol. Negatív teszt:
  olyan játékról kérdezünk, ami nincs a korpuszban.
- **HyDE értelmet nyer**: a laikus kérdés ("mi van, ha nem tudok lépni?") messze esik a
  szabálykönyv nyelvétől.
- **Rerank megmutatja az értékét**: az élhelyzet-szabályok elrejtve az általánosak közt.
- **Anafora**: "húzz 2 lapot" — a chunk a játék neve nélkül nem azonosítható → ez
  indokolja a játéknév-fejléces chunkolást.

## Dokumentum-térkép

| Dokumentum | Tartalom | Szerep |
|---|---|---|
| [`docs/terv.md`](docs/terv.md) | use case (Szabálymester), korpusz, célarchitektúra, projektstruktúra, pipeline-terv, komponens-térkép | a repo terve |
| [`docs/chunking-strategia.md`](docs/chunking-strategia.md) | szakasz-alapú chunkolás játéknév-fejléccel + indoklás a korpusz tagoltságából + unit-teszt terv | chunking-stratégia leírása |
| [`docs/routing.md`](docs/routing.md) | multi-provider szereposztás (OpenAI + Anthropic) + indoklás + degradációs lánc | multi-provider szereposztás |
| [`docs/golden-set.md`](docs/golden-set.md) | 10 tesztkérdés (2 negatív) + módszertan + elfogadási kritériumok | golden set + negatív teszt |
| [`docs/ARCHITEKTURA.md`](docs/ARCHITEKTURA.md) | a tudásbázis inkrementális karbantartásának terve (hash-alapú változásérzékelés, errata, törlés, triggerek) + adatfolyam-ábra | architektúra-spec |
| [`docs/koltsegbecsles.md`](docs/koltsegbecsles.md) | költség-módszertan + előzetes kalkuláció (a mért számok ide, a README-be kerülnek) | költségbecslés |
| [`docs/ROI.md`](docs/ROI.md) | üzleti ROI: emberi munkaerő vs. RAG-asszisztens (felhő/lokális) összevetés, megtérülés, hibrid modell | ROI-elemzés |
| [`docs/tervezesi-mintak.md`](docs/tervezesi-mintak.md) | a RAG-pipeline repo-független tervezési mintái (a megvalósításhoz) | — (háttér) |
| [`docs/szabalyok.md`](docs/szabalyok.md) | kód- és projektkonvenciók (a Dev-ügynök ezekre hivatkozik) | — (háttér) |
| [`docs/bmad-workflow.md`](docs/bmad-workflow.md) | a megvalósítás menete BMAD-dal: szereposztás + 12 story | — (folyamat) |
| [`docs/tovabbfejlesztes.md`](docs/tovabbfejlesztes.md) | opcionális bővítések két ütemben (metaadat-szűrés, LLM-judge, abstention, multi-turn, CI; majd abláció, chunking A/B, hibrid keresés) | — (roadmap) |

## Tudásbázis (korpusz)

28 népszerű társasjáték leírása **jogtiszta, CC BY-SA 4.0 forrásból** (angol Wikipédia +
néhány Wikibooks), a szabály-releváns szakaszokra szűrve → **54 dokumentum, ~17 600 szó**,
minden fájlban attribúcióval. A `source` a cikk-URL + szakasz-horgony. A hivatalos, jogvédett
kiadói szabálykönyveket NEM használjuk. Részletek: `seed/README.md`. A korpusz angol, a válasz
magyar (kereszt-nyelvű RAG). **Gloomhaven** szándékosan kimarad (a golden-set negatív tesztje).

## Tervezett stack

TypeScript (strict) + Node LTS + pnpm · PostgreSQL 17 + pgvector (docker-compose) ·
Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) · Zod · Vitest · tsx

## Költségbecslés (mért)

A fejlesztés **helyi Ollamán** futott → a tényleges pénzköltség **$0** (ingyenes). A mért
token-használat viszont valós, és ebből a felhő-projekció kiszámolható (`src/eval/cost.ts`):

| Művelet | Mért token | Lokális (Ollama) | Felhő-projekció |
|---|---|---|---|
| **Ingest** (54 dok / 157 chunk) | ~28 500 embedding-token | **$0** | ~$0.0006 (embedding centtört) |
| **Egy kérdés** (teljes pipeline) | ~7–8 000 token (HyDE + embedding + rerank + válasz) | **$0** | ~$0.02–0.03, amiből **~85% a válasz-modell** |

A válasz-modell (Claude Sonnet felhőben) dominálja a kérdés-költséget — ezért éri meg az
olcsó modellt keresésre, az erőset csak a válaszra használni (routing, `docs/routing.md`).
Módszertan: `docs/koltsegbecsles.md`.

## Futtatás

```bash
pnpm install
docker compose up -d --wait      # PostgreSQL 17 + pgvector
pnpm db:schema                   # séma alkalmazása (meglévő köteten)
cp .env.example .env             # majd töltsd ki (felhő-kulcsok VAGY lokális Ollama — ld. docs/local-mode.md)
pnpm ingest                      # korpusz → chunk → embed → pgvector (inkrementális; --rebuild a teljes újraépítéshez)
pnpm cli ask "Catanban mi történik, ha 7-est dobok?"
pnpm debug:sources               # mi van a tudásbázisban
pnpm debug:search "..." --full   # nyers vs. teljes retrieval (trace-szel)
pnpm eval:golden-set             # golden set: nyers vs. teljes + negatív teszt → docs/golden-set-eredmenyek.md
pnpm test                        # unit tesztek
```

**Lokális (ingyenes) mód:** Ollama + a `.env` base-URL override — a teljes lánc fizetős API
nélkül fut. Lépésről lépésre: [`docs/local-mode.md`](docs/local-mode.md).
