# Továbbfejlesztési tervek

> Opcionális bővítések az alap-pipeline (ld. `terv.md`) fölé. Két ütemben: az **első terv**
> a legjobb hozam/ráfordítás arányú, a demót és a minőségbizonyítást erősítő elemek; a
> **második terv** a mélyebb, mérés-igényesebb bővítések. Egyik sem előfeltétele a
> működő alaprendszernek.

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

## Megvalósítási megjegyzés

Ezek a bővítések a `bmad-workflow.md` 12 story-ja UTÁN, opcionális story-ként vehetők fel
— mindegyik önállóan, a meglévő pipeline megbontása nélkül ráépíthető. Ajánlott sorrend:
előbb az első terv (kis lépések, nagy demó-/bizonyíték-érték), majd a második terv, ha
marad kapacitás.
