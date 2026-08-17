# Kérdéslap — Gémasztal Szabálysegéd PoC

A válaszok a **jelenlegi PoC-ra** mutatnak (`src/customer/`, `customer_requests` /
`customer_tickets`, vendégfelület és `/operator`), nem általános AI-irányelvekre.

## 1. Milyen személyes adat kerül a rendszerbe, és melyik pontján tűnik el vagy anonimizálódik?

Fiók, név, e-mail, telefonszám **nincs** a PoC-ban: a vendég nem jelentkezik be. Ami bekerül, az a **kérdés szövege** (a vendég szabadszövege — ha véletlenül nevet vagy címet ír bele, az is a `customer_requests.question` mezőbe kerül), plusz technikai mezők: UUID, időbélyeg, retrieval-státusz, távolság, token, késleltetés. Az agent vázlata a jegy `draft_answer` mezőjében marad; a játékmester válasza az `operator_answer`. **Anonimizálás ma nincs:** a PoC a kérdést a jegy lezárásáig és utána is tárolja, mert a vendég az azonosítóval visszanézi, a mérés pedig a szöveget nem kéri, de a sor megmarad. Élesben a kérdéslap szerinti 90 napos törlés / hash kellene; a PoC ezt a jobot **nem** futtatja. Különleges kategóriájú adatot nem kérünk; a tudásbázis nyilvános CC BY-SA szöveg, nem ügyféladat.

## 2. Hol fut a modell, hova utazik az adat, és mi az, ami sosem hagyja el a saját környezetünket?

A PoC a `.env` szerint két üzemmódot ismer. **Lokális:** HyDE, embedding, rerank és válasz az Ollamán (`OPENAI_BASE_URL=http://localhost:11434/v1`) — a kérdés és a chunkok **ezen a gépen** maradnak, nincs felhő-régió. **Felhő:** HyDE és embedding az **OpenAI**-ra, rerank és válasz az **Anthropicra** (`docs/routing.md`). A PoC **nem pin-eli** a régiót (nincs EU-residency beállítás a `.env`-ben), ezért a felhő-hívás a provider alapértelmezett régiójába megy — **jellemzően US**. A **pgvector-korpusz, a kérésnapló és a jegyek** a saját Docker-Postgresben vannak (`127.0.0.1:5432`). **Sosem megy ki:** API-kulcs, a teljes korpusz (csak a retrieval top-K chunkjai), más vendégek kérdései, a játékmester neve és `operator_answer` a modellnek. A HTTP-szerver csak loopbacken hallgat.

## 3. Melyik lépésnél hagy jóvá ember, mit lát a döntés előtt, és mit tud visszavonni utána?

Egyetlen kapu van: ha a `searchRules` üres vagy hibás, **vagy** a válasz-modell dob (`askRules` kivétel: Ollama nem fut, kulcs lejárt), **vagy** a találat más játékról szól, mint a kérdés (`game_mismatch`), a folyamat **eszkalál**, és `customer_tickets.status = pending`. A játékmester a `/operator` asztalon látja a vendég kérdését, az okot (`empty_retrieval` / `retrieval_error` / `no_search` / `agent_error` / `game_mismatch`) és az agent vázlatát — **ezt a vázlatot a vendég nem kapja meg**. Jóváhagyáskor ő írja a vendégnek szánt szöveget; elutasításkor is kötelező indoklás, a vendég azt látja. **Visszavonás:** amíg pending, a jegy nem megy ki; approve/reject után a PoC **nem** vonja vissza a már kiadott választ (nincs „unsend”, nincs második szerkesztés). Az auto-ágon ember **nem** hagy jóvá — pont ez a 24/7 ígéret —, a vendég utólag a „Hibás volt a válasz” gombbal jelöl.

## 4. Mi kerül naplóba, ki fér hozzá, és mennyi ideig marad meg?

