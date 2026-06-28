# SVG Botanical Illustrations — Redesign & Expansion

**Date:** 2026-06-28  
**Branch:** feat/grupo-b-deploy-onboarding  
**Scope:** `templates/svg/botanical/`

---

## Context

Foodpedia displays inline SVG illustrations per recipe, keyed via `recipe.illustration_key` and included as `botanical_<key>.svg`. The original 7 SVGs were minimalist line art — functional but visually sparse for the book's visual identity ("19th-century culinary encyclopedia").

One key (`glass`) was already referenced in `base_recipes.json` but had no corresponding file — a broken illustration.

---

## Design Language (unchanged)

- `viewBox="0 0 80 120"` — portrait orientation for recipe card column
- `fill="none"`, `stroke="var(--c-gold)"`, `stroke-width="0.8"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
- Style: vintage botanical/culinary engraving — stroke only, no fill, layered detail lines
- Technique: outer silhouette → secondary structure → interior texture/depth → small accents

---

## Changes

### Redesigned (7)

| Key | What changed |
|-----|-------------|
| `bowl` | Added steam wisps, decorative collar, double rim, foot ring, interior depth + highlight lines, exterior body lines |
| `citrus` | Replaced diagram-style cross-section with proper segments + pip, peel texture arcs, leaf + stem at top |
| `grain` | Full wheat stalk: alternating grain pairs with awns at 8 levels, lower stalk leaves, apex grain head |
| `herbs` | Three-sprig bouquet: broad-leaf, rosemary-needle, and compound styles; tied with twine and tails |
| `mortar` | Stone mortar with double rim and foot, pestle angled out, herbs + powder dots inside, stone texture |
| `spice` | Star anise (8 arms, 8 seed pods, center hub) + cinnamon stick with bark scroll lines |
| `vanilla` | 5-petal orchid flower + vine leaf + split pod with bean seeds, tendril accent |

### New (7)

| Key | Description |
|-----|-------------|
| `glass` | Wine glass — double rim, bowl sides, liquid level line, stem, double base, botanical leaf + tendril, bubbles |
| `garlic` | Bulb with outer + inner skin, 3 clove segments, papery texture lines, root tendrils + hair tips, leaf |
| `pepper` | Chili with vine at top, calyx, curved body, seed cross-section hints, surface highlight lines, side leaf |
| `mushroom` | Cap dome, gills (underside + radial), umbo bump, stem with annulus ring + base foot, grass at ground |
| `leaf` | Large bay leaf with central + side veins + secondary veins, small branch with two flanking leaves |
| `fish` | Full fish (facing right): body, forked tail, dorsal + pectoral + ventral fins, gill line, eye, 6-row scale pattern, water plants |
| `cutlery` | Fork (4 tines, bridge, shoulder, handle with decorative band) + knife (blade + bolster + riveted handle) side by side |

---

## Usage

All keys referenced in `base_recipes.json` and `base_recipes_en.json` via `illustration_key` field. The template resolves to `svg/botanical/botanical_<key>.svg`. New keys (`garlic`, `pepper`, `mushroom`, `leaf`, `fish`, `cutlery`) are available for future recipes.
