import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

// Generate a single-use claim token for an admin-created company and
// email it to the contact person. The contact lands on
// /business/claim/[token], sets a password, signs ToS + DPA, and the
// company flips from 'draft' / 'contact_invited' to 'active'.
//
// Only the SHA-256 hash of the raw token is stored; the plaintext lives
// in the sent email. Token is valid for 14 days by default and one-time
// use (consumed on successful claim).

export const maxDuration = 30;
const TOKEN_TTL_DAYS = 14;

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const overrideEmail: string | undefined = (body?.email || "").trim().toLowerCase() || undefined;

  const { data: company, error: companyErr } = await supabaseAdmin
    .from("companies")
    .select("id, name, status, contact_person_id, contact_draft_name, contact_draft_email, contact_draft_role")
    .eq("id", companyId)
    .maybeSingle();
  if (companyErr || !company) {
    return NextResponse.json({ error: "company_not_found" }, { status: 404 });
  }
  if (company.status === "active") {
    return NextResponse.json({ error: "already_active", detail: "Company has already been claimed." }, { status: 409 });
  }
  if (company.status === "archived") {
    return NextResponse.json({ error: "archived" }, { status: 409 });
  }

  const contactEmail = overrideEmail || (company.contact_draft_email || "").trim().toLowerCase();
  if (!contactEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    return NextResponse.json({ error: "contact_email_missing", detail: "Set contact_draft_email first, or pass email in the body." }, { status: 400 });
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000).toISOString();

  const { error: updErr } = await supabaseAdmin
    .from("companies")
    .update({
      status: "contact_invited",
      claim_token_hash: tokenHash,
      claim_token_expires_at: expiresAt,
      contact_draft_email: contactEmail,
    })
    .eq("id", companyId);
  if (updErr) {
    return NextResponse.json({ error: "persist_failed", detail: updErr.message }, { status: 500 });
  }

  const origin = req.headers.get("origin") || "https://www.lifelinehealth.is";
  const claimUrl = `${origin}/business/claim/${rawToken}`;
  const firstName = (company.contact_draft_name || contactEmail.split("@")[0]).split(" ")[0] || "þú";

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hæ ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 14px;">Lifeline Health-teymið hefur stofnað aðgang fyrir <strong>${escapeHtml(company.name)}</strong> fyrir ykkur. Til að taka við umsjón fyrirtækisins, smelltu á hnappinn hér að neðan og kláraðu skráninguna (um 5 mínútur).</p>
    <p style="margin:0 0 8px;font-weight:700;">Hvað gerist næst</p>
    <ol style="margin:0 0 14px;padding-left:20px;color:#334155;line-height:1.7;">
      <li>Þú velur lykilorð fyrir aðganginn þinn.</li>
      <li>Þú lest og samþykkir <strong>þjónustuskilmála</strong> og <strong>gagnavinnslusamning</strong> (DPA) rafrænt.</li>
      <li>Þú færð staðfestingu með PDF-eintaki af samningunum í tölvupósti.</li>
    </ol>
    <p style="margin:0 0 0;color:#64748B;font-size:12.5px;">Hlekkurinn er einnota og rennur út eftir 14 daga. Ef hann er útrunninn, hafið samband við okkur og við sendum nýjan.</p>
  `;
  const html = renderBrandedEmail({
    title: `Velkomin í Lifeline Health, ${escapeHtml(company.name)}`,
    preheader: "Kláraðu skráningu fyrirtækisins og skrifaðu undir skilmálana.",
    accentLabel: "Tengiliðarboð",
    accentTone: "emerald",
    bodyHtml,
    ctaLabel: "Taka við aðganginum",
    ctaUrl: claimUrl,
    footerNote: "Spurningar? Svaraðu þessum pósti eða sendu á contact@lifelinehealth.is.",
  });
  const text = `Hæ ${firstName},\n\nLifeline Health hefur stofnað aðgang fyrir ${company.name}. Taktu við með þessum hlekk (gildir í 14 daga):\n\n${claimUrl}\n\nHvað gerist næst:\n  1. Þú velur lykilorð.\n  2. Þú samþykkir þjónustuskilmála og gagnavinnslusamning.\n  3. Þú færð PDF-eintak af samningunum í pósti.\n\n— Lifeline Health`;

  const sendResult = await sendEmail({
    to: contactEmail,
    subject: `Taka við Lifeline-aðganginum — ${company.name}`,
    html,
    text,
  });
  if (!sendResult.ok) {
    return NextResponse.json({ error: "email_send_failed", detail: sendResult.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sent_to: contactEmail,
    expires_at: expiresAt,
    claim_url: claimUrl, // returned so admin can copy-paste if email fails
  });
}
