# Továbbfejlesztési tervek

> Opcionális bővítések az alap-pipeline (ld. `terv.md`) fölé. Három ütemben: az **első terv**
> a legjobb hozam/ráfordítás arányú, a demót és a minőségbizonyítást erősítő elemek; a
> **második terv** a mélyebb, mérés-igényesebb bővítések; a **harmadik terv** a *találati
> minőség* célzott javítása a golden-seten **mért** szűk keresztmetszetekre (kereszt-nyelv,
> HyDE-szórás, játékok közti zaj). Egyik sem előfeltétele a működő alaprendszernek.

---

## Első továbbfejlesztési terv

### 1. Metaadat-szűrés a `game` mezőre

**Mit:** ha a kérdés megnevez egy játékot (pl. "Catanban…"), a vektorkeresés ELŐTT
strukturáltan előszűrünk a `knowledge_documents.game` (illetve a chunk `document_id`-jén
keresztül) mezőre — hibrid strukturált + szemantikus keresés. A játékfelismerés egyszerűen
történhet: a `game` értékek (és aliasaik, pl. "Catan" / "A telepesek") illesztése a
kérdésre, vagy egy olcsó modell-hívás, ami kinyeri a játéknevet.

**Miért ér pontot:** látványosan csökkenti a játékok közti áthallást (a "húzz 2 lapot"
típusú anaforikus chunkok nem szivárognak át másik játékhoz), és megmutatja, hogy a
tiszta vektorkeresésen túl a metaadatot is kihasználjuk. A `game` mező már a sémában van
(`ARCHITEKTURA.md` §1), tehát olcsó ráépíteni.

**Ráfordítás:** kicsi. **Érintett:** `rag/store.ts` (opcionális `game` szűrő a SQL-ben),
`rag/retrieve.ts` (játékfelismerés → szűrő átadása).

**Bemutatás:** a golden setből egy játékspecifikus kérdésnél mutasd meg, hogy szűrés
nélkül bejön másik játék chunkja, szűréssel nem.

### 2. LLM-as-judge groundedness-ellenőrzés ★

**Mit:** egy külön (olcsó) modell automatikusan pontozza, hogy a megadott válasz tényleg
a visszakapott chunkokból következik-e (faithfulness / groundedness), 0-1 skálán, indoklással.
A golden set futtatóba beköthető: minden kérdésnél a válasz mellé egy groundedness-pont.

**Miért ér pontot:** a grounding **automatizált, mérhető bizonyítéka** a negatív teszt
mellett — nem csak azt mutatod meg, hogy egy kézzel kiválasztott esetben működik, hanem
minden golden-set kérdésre számot adsz. Ez az „a grounding működik" értékelési szempontot
erősíti.

**Ráfordítás:** közepes. **Érintett:** új `src/eval/judge.ts` (a `generateObject` +
Zod-séma mintájára), a `run-golden-set.ts` bővítése egy oszloppal.

**Bemutatás:** a `golden-set.md` eredmény-táblájában egy „groundedness" oszlop; a negatív
kérdéseknél a judge is erősítse meg, hogy a válasz nem talál ki forrást.

### 3. Abstention-küszöb adatból

**Mit:** a golden set futásaiból kalibrált távolság-/rerank-küszöb, ami alatt az agent
inkább **nem válaszol** ("erről nincs elég megbízható információm"). A küszöböt a pozitív
és a negatív kérdések pont-eloszlásából határozzuk meg (a kettő közötti "rés").

**Miért ér pontot:** a groundingot és a negatív tesztet **adatvezérelt döntéssé** teszi —
nem csak a prompt kéri, hogy mondja ki a hiányt, hanem egy mért küszöb is védi. Megmutatja,
hogy a debug-láthatóságot (távolság, rerank-pont) valódi döntésre használod.

**Ráfordítás:** kicsi-közepes. **Érintett:** `rag/retrieve.ts` (küszöb-ellenőrzés a
top találaton), `search-rules-tool.ts` (küszöb alatt üres-találat ág), a küszöb értéke
env-ből hangolható.

**Bemutatás:** a `golden-set.md`-ben a pozitív vs. negatív kérdések pont-eloszlása +
a választott küszöb indoklása; mutasd, hogy a küszöb a negatívokat kiszűri, a pozitívokat nem.

### 4. Multi-turn beszélgetés

**Mit:** utókérdések kezelése a beszélgetés-történet továbbvitelével ("és 3 játékosnál?",
"és ha elfogy a pakli?"). Az agent-loop `history`-t kap, a HyDE/keresés a feloldott
(kontextusba helyezett) kérdéssel fut — vagy egy olcsó "kérdés-újrafogalmazó" lépés
teszi önállóvá az utókérdést a keresés előtt.

