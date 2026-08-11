# Fjarlækningar — service icons (sourced)

Icons **sourced from open, permissively-licensed libraries** and recolored to the brand
blue `#2563EB`. Most come from **Health Icons** — a medical icon library purpose-built for
health services — so they share one designed style. Every icon is **trim-and-centered**
(uniform optical size, centered in its tile). The `.svg` originals keep `currentColor`, so
the whole set re-themes with one CSS `color:` (or `fill:`) value.

## Provenance & licenses
| Service | Icon | Source | License |
|---|---|---|---|
| Frjókornaofnæmi | `flower-pollen-outline` (flower emitting pollen) | Material Design Icons | Apache-2.0 |
| Frunsa | `mouth-outline` (lips) | Health Icons | MIT |
| Getnaðarvörn | `oral-contraception-pillsx21-outline` (blister pack) | Health Icons | MIT |
| Kvef, hósti eða hálsbólga | `coughing-outline` | Health Icons | MIT |
| Lyfjuendurnýjun | `medicine-bottle-outline` (prescription bottle) | Health Icons | MIT |
| Njálgur | `intestine-outline` | Health Icons | MIT |
| Ristill | **composite:** `arm-outline` + vesicle cluster | Health Icons + custom | MIT |
| Risvandamál | `penis-outline` | Health Icons | MIT |
| Þvagfæra- og leggangasýkingar | `bladder-outline` | Health Icons | MIT |

- **Health Icons** — https://healthicons.org — MIT (free for any use, attribution
  appreciated, not required).
- **Material Design Icons** — https://pictogrammers.com/library/mdi/ — Apache-2.0.

Fetched via the Iconify API (https://iconify.design), which redistributes both sets.

### Ristill (the one composite)
No open library has a shingles / skin-vesicle icon, so this one layers a **cluster of
vesicles** onto the sourced `healthicons:arm-outline` — a localized cluster on the forearm
(the way shingles presents along a dermatome), not spots scattered over a whole body. The
cluster is drawn in `finalize-sourced.mjs` → `ristillSvg()`; the arm is unmodified source.

## Files (per service)
- `svg/<slug>.svg` — original, `currentColor` (re-theme with CSS)
- `svg/<slug>.blue.svg` — brand-blue version
- `svg/<slug>.tile.svg` — centered icon on the pastel tile (embeds the centered PNG)
- `png/<slug>.png` — transparent blue glyph, 256×256, centered
- `png/<slug>.tile.png` — on pastel tile, 256×256 (drop-in for Medalia)

`contact-sheet.png` shows all nine in the card layout.

## Re-pull / re-theme
Edit icon IDs or `BLUE` in `finalize-sourced.mjs` and re-run `node finalize-sourced.mjs`
(requires `sharp`, resolved from the `lifeline-website` node_modules). `../candidates.png`
shows the alternatives that were considered for each service.
