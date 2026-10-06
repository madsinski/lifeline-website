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
//   --photos   generate a photograph per dish with OpenAI images   (needs key)
//
// --cards is the honest default and what ships today: a card carrying the
// dish's own name and a motif chosen from its own main ingredient is always
// correct and never pretends to be a photograph of the recipe. --photos is
// written and waiting; production OPENAI_API_KEY is empty, so it cannot run
// yet. Running it later replaces the cards one dish at a time and the
// fingerprints keep up.

const U = "https://cfnibfxzltxiriqxvvru.supabase.co";
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI = process.env.OPENAI_API_KEY;
const mode = process.argv.find((a) => ["--check", "--cards", "--photos"].includes(a)) ?? "--check";

if (!K) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }

import { archetypeOf, card, fingerprint } from "./meal-media-lib.mjs";

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

if (mode === "--photos" && !OPENAI) {
  console.error("\n--photos needs OPENAI_API_KEY. Production has it set to an empty string;\nask Mads for a key, then: OPENAI_API_KEY=sk-… node scripts/hc-gen-meal-media.mjs --photos");
  process.exit(1);
}

const todo = [...missing, ...stale];
let n = 0;
for (const m of todo) {
  const art = archetypeOf(m);
  const fp = fingerprint(m);
  let url;
  if (mode === "--cards") {
    url = await upload(`card/${m.id}-${fp}.svg`, card(m, art), "image/svg+xml");
  } else {
    const prompt = `A single plated portion of ${m.name}, photographed from above on a plain light surface, natural daylight, no text, no hands, no branding. It contains exactly: ${(m.ingredients ?? []).join(", ")}. Nordic home cooking, honest and unstyled.`;
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
    });
    if (r.status >= 400) throw new Error(`image ${m.name_is}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    url = await upload(`photo/${m.id}-${fp}.png`, Buffer.from(j.data[0].b64_json, "base64"), "image/png");
  }
  await rest(`meals?id=eq.${m.id}`, { method: "PATCH", body: JSON.stringify({ illustration_url: url, illustration_key: fp, illustration_credit: null }) });
  n++;
  if (n % 10 === 0) console.log(`  …${n}/${todo.length}`);
}
console.log(`\nwrote ${n} pictures (${mode.slice(2)})`);
