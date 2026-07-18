# Lokális (ingyenes) mód — Ollama

> A fizetős OpenAI/Anthropic (Claude Console) API-k helyett a teljes pipeline futtatható
> **helyi Ollamán**, előfizetés nélkül. A megoldás a `config.ts` **base-URL override**-jára és a
> **provider-választóra** épül: a kód nem változik, csak a végpontokat és a providert irányítjuk át.
> Éles projektben marad a felhő (OpenAI + Anthropic); lokálisan minden az Ollamára megy.

## Az elv

Az Ollama **natívan beszéli az OpenAI-kompatibilis API-t** (chat + embeddings), ezért **minden**
modell-szerep átirányítható rá egyetlen base-URL-lel — külön proxy nélkül. Az Anthropic-szerepeket
(rerank, válasz) a `RERANK_PROVIDER`/`ANSWER_PROVIDER=openai` kapcsolja az OpenAI-adapterre.

| Lépés | Éles (default) | Lokális (Ollama) |
|---|---|---|
| Embedding | OpenAI `text-embedding-3-small` | Ollama `nomic-embed-text` (OpenAI-formátum) |
| HyDE | OpenAI `gpt-5.4-nano` | Ollama `qwen2.5:3b` (OpenAI-formátum) |
| Rerank | Anthropic `claude-haiku-4-5` | Ollama `qwen2.5:3b` (`RERANK_PROVIDER=openai`) |
| Válasz | Anthropic `claude-sonnet-5` | Ollama `qwen2.5:3b` (`ANSWER_PROVIDER=openai`) |

## 1. Ollama + modellek

```powershell
ollama serve                 # ha meg nem fut
ollama pull qwen2.5:3b       # chat: HyDE + rerank + valasz
ollama pull nomic-embed-text # embedding (768 dim)   VAGY   ollama pull mxbai-embed-large (1024)
```

## 2. `.env` (lokális mód)

Másold a `.env.example`-t `.env`-be, és állítsd be:

```dotenv
OPENAI_API_KEY=sk-local-anything
ANTHROPIC_API_KEY=sk-local-anything
DATABASE_URL=postgresql://szabalymester:szabalymester@localhost:5432/szabalymester
OPENAI_BASE_URL=http://localhost:11434/v1
HYDE_MODEL=qwen2.5:3b
RERANK_MODEL=qwen2.5:3b
RERANK_PROVIDER=openai
ANSWER_MODEL=qwen2.5:3b
ANSWER_PROVIDER=openai
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
SCHEMA_VECTOR_DIM=768
```

- A titkok **dummyk** lehetnek — az Ollama nem ellenőrzi, de az SDK-nak nem-üres kell.
- Nincs szükség `ANTHROPIC_BASE_URL`-re és LiteLLM-re.

## 3. Embedding-dimenzió (fontos!)

A lokális embed-modell dimenziója eltér az OpenAI 1536-tól (`nomic-embed-text` = 768,
`mxbai-embed-large` = 1024). A séma `vector(N)`-jét ehhez kell igazítani:

1. `db/schema.sql`: `embedding vector(1536)` → a modell dimenziója (pl. `vector(768)`).
2. `.env`: `EMBEDDING_DIMENSIONS` és `SCHEMA_VECTOR_DIM` = ugyanaz a szam.
3. Séma + újravektorizálás:
   ```powershell
   pnpm db:up
   pnpm db:schema
   pnpm ingest --rebuild
   ```

A `config.ts` fail-fast ellenőrzi, hogy `EMBEDDING_DIMENSIONS === SCHEMA_VECTOR_DIM` (AD-3).

## 4. Futtatás

```powershell
pnpm ingest            # helyi embeddingek a korpuszra
# (Story 2.2/2.3 utan) pnpm cli ask "Catanban mi tortenik, ha 7-est dobok?"
```

## Vissza a felhőhöz (éles)

Töröld/kommenteld ki a `*_BASE_URL` és a `*_PROVIDER=openai` sorokat, állítsd vissza az igazi
kulcsokat + a felhő-modellneveket (`text-embedding-3-small`, `gpt-5.4-nano`, `claude-haiku-4-5`,
`claude-sonnet-5`) + `EMBEDDING_DIMENSIONS=1536`, `SCHEMA_VECTOR_DIM=1536`, és a sémát 1536-ra.

## Opcionális alternatíva: LiteLLM (Anthropic-adapter megtartása)

Ha ragaszkodsz az Anthropic-adapterhez a rerank/válaszhoz, a `litellm.config.yaml` egy
Anthropic-kompatibilis (`/v1/messages`) átjárót ad az Ollamára:

```powershell
$env:OLLAMA_API_BASE="http://localhost:11434"
uvx --from "litellm[proxy]" litellm --config litellm.config.yaml --port 4000
```
majd `.env`: `ANTHROPIC_BASE_URL=http://localhost:4000/v1`, `RERANK_PROVIDER=anthropic`,
`RERANK_MODEL=szabalymester-local`.

**Figyelem (Windows):** a legújabb `litellm` egy Rust-kiterjesztést fordít, amihez Visual C++
Build Tools (`link.exe`) kell. Ha ez hiányzik, a fenti LiteLLM-mentes út (OpenAI-formátum →
Ollama) az ajánlott — az minden build-tool nélkül működik.

## Korlátok

- Kis helyi modell (3B) gyengébb, mint a Claude Sonnet — a grounding/rerank minősége alacsonyabb
  (a rerank pl. hajlamos egyforma pontot adni; a vektorkeresés ilyenkor is jó találatot ad).
  Fejlesztéshez/demóhoz viszont ingyenes.
