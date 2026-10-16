import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAAL2, gateError } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

// Called by /admin/bookings to resolve a refund request in ONE server step:
//   { requestId, decision: "approve", amount, adminNote }
//       → admin_cancel_booking RPC (run as the caller, so its auth.uid()
//         staff check still applies) → refund_requests row → approved
//   { requestId, decision: "deny", adminNote } → row → denied
// and only after that succeeded, email the client. Without `decision` it
// just (re)sends the email for an already-resolved request.
//
// Gate: write-authorized staff + AAL2 (requireAdminAAL2).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmliZnh6bHR4aXJpcXh2dnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQxMDgsImV4cCI6MjA5MDQ1MDEwOH0.LHBADsUdW7SBtrxZ9KikTmAl5brBGPb3gFTMuPYrmD8";

export const maxDuration = 20;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") return gateError(user);

  const body = await req.json().catch(() => ({}));
  const requestId = (body?.requestId || "").trim();
  if (!requestId) return NextResponse.json({ error: "requestId_required" }, { status: 400 });
  const decision: string | undefined = body?.decision;
  const adminNote: string | null = typeof body?.adminNote === "string" && body.adminNote.trim() ? body.adminNote.trim().slice(0, 2000) : null;
  let refundedIsk: number | null = null;

  if (decision === "approve" || decision === "deny") {
    const { data: pending } = await supabaseAdmin
      .from("refund_requests")
      .select("id, booking_id, status, reason, include_checkin_addon")
      .eq("id", requestId)
      .maybeSingle();
    if (!pending) return NextResponse.json({ error: "Beiðnin fannst ekki." }, { status: 404 });
    if (pending.status !== "pending") {
      return NextResponse.json({ error: "Búið er að afgreiða þessa beiðni." }, { status: 409 });
    }

    if (decision === "approve") {
      const amount = Number(body?.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ error: "Ógild endurgreiðsluupphæð." }, { status: 400 });
      }
      if (!pending.booking_id) {
        return NextResponse.json({ error: "Beiðnin tengist ekki bókun — afgreiddu hana handvirkt." }, { status: 400 });
      }
      /* Claim first: only the request that moves pending → approved here
         runs the refund, so two clicks or two admins can never refund twice. */
      const now = new Date().toISOString();
      const { data: claimed } = await supabaseAdmin.from("refund_requests")
        .update({ status: "approved", approved_isk: Math.round(amount), admin_note: adminNote, resolved_at: now, resolved_by: user.id })
        .eq("id", requestId).eq("status", "pending").select("id");
      if (!claimed?.length) return NextResponse.json({ error: "Búið er að afgreiða þessa beiðni." }, { status: 409 });

      // Run the RPC as the caller so its own auth.uid() staff check applies.
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await asCaller.rpc("admin_cancel_booking", {
        p_booking_id: pending.booking_id,
        p_reason: `Refund request approved: ${pending.reason ?? ""}${adminNote ? ` — ${adminNote}` : ""}`,
        p_refund_isk: Math.round(amount),
        p_include_checkin_addon: !!pending.include_checkin_addon,
      });
      const r = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; error?: string; refunded_isk?: number } | null;
      if (error || (r && r.ok === false)) {
        console.error("[bookings/refund-request-resolved] cancel failed", error?.code ?? r?.error);
        // Nothing was refunded: put the request back so it can be retried.
        await supabaseAdmin.from("refund_requests")
          .update({ status: "pending", approved_isk: null, resolved_at: null, resolved_by: null })
          .eq("id", requestId).eq("status", "approved");
        return NextResponse.json({ error: "Ekki tókst að afbóka og endurgreiða." }, { status: 500 });
      }
      refundedIsk = r?.refunded_isk ?? 0;
    } else {
      // Deny: one atomic pending → denied step; nothing else to undo.
      const { data: updated, error: updErr } = await supabaseAdmin
        .from("refund_requests")
        .update({ status: "denied", admin_note: adminNote, resolved_at: new Date().toISOString(), resolved_by: user.id })
        .eq("id", requestId)
        .eq("status", "pending")
        .select("id");
      if (updErr || !updated?.length) {
        console.error("[bookings/refund-request-resolved] deny failed", updErr?.code);
        return NextResponse.json({ error: updated && !updated.length ? "Búið er að afgreiða þessa beiðni." : "Ekki tókst að hafna beiðninni." }, { status: updated && !updated.length ? 409 : 500 });
      }
    }
  }

  const { data: rr } = await supabaseAdmin
    .from("refund_requests")
    .select("id, client_id, booking_id, status, approved_isk, requested_isk, admin_note, resolved_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!rr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (rr.status !== "approved" && rr.status !== "denied") {
    return NextResponse.json({ error: "not_resolved" }, { status: 400 });
  }

  const { data: client } = await supabaseAdmin
    .from("clients_decrypted")
    .select("full_name, email")
    .eq("id", rr.client_id)
    .maybeSingle();
  if (!client?.email) return NextResponse.json({ ok: true, refunded_isk: refundedIsk, notified: false, skipped: "no_client_email" });

  const { data: booking } = rr.booking_id ? await supabaseAdmin
    .from("body_comp_bookings")
    .select("scheduled_at, package")
    .eq("id", rr.booking_id)
    .maybeSingle() : { data: null };

  const pkgLabel = booking?.package === "foundational" ? "Foundational Health"
    : booking?.package === "checkin" ? "Check-in"
    : booking?.package === "self-checkin" ? "Self Check-in"
    : "your booking";
  const when = booking?.scheduled_at ? new Date(booking.scheduled_at).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Atlantic/Reykjavik" }) : "";

  const approved = rr.status === "approved";
  const approvedAmount = rr.approved_isk ?? 0;
  const hello = `Hi ${escapeHtml(client.full_name?.split(" ")[0] || "there")},`;

  const subject = approved
    ? `Your Lifeline cancellation is approved — refund ${approvedAmount.toLocaleString("is-IS")} ISK`
    : `About your Lifeline cancellation request`;

  const bodyHtml = approved ? `
    <p style="margin:0 0 14px;">${hello}</p>
    <p style="margin:0 0 14px;">We've approved your cancellation for <strong>${escapeHtml(pkgLabel)}</strong>${when ? ` on ${escapeHtml(when)}` : ""}.</p>
    <p style="margin:0 0 14px;">We're refunding <strong>${approvedAmount.toLocaleString("is-IS")} ISK</strong> to the card you used. It usually lands within 3–5 business days, depending on your bank.</p>
    ${rr.admin_note ? `<p style="margin:18px 0;padding:12px 14px;background:#F1F5F9;border-radius:8px;font-size:13px;color:#334155;"><strong>Note from us:</strong> ${escapeHtml(rr.admin_note)}</p>` : ""}
    <p style="margin:0;">If you'd like to rebook, just visit your dashboard when you're ready — no rush.</p>
  ` : `
    <p style="margin:0 0 14px;">${hello}</p>
    <p style="margin:0 0 14px;">Thanks for your cancellation request for <strong>${escapeHtml(pkgLabel)}</strong>${when ? ` on ${escapeHtml(when)}` : ""}.</p>
    <p style="margin:0 0 14px;">We're not able to approve a refund in this case${rr.admin_note ? ":" : "."}</p>
    ${rr.admin_note ? `<p style="margin:0 0 14px;padding:12px 14px;background:#FEF2F2;border-left:3px solid #DC2626;font-size:13.5px;color:#334155;">${escapeHtml(rr.admin_note)}</p>` : ""}
    <p style="margin:0;">Your booking is still on the calendar. If there's anything we can do to help you make it, please reply to this email and we'll try our best.</p>
  `;

  const html = renderBrandedEmail({
    title: approved ? "We've processed your refund" : "About your cancellation request",
    preheader: approved ? `Refund of ${approvedAmount.toLocaleString("is-IS")} ISK on the way.` : "We've reviewed your request.",
    accentLabel: approved ? "Refund approved" : "Request reviewed",
    accentTone: approved ? "emerald" : "red",
    bodyHtml,
    ctaLabel: approved ? "Open dashboard" : undefined,
    ctaUrl: approved ? "https://www.lifelinehealth.is/account" : undefined,
    footerNote: "Questions? Reply to this email or contact@lifelinehealth.is.",
  });

  const text = approved
    ? `${hello}\n\nWe've approved your cancellation for ${pkgLabel}${when ? ` on ${when}` : ""}.\n\nWe're refunding ${approvedAmount.toLocaleString("is-IS")} ISK to your card — usually within 3–5 business days.\n\n${rr.admin_note ? `Note: ${rr.admin_note}\n\n` : ""}Reply here or email contact@lifelinehealth.is with questions.\n\n— Lifeline Health`
    : `${hello}\n\nThanks for the cancellation request for ${pkgLabel}${when ? ` on ${when}` : ""}.\n\nWe're not able to approve a refund in this case.${rr.admin_note ? `\n\nNote: ${rr.admin_note}` : ""}\n\nYour booking is still on the calendar. Reply here if we can help.\n\n— Lifeline Health`;

  const result = await sendEmail({ to: client.email, subject, html, text });
  if (!result.ok) {
    console.error("[bookings/refund-request-resolved] email failed");
    return NextResponse.json({ ok: true, refunded_isk: refundedIsk, notified: false, notify_error: "Beiðnin var afgreidd en ekki tókst að senda skjólstæðingi tölvupóst." });
  }

  return NextResponse.json({ ok: true, refunded_isk: refundedIsk, notified: true });
}