Napló: `customer_requests` (kérdés, út, retrieval-státusz, `min_distance`, agent-szöveg, források JSON, token, `latency_ms`, opcionális `feedback`) és `customer_tickets` (ok, vázlat, státusz, játékmester-válasz, `resolved_by`, `resolution_tag`). A modell felé menő tool-trace (`reports`) **nincs** külön audit-táblában, csak amíg a folyamat memóriában fut. Hozzáférés a PoC-ban: aki eléri a `127.0.0.1:3847/operator` címet — **nincs autentikáció**, ez demó-korlát. A vendégfelületen (`/`) **nincs** kapu-link; a cím a README-ből / demó-scriptből jön. Megőrzés: a PoC **nem töröl**; éles javaslat 90 nap a szabadszövegre, 13 hónap a számlálókra. A `/api/metrics` aggregátumot ad, nem a nyers kérdésszöveget.

## 5. Mi történik, ha az agent téved, és mennyi idő alatt állítható vissza az előző állapot?

Két tévedés van, mindkettőt méri a PoC. **Téves absztenció:** a keresés üres, pedig a korpuszban benne van — jegy nyílik, a játékmester `should_have_auto` taggel lezárja, a vendég az ő szövegét kapja; „visszaállítás” = a pending jegy még nem ment ki, a lezárt jegyhez a PoC nem nyúl. **Hibás auto-válasz:** a vendég már látta a szöveget; jelölheti `wrong_auto`-nak, de a PoC **nem írja felül** a kiment választ és nem rollbackeli a Postgres-sort. Kill switch: a `pnpm poc` folyamat leállítása; az agent kódja gitben, a korpusz hash-alapú ingesttel újraépíthető (`pnpm ingest --rebuild`). Modell-súlyokat nem tárolunk, tehát „előző modellállapot” = a `.env` modellneve és a git tag. Cél-idő élesben: pending jegy azonnal megállítható; kiment auto-válasz korrekciója emberi válaszként, nem adatbázis-rollbackként — ezt a PoC még nem automatizálja.

## 6. Ki lesz a rendszer gazdája a bevezetés után, és miből fogja látni, hogy jól működik?

Gazda: a **folyamatgazda** (Gémasztal: műszakvezető / vendégélmény), nem a fejlesztő. A go-live után a `/operator` asztal és a `GET /api/metrics` a napi kép: auto vs. eszkaláció, pending sor, `shouldHaveAuto`, `wrongAuto`, átlagos `latency_ms`. A heti/havi vezetői kép a [mérési terv](meresi-terv.md) táblája; a pilot kapuja onnan jön (≥70% auto, <10% téves absztenció, <5% hibás auto). A szponzor nem a gitet nézi, hanem ezt a három számot és a pending sort.

## Saját 1. Ha a keresés rossz játék chunkját hozza magabiztosan, miért nem eszkalál a rendszer?

Az emberi kapu **üres vagy hibás** retrievalnél nyílik, **és** akkor is, ha a chunk játékneve nincs a kérdésben (`decide-path.ts`: `game_mismatch` — pl. Catan-chunk Gloomhaven-kérdésre). Ha a vektor a Catan-kérdésre Carcassonne-t ad, a PoC **eszkalál**, nem auto-választ. Amit a PoC **nem** csinál: második modell a „jó játék-e ez a chunk”, sem kötelező emberi ránézés az auto-ágra, ha a játéknév egyezik. Ha a vezetőség ezt nem fogadja el, a pilotban minden auto-választ mintavételezni kell.

## Saját 2. A tudásbázis Wikipédia, nem hivatalos kiadói szabály — mit mondunk, ha a vendég „a Szabálysegéd szerint” hivatkozik egy vitában?

A korpusz szándékosan CC BY-SA Wikipédia/Wikibooks, nem Gémklub-PDF (`seed/README.md`). A vendégfelület és az auto-válasz szövege kimondja: **AI, nem hivatalos bírói döntés.** Ettől még a kávézóban elhangozhat, hogy „a gép ezt mondta”. A PoC nem hitelesít kiadói szabályt; „hivatalos bíróként” pozicionálni fogyasztóvédelmi kockázat. Válasz a kötekedőnek: a felület **közli, hogy AI-val beszél** (banner), a játékasztalnál az emberek döntnek, a vitatott élhelyzet a játékmesterhez eszkalálható. Amit nem ígérünk: versenyen kötelező értelmezés, kártérítés elrontott partiért, kiadói pecsét a chunkon.
