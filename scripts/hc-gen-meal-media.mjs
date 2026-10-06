// One picture per dish, and a way to know when it has gone stale.
//
// The problem this fixes: 110 meals shared 32 generic stock photos assigned
// by loose category. Four different breakfasts showed the same bowl of
// berries; cottage cheese with smoked salmon showed somebody else's fruit.
// A wrong picture is worse than none, because people cook what they see.
//
// What lasts here is not the images, it is the fingerprint. Every picture is
// stamped with a hash of the name and ingredients it was made for, so when a
// recipe changes the stamp stops matching and --check says so and exits
// non-zero. The image SOURCE is deliberately pluggable:
//
//   --check    report missing and stale pictures, exit 1 if any   (CI-able)
//   --cards    draw a clean card per dish, derived from the dish   (no key)
//   --photos   a real photograph of that kind of food, with this dish's
//              own name on it                                      (no key)
//
// --photos is the real one. The photographs are curated per archetype in
// scripts/meal-photos.json — chosen by eye from Wikimedia Commons, re-hosted
// in our own bucket rather than hot-linked, and credited. The dish's own name
// is composited across the bottom, because the photograph alone would mean
// five salmon dinners sharing one image, which is most of what was wrong
// before. Three archetypes have no usable photograph anywhere in the results
// (skyr bowl, chia pudding, leftovers); those keep the drawn card rather than
// take a picture of the wrong food.

const U = "https://cfnibfxzltxiriqxvvru.supabase.co";
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PHOTOS = JSON.parse(readFileSync(new URL("./meal-photos.json", import.meta.url), "utf8"));
const mode = process.argv.find((a) => ["--check", "--cards", "--photos"].includes(a)) ?? "--check";

if (!K) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }

import { archetypeOf, card, fingerprint, photoCard } from "./meal-media-lib.mjs";
import { readFileSync } from "node:fs";

const rest = async (path, init) => {
  const r = await fetch(`${U}/rest/v1/${path}`, { ...init, headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init?.headers ?? {}) } });
  const t = await r.text();
  if (r.status >= 400) throw new Error(`${r.status} ${path}: ${t.slice(0, 240)}`);
  return t ? JSON.parse(t) : null;
};

const upload = async (name, body, type) => {
  const r = await fetch(`${U}/storage/v1/object/meal-media/${name}`, {
    method: "POST", headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": type, "x-upsert": "true" }, body,
  });
  if (r.status >= 400) throw new Error(`upload ${name}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return `${U}/storage/v1/object/public/meal-media/${name}`;
};

const meals = await rest("meals?select=id,name,name_is,category,ingredients,ingredients_is,protein,prep_time_min,cook_time_min,illustration_url,illustration_key&retired=eq.false&or=(is_filler.is.null,is_filler.eq.false)");

const stale = [], missing = [], unmapped = [];
for (const m of meals) {
  if (!archetypeOf(m)) unmapped.push(m.name_is ?? m.name);
  const fp = fingerprint(m);
  if (!m.illustration_url || !m.illustration_key) missing.push(m);
  else if (m.illustration_key !== fp) stale.push(m);
}

console.log(`live meals: ${meals.length}`);
console.log(`  no picture or no fingerprint: ${missing.length}`);
console.log(`  recipe changed since the picture was made: ${stale.length}`);
console.log(`  no archetype rule: ${unmapped.length}${unmapped.length ? " ← " + unmapped.slice(0, 6).join(", ") : ""}`);

if (unmapped.length) {
  console.error("\nEvery dish must map to an archetype, or it gets a picture of nothing in particular.\nAdd a rule to ARCHETYPES.");
  process.exit(1);
}

if (mode === "--check") {
  const bad = missing.length + stale.length;
  if (bad) {
    console.error(`\n${bad} meals need a picture. Run with --cards (or --photos once OPENAI_API_KEY is set).`);
    for (const m of [...missing, ...stale].slice(0, 12)) console.error(`  · ${m.name_is ?? m.name}`);
    process.exit(1);
  }
  console.log("\nEvery live meal has a current picture.");
  process.exit(0);
}

/** Fetch each curated photograph once and keep it as base64. */
const jpeg = new Map();
async function photoFor(key) {
  if (!PHOTOS[key]) return null;
  if (!jpeg.has(key)) {
    const r = await fetch(PHOTOS[key].thumb, { headers: { "User-Agent": "lifeline-health/1.0 (madsinski@gmail.com)" } });
    if (r.status >= 400) throw new Error(`photo ${key}: ${r.status}`);
    jpeg.set(key, Buffer.from(await r.arrayBuffer()).toString("base64"));
  }
  return { b64: jpeg.get(key), credit: `${PHOTOS[key].artist || "Wikimedia Commons"} · ${PHOTOS[key].lic}` };
}

// A change of image source is not a change of recipe, so the fingerprints are
// all still valid and nothing would be regenerated. --force says: redo them.
const force = process.argv.includes("--force");
const todo = force ? meals : [...missing, ...stale];
let n = 0;
for (const m of todo) {
  const art = archetypeOf(m);
  const fp = fingerprint(m);
  let url, credit = null;
  const photo = mode === "--photos" ? await photoFor(art.key) : null;
  if (photo) {
    credit = photo.credit;
    url = await upload(`dish/${m.id}-${fp}.svg`, photoCard(m, art, photo.b64, credit), "image/svg+xml");
  } else {
    // Either --cards, or no photograph of this kind of food exists in the
    // results. A drawn card beats a picture of something else.
    url = await upload(`card/${m.id}-${fp}.svg`, card(m, art), "image/svg+xml");
  }
  await rest(`meals?id=eq.${m.id}`, { method: "PATCH", body: JSON.stringify({ illustration_url: url, illustration_key: fp, illustration_credit: credit }) });
  n++;
  if (n % 10 === 0) console.log(`  …${n}/${todo.length}`);
}
console.log(`\nwrote ${n} pictures (${mode.slice(2)})`);
