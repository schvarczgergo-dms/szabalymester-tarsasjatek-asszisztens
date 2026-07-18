---
title: Szabálymester
status: final
created: 2026-07-18
updated: 2026-07-18
---

# PRD: Szabálymester

_Természetes nyelvű társasjáték-szabály asszisztens hivatalos szabálykönyvekből,
magyarul, forrásmegjelöléssel._

## 0. Document Purpose

Ez a PRD a **Szabálymester** termék követelményeit rögzíti a fejlesztést vezető
downstream munkafolyamatok (architektúra, epikek és story-k, implementáció) számára.
A dokumentum a Glosszáriumra épülő, egységes szókincset használ; a képességeket
feature-ökbe csoportosítja, a funkcionális követelményeket (FR) globálisan, stabilan
számozva ezek alá ágyazza; a következtetett pontokat `[ASSUMPTION]` címkével jelöli és a
9. szakaszban indexeli. A termék tervezési döntéseinek részletes indoklása (chunking,
routing, tudásbázis-karbantartás), a mechanizmus-döntések és a méret-adatok az
`addendum.md`-ben élnek; a PRD ezekre hivatkozik, nem duplikálja őket.

## 1. Vision

A társasjátékosok menet közben, gyakran vitás helyzetben keresnek választ egy
szabálykérdésre — „elfogyott a húzópakli, mi történik?", „mi van, ha 7-est dobok?". A
szabálykönyv ilyenkor lassú, a fejből válaszoló nyelvi modell pedig megbízhatatlan: a
specifikus szabályokat gyakran összekeveri a kiadások között, pontszámokat talál ki.

A Szabálymester egy **grounded** kérdés-válasz asszisztens: természetes nyelvű
magyar kérdésre a **hivatalos szabálykönyvekből** válaszol, mindig megjelölve a forrást
(melyik játék, melyik szakasz). Ha a tudásbázisban nincs válasz, azt **kimondja** — nem
talál ki szabályt. A megbízhatóság a termék lényege: a felhasználó akkor fogadja el
döntőbírónak, ha minden állítás visszavezethető egy konkrét szabálykönyv-szakaszra.

A megoldás egy teljes RAG-pipeline: saját, a szabálykönyvek tagoltságából levezetett
chunking-stratégia, kétlépcsős keresés (HyDE + átrangsorolás), forrásalapú grounding és
költséghatékony multi-provider routing (olcsó modell keres, erős modell válaszol).

## 2. Target User

### 2.1 Jobs To Be Done

- **Vitás szabályhelyzet gyors, hiteles eldöntése** játék közben, a szabálykönyv
  lapozgatása nélkül.
- **Bizonyosság, hogy a válasz a hivatalos szabályból jön** — forrásmegjelöléssel,
  ellenőrizhetően, nem egy nyelvi modell „emlékezetéből".
- **Egyértelmű nemleges válasz**, ha egy játék vagy adat nincs a tudásbázisban —
  a felhasználó ne kapjon magabiztosan hangzó, de kitalált szabályt.

### 2.2 Non-Users (v1)

- Nem magyar nyelven kérdező felhasználók (a korpusz és a válaszok magyarok).
- Olyan játékok szabályaira kérdezők, amelyek nincsenek a kurált korpuszban.
- Szabály-**vitarendezés** emberi döntőbíró helyett verseny-környezetben (a termék
  segédeszköz, nem hivatalos versenyszabály-értelmező). `[ASSUMPTION]`

### 2.3 Key User Journeys

- **UJ-1. Anna eldönti a rablót a játék hevében.**
  - **Persona + kontextus:** Anna baráti Catan-partit vezet, két játékos vitázik a 7-es
    dobás következményén.
  - **Belépő állapot:** a terminálban futó asszisztensnél, a korpuszban van Catan.
  - **Út:** beírja: „Catanban mi történik, ha 7-est dobok?" → az asszisztens keres a
    szabály-tudásbázisban → visszaad egy tömör magyar választ.
  - **Csúcspont:** a válasz kimondja a rabló mozgatását és a 7 fölötti lapok eldobását,
    és megjelöli: _Catan · Játékmenet_ + a forrás-URL.
  - **Feloldás:** a vita eldőlt egy hivatkozható szabályra; a játék folytatódik.

