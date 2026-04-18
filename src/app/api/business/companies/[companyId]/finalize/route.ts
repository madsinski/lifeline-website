import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail, renderFinalizeStaffEmail, renderFinalizeContactEmail } from "@/lib/email";

export const maxDuration = 30;

// Action: "confirm_roster" OR "finalize"
// (roster-confirm is lighter weight; finalize is the final action that
// notifies staff and flips the company to 'ready'.)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action: "confirm_roster" | "finalize" | "unfinalize" = body?.action || "finalize";

  // Authz: primary / co-admin / staff
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, contact_person_id, roster_confirmed_at, registration_finalized_at")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const isPrimary = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  let isCoAdmin = false;
  if (!isPrimary && !staff) {
    const { data: ca } = await supabaseAdmin
      .from("company_admins")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();
    isCoAdmin = !!ca;
  }
  if (!isPrimary && !staff && !isCoAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (action === "confirm_roster") {
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ roster_confirmed_at: new Date().toISOString() })
      .eq("id", companyId);
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ ok: true, roster_confirmed_at: new Date().toISOString() });
  }

  if (action === "unfinalize") {
    if (!staff) return NextResponse.json({ error: "staff_only" }, { status: 403 });
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ registration_finalized_at: null, registration_finalized_by: null })
      .eq("id", companyId);
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // action === "finalize": require all three steps done
  const [{ count: eventCount }, { count: bloodDayCount }, { count: memberCount }] = await Promise.all([
    supabaseAdmin.from("body_comp_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("event_date", new Date().toISOString().slice(0, 10)),
    supabaseAdmin.from("blood_test_days")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("day", new Date().toISOString().slice(0, 10)),
    supabaseAdmin.from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
  ]);

  if (!company.roster_confirmed_at) {
    return NextResponse.json({ error: "roster_not_confirmed" }, { status: 400 });
  }
  if (!eventCount) {
    return NextResponse.json({ error: "no_body_comp_event" }, { status: 400 });
  }
  if (!bloodDayCount) {
    return NextResponse.json({ error: "no_blood_test_days" }, { status: 400 });
  }

  const finalizedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("companies")
    .update({ registration_finalized_at: finalizedAt, registration_finalized_by: user.id })
    .eq("id", companyId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  // Notify staff + contact person (non-blocking; log on failure)
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://lifelinehealth.is";
  try {
    const { data: staffList } = await supabaseAdmin
      .from("staff").select("email").eq("active", true);
    const staffEmails = (staffList || []).map((s: { email: string | null }) => s.email).filter(Boolean) as string[];
    const { data: contactUser } = await supabaseAdmin.auth.admin.getUserById(company.contact_person_id);
    const contactEmail = contactUser?.user?.email || "";
    const contactName = (contactUser?.user?.user_metadata?.full_name || "").split(" ")[0] || "there";

    if (staffEmails.length) {
      const { text, html } = renderFinalizeStaffEmail({
        companyName: company.name,
        contactEmail,
        memberCount: memberCount || 0,
        eventCount: eventCount || 0,
        bloodDayCount: bloodDayCount || 0,
        adminUrl: `${origin.replace(/\/$/, "")}/admin/companies`,
      });
      await Promise.all(staffEmails.map((to) =>
        sendEmail({ to, subject: `[Lifeline B2B] ${company.name} is ready`, text, html }),
      ));
    }
    if (contactEmail) {
      const { text, html } = renderFinalizeContactEmail({
        recipientName: contactName,
        companyName: company.name,
        portalUrl: `${origin.replace(/\/$/, "")}/business/${companyId}`,
      });
      await sendEmail({ to: contactEmail, subject: `Your Lifeline registration for ${company.name} is complete`, text, html });
    }
  } catch (e) {
    console.error("[finalize] notify failed:", (e as Error).message);
  }

  return NextResponse.json({
    ok: true,
    registration_finalized_at: finalizedAt,
    staff_notified: true,
  });
}
