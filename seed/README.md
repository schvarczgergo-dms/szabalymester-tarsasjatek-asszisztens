# Korpusz — `seed/rules/`

A tudásbázis forrása: **jogtiszta, CC BY-SA 4.0 licencű** társasjáték-leírások, Markdownná
alakítva, front matterrel. Az `ingest` (`pnpm ingest`) ezt a mappát olvassa.

## Forrás és licenc

- **Angol nyelvű Wikipédia-cikkek** (~22 népszerű társasjáték, a golden-set 8 magjával + további
  címek a korpusz-mélységhez) és néhány **Wikibooks** klasszikus-játék szabály — a **szabály-releváns
  szakaszokra** szűrve (áttekintés + játékmenet; az előkészület/pontozás gyakran a játékmenet alá ágyazva).
- Licenc: **CC BY-SA 4.0** — minden fájl elején attribúció (cikk címe + URL + „Wikipedia/Wikibooks
  contributors" + licenc). A hivatalos, jogvédett kiadói szabálykönyveket NEM használjuk.
- A tartalom **nem hivatalos szabálykönyv**, hanem enciklopédikus, tényszerű leírás; a származékos
  változatok is CC BY-SA 4.0 alatt maradnak.
- **Méret (HF3 követelmény teljesül):** ~54 dokumentum, ~17 600 szó, több altémával.
- Kihagyva: **Gloomhaven** — szándékosan, mert a golden-set negatív tesztje („nincs a korpuszban").

## Nyelv

A korpusz **angol**, a rendszer válasza **magyar** (kereszt-nyelvű RAG; az embedding-modell
többnyelvű). A magyar Wikipédia e játékokhoz túl vékony/hiányos, ezért az angol a forrás.

## Konvenció (AD-10: egy fájl = egy `(game, section)`)

- **Fájlnév:** `<jatek-slug>-<section>.md`, pl. `catan-jatekmenet.md`.
- **Egy fájl = egy játék egy szakasza.** A `section` a fájlé; a markdown `##`/`###` alcímek a
  chunker breadcrumbját adják.
- **`source` egyedi** — a Wikipédia-cikk URL-je + `#<section>` horgony (ez a hash-alapú
  inkrementális frissítés kulcsa, Story 1.6).

### Kanonikus `section` értékek

`attekintes` · `elokeszules` · `jatekmenet` · `pontozas` · `gyik`

### Front matter (példa)

```markdown
---
title: Catan – Játékmenet
game: Catan
source: https://en.wikipedia.org/wiki/Catan#jatekmenet
section: jatekmenet
language: en
license: CC-BY-SA-4.0
license_url: https://creativecommons.org/licenses/by-sa/4.0/
source_type: wikipedia
retrieved: 2026-07-18
---
```

## Validálás

A `src/ingest/corpus.spec.ts` minden `seed/rules/*.md`-t átfuttat a `parseDocument`-en (valid
front matter, kanonikus `section`, nem üres törzs, egyedi `source`). Futtatás: `pnpm test`.

## Frissítés / bővítés

Új játék: vedd fel a CC BY-SA forrás szakaszait a fenti konvenció szerint, tartsd meg az
attribúciót, és futtass `pnpm ingest`-et (a változatlan dokumentumok kimaradnak).
