# ROI — ember vs. RAG-asszisztens (Szabálymester)

> Üzleti összevetés: mennyibe kerülne a társasjáték-szabály kérdések megválaszolása **emberi
> munkaerővel**, szemben a **RAG-asszisztenssel** (felhő és lokális változat). A számok **mért
> adatokból** (ld. README „Költségbecslés") + **explicit, állítható feltevésekből** származnak —
> nem pontos üzleti terv, hanem nagyságrendi ROI-becslés.

## 1. Feltevések (átlátható, állítható)

| Paraméter | Érték | Megjegyzés |
|---|---|---|
| Árfolyam | 370 HUF / USD | kerekített |
| Emberi teljes munkáltatói költség | 700 000 HUF/hó (~$1 890) | ügyfélszolgálatos / szabály-szakértő, bér + szocho + rezsi |
| Produktív órák/hó | ~120 h | 168 munkaóra × ~70% hasznos idő |
| Idő/válasz (emberi) | ~6 perc | kérdés értelmezése + szabály kikeresése + megfogalmazás |
| **Emberi kapacitás** | **~1 200 válasz/hó** | 120 h × 10 válasz/h |
| RAG — egy kérdés (felhő) | ~$0,025 (~9 HUF) | mért ~7–8 000 token, a válasz-modell dominál (~85%) |
| RAG — ingest (egyszeri) | ~$0,0006 | 54 dok / ~28 500 token |
| RAG — infra (felhő DB + hosting) | ~$15/hó | pgvector/Postgres + futtatás |
| RAG — lokális (Ollama) | ~$0 / válasz | önhosztolt; hardver süllyedt költség + elhanyagolható áram |
| Egyszeri fejlesztés (build) | ~$1 300 (~60 mérnök-óra) | egyszeri; a jelen projekt ~ennyi munka |

## 2. Fajlagos költség (egy válasz)

| Verzió | Költség / válasz | Viszonyítás |
|---|---|---|
| **Ember** | ~583 HUF (~$1,58) | 1× (bázis) |
| **RAG — felhő** | ~9 HUF (~$0,025) | **~63× olcsóbb** |
| **RAG — lokális** | ~0 HUF (marginális) | gyakorlatilag ingyenes/válasz |

## 3. Havi költség volumen szerint

| Kérdés/hó | Ember | RAG — felhő | RAG — lokális |
|---|---|---|---|
| 500 | ~$1 890 (1 FTE, alulterhelt) | ~$27 (500×$0,025 + $15) | ~$0 (+ infra, ha van) |
| 1 200 (kapacitáshatár) | ~$1 890 (1 FTE, ~tele) | ~$45 | ~$0 |
| 5 000 | ~$7 500–9 500 (4–5 FTE) | ~$140 | ~$0 (ha a hardver bírja) |
| 20 000 | ~$30 000+ (15–17 FTE) | ~$515 | korlát: helyi átbocsátás |

Az ember **lineárisan skálázódik fejben** (több kérdés → több FTE), a RAG felhő-változata
**közel fixen** (token × volumen, az infra alig nő), a lokális pedig a hardver átbocsátásáig **ingyen**.

## 4. Megtakarítás és megtérülés (ROI)

**1 200 kérdés/hó mellett** (egy FTE kapacitása):

- Ember: ~$1 890/hó
- RAG felhő: ~$45/hó → **~$1 845/hó megtakarítás (~97,6%)**
- Egyszeri build: ~$1 300 → **megtérülés < 1 hónap** ($1 300 / $1 845).
- Első éves nettó megtakarítás: ~$1 845 × 12 − $1 300 ≈ **~$20 800**.

**5 000 kérdés/hó mellett** a megtakarítás ~$7 400–9 400/hó — a build napokban megtérül.

## 5. Nem csak pénz — a RAG egyéb előnyei

- **24/7, azonnali** válasz (az ember 8 h/nap, sorban áll).
- **Skálázható** csúcsterhelésre (pl. karácsonyi társasjáték-szezon) FTE-felvétel nélkül.
- **Konzisztens** válaszok, **forrásmegjelöléssel** (auditálható).

## 6. Őszinte árnyalás — hol jobb az ember (és mi a reális modell)

- **Lefedettség/árnyaltság:** az ember bármely játékra, homályos vagy összetett kérdésre válaszol;
  a RAG csak a korpuszára korlátozódik, és a **lokális kis modell válasz-minősége korlátozott**
  (ld. `docs/golden-set.md` §6 — a magyar, kereszt-nyelvű grounded válasz erős modellt kíván).
- **Minőség vs. költség:** az igazán jó minőséghez a RAG-nak is felhő válasz-modell kell (~$0,025/válasz);
  a „$0 lokális" olcsóbb, de gyengébb.
- **Reális üzleti modell = hibrid:** a RAG viszi a **gyakori kérdések** tömegét olcsón és azonnal
  (deflection), az ember a **nehéz/él-eseteket** (eszkaláció). Ez egyszerre adja a költség-előnyt és a
  minőséget. Egy tipikus 80/20 deflection (a kérdések 80%-át a RAG zárja) mellett az emberi kapacitás
  ötödére csökken → a fenti megtakarítás nagy része realizálódik, a minőség megőrzésével.

## 7. Következtetés

Fajlagosan a RAG **~60×–„végtelenszer"** olcsóbb egy válaszra, a **megtérülés < 1 hónap**, és
skálázhatóság/rendelkezésre állás terén is felülmúlja az embert. A gyakorlatban a **hibrid** (RAG +
emberi eszkaláció) a nyerő: a RAG a tömeget, az ember a nehéz eseteket kezeli. A jelen projekt ennek a
**technikai magját** valósította meg (ingest → keresés → grounded válasz), mérhető minőséggel és
költséggel.

> A számok feltevés-érzékenyek (bér, volumen, deflection-arány, felhő-modell ára) — a fenti táblázatok
> paraméterei szabadon átírhatók a valós üzleti kontextusra.