**Miért ér pontot:** életszerű demó, és megmutatja, hogy az agent-loop állapotkezelése
átgondolt. Kevés extra kód, nagy demó-érték.

**Ráfordítás:** kicsi-közepes. **Érintett:** `agent/agent.ts` (history), `cli.ts`
(interaktív mód), opcionálisan egy `rag/contextualize.ts` (utókérdés → önálló kérdés).

**Bemutatás:** egy rövid, több körös párbeszéd a README-ben / demóban.

### 5. CI (GitHub Actions)

**Mit:** automatikus futtatás push/PR-re: `pnpm install` → `pnpm lint` → `pnpm typecheck`
→ `pnpm test` (a chunk unit tesztek) + egy kis **retrieval smoke-test** (egy tudott
kérdésre a tudott gold-dokumentum bejön-e a top-K-ba — API-kulcs nélküli, mockolt vagy
feltételes lépésként).

**Miért ér pontot:** mérnöki igényesség, gyors pont; a determinisztikus chunk-tesztek
minden változásnál zöldek maradnak, és látszik a fegyelmezett munkafolyamat.

**Ráfordítás:** kicsi. **Érintett:** `.github/workflows/ci.yml`. Megjegyzés: az
API-kulcsot igénylő lépéseket feltételesre tesszük (csak ha van secret), hogy a CI
kulcs nélkül is fusson.

**Bemutatás:** zöld CI-badge a README-ben.

---

## Második továbbfejlesztési terv

> Mélyebb, mérés-igényesebb bővítések. Ezek is erős értékelési érvek (★), de nagyobb
> ráfordításúak vagy több futtatást igényelnek.

### 1. Ablációs mérés kvantitatív metrikákkal ★

**Mit:** a golden setet négy konfigban futtatod — nyers / +HyDE / +rerank / +mindkettő —,
és minden esetre **Recall@5, MRR, nDCG** metrikát számolsz a megjelölt gold chunkokhoz képest.

**Miért ér pontot:** az „a golden set megmutatja, mit ad hozzá a HyDE és a rerank"
értékelési szempont **számszerű, megcáfolhatatlan** bizonyítéka — nem benyomás, hanem
metrika, komponensenkénti hozzájárulással.

**Ráfordítás:** közepes. **Érintett:** `run-golden-set.ts` (4 futás-mód + metrika-számítás),
a `golden-set.md` eredmény-táblája metrika-oszlopokkal.

### 2. Chunking A/B a metrikákon ★

**Mit:** ugyanazon a golden seten lefuttatod a naiv (bekezdés-alapú) és a saját
(szakasz + játéknév-fejléc) chunkeredet, és összeveted a fenti metrikákat.

**Miért ér pontot:** az „a chunking-döntéseid a tudásbázisból következnek" szempontot
**méréssel** támasztja alá — bizonyítod, hogy a stratégia-váltás konkrét retrieval-javulást hoz.

**Ráfordítás:** közepes (kell egy második, "baseline" chunker + két ingest-futás külön
táblába/sémába). **Érintett:** `ingest/chunk.ts` mellé egy `chunk-baseline.ts`, kapcsolható
ingest, `chunking-strategia.md` bővítése az eredménnyel.

### 3. Hibrid keresés (BM25 + vektor) ★

**Mit:** a pgvector mellé teljes-szöveges keresés (Postgres `tsvector`), és a két találati
lista fúziója **Reciprocal Rank Fusion**-nel. A kulcsszavas ág a pontos komponens-/kártya-/
mezőnevekre erős, a vektor a fogalmi kérdésekre — a fúzió mindkettőt viszi.

**Miért ér pontot:** megmutatja, hogy érted a tiszta vektorkeresés korlátait (pontos
tokenek, ritka szavak), és mérnökileg orvoslod. Társasjáték-domainen kézzelfogható a
haszna (pl. konkrét lapnevek, "fejlesztési kártya").

**Ráfordítás:** közepes-nagy. **Érintett:** `rag/store.ts` (tsvector oszlop + index,
FTS lekérdezés), új `rag/fuse.ts` (RRF), `retrieve.ts` (a két ág összefésülése a rerank előtt).
A hatását a fenti ablációs metrikákkal mérheted (hibrid vs. csak vektor).

---

## Harmadik továbbfejlesztési terv — a találati minőség maximalizálása

