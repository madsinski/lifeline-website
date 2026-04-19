import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export const maxDuration = 30;

const ALLOWED_INTEREST = new Set([
  "foundational",
  "checkin",
  "self-checkin",
  "coaching",
  "other",
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyName = typeof body?.company_name === "string" ? body.company_name.trim() : "";
    const contactName = typeof body?.contact_name === "string" ? body.contact_name.trim() : "";
    const contactEmail = typeof body?.contact_email === "string" ? body.contact_email.trim().toLowerCase() : "";
    const contactPhone = typeof body?.contact_phone === "string" ? body.contact_phone.trim() : "";
    const kennitala = typeof body?.kennitala === "string" ? body.kennitala.trim() : "";
    const location = typeof body?.location === "string" ? body.location.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const employeeCountRaw = body?.employee_count;
    const employeeCount = Number.isFinite(Number(employeeCountRaw)) ? Math.max(0, Math.min(100000, Number(employeeCountRaw))) : null;
    const interest: string[] = Array.isArray(body?.interest)
      ? body.interest.filter((x: unknown) => typeof x === "string" && ALLOWED_INTEREST.has(x as string)).slice(0, 10)
      : [];

    if (!companyName || !contactName || !contactEmail) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("company_inquiries")
      .insert({
        company_name: companyName.slice(0, 200),
        contact_name: contactName.slice(0, 200),
        contact_email: contactEmail.slice(0, 200),
        contact_phone: contactPhone.slice(0, 50) || null,
        kennitala: kennitala.slice(0, 20) || null,
        location: location.slice(0, 200) || null,
        employee_count: employeeCount,
        interest,
        message: message.slice(0, 4000) || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[business-inquiry] insert failed", error);
      return NextResponse.json({ error: "Could not submit. Please try again." }, { status: 500 });
    }

    // Notify Lifeline admin.
    const adminEmail = process.env.LIFELINE_ADMIN_EMAIL || "contact@lifelinehealth.is";
    try {
      const interestLine = interest.length ? interest.join(", ") : "—";
      const text = `New company inquiry

Company: ${companyName}
Kennitala: ${kennitala || "—"}
Contact: ${contactName} <${contactEmail}>
Phone: ${contactPhone || "—"}
Employees: ${employeeCount ?? "—"}
Location: ${location || "—"}
Interested in: ${interestLine}

${message || "(no message)"}

— Lifeline website`;
      const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 10px;font-size:20px;color:#111827;">New company inquiry</h1>
    <table style="border-collapse:collapse;width:100%;font-size:14px;color:#374151;">
      <tr><td style="padding:6px 0;color:#6b7280;">Company</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(companyName)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Kennitala</td><td style="padding:6px 0;">${escapeHtml(kennitala || "—")}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Contact</td><td style="padding:6px 0;">${escapeHtml(contactName)} &lt;<a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>&gt;</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;">${escapeHtml(contactPhone || "—")}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Employees</td><td style="padding:6px 0;">${employeeCount ?? "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Location</td><td style="padding:6px 0;">${escapeHtml(location || "—")}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Interested in</td><td style="padding:6px 0;">${escapeHtml(interestLine)}</td></tr>
    </table>
    ${message ? `<div style="margin-top:16px;padding:12px 14px;background:#f3f4f6;border-radius:10px;white-space:pre-wrap;font-size:14px;color:#111827;">${escapeHtml(message)}</div>` : ""}
    <p style="margin-top:20px;color:#9ca3af;font-size:12px;">Review in the admin at /admin/company-inquiries</p>
  </div>
</body></html>`;
      await sendEmail({
        to: adminEmail,
        subject: `New company inquiry: ${companyName}`,
        text,
        html,
      });
    } catch (e) {
      console.error("[business-inquiry] admin email failed", e);
    }

    return NextResponse.json({ ok: true, id: row?.id });
  } catch (e) {
    console.error("[business-inquiry] error", e);
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
