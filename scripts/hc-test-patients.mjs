// Test patients for the heilsuferð / nurse workstation (/vinnustod).
//
//   node scripts/hc-test-patients.mjs            # create (or recreate) test patients
//   node scripts/hc-test-patients.mjs --clean    # remove every test patient
//
// Needs SUPABASE_SERVICE_ROLE_KEY in the environment (vercel env pull).
// Every test patient is an auth user on @prufa.lifelinehealth.is with
// user_metadata.hc_test = true and a name starting „Prufa“, so they are easy
// to spot and to remove. Kennitölur are checksum-valid but dated 1901, so they
// can never belong to a living person. Emails never leave (fake domain).

import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

// supabase-js builds a realtime client on construction; Node < 22 has no
// global WebSocket. This script never uses realtime, so a stub is enough.
globalThis.WebSocket ??= class {};

const url = process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const DOMAIN = "prufa.lifelinehealth.is";
const LOCATION_SLUG = process.env.HC_LOCATION || "vestmannaeyjar";

async function listTestUsers() {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    out.push(...data.users.filter((u) => (u.email || "").endsWith(`@${DOMAIN}`)));
    if (data.users.length < 200) break;
  }
  return out;
}

async function clean() {
  const users = await listTestUsers();
  for (const u of users) {
    // hc_* rows cascade from auth.users; clients row is removed explicitly.
    await db.from("clients_decrypted").delete().eq("id", u.id);
    await db.auth.admin.deleteUser(u.id);
  }
  console.log(`Removed ${users.length} test patients.`);
}

// Checksum-valid kennitala for 01.01.1901 (century digit 9).
function fakeKennitala(seq) {
  for (let n = seq; n < seq + 200; n++) {
    const base = `010101${String(20 + (n % 80)).padStart(2, "0")}`;
    const m = [3, 2, 7, 6, 5, 4, 3, 2];
    const sum = m.reduce((a, w, i) => a + w * Number(base[i]), 0);
    const r = sum % 11;
    const check = r === 0 ? 0 : 11 - r;
    if (check === 10) continue;
    return `${base}${check}9`;
  }
  throw new Error("no kennitala");
}

const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const chunk = (n) => Array.from({ length: n }, () => ALPHA[randomInt(ALPHA.length)]).join("");
const code = () => `LL-${chunk(4)}-${chunk(4)}`;

const min = (m) => new Date(Date.now() - m * 60_000).toISOString();
const days = (d) => new Date(Date.now() - d * 86400_000).toISOString();
const inHours = (h) => new Date(Date.now() + h * 3600_000).toISOString();

// Each patient: name, stage, entry route and the timestamps that put them there.
const PATIENTS = [
  { name: "Prufa – Anna Sigurðardóttir", stage: "protocol", entry: "b2c",
    t: { paid_at: days(1) } },
  { name: "Prufa – Björn Jónsson", stage: "tests", entry: "b2c",
    t: { paid_at: days(6), protocol_activated_at: days(5), blood_test_booked_for: days(2), blood_test_done_at: days(2), measurements_booked_for: inHours(26) } },
  { name: "Prufa – Guðrún Helgadóttir", stage: "tests", entry: "b2b",
    t: { paid_at: days(4), protocol_activated_at: days(4), measurements_booked_for: days(1), measurements_done_at: days(1), blood_test_booked_for: inHours(20) } },
  { name: "Prufa – Sigurður Pálsson", stage: "report", entry: "b2c",
    t: { paid_at: days(9), protocol_activated_at: days(9), blood_test_done_at: days(3), measurements_done_at: days(2), blood_results_at: min(2) } },
  { name: "Prufa – Kristín Magnúsdóttir", stage: "report", entry: "heilsugaesla",
    t: { paid_at: days(10), protocol_activated_at: days(10), blood_test_done_at: days(4), measurements_done_at: days(3), blood_results_at: min(12) } },
  { name: "Prufa – Jón Ólafsson", stage: "interview", entry: "b2b",
    t: { paid_at: days(14), protocol_activated_at: days(14), blood_test_done_at: days(8), measurements_done_at: days(7), blood_results_at: days(6), report_generated_at: days(6), report_generated_by: "Prufa – læknir", interview_booked_for: inHours(22), interview_mode: "in_person" } },
  { name: "Prufa – Helga Einarsdóttir", stage: "interview", entry: "b2c",
    t: { paid_at: days(12), protocol_activated_at: days(12), blood_test_done_at: days(7), measurements_done_at: days(6), blood_results_at: days(5), report_generated_at: days(5), report_generated_by: "Prufa – læknir" } },
  { name: "Prufa – Páll Guðmundsson", stage: "plan", entry: "b2c",
    t: { paid_at: days(20), protocol_activated_at: days(20), blood_test_done_at: days(15), measurements_done_at: days(14), blood_results_at: days(13), report_generated_at: days(13), report_generated_by: "Prufa – læknir", interview_booked_for: days(1), interview_mode: "video", interview_done_at: days(1) },
    draftPlan: "svefn-streita" },
  { name: "Prufa – Sólveig Árnadóttir", stage: "plan", entry: "b2b",
    t: { paid_at: days(18), protocol_activated_at: days(18), blood_test_done_at: days(12), measurements_done_at: days(12), blood_results_at: days(10), report_generated_at: days(10), report_generated_by: "Prufa – læknir", interview_booked_for: days(2), interview_mode: "in_person", interview_done_at: days(2), referral_to_heilsugaesla: true, referral_note: "Prufa: hækkaður blóðþrýstingur, vísað til eftirfylgdar", referred_at: days(2) } },
  { name: "Prufa – Einar Þórsson", stage: "action", entry: "b2c",
    t: { paid_at: days(60), protocol_activated_at: days(60), blood_test_done_at: days(52), measurements_done_at: days(52), blood_results_at: days(50), report_generated_at: days(50), report_generated_by: "Prufa – læknir", interview_booked_for: days(45), interview_mode: "in_person", interview_done_at: days(45), plan_published_at: days(45), followup_booked_for: inHours(24 * 40) },
    publishedPlan: "efnaskipti" },
];

