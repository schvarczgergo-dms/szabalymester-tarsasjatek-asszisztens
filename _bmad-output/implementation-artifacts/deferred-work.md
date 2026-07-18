# Deferred Work

## Deferred from: code review of story 1-2 (2026-07-18)

- **`db:schema` paraméterezett `-U/-d`** [package.json] — a `POSTGRES_USER`/`POSTGRES_DB`
  env-override esetén a beégetett `szabalymester` csatlakozás elhasal. A `sh -c` alapú
  paraméterezés a pnpm/Windows shellen `Unterminated quoted string`-et ad, ezért marad a
  beégetett forma. Megoldás: külön cross-platform apply-script (pl. tsx, ami a config
  `DATABASE_URL`-jét használja).
- **Séma-migrációs stratégia** [db/schema.sql] — az `IF NOT EXISTS` csak létrehoz, nem
  ALTER-el; meglévő táblán a séma-változás néma no-op. Ha a séma bővül (új oszlop, CHECK,
  enum-érték), verziózott migráció kell (pl. numbered SQL vagy egy migrációs eszköz).


## Deferred from: code review of story 1-1 (2026-07-18)

- **`keepTop ≤ wideNet` kereszt-validáció** [src/config.ts] — a config-határon értelmes lenne
  egy `.refine()`, ami tiltja a `keepTop > wideNet` esetet (több megtartott chunk, mint
  amennyit a tág háló lekér). Halasztva a Story 2.1-re, ahol a `wideNet`/`keepTop`
  ténylegesen használatba kerül (a retrieval-pipeline), így a valós használat kontextusában
  validálható.
