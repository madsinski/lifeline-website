// Employer health-check codes, managed by the company admin on
// /business/[companyId]. One code per employee; the employee enters it at
// checkout in their own Lifeline account and the company is invoiced.
//
// GET → codes + roster link status
// POST { member_ids?: string[], all?: boolean, email?: boolean,
//        contribution_percent?: 0–100, contribution_isk?: number } → issue
//      codes for members without one (optionally email them)
// DELETE ?code_id= → revoke an unredeemed code
// Auth: company contact person, a co-admin, or active staff.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { newCompanyCode } from "@/lib/hc/codes";
import { siteOrigin } from "@/lib/hc/server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function authorize(req: NextRequest, companyId: string) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const [{ data: company }, { data: coAdmin }, { data: staff }] = await Promise.all([
    supabaseAdmin.from("companies").select("id, name, contact_person_id, agreement_signed_at").eq("id", companyId).maybeSingle(),
    supabaseAdmin.from("company_admins").select("user_id").eq("company_id", companyId).eq("user_id", user.id).maybeSingle(),
    supabaseAdmin.from("staff").select("id").eq("id", user.id).eq("active", true).maybeSingle(),
  ]);
  if (!company) return null;
  if (company.contact_person_id !== user.id && !coAdmin && !staff) return null;
  return { user, company, isStaff: !!staff };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await ctx.params;
  const a = await authorize(req, companyId);
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: codes } = await supabaseAdmin
    .from("company_hc_codes")
    .select("id, member_id, code, package_key, redeemed_at, expires_at, revoked_at, emailed_at, created_at, contribution_percent, contribution_isk")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return NextResponse.json({ codes: codes || [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await ctx.params;
  const a = await authorize(req, companyId);
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!a.company.agreement_signed_at && !a.isStaff) {
    return NextResponse.json({ error: "Undirrita þarf þjónustusamning áður en kóðar eru gefnir út." }, { status: 409 });
  }
  const b = await req.json().catch(() => ({}));

  let q = supabaseAdmin.from("company_members").select("id, full_name, email").eq("company_id", companyId);
  if (!b.all) {
    const ids: string[] = Array.isArray(b.member_ids) ? b.member_ids.filter((x: unknown) => typeof x === "string") : [];
    if (!ids.length) return NextResponse.json({ error: "member_ids or all required" }, { status: 400 });
    q = q.in("id", ids);
  }
  const { data: members } = await q;
  const { data: existing } = await supabaseAdmin
    .from("company_hc_codes")
    .select("member_id")
    .eq("company_id", companyId)
    .is("revoked_at", null);
  const has = new Set((existing || []).map((c) => c.member_id));
  const targets = (members || []).filter((m) => !has.has(m.id));

  const expires = new Date(Date.now() + 365 * 86400_000).toISOString();
  // How much the company pays: everything (default), a share, or a fixed amount.
  const pct = Number.isFinite(Number(b.contribution_percent)) ? Math.max(0, Math.min(100, Math.round(Number(b.contribution_percent)))) : 100;
  const fixed = b.contribution_isk != null && b.contribution_isk !== "" && Number.isFinite(Number(b.contribution_isk)) ? Math.max(0, Math.round(Number(b.contribution_isk))) : null;
  const created: { id: string; member_id: string; code: string }[] = [];
  for (const m of targets) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await supabaseAdmin
        .from("company_hc_codes")
        .insert({ company_id: companyId, member_id: m.id, code: newCompanyCode(), expires_at: expires, created_by: a.user.id, contribution_percent: pct, contribution_isk: fixed })
        .select("id, member_id, code")
        .single();
      if (data) { created.push(data); break; }
      if (error?.code !== "23505") break;
    }
  }

  let emailed = 0;
  if (b.email) {
    const origin = siteOrigin(req);
    const byId = new Map((members || []).map((m) => [m.id, m]));
    for (const c of created) {
      const m = byId.get(c.member_id);
      if (!m?.email) continue;
      const signup = `${origin}/account/login?mode=signup&next=${encodeURIComponent("/account/heilsuferd")}`;
      const r = await sendEmail({
        to: m.email,
        subject: `${a.company.name} býður þér í heilsufarsskoðun`,
        html: renderBrandedEmail({
          title: `${a.company.name} greiðir heilsufarsskoðunina þína`,
          accentLabel: "Kóðinn þinn",
          bodyHtml: `<p style="margin:0 0 12px;">Hæ ${escapeHtml((m.full_name || "").split(" ")[0] || "")},</p>
            <p style="margin:0 0 12px;">${escapeHtml(a.company.name)} býður þér heilsufarsskoðun hjá Lifeline Health. Stofnaðu frían aðgang, veldu heilsufarsskoðunina og veldu „Vinnuveitandinn minn tekur þátt“ í greiðsluskrefinu. Sláðu þar inn kóðann:</p>
            <div style="font-family:ui-monospace,monospace;font-size:24px;letter-spacing:.12em;text-align:center;background:#ECFDF5;border-radius:10px;padding:14px;margin:16px 0;color:#065F46;font-weight:700;">${c.code}</div>
            <p style="margin:0 0 12px;">${fixed != null ? `Fyrirtækið greiðir ${fixed.toLocaleString("is-IS")} kr. af verðinu.` : pct < 100 ? `Fyrirtækið greiðir ${pct}% af verðinu.` : "Fyrirtækið greiðir alla skoðunina."} Ef stéttarfélagið þitt tekur þátt getur þú líka valið það.</p><p style="margin:0;">Kóðinn er persónulegur og gildir í eitt ár. ${escapeHtml(a.company.name)} sér aldrei heilsufarsupplýsingar þínar.</p>`,
          ctaLabel: "Taka fyrsta skrefið",
          ctaUrl: signup,
        }),
        text: `${a.company.name} býður þér heilsufarsskoðun hjá Lifeline. Kóðinn þinn: ${c.code}. Byrjaðu hér: ${signup}`,
      });
      if (r.ok) {
        emailed++;
        await supabaseAdmin.from("company_hc_codes").update({ emailed_at: new Date().toISOString() }).eq("id", c.id);
      }
    }
  }
  return NextResponse.json({ created: created.length, emailed, skipped: (members || []).length - targets.length });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await ctx.params;
  const a = await authorize(req, companyId);
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const codeId = req.nextUrl.searchParams.get("code_id");
  const { data, error } = await supabaseAdmin
    .from("company_hc_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", codeId || "")
    .eq("company_id", companyId)
    .is("redeemed_at", null)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length) return NextResponse.json({ error: "Kóðinn hefur verið notaður eða fannst ekki." }, { status: 409 });
  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