- **UJ-2. Bence lefülel egy hiányt.**
  - **Persona + kontextus:** Bence egy olyan játékról kérdez, ami nincs a korpuszban
    („Hogyan kell játszani a Gloomhavennel?").
  - **Út:** beírja a kérdést → a keresés nem hoz releváns szabályt.
  - **Csúcspont:** az asszisztens **kimondja**, hogy erről a játékról nincs információja,
    és nem talál ki szabályt.
  - **Feloldás:** Bence tudja, hogy a tudásbázist bővíteni kell — nem kap félrevezető
    választ.

- **UJ-3. Csenge élhelyzeti szabályt talál meg.**
  - **Persona + kontextus:** Csenge egy ritka élhelyzetre kérdez („Azulban mi van, ha egy
    mintasorba nem fér több csempe?").
  - **Út:** a laikus megfogalmazás távol esik a szabálykönyv nyelvétől; a HyDE-lépés
    hipotetikus szabály-választ ír, a tág vektorkeresés behozza az általános szakaszt, az
    átrangsorolás előreemeli a konkrét (padló-sor / büntetés) szabályt.
  - **Csúcspont:** a válasz a pontos élhelyzeti szabályt adja, _Azul · Játékmenet_
    forrással.
  - **Feloldás:** a nehezen kereshető szabály is előkerült — a pipeline értéke itt látszik.

## 3. Glossary

- **Korpusz** — a tudásbázist alkotó hivatalos, magyar szabálykönyvek markdownná
  konvertált, front matterrel ellátott dokumentumainak összessége.
- **Dokumentum** — a korpusz egy tagolt egysége (egy játék egy szakasza), első osztályú
  entitás a nyilvántartásban (`source`, `game`, `section`, `content_hash`, `status`).
- **Szakasz (section)** — a szabálykönyv kanonikus tagolása: `attekintes`, `elokeszules`,
  `jatekmenet`, `pontozas`, `gyik`.
- **Chunk** — a keresés atomi egysége: egy szakaszból méretkeretre darabolt szövegrész,
  a Játéknév-fejléccel együtt vektorizálva.
- **Játéknév-fejléc** — a chunk szövege elé embeddelés előtt beszúrt breadcrumb
  (`Játék > Szakasz > alcím`), amely a játék nevét minden chunk vektorába beviszi.
- **Ingest** — az offline folyamat: korpusz → parse → tisztítás → chunkolás → embedding →
  tárolás pgvectorban.
- **Embedding** — szöveg vektorreprezentációja; a kérdést és a dokumentumokat
  kötelezően ugyanaz a modell vektorizálja.
- **HyDE** — hipotetikus dokumentum-embedding: egy olcsó modell rövid, magyar,
  szabálykönyv-szerű hipotetikus választ ír, és ennek a vektorával keresünk.
- **Tág háló** — a vektorkeresés első, elnéző lépése, sok jelöltet (top-20) hozó.
- **Átrangsorolás (rerank)** — kis modell a kérdés fényében pontozza a jelölteket
  (0–10), és a legjobb néhány (top-5) marad a válasz-modellnek.
- **Grounding** — az az elv és mechanizmus, hogy a válasz kizárólag a visszakapott
  chunkokból származik, kötelező forrásmegjelöléssel, üres találatnál explicit nemleges
  válasszal.
- **Forrásmegjelölés** — a válaszhoz kötött hivatkozás: játék + szakasz (+ forrás-URL).
- **Negatív teszt** — olyan kérdés, amelyre a korpuszban nincs válasz; a grounding próbája.
- **Golden set** — kurált tesztkérdés-készlet (elvárt „gold" szakaszokkal) a pipeline
  minőségének mérésére.
- **Tool** — a válasz-modell felé kitett képesség; a RAG a modell felé egyetlen tool
  (`searchRules`).
- **Trace** — a retrieval lépéseinek strukturált naplója (HyDE-szöveg, távolságok,
  rerank-pontok, kontextusméret) a hibakereséshez.

## 4. Features

### 4.1 Tudásbázis és ingest

**Description:** A korpuszt tagolt, front matterrel ellátott magyar szabály-markdownok
alkotják. Az ingest offline folyamat: beolvassa és validálja a front mattert, kiszűri a
kiadói zajt (impresszum, jogi sor, illusztráció-aláírás), normalizálja a szöveget, majd
chunkolás után batch-ben embeddeli és pgvectorba írja. A tudásbázis nem statikus, ezért a
frissítés inkrementális: a normalizált törzs tartalom-hash-e dönti el, mi vektorizálódik
újra. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Korpusz-dokumentum beolvasása és validálása

A rendszer beolvassa a `seed/rules/*.md` dokumentumokat, és validálja a kötelező front
mattert (`title`, `game`, `source`, `section`).

**Consequences (testable):**
- Hiányzó vagy érvénytelen `section` (nem a kanonikus öt érték egyike) esetén a
  dokumentum elutasításra kerül, beszédes hibaüzenettel, a futás nem áll le némán.
- A `source` mező a dokumentum egyedi azonosítója; két dokumentum azonos `source`-szal
  ütközésként kezelendő.
- A front matter parse-olása determinisztikus és **unit-tesztelt** (a validálás és a
  normalizálás határeseteit tesztek fedik).

#### FR-2: Zaj-szűrés és normalizálás

Ingest előtt a rendszer eltávolítja a nem-tudás tartalmat (kiadói/jogi blokk,
illusztráció-aláírás) és normalizálja a szöveget (whitespace, sorvégek).

**Consequences (testable):**
- A `content_hash` a **normalizált, zaj-szűrt** törzsből képződik, így a whitespace vagy a
  kiadói sor változása nem triggerel újravektorizálást.

#### FR-3: Batch embedding és pgvector-tárolás

A chunkok embeddingje batch-elve történik, és `knowledge_chunks` táblába kerül a
`knowledge_documents` nyilvántartáshoz kötve.

**Consequences (testable):**
- A dokumentum és a chunkjai egy tranzakcióban íródnak; a kereső sosem lát fél-kész
  (részben beírt) dokumentumot.
- Egy dokumentum törlésekor a chunkjai automatikusan törlődnek (CASCADE); árva chunk nem
  maradhat.

#### FR-4: Hash-alapú inkrementális frissítés

A szinkron-futás minden forrás-dokumentumra összeveti a tartalom-hash-t a
nyilvántartással, és csak a változott/új dokumentumokat vektorizálja újra.

**Consequences (testable):**
- Változatlan korpuszon a szinkron **egyetlen embedding-API-hívást sem** tesz.
- Módosult dokumentumnál a régi chunkok törlése + új beírás + hash-frissítés egyetlen
  tranzakcióban történik.
- A forrásból eltűnt dokumentum `status = deleted` jelölést kap, chunkjai törlődnek.
- A `status = deleted` a dokumentum-soron **megmarad** (audit-nyom); ha a forrás átmeneti
  hiba után visszatér, a meglévő sor újraéleszthető, és a hash dönt az újravektorizálásról.
- A szinkron **ütemezetten (cron) és kézzel is** indítható; mindkét esetben ugyanaz a
  hash-alapú, változással arányos logika fut.

#### FR-5: Kényszerített teljes újraépítés

A `--rebuild` kapcsoló a teljes korpuszt újravektorizálja (chunking- vagy
embedding-modell-váltáskor).

**Consequences (testable):**
- `--rebuild` hatására minden dokumentum újra-chunkolódik és újra-embeddelődik, a
  hash-egyezéstől függetlenül.
- A pipeline verziója (chunker + embedding-modell) nyilvántartott; eltérése teljes
  újraépítést követel, hogy pipeline-váltás után ne maradjon néma, kevert vektortér (a
  tartalomváltozás inkrementális, a pipeline-változás teljes — a kettő nem keverhető).

### 4.2 Chunkolás

**Description:** A saját chunking-stratégia a szabálykönyvek tagoltságából következik:
szakasz-alapú (heading-aware) darabolás, a fő újítás pedig a **Játéknév-fejléc** — mivel a
szabály-szöveg erősen anaforikus („Húzz 2 lapot"), a chunk a játék neve nélkül nem
azonosítható. A fejléc a játék nevét minden chunk vektorába beviszi, így a keresés
játékok között is elkülönít. A chunkolás tisztán determinisztikus, ezért unit-tesztelt.
Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-6: Szakasz-alapú, heading-aware darabolás

A rendszer a `##`/`###` alcímek mentén szakaszokra bont, és chunk-határt csak
szakasz-határon vagy azon belül húz, méretkeretig (cél ~1000, felső korlát ~1500 karakter).

**Consequences (testable):**
- Rövid dokumentum egyetlen chunkban marad.
- Alcímnél új chunk kezdődik, és a szakaszcím a chunk fejlécében megjelenik.
- A felső korlátot (~1500 karakter) meghaladó, **nem-lista** bekezdés mondathatáron
  vágódik.

#### FR-7: Játéknév + szakasz kontextus-fejléc

Minden chunk szövege elé embeddelés előtt egy `Játék > Szakasz > alcím` breadcrumb kerül.

**Consequences (testable):**
- A `game` érték minden chunk elején jelen van a vektorizált szövegben.

#### FR-8: Lista-integritás, törpe-összevonás, szakaszon belüli átfedés

A lépéssorozat/komponens-listák egyben maradnak; a törpe-szakasz (< ~200 karakter) a
következővel összevonódik; szakaszon belüli vágásnál átfedés van, szakasz-határon nincs.

**Consequences (testable):**
- Egy számozott lépéslista nem vágódik ketté (a lista az egyetlen kivétel, ahol a chunk a
  felső korlát fölé nőhet).
- Szakaszon belüli vágásnál az utolsó bekezdés átmegy a következő chunkba; szakasz-határon
  nincs átfedés.
- A chunk-sorszámozás folytonos a dokumentumon belül.

#### FR-9: Determinisztikus, tesztelt chunkolás

A chunkolás `(markdown, opciók) → Chunk[]` tiszta függvény, unit-tesztekkel lefedve
(TDD: előbb a tesztek).

**Consequences (testable):**
- Ugyanaz a bemenet mindig ugyanazt a chunk-listát adja.
- A stratégia kulcsdöntéseit (szakaszhatár, fejléc, lista-integritás, törpe-összevonás,
  átfedés, hosszú bekezdés mondathatáron vágása, folytonos sorszám) legalább egy-egy
  unit teszt fedi.

### 4.3 Keresési pipeline (retrieval)

**Description:** A retrieval kétlépcsős, HyDE-vel bővítve: egy olcsó modell magyar
hipotetikus szabály-választ ír, ennek vektorával fut a tág (top-20) koszinusz-keresés,
majd egy kis modell átrangsorolja a jelölteket (top-5). Minden lépésnek olcsóbb
fallbackje van; a pipeline a felhasználó felé **sosem dob kivételt**. Realizes UJ-3.

**Functional Requirements:**

#### FR-10: HyDE — magyar hipotetikus válasz

A keresés előtt egy olcsó modell 2–3 mondatos, magyar, szabálykönyv-szerű hipotetikus
választ ír, és a rendszer ezt embeddeli.

**Consequences (testable):**
- A HyDE-szöveg magyar nyelvű; hiba esetén a rendszer az eredeti kérdéssel keres tovább
  (fallback).

#### FR-11: Egységes embedding-modell

A kérdést (illetve a HyDE-szöveget) és a dokumentumokat ugyanaz az embedding-modell
vektorizálja.

**Consequences (testable):**
- Embedding-modell váltása a teljes korpusz `--rebuild`-jét igényli (a vektortér változik).

#### FR-12: Tág háló — vektorkeresés

A rendszer koszinusz-távolság alapján a legközelebbi `WIDE_NET` (alap: 20) chunkot hozza
az `active` dokumentumokból.

**Consequences (testable):**
- Üres találat esetén a tool explicit „nincs találat" jelzést ad vissza (nem kivételt).

#### FR-13: Átrangsorolás (rerank)

Egy kis modell a kérdés fényében 0–10 skálán pontozza a jelölteket (strukturált kimenet),
és a legjobb `KEEP_TOP` (alap: 5) marad a válasz-modellnek.

**Consequences (testable):**
- Rerank-hiba esetén a vektortávolság szerinti top-K megy tovább, a trace-ben jelölve.

#### FR-14: Fokozatos degradáció

A retrieval minden lépésének van olcsóbb fallbackje, és a trace-ből kiderül, melyik ág futott.

**Consequences (testable):**
- A kereső tool semmilyen bemenetre (rossz kérdés, LLM-hiba, üres találat) nem dob a
  felhasználó felé kivételt; hibánál beszédes magyar üzenetet ad, a folyamat halad tovább.

### 4.4 Grounded válasz-agent

**Description:** Az agent egy vékony definíció a közös tool-use loop fölött: system prompt
(`<grounding>` blokkal) + toolkészlet + korlátok. A RAG a modell felé egyetlen tool
(`searchRules`), amely minden találathoz forrást ad. A válasz kizárólag a visszakapott
chunkokból származik, kötelező forrásmegjelöléssel; üres találatnál az agent kimondja,
hogy nincs információja. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-15: Tool-use loop és searchRules tool

Az agent lépésenkénti tool-use loopban fut (lépésszám- és kimenet-korláttal), és a
`searchRules` toolon keresztül fér a tudásbázishoz.

**Consequences (testable):**
- A tool minden találathoz a forrását is átadja (játék + szakasz + URL).
- A tool `execute` ága nem dob; rossz bemenetre is strukturált, magyar hibakimenetet ad.

#### FR-16: Kizárólag a chunkokból válaszol

A válasz-modell csak a visszakapott chunkok tartalmából fogalmaz, fejből nem egészít ki.

**Consequences (testable):**
- A grounding-szabályok külön `<grounding>` prompt-blokkban szerepelnek.

#### FR-17: Kötelező forrásmegjelölés

Minden érdemi válasz megjelöli a forrást (játék + szakasz, és a forrás-URL).

**Consequences (testable):**
- Pozitív golden-set kérdésnél a válasz tartalmazza az elvárt játék + szakasz megjelölést.

#### FR-18: Explicit nemleges válasz (negatív teszt)

Ha a keresés nem hoz releváns chunkot, az agent kimondja, hogy nincs információja, és nem
talál ki szabályt.

**Consequences (testable):**
- Mindkét negatív golden-set kérdésre a válasz explicit „nincs információm" jellegű, és
  nem tartalmaz kitalált szabályt/forrást.

#### FR-19: Magyar nyelvű válasz

A felhasználónak adott válasz magyar.

**Consequences (testable):**
- A golden-set futások válaszai magyar nyelvűek.

### 4.5 Kiértékelés és megfigyelhetőség

**Description:** A minőség mérhető: a golden set kérdéseit a rendszer kétszer futtatja
(nyers vektorkeresés vs. teljes pipeline), és az összevetés dokumentálja a HyDE és a
rerank hozzáadott értékét, legalább egy átrendezés-esettel és a negatív tesztekkel. A
retrieval minden lépése trace-t ír, és a keresés a generálástól külön is megtekinthető.
Realizes UJ-3.

**Functional Requirements:**

#### FR-20: Golden set és nyers vs. teljes összevetés

A rendszer a golden set kérdéseit `raw` (csak embedding + koszinusz) és `full`
(HyDE → top-20 → rerank → top-5) módban futtatja, és összeveti a találatokat.

**Consequences (testable):**
- A golden set legalább 8 pozitív és 2 negatív kérdést tartalmaz, kérdésenként megjelölt
  „gold" szakasszal.
- A kimenet kérdésenként egymás mellett mutatja a `raw` és `full` top-5-öt (játék,
  szakasz, távolság, rerank-pont) és a HyDE-szöveget.

#### FR-21: Retrieval-trace

Minden retrieval-lépés strukturált trace-t ír (HyDE-szöveg, távolságok, rerank-pontok,
kontextusméret) konzolra és fájlba.

**Consequences (testable):**
- A trace-ből minden kérdésnél kiderül, mit kerestünk valójában és melyik fallback-ág futott.

#### FR-22: Debug-parancsok

A rendszer külön parancsokkal láthatóvá teszi a tudásbázist és a keresést:
`debug:sources`, `debug:search "<kérdés>"` és `debug:search "<kérdés>" --full`.

**Consequences (testable):**
- `debug:sources` felsorolja a dokumentumokat és chunk-számukat.
- `debug:search --full` a teljes pipeline-t (HyDE + rerank) mutatja, `--full` nélkül a
  nyers vektorkeresést.

#### FR-23: Token-használat naplózása és költségbecslés

A rendszer minden modellhívásnál naplózza a token-használatot, és ebből költséget összegez.

**Consequences (testable):**
- Az ingest és egy kérdés teljes-pipeline költsége a **mért** tokenszámból számítható.

### 4.6 Konfiguráció és biztonság

**Description:** A rendszer határain fail-fast validáció áll: az env-változókat a
rendszer indulásakor ellenőrzi, a titkok kizárólag `.env`-ből jönnek, a modellnevek
env-ből felülírhatók. Az SQL paraméterezett.

**Functional Requirements:**

#### FR-24: Fail-fast env-validáció

Az induló entry pointok a legelső lépésben validálják a konfigurációt (kötelező titkok,
adatbázis-kapcsolat, numerikus paraméterek), beszédes hibával leállva, ha valami hiányzik.

**Consequences (testable):**
- Hiányzó kötelező titok (pl. API-kulcs, adatbázis-URL) esetén a rendszer a változó
  nevét megnevező hibával, indulás előtt leáll.

#### FR-25: Env-ből felülírható routing

A modell-szereposztás (embedding, HyDE, rerank, válasz) minden modellneve env-ből
felülírható, kódmódosítás nélkül.

**Consequences (testable):**
- A modellnevek env-változóval felülírhatók; hiányukban dokumentált alapértelmezés áll be.

## 5. Non-Goals (Explicit)

- **Nem** webes vagy grafikus felület — a v1 terminál/CLI-alapú.
- **Nem** valós idejű (webhook-alapú) tudásbázis-frissítés — a korpusz ritkán változik,
  ütemezett/kézi szinkron elég.
- **Nem** többnyelvű működés — a korpusz és a válaszok magyarok.
- **Nem** LLM-alapú „semantic chunking" — a determinisztikus, szerzői tagolásra épülő
  chunkolás mellett döntünk (tesztelhetőség + megspórolt ingest-költség).
- **Nem** mondat-szintű ablakozásos chunkolás — a szakasz-egység elég finom, és a listák
  egyben tartása épp ellentétes irányba mutat.
- **Nem** multi-tenant / felhasználókezelés / jogosultságok.
- **Nem** válaszol fejből: a termék sosem ad forrás nélküli vagy kitalált szabályt.

## 6. MVP Scope

### 6.1 In Scope

- Kurált korpusz: 7–8 népszerű játék hivatalos magyar szabálya, játékonként 3–4 tagolt
  dokumentumban — **~24–28 dokumentum, összesen > 15 000 szó**.
- Determinisztikus, unit-tesztelt chunkolás Játéknév-fejléccel.
- Teljes retrieval-pipeline: HyDE → embedding → tág háló → rerank → grounded válasz.
- Multi-provider routing (olcsó keres, erős válaszol).
- Inkrementális, hash-alapú tudásbázis-karbantartás (`--rebuild`-del).
- Golden set (nyers vs. teljes + negatív tesztek) és debug-láthatóság.
- Mért költségbecslés.

### 6.2 Out of Scope for MVP

- Metaadat-szűrés a `game` mezőre; LLM-as-judge groundedness-mérés; adatvezérelt
  abstention-küszöb; multi-turn beszélgetés; CI. _(v2 — a legjobb hozam/ráfordítás; a
  meglévő pipeline-ra ráépíthetők.)_ `[NOTE FOR PM]`
- Ablációs mérés (Recall@5, MRR, nDCG); chunking A/B; hibrid keresés (BM25 + vektor). _(v3
  — mérés-igényes bővítések.)_

## 7. Success Metrics

**Primary**
- **SM-1**: Retrieval-találati arány — a 8 pozitív golden-set kérdésből legalább **7**-nél
  a gold szakasz a teljes pipeline top-5-jében van. Validates FR-12, FR-13, FR-20.
- **SM-2**: Grounding a negatívokra — **mindkét** negatív kérdés átmegy: explicit
  nemleges válasz, kitalált szabály/forrás nélkül. Validates FR-18.

**Secondary**
- **SM-3**: A rerank kimutatható értéke — legalább **egy** dokumentált átrendezés-eset,
  ahol a rerank a gold chunkot előrébb hozza (vagy ennek hiányának indoklása). Validates FR-13, FR-20.
- **SM-4**: Költséghatékonyság — egy kérdés teljes-pipeline költsége a mért adatból a
  tervezett nagyságrendben (~$0.03), a válasz-modell dominanciájával. Validates FR-23, FR-25.

**Counter-metrics (do not optimize)**
- **SM-C1**: A találati arány **nem** növelhető a grounding lazításával — ha a rendszer
  bizonytalan találatra is magabiztos szabályt ad, az SM-1 javulása SM-2 romlása árán tilos.
  Counterbalances SM-1.
- **SM-C2**: A költség **nem** csökkentendő a válasz-modell gyengítésével a grounding
  rovására. Counterbalances SM-4.

## 8. Open Questions

1. A korpusz végleges játéklistája és a hivatalos magyar PDF-források elérhetősége
   (jogtiszta letöltés) — `[ASSUMPTION]` szerint a tervezett 8 cím elérhető.
2. Kell-e a nagyobb (3072 dim) embedding-modell, vagy a `small` elég? — a golden set méri.
3. A `WIDE_NET`/`KEEP_TOP` és a chunk-méretek végleges hangolása a golden-set futásokból.
4. A pipeline-verzió (chunker/embedding-modell) nyilvántartásának és eltérés-detektálásának
   módja — kézi `--rebuild` vs. tárolt `pipeline_version`.

## 9. Assumptions Index

- §2.2 — A termék segédeszköz, nem hivatalos versenyszabály-értelmező.
- §6.2 — A v2/v3 bővítések sorrendje és tartalma a `[NOTE FOR PM]` szerint revideálható.
- §8.1 — A tervezett 8 játék hivatalos magyar szabálya jogtisztán elérhető és korpuszba
  vehető.
- §8.2 — Az `text-embedding-3-small` a magyar korpuszon elegendő (a golden set igazolja).
- Constraints/Cost — a ~$0.03/kérdés költség-nagyságrend feltételezés; a mért adat pontosítja.
- Integráció — a konkrét modell-verziók env-ből felülírhatók; a végleges választás az
  architektúra-lépésé.

---

## Cross-Cutting NFRs

- **NFR-1 (Nyelv):** a korpusz, a HyDE-szöveg és a válasz magyar; a nyelvi rés
  elkerülése kötelező (a HyDE nem generálható más nyelven).
- **NFR-2 (Robusztusság):** a retrieval a felhasználó felé sosem dob kivételt; minden
  lépés fokozatosan degradálódik a fallbackjére.
- **NFR-3 (Determinizmus/tesztelhetőség):** a chunkolás **és a dokumentum-parse**
  determinisztikus és unit-tesztelt; a rendszer-határokon Zod-validáció (env, tool-input,
  LLM-output).
- **NFR-4 (Megfigyelhetőség):** minden retrieval-lépés trace-t ír; a keresés a
  generálástól külön megtekinthető.
- **NFR-5 (Konzisztencia):** a dokumentum-nyilvántartás és a chunkok egy tranzakciós
  határon belül változnak; árva chunk nem maradhat.
- **NFR-6 (Provider-rezíliencia):** a HyDE és a rerank szándékosan külön providernél fut,
  így egyetlen provider kiesése sem viszi el a teljes retrievalt — a két segéd-lépés
  egymástól függetlenül degradálódik a fallbackjére.

## Constraints and Guardrails

- **Safety (grounding):** a rendszer nem ad forrás nélküli vagy kitalált szabályt; üres
  találatnál explicit nemleges válasz. Ez a termék elsődleges biztonsági korlátja.
- **Cost:** az ingest egyszeri költsége elhanyagolható (a változatlan korpusz szinkronja
  0 token); a kérdésenkénti költséget a routing minimalizálja (olcsó keres, erős válaszol),
  cél ~$0.03/kérdés nagyságrend. `[ASSUMPTION]`
- **Privacy:** a rendszer nem gyűjt személyes adatot; a titkok (API-kulcsok)
  kizárólag `.env`-ben, a repóba sosem kerülnek; az SQL paraméterezett.

## Integration and Dependencies

- **Embedding + HyDE:** OpenAI (`text-embedding-3-small`, nano-szintű HyDE-modell).
- **Rerank + válasz:** Anthropic (Haiku-szintű rerank, Sonnet-szintű válasz). `[ASSUMPTION:
  a konkrét modell-verziók a routing háttéranyagból, env-ből felülírhatók.]`
- **Tárolás:** PostgreSQL + pgvector (dokumentum-nyilvántartás + chunkok egy tranzakciós
  határon belül).
- **SDK:** egységes modell-interfész a provider-cseréhez.
