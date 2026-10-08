// Does every recommendation Medalia prints map to something we can do?
//
// The plan is only a rendering of Medalia's clinical decision if every
// prioritised recommendation in the report lands somewhere deliberate: an
// action in the library, the referral lane, or a line we have decided is too
// general to act on. Anything else is a hole, and a hole is where the system
// starts quietly inventing clinical advice of its own.
//
// Exits non-zero on an unmapped recommendation or a mapped key that is not in
// the library, so a wording change in Medalia surfaces here rather than in
// somebody's plan.
//
// Run: node scripts/hc-check-recommendations.mjs

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const U = "https://cfnibfxzltxiriqxvvru.supabase.co";
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN_FILE = `${process.env.HOME}/.supabase/access-token`;
if (!K) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }

/** The map is TypeScript; run it through tsx rather than reimplementing it. */
function classifyAll(recs) {
  const dir = mkdtempSync(join(tmpdir(), "recmap-"));
  const f = join(dir, "run.mts");
  writeFileSync(f, `
    import { classifyRecommendation, MAPPED_KEYS } from "${process.cwd()}/src/lib/hc/recommendation-map";
    const recs = ${JSON.stringify(recs)};
    console.log(JSON.stringify({
      out: recs.map((r) => ({ ...r, cls: classifyRecommendation(r) })),
      keys: MAPPED_KEYS,
    }));
  `);
  try {
    return JSON.parse(execFileSync("npx", ["tsx", f], { encoding: "utf8", maxBuffer: 1 << 24, stdio: ["ignore", "pipe", "pipe"] }).trim());
  } catch (e) {
    // The bundled source in a tsx stack trace is thousands of lines; the last
    // line is the only part anyone needs.
    const err = String(e.stderr || e.message).trim().split("\n").filter(Boolean).pop();
    console.error(`recommendation-map.ts failed to load: ${err}`);
    process.exit(1);
  }
}

const sql = async (query) => {
  const token = execFileSync("cat", [TOKEN_FILE], { encoding: "utf8" }).trim();
  const r = await fetch("https://api.supabase.com/v1/projects/cfnibfxzltxiriqxvvru/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(JSON.stringify(j).slice(0, 300));
  return j;
};

const recs = await sql(`
  select distinct coalesce(nullif(trim(rec->>'component'),''),'') as component,
         trim(rec->>'text') as text, rec->>'priority' as priority
  from hc_reports h, jsonb_array_elements(public.decrypt_jsonb(h.payload_enc)->'items') i,
       jsonb_array_elements(coalesce(i->'recommendations','[]'::jsonb)) rec
  where rec->>'priority' in ('red','yellow')`);

const lib = await sql(`select key, pillar, title from hc_plan_modules where active`);
const libKeys = new Set(lib.map((m) => m.key));

const { out, keys } = classifyAll(recs);
const byKind = (k) => out.filter((x) => x.cls.kind === k);

console.log(`report recommendations (flagged): ${out.length}`);
console.log(`  → action   ${byKind("action").length}`);
console.log(`  → referral ${byKind("referral").length}`);
console.log(`  → generic  ${byKind("generic").length}`);
console.log(`  → UNMAPPED ${byKind("unmapped").length}`);

const deadKeys = keys.filter((k) => !libKeys.has(k));
if (deadKeys.length) console.log(`\nmapped to keys that are not in the library: ${deadKeys.join(", ")}`);

const unmapped = byKind("unmapped");
if (unmapped.length) {
  console.error("\nUnmapped recommendations — add them to recommendation-map.ts, or decide they are referrals:");
  for (const u of unmapped) console.error(`  [${u.priority}] ${u.component || "—"} :: ${u.text.slice(0, 80)}`);
}

if (unmapped.length || deadKeys.length) process.exit(1);
console.log("\nEvery flagged recommendation lands somewhere deliberate.");
