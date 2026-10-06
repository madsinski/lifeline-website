// The pure half of the meal-picture pipeline: what a dish is, the fingerprint
// that says whether its picture is still the right one, and the card we draw
// when there is no photograph. No network, no side effects — so the generator
// script, a test and a preview can all import it.

import { createHash } from "node:crypto";

/**
 * What the dish IS, decided from its name before its ingredients.
 *
 * Order matters and the name comes first on purpose. Matching ingredients
 * first put the chicken curry under "chicken tray" (its ingredient list says
 * kjúklingabringur) and put "Afgangur frá kvöldmatnum" under "salad" because
 * the instructions mention salad. The name is what the dish is; the
 * ingredients are only a fallback for the ones whose names say little.
 */
const ARCHETYPES = [
  ["leftovers",       /afgangur|leftover/i,                                  { glyph: "box",    hue: 150 }],
  ["canteen",         /mötuneyti|canteen/i,                                  { glyph: "tray",   hue: 200 }],
  ["shake",           /hristing|þeyting|shake|smoothie/i,                    { glyph: "glass",  hue: 280 }],
  ["chia-pudding",    /chiabúðing|chia/i,                                    { glyph: "jar",    hue: 260 }],
  ["skyr-bowl",       /skyrskál|skyr /i,                                     { glyph: "bowl",   hue: 330 }],
  ["porridge",        /hafragraut|grautur|porridge|oatmeal/i,                { glyph: "bowl",   hue: 30 }],
  ["granola-yoghurt", /jógúrt|yoghurt|granóla|berjaskál|orkuskál/i,          { glyph: "bowl",   hue: 320 }],
  ["cottage-cheese",  /kotasæl|cottage/i,                                    { glyph: "bowl",   hue: 50 }],
  ["omelette",        /eggjakaka|eggjahræra|hrærð egg|omelette|scrambled/i,  { glyph: "egg",    hue: 45 }],
  ["boiled-eggs",     /harðsoðin egg|linsoðin egg|boiled egg/i,              { glyph: "egg",    hue: 40 }],
  ["curry",           /karrí|curry/i,                                        { glyph: "pot",    hue: 25 }],
  ["soup",            /súpa|soup|chili/i,                                    { glyph: "pot",    hue: 15 }],
  ["lamb",            /lamb/i,                                               { glyph: "chop",   hue: 0 }],
  ["salmon",          /lax|laxa|silung|salmon|trout/i,                       { glyph: "fish",   hue: 10 }],
  ["cod",             /þorsk|ýsa|cod|haddock/i,                              { glyph: "fish",   hue: 190 }],
  ["tuna",            /túnfisk|tuna/i,                                       { glyph: "fish",   hue: 210 }],
  ["beef-mince",      /hakk|mince|bollur|bolognese|meatball/i,               { glyph: "plate",  hue: 5 }],
  ["beef-steak",      /nautasteik|nautakjöt|beef|steak/i,                    { glyph: "chop",   hue: 350 }],
  ["chicken-tray",    /kjúklingabringa|kjúklingalæri|kjúklingafajitas|ofnbakaður kjúkling|ofnplötu/i, { glyph: "tray", hue: 35 }],
  ["sandwich",        /samloka|vefja|beygla|sandwich|wrap|brauði með/i,      { glyph: "bread",  hue: 40 }],
  ["rye-bread",       /rúgbrauð|hrökkbrauð|crispbread|á \S+ brauði|ristuðu brauði|avókadóbrauð|á brauði/i, { glyph: "bread", hue: 30 }],
  ["pasta",           /pasta|spaghetti|núðl/i,                               { glyph: "plate",  hue: 20 }],
  ["salad",           /salat|salad/i,                                        { glyph: "leaf",   hue: 120 }],
  ["edamame",        /edamame/i,                                            { glyph: "bowl",   hue: 95 }],
  ["legumes",         /linsubaun|kjúklingabaun|baun|tófú|falafel|lentil|tofu/i, { glyph: "bowl", hue: 100 }],
  ["chicken",         /kjúkling|kalkún|chicken|turkey/i,                     { glyph: "plate",  hue: 38 }],
  ["rice-bowl",       /hrísgrjón|kínóa|quinoa|rice|skál|bowl/i,              { glyph: "bowl",   hue: 90 }],
  ["nuts-fruit",      /hnetu|möndl|ávaxta|epli|apple|nut|ber\b/i,            { glyph: "leaf",   hue: 300 }],
  ["vegetables",      /grænmeti|gulrætur|hummus|paprik|gúrk|vegetable/i,     { glyph: "leaf",   hue: 110 }],
  ["fish-other",      /fisk|fish/i,                                          { glyph: "fish",   hue: 195 }],
  ["eggs",            /egg/i,                                                { glyph: "egg",    hue: 45 }],
];

