// Regenerate src/lib/hc/adaptive-program-media.ts from the exercise library.
//
// adaptive-program.ts names a library row per variant (`lib: "Incline
// Push-Up"`). If that name is not in the generated map the exercise renders
// with no picture at all, silently — which is how eight home variants ended
// up imageless after they were added. This reads the names straight out of
// the source, resolves each against `exercises`, and fails loudly on any it
// cannot find.
//
//   node --env-file=.env.local scripts/hc-gen-program-media.mjs
//
// Deterministic: same library, same file.

import { readFileSync, writeFileSync } from "node:fs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY vantar."); process.exit(1); }

const SRC = "src/lib/hc/adaptive-program.ts";
const OUT = "src/lib/hc/adaptive-program-media.ts";

const names = [...new Set([...readFileSync(SRC, "utf8").matchAll(/lib: "([^"]+)"/g)].map((m) => m[1]))].sort();
const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const q = new URLSearchParams({ select: "id,name,illustration_url,video_url,primary_muscles,equipment" });
q.set("name", `in.(${names.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",")})`);
const rows = await (await fetch(`${URL}/rest/v1/exercises?${q}`, { headers: h })).json();

const byName = new Map(rows.map((r) => [r.name, r]));
const missing = names.filter((n) => !byName.has(n));
if (missing.length) {
  console.error(`\n${missing.length} nöfn fundust ekki í safninu — þau myndu birtast án myndar:`);
  for (const m of missing) console.error("   ", m);
  process.exit(1);
}

const out = {};
for (const n of names) {
  const r = byName.get(n);
  out[n] = {
    id: r.id,
    image: r.illustration_url ?? null,
    video: r.video_url ?? null,
    muscles: r.primary_muscles ?? [],
    equipment: r.equipment ?? null,
  };
}

writeFileSync(OUT, `// Generated from the exercise library (\`exercises\`) for adaptive-program.ts:
// library name → id, illustration, video, muscles, equipment.
//
// Do not edit by hand. Regenerate with:
//   node --env-file=.env.local scripts/hc-gen-program-media.mjs
// It reads the \`lib:\` names out of adaptive-program.ts and fails if any of
// them is missing from the library, so a variant can never silently lose its
// picture again.

export interface ProgramMedia { id: string; image: string | null; video: string | null; muscles: string[]; equipment: string | null }

export const PROGRAM_MEDIA: Record<string, ProgramMedia> = ${JSON.stringify(out, null, 2)};
`, "utf8");

const withImg = names.filter((n) => out[n].image).length;
const withVid = names.filter((n) => out[n].video).length;
console.log(`${names.length} æfingar · ${withImg} með mynd · ${withVid} með myndband`);
