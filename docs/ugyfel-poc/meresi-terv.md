# Mérési terv — Gémasztal Szabálysegéd

Honnan tudjuk, hogy a vendégirányú PoC működik? A lenti sorok **létező** PoC-adatforrásra
mutatnak (`customer_requests`, `customer_tickets`, `GET /api/metrics`). Ahol a PoC ma
még aggregátumot nem számol (pl. munkaidőn kívüli arány), a nyers mező megvan, a riport
egy SQL a `created_at`-re.

Jelmagyarázat a forrás típusához: **mért** = a PoC/repo már naplózza; **beépítendő** =
a mező megvan, a rendszeres riport még nincs automatizálva.

| MIT MÉRÜNK | HONNAN LESZ ADAT | HOGYAN RIPORTÁLJUK | KINEK |
|---|---|---|---|
| **Auto-válasz arány** (a pult ismétlődő szabálykérdéseinek levétele) | `customer_requests.path`: `auto` / `escalate` — `GET /api/metrics` `auto` vs `requests` | Heti összesítő: auto / összes kérés. Pilot-kapu: 4 hét átlag ≥ 70% | Folyamatgazda |
| **Vendég felé mért válaszidő** (auto-ág) | `customer_requests.latency_ms` (az `ask` körüli idő, HTTP overhead nélkül) | Heti medián és p95 ms; a játékmester asztalon az `avgLatencyMs` | Folyamatgazda |
| **Eszkalációs arány** | `customer_tickets` darabszám / `customer_requests`; `metrics.escalate`, `pendingTickets` | Havi egy dia: pending vs. lezárt, ok szerint (`reason`: empty_retrieval / retrieval_error / no_search / agent_error / game_mismatch) | Szponzor |
| **Játékmester átfutás** (emberi kapu) | `customer_tickets.created_at` → `resolved_at`, `resolved_by` | Heti medián perc pending→lezárt; ki viszi a sort | Műszakvezető |
| **Téves absztenció** — az agent hibája, nem a sikere | `customer_tickets.resolution_tag = 'should_have_auto'` (a játékmester jelöli, ha a tudásbázisban benne volt, mégsem ment ki auto-válasz). `metrics.shouldHaveAuto` | Havi: should_have_auto / lezárt jegy. Pilot-kapu: < 10% | Folyamatgazda + szponzor |
| **Hibás auto-válasz** — az agent hibája a „siker” ágon | `customer_requests.feedback = 'wrong_auto'` (vendég gomb: „Hibás volt a válasz”). `metrics.wrongAuto` | Havi: wrong_auto / auto kérések. Minden jelölt tétel játékmesteri mintavétel | Folyamatgazda |
| **Munkaidőn kívüli auto-válasz** (zárás utáni lefedés) | `customer_requests.created_at` + `path = 'auto'` | Heti: 18:00–10:00 (helyi) auto kérések száma. A PoC a timestampet méri; az órasávos aggregátum egy SQL, nincs külön UI | Szponzor |
| **Token / költség / kérés** | `customer_requests.usage_tokens`; felhő-projekció: `src/eval/cost.ts` (README: ~7–8k token, ~$0,02–0,03/kérdés felhőben) | Havi költség = Σ token × listaár, vagy lokális módban $0. Felső becslés: felhő válasz-modell | Pénzügy / szponzor |

## A megoldott fájdalmakhoz kötött sorok

- **Ismétlődő kérdések:** auto-válasz arány.
- **Munkaidőn kívül:** munkaidőn kívüli auto-válasz (a `created_at` alapján).
- **Inkonzisztens pult-válasz:** nem külön KPI, hanem a grounding ténye (forrás a válaszban) + a hibás auto-válasz jelölés, ha a forrás ellenére rossz a szöveg.

## Az agent hibája (nem csak a siker)

Két sor: **téves absztenció** (`should_have_auto`) és **hibás auto-válasz** (`wrong_auto`).
Mindkettő a PoC-ban rögzül; egyik sem a „hány kérdést zártunk le” siker-mutató.

## Ami a PoC-ból szándékosan kimarad, és mit kellene hozzáépíteni

| Hiány | Mit kellene beépíteni |
|---|---|
| Nincs automatikus heti e-mail | cron + `GET /api/metrics` (vagy SQL) → a folyamatgazda postafiókja |
| Nincs mintavételes groundedness-judge a produkcióban | a golden set judge (`docs/tovabbfejlesztes.md`) bekötése hetente 20 auto-válaszra |
| A vendég nem ad csillagot, csak „hibás” jelölést | opcionális 1–5, ha a pilot után kell a minőségérzet |
| Nincs megőrzési törlőjob | 90 nap után a `question` mező törlése / hash, a metrikák maradnak — lásd kérdéslap |

A go-live kapu (rollout dia): **4 hét pilot, ≥70% auto ÉS should_have_auto < 10% ÉS wrong_auto < 5%** a mintavételezett auto-ágon. Ha bármelyik elhasal, nem skálázunk, hanem a korpuszt / küszöböt / promptot javítjuk.
