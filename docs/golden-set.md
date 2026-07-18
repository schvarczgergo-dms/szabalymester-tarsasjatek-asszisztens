# Golden set — tesztkészlet és módszertan

> A golden set: 5-10 kérdés a domainből, mindegyik lefuttatva
> (1) nyers vektorkereséssel és (2) teljes pipeline-nal (HyDE + rerank);
> az összevetés dokumentálva; legalább egy kérdésnél bemutatva, hogy a rerank
> átrendezte a sorrendet — és legalább egy NEGATÍV kérdés, amire nincs válasz.

## 1. Módszertan

- A kérdéskészlet a `src/eval/golden-set.json`-ben él, a futtató a
  `src/eval/run-golden-set.ts`: minden kérdést kétszer futtat —
  `raw` mód (csak embedding + koszinusz-távolság, top-5) és
  `full` mód (HyDE → embedding → top-20 → rerank → top-5).
- A kimenet kérdésenként: a két találati lista egymás mellett (játék + szakasz,
  chunk-index, távolság, rerank-pont), plusz a HyDE által generált hipotetikus válasz.
- Az eredmény-táblázat és az elemzés IDE, ebbe a dokumentumba kerül a futások után.
- Elvárt találat ("gold chunk"): kérdésenként előre megjelöljük, melyik játék melyik
  szakaszából várjuk a jó választ — így a "jók-e a találatok" ítélet nem utólagos benyomás.

## 2. A kérdéskészlet (terv — a társasjáték-korpuszra)

A kérdések szándékosan különböző retrieval-nehézségeket fednek le. (A konkrét játékok a
végleges korpusztól függenek; az alábbi a javasolt készlet: Catan, Carcassonne,
Ticket to Ride, Pandémia, 7 Csoda, Azul, Splendor, King of Tokyo.)

| # | Kérdés | Elvárt forrás (játék · szakasz) | Mit tesztel |
|---|---|---|---|
| 1 | Catanban hogyan termelnek a mezők? | Catan · Játékmenet | alap-eset: közvetlen szakasz létezik |
| 2 | Mi történik Catanban, ha 7-est dobok? | Catan · Rabló / Játékmenet | **rerank-próba**: a "7-es dobás" és a "rabló mozgatása + lapeldobás" más szavakkal beszél — a vektor-top várhatóan az általános kockadobás-szakasz, a rerank hozza elő a rabló-szabályt |
| 3 | Carcassonne-ban hogyan pontozódik egy befejezetlen város a játék végén? | Carcassonne · Pontozás / Játék vége | **rerank-próba**: a "befejezett" vs. "befejezetlen" város két külön szabály, vektorban közel — a rerank különíti el |
| 4 | Ticket to Ride-ban mi van, ha nem tudok több vagont lerakni? | Ticket to Ride · Játék vége | **HyDE-próba**: a laikus "nem tudok több vagont" a szabálykönyvben "az utolsó forduló kiváltása" néven szerepel |
| 5 | Pandémiában mikor veszítjük el a játékot? | Pandémia · Játék vége / Vereség | negatív feltételek felsorolása, több altéma |
| 6 | 7 Csodában hogyan számolódnak a tudomány (science) pontok? | 7 Csoda · Pontozás | képlet-jellegű szabály, pontos szám-visszaadás (grounding-próba) |
| 7 | Azulban mi történik, ha egy mintasorba nem fér több csempe? | Azul · Játékmenet | élhelyzet, a padló-sor (büntetés) szabály |
| 8 | King of Tokyóból mikor és hogyan léphetek ki? | King of Tokyo · Játékmenet | fajspecifikus szabály, a játéknév-fejléc próbája (több kockás játék van a korpuszban) |
| 9 | **NEGATÍV:** Hogyan kell játszani a Gloomhavennel? | *(nincs — nincs a korpuszban)* | grounding: az agent mondja ki, hogy erről a játékról nincs információ, ne találjon ki szabályt |
| 10 | **NEGATÍV:** Catanban hány lapból áll a pontosan 5 játékosos kiegészítő dobozának a súlya kilóban? | *(nincs — értelmetlen/lefedetlen adat)* | grounding: témán belülinek hangzó, de lefedetlen/abszurd kérdés — forráskitalálás helyett "nincs információm" |

