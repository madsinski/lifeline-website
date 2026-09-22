// Union reimbursement application for one order.
// GET                      → the PDF (download)
// POST { action: "send" }  → emails the PDF to the union's registered
//                            recipient, cc the member, reply-to the member.
// Schema: supabase/migration-health-journey.sql (hc_union_claims, hc_unions)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { renderUnionClaimPdf } from "@/lib/hc/pdf-union-claim";
import { computeReimbursement, type UnionRules } from "@/lib/hc/reimbursement";
import { decryptKennitala, getClientProfile, hcAudit, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function build(req: NextRequest, userId: string, orderId: string) {
  const { data: order } = await supabaseAdmin.from("hc_orders").select("*").eq("id", orderId).eq("client_id", userId).maybeSingle();
  if (!order || !order.union_id) return { error: "not_found" as const };
  const [{ data: union }, { data: pkg }, { data: journey }, profile, { data: existing }] = await Promise.all([
    supabaseAdmin.from("hc_unions").select("id, name, contact_name, contact_email, rules").eq("id", order.union_id).maybeSingle(),
    supabaseAdmin.from("hc_packages").select("name, description, includes, union_category").eq("key", order.package_key).maybeSingle(),
    supabaseAdmin.from("hc_journeys").select("location_id").eq("id", order.journey_id).maybeSingle(),
    getClientProfile(userId),
    supabaseAdmin.from("hc_union_claims").select("*").eq("order_id", order.id).maybeSingle(),
  ]);
  if (!union || !pkg || !profile) return { error: "not_found" as const };
  let locationName: string | null = null;
  if (journey?.location_id) {
    const { data: loc } = await supabaseAdmin.from("hc_locations").select("name").eq("id", journey.location_id).maybeSingle();
    locationName = loc?.name ?? null;
  }
  const kennitala = await decryptKennitala(profile.kennitala_encrypted, {
    actorRole: "client", purpose: "union_claim_pdf", subjectId: userId, req,
  });
  // Rules apply to what the member paid, after any employer contribution.
  const r = computeReimbursement(union.rules as UnionRules, pkg.union_category, order.price_isk - (order.company_contribution_isk || 0));
  const reimbursable = existing?.reimbursable_isk ?? order.union_reimbursement_isk ?? r.amountIsk;
  const claimNumber = `LLU-${new Date(order.created_at).getFullYear()}-${String(order.id).slice(0, 6).toUpperCase()}`;
  const pdf = await renderUnionClaimPdf({
    claimNumber,
    issuedAtIso: new Date().toISOString(),
    union: { name: union.name, contactName: union.contact_name, contactEmail: union.contact_email },
    member: {
      fullName: profile.full_name || profile.email,
      kennitala,
      address: profile.address,
      phone: profile.phone,
      email: profile.email,
    },
    service: {
      packageName: pkg.name,
      description: pkg.description,
      includes: Array.isArray(pkg.includes) ? pkg.includes : [],
      location: locationName,
      orderId: order.id,
      paidAtIso: order.paid_at,
      paymentReference: order.provider_reference,
    },
    priceIsk: order.price_isk,
    employerIsk: order.company_contribution_isk || 0,
    amountPaidIsk: order.amount_charged_isk ?? order.price_isk,
    reimbursableIsk: reimbursable,
    ruleExplanation: r.explanation,
  });
  return { order, union, pkg, profile, existing, pdf, claimNumber, reimbursable };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { orderId } = await ctx.params;
  const out = await build(req, user.id, orderId);
  if ("error" in out) return NextResponse.json({ error: out.error }, { status: 404 });
  return new NextResponse(new Uint8Array(out.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="umsokn-endurgreidsla-${out.claimNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { orderId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (body.action !== "send") return NextResponse.json({ error: "unknown_action" }, { status: 400 });

  const out = await build(req, user.id, orderId);
  if ("error" in out) return NextResponse.json({ error: out.error }, { status: 404 });
  if (!out.union.contact_email) {
    return NextResponse.json({ error: "Félagið hefur ekki skráðan móttakanda. Sæktu PDF-skjalið og sendu það sjálf(ur)." }, { status: 409 });
  }
  if (out.existing?.sent_at && !body.resend) {
    return NextResponse.json({ error: "already_sent", sent_at: out.existing.sent_at }, { status: 409 });
  }

  const path = `${user.id}/${out.order.id}-${Date.now()}.pdf`;
  await supabaseAdmin.storage.from("hc-claims").upload(path, out.pdf, { contentType: "application/pdf", upsert: false });

  const name = out.profile.full_name || out.profile.email;
  const html = renderBrandedEmail({
    title: `Umsókn um endurgreiðslu: ${name}`,
    accentLabel: "Umsókn",
    bodyHtml: `<p style="margin:0 0 12px;">${out.union.contact_name ? `Góðan dag ${escapeHtml(out.union.contact_name)},` : "Góðan dag,"}</p>
      <p style="margin:0 0 12px;">Meðfylgjandi er umsókn ${escapeHtml(name)} um endurgreiðslu vegna <strong>${escapeHtml(out.pkg.name)}</strong> hjá Lifeline Health. Skjalið er jafnframt greiðslukvittun.</p>
      <p style="margin:0 0 12px;">Sótt er um <strong>${out.reimbursable.toLocaleString("is-IS")} kr.</strong></p>
      <p style="margin:0;">Svar við þessum pósti fer beint til umsækjanda.</p>`,
    footerNote: "Engar heilsufarsupplýsingar fylgja umsókninni.",
  });
  const sent = await sendEmail({
    to: out.union.contact_email,
    cc: out.profile.email,
    replyTo: out.profile.email,
    subject: `Umsókn um endurgreiðslu – ${name} – ${out.claimNumber}`,
    html,
    text: `Meðfylgjandi er umsókn ${name} um endurgreiðslu vegna ${out.pkg.name} (${out.reimbursable.toLocaleString("is-IS")} kr.).`,
    attachments: [{ filename: `umsokn-${out.claimNumber}.pdf`, content: out.pdf.toString("base64"), contentType: "application/pdf" }],
  });
  if (!sent.ok) return NextResponse.json({ error: sent.error || "send_failed" }, { status: 502 });

  const patch = { pdf_path: path, sent_to: out.union.contact_email, sent_at: new Date().toISOString(), status: "sent" };
  if (out.existing) {
    await supabaseAdmin.from("hc_union_claims").update(patch).eq("id", out.existing.id);
  } else {
    await supabaseAdmin.from("hc_union_claims").insert({
      order_id: out.order.id, union_id: out.union.id, client_id: user.id,
      amount_paid_isk: out.order.amount_charged_isk, reimbursable_isk: out.reimbursable, ...patch,
    });
  }
  await hcAudit(`client:${user.id}`, "union_claim_sent", out.order.journey_id, { order_id: out.order.id, to: out.union.contact_email });
  return NextResponse.json({ ok: true, sent_to: out.union.contact_email });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
