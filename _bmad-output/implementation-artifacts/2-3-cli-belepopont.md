---
baseline_commit: 0bb91de
---

# Story 2.3: CLI-belépőpont a kérdés-válaszhoz

Status: done

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

- [x] **T1: `src/cli.ts` (+ `cli.spec.ts`) — TDD** — `parseCliArgs` (ask/help/error, több szavas kérdés összefűzve), `formatAnswer` (válasz + egyedizett „Források:" lista a `reports`-ból), `main()` (loadConfig fail-fast → createAgent → ask → formatAnswer → finally close), belépő-guard `pathToFileURL`. 8 unit teszt.
- [x] **T2: `package.json` — `cli` script** — `"cli": "tsx src/cli.ts"`.
- [x] **T3: Zöld-kapu** — `pnpm test` 166 pass +1 skip; `typecheck · lint · format:check` zöld.
- [x] **T4: Éles smoke (Ollama)** — `pnpm cli ask "..."` végigfutott: magyar válasz + Források-lista (játék · szakasz · URL). A válasz *tartalmi pontossága* a 3B modellen gyenge (dokumentált korlát), a CLI/grounding-mechanizmus helyes.

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

Claude Opus 4.8 (`claude-opus-4-8`) — Cursorból.

### Debug Log References

- Unit: `cli.spec.ts` 8 teszt (parseCliArgs + formatAnswer); teljes csomag 166 pass + 1 skip.
- Kapu: typecheck · lint · format:check zöld.
- Éles smoke (Ollama): `pnpm cli ask "..."` → magyar válasz + Források-lista; ~49s (HyDE+embed+rerank+válasz a 3B-n).

### Completion Notes List

- `src/cli.ts`: `parseCliArgs` (ask/help/error, több szavas kérdés összefűzve), `formatAnswer` (válasz + egyedizett „Források:" a `reports[].report.sources`-ból — a grounding a CLI-n is látszik), `main()` fail-fast `loadConfig` → `createAgent` → `ask` → `formatAnswer`, `finally close()` (pg-pool), belépő-guard `pathToFileURL`-lel. `package.json`: `cli` script.
- A tiszta függvények unit-tesztelve; a `main()` (élő modellhívás) élő smoke-olva.
- **Ismert korlát (dokumentált):** a válasz tartalmi pontossága a lokális `qwen2.5:3b`-n gyenge; a CLI, a grounding-forráslista és a magyar kimenet helyes. Éles minőség: erős válasz-modell.

### File List

- `src/cli.ts` (új)
- `src/cli.spec.ts` (új)
- `package.json` (módosítva — `cli` script)

### Change Log

- 2026-07-18: Story 2.3 implementálva — `pnpm cli ask "<kérdés>"` belépőpont (parseCliArgs + formatAnswer + main), TDD 8 teszt, élő smoke Ollamán. Status → done.
