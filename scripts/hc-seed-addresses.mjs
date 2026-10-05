// What each action is actually aimed at.
//
// The pillar alone was too coarse: it made every sleep action look equally
// relevant to a bad sleep score. This maps each library action to the
// hc_knowledge slugs it is meant to move, so src/lib/hc/fit.ts can tell a
// participant which action targets THEIR worst number.
//
// Lifestyle levers only. A mapping is a claim that the action tends to move
// that marker, not that it treats a condition.
//
//   node --env-file=.env.local scripts/hc-seed-addresses.mjs
//
// Idempotent: patches `addresses` on existing rows, creates nothing.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY vantar."); process.exit(1); }

/** action key: hc_knowledge slugs it is meant to improve */
const M = {
  // ── Svefn ─────────────────────────────────────────────────────────────
  "svefn-fastur-timi": ["skor-svefn-venjur", "svefnlengd"],
  "svefn-lengd": ["svefnlengd", "skor-svefn-venjur", "skor-svefn-vandamal"],
  "svefn-dagsljos": ["skor-svefn-venjur", "svefnlengd"],
  "svefn-koffin": ["koffin", "skor-koffin", "skor-svefn-venjur"],
  "svefn-afengi": ["skor-afengi", "skor-svefn-venjur", "audit-c"],
  "svefn-skjalaust": ["skor-skjanotkun", "skor-svefn-venjur"],
  "svefn-birta": ["skor-svefn-venjur"],
  "svefn-hitastig": ["skor-svefn-venjur"],
  "svefn-loftgaedi": ["skor-svefn-venjur"],
  "svefn-kvoldmatur": ["skor-svefn-venjur", "skor-matarhegdun"],
  "svefn-slokun": ["skor-svefn-venjur", "skor-streita"],
  "svefn-dagbok": ["skor-svefn-vandamal", "skor-svefn-venjur"],
  "svefn-kaefisvefn": ["skor-svefn-vandamal", "bmi"],

  // ── Hreyfing ──────────────────────────────────────────────────────────
  "hreyfing-ganga": ["skor-hreyfing-venjur", "hreyfing-vikuskammtur"],
  "hreyfing-ganga-eftir-mat": ["fastandi-blodsykur", "hba1c", "skor-hreyfing-venjur"],
  "hreyfing-zone2": ["vo2max", "hjartaheilsa", "hreyfing-vikuskammtur", "efnaskiptaheilsa", "fitumassi"],
  "hreyfing-vo2max": ["vo2max", "hjartaheilsa", "efnaskiptaheilsa"],
  "hreyfing-styrkur": ["styrktarthjalfun", "vodvamassi", "homa-ir", "insulin", "fitumassi"],
  "hreyfing-grip": ["styrktarthjalfun", "vodvamassi"],
  "hreyfing-stodugleiki": ["skor-hreyfing-venjur"],
  "hreyfing-kyrrseta": ["skor-hreyfing-venjur", "fastandi-blodsykur"],
  "hreyfing-skref": ["hreyfing-vikuskammtur", "skor-hreyfing-venjur"],
  "hreyfing-throskun": ["skor-hreyfing-vandamal"],
  "hreyfing-erfid-thol": ["vo2max", "hjartaheilsa"],
  "hreyfing-almenn": ["skor-hreyfing-venjur", "hreyfing-vikuskammtur"],
  "hreyfing-thol": ["vo2max", "hjartaheilsa", "hreyfing-vikuskammtur", "hdl"],

  // ── Næring ────────────────────────────────────────────────────────────
  "naering-protein": ["protein", "vodvamassi"],
  "naering-trefjar": ["trefjar", "heildarkolesterol", "ldl", "hba1c", "skor-naering-vandamal"],
  "naering-diskur": ["skor-naering-venjur", "bmi", "thyngd", "fitumassi"],
  "naering-sykradir-drykkir": ["fastandi-blodsykur", "thriglyserid", "hba1c", "thyngd"],
  "naering-unnin": ["skor-naering-venjur", "hscrp", "ldl", "skor-naering-vandamal"],
  "naering-afengi": ["skor-afengi", "audit-c", "audit-10", "thriglyserid", "alt", "ggt"],
  "naering-fiskur": ["thriglyserid", "hdl", "hjartaheilsa", "skor-naering-vandamal"],
  "naering-olifuolia": ["heildarkolesterol", "ldl", "hdl", "apo-b", "skor-naering-vandamal"],
  "naering-salt": ["blodthrystingur", "blodthrystingur-nedri", "skor-naering-vandamal"],
  "naering-timabil": ["fastandi-blodsykur", "insulin", "homa-ir"],
  "naering-skipulag": ["skor-naering-venjur", "skor-matarhegdun"],
  "naering-skammtar": ["skor-matarhegdun", "thyngd", "bmi", "fitumassi"],
  "naering-d-vitamin": ["d-vitamin", "skor-naering-vandamal"],
  "naering-protein-morgunmatur": ["protein", "skor-matarhegdun"],
  "naering-plontufaedi": ["trefjar", "heildarkolesterol", "skor-naering-venjur"],
  "naering-vokvi": ["skor-naering-venjur"],
  "naering-vidbaettur-sykur": ["fastandi-blodsykur", "hba1c", "thriglyserid", "skor-naering-venjur"],
  "naering-fraeoliur": ["skor-naering-venjur"],
  "naering-snarl-kvold": ["skor-matarhegdun", "thyngd"],
  "naering-borda-undir-alagi": ["skor-matarhegdun", "skor-streita"],
  "naering-magn": ["skor-matarhegdun", "thyngd", "bmi", "fitumassi"],
  "naering-kreatin": ["vodvamassi", "styrktarthjalfun"],

  // ── Andleg líðan ──────────────────────────────────────────────────────
  "andlegt-ondun": ["skor-streita", "skor-andleg-heilsa"],
  "andlegt-utivera": ["skor-vellidan", "skor-andleg-heilsa", "d-vitamin"],
  "andlegt-tengsl": ["skor-vellidan", "skor-andleg-heilsa"],
  "andlegt-mork": ["skor-streita", "skor-vellidan"],
  "andlegt-thakklaeti": ["skor-vellidan", "skor-andleg-heilsa"],
  "andlegt-hugleidsla": ["skor-streita", "skor-andleg-heilsa"],
  "andlegt-skjar": ["skor-skjanotkun", "skor-streita"],
  "andlegt-nikotin": ["skor-nikotin", "hjartaheilsa", "hdl"],
  "andlegt-fagleg": ["skor-andleg-heilsa", "phq-9", "gad-7", "skor-fjarhaettuspil", "skor-onnur-efni"],
};

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const known = new Set(
  (await (await fetch(`${URL}/rest/v1/hc_knowledge?select=slug&active=eq.true`, { headers: h })).json()).map((r) => r.slug));
