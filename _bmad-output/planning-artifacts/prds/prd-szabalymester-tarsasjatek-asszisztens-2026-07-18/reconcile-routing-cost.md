# Input reconciliation — routing.md, koltsegbecsles.md

Bemenetek vs. PRD. Csak a hiányok. (A konkrét modell-verziók szándékos hiánya nem hiba —
azok az architektúrába tartoznak.)

- **Cross-provider hibatűrés indoka** (routing §2): a HyDE és a rerank külön providernél,
  egymástól függetlenül degradálódnak. → **PRD-be** (NFR, a rezíliencia-elv), a részletes
  mechanizmus → **addendum**.
- **HyDE olcsó-modell indoka** (routing §3): a kimenet sosem jut a felhasználóhoz
  (keresőkulcs), tartalmi tévedés megengedett, csak a szóhasználat számít; + latency (soros
  lépés). → **addendum** (rationale).
- **Válasz-modell erős-modell indoka** (routing §3): a társasjáték-szabály az a domain,
  ahol a kis modell fejből „kitalál"; a grounding kikényszerítéséhez erős instruction
  following kell. → **addendum** (rationale).
- **Embedding magyar/többnyelvű indoka** (routing §3): a small modell többnyelvű, ezért
  teljesít jól magyarul. → **addendum** (rationale).
- **Költség-módszertan mélysége** (koltsegbecsles §3): a kérdés-költség ~80–90%-a a
  válasz-modell; a rerank a legnagyobb bemenet; ha Sonneten futna, a kérdésár duplázódna;
  10 golden-set futás átlaga. → **addendum** (sizing/rationale).