> A golden-set futásokból (ld. `golden-set.md` §5) a **mért** szűk keresztmetszet nem a
> chunkolás, hanem: **(a) kereszt-nyelvűség** (magyar kérdés → angol korpusz), **(b) a HyDE
> minősége/szórása** a helyi kis modellen (ezért ingadozik a pozitív találat futásonként
> 4/8–6/8 között), és **(c) a játékok közti zaj** a top-K-ban. Az itteni utak pont ezekre
> mennek, és a reprodukálható golden-seten **számszerűen A/B-tesztelhetők**.
>
> Már részben tervezett, ide tartozó tételek (ne duplikáld): **játéknév-előszűrés** = *Első
> terv 1.*, **hibrid BM25 + vektor (RRF)** = *Második terv 3.*, **adatvezérelt absztenció-küszöb**
> = *Első terv 3.* Az alábbiak ezeket egészítik ki.
>
> **Ajánlott sorrend (ár/érték):** A2 (HyDE+nyers RRF) → *Első terv 1.* (játéknév-szűrés) →
> B1 (cross-encoder reranker) → A1 (kereszt-nyelvi embedding). A hatás **kombinálva** viszi a
> 6/8-at a 8/8 közelébe; külön-külön néhány pont a nyereség.

### A. A kérdés-oldal (itt a legnagyobb tartalék)

#### A1. Kereszt-nyelvi (multilingv.) embedding modell ★

**Mit:** a `nomic-embed-text` (angol-centrikus) helyett valódi többnyelvű embedding
(`bge-m3`, `multilingual-e5-large`, vagy nomic multilingual). Így a magyar kérdés vektora
**közvetlenül** matchel az angol chunkra — a kereszt-nyelvi rés gyökér-kezelése, akár HyDE nélkül is.

**Miért ér pontot:** a mért fő korlátot (kereszt-nyelvűség) a forrásánál oldja; megmutatja,
hogy az embedding-modell megválasztása tudatos, a feladathoz illesztett döntés.

**Ráfordítás:** közepes (dimenzió-váltás → `SCHEMA_VECTOR_DIM` + **teljes újra-ingest**).
**Érintett:** `.env` (`EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`), `db/schema.sql` (vector-dim),
`config.ts` (már paraméterezett). **Bemutatás:** golden-set A/B — HyDE-vel és HyDE nélkül,
a régi vs. új embeddinggel (Recall@5 / MRR).

#### A2. HyDE + nyers kérdés fúziója (RRF) ★

**Mit:** ne csak a HyDE-szöveg, hanem a **nyers (lefordított) kérdés** vektorával is keress,
majd a két találati listát **Reciprocal Rank Fusion**-nel egyesítsd a rerank előtt.

**Miért ér pontot:** a mostani bukások fele **rossz HyDE** (catan „Seven of Steel", pandemic
magyar zagyvaság). Ha a nyers kérdés is szavaz, egy elromlott HyDE nem viszi el a keresést —
csökken a futásonkénti szórás. Kis kód, széles hatás.

**Ráfordítás:** alacsony. **Érintett:** `rag/retrieve.ts` (két embed + fúzió), új `rag/fuse.ts`
(RRF — közös a Második terv 3. hibrid ágával). **Bemutatás:** golden-seten a HyDE-only vs.
HyDE+nyers RRF találati arány, kiemelve a „rossz HyDE" eseteket.

#### A3. Explicit kérdés-fordítás (HU→EN) a HyDE előtt

**Mit:** egy olcsó modell-lépés a magyar kérdést angolra fordítja; a keresés a fordított
kérdésen (és/vagy azon készült HyDE-n) fut.

**Miért ér pontot:** megbízhatóbb, mint remélni, hogy a HyDE jó angolt ír; determinisztikusabb
belépő a kereszt-nyelvi keresésbe. Jól kombinálható az A2 fúzióval.

**Ráfordítás:** alacsony. **Érintett:** új `rag/translate-query.ts`, `retrieve.ts` (a HyDE/embed
bemenete). **Bemutatás:** a `debug:search --full` a fordított kérdést is írja ki a trace-be.

#### A4. Multi-query (több HyDE-variáns) + RRF

**Mit:** 2-3 HyDE-variánst generálsz (eltérő seed/hőmérséklet), mindegyikkel keresel, és
RRF-fel fésülöd össze.

**Miért ér pontot:** kioltja a **HyDE futásonkénti szórását** (ez okozta a 4/8–6/8 ingadozást);
a „bölcs tömeg" stabilabb, mint egyetlen minta. **Ráfordítás:** közepes (több LLM-hívás).
**Érintett:** `rag/hyde.ts` (n variáns), `retrieve.ts` + `rag/fuse.ts`. **Bemutatás:**
golden-set szórás-mérés: 1 vs. 3 HyDE-variáns találati arányának ingadozása több futáson.

### B. A rerank-oldal

#### B1. Dedikált cross-encoder reranker ★