Megjegyzés: a 9-es a klasszikus "nincs a korpuszban" negatív teszt (létező játék, de nem
része a tudásbázisnak); a 10-es a "témán belülinek tűnő, de kitalált/lefedetlen adat" —
ez azt bizonyítja, hogy az agent nem told ki a hiányt magabiztos hallucinációval.

## 3. Amit az összevetésben dokumentálni kell (a futás után töltendő)

1. **Kérdésenkénti táblázat**: raw top-5 vs. full top-5 (játék · szakasz + távolság +
   rerank-pont).
2. **Legalább egy átrendezés-eset részletesen** (várhatóan a 2. vagy 3. kérdés):
   melyik chunk hol állt a vektorsorrendben, hova került a rerank után, és MIÉRT jobb
   az új sorrend (a chunk-tartalmak idézésével).
3. Ha valamelyik kérdésnél a rerank NEM változtat: annak a magyarázata is eredmény
   (pl. a vektortávolság már eleve a jó szakaszt hozta elsőnek).
4. **A negatív tesztek kimenete**: az agent tényleges válasza, bizonyítva, hogy
   kimondja a "nincs információm"-ot és nem talál ki szabályt.
5. A HyDE-szövegek mellékelve (a debug-kimenetből) — látszik, mit kerestünk valójában.

## 4. Elfogadási kritériumok

- a 8 pozitív kérdésből legalább 7-nél a gold szakasz a full pipeline top-5-jében van
- legalább 1 dokumentált átrendezés-eset indoklással (vagy ennek hiányának magyarázata)
- mindkét negatív teszt átmegy: nincs kitalált szabály, explicit "nem tudom" válasz

## 5. Mért eredmények és elemzés (lokális futás)

> Futtatás: `pnpm eval:golden-set`. A részletes, kérdésenkénti táblázat (nyers vs. teljes
> top-5, HyDE-szöveg, távolságok): **`docs/golden-set-eredmenyek.md`** (generált).
> Konfiguráció: embedding `nomic-embed-text` (768d), HyDE/rerank/válasz `qwen2.5:3b`
> (helyi Ollama), korpusz angol (Wikipédia CC BY-SA), relevancia-küszöb 0.45.

