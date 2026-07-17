# Chunking-stratégia — döntések és indoklás

> Cél: egy naiv bekezdés-alapú chunkolásnál jobb stratégia, amelynek az indoklása a
> tudásbázis **tagoltságából** következik (nem technikák halmozása öncélúan).

## 1. Mit tudunk a korpuszról? (ebből következik minden döntés)

A tudásbázis: 7-8 népszerű társasjáték hivatalos **magyar szabálykönyve**, markdownba
konvertálva, játékonként több tagolt dokumentumban. A tagoltság jellemzői —
ezekre épül a stratégia:

1. **Front matter** minden fájlon: `title`, `game` (melyik játék!), `source` (URL),
   `section` (attekintes / elokeszules / jatekmenet / pontozas / gyik).
2. **Szabványos, konzisztens szakasz-struktúra**: a szabálykönyvek jellemző szakaszai
   (Komponensek, Előkészület, A játék menete, Egy kör lépései, Pontozás, Játék vége,
   Gyakori kérdések) — a kiadó már elvégezte a szemantikus tagolást alcímekkel.
3. **Vegyes bekezdés-méret**: rövid szabály-mondatok és hosszabb, példával illusztrált
   szakaszok váltakoznak; gyakran **listák** (lépéssorozatok, felsorolt komponensek).
4. **Erős anafora**: a szabályok a játékot alanyként kezelik — "Húzz 2 lapot",
   "Dobj a kockával", "Ekkor a játékos passzol". A **játék neve** szinte sehol nem
   szerepel a mondatban, csak a dokumentum tetején → chunkból kiszakítva elveszik.
5. **Kevés zaj**, de van: borító, kiadói impresszum, komponens-illusztrációk aláírásai,
   "©"/jogi sor — ezeket ingest előtt szűrjük.

## 2. A stratégia — szakasz-alapú chunkolás játéknév-fejléccel

A naiv alapmegoldás bekezdés-alapú, alcímnél új chunkot kezd. A továbbfejlesztés három pontban:

### 2.1 Szakasz mint elsődleges egység (heading-aware)

- A dokumentumot a `##` / `###` alcímek mentén **szakaszokra** bontjuk; egy szakasz
  egy gondolati egység (pl. "Egy kör lépései") — chunk-határ csak szakasz-határon
  vagy azon belül lehet.
- Szakaszon belül bekezdéseket/lista-elemeket pakolunk a méretkeretig (cél:
  **~1000 karakter**, felső korlát ~1500); túl hosszú bekezdésnél mondathatáron vágunk.
- **Listák együtt maradnak**: egy lépéssorozat (pl. "1. …, 2. …, 3. …") nem vágható
  ketté — a fél lépéslista értelmetlen. Ha a lista túllépi a keretet, a lista az egyetlen
  kivétel, ahol a chunk nagyobb lehet a felső korlátnál (a szabály integritása fontosabb).
- **Kis szakaszok összevonása**: a < ~200 karakteres törpe-szakaszt a következővel
  vonjuk össze (a szabálykönyvekben gyakori az 1-2 mondatos szakasz).

### 2.2 Játéknév + szakasz kontextus-fejléc (a fő újítás)

Minden chunk szövege elé egy rövid fejléc kerül embeddelés ELŐTT:

```
[Játék neve] > [Szakasz címe (breadcrumb)]

<a szakasz szövege...>
```

Példa: `Catan (A telepesek) > Építkezés > Város építése` + a szabály szövege.

Indoklás — ez a domain legerősebb chunking-érve: a szabály-szöveg **anaforikus**.
A "Dobj a két kockával, és minden azt a számot mutató mező termel." chunk a játék neve
nélkül BÁRMELYIK kockás játék öntözés-analóg szakaszához hasonlít vektorban. A "Catanban
hogyan termelnek a mezők?" kérdésre a fejléc nélküli chunk vektora alig különbözik a
King of Tokyo kocka-szakaszától. A fejléccel a **játék neve minden chunk vektorába
bekerül** — így a keresés játékot is meg tud különböztetni, nem csak témát.
(Ára: pár tíz token / chunk az embeddingnél — elhanyagolható.)

### 2.3 Átfedés csak szakaszon belül

- Szakaszon belüli vágásnál az utolsó bekezdés átmegy a következő chunkba
  (a határon álló mondat kontextusa ne vesszen el).
- **Szakasz-határon nincs átfedés** — ott új gondolat kezdődik.

## 3. Mit nyerünk a változtatással? (összefoglaló indoklás)

| Változtatás | Mit old meg |
|---|---|
| Szakasz-alapú határok | a chunk egy lezárt szabály-egység — nincs félbevágott szabály |
| **Játéknév + szakasz fejléc** | az anafora-probléma: a chunk vektorába bekerül, MELYIK játékról szól — a keresés játékok közt is elkülönít |
| Listák egyben tartása | a lépéssorozat/komponens-lista nem vágódik félbe |
| Törpe-szakasz összevonás | nincs információszegény mini-chunk |
| Zaj-szűrés (impresszum, jogi sor) | a szabály-kérdésre nem kiadói szöveg a találat |
| Átfedés csak szakaszon belül | határ-mondat kontextusa megmarad, szakaszok közt nincs áthallás |

Amit tudatosan NEM csinálunk (a túlbonyolítás nem érdem):

- **Nincs LLM-alapú "semantic chunking"** — a szerzői (kiadói) tagolás jó minőségű,
  az LLM-es darabolás nem-determinisztikus (nem unit-tesztelhető) és ingest-költséget ad.
- **Nincs mondat-szintű ablakozás** — a szakasz-egység elég finom, a listák egyben
  tartása pont az ellenkező irányba mutat.

## 4. Determinizmus és tesztek

A chunkolás tisztán determinisztikus függvény: `(markdown, opciók) → Chunk[]`.
Tervezett unit tesztek (`src/ingest/chunk.spec.ts`):

1. rövid dokumentum egyben marad
2. alcímnél új chunk kezdődik, a szakaszcím a chunk fejlécében megjelenik
3. **játéknév-fejléc**: a `game` mező minden chunk elején ott van
4. lista nem vágódik ketté (egy számozott lépéssorozat egy chunkban marad)
5. törpe-szakasz összevonódik a következővel
6. szakaszon belüli vágásnál van átfedés; szakasz-határon nincs
7. túl hosszú (nem-lista) bekezdés mondathatáron vágódik
8. chunk-sorszámozás folytonos a dokumentumon belül

## 5. Paraméterek (kiindulás — a golden set alapján hangolható)

| Paraméter | Érték | Indoklás |
|---|---|---|
| célméret | ~1000 karakter (~250 token) | egy fókuszált szabály-egység |
| felső korlát | ~1500 karakter | efelett mondathatáros vágás (lista kivétel) |
| törpe-küszöb | ~200 karakter | ez alatt összevonás a következő szakasszal |
| átfedés | 1 bekezdés, csak szakaszon belül | határ-kontextus megőrzése zaj nélkül |
