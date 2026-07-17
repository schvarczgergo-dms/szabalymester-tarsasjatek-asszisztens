# AGENTS.md

Tool-független belépő AI kódügynököknek. A részletes útmutató a **`CLAUDE.md`**-ben van
(olvasási sorrend, architektúra, kemény szabályok, parancsok) — kezeld azt az elsődleges
forrásként. A tervek és a döntések a **`docs/`** mappában élnek; azok az igazság forrása.

## Gyors orientáció

- **Mi ez**: RAG-alapú társasjáték-szabály asszisztens. Természetes nyelvű kérdésre a
  hivatalos szabálykönyvekből válaszol, **magyarul**, forrásmegjelöléssel (játék + szakasz);
  ha nincs találat, kimondja — nem talál ki szabályt.
- **Hol kezdd**: `docs/terv.md` (a teljes terv) → `docs/bmad-workflow.md` (story-sorrend) →
  `docs/szabalyok.md` (konvenciók). Az architektúra rövid összefoglalója: `CLAUDE.md`.
- **Stack**: TypeScript (strict), pnpm, PostgreSQL 17 + pgvector, Vercel AI SDK, Zod,
  Vitest, tsx. Nincs Nx, nincs ORM.

## A legfontosabb szabályok (a teljes lista: `CLAUDE.md` + `docs/szabalyok.md`)

- Egy fogalom = egy könyvtár; a fájlnév hordozza a szerepét (`*-tool.ts`, `*-prompt.ts`, `*.spec.ts`).
- TypeScript strict; `unknown` a külső inputra; Zod-validáció a rendszer-határokon, fail-fast.
- Grounding: a válasz KIZÁRÓLAG a visszakapott chunkokból, forrással; üres találatnál mondja ki.
- Routing: olcsó modell keres, erős modell válaszol; a kérdést és a doksikat ugyanazzal az
  embedding-modellel vektorizáld.
- A chunkolás determinisztikus → előbb a unit tesztek (TDD).
- Magyar korpusz + magyar válasz. Titkok `.env`-ben. Conventional Commits, feature branch.
- A `docs/bmad-workflow.md` story-sorrendjében építs; opcionális bővítéseket
  (`docs/tovabbfejlesztes.md`) ne keverj az alap-pipeline-ba.
