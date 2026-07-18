# Reviewer Gate — Architecture Spine (Szabálymester)

- **Determinisztikus lint (`lint_spine.py`):** 0 finding (a javítások után is).
- **Web-verzió-lencse:** a Stack minden verziója web-ellenőrzött (2026-07); két javítás a
  `docs`-hoz képest: válasz-modell `claude-sonnet-4-6` → **`claude-sonnet-5`**, HyDE
  `gpt-4.1-nano` → **`gpt-5.4-nano`**; `ai` SDK **v7**.

## Adversariális lyukak (5) → mind lezárva

1. Env-felülírható embedding-modell ⟷ fix `vector(1536)` → **AD-3** dimenzió-szabály
   (config fail-fast a dim-egyezésre).
2. `section` kettős tulajdonos (dok-oszlop vs. chunk-fejléc) → **AD-10** dokumentum-granularitás.
3. Chunk-fejléc helye (content vs. külön mező) → **AD-4**: `content = fejléc + törzs`.
4. `content_hash` normalizálása definiálatlan → **AD-5**: egyetlen `normalize(raw)→string`.
5. `ToolOutcome` alak definiálatlan → **AD-8**: egyetlen Zod-sémás típus (`content` + `report: TraceEntry` + `status`).

## Input-egyeztetés (5 hiány) → mind pótolva

1. Dokumentum-parse determinizmus/teszt (NFR-3) → **AD-4** kiterjesztve `parse-document`-re.
2. Cron/ütemezett szinkron-trigger (FR-4) → **AD-5** trigger-szabály.
3. Token/költség-naplózás (FR-23/SM-4) → **AD-11** usage-naplózás.
4. Soft-delete audit + újraélesztés (FR-4) → **AD-5** életciklus-szabály.
5. Rerank LLM-output Zod-határa (NFR-3) → konvenció-tábla bővítve.

**Eredmény:** 9 → **11 AD**; a spine az adversariális próbán zárt.
