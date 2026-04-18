import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail, renderBloodTestDaysEmail } from "@/lib/email";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body?.company_id;
  const days: string[] = Array.isArray(body?.days) ? body.days : [];
  const notes: string | null = body?.notes || null;
  if (!companyId || !days.length) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, contact_person_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const isPrimary = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  let isCoAdmin = false;
  if (!isPrimary && !staff) {
    const { data: ca } = await supabaseAdmin
      .from("company_admins").select("user_id")
      .eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
    isCoAdmin = !!ca;
  }
  if (!isPrimary && !staff && !isCoAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = days.map((day) => ({
    company_id: companyId,
    day,
    notes,
    created_by: user.id,
  }));
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("blood_test_days")
    .upsert(rows, { onConflict: "company_id, day", ignoreDuplicates: true })
    .select("day");
  if (insErr) {
    console.error("[blood-test-days] insert", insErr);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // Broadcast the full current approved-day list (not just the new inserts)
  const { data: allDays } = await supabaseAdmin
    .from("blood_test_days")
    .select("day")
    .eq("company_id", companyId)
    .gte("day", new Date().toISOString().slice(0, 10))
    .order("day");
  const dayLabels = (allDays || []).map((d: { day: string }) =>
    new Date(d.day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
  );

  const { data: members } = await supabaseAdmin
    .from("company_members")
    .select("full_name, email, completed_at")
    .eq("company_id", companyId)
    .not("completed_at", "is", null);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://lifelinehealth.is";
  const portalUrl = `${origin.replace(/\/$/, "")}/account`;

  let sent = 0, failed = 0;
  const list = (members || []) as Array<{ full_name: string; email: string }>;
  const CONCURRENCY = 5;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const slice = list.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map(async (m) => {
      const { text, html } = renderBloodTestDaysEmail({
        recipientName: (m.full_name || "").split(" ")[0] || "there",
        companyName: company.name,
        dayLabels,
        portalUrl,
      });
      const r = await sendEmail({
        to: m.email,
        subject: `Blood-test days approved at ${company.name}`,
        text, html,
      });
      if (r.ok) sent++; else failed++;
    }));
  }

  return NextResponse.json({ ok: true, added: inserted?.length ?? 0, recipients: list.length, sent, failed });
}
