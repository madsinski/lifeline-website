// Checkout for every journey purchase (health check, 3-month follow-up,
// extra follow-up, re-evaluation) and the single shop's standalone products
// (measurement, blood test, doctor interview — src/lib/hc/shop.ts).
// Server-side end to end: the browser never writes an order or a payment
// status.
//
// Standalone products can be bought any time by a signed-in client; they
// attach to the current journey (one is created if there is none) and do not
// move its stage. Employer and union contributions apply only to the
// journey packages, never to a standalone product. A company code keeps the
// company's agreed health-check price while it is locked
// (companies.hc_price_isk, supabase/migration-single-shop.sql).
//
// GET  ?package=<key>&code=<company code>  → price, approved unions with the
//                                            computed reimbursement, code check
// POST { package_key, use_company?, company_code?, use_union?, union_id?,
//        (legacy: route: self|union|company)
//        union_consent?, accept_terms }     → charges (Straumur), issues the
//                                            activation code, advances journey
//
// Schema: supabase/migration-health-journey.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createStraumurCharge } from "@/lib/straumur";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { normalizeCode } from "@/lib/hc/codes";
import { claimActivationCode, codeEmail } from "@/lib/hc/code-pool";
import { quote as buildQuote, computeReimbursement, type UnionRules } from "@/lib/hc/reimbursement";
import {
  approvedUnions, currentJourney, getClientProfile, getOrCreateJourney, hcAudit, isProfileComplete, patchJourney,
  refreshStage, requireUser, siteOrigin, type ClientProfile,
} from "@/lib/hc/server";
import { AFTER_PURCHASE, isStandaloneKind } from "@/lib/hc/shop";
import { companyLockedPrice } from "@/lib/hc/shop-server";
import type { HcJourney, HcPackage, PaymentRoute } from "@/lib/hc/types";
import { recordWaiver, requireWaiver } from "@/lib/hc/waiver";

export const runtime = "nodejs";
export const maxDuration = 60;

async function loadPackage(key: string): Promise<HcPackage | null> {
  const { data } = await supabaseAdmin.from("hc_packages").select("*").eq("key", key).eq("active", true).maybeSingle();
  return (data as HcPackage | null) ?? null;
}

type CodeCheck =
  | { ok: true; id: string; company_id: string; company_name: string | null; package_key: string; contribution_percent: number; contribution_isk: number | null }
  | { ok: false; error: string };

async function checkCompanyCode(raw: string, userId: string, email: string | null, profile: ClientProfile | null): Promise<CodeCheck> {
  const code = normalizeCode(raw);
  const { data: c } = await supabaseAdmin
    .from("company_hc_codes")
    .select("id, company_id, member_id, package_key, redeemed_by, redeemed_at, expires_at, revoked_at, contribution_percent, contribution_isk")
    .eq("code", code)
    .maybeSingle();
  if (!c || c.revoked_at) return { ok: false, error: "Kóðinn fannst ekki." };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { ok: false, error: "Kóðinn er útrunninn." };
  if (c.redeemed_at && c.redeemed_by !== userId) return { ok: false, error: "Kóðinn hefur þegar verið notaður." };

  // A code tied to one employee only works for that employee: matched on the
  // linked account, the roster email, or the kennitala on the roster.
  if (c.member_id) {
    const { data: m } = await supabaseAdmin
      .from("company_members")
      .select("id, email, client_id, kennitala_encrypted")
      .eq("id", c.member_id)
      .maybeSingle();
    let match = !!m && (m.client_id === userId || (!!email && (m.email || "").toLowerCase() === email.toLowerCase()));
    if (!match && m?.kennitala_encrypted && profile?.kennitala_encrypted) {
      const [{ data: a }, { data: b }] = await Promise.all([
        supabaseAdmin.rpc("dec_kennitala", { p_enc: m.kennitala_encrypted }),
        supabaseAdmin.rpc("dec_kennitala", { p_enc: profile.kennitala_encrypted }),
      ]);
      match = !!a && a === b;
    }
    if (!match) return { ok: false, error: "Kóðinn er skráður á annan starfsmann. Skráðu þig inn með netfanginu sem fyrirtækið skráði, eða sláðu inn kennitöluna þína fyrst." };
  }
  const { data: co } = await supabaseAdmin.from("companies").select("name").eq("id", c.company_id).maybeSingle();
  return {
    ok: true, id: c.id, company_id: c.company_id, company_name: co?.name ?? null, package_key: c.package_key,
    contribution_percent: c.contribution_percent ?? 100, contribution_isk: c.contribution_isk ?? null,
  };
}

/** Days before reevaluation_due_at that the re-evaluation can be bought (also on the hub). */
const REEVAL_OPENS_DAYS = 60;

