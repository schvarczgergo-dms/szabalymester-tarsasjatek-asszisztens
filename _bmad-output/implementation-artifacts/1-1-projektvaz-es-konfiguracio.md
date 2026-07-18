# Story 1.1: Projektváz és fail-fast konfiguráció

Status: ready-for-dev

## Story

As a fejlesztő,
I want egy felállított projektvázat validált, fail-fast konfigurációval,
so that a rendszer determinisztikusan és biztonságosan indul, és a többi story erre épülhet.

## Acceptance Criteria

1. Egy friss klónon `pnpm install` + a toolchain (TypeScript **strict**, Vitest, ESLint, Prettier) beáll, és a `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check` **zölden** fut.
2. `docker compose up -d` elindítja a `pgvector/pgvector:pg17` konténert (healthcheckkel); `pnpm db:up`/`pnpm db:down` wrapper is működik.
3. A `config.ts` **Zod-dal, fail-fast** validálja az env-et: kötelező titkok (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`) + opcionális, env-ből felülírható modellnevek és pipeline-paraméterek; a titkok `.env`-ből jönnek (FR-24, FR-25, AD-6).
4. Hiányzó/üres kötelező titokra a rendszer a **változó nevét megnevező** `ConfigError`-ral, indulás előtt leáll.
5. A `config` unit-tesztelt (izolált, valós kulcs nélkül futtatható): érvényes env, alapértelmezések, env-felülírás, numerikus konverzió, hiányzó/üres/érvénytelen esetek.

## Tasks / Subtasks

- [ ] **T1: Projekt-init és package.json** (AC: 1)
  - [ ] `package.json`: `"type": "module"`, `"packageManager": "pnpm@11.x"`, `engines.node >= 20`.
  - [ ] Scriptek: `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch` (`vitest`), `lint` (`eslint .`), `format` (`prettier --write .`), `format:check` (`prettier --check .`), `db:up` (`docker compose up -d`), `db:down` (`docker compose down`).
- [ ] **T2: TypeScript strict tsconfig** (AC: 1)
  - [ ] `target ES2023`, `module ESNext`, `moduleResolution Bundler`, `types: ["node"]`, `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, `noEmit: true`, `skipLibCheck: true`; `include: ["src", "vitest.config.ts"]`.
- [ ] **T3: Függőségek telepítése** (AC: 1)
  - [ ] runtime: `zod`, `dotenv`.
  - [ ] dev: `typescript@5` (**FONTOS: pinneld 5.x-re**), `tsx`, `vitest`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `prettier`.
  - [ ] `pnpm-workspace.yaml`: `allowBuilds:\n  esbuild: true` majd `pnpm install` (az esbuild build-scriptje kell a tsx/vitest-hez).
- [ ] **T4: Vitest + ESLint(flat) + Prettier konfiguráció** (AC: 1)
  - [ ] `vitest.config.ts`: `test.include: ['src/**/*.spec.ts']`, `environment: 'node'`, `globals: false`.
  - [ ] `eslint.config.mjs` (flat): `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`; `@typescript-eslint/no-unused-vars` `argsIgnorePattern`/`varsIgnorePattern`/`caughtErrorsIgnorePattern: '^_'`; ignores `dist/ node_modules/ coverage/`.
  - [ ] `.prettierrc.json` (semi, singleQuote, trailingComma all, printWidth 100); `.prettierignore` kizárja: `*.md`, `_bmad/`, `_bmad-output/`, `.claude/skills/`, `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`.
- [ ] **T5: docker-compose + .env.example + .gitattributes** (AC: 2, 3)
  - [ ] `docker-compose.yml`: `pgvector/pgvector:pg17`, `container_name: szabalymester-db`, env `POSTGRES_USER/PASSWORD/DB` (alap: `szabalymester`), port `${POSTGRES_PORT:-5432}:5432`, named volume `pgdata`, `pg_isready` healthcheck.
  - [ ] `.env.example`: kötelező kulcsok + `DATABASE_URL` + a modell-defaultok + pipeline-paraméterek (ld. Dev Notes).
  - [ ] `.gitattributes`: `* text=auto eol=lf` és `*.png binary`.
- [ ] **T6: config.ts (Zod, fail-fast, lazy)** (AC: 3, 4)
  - [ ] `loadConfig(env = process.env): Config` — **lazy** (NEM top-level singleton), hogy a teszt izoláltan, valós kulcs nélkül fusson; `ConfigError extends Error`.
- [ ] **T7: config.spec.ts (8 teszt)** (AC: 5)
  - [ ] érvényes env; alapértelmezések; modellnév-felülírás; numerikus konverzió (`WIDE_NET`/`KEEP_TOP`); hiányzó kulcs → `ConfigError` + a változó neve; üres kulcs → hiba; érvénytelen numerikus → hiba; nem-pozitív paraméter → hiba.
- [ ] **T8: Zöld-kapu** (AC: 1, 2)
  - [ ] `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` zöld; `docker compose config -q` OK.

## Dev Notes

### Stack (web-ellenőrzött, 2026-07 — az architektúra-spine köti)

- **Node.js 24 LTS · TypeScript 5.9 (strict) · pnpm 11 · Zod 4 · Vitest 4 · tsx · ESLint flat config · Prettier.**
- **Adatbázis:** PostgreSQL 17 + pgvector 0.8 (Dockerből). [Source: ARCHITECTURE-SPINE.md#Stack]

### 🚨 Kritikus gotcha-k (ezek nélkül a zöld-kapu elhasal)

1. **TypeScript pin `^5.9`** — a `typescript@7` (natív Go-port) telepszik alapból, de a `typescript-eslint` még nem támogatja → a `pnpm lint` `TypeError: Cannot read properties of undefined (reading 'Cjs')`-szel elhasal. `pnpm add -D typescript@5`.
2. **esbuild build-script engedélyezése** — pnpm 11 alapból tiltja; enélkül **minden** script `[ERR_PNPM_IGNORED_BUILDS]`-szal áll le. Megoldás: `pnpm-workspace.yaml` → `allowBuilds:\n  esbuild: true`, majd `pnpm install`. (A régi `package.json > pnpm.onlyBuiltDependencies` már NEM olvasódik pnpm 11-ben.)
3. **`no-unused-vars` `^_` minta** — a destrukturálásos kihagyás (`const { X: _omitted, ...rest }`) különben lint-hibát ad.
4. **Prettier ne formázza** a `*.md`-t (kézzel írt docs) és a `_bmad*`/`.claude/skills/` fákat → `.prettierignore`.
5. **`.gitattributes` `eol=lf`** — Windowson a git `autocrlf` és a Prettier (LF) különben végtelen CRLF↔LF harcot vív.
6. **`loadConfig` LEGYEN lazy** (paraméteres, nem import-időben futó singleton), különben a `config.spec.ts` valós kulcsok nélkül nem fut, és a story-k importja bedől.

### config.ts — kötelező mezők és alapértelmezések

Zod-séma (kulcs → env → default). A **modell-defaultok az architektúra-spine web-ellenőrzött értékei** (NEM a `docs/` régi, elavult nevei):

| Config kulcs | Env | Kötelező / Default |
|---|---|---|
| `openaiApiKey` | `OPENAI_API_KEY` | **kötelező** |
| `anthropicApiKey` | `ANTHROPIC_API_KEY` | **kötelező** |
| `databaseUrl` | `DATABASE_URL` | **kötelező** |
| `embeddingModel` | `EMBEDDING_MODEL` | `text-embedding-3-small` |
| `embeddingDimensions` | `EMBEDDING_DIMENSIONS` | `1536` |
| `hydeModel` | `HYDE_MODEL` | `gpt-5.4-nano` |
| `rerankModel` | `RERANK_MODEL` | `claude-haiku-4-5` |
| `answerModel` | `ANSWER_MODEL` | `claude-sonnet-5` |
| `wideNet` | `WIDE_NET` | `20` |
| `keepTop` | `KEEP_TOP` | `5` |

- **Zod 4 figyelmeztetés:** a `required_error`/`invalid_type_error` opciók megszűntek. Kötelező mezőre használj `z.preprocess((v)=> v==null?'':v, z.string().min(1, "<VAR> hiányzik vagy üres"))`-t, így az undefined ÉS az üres string is a mi magyar üzenetünket adja. Numerikusra `z.coerce.number().int().positive().default(n)`.
- Hibánál gyűjtsd az `issues`-t és dobj **egy** `ConfigError`-t, sorolva a hibás változókat (a path/az üzenet nevezze meg a változót).
- `import 'dotenv/config'` a fájl tetején (betölti a `.env`-et; nem dob, ha hiányzik).

### Project Structure Notes

- „Egy fogalom = egy könyvtár": most csak `src/config.ts` + `src/config.spec.ts` (a teszt a kód mellett). A `src/{ingest,rag,agent,eval}` a következő story-kban jön. [Source: ARCHITECTURE-SPINE.md#Structural-Seed]
- **AD-6 (config-határ):** minden titok `.env`-ből, fail-fast a határon, modellnevek env-felülírhatók. [Source: ARCHITECTURE-SPINE.md#AD-6]
- **Környezeti maradvány:** a working tree-ben lehet egy árva `node_modules/` és egy futó `szabalymester-db` konténer korábbi kísérletből — a `pnpm install` és a `docker compose up -d` ezt rekonszolidálja, nem gond.

### Testing Standards

- Vitest; a spec a kód mellett (`config.spec.ts`); a teszt **explicit env-objektumot** ad át a `loadConfig`-nak (izolált, determinista, nincs `process.env`-függés). `describe/it/expect` importból (`globals: false`).

### References

- [Source: epics.md#Story-1.1] — AC-k és FR-lefedettség (FR-24, FR-25).
- [Source: prd.md#FR-24] fail-fast env-validáció; [#FR-25] env-felülírható routing.
- [Source: ARCHITECTURE-SPINE.md#AD-6] config-határ; [#Stack] verziók; [#Consistency-Conventions] névadás/teszt-elhelyezés.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
