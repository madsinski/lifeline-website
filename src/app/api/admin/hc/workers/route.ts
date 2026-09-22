// Workstation users (Lifeline + partner nurses/doctors).
// GET → list   POST { id?, email, name, phone, organization, role,
//                     location_ids, receives_report_sms, active, send_invite? }
// Invites email a one-time activation link (/vinnustod/virkja/<token>).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { adminGate } from "@/lib/hc/admin-gate";
import { siteOrigin } from "@/lib/hc/server";
import { issueWorkerLink } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const { data } = await supabaseAdmin
    .from("hc_workers")
    .select("id, email, name, phone, organization, role, location_ids, receives_report_sms, active, invited_at, last_login_at, password_hash")
    .order("name");
  return NextResponse.json({
    workers: (data || []).map((w) => {
      const { password_hash: pw, ...rest } = w;
      return { ...rest, activated: !!pw };
    }),
  });
}

export async function POST(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();
  const name = String(b.name || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) return NextResponse.json({ error: "Nafn og gilt netfang vantar." }, { status: 400 });
  const row = {
    email,
    name,
    phone: typeof b.phone === "string" && b.phone.trim() ? b.phone.trim() : null,
    organization: ["lifeline", "vera", "heilsugaesla"].includes(b.organization) ? b.organization : "lifeline",
    role: ["nurse", "doctor", "admin"].includes(b.role) ? b.role : "nurse",
    location_ids: Array.isArray(b.location_ids) ? b.location_ids.filter((x: unknown) => typeof x === "string") : [],
    receives_report_sms: !!b.receives_report_sms,
    active: b.active !== false,
  };
  const q = b.id
    ? supabaseAdmin.from("hc_workers").update(row).eq("id", b.id).select("id, name, email").single()
    : supabaseAdmin.from("hc_workers").insert(row).select("id, name, email").single();
  const { data, error } = await q;
  if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Netfangið er þegar skráð." : error?.message }, { status: 400 });

  let inviteUrl: string | null = null;
  if (b.send_invite) {
    inviteUrl = await issueWorkerLink(data.id, "invite", siteOrigin(req));
    await sendEmail({
      to: data.email,
      subject: "Aðgangur að vinnustöð Lifeline",
      html: renderBrandedEmail({
        title: `Velkomin(n), ${data.name.split(" ")[0]}`,
        accentLabel: "Vinnustöð",
        bodyHtml: `<p style="margin:0 0 12px;">Þú hefur fengið aðgang að vinnustöð Lifeline fyrir heilsufarsskoðanir: biðlistar, viðtöl og aðgerðaáætlanir.</p>
          <p style="margin:0;">Veldu lykilorð með hlekknum hér fyrir neðan. Hann gildir í 14 daga.</p>`,
        ctaLabel: "Virkja aðgang",
        ctaUrl: inviteUrl,
      }),
      text: `Virkjaðu aðganginn þinn að vinnustöð Lifeline: ${inviteUrl}`,
    });
  }
  return NextResponse.json({ worker: data, invite_url: inviteUrl });
}
