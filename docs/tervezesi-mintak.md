# Tervezési minták — RAG-pipeline

> A megvalósításhoz szükséges, **repo-független** tervezési minták. Nem egy konkrét
> kódbázis leírása — ezek az elvek, amelyeket a saját pipeline-unkban követünk.
> A konkrét paraméterek (modellnevek, méretek, lépésszámok) a `terv.md`, `routing.md`
> és `chunking-strategia.md` dokumentumokban élnek.

## 1. Kétlépcsős keresés (tág háló + átrangsorolás)

- Előbb **tág háló**: vektorkeresés sok jelöltre (olcsó, gyors, elnéző).
- Utána **rerank**: egy kis modell a kérdés *fényében* pontozza a jelölteket, és csak a
  legjobb néhány marad meg a válasz-modellnek.
- Indoklás: a vektortávolság olcsó, de "buta" — egyetlen számba sűríti a jelentést, és
  nem tudja, mit kérdeztél. A rerank a konkrét kérdésre való relevanciát méri.

## 2. HyDE — a kérdés helyett kitalált választ keresünk

- A kérdés és a válasz nem ugyanazon a nyelven beszél (rövid kérdő vs. hosszú, kijelentő,
  szakszavas). Ezért egy kis modellel írunk egy rövid, magabiztos **hipotetikus választ**,
  és EZT embeddeljük — a vektora közelebb esik a jó chunkhoz.
- A hipotetikus válasz tartalma lehet téves; nem ezt adjuk a felhasználónak, csak keresünk
  vele. Fontos: a **korpusz nyelvén** generáljuk (nyelvi rés elkerülése).

## 3. Fokozatos degradáció — a retrieval sosem áll meg

- Minden lépésnek van olcsóbb fallbackje: HyDE-hiba → az eredeti kérdéssel keresünk;
  rerank-hiba → a vektorsorrend megy tovább.
- A kereső tool sosem dob kivételt a felhasználó felé: hibánál beszédes üzenetet ad
  vissza, a folyamat halad tovább. A trace-ből látszik, melyik ág futott.

## 4. Grounding két szinten (prompt + tool-kimenet)

- **Prompt-szint**: külön `<grounding>` szabályblokk — a modell csak a kapott chunkokból
  válaszolhat, kötelező a forráshivatkozás, és üres találatnál KIMONDJA, hogy nincs
  információja (nem told ki a hiányt találgatással).
- **Tool-szint**: minden találat a **forrásával együtt** megy a modellnek; üres
  találatnál a tool explicit szöveget ad vissza ("nincs erre vonatkozó részlet…"),
  ami tereli a modellt. A grounding így nem csak prompt-dísz.
- A negatív teszt (olyan kérdés, amire nincs válasz a korpuszban) ennek a próbája.

## 5. Multi-provider routing — olcsó keres, drága válaszol

- A pipeline lépései különböző képességet igényelnek → különböző (akár más providerű)
  modellek: olcsó/gyors a keresés-segéd lépésekhez (HyDE, rerank), erős a végső válaszhoz.
- Szabály: a **kérdést és a dokumentumokat ugyanazzal az embedding-modellel** kell
  vektorizálni; modellváltás = a teljes korpusz újravektorizálása.
- A HyDE és a rerank érdemes külön providernél legyen — egyetlen provider kiesése így nem
  viszi el az egész retrievalt.

## 6. Observability — "előbb a retrievalt nézd"

- Minden retrieval-lépés írja ki magát (mit kerestünk valójában, távolságok, rerank-pontok,
  a modellnek menő kontextus mérete).
- A keresés **külön megtekinthető** a generálástól: legyen mód a nyers vektorkeresés és a
  teljes pipeline (HyDE + rerank) külön futtatására/megnézésére (debug-parancs vagy
  -kimenet). A RAG-hibák többsége retrieval-hiba, nem generálás-hiba.

## 7. Determinisztikus chunkolás = tesztelhető chunkolás

- A chunkolás az egyetlen tisztán determinisztikus RAG-lépés → **unit-tesztelhető**
  (az embedding és a rerank hálózatot/modellt hív, azokat nem itt ellenőrizzük).
- A darabhatár ne vágjon ketté egy gondolatot; a szerzői/kiadói tagolást (alcímek)
  tiszteljük. A részleteket ld. `chunking-strategia.md`.

## 8. Agent = prompt + toolok + loop

- Egy agent három dologból áll: **system prompt + toolkészlet + egy tool-use loop**
  (kézzel írt vagy SDK-ból), lépésszám- és kimenet-korláttal.
- A RAG a modell felé **egy tool** ("keress a szabály-tudásbázisban"). Nem mi döntjük el,
  mikor hívja — a modell dönt a **tool-leírás** alapján, ezért a leírás is prompt-mérnökség.
- Több agent = több `(prompt, toolok, korlátok)` csomag ugyanazon loop fölött; egy agent
  a másik kezében tool-ként is megjelenhet (multi-agent).

## 9. Korpusz-előkészítés

- Minden forrás-dokumentum **front matterrel**: legalább cím + **forrás-URL** (a
  provenance/grounding alapja) + a domainhez illő címkék.
- **Zaj-szűrés ingest előtt**: ami nem tudás (kiadói/jogi blokk, illusztráció-aláírás),
  azt kivágjuk, különben a keresés zajt találna a valós kérdésre.