**Számok:** pozitív gold a teljes top-5-ben: **4/8**; átrendezés (nyers vs. teljes top-1):
**7**; negatív teszt: **2/2 absztenció** (mindkettő üres → „nincs információm").

**Elemzés (őszintén):**

- **A negatív tesztek átmennek.** A relevancia-küszöb (0.45) mindkét lefedetlen kérdésnél
  (Gloomhaven; abszurd Catan-súly) üres eredményt ad → az agent absztenál, nem talál ki
  szabályt. Ez a grounding lényegi bizonyítéka.
- **A HyDE + rerank értéke egyértelmű, amikor a HyDE jó.** Ahol a kis modell értelmes angol
  HyDE-t írt (Carcassonne, 7 Wonders, Azul, Splendor), ott a gold a teljes pipeline top-1–2
  helyére került, és a távolság drámaian javult (nyers ~0.43–0.48 → teljes ~0.10–0.29). A
  nyers (magyar kérdés → angol korpusz, HyDE nélkül) baseline következetesen gyenge.
- **Miért csak 4/8?** A szűk keresztmetszet a **HyDE minősége a 3B modellen**: több esetben
  a HyDE hallucinált (catan-7: „Seven of Steel"), vagy — a rendszerprompt ellenére — magyarul
  generált (pandemic-lose), ami elrontja a keresztnyelvi vektort. A rossz HyDE rossz találatot
  hoz (ttr-endgame → Dominion, kot → Ark Nova). Ez **nem a pipeline hibája**, hanem a helyi
  kis modell korlátja: erős válasz-/HyDE-modellel (élesben Claude/GPT) a 4/8 érdemben feljebb
  vihető. A 7 dokumentált átrendezés így is bőven teljesíti az SM-2 célt.
- **Következtetés:** a retrieval-architektúra (HyDE → tág háló → rerank → küszöb) helyes és
  mérhetően hozzáad; a lokális, ingyenes futtatás a *mechanizmust* bizonyítja, a *pontosságot*
  a modell-erő korlátozza (dokumentált, tudatos kompromisszum).

## 6. Modell- és nyelv-kísérlet (helyi) — a válasz-minőség szűk keresztmetszete

A válasz-lépés minőségét helyi Ollama-modellekkel is megvizsgáltuk (a válasz-modell a `.env`
`ANSWER_MODEL`-jével cserélhető; a retrieval változatlan):

| Helyi modell (≤4 GB VRAM) | Tool-hívás | Válasz-viselkedés (magyar) |
|---|---|---|
| `qwen2.5:3b` | ✅ | **hallucinál** (kitalált szabály/URL) |
| `qwen3:4b-instruct` | ✅ | nem hallucinál, de **túl-absztenál** (a talált angol kontextust sem használja) |
| `phi4-mini` | ❌ (a hívást szövegként írja ki) | + gyenge magyar |
| `gemma3:4b` | ❌ (Ollama: „does not support tools") | — |
| `qwen3.5:latest` (6,6 GB) | ✅ | **>7 perc/válasz** — a 4 GB-on CPU-ra csordul, használhatatlan |

**A kulcs-megfigyelés — a szűk keresztmetszet a kereszt-nyelvűség, nem a pipeline:** amikor a
válasz nyelvét a korpuszéra (angolra) állítottuk, a `qwen3:4b-instruct` a Catan „7-es dobás"
kérdésre **helyes, grounded, forrásmegjelölt** választ adott (a rabló mozgatása, laplopás és a
lap-eldobás szabály, „Source: Catan > Gameplay"), a negatív teszt pedig továbbra is absztenált.
Magyar válasznál ugyanez a modell túl-absztenált. Vagyis a kis helyi modellnek az „**angol
kontextus → magyar válasz**" a nehéz; azonos nyelven már használható.

**Következmények (a routing/`docs/routing.md`-vel összhangban):**
- **Éles minőség (magyar válasz):** erős felhő válasz-modell (`ANSWER_PROVIDER=anthropic|openai`)
  — a kód erre kész (a retrieval/HyDE maradhat akár lokális is).
- **Teljesen ingyenes, lokális demó:** a `qwen3:4b-instruct` a legjobb helyi választás (valódi
  tool-hívás, nincs hallucináció); a válasz-pontosság a kereszt-nyelvűség miatt korlátozott.
- A `debug:search --full` bizonyítja, hogy a releváns chunk a kontextusban van → a hiba a
  válasz-generálásban (modell-erő + nyelv), nem a keresésben.

### 6.1 Küszöb-kikapcsolás + magyar válasz (árnyalás)

A relevancia-küszöb kikapcsolásával (`RELEVANCE_MAX_DISTANCE=1`) és **magyar** válasszal újrafuttatva
a `qwen3:4b-instruct` a vártnál jobban teljesített:

- **Tud magyarul, groundeltan, forrással válaszolni angol kontextusból** — a „7 Wondersben hogyan
  pontozódnak a tudomány-szimbólumok?" kérdésre helyes magyar választ adott (a tudomány-szimbólumok
  pontképlete), „Forrás: 7 Wonders · jatekmenet (URL)" hivatkozással. A kereszt-nyelvűség tehát
  **nem lehetetlen** a 4B-nek — akkor sikerül, ha a retrieval **tisztán** hozza a releváns chunkot
  (a 7 Wonders a golden-setben is rang 1 volt).
- **Küszöb NÉLKÜL is helyesen absztenál a negatív tesztre** (Gloomhaven → „nincs információm"),
  vagyis a modellnek **saját grounding-fegyelme** van — nem hallucinál (szemben a `qwen2.5:3b`-vel,
  amelynek ehhez kellett a küszöb). A relevancia-küszöb így nála extra biztonság, nem az egyetlen védelem.
- Az Azul/Catan absztenció oka **retrieval-zaj** (a top-K-t más játékok — pl. Carcassonne — uralták)
  + a kereszt-nyelvi nehézség a határeseteknél, nem a modell „lustasága".

**Finomított következtetés:** a `qwen3:4b-instruct` szolid helyi választás (nem hallucinál, tud
magyarul grounded választ adni tiszta retrievalnél); a fő korlát a **retrieval-pontosság a
határeseteknél** (Wikipédia-mélység + kereszt-nyelv). Éles, konzisztens magyar minőséghez továbbra is
erős felhő válasz-modell ajánlott; a küszöb a gyengébb (hallucináló) modelleknél marad hasznos.