const actions = await (await fetch(`${URL}/rest/v1/hc_plan_modules?select=key&active=eq.true`, { headers: h })).json();
const live = new Set(actions.map((r) => r.key));

let bad = 0;
for (const [key, slugs] of Object.entries(M)) {
  if (!live.has(key)) { console.warn(`  ? engin aðgerð: ${key}`); bad++; continue; }
  const missing = slugs.filter((s) => !known.has(s));
  if (missing.length) { console.warn(`  ? ${key}: óþekkt slug ${missing.join(", ")}`); bad++; }
}
for (const key of live) if (!M[key]) console.warn(`  ! ekkert kort fyrir ${key}`);

let n = 0;
for (const [key, slugs] of Object.entries(M)) {
  if (!live.has(key)) continue;
  const r = await fetch(`${URL}/rest/v1/hc_plan_modules?key=eq.${encodeURIComponent(key)}`, {
    method: "PATCH", headers: { ...h, Prefer: "return=minimal" },
    body: JSON.stringify({ addresses: slugs.filter((s) => known.has(s)) }),
  });
  if (!r.ok) { console.error(`  x ${key}: ${r.status} ${await r.text()}`); continue; }
  n++;
}
console.log(`${n} aðgerðir kortlagðar${bad ? `, ${bad} með athugasemd` : ""}.`);
