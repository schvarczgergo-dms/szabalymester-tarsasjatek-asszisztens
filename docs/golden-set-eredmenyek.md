# Golden set — eredmények (generált)

Modell: embedding=`nomic-embed-text`, HyDE=`qwen2.5:3b`, rerank/válasz=`qwen2.5:3b` (openai); korpusz-nyelv=en, relevancia-küszöb=0.45.

## Összegzés

- Pozitív gold a teljes pipeline top-5-ében: **4/8** (SM-1 cél: ≥7/8).
- Átrendezés (nyers vs. teljes top-1) esetek: **7** (SM-2 cél: ≥1).
- Negatív tesztek:
- neg-gloomhaven: ÜRES (absztenció — helyes)
- neg-catan-weight: ÜRES (absztenció — helyes)

## Kérdésenként (nyers vs. teljes)

### catan-7 — Catanban mi történik, ha 7-est dobok?

- **Gold:** Catan · jatekmenet — nyers rang: —, teljes rang: —, **gold a top-5-ben:** NEM
- **HyDE:** In Catanban, rolling a 7 triggers the "Seven of Steel" event, where pl
- **Nyers top-5:** 7 Wonders·jatekmenet (0.417); King of Tokyo·jatekmenet (0.432); 7 Wonders·attekintes (0.445); Ticket to Ride·jatekmenet (0.448); King of Tokyo·jatekmenet (0.449)
- **Teljes top-5:** Terra Mystica·jatekmenet (0.248); Small World·jatekmenet (0.247); Lost Ruins of Arnak·jatekmenet (0.246); King of Tokyo·jatekmenet (0.231); Carcassonne·jatekmenet (0.228)

### carcassonne-city — Carcassonne-ban hogyan pontozódik egy befejezetlen város a játék végén?

- **Gold:** Carcassonne · jatekmenet — nyers rang: —, teljes rang: 1, **gold a top-5-ben:** IGEN
- **HyDE:** In Carcassonne, there's no specific rule regarding a "completed city" 
- **Nyers top-5:** King of Tokyo·jatekmenet (0.452); Ark Nova·jatekmenet (0.467); Ticket to Ride·jatekmenet (0.475); Root·jatekmenet (0.476); Agricola·attekintes (0.477)
- **Teljes top-5:** Carcassonne·jatekmenet (0.293); Terraforming Mars·jatekmenet (0.305); Small World·jatekmenet (0.311); Carcassonne·jatekmenet (0.312); Carcassonne·jatekmenet (0.319)

### ttr-endgame — Ticket to Ride-ban mi váltja ki az utolsó fordulót?

- **Gold:** Ticket to Ride · jatekmenet — nyers rang: 2, teljes rang: —, **gold a top-5-ben:** NEM
- **HyDE:** In Ticket to Ride, each player's turn consists of playing cards or dra
- **Nyers top-5:** King of Tokyo·jatekmenet (0.456); Ticket to Ride·jatekmenet (0.463); Ticket to Ride·jatekmenet (0.463); Ticket to Ride·attekintes (0.473); Ticket to Ride·jatekmenet (0.478)
- **Teljes top-5:** Dominion·jatekmenet (0.177); Dominion·jatekmenet (0.216); Dominion·jatekmenet (0.222); Pandemic·jatekmenet (0.224); Lost Ruins of Arnak·jatekmenet (0.229)

### pandemic-lose — Pandemicben mikor veszítjük el a játékot?

- **Gold:** Pandemic · jatekmenet — nyers rang: —, teljes rang: —, **gold a top-5-ben:** NEM
- **HyDE:** A Pandemic játékot kapjuk végekent az utolsó játékosra, ahol mindig mi
- **Nyers top-5:** Carcassonne·jatekmenet (0.479); Scythe·jatekmenet (0.487); King of Tokyo·jatekmenet (0.495); Ticket to Ride·jatekmenet (0.498); Spirit Island·jatekmenet (0.506)
- **Teljes top-5:** (nincs)

