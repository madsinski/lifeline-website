// Daily: the end of the 14-day app trial.
//
//   1. Conversion (only while STRAUMUR_CARDS_LIVE). A free-trial row whose
//      trial has ended and that has a card saved for it (card_saved_at) is
//      charged the package price on the saved card and becomes the paid tier
//      for one interval. A failed charge sets the row 'expired', which is the
//      paywall. While cards are not live nothing is charged: the trial just
//      runs out, as before, and step 2 tells the person.
//   2. Reminders, by email, Web Push (only to people who switched push on)
//      and in the app's notification list (/api/hc/notifications reads
//      hc_trial_notices):
//        ends_soon  three days before trial_ends_at — required good practice
//                   before anything renews automatically, and the promise the
//                   trial screen makes while card registration is not open
//        ended      on the day it ends (or the run after)
//
// Each (subscription, kind) is sent once: the hc_trial_notices row is
// inserted first (unique), and only the run that inserted it sends. The
// 'convert' row is the same lock in front of a charge, so a card is never
// charged twice for one trial. Without that table (migration not run) this
// route does nothing at all rather than send without a way to stop.
//
// Schema: supabase/migration-hc-trial.sql. Scheduled in vercel.json.
// Auth: CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { sendPush } from "@/lib/hc/push";
import { hcAudit } from "@/lib/hc/server";
import { chargeSavedStraumurMethod, STRAUMUR_CARDS_LIVE } from "@/lib/straumur";
import { healthAccess, isMissingSchema, PAID_TIERS, TRIAL_TIER } from "@/lib/hc/subscription";

export const runtime = "nodejs";
export const maxDuration = 300;

const ORIGIN = "https://www.lifelinehealth.is";
const SETTINGS = "/app/adgangur#askrift";
const DAY = 86400_000;
const PACKAGE_KEY = "app-monthly";

const MO_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
/** Hand-written: no Icelandic locale data on Vercel. Iceland is UTC all year. */
const dateIs = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()}. ${MO_IS[d.getUTCMonth()]}`; };
const kr = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} kr.`;

interface Sub {
  id: string;
  client_id: string;
  tier: string | null;
  status: string | null;
  trial_ends_at: string;
}

type Kind = "ends_soon" | "ended" | "convert";

/** Take the (subscription, kind) slot. True only for the one caller that got it. */
async function claim(sub: Sub, kind: Kind, title: string | null, body: string | null): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("hc_trial_notices")
    .insert({ subscription_id: sub.id, client_id: sub.client_id, kind, title, body })
    .select("id").maybeSingle();
  if (error || !data) return null; // 23505: already sent / already charged
  return data.id as string;
}

async function emailOf(clientId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(clientId);
  return data?.user?.email ?? null;
}

async function deliver(noticeId: string, clientId: string, title: string, body: string) {
  const to = await emailOf(clientId);
  let emailOk = false;
  if (to) {
    const r = await sendEmail({
      to, subject: title,
      html: renderBrandedEmail({
        title, preheader: body.slice(0, 120),
        bodyHtml: `<p style="margin:0;">${body}</p>`,
        ctaLabel: "Sjá áskriftina", ctaUrl: `${ORIGIN}${SETTINGS}`,
      }),
      text: `${body}\n\n${ORIGIN}${SETTINGS}`,
    }).catch(() => ({ ok: false }));
    emailOk = r.ok;
  }
  const pushed = await sendPush(clientId, { title, body, url: `${ORIGIN}${SETTINGS}`, tag: `trial-${noticeId}` }).catch(() => 0);
  await supabaseAdmin.from("hc_trial_notices").update({ email_sent: emailOk, push_sent: pushed }).eq("id", noticeId);
  return emailOk;
}

/** Someone with a paid check, or another paid subscription, is not reminded about a trial. */
async function needsNoTrial(clientId: string, subId: string): Promise<boolean> {
  const { data: other } = await supabaseAdmin.from("subscriptions")
    .select("id, tier").eq("client_id", clientId).eq("status", "active").neq("id", subId);
  if ((other ?? []).some((r) => PAID_TIERS.has((r.tier as string) ?? ""))) return true;
  return healthAccess(clientId);
}

