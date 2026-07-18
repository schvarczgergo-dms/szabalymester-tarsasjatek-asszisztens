# Korpusz — `seed/rules/`

A tudásbázis forrása: **hivatalos magyar szabálykönyvek** markdownná konvertált,
front matterrel ellátott dokumentumai. Az `ingest` (`pnpm ingest`) ezt a mappát olvassa.

## ⚠️ A jelenlegi tartalom MINTA (placeholder)

A `seed/rules/` alatti fájlok **jelölten nem-hiteles, parafrazált minták**, kizárólag a
pipeline (parse → chunk → embed → store → keresés) végponti kipróbálására (Story 1.7).
Ismertetőjel: a `source` mező `sample.invalid` hosztra mutat.

**Éles használat előtt cseréld le** őket a hivatalos magyar szabálykönyvekből (Gémklub /
kiadói oldal / BoardGameGeek *Files*) konvertált, valós tartalomra, valós `source`-URL-lel.
Kitalált szabály tilos — a válaszok hitelessége (grounding, AD-1) a korpusz hitelességén áll.

## Konvenció (AD-10: egy fájl = egy `(game, section)`)

- **Fájlnév:** `<jatek-slug>-<section>.md`, pl. `catan-jatekmenet.md`.
- **Egy fájl = egy játék egy szakasza.** A `section` a fájlé (nem a `##`-é); a markdown
  `##`/`###` alcímek csak a chunker breadcrumbjét adják.
- **`source` egyedi és stabil** — ez a hash-alapú inkrementális frissítés kulcsa (Story 1.6).

### Kanonikus `section` értékek

`attekintes` · `elokeszules` · `jatekmenet` · `pontozas` · `gyik`

### Front matter-sablon

```markdown
---
title: Catan – Játékmenet
game: Catan
source: https://example.invalid/sample/catan-jatekmenet
section: jatekmenet
---

## Egy szakasz alcíme

A szabály szövege…
```

## Validálás

A `src/ingest/corpus.spec.ts` minden `seed/rules/*.md`-t átfuttat a `parseDocument`-en
(valid front matter, kanonikus `section`, nem üres törzs, egyedi `source`). Futtatás:
`pnpm test`.