### 7wonders-science — 7 Wondersben hogyan pontozódnak a tudomány (science) szimbólumok?

- **Gold:** 7 Wonders · jatekmenet — nyers rang: 1, teljes rang: 1, **gold a top-5-ben:** IGEN
- **HyDE:** A 7 Wonders játékosai egy együttesen választják ki egy vagy több Tudom
- **Nyers top-5:** 7 Wonders·jatekmenet (0.324); 7 Wonders·attekintes (0.358); 7 Wonders·jatekmenet (0.386); 7 Wonders·jatekmenet (0.399); 7 Wonders·jatekmenet (0.405)
- **Teljes top-5:** 7 Wonders·jatekmenet (0.449)

### azul-floor — Azulban mi történik, ha egy mintasorba nem fér több csempe?

- **Gold:** Azul · jatekmenet — nyers rang: —, teljes rang: 2, **gold a top-5-ben:** IGEN
- **HyDE:** In Azul, if more than one house receives a tile during the draw phase,
- **Nyers top-5:** Blood Rage·jatekmenet (0.482); King of Tokyo·jatekmenet (0.487); Scythe·jatekmenet (0.494); Spirit Island·jatekmenet (0.498); Codenames·attekintes (0.499)
- **Teljes top-5:** Carcassonne·jatekmenet (0.210); Azul·jatekmenet (0.219); Puerto Rico·jatekmenet (0.229); Carcassonne·jatekmenet (0.235); Carcassonne·jatekmenet (0.247)

### splendor-win — Splendorban hány presztízspont kell a győzelemhez?

- **Gold:** Splendor · jatekmenet — nyers rang: —, teljes rang: 1, **gold a top-5-ben:** IGEN
- **HyDE:** In Splendor, the winning player receives 15 prestige points as their f
- **Nyers top-5:** Ticket to Ride·jatekmenet (0.431); Ticket to Ride·jatekmenet (0.438); King of Tokyo·jatekmenet (0.453); Spirit Island·jatekmenet (0.465); Catan·attekintes (0.481)
- **Teljes top-5:** Splendor·jatekmenet (0.098); Puerto Rico·jatekmenet (0.264); Terraforming Mars·jatekmenet (0.205); Ark Nova·jatekmenet (0.223); Twilight Struggle·jatekmenet (0.233)

### kot-leave-tokyo — King of Tokyóból mikor és hogyan léphetek ki Tokióból?

- **Gold:** King of Tokyo · jatekmenet — nyers rang: 3, teljes rang: —, **gold a top-5-ben:** NEM
- **HyDE:** The King of Tokyo starts the game by drawing and playing cards from a 
- **Nyers top-5:** Carcassonne·jatekmenet (0.461); Ticket to Ride·jatekmenet (0.467); King of Tokyo·jatekmenet (0.473); Scythe·jatekmenet (0.477); King of Tokyo·jatekmenet (0.481)
- **Teljes top-5:** Ark Nova·jatekmenet (0.235); Dominion·attekintes (0.231); Pandemic·jatekmenet (0.176); Dominion·jatekmenet (0.177); Blood Rage·jatekmenet (0.183)

### neg-gloomhaven — Hogyan kell játszani a Gloomhavennel? (NEGATÍV)

- **Várt:** absztenció (nincs a korpuszban)
- **HyDE:** Játssza a Gloomhaven-jegyet tárgyalásban, melyben minden játékos részt
- **Teljes top-5:** (nincs) → ÜRES (absztenció — helyes)

### neg-catan-weight — Catanban hány kilogramm a doboz súlya pontosan 5 játékos esetén? (NEGATÍV)

- **Várt:** absztenció (nincs a korpuszban)
- **HyDE:** A Catanban 5 játékos esete során a dobókocka minimum 4, maximum 8 kilo
- **Teljes top-5:** (nincs) → ÜRES (absztenció — helyes)