**Mit:** az LLM-as-reranker helyett purpose-built cross-encoder (`bge-reranker-v2-m3`),
ami a (kérdés, chunk) párt együtt pontozza — pontosabb, olcsóbb, és **többnyelvű** (HU↔EN).

**Miért ér pontot:** a rerank a pipeline „átrendező" lépése; egy erre épített, kereszt-nyelvi
modell közvetlenül a mostani gyenge kis-LLM-rerankot váltja ki. **Ráfordítás:** közepes
(reranker-szolgáltatás/modell integrálása). **Érintett:** `rag/rerank.ts` (új provider-ág),
`config.ts` (`RERANK_PROVIDER`). **Bemutatás:** ablációs metrika — LLM-rerank vs. cross-encoder
nDCG/MRR ugyanazon a wide-net listán.

#### B2. Tágabb háló a rerank előtt

**Mit:** a `WIDE_NET` (jelenleg 20) növelése 40-50-re, hogy a reranker esélyt kapjon egy
mélyen rangsorolt gold chunkot felhozni.

**Miért ér pontot:** ha a dense keresés a goldot a 21-40. helyre teszi, a mostani top-20 el sem
jut a rerankig. Jó rerankerrel (B1) majdnem ingyen nyereség. **Ráfordítás:** nagyon alacsony
(paraméter). **Érintett:** `.env` (`WIDE_NET`). **Bemutatás:** Recall@wideNet a golden-seten
20 vs. 40 mellett.

### C. A chunk-oldal (finomítás, nem fő tartalék)

#### C1. Ingest-zajszűrés (Wikipédia-trivia)

**Mit:** a `jatekmenet`/`attekintes` szakaszokból ingestkor kiszűröd a nem-szabály trivia
bekezdéseket (történet/recepció/kiadástörténet — pl. „*Teuber's original design…*", „*A 2015
study found…*", „*In 2020 the … blog … balance score*").

**Miért ér pontot:** ezek a bekezdések önálló junk-chunkokat adnak, amik idegen kérdésekre is
bekerülnek a top-5-be (a mostani futásban Terraforming Mars / Dominion / Carcassonne uralta a
Catan/Pandemic/KoT listát). Determinisztikus, unit-tesztelhető heurisztika. **Ráfordítás:**
alacsony. **Érintett:** `ingest/parse-document.ts` vagy egy `ingest/clean.ts` + tesztek.
**Bemutatás:** chunk-szám és a fals pozitívok csökkenése a golden-seten, előtte/utána.

#### C2. Kisebb célméret + mondat-szintű csomagolás (paraméter-hangolás)

**Mit:** a `ChunkOptions.targetChars` ~1000-ről ~500-ra hangolása a rule-dense szakaszokra,
hogy egy bekezdésbe ömlesztett több szabály (pl. catan-7: rabló + felezés) külön chunkba
kerüljön.

**Miért ér pontot:** precízebb szabály-izoláció; a `chunk.ts` már paraméterezett, tehát csak
hangolás + mérés (nem átírás). **Ráfordítás:** alacsony. **Érintett:** `config.ts`/`ingest.ts`
(paraméter), `chunk.spec.ts` (határeset-tesztek). **Bemutatás:** golden-set A/B a
`chunking-strategia.md` §5 paraméter-táblájához kötve.

#### C3. Parent-child (small-to-big) retrieval

**Mit:** **kis** chunkot embedelsz (precíz találat), de a válasz-modellnek a **teljes szülő
szakaszt** adod vissza (a chunk `document_id` + `heading` alapján).

**Miért ér pontot:** egyszerre precíz keresés és teljes kontextus a válaszhoz — a
grounding-minőséget javítja anélkül, hogy a keresés pontosságát rontaná. **Ráfordítás:**
közepes. **Érintett:** `rag/store.ts` (szülő-szakasz lekérés), `search-rules-tool.ts`
(a modellnek a szülő megy). **Bemutatás:** egy kérdésnél a kis-chunk találat vs. a
visszaadott teljes szakasz a trace-ben.

---

## Megvalósítási megjegyzés

Ezek a bővítések a `bmad-workflow.md` 12 story-ja UTÁN, opcionális story-ként vehetők fel
— mindegyik önállóan, a meglévő pipeline megbontása nélkül ráépíthető. Ajánlott sorrend:
előbb az **első terv** (kis lépések, nagy demó-/bizonyíték-érték), majd a **második terv**
(mérés-igényes bizonyítékok), ha marad kapacitás. A **harmadik terv** akkor jön, ha konkrétan
a *találati pontosságot* akarod feljebb vinni: minden tétele a golden-seten A/B-tesztelhető,
így **méréssel** dönthető el, melyik út éri meg — ne találgatás, hanem szám alapján priorizálj.
