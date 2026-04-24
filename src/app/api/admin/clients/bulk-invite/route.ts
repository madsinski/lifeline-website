import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff, findAuthUserByEmail } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/audit";

// Admin-only bulk invite for personal clients (no company context).
//
// Usecase: onboarding people before their employer is in the Lifeline
// system. We bulk-create auth users (unconfirmed) + clients rows, then
// send each person an Icelandic invite email with a one-click link into
// /account/onboard. Biody is NOT activated here — it happens naturally
// when the user completes the onboarding wizard with real sex, height,
// DOB and activity level. No placeholder Biody records to clean up.

export const maxDuration = 120;

type Invitee = {
  full_name?: string;
  email?: string;
  phone?: string;
  kennitala?: string;      // optional; only last 4 is stored
  sex?: "male" | "female"; // optional; user completes on onboard
};

type ResultRow = {
  email: string;
  status: "invited" | "resent" | "skipped_already_completed" | "failed";
  error?: string;
};

const RESERVED_DOMAINS = /^(example|test|invalid)\.(com|org|io)$/i;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderIcelandicInvite(args: {
  firstName: string;
  actionUrl: string;
}) {
  const bodyHtml = `
    <p style="margin:0 0 14px;">Hæ ${escapeHtml(args.firstName)},</p>
    <p style="margin:0 0 14px;">Þú hefur verið skráð/ur fyrir aðgang hjá <strong>Lifeline Health</strong>. Þú þarft að klára stutta skráningu (um 2 mínútur) áður en heilsumatið hefst.</p>
    <p style="margin:0 0 10px;font-weight:700;">Hvað gerist næst</p>
    <ol style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.7;">
      <li><strong>Samþykki</strong> — upplýst samþykki fyrir vinnslu heilsufarsupplýsinga.</li>
      <li><strong>Upplýsingar um þig</strong> — kyn, fæðingardagur, hæð, þyngd og hreyfingarstig.</li>
      <li><strong>Bókaðu heilsumatið</strong> — mælingar, blóðprufa og læknisráðgjöf.</li>
    </ol>
    <p style="margin:0 0 0;color:#64748B;font-size:12.5px;">Trúnaður. Heilsuupplýsingar þínar eru aðeins sýnilegar þér og Lifeline læknateyminu — engum öðrum.</p>
  `;
  const html = renderBrandedEmail({
    title: `Velkomin í Lifeline Health`,
    preheader: "Kláraðu skráninguna á 2 mínútum.",
    accentLabel: "Skráning hafin",
    accentTone: "emerald",
    bodyHtml,
    ctaLabel: "Byrja skráninguna",
    ctaUrl: args.actionUrl,
    footerNote: "Ef þú býst ekki við þessu skeyti geturðu hunsað það. Spurningar? Svaraðu þessum pósti eða sendu á <a href=\"mailto:contact@lifelinehealth.is\" style=\"color:#10B981;\">contact@lifelinehealth.is</a>.",
  });
  const text = `Hæ ${args.firstName},

Þú hefur verið skráð/ur fyrir aðgang hjá Lifeline Health. Kláraðu skráninguna á 2 mínútum hér:

${args.actionUrl}

Hvað gerist næst
1. Samþykki — upplýst samþykki fyrir vinnslu heilsufarsupplýsinga.
2. Upplýsingar um þig — kyn, fæðingardagur, hæð, þyngd og hreyfingarstig.
3. Bókaðu heilsumatið — mælingar, blóðprufa og læknisráðgjöf.

Heilsuupplýsingar þínar eru aðeins sýnilegar þér og Lifeline læknateyminu.

Ef þú býst ekki við þessu skeyti geturðu hunsað það.

— Lifeline Health`;
  return { html, text };
}