function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: this cron can charge cards, so a missing secret must not
  // turn it into a public endpoint.
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Without the marker table there is no way to send once only: do nothing.
  const probe = await supabaseAdmin.from("hc_trial_notices").select("id", { head: true, count: "exact" }).limit(1);
  if (probe.error) {
    const missing = isMissingSchema(probe.error);
    console.warn(`[hc-trial-reminders] ${missing ? "hc_trial_notices missing — run supabase/migration-hc-trial.sql" : probe.error.message}; nothing sent.`);
    return NextResponse.json({ ok: false, skipped: missing ? "migration_missing" : "error" });
  }

  const { data: pkg } = await supabaseAdmin.from("hc_packages")
    .select("name, price_isk, interval_months").eq("key", PACKAGE_KEY).maybeSingle();
  const price = (pkg?.price_isk as number | undefined) ?? null;
  const priceText = price != null ? kr(price) : null;
  const now = new Date();
  const out = { converted: 0, charge_failed: 0, ends_soon: 0, ended: 0, skipped: 0, cards_live: STRAUMUR_CARDS_LIVE };

  // What happened to each subscription in step 1, for the wording in step 2.
  const outcome = new Map<string, "converted" | "failed">();

  // ── 1. Conversion ──────────────────────────────────────────────────────
  if (STRAUMUR_CARDS_LIVE && pkg && price != null) {
    const { data: due, error } = await supabaseAdmin.from("subscriptions")
      .select("id, client_id, tier, status, trial_ends_at")
      .eq("tier", TRIAL_TIER).eq("status", "active")
      .not("card_saved_at", "is", null).lte("trial_ends_at", now.toISOString())
      .limit(200);
    if (error) console.warn("[hc-trial-reminders] conversion query failed (card_saved_at missing?)", error.message);
    for (const sub of (due ?? []) as Sub[]) {
      if (await needsNoTrial(sub.client_id, sub.id)) { out.skipped++; continue; }
      if (!(await claim(sub, "convert", null, null))) continue;

      const { data: card } = await supabaseAdmin.from("payment_methods")
        .select("id, provider_token").eq("owner_type", "client").eq("owner_id", sub.client_id)
        .order("is_default", { ascending: false }).order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      const charge = card
        ? await chargeSavedStraumurMethod({
            token: card.provider_token as string, amountIsk: price,
            reference: `sub_${sub.id.slice(0, 8)}`, description: (pkg.name as string) ?? "Lifeline appið",
          })
        : { ok: false as const, error: "no_card" };

      await supabaseAdmin.from("payments").insert({
        owner_type: "client", owner_id: sub.client_id, amount_isk: price,
        description: `${pkg.name ?? "Lifeline appið"} — fyrsti mánuður eftir prufutíma`,
        provider: "straumur", provider_reference: charge.ok ? charge.providerReference : null,
        payment_method_id: card?.id ?? null, status: charge.ok ? "succeeded" : "failed",
        related_type: "subscriptions", related_id: sub.id, paid_at: charge.ok ? now.toISOString() : null,
      }).then(({ error: e }) => { if (e) console.error("[hc-trial-reminders] payments ledger", e.message); });

      if (charge.ok) {
        await supabaseAdmin.from("subscriptions").update({
          tier: "premium",
          current_period_start: now.toISOString(),
          current_period_end: addMonths(now, (pkg.interval_months as number | null) ?? 1).toISOString(),
        }).eq("id", sub.id);
        outcome.set(sub.id, "converted");
        out.converted++;
      } else {
        await supabaseAdmin.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
        outcome.set(sub.id, "failed");
        out.charge_failed++;
      }
      await hcAudit("system", charge.ok ? "trial_converted" : "trial_charge_failed", null, {
        subscription_id: sub.id, amount: price, error: charge.ok ? null : charge.error,
      });
    }
  }

  // ── 2a. Three days before ──────────────────────────────────────────────
  {
    const { data } = await supabaseAdmin.from("subscriptions")
      .select("id, client_id, tier, status, trial_ends_at")
      .eq("tier", TRIAL_TIER).eq("status", "active")
      .gt("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", new Date(now.getTime() + 3 * DAY).toISOString())
      .limit(500);
    for (const sub of (data ?? []) as Sub[]) {
      if (await needsNoTrial(sub.client_id, sub.id)) { out.skipped++; continue; }
      const when = dateIs(sub.trial_ends_at);
      const converts = STRAUMUR_CARDS_LIVE && (await cardSaved(sub.id));
      const title = `Prufutímanum lýkur ${when}`;
      const body = converts
        ? `Prufutímanum þínum lýkur ${when}. Þá hefst áskriftin að appinu og ${priceText ? `${priceText} verða skuldfærðar` : "mánaðargjaldið verður skuldfært"} af kortinu þínu, síðan mánaðarlega. Ef þú vilt ekki halda áfram geturðu sagt upp fyrir þann tíma undir Stillingar og áskrift.`
        : `Prufutímanum þínum lýkur ${when}. Eftir það kostar áskrift að appinu ${priceText ? `${priceText} á mánuði` : "mánaðargjald"}. Ekkert er skuldfært nema þú hefjir áskrift.`;
      const id = await claim(sub, "ends_soon", title, body);
      if (!id) continue;
      await deliver(id, sub.client_id, title, body);
      out.ends_soon++;
    }
  }

  // ── 2b. On the day ─────────────────────────────────────────────────────
  {
    // A short window back, so a missed run is caught but the first run after
    // deploy does not write to everyone whose trial ended months ago.
    const { data } = await supabaseAdmin.from("subscriptions")
      .select("id, client_id, tier, status, trial_ends_at")
      .in("tier", [TRIAL_TIER, "premium"]).in("status", ["active", "expired"])
      .lte("trial_ends_at", now.toISOString())
      .gte("trial_ends_at", new Date(now.getTime() - 3 * DAY).toISOString())
      .limit(500);
    for (const sub of (data ?? []) as Sub[]) {
      const when = dateIs(sub.trial_ends_at);
      const converted = sub.tier === "premium";
      // A premium row with a trial date is one this cron converted; anything
      // else on a paid tier did not come through a trial.
      if (converted && outcome.get(sub.id) !== "converted" && !(await wasConverted(sub.id))) continue;
      if (!converted && (await needsNoTrial(sub.client_id, sub.id))) { out.skipped++; continue; }
      const failed = sub.status === "expired" && (outcome.get(sub.id) === "failed" || (await wasConverted(sub.id)));

      const title = converted ? "Áskriftin þín er hafin" : "Prufutímanum er lokið";
      const body = converted
        ? `Prufutímanum lauk ${when} og áskriftin að appinu er hafin. ${priceText ? `${priceText} voru skuldfærðar` : "Mánaðargjaldið var skuldfært"} af kortinu þínu. Þú getur sagt upp hvenær sem er undir Stillingar og áskrift.`
        : failed
          ? `Prufutímanum þínum lauk ${when}, en ekki tókst að skuldfæra kortið þitt og því hófst áskriftin ekki. Þú getur skráð kort og hafið áskrift undir Stillingar og áskrift.`
          : `Prufutímanum þínum lauk ${when}. Þú getur haldið áfram með áskrift á ${priceText ? `${priceText} á mánuði` : "mánaðargjaldi"} undir Stillingar og áskrift. Ekkert er skuldfært nema þú hefjir áskrift.`;
      const id = await claim(sub, "ended", title, body);
      if (!id) continue;
      await deliver(id, sub.client_id, title, body);
      out.ended++;
    }
  }

  return NextResponse.json({ ok: true, ...out });
}

async function cardSaved(subId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from("subscriptions").select("card_saved_at").eq("id", subId).maybeSingle();
  return !error && !!data?.card_saved_at;
}

/** A 'convert' lock exists: this cron charged (or tried to charge) this trial. */
async function wasConverted(subId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("hc_trial_notices").select("id").eq("subscription_id", subId).eq("kind", "convert").limit(1);
  return !!data?.length;
}
