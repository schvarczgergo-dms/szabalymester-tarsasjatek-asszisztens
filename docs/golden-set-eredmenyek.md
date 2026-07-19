# Golden set — eredmények (generált)

Modell: embedding=`nomic-embed-text`, HyDE=`qwen2.5:3b`, rerank/válasz=`qwen2.5:3b` (openai); korpusz-nyelv=en, relevancia-küszöb=0.45.

## Összegzés

- Pozitív gold a teljes pipeline top-5-ében: **6/8** (SM-1 cél: ≥7/8).
- Átrendezés (nyers vs. teljes top-1) esetek: **6** (SM-2 cél: ≥1).
- Negatív tesztek:
- neg-gloomhaven: ÜRES (absztenció — helyes)
- neg-catan-weight: ÜRES (absztenció — helyes)

## Kérdésenként (nyers vs. teljes)

### catan-7 — Catanban mi történik, ha 7-est dobok?

- **Gold:** Catan · jatekmenet — nyers rang: —, teljes rang: 2, **gold a top-5-ben:** IGEN
- **HyDE:** In Catanban™, rolling a seven triggers an Emergency Bananas action whe
- **Nyers top-5:** 7 Wonders·jatekmenet (0.417); King of Tokyo·jatekmenet (0.432); 7 Wonders·attekintes (0.445); Ticket to Ride·jatekmenet (0.448); King of Tokyo·jatekmenet (0.449)
- **Teljes top-5:** 7 Wonders·jatekmenet (0.202); Catan·jatekmenet (0.255); King of Tokyo·jatekmenet (0.255); Dominion·jatekmenet (0.259); Dominion·jatekmenet (0.266)

### carcassonne-city — Carcassonne-ban hogyan pontozódik egy befejezetlen város a játék végén?

- **Gold:** Carcassonne · jatekmenet — nyers rang: —, teljes rang: 1, **gold a top-5-ben:** IGEN
- **HyDE:** In Carcassonne, while players aim to complete their own villages and b
- **Nyers top-5:** King of Tokyo·jatekmenet (0.452); Ark Nova·jatekmenet (0.467); Ticket to Ride·jatekmenet (0.475); Root·jatekmenet (0.476); Agricola·attekintes (0.477)
- **Teljes top-5:** Carcassonne·jatekmenet (0.217); Puerto Rico·jatekmenet (0.232); Terraforming Mars·jatekmenet (0.266); Dominion·jatekmenet (0.269); Carcassonne·jatekmenet (0.269)

### ttr-endgame — Ticket to Ride-ban mi váltja ki az utolsó fordulót?

- **Gold:** Ticket to Ride · jatekmenet — nyers rang: 2, teljes rang: 2, **gold a top-5-ben:** IGEN
- **HyDE:** In Ticket to Ride, players cannot cancel a destination check that has 
- **Nyers top-5:** King of Tokyo·jatekmenet (0.456); Ticket to Ride·jatekmenet (0.463); Ticket to Ride·jatekmenet (0.463); Ticket to Ride·attekintes (0.473); Ticket to Ride·jatekmenet (0.478)
- **Teljes top-5:** Dominion·jatekmenet (0.258); Ticket to Ride·jatekmenet (0.282); Ticket to Ride·jatekmenet (0.284); Dominion·jatekmenet (0.240); Ticket to Ride·jatekmenet (0.277)

### pandemic-lose — Pandemicben mikor veszítjük el a játékot?

- **Gold:** Pandemic · jatekmenet — nyers rang: —, teljes rang: —, **gold a top-5-ben:** NEM
- **HyDE:** A Pokémon: The Cure vannak specifikus nyilvántartási sorrendjei, de ál
- **Nyers top-5:** Carcassonne·jatekmenet (0.479); Scythe·jatekmenet (0.487); King of Tokyo·jatekmenet (0.495); Ticket to Ride·jatekmenet (0.498); Spirit Island·jatekmenet (0.506)
- **Teljes top-5:** (nincs)