async function inviteOne(origin: string, row: Invitee): Promise<ResultRow> {
  const email = (row.email || "").trim().toLowerCase();
  const fullName = (row.full_name || "").trim();
  const phone = (row.phone || "").trim() || null;
  const kennitalaLast4 = (row.kennitala || "").replace(/\D/g, "").slice(-4) || null;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { email: email || "(missing)", status: "failed", error: "invalid_email" };
  }
  const domain = email.split("@")[1] || "";
  if (RESERVED_DOMAINS.test(domain)) {
    return { email, status: "failed", error: "reserved_domain" };
  }

  try {
    // Find existing auth user first — this is idempotent: rerunning the
    // same roster just resends the invite instead of erroring.
    const existing = await findAuthUserByEmail(email);
    let userId: string;
    let existedBefore = false;
    if (existing) {
      userId = existing.id;
      existedBefore = true;
      // Completed already? (has a session + set a password, or onboarded.)
      // We still let them get a fresh magic link — they might have lost it.
      const { data: clientRow } = await supabaseAdmin
        .from("clients")
        .select("welcome_seen_at")
        .eq("id", userId)
        .maybeSingle();
      if (clientRow?.welcome_seen_at) {
        return { email, status: "skipped_already_completed" };
      }
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: fullName ? { full_name: fullName, invited_by_admin: true } : { invited_by_admin: true },
      });
      if (createErr || !created?.user) {
        return { email, status: "failed", error: createErr?.message || "create_user_failed" };
      }
      userId = created.user.id;
    }

    // Upsert clients row. If it already exists we only fill in any blanks
    // (don't clobber what the user or a previous admin set).
    const nowIso = new Date().toISOString();
    const { data: existingClient } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, kennitala_last4, sex")
      .eq("id", userId)
      .maybeSingle();
    if (!existingClient) {
      await supabaseAdmin.from("clients").insert({
        id: userId,
        email,
        full_name: fullName || email.split("@")[0],
        phone,
        kennitala_last4: kennitalaLast4,
        sex: row.sex || null,
        created_at: nowIso,
        updated_at: nowIso,
      });
    } else {
      await supabaseAdmin.from("clients").update({
        full_name: existingClient.full_name || fullName || email.split("@")[0],
        phone: existingClient.phone || phone,
        kennitala_last4: existingClient.kennitala_last4 || kennitalaLast4,
        sex: existingClient.sex || row.sex || null,
        updated_at: nowIso,
      }).eq("id", userId);
    }

    // Generate the action link. 'invite' for new users (sets password
    // before continuing), 'magiclink' for existing ones that already have
    // credentials set up.
    const linkType: "invite" | "magiclink" = existedBefore ? "magiclink" : "invite";
    const { data: linkRes, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: linkType,
      email,
      options: { redirectTo: `${origin}/account/onboard` },
    });
    if (linkErr || !linkRes?.properties?.action_link) {
      return { email, status: "failed", error: linkErr?.message || "generate_link_failed" };
    }

    const firstName = (fullName.split(" ")[0] || email.split("@")[0] || "þú").trim();
    const { html, text } = renderIcelandicInvite({
      firstName,
      actionUrl: linkRes.properties.action_link,
    });
    const result = await sendEmail({
      to: email,
      subject: "Velkomin í Lifeline Health — ljúktu skráningunni",
      html,
      text,
    });
    if (!result.ok) {
      return { email, status: "failed", error: result.error || "email_send_failed" };
    }
    return { email, status: existedBefore ? "resent" : "invited" };
  } catch (e) {
    return { email, status: "failed", error: (e as Error).message };
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const invitees: Invitee[] = Array.isArray(body?.invitees) ? body.invitees : [];
  if (invitees.length === 0) return NextResponse.json({ error: "invitees_empty" }, { status: 400 });
  if (invitees.length > 200) return NextResponse.json({ error: "too_many", detail: "max 200 per batch" }, { status: 400 });

  const origin = req.headers.get("origin") || "https://www.lifelinehealth.is";
  const results: ResultRow[] = [];
  // Sequential — each call does its own auth/create/link/email. Low
  // throughput but resilient to rate limits + predictable ordering.
  for (const row of invitees) {
    results.push(await inviteOne(origin, row));
  }
  const counts = {
    invited: results.filter((r) => r.status === "invited").length,
    resent: results.filter((r) => r.status === "resent").length,
    skipped_already_completed: results.filter((r) => r.status === "skipped_already_completed").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  await logAdminAction(req, {
    actor: { id: user.id, email: user.email },
    action: "clients.bulk_invite.submit",
    target_type: "clients",
    target_id: null,
    detail: { counts, batch_size: invitees.length },
  });

  return NextResponse.json({ ok: true, counts, results });
}
