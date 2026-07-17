# BMAD-workflow — hogyan valósítjuk meg a tervet

> A megvalósítás a **BMAD-METHOD** (Breakthrough Method for Agile AI-Driven Development)
> fejlesztési segéddel történik. Ez a dokumentum a szereposztást és a lépéssorrendet
> rögzíti — a tervezési dokumentumok (ld. `docs/`) a BMAD bemenetei.

## 1. Miért BMAD?

A BMAD két fázisra bontja az AI-vezérelt fejlesztést:

1. **Tervezési fázis** (Analyst → PM → Architect): a követelményekből PRD és
   architektúra-dokumentum készül — nálunk ez lényegében **kész**: a `docs/` mappa
   tervezetei ezt a szerepet töltik be, a BMAD tervezési ügynökei ezekből dolgoznak.
2. **Fejlesztési ciklus** (Scrum Master → Dev → QA): a terv **story-kra** darabolódik,
   minden story önállóan implementálható és tesztelhető — a kontextus sosem hízik túl,
   mert a Dev-ügynök mindig csak az aktuális story-t és a rá vonatkozó terv-részletet kapja.

Ehhez a projekthez azért illik, mert a részfeladatok (chunking, pipeline, golden set,
agent) jól szeparálható, egymásra épülő egységek — pontosan story-méretűek.

## 2. Szereposztás (BMAD-ügynökök → a mi feladatunkban)

| BMAD-ügynök | Feladata nálunk | Bemenete |
|---|---|---|
| **Analyst** | a követelmények és a tervezési minták validálása | `terv.md`, `tervezesi-mintak.md` |
| **PM** | PRD finomítás: komponens-térkép, elfogadási kritériumok | `terv.md` 8. pont, `golden-set.md` 4. pont |
| **Architect** | a technikai terv véglegesítése (struktúra, séma, pipeline-paraméterek) | `terv.md`, `ARCHITEKTURA.md`, `chunking-strategia.md`, `routing.md` |
| **Scrum Master** | a story-k kivágása és sorrendezése (ld. 3. pont) | a fenti tervek |
| **Dev** | story-nkénti implementáció TDD-vel | aktuális story + érintett terv-szakasz |
| **QA** | tesztek felülvizsgálata, golden set futtatás, elfogadási kritériumok ellenőrzése | `golden-set.md`, `chunk.spec.ts` |

## 3. Story-terv (a fejlesztési ciklus sorrendje)

Minden story önállóan zöldre vihető; a sorrend a függőségeket követi:

1. **Alapozás** — repo-váz, pnpm, TypeScript strict, Vitest, ESLint/Prettier,
   `docker-compose.yml` (pgvector), `.env.example`, `config.ts` (Zod, fail-fast)
2. **Séma** — `schema.sql`: `knowledge_documents` + `knowledge_chunks` (vector(1536)),
   kapcsolat + CASCADE (ld. `ARCHITEKTURA.md` 1. pont)
3. **Dokumentum-parse** — front matter, zaj-szűrés, normalizálás + unit tesztek
4. **Chunkolás** — a `chunking-strategia.md` szerinti chunker + a 8 unit teszt
   (TDD: előbb a tesztek)
5. **Embedding + store** — `embed.ts` (batch), `store.ts` (insert/search/list/delete)
6. **Ingest** — a teljes ingest-futás hash-alapú kihagyással (inkrementális mag),
   `--rebuild` kapcsolóval; token-használat naplózása (költségbecsléshez)
7. **HyDE + rerank + retrieve** — a pipeline a fallback-ekkel + trace
8. **Agent + grounding** — tool-use loop, system prompt `<grounding>` blokkal,
   searchRules tool forrás-payloaddal (játék + szakasz + URL), CLI belépési pont
9. **Debug-parancsok** — `debug:sources`, `debug:search [--full]`
10. **Golden set** — `golden-set.json` + `run-golden-set.ts`, futtatás, az eredmények
    és az átrendezés-elemzés beírása a `golden-set.md`-be
11. **Negatív teszt + költségbecslés** — a mért számok a README-be
12. **Architektúra-ábra** — Mermaid → PNG a `docs/abra/` mappába (kész: `tudasbazis-karbantartas.png`) + README-véglegesítés

Opcionális, a 12 story utáni bővítések (önállóan ráépíthetők): ld. `tovabbfejlesztes.md`
(első terv: metaadat-szűrés, LLM-judge, abstention, multi-turn, CI; második terv: abláció,
chunking A/B, hibrid keresés).

## 4. Munkamenet-szabályok

- Egy story = egy feature branch = kicsi, fókuszált commitok (Conventional Commits).
- A Dev-ügynök minden story-nál megkapja: a story-leírást + a vonatkozó tervdokumentum
  szakaszát + a konvenciókat (`szabalyok.md`) — mást nem.
- QA-kapu minden story végén: `pnpm test` zöld + az adott story elfogadási kritériuma.
- A 10-11. story kimenete DOKUMENTUM-frissítés is (golden-set.md, README) — a kód
  önmagában nem elég, a projekt értéke a mért eredmények elemzésében van.
