---
baseline_commit: 0700cdd
---

# Story 2.2: Grounded agent és `searchRules` tool

Status: ready-for-dev

## Story

As a játékos,
I want forrásmegjelölt, grounded választ a szabálykérdésemre,
so that megbízhatóan eldönthetem a szabályhelyzetet, és tudom, ha valamiről nincs adat.

## Acceptance Criteria

1. **`searchRules` tool (FR-15, AD-8):** egy tool-könyvtár (modell-felé leírás + Zod-input + factory); az `execute` SOHA nem dob — `ToolOutcome`-ot ad vissza (rossz inputból is a mi magyar hibaszövegünk). Minden találat forrást hordoz (játék + szakasz + URL).
2. **`ToolOutcome` egyetlen közös típus (AD-8):** `status` diszkriminátor + `content: string` (modell-látható) + `report: TraceEntry` (trace-csatorna, saját sémával). A modell CSAK a `content`-et látja; a `report` mellékcsatornán megy a trace-be.
3. **Grounding (FR-16, FR-17, AD-1):** a válasz KIZÁRÓLAG a tool által visszaadott chunkokból; a system prompt `<grounding>` blokkja kötelezi; minden érdemi állítás forrást jelöl (játék + szakasz + URL).
4. **Negatív teszt (FR-18):** üres találatnál a tool explicit „nincs találat" `content`-et ad, és az agent kimondja, hogy nincs információja — kitalált szabály/forrás nélkül.
5. **Magyar válasz (FR-19):** a válasz magyar nyelvű, függetlenül a korpusz nyelvétől (kereszt-nyelvű: angol korpusz → magyar válasz).
6. **Tool-use loop (AD-8, AD-7):** közös agent-loop a Vercel AI SDK-ra (`generateText` + `tools` + `stopWhen: stepCountIs(n)`); a válasz-modell a `config.answerProvider`/`config.answerModel` (élesben Anthropic, lokálisan Ollama). Usage naplózva (AD-11).
7. **Tesztelhetőség (NFR-3):** az `executeSearchRules` (a tool logikája) injektált `retrieve`-vel unit-tesztelt (ok/üres/hiba ágak, sosem dob); a system prompt tartalmazza a grounding-szabályokat (teszt). A loop maga vékony (élő/CLI integráció, Story 2.3).

## Tasks / Subtasks

- [ ] **T1: `src/agent/tool-outcome.ts` — közös típus (AD-8)** (AC: 2)
  - [ ] `TraceEntry` (Zod): a retrieval trace + források + a nyers hits összefoglalója.
  - [ ] `ToolOutcome` (Zod diszkriminált unió `status`-ra: `ok|empty|error`) + `content: string` + `report: TraceEntry`.
- [ ] **T2: `src/agent/search-rules-tool.ts` (+ `.spec.ts`) — TDD** (AC: 1, 2, 3, 4)
  - [ ] `executeSearchRules(query, deps, opts) → ToolOutcome` — hívja a `retrieve`-et; `content` = a chunkok forrással (játék · szakasz · URL); üres → `status: empty` + magyar „nincs találat"; hiba → `status: error` + magyar hibaszöveg; SOHA nem dob.
  - [ ] `createSearchRulesTool(deps, opts, onReport?)` — a Vercel AI SDK `tool()` wrapper: `inputSchema` (Zod `{ query }`), `execute` meghívja `executeSearchRules`-t, a `report`-ot az `onReport` mellékcsatornára küldi, és a modellnek CSAK a `content`-et adja vissza.
  - [ ] Tesztek: ok (content forrásokkal + report), üres (explicit magyar + status empty), hiba (retrieve dob → status error, nem dob), rossz input → magyar hiba.