/** Which journey this purchase belongs to, and whether it is allowed now. */
function eligibility(pkg: HcPackage, journey: HcJourney | null): string | null {
  /* Subscriptions start a period, they do not settle a bill: /api/hc/subscribe. */
  if ((pkg.kind as string) === "subscription") return "Áskrift er keypt undir Stillingar og áskrift.";
  /* The shop's standalone products can be bought any time, again and again. */
  if (isStandaloneKind(pkg.kind)) return null;
  /* The health check starts a journey if there is none (POST creates it). */
  if (!journey) return pkg.kind === "health_check" ? null : "Engin heilsuferð fannst.";
  if (pkg.kind === "health_check" && journey.paid_at) return "Heilsufarsskoðunin er þegar greidd.";
  if ((pkg.kind === "followup_3m" || pkg.kind === "extra_followup") && !journey.interview_done_at) {
    return "Eftirfylgd opnast eftir fyrsta viðtalið.";
  }
  if (pkg.kind === "reevaluation" && !journey.plan_published_at) return "Endurmat opnast þegar aðgerðaáætlun liggur fyrir.";
  // Re-evaluation compares with the first check, so it opens near the due date.
  if (pkg.kind === "reevaluation" && journey.reevaluation_due_at && Date.parse(journey.reevaluation_due_at) - Date.now() > REEVAL_OPENS_DAYS * 86400_000) {
    return "Endurmat opnast tveimur mánuðum áður en það er ráðlagt.";
  }
  return null;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const pkg = await loadPackage(req.nextUrl.searchParams.get("package") || "");
  if (!pkg) return NextResponse.json({ error: "package_not_found" }, { status: 404 });
  const profile = await getClientProfile(user.id);
  const journey = await currentJourney(user.id);

  /* Unions and employers take part in the journey packages only. */
  const contributions = !isStandaloneKind(pkg.kind);
  const unions = (contributions ? await approvedUnions() : []).map((u) => {
    const r = computeReimbursement(u.rules, pkg.union_category, pkg.price_isk);
    return {
      id: u.id, name: u.name, settlement: u.settlement, rules_summary: u.rules_summary, rules: u.rules,
      reimbursement_isk: r.amountIsk, explanation: r.explanation, can_email: !!u.contact_email,
    };
  });

  const codeParam = contributions ? req.nextUrl.searchParams.get("code") : null;
  const checked = codeParam ? await checkCompanyCode(codeParam, user.id, user.email ?? null, profile) : null;
  /* The company's agreed price, so the page's quote matches the charge. */
  const code = checked?.ok
    ? { ...checked, price_isk: (await companyLockedPrice(checked.company_id, pkg.kind)) ?? pkg.price_isk }
    : checked;

  return NextResponse.json({
    package: pkg,
    contributions,
    unions,
    eligibility_error: eligibility(pkg, journey),
    // Strict on purpose, whatever the track: this is buying the health
    // check, and the kennitala is what the patient portal and the union
    // application need. Somebody on the coaching track who buys a check is
    // asking for exactly the thing that requires it.
    profile_complete: isProfileComplete(profile),
    company_code: code,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));
  // Employer and union can both apply. `route` is the legacy single choice.
  const useCompany = b.use_company === true || b.route === "company";
  const useUnion = b.use_union === true || b.route === "union";
  const route: PaymentRoute = useCompany && useUnion ? "company_union" : useCompany ? "company" : useUnion ? "union" : "self";
  if (!b.accept_terms) return NextResponse.json({ error: "Samþykkja þarf söluskilmála." }, { status: 400 });
  /*
   * The withdrawal-right waiver (söluskilmálar gr. 8, d-liður 1. mgr. 18. gr.
   * laga nr. 16/2016): the consumer asks for the service to start at once
   * and acknowledges the right lapses once it is fully performed. Required
   * from the website (src/lib/hc/waiver.ts — the RN app is exempt until it
   * sends the flag). Recorded with server time on the order
   * (hc_orders.withdrawal_waiver_at, supabase/migration-withdrawal-waiver.sql)
   * and in hc_audit.detail, which works whether or not that column exists.
   */
  const noWaiver = requireWaiver(req, b);
  if (noWaiver) return noWaiver;
  const waiverAt = b.withdrawal_waiver === true ? new Date().toISOString() : null;
  const waiver = waiverAt
    ? { withdrawal_waiver: true, withdrawal_waiver_recorded_at: waiverAt }
    : { withdrawal_waiver: false };

  const pkg = await loadPackage(String(b.package_key || ""));
  if (!pkg) return NextResponse.json({ error: "package_not_found" }, { status: 404 });
  const standalone = isStandaloneKind(pkg.kind);
  if (standalone && (useCompany || useUnion)) {
    return NextResponse.json({ error: "Vinnuveitandi og stéttarfélag taka aðeins þátt í heilsufarsskoðuninni." }, { status: 400 });
  }
  const profile = await getClientProfile(user.id);
  if (!isProfileComplete(profile)) return NextResponse.json({ error: "Kláraðu upplýsingar um þig fyrst." }, { status: 409 });

  let journey = await currentJourney(user.id);
  const notEligible = eligibility(pkg, journey);
  if (notEligible) return NextResponse.json({ error: notEligible }, { status: 409 });
  /* A shop purchase by somebody with no journey yet: the order needs one to
     hang off. Created as b2c/b2b by getOrCreateJourney, never 'coach'. */
  if (!journey) journey = await getOrCreateJourney(user.id);
  const actor = `client:${user.id}`;

  // Pricing
  let unionRow: { id: string; name: string; settlement: "reimbursement" | "direct"; rules: UnionRules } | null = null;
  let companyCode: Extract<CodeCheck, { ok: true }> | null = null;
  if (useUnion) {
    const u = (await approvedUnions()).find((x) => x.id === b.union_id);
    if (!u) return NextResponse.json({ error: "Stéttarfélagið er ekki í samstarfi við Lifeline." }, { status: 400 });
    if (u.settlement === "direct" && !b.union_consent) {
      return NextResponse.json({ error: "Samþykkja þarf að félagið sé innheimt beint." }, { status: 400 });
    }
    unionRow = u;
  }
  if (useCompany) {
    const c = await checkCompanyCode(String(b.company_code || ""), user.id, user.email ?? null, profile);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
    if (c.package_key !== pkg.key) return NextResponse.json({ error: "Kóðinn gildir ekki fyrir þennan pakka." }, { status: 400 });
    companyCode = c;
  }
  /* The company's agreed price while it is locked, else the list price. */
  const priceIsk = (companyCode ? await companyLockedPrice(companyCode.company_id, pkg.kind) : null) ?? pkg.price_isk;
  const q = buildQuote({
    priceIsk,
    employer: companyCode ? { percent: companyCode.contribution_percent, fixed_isk: companyCode.contribution_isk } : null,
    union: unionRow ? { settlement: unionRow.settlement, rules: unionRow.rules } : null,
    unionCategory: pkg.union_category,
  });

  // Re-evaluation starts a new cycle: close the old journey, open a fresh one.
  if (pkg.kind === "reevaluation") {
    await patchJourney(journey.id, { completed_at: new Date().toISOString() }, actor, "journey_completed_by_reevaluation");
    const { data: fresh, error } = await supabaseAdmin
      .from("hc_journeys")
      .insert({
        client_id: user.id,
        location_id: journey.location_id,
        entry: journey.entry,
        company_id: journey.company_id,
        profile_completed_at: new Date().toISOString(),
        welcome_seen_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error || !fresh) return NextResponse.json({ error: "journey_create_failed" }, { status: 500 });
    journey = fresh as HcJourney;
  }

  // Claim the company code before charging anything (atomic: only one wins).
  if (companyCode) {
    const { data: claimed } = await supabaseAdmin
      .from("company_hc_codes")
      .update({ redeemed_by: user.id, redeemed_at: new Date().toISOString() })
      .eq("id", companyCode.id)
      .is("redeemed_at", null)
      .select("id");
    if (!claimed?.length) {
      const { data: again } = await supabaseAdmin.from("company_hc_codes").select("redeemed_by").eq("id", companyCode.id).maybeSingle();
      if (again?.redeemed_by !== user.id) return NextResponse.json({ error: "Kóðinn hefur þegar verið notaður." }, { status: 409 });
    }
  }

  // Payment
  let providerReference: string | null = null;
  if (q.chargedIsk > 0) {
    const charge = await createStraumurCharge({
      amountIsk: q.chargedIsk,
      reference: journey.id,
      description: pkg.name,
      customer: { name: profile!.full_name || user.email || "", email: user.email || "", phone: profile!.phone },
      returnUrl: `${siteOrigin(req)}${standalone ? "/app/eg/thjonusta" : "/app"}`,
    });
    if (!charge.ok) {
      if (companyCode) await supabaseAdmin.from("company_hc_codes").update({ redeemed_by: null, redeemed_at: null }).eq("id", companyCode.id);
      return NextResponse.json({ error: charge.error || "Greiðsla tókst ekki." }, { status: 402 });
    }
    providerReference = charge.providerReference;
  }

  // The order first; its Medalia activation code is drawn from the pool
  // right after (src/lib/hc/code-pool.ts). The loop is a single pass now —
  // there is no generated code left to collide.
  const now = new Date().toISOString();
  let order: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 1 && !order; attempt++) {
    const { data, error } = await supabaseAdmin
      .from("hc_orders")
      .insert({
        journey_id: journey.id,
        client_id: user.id,
        package_key: pkg.key,
        kind: pkg.kind,
        price_isk: priceIsk,
        payment_route: route,
        union_id: unionRow?.id ?? null,
        union_reimbursement_isk: q.reimbursementIsk,
        union_direct_grant_isk: q.directGrantIsk,
        company_id: companyCode?.company_id ?? null,
        company_code_id: companyCode?.id ?? null,
        amount_charged_isk: q.chargedIsk,
        provider: q.chargedIsk > 0 ? "straumur" : companyCode ? "company_invoice" : null,
        company_contribution_isk: q.employerIsk,
        provider_reference: providerReference,
        status: "paid",
        paid_at: now,
        activation_code: null,
        consent_text: unionRow?.settlement === "direct" ? `Beingreiðsla: ${unionRow.name}` : null,
      })
      .select("*")
      .single();
    if (data) order = data;
    else if (error?.code !== "23505") return NextResponse.json({ error: error?.message || "order_failed" }, { status: 500 });
  }
  if (!order) return NextResponse.json({ error: "order_failed" }, { status: 500 });

  /* One Medalia code for this order. An empty pool leaves the order paid
     without a code: the customer is told it is on its way, staff are
     alerted, and the next import assigns it. Never an invented code. */
  const claimed = await claimActivationCode(order.id as string, user.id, pkg.kind);
  if (claimed.code) {
    await supabaseAdmin.from("hc_orders").update({ activation_code: claimed.code }).eq("id", order.id as string);
    order = { ...order, activation_code: claimed.code };
  }
  if (waiverAt) await recordWaiver("hc_orders", order.id as string, waiverAt);

  if (unionRow && q.reimbursementIsk > 0) {
    await supabaseAdmin.from("hc_union_claims").insert({
      order_id: order.id,
      union_id: unionRow.id,
      client_id: user.id,
      amount_paid_isk: q.chargedIsk,
      reimbursable_isk: q.reimbursementIsk,
      status: "draft",
    });
  }

  if (standalone) {
    /* A product on its own: the journey's stage does not move. */
    await hcAudit(actor, "paid_product", journey.id, { order_id: order.id, kind: pkg.kind, ...waiver });
  } else if (pkg.kind === "health_check" || pkg.kind === "reevaluation") {
    journey = (await patchJourney(journey.id, {
      paid_at: now,
      ...(companyCode ? { entry: "b2b" as const, company_id: companyCode.company_id }
        /* Bought from the shop on the coaching/app track: paying for the
           check is choosing it, same as choose_track 'check'. */
        : journey.entry === "coach" || journey.entry === "app" ? { entry: "b2c" as const } : {}),
    }, actor, "paid", { order_id: order.id, route, ...waiver })) ?? journey;
  } else {
    await hcAudit(actor, "paid_followup", journey.id, { order_id: order.id, kind: pkg.kind, ...waiver });
    journey = await refreshStage(journey);
  }

  // Confirmation email: the code, or word that it is on its way.
  const origin = siteOrigin(req);
  const code = order.activation_code as string | null;
  const next = standalone ? AFTER_PURCHASE[pkg.kind] ?? null : null;
  if (code) {
    await sendEmail({ to: user.email!, ...codeEmail({ pkgName: pkg.name, kind: pkg.kind, code, origin }) });
  } else {
    await sendEmail({
      to: user.email!,
      subject: `Greiðsla móttekin: ${pkg.name}`,
      html: renderBrandedEmail({
        title: `Greiðsla móttekin: ${pkg.name}`,
        accentLabel: "Næsta skref",
        bodyHtml: `<p style="margin:0 0 12px;">Takk fyrir. Virkjunarkóðinn fyrir sjúklingagáttina (Medalia) berst þér í tölvupósti innan eins virks dags. Þú sérð hann líka ${standalone ? "undir Þjónusta" : "í heilsuferðinni"} í appinu um leið og hann er tilbúinn.</p>${next ? `<p style="margin:0;">${next}</p>` : ""}`,
        ctaLabel: standalone ? "Opna Þjónustu" : "Opna heilsuferðina",
        ctaUrl: `${origin}${standalone ? "/app/eg/thjonusta" : "/app"}`,
      }),
      text: `Greiðsla móttekin: ${pkg.name}. Virkjunarkóðinn berst þér í tölvupósti innan eins virks dags.${next ? ` ${next}` : ""} ${origin}${standalone ? "/app/eg/thjonusta" : "/app"}`,
    });
  }

  return NextResponse.json({ ok: true, order, journey, quote: q });
}
