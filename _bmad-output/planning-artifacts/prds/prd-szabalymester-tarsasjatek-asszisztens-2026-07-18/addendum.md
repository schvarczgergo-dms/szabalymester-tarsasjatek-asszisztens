---
title: Szabálymester — PRD Addendum
created: 2026-07-18
---

# Addendum

A PRD törzse a **képességeket** (mit) rögzíti; ez az addendum a downstream munkafolyamatok
(architektúra, epikek, implementáció) számára megőrzött **indoklásokat, mechanizmus-
döntéseket és méret-adatokat** (a hogyan) tartja. A forrás a `docs/` háttéranyag.

## 1. Routing — a szereposztás indoklása

- **HyDE = a legolcsóbb modell elég.** A HyDE-kimenet sosem jut a felhasználóhoz, csak
  keresőkulcs — a **tartalma lehet téves is**, egyedül a magyar, szabálykönyv-szerű
  szóhasználat számít. Emellett a HyDE minden kérdés útjában álló **soros** lépés, tehát
  latency-kritikus → gyors, olcsó modell.
- **Válasz = erős modell kell.** A társasjáték-szabály pont az a domain, ahol a kisebb
  modell szívesen „kitalálja" a szabályt fejből; a grounding kikényszerítése
  (instruction following, forráshűség) a nagyobb modellek erőssége.
- **Embedding = a `small` magyarul is jó.** A választott embedding-modell többnyelvű,
  ezért a magyar szabály-szövegen és kérdéseken összemérhető vektorokat ad; a HyDE-t is
  ezért kell magyarul generálni (nyelvi rés elkerülése).
- **Cross-provider rezíliencia (mechanizmus).** A HyDE (OpenAI) és a rerank (Anthropic)
  szándékosan **külön providernél** fut. Így egyetlen provider kiesése sem viszi el a
  teljes retrievalt: a két segéd-lépés egymástól függetlenül degradálódik a fallbackjére
  (HyDE-hiba → eredeti kérdés; rerank-hiba → vektorsorrend). A PRD ezt NFR-6-ként rögzíti.

## 2. Költség-módszertan (mélység)

- Egy kérdés teljes-pipeline költségének **~80–90%-a a válasz-modell** — a routing
  („olcsó keres, drága válaszol") pontosan itt fizet.
- A rerank a kérdésenkénti **legnagyobb bemenet** (~20 chunk ≈ 3–4K token); ha a
  válasz-modellen futna, a kérdésár nagyságrendileg **megduplázódna**.
- Az ingest egyszeri költsége elhanyagolható (~fél cent nagyságrend); változatlan korpusz
  szinkronja **0 token**.
- A README-be kerülő végszám a **mért** tokenszámból, a golden set ~10 futásának
  átlagából számítódik.

## 3. Méret-paraméterek (kiindulás — golden-set alapján hangolható)

| Paraméter | Érték | Megjegyzés |
|---|---|---|
| Embedding batch | 100 chunk / API-hívás | ingest-átbocsátás |
| `WIDE_NET` | 20 | tág háló (vektorkeresés) |
| `KEEP_TOP` | 5 | a válasz-modellnek |
| chunk célméret | ~1000 karakter (~250 token) | egy fókuszált szabály-egység |
| chunk felső korlát | ~1500 karakter | efelett mondathatáros vágás (lista kivétel) |
| törpe-küszöb | ~200 karakter | ez alatt összevonás a következő szakasszal |
| átfedés | 1 bekezdés, csak szakaszon belül | határ-kontextus megőrzése |

## 4. Tudásbázis-karbantartás (mechanizmus)

- A `content_hash` a **normalizált, zaj-szűrt** törzsből képződik (a whitespace/kiadói sor
  változása nem triggerel újravektorizálást).
- A dokumentum-csere (delete + insert + hash-update) **egyetlen tranzakcióban** — a kereső
  sosem lát fél-kész állapotot, áramszünetnél sem marad kevert chunk-készlet.
- **Soft-delete cél:** a `status = deleted` audit-nyomot ad (mi/mikor tűnt el), és a
  visszatérő dokumentum a meglévő sorát élesztheti újra.
- **`pipeline_version`:** a chunker/embedding-modell verziója nyilvántartható; eltérésnél
  a szinkron teljes újraépítést követel (a tartalomváltozás inkrementális, a
  pipeline-változás teljes — a kettő nem keverhető).
- **ETag/`Last-Modified` (opcionális):** megbízható forrás-fejléc olcsó előszűrőnek
  használható a letöltés megspórolására; a döntő szó azonban a hash-é.

## 5. Chunking — tudatosan elvetett alternatívák

- **Nincs LLM-alapú „semantic chunking":** a szerzői (kiadói) tagolás jó minőségű; az
  LLM-es darabolás **nem-determinisztikus** (nem unit-tesztelhető) **és ingest-költséget**
  ad.
- **Nincs mondat-szintű ablakozás:** a szakasz-egység elég finom, és a listák egyben
  tartása épp az ellenkező irányba mutat.