export function archetypeOf(m) {
  const name = `${m.name_is ?? ""} ${m.name ?? ""}`;
  for (const [key, re, art] of ARCHETYPES) if (re.test(name)) return { key, ...art };
  const ing = (m.ingredients_is ?? []).concat(m.ingredients ?? []).join(" ");
  for (const [key, re, art] of ARCHETYPES) if (re.test(ing)) return { key, ...art };
  return null;
}

/** The fingerprint. Change the recipe, change this, and --check notices. */
export const fingerprint = (m) =>
  createHash("sha256")
    .update(`${m.name_is ?? m.name ?? ""}|${(m.ingredients_is ?? m.ingredients ?? []).join("|")}`)
    .digest("hex").slice(0, 16);

const GLYPHS = {
  bowl:  "M14 46 h72 a36 36 0 0 1 -72 0 z M10 44 h80",
  plate: "M50 20 a30 30 0 1 0 0.1 0 z M30 50 h40 M38 42 q12 -8 24 0 M38 58 q12 8 24 0",
  pot:   "M18 32 h64 v26 a14 14 0 0 1 -14 14 h-36 a14 14 0 0 1 -14 -14 z M12 32 h76 M34 24 v8 M66 24 v8",
  tray:  "M12 28 h76 a6 6 0 0 1 6 6 v30 a6 6 0 0 1 -6 6 h-76 a6 6 0 0 1 -6 -6 v-30 a6 6 0 0 1 6 -6 z M50 28 v42 M6 50 h88",
  fish:  "M20 48 c14 -18 42 -18 56 0 c-14 18 -42 18 -56 0 z M76 48 l14 -11 v22 z M34 44 a2.5 2.5 0 1 0 0.1 0 z",
  egg:   "M50 20 c14 0 24 16 24 30 a24 24 0 0 1 -48 0 c0 -14 10 -30 24 -30 z",
  chop:  "M30 38 c6 -12 34 -14 42 -2 c7 10 3 26 -10 31 c-9 3 -17 3 -26 0 c-11 -4 -13 -18 -6 -29 z M72 36 c6 -6 14 -4 14 3 c0 6 -7 9 -12 6",
  bread: "M16 38 c0 -8 8 -12 34 -12 s34 4 34 12 v22 a6 6 0 0 1 -6 6 h-56 a6 6 0 0 1 -6 -6 z M16 46 h68",
  leaf:  "M50 18 c22 10 26 34 10 48 c-16 -4 -24 -22 -10 -48 z M50 18 c-22 10 -26 34 -10 48 M50 24 v44",
  glass: "M32 22 h36 l-5 48 a8 8 0 0 1 -8 7 h-10 a8 8 0 0 1 -8 -7 z M34 40 h32",
  jar:   "M34 22 h32 v6 h-32 z M32 28 h36 v38 a7 7 0 0 1 -7 7 h-22 a7 7 0 0 1 -7 -7 z M34 46 q16 -7 32 0 M34 56 q16 -7 32 0",
  box:   "M18 36 h64 v30 a5 5 0 0 1 -5 5 h-54 a5 5 0 0 1 -5 -5 z M14 28 h72 v8 h-72 z M38 20 h24 v8 h-24 z",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Two lines, broken on a space, so a long Icelandic name still fits. */
function wrap(name, max = 26) {
  const words = name.split(" ");
  const lines = [""];
  for (const w of words) {
    if ((lines[lines.length - 1] + " " + w).trim().length <= max) lines[lines.length - 1] = (lines[lines.length - 1] + " " + w).trim();
    else lines.push(w);
  }
  return lines.slice(0, 2).map((l, i) => (i === 1 && lines.length > 2 ? l + "…" : l));
}

export function card(m, art) {
  const [l1, l2] = wrap(m.name_is ?? m.name ?? "");
  const h = art.hue;
  const gid = `g${fingerprint(m)}`;
  const mins = (m.prep_time_min ?? 0) + (m.cook_time_min ?? 0);
  const foot = [m.protein != null ? `${m.protein} g prótein` : null, mins ? `${mins} mín.` : null].filter(Boolean).join("  ·  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360" role="img" aria-label="${esc(m.name_is ?? m.name)}">
 <defs>
  <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="hsl(${h} 62% 94%)"/>
   <stop offset="1" stop-color="hsl(${(h + 24) % 360} 54% 86%)"/>
  </linearGradient>
 </defs>
 <rect width="640" height="360" fill="url(#${gid})"/>
 <g transform="translate(320 128) scale(1.55) translate(-50 -45)" fill="none"
    stroke="hsl(${h} 46% 34%)" stroke-opacity="0.5" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="${GLYPHS[art.glyph] ?? GLYPHS.plate}"/>
 </g>
 <text x="320" y="268" text-anchor="middle" font-family="Nunito Sans, Segoe UI, system-ui, sans-serif"
       font-size="34" font-weight="700" fill="hsl(${h} 42% 22%)">${esc(l1)}</text>
 ${l2 ? `<text x="320" y="306" text-anchor="middle" font-family="Nunito Sans, Segoe UI, system-ui, sans-serif"
       font-size="34" font-weight="700" fill="hsl(${h} 42% 22%)">${esc(l2)}</text>` : ""}
 ${foot ? `<text x="320" y="${l2 ? 338 : 300}" text-anchor="middle" font-family="Nunito Sans, Segoe UI, system-ui, sans-serif"
       font-size="19" font-weight="600" fill="hsl(${h} 30% 38%)">${esc(foot)}</text>` : ""}
</svg>`;
}

/**
 * A dish picture: a real photograph of that kind of food with this dish's own
 * name across the bottom.
 *
 * The photograph alone would mean five salmon dinners sharing one image,
 * which is most of what was wrong before. The name makes each one this dish's
 * picture while the photograph keeps it honest about the food. The image is
 * embedded rather than linked because an <img>-loaded SVG will not fetch an
 * external resource, and because we re-host rather than hot-link Commons.
 */
export function photoCard(m, art, jpegBase64, credit) {
  const [l1, l2] = wrap(m.name_is ?? m.name ?? "", 26);
  // Nunito Bold runs about 0.56 em per character; 568 px is the usable width.
  const longest = Math.max(l1?.length ?? 0, l2?.length ?? 0);
  const size = Math.max(23, Math.min(34, Math.floor(568 / (longest * 0.56))));
  const gid = `s${fingerprint(m)}`;
  const mins = (m.prep_time_min ?? 0) + (m.cook_time_min ?? 0);
  const foot = [m.protein != null ? `${m.protein} g prótein` : null, mins ? `${mins} mín.` : null].filter(Boolean).join("  ·  ");
  const top = l2 ? 360 - 148 - size : 360 - 114 - size;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 640 360" width="640" height="360" role="img" aria-label="${esc(m.name_is ?? m.name)}">
 <defs>
  <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="hsl(${art.hue} 30% 8%)" stop-opacity="0"/>
   <stop offset="0.45" stop-color="hsl(${art.hue} 30% 8%)" stop-opacity="0.55"/>
   <stop offset="1" stop-color="hsl(${art.hue} 30% 8%)" stop-opacity="0.88"/>
  </linearGradient>
 </defs>
 <image href="data:image/jpeg;base64,${jpegBase64}" xlink:href="data:image/jpeg;base64,${jpegBase64}"
        x="0" y="0" width="640" height="360" preserveAspectRatio="xMidYMid slice"/>
 <rect x="0" y="150" width="640" height="210" fill="url(#${gid})"/>
 <text x="36" y="${top}" font-family="Nunito Sans, Segoe UI, system-ui, sans-serif" font-size="${size}" font-weight="700" fill="#ffffff">${esc(l1)}</text>
 ${l2 ? `<text x="36" y="${top + size + 6}" font-family="Nunito Sans, Segoe UI, system-ui, sans-serif" font-size="${size}" font-weight="700" fill="#ffffff">${esc(l2)}</text>` : ""}
 ${foot ? `<text x="36" y="${l2 ? top + 2 * size + 34 : top + size + 30}" font-family="Nunito Sans, Segoe UI, system-ui, sans-serif" font-size="19" font-weight="600" fill="#ffffff" fill-opacity="0.85">${esc(foot)}</text>` : ""}
 ${credit ? `<text x="620" y="346" text-anchor="end" font-family="Segoe UI, system-ui, sans-serif" font-size="11" fill="#ffffff" fill-opacity="0.6">${esc(credit)}</text>` : ""}
</svg>`;
}
