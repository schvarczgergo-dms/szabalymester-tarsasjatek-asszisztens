# Deferred Work

## Deferred from: code review of story 1-1 (2026-07-18)

- **`keepTop ≤ wideNet` kereszt-validáció** [src/config.ts] — a config-határon értelmes lenne
  egy `.refine()`, ami tiltja a `keepTop > wideNet` esetet (több megtartott chunk, mint
  amennyit a tág háló lekér). Halasztva a Story 2.1-re, ahol a `wideNet`/`keepTop`
  ténylegesen használatba kerül (a retrieval-pipeline), így a valós használat kontextusában
  validálható.
