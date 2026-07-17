# Szabályok — kód- és projektkonvenciók

> A megvalósításhoz követett, **repo-független** konvenciók. Ezekre hivatkozik a Dev-ügynök
> minden story-nál (ld. `bmad-workflow.md`).

## Projektszervezés

- **Egy fogalom = egy könyvtár**: minden agent és minden tool saját mappát kap a teljes
  felszerelésével (séma, validátor, kliens, teszt) — aki a toolt olvassa, egy helyen lát
  mindent, ami hozzá tartozik.
- **A közös kód eggyel kintebb lakik** a fogalmak szintjén (pl. a közös retrieve/agent-loop).
  Így a könyvtárlista maga a térkép: ami mappa, az egy példány; ami fájl, az a közös alap.
- Bekötés = egy sor: új tool felvétele az agenthez egy bejegyzés a toolset-jében — ne legyen
  központi dispatch/registry, amit párhuzamosan kell karbantartani.
- Sok kis, fókuszált fájl; magas kohézió, alacsony csatolás; feature/domain szerint rendezz.

## Elnevezés

- **A fájlnév hordozza a szerepét**: `*-tool.ts`, `*-prompt.ts`, `*-agent.ts`, `*-schema.ts`,
  `*.spec.ts` — a típus-utótagból ránézésre látszik, mi micsoda.
- `camelCase` változó/függvény, `PascalCase` típus, `UPPER_SNAKE` konstans; fájlnév
  `kebab-case`. Beszédes nevek; boolean `is`/`has`/`can` prefix; függvény = ige.

## TypeScript

- `strict` mód; explicit típus a publikus API-n, lokálisan elég az inferencia.
- `unknown` a külső/megbízhatatlan inputra, NEM `any`; szűkíts biztonságosan.
- Immutabilitás — ne mutálj állapotot.

## Validáció és hibakezelés

- **Validáció a rendszer-határokon** (Zod), fail-fast, beszédes hibaüzenettel (env, tool-input,
  külső API-válasz, LLM-output — mind megbízhatatlan).
- async `try/catch`; az `unknown` errort szűkítsd (`instanceof Error`); ne nyeld el némán.

## Promptok (a modellnek szóló szöveg)

- A promptokat és tool-leírásokat **egy blokkban, template literálként** írjuk — úgy
  szerkeszted, ahogy a modell látja (nem darabolva, nem `' + '`-szal fűzve).
- A system prompt **XML-szerű tagekkel** tagolt (`<role>`, `<task>`, `<grounding>`,
  `<schema>`, `<rules>`, `<tools>`) — csökkenti a hallucinációt.

## Tesztelés

- **A teszt a tesztelt kód mellett lakik** (`chunk.ts` → `chunk.spec.ts`), nem külön fában.
- TDD ahol értelmes (piros → zöld → refaktor); egy teszt egy dolgot ellenőrizzen;
  determinista, izolált tesztek.

## Naplózás és biztonság

- A termékkódban strukturált trace/logger, nem szórványos `console.log`.
- Titkok `.env`-ben, soha a repóba (gitignore); paraméterezett lekérdezések
  (ne építs SQL-t string-konkatenációval).

## Git

- Conventional Commits, feature branch, kicsi fókuszált commitok (egy lépés = egy commit).
