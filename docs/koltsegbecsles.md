# Költségbecslés — módszertan és előzetes kalkuláció

> Rövid összefoglaló a README-ben — (1) mennyibe került a teljes
> tudásbázis vektorizálása, (2) mennyibe kerül egy kérdés a teljes pipeline-nal.
> Nagyságrend elég, de a SAJÁT számokból. Ez a dokumentum a módszertan; a végleges
> számok a tényleges futásokból kerülnek a README-be.

## 1. Hogyan mérünk?

- Az AI SDK minden hívásnál visszaadja a token-használatot (`usage`) — az ingest és a
  retrieval trace-e ezt naplózza, a golden set futtató összegzi.
- A README-be a **mért** tokenszám × aktuális listaár kerül; az alábbi kalkuláció
  előzetes becslés a tervezéshez (a korpusz ismert méretéből).

## 2. Előzetes becslés — ingest (egyszeri / újraépítéskor)

Kiindulás: ~24-28 dokumentum (7-8 játék szabálykönyve tagolva), > 15 000 szó.
Nagyságrend: ~20 000-25 000 szó ≈ ~30 000-35 000 token nyers szöveg; az átfedés és a
játéknév-fejléc miatt a chunkolt token-összeg ennél nagyobb:

- becsült ~250-350 chunk × ~300 token ≈ **~80 000-100 000 token** embedding-bemenet
- `text-embedding-3-small` @ ~$0.02 / 1M token → **~$0.002, azaz nagyságrendileg fél cent**

(A korpusz mérete miatt az ingest egyszeri költsége alacsony.)
Az inkrementális frissítés (ld. `ARCHITEKTURA.md`) miatt ez csak első alkalommal és
pipeline-váltáskor merül fel; a heti szinkron változatlan korpusznál 0 tokent fogyaszt.

## 3. Előzetes becslés — egy kérdés a teljes pipeline-nal

| Lépés | Modell | Becsült tokenek | Becsült költség |
|---|---|---|---|
| HyDE | gpt-4.1-nano | ~100 be / ~80 ki | ~$0.00005 |
| Kérdés-embedding | text-embedding-3-small | ~100 | ~$0.000002 |
| Rerank (20 chunk pontozása) | claude-haiku-4-5 | ~3500 be / ~200 ki | ~$0.004 |
| Válasz (5 chunk + prompt + tool-loop) | claude-sonnet-4-6 | ~3000-4000 be / ~500 ki | ~$0.02-0.03 |
| **Összesen / kérdés** | | | **~$0.03 nagyságrend (~10-12 Ft)** |

Tanulságok a tervezéshez:

- A kérdésenkénti költség **~80-90%-a a válasz-modell** — a routing (olcsó keres,
  drága válaszol) pontosan itt fizet: ha a rerank is Sonneten futna, a kérdésár
  megduplázódna; ha a válasz is Haikun, a grounding-minőség esne.
- Az ingest a kérdés-költséghez képest elhanyagolható (egy kérdés ára nagyságrendileg
  10+ teljes újravektorizálásé) — a "ne vektorizáld újra, ami nem változott" szabály
  mégis fontos, mert a szinkron gyakori, a rebuild ritka művelet.

## 4. A README-be kerülő végleges bekezdés (futás után töltendő)

Sablon:

> **Költségek (mért):** a teljes tudásbázis vektorizálása (K dokumentum, N chunk,
> M token) $X volt. Egy kérdés a teljes pipeline-nal (HyDE + embedding + rerank +
> válasz) átlagosan $Y (a golden set 10 futásának átlaga; ebből a válasz-modell $Z).
