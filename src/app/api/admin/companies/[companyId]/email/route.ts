// Send emails to a B2B company's admin and/or employees.
//
// GET  /api/admin/companies/[companyId]/email
//      → { admin_email, employee_count, presentations: [{slug,title}] }
//        to populate the composer.
// POST → send. Body:
//   { audience: 'admin' | 'all_employees' | 'incomplete',
//     type: 'reminder' | 'presentation' | 'custom',
//     milestone?, presentation_slug?, subject?, message? }
//   'incomplete' targets employees who haven't done `milestone` yet
//   (auto-signal + admin tick, same merge as the milestones route).
//
// Auth mirrors the other company email routes: isStaff (outbound mail,
// not a data mutation). Public links use the www base.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

const BASE = "https://www.lifelinehealth.is";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MILESTONE_LABEL: Record<string, string> = {
  measurement: "body-composition measurement",
  blood_test: "blood test",
  questionnaire: "health questionnaire",
  doctor_review: "3-month doctor review",
  app_access: "Lifeline app activation",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

async function adminEmail(companyId: string): Promise<string | null> {
  const { data: c } = await supabaseAdmin
    .from("companies")
    .select("contact_email, contact_draft_email, contact_person_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!c) return null;
  const direct = (c.contact_email || c.contact_draft_email || "").trim();
  if (direct) return direct;
  if (c.contact_person_id) {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(c.contact_person_id as string);
    return u?.user?.email || null;
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!UUID_RE.test(companyId)) return NextResponse.json({ error: "bad_company" }, { status: 400 });

  const [admin, membersRes, presRes] = await Promise.all([
    adminEmail(companyId),
    supabaseAdmin.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", companyId).not("email", "is", null),
    supabaseAdmin.from("presentations").select("slug, title").eq("is_published", true).order("updated_at", { ascending: false }),
  ]);
  return NextResponse.json({
    admin_email: admin,
    employee_count: membersRes.count ?? 0,
    presentations: presRes.data || [],
  });
}

// Recipients for the 'incomplete' audience: employees who have NOT done
// the milestone (auto signal + admin tick), with an email on file.
async function incompleteRecipients(companyId: string, milestone: string): Promise<Array<{ email: string; full_name: string | null }>> {
  const { data: members } = await supabaseAdmin
    .from("company_members").select("id, client_id, full_name, email").eq("company_id", companyId).not("email", "is", null);
  const list = members || [];
  const clientIds = list.map((m) => m.client_id as string | null).filter(Boolean) as string[];

  const auto = new Set<string>(); // client_ids that are done
  if (clientIds.length > 0) {
    if (milestone === "measurement") {
      const r = await supabaseAdmin.from("station_slots").select("client_id").in("client_id", clientIds).not("completed_at", "is", null);
      for (const x of r.data || []) if (x.client_id) auto.add(x.client_id as string);
    } else if (milestone === "doctor_review") {
      const r = await supabaseAdmin.from("doctor_slots").select("client_id").in("client_id", clientIds).not("completed_at", "is", null);
      for (const x of r.data || []) if (x.client_id) auto.add(x.client_id as string);
    } else {
      const r = await supabaseAdmin.from("clients").select("id, biody_patient_id, journey_checks").in("id", clientIds);
      for (const c of r.data || []) {
        const jc = (c.journey_checks as Record<string, unknown> | null) || {};
        if (milestone === "app_access" && c.biody_patient_id) auto.add(c.id as string);
        if (milestone === "blood_test" && jc["blood_test"]) auto.add(c.id as string);
        if (milestone === "questionnaire" && jc["questionnaire"]) auto.add(c.id as string);
      }
    }
  }
  const { data: ticks } = await supabaseAdmin
    .from("company_member_milestones").select("member_id").eq("milestone", milestone).in("member_id", list.map((m) => m.id));
  const ticked = new Set((ticks || []).map((t) => t.member_id as string));

  return list
    .filter((m) => !(ticked.has(m.id as string) || (m.client_id && auto.has(m.client_id as string))))
    .map((m) => ({ email: m.email as string, full_name: (m.full_name as string | null) ?? null }));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!UUID_RE.test(companyId)) return NextResponse.json({ error: "bad_company" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const audience = String(body?.audience || "");
  const type = String(body?.type || "");
  const mode = ["preview", "test", "send"].includes(String(body?.mode)) ? String(body.mode) : "send";
  const milestone = body?.milestone ? String(body.milestone) : null;
  if (!["admin", "all_employees", "incomplete"].includes(audience)) {
    return NextResponse.json({ error: "bad_audience" }, { status: 400 });
  }
  if (!["reminder", "presentation", "custom"].includes(type)) {
    return NextResponse.json({ error: "bad_type" }, { status: 400 });
  }
  if ((type === "reminder" || audience === "incomplete") && (!milestone || !MILESTONE_LABEL[milestone])) {
    return NextResponse.json({ error: "milestone_required" }, { status: 400 });
  }

  const { data: company } = await supabaseAdmin.from("companies").select("name").eq("id", companyId).maybeSingle();
  const companyName = company?.name || "your company";
  const toAdmin = audience === "admin";

  // Build the email content
  let subject = "";
  let accentLabel = "Lifeline Health";
  let bodyTop = "";
  let ctaLabel: string | undefined;
  let ctaUrl: string | undefined;

  if (type === "presentation") {
    const slug = String(body?.presentation_slug || "");
    if (!slug) return NextResponse.json({ error: "presentation_required" }, { status: 400 });
    const { data: pres } = await supabaseAdmin.from("presentations").select("title, is_published").eq("slug", slug).maybeSingle();
    if (!pres?.is_published) return NextResponse.json({ error: "presentation_unavailable" }, { status: 400 });
    subject = `Lifeline onboarding — ${pres.title}`;
    accentLabel = "Onboarding";
    bodyTop = `<p style="margin:0 0 14px;">Here is the Lifeline onboarding presentation for <b>${escapeHtml(companyName)}</b>. It opens on any device — no login needed.</p>`;
    ctaLabel = "Open presentation";
    ctaUrl = `${BASE}/present/${encodeURIComponent(slug)}`;
  } else if (type === "reminder") {
    const label = MILESTONE_LABEL[milestone!];
    subject = `Reminder: ${label} — Lifeline`;
    accentLabel = "Reminder";
    bodyTop = toAdmin
      ? `<p style="margin:0 0 14px;">A reminder for <b>${escapeHtml(companyName)}</b>: please nudge your team to complete their <b>${escapeHtml(label)}</b> so we can keep the health assessment on track.</p>`
      : `<p style="margin:0 0 14px;">This is a friendly reminder to complete your <b>${escapeHtml(label)}</b> as part of your Lifeline health assessment.</p>`;
    ctaLabel = milestone === "app_access" ? "Get the app" : "Open my account";
    ctaUrl = `${BASE}/account`;
  } else {
    subject = String(body?.subject || "").trim();
    const message = String(body?.message || "").trim();
    if (!subject || !message) return NextResponse.json({ error: "subject_and_message_required" }, { status: 400 });
    accentLabel = "Lifeline Health";
    bodyTop = `<p style="margin:0 0 14px;white-space:pre-wrap;">${escapeHtml(message)}</p>`;
  }

  const buildHtml = (firstName: string | null) => {
    const greeting = firstName ? `<p style="margin:0 0 12px;">Hi ${escapeHtml(firstName)},</p>` : "";
    return renderBrandedEmail({
      title: subject,
      accentLabel,
      accentTone: "emerald",
      bodyHtml: greeting + bodyTop,
      ctaLabel,
      ctaUrl,
      footerNote: "Questions? Just reply to this email.",
    });
  };
  // The greeting line only shows for employee audiences (admin emails
  // are addressed to one named contact without a first-name greeting).
  const sampleName = toAdmin ? null : "Anna";

  // Preview: render the email without sending or resolving recipients.
  if (mode === "preview") {
    return NextResponse.json({ ok: true, subject, preview_html: buildHtml(sampleName) });
  }

  // Test: send only to the signed-in staff member.
  if (mode === "test") {
    const myEmail = user.email;
    if (!myEmail) return NextResponse.json({ error: "no_self_email" }, { status: 400 });
    const res = await sendEmail({ to: myEmail, subject: `[TEST] ${subject}`, html: buildHtml(sampleName) });
    if (!res.ok) return NextResponse.json({ error: res.error || "send_failed" }, { status: 502 });
    return NextResponse.json({ ok: true, test_to: myEmail, sent: 1 });
  }

  // Resolve recipients (send mode)
  let recipients: Array<{ email: string; full_name: string | null }> = [];
  if (toAdmin) {
    const e = await adminEmail(companyId);
    if (e) recipients = [{ email: e, full_name: null }];
  } else if (audience === "incomplete") {
    recipients = await incompleteRecipients(companyId, milestone!);
  } else {
    const { data: members } = await supabaseAdmin
      .from("company_members").select("full_name, email").eq("company_id", companyId).not("email", "is", null);
    recipients = (members || []).map((m) => ({ email: m.email as string, full_name: (m.full_name as string | null) ?? null }));
  }
  const seen = new Set<string>();
  recipients = recipients.filter((r) => r.email && !seen.has(r.email.toLowerCase()) && seen.add(r.email.toLowerCase()));
  if (recipients.length === 0) return NextResponse.json({ error: "no_recipients" }, { status: 400 });

  let sent = 0;
  const failed: string[] = [];
  await Promise.all(recipients.map(async (r) => {
    const res = await sendEmail({ to: r.email, subject, html: buildHtml(r.full_name ? r.full_name.split(" ")[0] : null) });
    if (res.ok) sent++; else failed.push(r.email);
  }));

  return NextResponse.json({ ok: true, sent, failed_count: failed.length, recipients: recipients.length });
}
