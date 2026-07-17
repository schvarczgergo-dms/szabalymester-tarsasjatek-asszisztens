# Szabálymester — RAG-alapú társasjáték-szabály asszisztens

> Természetes nyelvű társasjáték-szabály kérdésekre válaszol a hivatalos szabálykönyvekből,
> **magyarul**, forrásmegjelöléssel (játék + szakasz). Jelenleg a **tervezési fázisban**
> van: a kód a BMAD-workflow-val készül a `docs/` alatti tervek alapján.

## A projekt egy mondatban

Működő RAG-pipeline társasjáték-szabályokra: 7-8 népszerű játék hivatalos magyar
szabálykönyve a tudásbázisban, saját chunking-stratégia (szakasz-alapú, játéknév-fejléc),
teljes keresési pipeline (HyDE + rerank), grounding forráshivatkozással, multi-provider
routing — plusz külön architektúra-spec a tudásbázis karbantartásáról.

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
| [`docs/tervezesi-mintak.md`](docs/tervezesi-mintak.md) | a RAG-pipeline repo-független tervezési mintái (a megvalósításhoz) | — (háttér) |
| [`docs/szabalyok.md`](docs/szabalyok.md) | kód- és projektkonvenciók (a Dev-ügynök ezekre hivatkozik) | — (háttér) |
| [`docs/bmad-workflow.md`](docs/bmad-workflow.md) | a megvalósítás menete BMAD-dal: szereposztás + 12 story | — (folyamat) |
| [`docs/tovabbfejlesztes.md`](docs/tovabbfejlesztes.md) | opcionális bővítések két ütemben (metaadat-szűrés, LLM-judge, abstention, multi-turn, CI; majd abláció, chunking A/B, hibrid keresés) | — (roadmap) |

## Tudásbázis (korpusz)

7-8 népszerű játék hivatalos magyar szabálykönyve (Catan, Carcassonne, Ticket to Ride,
Pandémia, 7 Csoda, Azul, Splendor, King of Tokyo), játékonként 3-4 tagolt markdownban
(áttekintés / előkészület / játékmenet / pontozás-GYIK) → ~24-28 dokumentum, > 15 000 szó.
Forrás: hivatalos magyar szabály-PDF-ek (Gémklub / kiadói oldal / BoardGameGeek *Files*),
a `source` mezőben a letöltési URL-lel.

## Tervezett stack

TypeScript (strict) + Node LTS + pnpm · PostgreSQL 17 + pgvector (docker-compose) ·
Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) · Zod · Vitest · tsx

## Költségbecslés

*(A tényleges futások után töltendő a `docs/koltsegbecsles.md` sablonja szerint.)*
Előzetes nagyságrend: ingest ~fél cent (~80-100K embedding-token); egy kérdés a teljes
pipeline-nal ~$0.03 (~10-12 Ft), amiből ~85% a válasz-modell.

## Futtatás

*(A kód elkészülte után töltendő: docker compose up, pnpm ingest, pnpm cli ask,
pnpm eval:golden-set, debug-parancsok.)*