async function planFromTemplate(templateKey) {
  const [{ data: t }, { data: mods }] = await Promise.all([
    db.from("hc_plan_templates").select("*").eq("key", templateKey).single(),
    db.from("hc_plan_modules").select("*"),
  ]);
  const [{ data: ex }, { data: nu }] = await Promise.all([
    t.exercise_template_key ? db.from("hc_exercise_templates").select("*").eq("key", t.exercise_template_key).single() : { data: null },
    t.nutrition_template_key ? db.from("hc_nutrition_templates").select("*").eq("key", t.nutrition_template_key).single() : { data: null },
  ]);
  const strip = (o) => { if (!o) return null; const { active, updated_at, ...rest } = o; void active; void updated_at; return rest; };
  return {
    template_key: t.key,
    headline: t.name,
    summary: `Prufuáætlun út frá sniðmátinu „${t.name}“.`,
    goals: [],
    modules: t.module_keys.map((k, i) => {
      const m = mods.find((x) => x.key === k);
      return m && { uid: `seed${i}`, key: m.key, pillar: m.pillar, title: m.title, summary: m.summary, details: m.details, frequency: m.frequency, note: null };
    }).filter(Boolean),
    exercise: strip(ex),
    nutrition: strip(nu),
  };
}

async function seed() {
  await clean();
  const { data: loc } = await db.from("hc_locations").select("id").eq("slug", LOCATION_SLUG).single();
  let n = 0;
  for (const p of PATIENTS) {
    n++;
    const email = `sjuklingur${n}@${DOMAIN}`;
    const { data: created, error } = await db.auth.admin.createUser({
      email, password: `Prufa-${chunk(12)}`, email_confirm: true,
      user_metadata: { full_name: p.name, hc_test: true },
    });
    if (error) throw error;
    const uid = created.user.id;
    const kt = fakeKennitala(n * 3);
    const { data: enc } = await db.rpc("enc_kennitala", { p_text: kt });
    // clients_decrypted is a view with INSTEAD OF triggers: upsert (ON
    // CONFLICT) silently does nothing there. The row is created by the
    // new-user trigger, so update it; insert only if it isn't there.
    const profile = {
      email, full_name: p.name, phone: `69${String(90000 + n).slice(-5)}`,
      address: `Prufugata ${n}, 900 Vestmannaeyjum`, kennitala_encrypted: enc,
      date_of_birth: "1901-01-01", terms_accepted_at: new Date().toISOString(),
    };
    const { data: upd } = await db.from("clients_decrypted").update(profile).eq("id", uid).select("id");
    if (!upd?.length) {
      const { error: insErr } = await db.from("clients_decrypted").insert({ id: uid, ...profile });
      if (insErr) throw insErr;
    }

    const created_at = p.t.paid_at ? new Date(new Date(p.t.paid_at).getTime() - 86400_000).toISOString() : new Date().toISOString();
    const { data: j, error: jErr } = await db.from("hc_journeys").insert({
      client_id: uid, location_id: loc.id, stage: p.stage, entry: p.entry,
      profile_completed_at: created_at, welcome_seen_at: created_at, created_at,
      // Already past the 5-minute window with no SMS logged would trigger a
      // real (dry-run) escalation; mark older ones as already escalated.
      ...(p.t.blood_results_at && !p.t.report_generated_at && Date.now() - new Date(p.t.blood_results_at).getTime() > 5 * 60_000 ? { report_sms_sent_at: min(5) } : {}),
      ...p.t,
    }).select("id").single();
    if (jErr) throw jErr;

    await db.from("hc_orders").insert({
      journey_id: j.id, client_id: uid, package_key: "heilsufarsskodun", kind: "health_check",
      price_isk: 49900, payment_route: p.entry === "b2b" ? "company" : "self",
      amount_charged_isk: p.entry === "b2b" ? 0 : 49900, provider: p.entry === "b2b" ? "company_invoice" : "test",
      status: "paid", paid_at: p.t.paid_at, activation_code: code(),
      activation_redeemed_at: p.t.protocol_activated_at ?? null,
    });

    if (p.draftPlan || p.publishedPlan) {
      const plan = await planFromTemplate(p.draftPlan || p.publishedPlan);
      await db.from("hc_action_plans").insert({
        ...plan, journey_id: j.id, client_id: uid,
        status: p.publishedPlan ? "published" : "draft",
        published_at: p.publishedPlan ? p.t.plan_published_at : null,
        start_date: (p.t.plan_published_at || new Date().toISOString()).slice(0, 10),
        review_date: new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10),
        created_by: "prufugögn", updated_by: "prufugögn",
      });
    }
    await db.from("hc_audit").insert({ actor: "prufugögn", action: "test_patient_seeded", journey_id: j.id, detail: { stage: p.stage } });
    console.log(`${p.stage.padEnd(10)} ${p.name}`);
  }
  console.log(`\n${PATIENTS.length} test patients at ${LOCATION_SLUG}.`);
}

(process.argv.includes("--clean") ? clean() : seed()).catch((e) => { console.error(e); process.exit(1); });
