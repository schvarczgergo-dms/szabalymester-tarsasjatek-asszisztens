---
baseline_commit: 3c65746
---

# Story 2.1: Keresési pipeline (HyDE → rerank → kontextus)

Status: ready-for-dev

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

- [ ] **T1: Függőség + provider-wiring** (AC: 5) — UPDATE `package.json`
  - [ ] `@ai-sdk/anthropic` felvétele (a rerankhez; a spine Stack szerinti verzió). Az `@ai-sdk/openai` már megvan (HyDE + embedding).
- [ ] **T2: `src/rag/hyde.ts` (+ `hyde.spec.ts`) — TDD** (AC: 1, 5, 6, 7)
  - [ ] `generateHyde(question, deps) → { text, usage, usedFallback }`; `deps.generate` injektálható (default: `generateText` az `openai(config.hydeModel)`-lel), magyar system/prompt.
  - [ ] Hiba/üres kimenet → `text = question`, `usedFallback = true`, SOHA nem dob.
  - [ ] Tesztek: normál út (a generált szöveg megy tovább); hiba → az eredeti kérdés a fallback; usage visszaadva.
- [ ] **T3: `src/rag/rerank.ts` (+ `rerank.spec.ts`) — TDD** (AC: 3, 5, 6, 7)
  - [ ] `rerankChunks(question, candidates, deps) → { ranked: {index, score}[], usage, usedFallback }`; `deps.generateObject` injektálható (default: `generateObject` az `anthropic(config.rerankModel)`-lel), **Zod-séma** a pontokra.
  - [ ] Zod-validáció az LLM-kimeneten; hiba/érvénytelen → fallback: a bemeneti (vektor-)sorrend, `score: -1`, `usedFallback = true`. SOHA nem dob.
  - [ ] Tesztek: átrendezés a pontok szerint; érvénytelen/hibás kimenet → vektorsorrend-fallback; a `keepTop` levágás.
- [ ] **T4: `src/rag/retrieve.ts` (+ `retrieve.spec.ts`) — TDD** (AC: 1–4, 6, 7)
  - [ ] `retrieve(question, deps, opts?) → { context, sources, hits, trace, empty }`; `deps` = injektált `hyde`, `embed`, `search`, `rerank` (a valós wiring a defaultokból).
  - [ ] Folyamat: HyDE → `embed` (a HyDE-szöveg, `embedTexts`) → `search(vektor, wideNet)` → `rerank(question, hits)` → top-`keepTop` → kontextus-összeállítás (a chunk-`content` + forrás) + trace.
  - [ ] Üres tág háló → `empty = true`, explicit „nincs találat" jelzés, a rerank kihagyva; SOHA nem dob (az egyes lépések hibái fallbackre esnek).
  - [ ] Tesztek: teljes út (rendezett top-K + trace kitöltve); HyDE-hiba-ág; rerank-hiba-ág; üres-találat-ág; a `retrieve` sosem dob (injektált dobó seam → fallback).
- [ ] **T5: Zöld-kapu** (AC: 7) — `pnpm test` (a meglévők + újak) + `typecheck · lint · format:check` zöld.

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

### Debug Log References

### Completion Notes List

### File List

### Change Log
