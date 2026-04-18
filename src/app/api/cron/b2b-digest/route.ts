import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export const maxDuration = 300;

// Protected by CRON_SECRET (Vercel Cron adds this as Authorization: Bearer <secret>)
function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // refuse to run if not configured
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // For every company, compute totals + send one email to the contact person
  const { data: companies } = await supabaseAdmin
    .from("companies")
    .select("id, name, contact_person_id");
  if (!companies?.length) return NextResponse.json({ ok: true, processed: 0 });

  const results: Array<{ company_id: string; sent: boolean; error?: string }> = [];

  for (const c of companies) {
    try {
      const [{ data: members }, { data: contact }] = await Promise.all([
        supabaseAdmin
          .from("company_members")
          .select("id, invited_at, completed_at")
          .eq("company_id", c.id),
        supabaseAdmin.auth.admin.getUserById(c.contact_person_id),
      ]);
      if (!contact?.user?.email) {
        results.push({ company_id: c.id, sent: false, error: "no contact email" });
        continue;
      }
      const total = members?.length || 0;
      const invited = members?.filter((m) => m.invited_at).length || 0;
      const completed = members?.filter((m) => m.completed_at).length || 0;
      const stale = members?.filter(
        (m) => !m.completed_at && m.invited_at &&
          Date.now() - new Date(m.invited_at).getTime() > 7 * 86_400_000
      ).length || 0;
      const uninvited = total - invited;

      if (total === 0) {
        results.push({ company_id: c.id, sent: false, error: "empty roster" });
        continue;
      }

      const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://lifelinehealth.is";
      const url = `${origin}/business/${c.id}`;
      const text = `Weekly update — ${c.name}

Roster: ${total} employees
Invited: ${invited}
Completed: ${completed}
Not yet invited: ${uninvited}
Stale (7+ days): ${stale}

Open your dashboard: ${url}

— Lifeline Health`;
      const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">${escape(c.name)} — weekly update</h1>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#4b5563;">Roster</td><td style="padding:8px 0;text-align:right;font-weight:600;">${total}</td></tr>
      <tr><td style="padding:8px 0;color:#4b5563;">Invited</td><td style="padding:8px 0;text-align:right;font-weight:600;">${invited}</td></tr>
      <tr><td style="padding:8px 0;color:#4b5563;">Completed</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#10b981;">${completed}</td></tr>
      <tr><td style="padding:8px 0;color:#4b5563;">Not yet invited</td><td style="padding:8px 0;text-align:right;font-weight:600;">${uninvited}</td></tr>
      <tr><td style="padding:8px 0;color:#4b5563;">Stale (7+ days)</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#f59e0b;">${stale}</td></tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;">Open dashboard</a>
    </div>
  </div></body></html>`;

      const send = await sendEmail({
        to: contact.user.email,
        subject: `${c.name} · Lifeline weekly update`,
        text,
        html,
      });
      results.push({ company_id: c.id, sent: send.ok, error: send.error });
    } catch (e) {
      results.push({ company_id: c.id, sent: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({
    processed: results.length,
    sent: results.filter((r) => r.sent).length,
    failed: results.filter((r) => !r.sent).length,
  });
}

function escape(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
