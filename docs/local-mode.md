# Lokális (ingyenes) mód — Ollama + LiteLLM

> A fizetős OpenAI/Anthropic (Claude Console) API-k helyett a teljes pipeline futtatható
> **helyi Ollamán**, előfizetés nélkül. A megoldás a `config.ts` **base-URL override**-jára épül:
> a kód nem változik, csak a provider-végpontokat irányítjuk át. (Minta: a párhuzamos
> `ai-agent-kurzus-hf` projekt LiteLLM-megoldása.)

## Miért kell két útvonal?

A projekt két provider-formátumot használ (AD-7 routing):

| Lépés | Formátum | Hova irányítjuk lokálisan |
|---|---|---|
| Embedding (ingest + kérdés) | OpenAI | **közvetlenül** Ollama `/v1` (OpenAI-kompatibilis) |
| HyDE | OpenAI | **közvetlenül** Ollama `/v1` |
| Rerank | Anthropic | **LiteLLM proxy** `/v1/messages` → Ollama |
| Válasz (Story 2.2) | Anthropic | **LiteLLM proxy** `/v1/messages` → Ollama |

Az Ollama natívan beszéli az OpenAI-kompatibilis API-t, de **nem** az Anthropicot — ezért
kell a LiteLLM proxy az Anthropic-oldalhoz (rerank + válasz). Az OpenAI-oldal proxy nélkül,
közvetlenül megy az Ollamára.

## 1. Ollama + modellek

```powershell
ollama serve                 # ha még nem fut
ollama pull qwen2.5:3b       # chat: HyDE + rerank + válasz (function calling)
ollama pull mxbai-embed-large  # embedding (1024 dim)   VAGY   ollama pull nomic-embed-text (768 dim)
```

## 2. LiteLLM proxy (Anthropic → Ollama)

A proxy a repo gyökerében lévő `litellm.config.yaml`-t használja (Python kell hozzá):

```powershell
$env:OLLAMA_API_BASE="http://localhost:11434"
uvx --from "litellm[proxy]" litellm --config litellm.config.yaml --port 4000
# ha a tool-/structured-hívás hibázik, frissíts: ...litellm[proxy]@latest...
```

## 3. `.env` (lokális mód)

Másold a `.env.example`-t `.env`-be, és állítsd be a lokális blokkot:

```dotenv
OPENAI_API_KEY=sk-local-anything
ANTHROPIC_API_KEY=sk-local-anything
OPENAI_BASE_URL=http://localhost:11434/v1
ANTHROPIC_BASE_URL=http://localhost:4000/v1
HYDE_MODEL=qwen2.5:3b
RERANK_MODEL=szabalymester-local
ANSWER_MODEL=szabalymester-local
EMBEDDING_MODEL=mxbai-embed-large
EMBEDDING_DIMENSIONS=1024
SCHEMA_VECTOR_DIM=1024
```

- A titkok **dummyk** lehetnek — az Ollama/LiteLLM nem ellenőrzi, de az SDK-nak nem-üres kell.
- Az `ANTHROPIC_BASE_URL` végén a `/v1` KELL: az AI SDK ehhez fűzi a `/messages`-t.

## 4. Embedding-dimenzió (fontos!)

A lokális embed-modell dimenziója eltér az OpenAI 1536-tól (`mxbai-embed-large` = 1024,
`nomic-embed-text` = 768). A séma `vector(N)`-jét ehhez kell igazítani:

1. `db/schema.sql`: `embedding vector(1536)` → `vector(1024)` (a modell dimenziója).
2. `.env`: `EMBEDDING_DIMENSIONS` és `SCHEMA_VECTOR_DIM` = ugyanaz a szám.
3. Séma újraalkalmazása + teljes újravektorizálás:
   ```powershell
   pnpm db:up
   pnpm db:schema         # vagy friss kötettel az initdb
   pnpm ingest --rebuild  # a hash-ek érvénytelenek, minden újraembeddel
   ```

A `config.ts` fail-fast ellenőrzi, hogy `EMBEDDING_DIMENSIONS === SCHEMA_VECTOR_DIM` (AD-3);
ha a séma és a modell dimenziója nem egyezik, a pgvector a beíráskor hibázna.

## 5. Futtatás

```powershell
pnpm ingest            # helyi embeddingek a korpuszra
# (Story 2.2/2.3 után) pnpm cli ask "Catanban mi tortenik, ha 7-est dobok?"
```

## Vissza a felhőhöz

Töröld/kommenteld ki a `*_BASE_URL` sorokat és állítsd vissza az igazi kulcsokat +
a felhő-modellneveket (`text-embedding-3-small`, `gpt-5.4-nano`, `claude-haiku-4-5`,
`claude-sonnet-5`) + `EMBEDDING_DIMENSIONS=1536`, `SCHEMA_VECTOR_DIM=1536`.

## Korlátok

- Kis helyi modell (3B) gyengébb, mint a Claude Sonnet — a grounding/rerank minősége alacsonyabb;
  a fallbackek (vektorsorrend) gyakrabban aktiválódnak. Fejlesztéshez/demóhoz viszont ingyenes.
- A LiteLLM Anthropic-átjárója recens verziót igényel a structured/tool-híváshoz (ld. a
  `litellm.config.yaml` fejlécét).