- [ ] **T3: `src/agent/prompt.ts` — system prompt** (AC: 3, 4, 5)
  - [ ] XML-szerű tagek (`<role>`, `<task>`, `<grounding>`, `<rules>`, `<tools>`); MAGYAR válasz; grounding: csak a `searchRules` eredményéből, kötelező forrás, üres találatnál „nincs információm", kitalálás tilos.
  - [ ] Teszt: a prompt tartalmazza a kulcs-szabályokat (grounding, forrás, „nincs információm", magyar).
- [ ] **T4: `src/agent/agent.ts` (+ `.spec.ts`) — loop** (AC: 5, 6)
  - [ ] `createAgent(config)` / `askRules(question, deps) → { answer, sources, reports, usage }`: `generateText({ model: provider(answerModel), system, prompt, tools: { searchRules }, stopWhen: stepCountIs(MAX_STEPS) })`.
  - [ ] A `report`-okat (trace) gyűjti; a usage-t aggregálja (válasz + retrieval, AD-11).
  - [ ] Teszt: az `onReport`/gyűjtés és a usage-aggregálás egy injektált fake tool-lal (a `generateText` élő/CLI — nem unit).
- [ ] **T5: Zöld-kapu** (AC: 7) — `pnpm test` + `typecheck · lint · format:check` zöld.

## Dev Notes

### Kényszerek
- **AD-1 (grounding):** a válasz kizárólag a visszakapott chunkokból; forrás kötelező; üres → „nincs információm". [Source: ARCHITECTURE-SPINE.md#AD-1]
- **AD-8 (tool-szerződés):** egy tool = egy könyvtár; `execute*` sosem dob; `ToolOutcome` = `content` (modell-látható) + `report: TraceEntry` (trace) + `status`; új tool = egy sor a toolsetben. [Source: #AD-8]
- **AD-7 (routing):** a válasz az erős modellen (élesben Anthropic `answerModel`); lokálisan `answerProvider=openai` → Ollama. [Source: #AD-7, docs/routing.md]
- **AD-11 (usage):** a válasz- és a retrieval-hívások usage-e naplózva. [Source: #AD-11]
- **AD-9:** az agent a `rag`-ot KIZÁRÓLAG a `searchRules` toolon át éri el; nincs kör. [Source: #AD-9]

### Bemenet és interfészek (meglévő kód)
- **`src/rag/retrieve.ts` (2.1):** `retrieve(question, deps, {wideNet, keepTop}) → { context, sources, hits, trace, empty }`; `createRetriever(config)` → `{ deps, close }`. A tool ezt hívja.
- **`src/providers.ts`:** `createProviders(config)[config.answerProvider](config.answerModel)` a válasz-modell.
- **`src/config.ts`:** `answerModel`, `answerProvider`, `wideNet`, `keepTop`, `corpusLanguage`.
- **AI SDK:** `tool({ description, inputSchema, execute })`, `generateText({ model, system, prompt, tools, stopWhen })`, `stepCountIs(n)`. Az `execute` visszatérési értéke a modell-látható tool-eredmény → CSAK a `content` stringet adjuk vissza; a `report` az `onReport` closure-csatornán megy.

### 🚨 Gotcha-k
1. **A `report` NEM mehet a modellnek** (AD-8): az `execute` csak a `content`-et adja vissza; a teljes `ToolOutcome`/`report` az `onReport` mellékcsatornán a trace-be. Ne JSON-özd a reportot a tool-eredménybe.
2. **Az `execute` sosem dob:** minden hiba (retrieve, rossz input) → `ToolOutcome` `status: error`, magyar szöveg. A teszt injektáljon dobó `retrieve`-et és várja a `status: error`-t, ne a kivételt.
3. **Kis lokális modell (qwen2.5:3b):** a tool-hívás/instruction-following gyengébb lehet; a system promptban egyértelműen kérd, hogy ELŐSZÖR keressen a `searchRules`-szal, és csak a találatokból válaszoljon. (Éles minőség: erős Anthropic modell.)
4. **Kereszt-nyelv:** a korpusz angol, a válasz magyar — a promptban kösd ki a magyar választ, a forrás-URL-t viszont változatlanul add vissza.
5. **`verbatimModuleSyntax` / `noUncheckedIndexedAccess`:** `import type`; a hits/sources indexelést óvatosan.

### Project Structure Notes
- Új: `src/agent/tool-outcome.ts`, `src/agent/search-rules-tool.ts` (+spec), `src/agent/prompt.ts` (+spec), `src/agent/agent.ts` (+spec). Ez az első `src/agent/` modul.
- „Egy fogalom = egy könyvtár"; a tool egy fájl (leírás + Zod + factory); a loop külön.

### Testing Standards
- Vitest, TDD. Az `executeSearchRules` a fő tesztelt egység (ok/üres/hiba, sosem dob) injektált `retrieve`-vel; a prompt-teszt a grounding-szabályokat asszertálja. A `generateText`-alapú loopot NEM unit-teszteljük (élő/CLI, Story 2.3).

### References
- [Source: epics.md#Story-2.2] AC-k; [Source: prd.md#FR-15..19].
- [Source: ARCHITECTURE-SPINE.md#AD-1, #AD-7, #AD-8, #AD-9, #AD-11]; [Source: docs/tervezesi-mintak.md#4,#8] (grounding két szinten; agent = prompt+tool+loop); [Source: docs/routing.md].
- Bemenet: `src/rag/retrieve.ts`, `src/providers.ts`, `src/config.ts`.
- Előző story: [2-1-keresesi-pipeline.md] (retrieve + trace + fallbackek).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log
