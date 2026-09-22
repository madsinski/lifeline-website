// Checkout for every journey purchase (health check, 3-month follow-up,
// extra follow-up, re-evaluation). Server-side end to end: the browser never
// writes an order or a payment status.
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
import { newActivationCode, normalizeCode } from "@/lib/hc/codes";
import { quote as buildQuote, computeReimbursement, type UnionRules } from "@/lib/hc/reimbursement";
import {
  approvedUnions, currentJourney, getClientProfile, hcAudit, isProfileComplete, patchJourney,
  refreshStage, requireUser, siteOrigin, type ClientProfile,
} from "@/lib/hc/server";
import type { HcJourney, HcPackage, PaymentRoute } from "@/lib/hc/types";

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

/** Which journey this purchase belongs to, and whether it is allowed now. */
function eligibility(pkg: HcPackage, journey: HcJourney | null): string | null {
  if (!journey) return "Engin heilsuferð fannst.";
  if (pkg.kind === "health_check" && journey.paid_at) return "Heilsufarsskoðunin er þegar greidd.";
  if ((pkg.kind === "followup_3m" || pkg.kind === "extra_followup") && !journey.interview_done_at) {
    return "Eftirfylgd opnast eftir fyrsta viðtalið.";
  }
  if (pkg.kind === "reevaluation" && !journey.plan_published_at) return "Endurmat opnast þegar aðgerðaáætlun liggur fyrir.";
  return null;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const pkg = await loadPackage(req.nextUrl.searchParams.get("package") || "");
  if (!pkg) return NextResponse.json({ error: "package_not_found" }, { status: 404 });
  const profile = await getClientProfile(user.id);
  const journey = await currentJourney(user.id);

  const unions = (await approvedUnions()).map((u) => {
    const r = computeReimbursement(u.rules, pkg.union_category, pkg.price_isk);
    return {
      id: u.id, name: u.name, settlement: u.settlement, rules_summary: u.rules_summary, rules: u.rules,
      reimbursement_isk: r.amountIsk, explanation: r.explanation, can_email: !!u.contact_email,
    };
  });

  const codeParam = req.nextUrl.searchParams.get("code");
  const code = codeParam ? await checkCompanyCode(codeParam, user.id, user.email ?? null, profile) : null;

  return NextResponse.json({
    package: pkg,
    unions,
    eligibility_error: eligibility(pkg, journey),
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

  const pkg = await loadPackage(String(b.package_key || ""));
  if (!pkg) return NextResponse.json({ error: "package_not_found" }, { status: 404 });
  const profile = await getClientProfile(user.id);
  if (!isProfileComplete(profile)) return NextResponse.json({ error: "Kláraðu upplýsingar um þig fyrst." }, { status: 409 });

  let journey = await currentJourney(user.id);
  const notEligible = eligibility(pkg, journey);
  if (notEligible || !journey) return NextResponse.json({ error: notEligible }, { status: 409 });
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
  const q = buildQuote({
    priceIsk: pkg.price_isk,
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
      returnUrl: `${siteOrigin(req)}/account/heilsuferd`,
    });
    if (!charge.ok) {
      if (companyCode) await supabaseAdmin.from("company_hc_codes").update({ redeemed_by: null, redeemed_at: null }).eq("id", companyCode.id);
      return NextResponse.json({ error: charge.error || "Greiðsla tókst ekki." }, { status: 402 });
    }
    providerReference = charge.providerReference;
  }

  // Order + activation code (retry on the unlikely code collision)
  const now = new Date().toISOString();
  let order: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 4 && !order; attempt++) {
    const { data, error } = await supabaseAdmin
      .from("hc_orders")
      .insert({
        journey_id: journey.id,
        client_id: user.id,
        package_key: pkg.key,
        kind: pkg.kind,
        price_isk: pkg.price_isk,
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
        activation_code: newActivationCode(),
        consent_text: unionRow?.settlement === "direct" ? `Beingreiðsla: ${unionRow.name}` : null,
      })
      .select("*")
      .single();
    if (data) order = data;
    else if (error?.code !== "23505") return NextResponse.json({ error: error?.message || "order_failed" }, { status: 500 });
  }
  if (!order) return NextResponse.json({ error: "order_failed" }, { status: 500 });

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

  if (pkg.kind === "health_check" || pkg.kind === "reevaluation") {
    journey = (await patchJourney(journey.id, {
      paid_at: now,
      ...(companyCode ? { entry: "b2b" as const, company_id: companyCode.company_id } : {}),
    }, actor, "paid", { order_id: order.id, route })) ?? journey;
  } else {
    await hcAudit(actor, "paid_followup", journey.id, { order_id: order.id, kind: pkg.kind });
    journey = await refreshStage(journey);
  }

  // Confirmation email with the activation code
  const origin = siteOrigin(req);
  const code = order.activation_code as string;
  await sendEmail({
    to: user.email!,
    subject: `Virkjunarkóðinn þinn: ${code}`,
    html: renderBrandedEmail({
      title: `${pkg.name} er greidd`,
      accentLabel: "Næsta skref",
      preheader: `Virkjunarkóði: ${code}`,
      bodyHtml: `<p style="margin:0 0 12px;">Takk fyrir. Næsta skref er að virkja ${pkg.kind === "health_check" || pkg.kind === "reevaluation" ? "heilsufarsskoðunina" : "eftirfylgdina"} í sjúklingagáttinni með þessum kóða:</p>
        <div style="font-family:ui-monospace,monospace;font-size:26px;letter-spacing:.12em;text-align:center;background:#ECFDF5;border-radius:10px;padding:16px;margin:16px 0;color:#065F46;font-weight:700;">${code}</div>
        <p style="margin:0;">Þú finnur kóðann líka alltaf á aðganginum þínum.</p>`,
      ctaLabel: "Opna heilsuferðina",
      ctaUrl: `${origin}/account/heilsuferd`,
    }),
    text: `${pkg.name} er greidd. Virkjunarkóðinn þinn er ${code}. Opnaðu heilsuferðina: ${origin}/account/heilsuferd`,
  });

  return NextResponse.json({ ok: true, order, journey, quote: q });
}
