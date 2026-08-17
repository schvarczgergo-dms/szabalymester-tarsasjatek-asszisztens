# Ügyfélirányú PoC — Gémasztal Szabálysegéd

A Szabálymester eddig a pult mögött dolgozott: a kolléga kérdezett, az agent a
tudásbázisból válaszolt. Ez a PoC **ugyanazt az agentet, tudásbázist és `searchRules`
toolt** fordítja a vendég felé. Új rendszer nincs; új bejárat van, egy emberi kapuval.

**Kitalált üzemeltető:** Gémasztal (társasjáték-kávézó / bolt). **Végfelhasználó:** a
vendég, aki a játékasztalnál vagy zárás után szabályt keres.

## Mit csinál

Egy folyamat: **vendég szabálykérdése**.

1. A vendég beírja a kérdést (`http://127.0.0.1:3847/`).
2. A meglévő grounded agent keres a tudásbázisban (élő HyDE + rerank + válasz — nincs
   előre rögzített szöveg).
3. Van releváns találat → a vendég megkapja a választ forrással, plusz AI-közlés.
4. Nincs találat / keresési hiba / modellkiesés / más játék chunkja → **nem** a „nincs infóm”
   (és nem 500-as nyers hiba) megy ki válaszként, hanem jegy nyílik a játékmesternek (`/operator`).
   A játékmester a kérdés, az ok és az agent vázlata alapján **jóváhagy vagy elutasít**;
   ezután a vendég az azonosítóval megnézi a választ.

Két demo-kérdés a felületen:

| Vendégkérdés | Várt út |
|---|---|
| Catanban mi történik, ha 7-est dobok? | auto, élő RAG |
| Hogyan kell játszani a Gloomhavennel? | eszkaláció (nincs a korpuszban; ha más játék chunkját hozza, `game_mismatch`) |

## Amit megold — és amit nem

A cégvezető tíz fájdalmából **hármat** visz a PoC, a többit kimondva nem.

Megoldja:

- **1.** a vendég **munkaidőn / záráson kívül** is kap választ;
- **2.** a pult **nem magyarázza el századszor** ugyanazt a szabálykérdést;
- **9.** a válasz **ugyanabból a tudásbázisból** jön, forrással — nem attól függ, ki áll a pultnál.

Nem oldja meg:

- **3.** új vendég onboardingja az első hetekben (ez Q&A, nincs bevezető út);
- **4.** ügy / rendelés állapota;
- **5.** személyre szabott kiszolgálás;
- **6.** kérdésből és panaszból tanuló termék (napló van, termék nincs);
- **7.** üzletkötés papírmunkája;
- **8.** sürgős reklamáció vs. nyitvatartás-triázs — a kapu csak a bizonytalan szabálykérdés;
- **10.** csendes lemorzsolódás / churn-jelek.

## Hogyan indul

Előfeltétel: a sima Szabálymester már fut (Postgres, `.env`, ingestelt korpusz).
Lokális mód: `docs/local-mode.md`.

```bash
pnpm install
docker compose up -d --wait
pnpm db:schema          # a PoC táblái IF NOT EXISTS — meglévő köteten is biztonságos
pnpm ingest             # ha a tudásbázis még üres
pnpm poc
```

- Vendég: http://127.0.0.1:3847/
- Játékmester: http://127.0.0.1:3847/operator
- Port: `POC_PORT` (alap 3847), csak loopback.

A válasz **modellhívásból** jön. Ollama vagy felhőkulcs kell; előre begépelt demo-szöveg
nincs a kódban.

## Mit kell hozzá

| Kell | Miért |
|---|---|
| Node 20+, pnpm, Docker (pgvector) | a meglévő stack |
| Ingestelt korpusz | különben minden kérdés eszkalál |
| `.env` (Ollama **vagy** felhőkulcsok) | élő agent |
| Egy „játékmester” a demón | az eszkalációs ág emberi jóváhagyása |

## Dokumentumok (ugyanerről a PoC-ról)

| Dokumentum | Szerep |
|---|---|
| [prezentacio.html](prezentacio.html) | 7 dia, vezetői kör, ~5 perc |
| [meresi-terv.md](meresi-terv.md) | teljes mérési tábla |
| [kerdeslap.md](kerdeslap.md) | 6 kapott + 2 saját kérdés, a PoC-ra mutatva |

## Amit a PoC szándékosan nem tartalmaz

Bejelentkezés, szerepkör, e-mailes kiküldés, hivatalos kiadói PDF, több üzlet /
több márka, automatikus kifizetés vagy rendelésmódosítás. A játékmester-felület a
PoC-ban **nincs jelszóval védve** — csak loopback, demóra.