### 7wonders-science — 7 Wondersben hogyan pontozódnak a tudomány (science) szimbólumok?

- **Gold:** 7 Wonders · jatekmenet — nyers rang: 1, teljes rang: 1, **gold a top-5-ben:** IGEN
- **HyDE:** In 7 Wonders, each player accumulates points by developing their civil
- **Nyers top-5:** 7 Wonders·jatekmenet (0.324); 7 Wonders·attekintes (0.358); 7 Wonders·jatekmenet (0.386); 7 Wonders·jatekmenet (0.399); 7 Wonders·jatekmenet (0.405)
- **Teljes top-5:** 7 Wonders·jatekmenet (0.159); Terraforming Mars·jatekmenet (0.178); Ark Nova·jatekmenet (0.193); 7 Wonders·jatekmenet (0.194); Twilight Struggle·jatekmenet (0.196)

### azul-floor — Azulban mi történik, ha egy mintasorba nem fér több csempe?

- **Gold:** Azul · jatekmenet — nyers rang: —, teljes rang: 1, **gold a top-5-ben:** IGEN
- **HyDE:** In Azul, if a player attempts to place multiple blue tiles on the same
- **Nyers top-5:** Blood Rage·jatekmenet (0.482); King of Tokyo·jatekmenet (0.487); Scythe·jatekmenet (0.494); Spirit Island·jatekmenet (0.498); Codenames·attekintes (0.499)
- **Teljes top-5:** Azul·jatekmenet (0.182); Carcassonne·jatekmenet (0.214); Carcassonne·jatekmenet (0.231); Carcassonne·jatekmenet (0.232); Azul·attekintes (0.248)

### splendor-win — Splendorban hány presztízspont kell a győzelemhez?

- **Gold:** Splendor · jatekmenet — nyers rang: —, teljes rang: —, **gold a top-5-ben:** NEM
- **HyDE:** In Splendor, the winner receives 20 prestige points as their final sco
- **Nyers top-5:** Ticket to Ride·jatekmenet (0.431); Ticket to Ride·jatekmenet (0.438); King of Tokyo·jatekmenet (0.453); Spirit Island·jatekmenet (0.465); Catan·attekintes (0.481)
- **Teljes top-5:** Terraforming Mars·jatekmenet (0.184); Twilight Struggle·jatekmenet (0.227); Dominion·jatekmenet (0.255); Carcassonne·jatekmenet (0.265); Blood Rage·jatekmenet (0.281)

### kot-leave-tokyo — King of Tokyóból mikor és hogyan léphetek ki Tokióból?

- **Gold:** King of Tokyo · jatekmenet — nyers rang: 3, teljes rang: 2, **gold a top-5-ben:** IGEN
- **HyDE:** To escape from Tokyo, players must roll a sum of dice equal to or grea
- **Nyers top-5:** Carcassonne·jatekmenet (0.461); Ticket to Ride·jatekmenet (0.467); King of Tokyo·jatekmenet (0.473); Scythe·jatekmenet (0.477); King of Tokyo·jatekmenet (0.481)
- **Teljes top-5:** Small World·jatekmenet (0.255); King of Tokyo·jatekmenet (0.257); Catan·jatekmenet (0.276); Puerto Rico·jatekmenet (0.286); Small World·jatekmenet (0.287)

### neg-gloomhaven — Hogyan kell játszani a Gloomhavennel? (NEGATÍV)

- **Várt:** absztenció (nincs a korpuszban)
- **HyDE:** A Gloomhaven egy háttérjáték, ahol két játékos páliaszokat alakít anel
- **Teljes top-5:** (nincs) → ÜRES (absztenció — helyes)

### neg-catan-weight — Catanban hány kilogramm a doboz súlya pontosan 5 játékos esetén? (NEGATÍV)

- **Várt:** absztenció (nincs a korpuszban)
- **HyDE:** A Dóbszer baloldala 460 kilogramma kiviteletben volt a pályán lévő dol
- **Teljes top-5:** (nincs) → ÜRES (absztenció — helyes)
