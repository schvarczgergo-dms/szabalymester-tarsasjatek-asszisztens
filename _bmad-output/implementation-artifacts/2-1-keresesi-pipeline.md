---
baseline_commit: 4fa6cf7
---

# Story 2.1: Keresési pipeline (HyDE → rerank → kontextus)

Status: review

## Story

As a fejlesztő,
I want a kétlépcsős retrieval-pipeline-t HyDE-vel és rerankkel, fallbackekkel és trace-szel,
so that a laikus kérdésre is a releváns szabály-chunkok kerülnek elő megbízhatóan.

## Acceptance Criteria

1. **HyDE (FR-10):** egy olcsó OpenAI-modell (`config.hydeModel`) rövid, **magyar**, szabálykönyv-szerű hipotetikus választ ír a kérdésre; ezt a szöveget ugyanaz az embedding-modell vektorizálja, mint a korpuszt (FR-11, AD-3). HyDE-hiba → fallback: az **eredeti kérdéssel** keresünk tovább (a pipeline nem áll meg).
2. **Tág háló (FR-12):** a HyDE-vektorral koszinusz-keresés a `store.search`-csel `config.wideNet` (=20) találatra, CSAK `active` dokumentumokon; üres eredmény → explicit „nincs találat" jelzés (nem hiba).
3. **Rerank (FR-13):** egy kis Anthropic-modell (`config.rerankModel`) a kérdés fényében 0–10 pontot ad a jelölteknek, **strukturált, Zod-validált** kimenettel (`generateObject`); a top-`config.keepTop` (=5) marad. Rerank-hiba VAGY érvénytelen kimenet → fallback: a **vektorsorrend** top-K megy tovább (a trace-ben `score: -1`).
4. **Sosem dob (FR-14, NFR-2, AD-2):** a `retrieve` a felhasználó felé SOHA nem dob kivételt; minden lépésnek fallbackje van; a végén mindig értelmes eredmény (kontextus + források, vagy explicit „nincs találat").
5. **Külön providerek (NFR-6, AD-7):** a HyDE OpenAI-n, a rerank Anthropic-on fut — egymástól függetlenül degradálódnak; a modellnevek env-ből (`config`).
6. **Trace (NFR-4):** minden lépés strukturált trace-t ír: a HyDE-szöveg (és hogy fallback volt-e), a tág háló távolságai, a rerank-pontok (és hogy fallback volt-e), a végső kontextus mérete. A trace program által olvasható (nem `console.log`).
7. **Determinizmus/tesztelhetőség (NFR-3):** a HyDE, a rerank és a `retrieve` **injektált seamekkel** (modell-hívások, `store.search`, `embed`) unit-tesztelt — valós OpenAI/Anthropic-kulcs és élő DB nélkül; a fallback-ágak külön tesztet kapnak.

## Tasks / Subtasks

- [x] **T1: Függőség + provider-wiring** (AC: 5) — `@ai-sdk/anthropic@4.0.16` felvéve (rerank); az `@ai-sdk/openai` már megvolt (HyDE + embedding).
- [x] **T2: `src/rag/hyde.ts` (+ `hyde.spec.ts`) — TDD** (AC: 1, 5, 6, 7)
  - [x] `generateHyde(question, {generate}) → { text, usage, usedFallback }`; `deps.generate` injektálható (default `createOpenAIHydeGenerate` = `generateText` + `openai(config.hydeModel)`, magyar system).
  - [x] Hiba/üres/whitespace kimenet → `text = question`, `usedFallback = true`, SOHA nem dob.
  - [x] 3 teszt: normál út; hiba-fallback; üres-kimenet-fallback.
- [x] **T3: `src/rag/rerank.ts` (+ `rerank.spec.ts`) — TDD** (AC: 3, 5, 6, 7)
  - [x] `rerankChunks(question, candidates, {generate}, {keepTop}) → { ranked, usage, usedFallback }`; default `createAnthropicRerankGenerate` = `generateObject` + `anthropic(config.rerankModel)`, `rerankSchema` (Zod).
  - [x] Zod-validáció az LLM-kimeneten; hiba/érvénytelen → vektorsorrend-fallback (`score: -1`). SOHA nem dob.
  - [x] 4 teszt: átrendezés; keepTop; érvénytelen-kimenet-fallback; hiba-fallback.
- [x] **T4: `src/rag/retrieve.ts` (+ `retrieve.spec.ts`) — TDD** (AC: 1–4, 6, 7)
  - [x] `retrieve(question, deps, {wideNet, keepTop}) → { context, sources, hits, trace, empty }`; injektált `hyde`/`embed`/`search`/`rerank`; `createRetrieveDeps`/`createRetriever` a valós wiring.
  - [x] Folyamat: HyDE → `embed([hydeText])` → `search(vektor, wideNet)` → `rerank` → top-`keepTop` → kontextus + `RetrievedSource[]` + `RetrievalTrace`.
  - [x] Üres/embed-hiba/search-hiba → `empty=true` (rerank kihagyva); a `retrieve` SOHA nem dob.
  - [x] 6 teszt: teljes út; keepTop; üres-találat; HyDE-fallback trace; search-hiba; embed-hiba.
- [x] **T5: Zöld-kapu** (AC: 7) — `pnpm test` 115 pass + 1 skip; `typecheck · lint · format:check` zöld.

## Dev Notes

### Kényszerek

- **AD-2 (retrieval sosem dob):** minden lépés degradálódik (HyDE→eredeti kérdés; rerank→vektorsorrend; üres→explicit jelzés); a `retrieve` a hívó felé sosem dob. [Source: ARCHITECTURE-SPINE.md#AD-2]
- **AD-3 (egy embedding-tér):** a HyDE-szöveget UGYANAZ az embedding-modell vektorizálja, mint a korpuszt (a Story 1.5 `embedTexts`/`createOpenAIEmbedBatch`). [Source: #AD-3]
- **AD-7 (routing):** HyDE olcsó (OpenAI nano), rerank kis modell (Anthropic Haiku), **külön providernél**; a válasz-modell NEM itt (az a Story 2.2). A modellnevek env-ből. [Source: #AD-7, docs/routing.md]
- **AD-9 (függőségi irány):** a `retrieve` a `rag/`-on belül a `hyde`/`rerank`/`embed`/`store`-ra épül; az agent (Story 2.2) csak a `searchRules` toolon át látja. Nincs kör. [Source: #AD-9]
- **Zod a rendszer-határon:** a rerank `generateObject`-kimenete Zod-validált (AD-8 „LLM-output a határon"). [Source: #Consistency-Conventions]

### Bemenet és interfészek (a meglévő kódból)

- **`src/rag/embed.ts` (1.5):** `embedTexts(texts, { embedBatch, dimensions })` → `{ vectors, usage }`; `createOpenAIEmbedBatch(config)`. A HyDE-szöveg egyetlen elemű batch.
- **`src/rag/store.ts` (1.5):** `createStore(db,{dimensions}).search(embedding, topK) → SearchHit[]` (`content, heading, chunkIndex, source, game, section, distance`). A wideNet a `topK`.
- **`src/config.ts`:** `hydeModel`, `rerankModel`, `embeddingModel`, `embeddingDimensions`, `wideNet` (20), `keepTop` (5).
- **AI SDK:** `generateText({ model, prompt|system+messages }) → { text, usage }`; `generateObject({ model, schema, prompt }) → { object, usage }`. Provider factoryk: `openai(id)`, `anthropic(id)`. A `usage` szerkezete providerenként; a naplózáshoz a token-mezőt vedd ki (AD-11 előkészítés).

### 🚨 Gotcha-k

1. **Új provider-csomag:** `@ai-sdk/anthropic` kell a rerankhez (a `@ai-sdk/openai` már megvan). Nincs valós kulcs → a hálózati rész vékony factory, a logika injektált fake-kel unit-tesztelt (mint 1.5/1.6).
2. **A rerank kimenetét NE bízd el:** Zod-validáld (index-tartomány, pont 0–10); érvénytelen → vektorsorrend-fallback, ne dobás. Az LLM adhat hiányos/rossz JSON-t.
3. **HyDE nyelve magyar** — ha angolul generálna, a HyDE-vektor eltávolodna a magyar chunkoktól (nyelvi rés, routing.md). A promptban kösd ki a magyart.
4. **A `retrieve` sosem dob:** minden `await` köré fallback; a teszt injektáljon dobó seamet és várja a fallback-ágat, ne a kivételt.
5. **Trace ≠ console.log:** strukturált objektum (a Story 3.1 debug-parancsai és a golden-set erre épül). A `report`/`TraceEntry` közös típus a Story 2.2/AD-8 hatóköre — itt egy `RetrievalTrace` elég, de tartsd szerializálhatónak.
6. **Scope:** nincs válasz-modell/agent/tool (Story 2.2), nincs CLI (Story 2.3), nincs golden-set futtató (Story 3.2). Itt CSAK a `retrieve` és részei.

### Project Structure Notes

- Új: `src/rag/hyde.ts` (+spec), `src/rag/rerank.ts` (+spec), `src/rag/retrieve.ts` (+spec). Módosul: `package.json` (`@ai-sdk/anthropic`).
- „Egy fogalom = egy könyvtár"; a retrieval-lépések a `src/rag/`-ban, injektálható defaultokkal (a Story 1.5 mintája).

### Testing Standards

- Vitest, TDD, spec a kód mellett. Injektált seamek (modell-hívások, `search`, `embed`); a fallback-ágak (HyDE-hiba, rerank-hiba/érvénytelen, üres-találat) külön teszt. Ne írj tesztet, ami valós OpenAI/Anthropic-ot vagy élő DB-t igényel a zöld-kapuhoz.

### References

- [Source: epics.md#Story-2.1] AC-k; [Source: prd.md#FR-10..14].
- [Source: ARCHITECTURE-SPINE.md#AD-2, #AD-3, #AD-7, #AD-9]; [Source: docs/routing.md] (modell-szereposztás, degradációs lánc); [Source: docs/tervezesi-mintak.md#1-3,#5-6].
- Bemenet: `src/rag/embed.ts`, `src/rag/store.ts`, `src/config.ts`.
- Előző story tanulságai: [1-5-embedding-es-tarolas.md#Dev-Notes] (injektálható seamek, usage, Zod-határ), [1-6-inkrementalis-ingest.md#Dev-Notes] (fallback/hiba-izoláció mintája).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`) — Cursorból.

### Debug Log References

- RED→GREEN: `hyde.spec` 3/3, `rerank.spec` 4/4, `retrieve.spec` 6/6.
- Teljes kapu: `pnpm test` 115 pass + 1 skip (10 test file), `typecheck` · `lint` · `format:check` zöld.

### Completion Notes List

- `src/rag/hyde.ts`: `generateHyde` magyar HyDE, hiba/üres → eredeti kérdés fallback; `createOpenAIHydeGenerate` (OpenAI `hydeModel`).
- `src/rag/rerank.ts`: `rerankChunks` Zod-validált (`rerankSchema`) pontozás, hiba/érvénytelen → vektorsorrend-fallback (`score:-1`), `keepTop` levágás; `createAnthropicRerankGenerate` (Anthropic `rerankModel`) — külön provider (AD-7).
- `src/rag/retrieve.ts`: `retrieve` orchestráció HyDE → embed → tág háló (`wideNet`) → rerank (`keepTop`) → kontextus + `RetrievedSource[]` + `RetrievalTrace`; minden lépés fallbackre esik, a `retrieve` SOHA nem dob (AD-2). `createRetrieveDeps`/`createRetriever` a valós wiring (HyDE OpenAI, rerank Anthropic, embed OpenAI — AD-3/AD-7).
- Minden logika injektált seamekkel unit-tesztelt; nincs valós API/DB a zöld-kapuban.
- Scope: nincs válasz-modell/agent/`searchRules` tool (Story 2.2), nincs CLI (2.3), nincs golden-set (3.2).

### File List

- `src/rag/hyde.ts`, `src/rag/hyde.spec.ts` (új)
- `src/rag/rerank.ts`, `src/rag/rerank.spec.ts` (új)
- `src/rag/retrieve.ts`, `src/rag/retrieve.spec.ts` (új)
- `package.json`, `pnpm-lock.yaml` (módosítva — `@ai-sdk/anthropic`)

### Change Log

- 2026-07-18: Story 2.1 implementálva — `rag/hyde` + `rag/rerank` + `rag/retrieve` (kétlépcsős pipeline, fallbackek, RetrievalTrace), TDD 13 új teszt (102→115). Status → review.
