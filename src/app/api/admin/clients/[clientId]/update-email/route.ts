// Change a CLIENT's login email (admin only).
//
// A login email is the key to the account: whoever controls it can reset the
// password. So this is admin + MFA (requireAdminAAL2), refuses staff
// accounts outright (an admin's login is never changed from here), checks
// the id is a client, tells BOTH the old and the new address, and is audited.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import { hcAudit } from "@/lib/hc/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const gate = await requireAdminAAL2(req);
  if (typeof gate === "string") {
    return NextResponse.json({ error: gate }, { status: gate === "unauthorized" ? 401 : 403 });
  }
  const { clientId } = await params;

  const { email } = await req.json().catch(() => ({ email: "" }));
  const newEmail = typeof email === "string" ? email.trim().replace(/[\r\n]/g, "").toLowerCase() : "";
  if (!EMAIL_RE.test(newEmail)) return NextResponse.json({ error: "Netfangið er ekki gilt." }, { status: 400 });

  const [{ data: staffRow }, { data: client }, { data: au }] = await Promise.all([
    supabaseAdmin.from("staff").select("id").eq("id", clientId).maybeSingle(),
    supabaseAdmin.from("clients_decrypted").select("id").eq("id", clientId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(clientId),
  ]);
  if (staffRow) return NextResponse.json({ error: "Netfangi starfsmanns er ekki breytt hér." }, { status: 403 });
  if (!client || !au?.user) return NextResponse.json({ error: "Skjólstæðingur fannst ekki." }, { status: 404 });
  const oldEmail = au.user.email ?? null;
  if (oldEmail && oldEmail.toLowerCase() === newEmail) return NextResponse.json({ ok: true, email: newEmail });

  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(clientId, { email: newEmail, email_confirm: true });
  if (authErr) return NextResponse.json({ error: "Ekki tókst að breyta netfanginu (er það þegar í notkun?)." }, { status: 400 });

  const { error: rowErr } = await supabaseAdmin.from("clients_decrypted").update({ email: newEmail }).eq("id", clientId);
  if (rowErr) console.error("[admin] client email row update failed", rowErr.code);

  await hcAudit(`staff:${gate.id}`, "client_login_email_changed", null, { client_id: clientId });

  // Both addresses hear about it: a change the owner did not ask for is
  // noticed at the old one, and the new one learns it now signs in there.
  const note = (to: string, isOld: boolean) => sendEmail({
    to,
    subject: "Netfanginu á Lifeline aðganginum þínum var breytt",
    html: renderBrandedEmail({
      title: "Netfanginu var breytt",
      bodyHtml: `<p style="margin:0 0 12px;">${isOld
        ? "Netfanginu sem þú notar til að skrá þig inn hjá Lifeline var breytt af starfsmanni Lifeline."
        : "Þetta netfang er nú innskráningarnetfangið þitt hjá Lifeline."}</p><p style="margin:0;">Ef þú baðst ekki um þetta, hafðu strax samband á contact@lifelinehealth.is.</p>`,
    }),
    text: `${isOld ? "Netfanginu sem þú notar til að skrá þig inn hjá Lifeline var breytt." : "Þetta netfang er nú innskráningarnetfangið þitt hjá Lifeline."} Ef þú baðst ekki um þetta, hafðu samband á contact@lifelinehealth.is.`,
  }).catch(() => null);
  await Promise.all([oldEmail ? note(oldEmail, true) : null, note(newEmail, false)]);

  return NextResponse.json({ ok: true, email: newEmail, row_updated: !rowErr });
}
