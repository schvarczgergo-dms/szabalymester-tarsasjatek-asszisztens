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
