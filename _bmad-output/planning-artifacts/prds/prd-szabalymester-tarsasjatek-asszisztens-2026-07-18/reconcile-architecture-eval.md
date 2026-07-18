# Input reconciliation — ARCHITEKTURA.md, golden-set.md

Bemenetek vs. PRD. Csak a hiányok. (A golden-set módszertan + elfogadási kritériumok
hiánytalanul leképződnek: FR-20/21, SM-1/2/3.)

- **Soft-delete revival + audit-nyom** (ARCHITEKTURA §2.3): a `status = deleted` a
  dokumentum-soron marad — audit-nyom (mi/mikor tűnt el) + a visszatérő dokumentum a
  meglévő sorát élesztheti újra (a hash dönt). A PRD FR-4 csak a törlést mondja. →
  **PRD-be** (FR-4 consequence, viselkedés), a cél/indok → **addendum**.
- **Pipeline-változás → automatikus teljes újraépítés** (ARCHITEKTURA §2.4):
  tartalomváltozás = inkrementális, pipeline-változás (chunker/embedding-modell) = teljes
  rebuild; `pipeline_version` eltérésnél a szinkron maga követeli. A PRD ezt kézi
  `--rebuild`-re redukálja. → **PRD-be** (FR-5 consequence + Open Question a
  pipeline_version detektálásról).
- **Trigger-taxonómia** (ARCHITEKTURA §2.4): három trigger — ütemezett (cron), kézi
  ingest, `--rebuild`. A PRD-ben a cron csak a Non-Goals félmondatában. → **PRD-be**
  (FR-4/FR-5 consequence: a szinkron ütemezett és kézzel is indítható).
- **Last-Modified/ETag olcsó előszűrő** (ARCHITEKTURA §2.1): opcionális, a letöltés
  megspórolására; a döntő szó a hash-é. → **addendum** (opcionális optimalizáció).
