# HF5 (12. óra) ellenőrzés — findingok kivonata

Vizsgált anyag: `docs/ugyfel-poc/` (README, prezentacio.html, meresi-terv.md, kerdeslap.md)
+ `src/customer/` + `db/schema.sql` PoC-táblák. Referencia: `RobotDreams/12/ora12hw.md`.
Ez a fájl gitignore-olt (`.gitignore:32` → `.cursor/`), nem kerül a leadott repóba.

## Összkép

Megfelel. Mind a négy leadandó megvan, a repo zöld: `pnpm test` 200 pass (20 fájl, 1 skip),
`tsc --noEmit` és `eslint .` tiszta. A PoC a meglévő agentet hívja (`createAgent` → `askRules`
→ `searchRules`), nincs benne hardcode-olt demo-válasz.

Teljesített kikötések: egy folyamat + egy emberi kapu; élő modellhívás; a bizonytalan eset
emberhez megy; három fájdalom megoldva (1, 2, 9) és a maradék hét kimondva; 7 dia a kért
6–8-ból, mindhárom kötelező diával; mérési tábla létező adatforrásokra, két hibametrikával
(`should_have_auto`, `wrong_auto`); kérdéslap 6 + 2, kódhivatkozásokkal. A Gloomhaven
demo-kérdés tényleg eszkalál: a korpuszban csak a `seed/README.md` említi.

## Findingok prioritás szerint

### 1. Semmi nincs commitolva (blokkoló a leadáshoz)

`feat/ugyfel-poc` branchen a `src/customer/` és a `docs/ugyfel-poc/` untracked; a
`.env.example`, `README.md`, `db/schema.sql`, `package.json`, `eslint.config.mjs`
módosítás nincs stage-elve. A leadás repo link → a linkre kattintó a PoC-ból semmit nem lát.
Teendő: Conventional Commits szerinti commitok, push, majd a link ellenőrzése kilépve.

### 2. Az adattérkép egy adatmozgást kihagy

Google Fonts CDN a `src/customer/public/index.html:7-12`, `operator.html` és a
`docs/ugyfel-poc/prezentacio.html:7-12` fejlécében → a vendég böngészője IP-t és
user-agentet küld a Google felé. A 4. dia viszont azt állítja, hogy „a HTTP csak
127.0.0.1-en hallgat", és a táblázat teljességet ígér. Pont az IT-biztonsági vezető kérdése.
Teendő: vagy egy sor a dia táblájába (harmadik fél, betűtípus, nincs benne kérdésadat),
vagy rendszer-font stack — utóbbi demó-biztosabb is (offline gép).

Ugyanide tartozik kisebb súllyal: a forráslinkek (`customer.js` `target="_blank"`) kattintásra
a Wikipédiára navigálnak, `rel="noreferrer"` van, de a diáról ez is hiányzik.

### 3. A modell kiesése nem eszkalál, hanem 500-at ad

`decidePath` három oka (`empty_retrieval`, `retrieval_error`, `no_search`) mind a tool
szintjén dől el. Ha a válasz-modell hívása dob (`askRules` → `generateText`: Ollama nem fut,
API-kulcs lejárt), a kivétel a `poc-server.ts` catch-ébe fut → 500 + nyers hibaszöveg a
vendégnek, jegy nem nyílik. A doksi és a 3. dia viszont azt ígéri, hogy a bizonytalan eset
emberhez megy. A demón ez a legvalószínűbb bukási pont.
Teendő: try/catch a `handleCustomerQuestion`-ben, negyedik ok (`agent_error`) → jegy.
A `customer_tickets.reason` szabad szöveg, séma-migráció nem kell; csak a típus
(`decide-path.ts` `EscalateReason`) + a `reasonLabel` az `operator.js`-ben + egy teszt.

### 4. Az 5. dia „mért" 6/8-a szebb a valóságnál

`docs/golden-set.md:73-74` maga írja, hogy a 6/8 a legjobb helyi futás, és ugyanezzel a
`qwen2.5:3b` konfigurációval 4/8–6/8 között szórt; stabil csak a 2/2 absztenció és a ≥6
átrendezés. A dia „mért golden set"-ként hozza, szórás nélkül. A kötekedő ezt megtalálja, és
pont az anyag legerősebb tulajdonságát (őszinte számok) lövi le.
Teendő: „legjobb helyi futás, szórás 4/8–6/8; stabil: 2/2 absztenció".

## Apróbbak (a demót nem viszik el)

- `index.html:27` — a vendégoldal fejlécében link a `/operator`-ra, így a jelszó nélküli
  játékmester-asztal egy kattintásra van a vendégtől. A kérdéslap a jelszóhiányt kimondja,
  ezt a linket nem.
- `customer.js:106-109` — ismételt `wrong_auto` jelölésnél a szerver 409-et ad, a UI csendben
  visszaengedi a gombot, visszajelzés nélkül. A `getCustomerStatus` sem adja vissza a
  `feedback` állapotát, így újranyitás után újra jelölhetőnek tűnik.
- `customer-flow.ts:163` — elutasított jegynél a vendég szövege: „A játékmester nem tudott
  ebből a kérdésből ügyet nyitni" — fogalmazásban félrevisz.
- Nincs `poc-server.spec.ts`: a HTTP-réteg (route-ok, 400/404/409, feedback) teszt nélkül;
  a flow, a `decidePath` és a `ticket-store` tesztelt.
- `meresi-terv.md` válaszidő-sora „kérés beérkezése → agent válasz"-t ír, a `latencyMs`
  viszont a `customer-flow.ts:68-70` szerint csak az `ask` körüli idő (HTTP overhead nélkül).
  Korrekt közelítés, de a szó szerinti megfogalmazás pontosítható.
