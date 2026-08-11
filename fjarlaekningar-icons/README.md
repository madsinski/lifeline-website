# Fjarlækningar — service icons (v2)

A considered, single-language icon set for the 9 telemedicine services in the
"Hvernig getum við aðstoðað þig?" menu (Medalia EHR). Replaces the previous mixed
clipart/emoji icons.

## The concept: a semantic two-tone system
Every icon uses **two colours with fixed meaning**:

- **Blue = the body / anatomy / object** (the lips, the bladder, the thermometer, the pill).
- **Rose = the symptom**, always placed exactly where the patient feels it — the sore on
  the lip, the fever in the bulb, the blister band on the skin, the burning at the urethra,
  the allergen in the air, today's pill in the pack.

So the set isn't just one visual style — it has a logic. You can read *where the problem is*
at a glance, which is the job of a service-selection menu.

## Style tokens
| Token | Hex | Use |
|---|---|---|
| Ink / line | `#2563EB` | brand blue — body & outlines |
| Soft blue fill | `#DBEAFE` | body fills |
| Signal line | `#F43F5E` | the symptom |
| Soft rose fill | `#FFE1E6` | symptom fills |
| Pastel tile | `#EFF4FF` | rounded tile bg, 16px radius |

48×48 grid · 2.2px rounded strokes · optically centred.

## Files (4 assets per service)
- `svg/<name>.svg` — transparent glyph (vector, recolour-friendly)
- `svg/<name>.tile.svg` — glyph on the pastel rounded tile
- `png/<name>.png` — transparent glyph, 256×256
- `png/<name>.tile.png` — glyph on pastel tile, 256×256 (drop-in for Medalia)

| Service (IS) | Condition | Icon | File |
|---|---|---|---|
| Frjókornaofnæmi | Seasonal / pollen allergy | flower + drifting allergen | `frjokornaofnaemi` |
| Frunsa | Cold sore (herpes labialis) | lips + blister | `frunsa` |
| Getnaðarvörn | Contraception | dial pack, today's pill marked | `getnadarvorn` |
| Kvef, hósti eða hálsbólga | Cold / cough / sore throat | thermometer (fever) + cough | `kvef-hosti-halsbolga` |
| Lyfjuendurnýjun | Prescription renewal | two-tone capsule + refresh | `lyfjuendurnyjun` |
| Njálgur | Pinworm | segmented worm | `njalgur` |
| Ristill | Shingles (herpes zoster) | skin swatch + blister band + nerve pain | `ristill` |
| Risvandamál | Erectile dysfunction | heart lifting upward (calm, discreet) | `risvandamal` |
| Þvagfæra- og leggangasýkingar | UTI / vaginal infection | bladder + infected drop + burning | `thvagfaera-leggangasykingar` |

`contact-sheet.png` shows all nine in the card layout. `contact-sheet-v1.png` is the
earlier monochrome-blue draft, kept for comparison.

## Re-theming
Edit the tokens at the top of `build-icons.mjs` and run `node build-icons.mjs` to
regenerate every SVG + PNG + the contact sheet. (E.g. swap `INK` to Lifeline emerald
`#10B981`, or change the signal hue.) Requires `sharp`, resolved from the
`lifeline-website` node_modules.
