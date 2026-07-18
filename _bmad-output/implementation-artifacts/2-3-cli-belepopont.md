---
baseline_commit: c06eeef
---

# Story 2.3: CLI-belépőpont a kérdés-válaszhoz

Status: ready-for-dev

## Story

As a játékos,
I want egy egyszerű parancssori belépőpontot,
so that természetes nyelven kérdezhetek és azonnal grounded választ kapok.

## Acceptance Criteria

1. **`pnpm cli ask "<kérdés>"` (FR — CLI):** lefuttatja a teljes agent-pipeline-t (retrieve → grounded válasz) és kiírja a magyar, forrásmegjelölt választ + a felhasznált forrásokat (játék · szakasz · URL).
2. **Fail-fast config:** a `main()` a `loadConfig()`-gal indul (hiányzó env → beszédes hiba, kilépés); a titkok `.env`-ből (AD-6).
3. **Negatív út a CLI-n át:** a korpuszban nem szereplő játékra/adatra a válasz explicit nemleges (az agent absztenál) — a grounding a CLI-n keresztül is látszik.
4. **Használat/hiba:** argumentum nélkül vagy ismeretlen parancsra rövid használati üzenet; a hibák nem dobnak nyers stacktrace-t a felhasználóra.
5. **Tesztelhetőség (NFR-3):** az argumentum-parszolás (`parseCliArgs`) és a válasz-formázás (`formatAnswer`) tiszta függvények, unit-tesztelve; a tényleges futás (modellhívás) élő/integrációs.

## Tasks / Subtasks

- [ ] **T1: `src/cli.ts` (+ `cli.spec.ts`) — TDD** (AC: 1–5)
  - [ ] `parseCliArgs(argv) → { command: 'ask'; question } | { command: 'help' } | { command: 'error'; message }` — tiszta; az `ask` utáni argumentumok a kérdéssé fűzve.
  - [ ] `formatAnswer(result) → string` — a válasz + „Források:" lista a `reports` egyedi forrásaiból (játék · szakasz · URL); üres/absztenció esetén is értelmes kimenet.
  - [ ] `main()` — `parseCliArgs(process.argv)`; `ask` → `loadConfig()` → `createAgent(config)` → `agent.ask(question)` → `formatAnswer` kiírás → `close()`; `help`/`error` → használati üzenet; try/catch a beszédes hibához.
  - [ ] Belépő-guard `pathToFileURL`-lel (cross-platform), mint az `ingest.ts`-ben.
  - [ ] Tesztek: `parseCliArgs` (ask/help/error/több szavas kérdés); `formatAnswer` (források listázása, egyediség, absztenció-eset).
- [ ] **T2: `package.json` — `cli` script** (AC: 1) — `"cli": "tsx src/cli.ts"`.
- [ ] **T3: Zöld-kapu** (AC: 5) — `pnpm test` + `typecheck · lint · format:check` zöld.
- [ ] **T4 (opcionális): Éles smoke** — `pnpm cli ask "..."` az Ollamán (pozitív + negatív), a válasz + források láthatók.

## Dev Notes

### Kényszerek
- **AD-6 (config fail-fast):** a `main()` első lépése `loadConfig()`; a titkok `.env`-ből. [Source: ARCHITECTURE-SPINE.md#AD-6]
- **AD-1 (grounding):** a CLI a grounded agentet hívja; a negatív út (absztenció) a CLI-n is látszik. [Source: #AD-1]
- **AD-9:** a `cli` az `agent`-et importálja (és az `ingest`-et külön parancsként korábban); nem nyúl közvetlenül a `rag`-ba. [Source: #AD-9]

### Bemenet és interfészek (meglévő kód)
- **`src/agent/agent.ts` (2.2):** `createAgent(config) → { ask(question) → AgentAnswer, close }`; `AgentAnswer = { answer, reports: ToolOutcome[], usage }`. A források a `reports[].report.sources`-ból.
- **`src/config.ts`:** `loadConfig()` fail-fast.
- **Minta:** az `ingest.ts` `main()` + belépő-guard (`pathToFileURL`) és a `process.argv` kezelése.

### 🚨 Gotcha-k
1. **A kérdés több argumentumból is jöhet** (ha nincs idézőjelben): az `ask` utáni argumentumokat fűzd össze szóközzel.
2. **Belépő-guard `pathToFileURL`** (Windows), ne kézi `file://` fűzés (ld. Story 1.6 tanulság).
3. **A `close()` mindig fusson** (finally) — a pg-pool bezárása, különben a folyamat lóg.
4. **Ne dobj nyers hibát a felhasználóra:** `ConfigError`/egyéb → beszédes magyar üzenet + `process.exit(1)`.
5. **A forrás-lista a `reports`-ból** (a modell-látható `content` nem tartalmazza strukturáltan) — a `formatAnswer` a `report.sources`-t listázza, egyedizve.

### Project Structure Notes
- Új: `src/cli.ts` (+ `cli.spec.ts`). Módosul: `package.json` (`cli` script). A `cli.ts` a Structural Seed szerinti belépőpont (kérdés-válasz + később debug-parancsok, Story 3.1).

### Testing Standards
- Vitest, TDD; a tiszta `parseCliArgs`/`formatAnswer` unit-tesztelt. A `main()` (élő modellhívás) NEM unit — élő smoke (T4).

### References
- [Source: epics.md#Story-2.3] AC-k; [Source: ARCHITECTURE-SPINE.md#Structural-Seed] (`cli.ts` belépőpont), [#AD-6, #AD-1, #AD-9].
- Bemenet: `src/agent/agent.ts`, `src/config.ts`, minta: `src/ingest/ingest.ts`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log
