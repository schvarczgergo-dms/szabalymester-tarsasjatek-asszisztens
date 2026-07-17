# Multi-provider routing — szereposztás és indoklás

> A pipeline-ban legalább **két különböző provider** modellje fut. Itt a szereposztás
> és az indoklás — melyik modell mit csinál, és miért pont az.

## 1. Az elv

**Olcsó modell keres, drága modell válaszol.** A pipeline lépései nagyon különböző
képességet igényelnek: a HyDE-hoz és a rerankhez nem kell "okos" modell, csak gyors és
olcsó; a végső válaszhoz viszont kell a szintézis-képesség és a szabálykövetés
(grounding, forráshivatkozás). Aki mindent a nagy modellel csinál, feleslegesen fizet;
aki mindent a kicsivel, rossz választ ad.

## 2. Szereposztás

| Lépés | Modell (terv) | Provider | Miért ez |
|---|---|---|---|
| Embedding (ingest + kérdés) | `text-embedding-3-small` (1536 dim) | OpenAI | iparági standard, nagyon olcsó (~$0.02 / 1M token), a pgvector 1536 dimenzióval jól kezeli; **magyar szövegen is jól teljesít** (többnyelvű modell); a kérdést és a dokumentumokat KÖTELEZŐEN ugyanez embeddeli |
| HyDE (hipotetikus válasz) | `gpt-4.1-nano` (vagy aktuális nano-szintű OpenAI modell) | OpenAI | 2-3 mondat kitalált **magyar** szabály-szöveg kell, aminek a TARTALMA lehet téves is — csak a szóhasználata számít; a legolcsóbb/leggyorsabb modell is elég |
| Rerank (0-10 pontozás) | `claude-haiku-4-5` | Anthropic | strukturált kimenet (JSON pontszámok) + rövid magyar szövegértés — a Haiku ára/sebessége ideális; 20 chunk pontozása kérdésenként fut, ezért a költsége számít |
| Végső válasz (agent) | `claude-sonnet-4-6` | Anthropic | tool-use loop + grounding-szabályok betartása + magyar nyelvű szintézis forráshivatkozással (játék + szakasz) — ez a "drága" képesség, itt éri meg a nagyobb modell |

Így a pipeline-ban **két provider** (OpenAI + Anthropic) és **négy modell-szerep** fut.

## 3. Az egyes döntések indoklása részletesen

### Embedding — miért OpenAI small?

- A korpusz ~1500 chunk × ~250 token: az ingest embedding-költsége centes nagyságrend.
- Az 1536 dimenzió a pgvectorban indexelés nélkül is gyors ekkora korpusznál.
- A `-large` (3072 dim) kétszeres tár + költség; a golden set méri majd, kell-e —
  a hipotézis: ennél a jól tagolt, angol nyelvű korpusznál a small elég.
- Kritikus szabály: **modellváltás = teljes újravektorizálás** (más a vektortér).

### Embedding — miért működik magyarul?

- A `text-embedding-3-small` többnyelvű; a magyar szabály-szövegen és a magyar kérdéseken
  is összemérhető vektorokat ad. Kritikus, hogy a HyDE-szöveg is **magyar** legyen — ha
  angolul generálnánk, a HyDE-vektor eltávolodna a magyar chunkoktól (nyelvi rés).
- A golden set méri majd, kell-e a `-large` (3072 dim); a hipotézis: a small elég.

### HyDE — miért nano-szintű modell?

- A HyDE-kimenet sosem jut a felhasználóhoz, csak keresőkulcs. A hibás tartalmú, de
  jó (magyar, szabálykönyv-szerű) szóhasználatú hipotetikus válasz is tökéletes.
- Latency-érv: a HyDE minden kérdés útjában áll (soros lépés) — gyors modell kell.
- Hibatűrés: ha a hívás elhasal, az eredeti kérdéssel keresünk tovább (fallback).

### Rerank — miért Haiku, és miért nem a válasz-modell?

- A rerank feladata szövegértés + pontozás, nem generálás — kis modell terepe.
- Kérdésenként ez a legnagyobb bemenet (20 chunk × ~600 karakter ≈ 3-4K token):
  ha ezt a Sonnet árazásán futtatnánk, a kérdésenkénti költség többszöröződne.
- Strukturált kimenet (`generateObject` + Zod séma) — a Haiku ezt megbízhatóan tudja.
- Külön provider-érv: a rerank és a HyDE szándékosan MÁS providernél van, mint egymás —
  így egyetlen provider kiesése sem viszi el a teljes retrievalt (a HyDE és a rerank
  egymástól függetlenül degradálódik a fallbackjére).

### Válasz-modell — miért Sonnet-szint?

- Itt dől el a grounding: a modellnek be kell tartania, hogy CSAK a kapott chunkokból
  válaszol, forrást hivatkozik (játék + szakasz), és üres találatnál kimondja, hogy nem
  tudja. A szabálykövetés (instruction following) a nagyobb modellek erőssége — és a
  társasjáték-szabály pont az a domain, ahol a kisebb modell szívesen "kitalálja" a
  szabályt fejből, ezért a grounding kikényszerítéséhez erős modell kell.
- Magyar nyelvű, tömör szabály-összefoglalás a megtalált szakaszokból.

## 4. Hibatűrés (degradációs lánc)

| Kieső elem | Viselkedés |
|---|---|
| HyDE-hívás hibázik | az eredeti kérdést embeddeljük — a keresés megy tovább |
| Rerank hibázik | a vektortávolság szerinti top-K megy a modellnek (`score: -1` jelöléssel a trace-ben) |
| Vektorkeresés üres | a tool explicit "nincs találat" üzenetet ad — az agent kimondja, hogy nem tudja |

A retrieval tehát **sosem dob kivételt a felhasználó felé** — minden lépésnek van
olcsóbb fallbackje, és a trace-ből látszik, melyik ág futott.

## 5. Konfiguráció

- Minden modellnév env-ből felülírható (`.env`: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `HYDE_MODEL`, `RERANK_MODEL`, `ANSWER_MODEL`) — a routing-kísérletezés kódmódosítás
  nélkül lehetséges.
- Az egységes interfész a Vercel AI SDK (`ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic`):
  provider-csere = egy import + egy modellnév.
