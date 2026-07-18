# Input reconciliation — terv.md, bmad-workflow.md, tervezesi-mintak.md

Bemenetek vs. PRD. Csak a hiányok (a jól lefedett témák nincsenek listázva).

- **Korpusz mennyiségi minimuma** (terv.md §2): > 15 000 szó, ~24–28 dokumentum,
  játékonként 3–4 tagolt markdown. A PRD §6.1 ezt „kurált korpusz"-ra hígítja — a mérhető
  küszöb kimarad. → **PRD-be** (MVP scope / Constraint).
- **Dokumentum-parse unit-teszt** (terv.md §7, bmad-workflow story 3): a parse (front
  matter) determinisztikus → unit-tesztelt. A PRD csak a chunkolásra írja elő (FR-9). →
  **PRD-be** (FR-1 consequence / NFR-3).
- **Multi-provider rezíliencia** (tervezesi-mintak §5): a HyDE és a rerank szándékosan
  külön providernél → egy provider kiesése nem viszi el a retrievalt. → **PRD-be** (NFR).
- **Embedding batch-méret** (terv.md §5): 100 chunk / API-hívás. → **addendum** (sizing).

Jól lefedve: WIDE_NET/KEEP_TOP, HyDE, rerank, grounding, negatív teszt, trace,
debug-parancsok, költségbecslés, fail-fast config, architektúra-elvek.
