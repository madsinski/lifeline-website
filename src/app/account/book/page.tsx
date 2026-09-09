"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createStraumurCharge, STRAUMUR_BRAND } from "@/lib/straumur";
import { PACKAGES, type PackageKey, type PackageDef } from "@/lib/assessment-packages";
import { cleanKennitala, formatKennitala, isValidKennitala } from "@/lib/kennitala";
import {
  UNION_FUNDS,
  OTHER_UNION_CODE,
  findUnionFund,
  grantForBooking,
  unionGrantConsentText,
  pendingFundNote,
  type UnionFund,
} from "@/lib/union-grants";

type Stage = "package" | "schedule" | "grant" | "review" | "pay" | "done";

/** Bearer token for our own API routes — they read Authorization, not cookies. */
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function BookAssessmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>}>
      <BookAssessmentContent />
    </Suspense>
  );
}

function BookAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeBookingId = searchParams.get("resume");
  const [authChecking, setAuthChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  // B2B employees can book self-paid extras between employer rounds.
  // When true we surface a small banner so they understand the context.
  const [isB2BEmployee, setIsB2BEmployee] = useState(false);
  // Company snapshot for payments rows — null for personal accounts.
  const [employerCompany, setEmployerCompany] = useState<{ id: string; name: string | null } | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("package");

  // Scroll to top whenever the user advances (or goes back) through the
  // booking stages — otherwise long forms leave the next stage's heading
  // off-screen and users miss it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);
  const [selectedPkg, setSelectedPkg] = useState<PackageKey | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotAt, setSelectedSlotAt] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Union grant (stéttarfélagsstyrkur). The member declares their fund and
  // consents; the server recomputes the discount and is the authority on the
  // amount actually charged — see /api/bookings/grant.
  const [unionCode, setUnionCode] = useState<string | null>(null);
  const [kennitala, setKennitala] = useState("");
  const [grantConsent, setGrantConsent] = useState(false);
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  /** Server-confirmed grant. Null until the grant stage has been submitted. */
  const [confirmedGrantIsk, setConfirmedGrantIsk] = useState<number | null>(null);

  const pkg = useMemo(() => PACKAGES.find((p) => p.key === selectedPkg) ?? null, [selectedPkg]);
  const needsVisit = selectedPkg !== "self-checkin";
  const grantEligible = !!pkg && pkg.priceIsk > 0;
  const selectedFund = useMemo(() => findUnionFund(unionCode), [unionCode]);
  /** Optimistic preview shown on the grant stage; the server has the final say. */
  const previewGrantIsk = useMemo(
    () => grantForBooking(selectedFund, selectedPkg, pkg?.priceIsk ?? 0),
    [selectedFund, selectedPkg, pkg],
  );
  const grantIsk = confirmedGrantIsk ?? 0;
  const payableIsk = Math.max(0, (pkg?.priceIsk ?? 0) - grantIsk);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/account/login?next=/account/book"); return; }
      setUserId(user.id);
      setEmail(user.email || "");
      const { data } = await supabase.from("clients_decrypted").select("full_name, phone, company_id").eq("id", user.id).maybeSingle();
      if (data) {
        setFullName((data.full_name as string) || "");
        setPhone((data.phone as string | null) || null);
        const companyId = (data as { company_id?: string | null }).company_id || null;
        setIsB2BEmployee(!!companyId);
        if (companyId) {
          const { data: co } = await supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle();
          if (co) setEmployerCompany({ id: co.id as string, name: (co.name as string) || null });
        }
      }
      // Guard: if the user already has an active PAID booking, they can't
      // silently start a new one — we won't auto-cancel paid bookings. Route
      // them back to dashboard where the Cancel booking button enforces the
      // 48-hour refund policy. The ?resume=<id> flow is exempt because it's
      // picking up the user's existing draft.
      if (!resumeBookingId) {
        const { data: paidActive } = await supabase
          .from("body_comp_bookings")
          .select("id, scheduled_at")
          .eq("client_id", user.id)
          .eq("payment_status", "paid")
          .in("status", ["requested", "confirmed"])
          .gt("amount_isk", 0)
          .limit(1)
          .maybeSingle();
        if (paidActive) {
          const sched = (paidActive as { scheduled_at?: string | null }).scheduled_at;
          const hoursUntil = sched ? (new Date(sched).getTime() - Date.now()) / 3_600_000 : Infinity;
          const msg = hoursUntil >= 48
            ? "You already have a paid booking. Cancel it from your dashboard first to get a full refund, then book a new package."
            : "You already have a paid booking less than 48 hours away. Email contact@lifelinehealth.is to change or refund it.";
          alert(msg);
          router.push("/account");
          return;
        }
      }

      // Cancel stale drafts that have NO station_slot claim. A draft with a
      // slot claim has already reached the Review/Pay stage — another tab
      // might be mid-payment, and cancelling here would race their handlePay.
      // handlePay's own re-select already protects against that edge case,
      // but we still keep drafts-with-slots alive for 24h instead of 30min
      // so the user's ?resume flow works for longer.
      const cutoffFast = new Date(Date.now() - 30 * 60_000).toISOString();
      const cutoffSlow = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      // 1) Fast cutoff: drafts that never claimed a slot (abandoned at
      //    package/schedule stage).
      const { data: candidates } = await supabase
        .from("body_comp_bookings")
        .select("id")
        .eq("client_id", user.id)
        .eq("payment_status", "pending")
        .eq("status", "requested")
        .lt("created_at", cutoffFast);
      const candidateIds = (candidates || []).map((r) => (r as { id: string }).id);
      if (candidateIds.length > 0) {
        const { data: claimed } = await supabase
          .from("station_slots")
          .select("booking_id")
          .in("booking_id", candidateIds)
          .is("completed_at", null);
        const claimedIds = new Set((claimed || []).map((r) => (r as { booking_id: string }).booking_id));
        const unclaimedIds = candidateIds.filter((id) => !claimedIds.has(id));
        if (unclaimedIds.length > 0) {
          await supabase
            .from("body_comp_bookings")
            .update({ status: "cancelled" })
            .in("id", unclaimedIds);
        }
      }
      // 2) Slow cutoff: drafts with station_slot claims older than 24h.
      //    That's long enough that the user has clearly abandoned payment,
      //    and beyond that the slot should go back into the pool.
      await supabase
        .from("body_comp_bookings")
        .update({ status: "cancelled" })
        .eq("client_id", user.id)
        .eq("payment_status", "pending")
        .eq("status", "requested")
        .lt("created_at", cutoffSlow);

      // Release ONLY orphaned station_slot claims — those whose referenced
      // body_comp_booking is cancelled. Preserve admin-set claims (booking_id
      // is null) and claims tied to still-active bookings.
      const { data: mySlot } = await supabase
        .from("station_slots")
        .select("id, booking_id")
        .eq("client_id", user.id)
        .is("completed_at", null)
        .maybeSingle();
      if (mySlot?.booking_id) {
        const { data: backing } = await supabase
          .from("body_comp_bookings")
          .select("status")
          .eq("id", mySlot.booking_id)
          .maybeSingle();
        if (!backing || backing.status === "cancelled") {
          // Targeted release — don't touch other claims the user may hold.
          await supabase.rpc("release_station_slot_by_id", { p_slot_id: mySlot.id });
        }
      }

      // Resume flow: if ?resume=<id> is set and the booking belongs to the
      // current user and is still pending, jump straight to the pay stage.
      if (resumeBookingId) {
        const { data: existing } = await supabase
          .from("body_comp_bookings")
          .select("id, package, scheduled_at, location, amount_isk, payment_status, status")
          .eq("id", resumeBookingId)
          .eq("client_id", user.id)
          .maybeSingle();
        if (existing && existing.status === "requested" && existing.payment_status === "pending") {
          const pkgKey = (existing as Record<string, unknown>).package as "foundational" | "checkin" | "self-checkin" | null;
          if (pkgKey) {
            setSelectedPkg(pkgKey);
            setSelectedSlotAt((existing as Record<string, unknown>).scheduled_at as string | null);
            setSelectedLocation((existing as Record<string, unknown>).location as string | null);
            setBookingId(existing.id as string);
            setStage(pkgKey === "self-checkin" ? "done" : "pay");
          }
        }
      }
      setAuthChecking(false);
    })();
  }, [router, resumeBookingId]);

  async function createBooking(): Promise<string | null> {
    if (!userId || !pkg) return null;
    const payload = {
      client_id: userId,
      scheduled_at: needsVisit ? selectedSlotAt : null,
      location: needsVisit ? (selectedLocation || "Lifeline station, Reykjavík") : null,
      // RLS on this table only allows the client to set status to
      // 'requested' or 'cancelled'; staff flips it to 'confirmed'.
      status: "requested" as const,
      notes: notes.trim() || null,
      package: pkg.key,
      amount_isk: pkg.priceIsk,
      payment_status: pkg.priceIsk === 0 ? "paid" as const : "pending" as const,
      paid_at: pkg.priceIsk === 0 ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase.from("body_comp_bookings").insert(payload).select("id").single();
    if (error) { setPaymentError(error.message); return null; }
    return data?.id ?? null;
  }

  /**
   * Leaving the grant stage. `skip` covers both "I'm not in one of these
   * unions" and backing out after having applied a grant — in the latter case
   * we tell the server to void the claim so the booking goes back to list
   * price rather than staying quietly discounted.
   */
  async function handleGrantContinue(skip: boolean) {
    setGrantError(null);

    if (skip) {
      const hadGrant = (confirmedGrantIsk ?? 0) > 0;
      setUnionCode(null);
      setKennitala("");
      setGrantConsent(false);
      setConfirmedGrantIsk(0);
      if (hadGrant && bookingId) {
        setGrantSaving(true);
        await fetch("/api/bookings/grant", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({ bookingId, clear: true }),
        }).catch(() => {});
        setGrantSaving(false);
      }
      setStage("review");
      return;
    }

    if (!unionCode) { setGrantError("Veldu stéttarfélag eða haltu áfram án styrks."); return; }
    if (!isValidKennitala(kennitala)) { setGrantError("Kennitalan er ekki gild. Sláðu inn tíu tölustafi."); return; }
    if (!grantConsent) { setGrantError("Þú þarft að samþykkja að við sækjum styrkinn fyrir þig."); return; }

    setGrantSaving(true);
    const id = bookingId ?? (await createBooking());
    if (!id) { setGrantSaving(false); return; }
    setBookingId(id);

    try {
      const res = await fetch("/api/bookings/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({
          bookingId: id,
          unionCode,
          kennitala: cleanKennitala(kennitala),
          consent: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { grantIsk?: number; error?: string };
      if (!res.ok) {
        setGrantError(
          json.error === "invalid_kennitala" ? "Kennitalan er ekki gild."
            : json.error === "already_paid" ? "Bókunin er þegar greidd."
            : "Ekki tókst að skrá styrkinn. Reyndu aftur eða haltu áfram án hans.",
        );
        setGrantSaving(false);
        return;
      }
      setConfirmedGrantIsk(typeof json.grantIsk === "number" ? json.grantIsk : 0);
    } catch {
      setGrantError("Ekki náðist samband. Reyndu aftur eða haltu áfram án styrks.");
      setGrantSaving(false);
      return;
    }

    setGrantSaving(false);
    setStage("review");
  }

  async function handleReviewContinue() {
    // For paid packages, we create the booking up-front so we have a stable
    // reference to pass to Straumur. For free (Self Check-in), we still
    // mirror a zero-amount Straumur record into the payments ledger so
    // every B2C booking is linked to a payment provider entry.
    if (!pkg) return;
    if (pkg.priceIsk === 0) {
      const id = await createBooking();
      if (!id || !userId) return;
      setBookingId(id);
      const paidAt = new Date().toISOString();
      const reference = `selfcheckin-${id}`;
      // Stamp the booking with Straumur as the provider (zero-amount charge).
      await supabase
        .from("body_comp_bookings")
        .update({ payment_provider: "straumur", payment_reference: reference })
        .eq("id", id);
      // Mirror into the unified payments ledger (consistent with paid packages).
      await supabase.from("payments").insert({
        owner_type: "client",
        owner_id: userId,
        owner_company_id: employerCompany?.id ?? null,
        owner_company_name: employerCompany?.name ?? null,
        amount_isk: 0,
        currency: "ISK",
        description: `Lifeline Health — ${pkg.name}`,
        provider: "straumur",
        provider_reference: reference,
        status: "succeeded",
        related_type: "body_comp_booking",
        related_id: id,
        paid_at: paidAt,
      });
      // Fire-and-forget booking confirmation email (Self Check-in flow).
      fetch("/api/bookings/confirmed", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ bookingId: id }),
      }).catch(() => {});
      setStage("done");
      return;
    }
    const id = bookingId ?? (await createBooking());
    if (!id) return;
    setBookingId(id);

    // Atomically claim the station slot for this booking. If it was taken
    // between "I chose it" and "I clicked Continue", the RPC fails and we
    // send the user back to the schedule step with a clear error.
    if (needsVisit && selectedSlotId) {
      let { data: claim, error: claimErr } = await supabase.rpc("book_station_slot", {
        p_slot_id: selectedSlotId,
        p_booking_id: id,
      });
      let row = Array.isArray(claim) ? claim[0] : claim;

      // 'already_booked' means the user already has an active station claim.
      // A CONFIRMED booking (by staff) or a PAID booking is protected — we
      // refuse to touch it and point the user at the dashboard. Only unpaid
      // drafts in 'requested' state can be swapped.
      if (row && row.ok === false && row.error === "already_booked") {
        const { data: otherActive } = await supabase
          .from("body_comp_bookings")
          .select("id, payment_status, status")
          .eq("client_id", userId!)
          .neq("id", id)
          .in("status", ["requested", "confirmed"]);
        const protectedBookings = (otherActive || []).filter((b) => {
          const r = b as { payment_status?: string; status?: string };
          return r.payment_status === "paid" || r.status === "confirmed";
        });
        if (protectedBookings.length > 0) {
          setPaymentError(
            "You already have an active measurement booking. Go to your dashboard to manage it, or email contact@lifelinehealth.is for help.",
          );
          await supabase.from("body_comp_bookings").update({ status: "cancelled" }).eq("id", id);
          setBookingId(null);
          setStage("schedule");
          return;
        }
        const ok = typeof window !== "undefined" && window.confirm(
          "You already have a draft measurement booking. Cancel the old draft and use this new time instead?",
        );
        if (ok) {
          // Cancel each unpaid draft through the atomic RPC so the station
          // claim is released per-booking — no more bulk release that could
          // stomp on an unrelated legitimate slot.
          for (const b of otherActive || []) {
            const rr = b as { id: string; payment_status?: string; status?: string };
            if (rr.payment_status === "pending" && rr.status === "requested") {
              await supabase.rpc("refund_and_cancel_booking", {
                p_booking_id: rr.id,
                p_include_checkin_addon: false,
              });
            }
          }
          ({ data: claim, error: claimErr } = await supabase.rpc("book_station_slot", {
            p_slot_id: selectedSlotId,
            p_booking_id: id,
          }));
          row = Array.isArray(claim) ? claim[0] : claim;
        }
      }

      if (claimErr || (row && row.ok === false)) {
        const code = row?.error;
        setPaymentError(
          code === "slot_unavailable" ? "That time slot was just taken. Please pick another."
            : code === "already_booked" ? "You already have a measurement booking. Cancel it first from your dashboard, then try again."
            : claimErr?.message || "Could not reserve your time slot. Please try again."
        );
        // Roll THIS draft back. Don't bulk-release — any slot the user still
        // holds belongs to a different (legit) booking and is protected by
        // the earlier already_booked check above.
        await supabase.from("body_comp_bookings").update({ status: "cancelled" }).eq("id", id);
        setBookingId(null);
        setStage("schedule");
        return;
      }
    }

    setStage("pay");
  }

  async function handlePay() {
    if (!pkg || !bookingId || !userId) return;
    setPaying(true);
    setPaymentError(null);

    // Re-select the booking first — another tab or admin may have cancelled
    // it while the user was on the pay stage. Paying a cancelled booking
    // would leave the payments ledger and the booking status inconsistent.
    const { data: current } = await supabase
      .from("body_comp_bookings")
      .select("status, payment_status")
      .eq("id", bookingId)
      .maybeSingle();
    if (!current || current.status !== "requested" || current.payment_status !== "pending") {
      setPaymentError("Your booking is no longer payable — it may have been cancelled in another tab. Please start over.");
      setPaying(false);
      setStage("schedule");
      return;
    }

    const res = await createStraumurCharge({
      amountIsk: payableIsk,
      reference: bookingId,
      description: grantIsk > 0
        ? `Lifeline Health — ${pkg.name} (styrkur ${grantIsk.toLocaleString("is-IS")} kr. dreginn frá)`
        : `Lifeline Health — ${pkg.name}`,
      customer: { name: fullName || email, email, phone },
      returnUrl: typeof window !== "undefined" ? `${window.location.origin}/account/book?stage=done&booking=${bookingId}` : "",
    });
    if (!res.ok) {
      setPaymentError(res.error);
      setPaying(false);
      return;
    }

    // Insert the payments row FIRST — it's the canonical record of the
    // charge. The unique partial index on (related_type, related_id) where
    // status='succeeded' makes this idempotent: a double-click or stale
    // retry whose prior attempt actually succeeded will fail here with a
    // 23505 (unique_violation), which we treat as "already paid, just
    // continue".
    const paidAt = new Date().toISOString();
    const { error: payErr } = await supabase.from("payments").insert({
      owner_type: "client",
      owner_id: userId,
      owner_company_id: employerCompany?.id ?? null,
      owner_company_name: employerCompany?.name ?? null,
      // The ledger records what the client actually paid. The fund's share is
      // a receivable tracked separately in union_grant_claims, not a payment.
      amount_isk: payableIsk,
      currency: "ISK",
      description: grantIsk > 0
        ? `Lifeline Health — ${pkg.name} (stéttarfélagsstyrkur ${grantIsk.toLocaleString("is-IS")} kr.)`
        : `Lifeline Health — ${pkg.name}`,
      provider: "straumur",
      provider_reference: res.providerReference,
      status: "succeeded",
      related_type: "body_comp_booking",
      related_id: bookingId,
      paid_at: paidAt,
    });
    const duplicate = payErr && (payErr as { code?: string }).code === "23505";
    if (payErr && !duplicate) {
      setPaymentError(`Payment recorded but ledger write failed: ${payErr.message}. Please email contact@lifelinehealth.is.`);
      setPaying(false);
      return;
    }

    // Now update the booking. RLS restricts status to 'requested'/'cancelled'
    // so we leave status alone; staff flip it to 'confirmed' later.
    const { error: upErr } = await supabase
      .from("body_comp_bookings")
      .update({
        payment_status: "paid",
        payment_provider: "straumur",
        payment_reference: res.providerReference,
        paid_at: paidAt,
      })
      .eq("id", bookingId)
      .eq("payment_status", "pending");
    if (upErr) {
      setPaymentError(`Payment succeeded but booking update failed: ${upErr.message}. We'll reconcile — email contact@lifelinehealth.is with your booking id ${bookingId}.`);
      setPaying(false);
      return;
    }

    // Fire-and-forget booking confirmation email + receipt PDF. Both routes
    // authenticate off the Authorization header, so the token has to go with
    // them — without it they 401 and the client silently gets neither.
    const authed = { "Content-Type": "application/json", ...(await authHeader()) };
    fetch("/api/bookings/confirmed", {
      method: "POST",
      headers: authed,
      body: JSON.stringify({ bookingId }),
    }).catch(() => {});

    // Generate the receipt PDF and stamp payments.pdf_url so it appears in
    // the BillingPanel.
    fetch("/api/bookings/receipt", {
      method: "POST",
      headers: authed,
      body: JSON.stringify({ bookingId }),
    }).catch(() => {});

    setPaying(false);
    setStage("done");
  }

  if (authChecking) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#ecfdf5]">
      <main className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-8">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-1">Book your assessment</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">{pkg ? pkg.name : "Choose your package"}</h1>
          </div>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-semibold text-[#1F2937] hover:bg-gray-50 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>
        </header>

        {isB2BEmployee && stage === "package" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-semibold mb-1">This is an extra self-paid check-in</div>
              <p className="leading-relaxed text-amber-900/90">
                Your employer covers your standard Lifeline rounds — we&apos;ll email you when the next one opens. Anything you book here is an <strong>extra you pay for yourself</strong>, on top of what your employer provides. You can still take the employer round when it opens.
              </p>
            </div>
          </div>
        )}

        <StageIndicator stage={stage} includeGrant={grantEligible} />

        {stage === "package" && (
          <PackageStage
            selected={selectedPkg}
            onSelect={(k) => setSelectedPkg(k)}
            onContinue={() => selectedPkg && setStage("schedule")}
          />
        )}

        {stage === "schedule" && pkg && (
          <ScheduleStage
            pkg={pkg}
            needsVisit={needsVisit}
            selectedSlotId={selectedSlotId}
            selectedSlotAt={selectedSlotAt}
            notes={notes}
            error={paymentError}
            onPickSlot={(id, at, loc) => {
              setSelectedSlotId(id); setSelectedSlotAt(at); setSelectedLocation(loc);
              setPaymentError(null);
            }}
            setNotes={setNotes}
            onBack={() => setStage("package")}
            onContinue={() => setStage(grantEligible ? "grant" : "review")}
          />
        )}

        {stage === "grant" && pkg && (
          <GrantStage
            pkg={pkg}
            unionCode={unionCode}
            fund={selectedFund}
            previewGrantIsk={previewGrantIsk}
            kennitala={kennitala}
            consent={grantConsent}
            saving={grantSaving}
            error={grantError}
            onPickUnion={(code) => { setUnionCode(code); setGrantConsent(false); setGrantError(null); }}
            setKennitala={setKennitala}
            setConsent={setGrantConsent}
            onBack={() => setStage("schedule")}
            onContinue={() => handleGrantContinue(false)}
            onSkip={() => handleGrantContinue(true)}
          />
        )}

        {stage === "review" && pkg && (
          <ReviewStage
            pkg={pkg}
            needsVisit={needsVisit}
            selectedSlotAt={selectedSlotAt}
            selectedLocation={selectedLocation}
            notes={notes}
            fullName={fullName}
            email={email}
            grantIsk={grantIsk}
            grantFundName={grantIsk > 0 ? selectedFund?.name ?? null : null}
            payableIsk={payableIsk}
            onBack={() => setStage(grantEligible ? "grant" : "schedule")}
            onContinue={handleReviewContinue}
            error={paymentError}
          />
        )}

        {stage === "pay" && pkg && (
          <PayStage
            payableIsk={payableIsk}
            grantIsk={grantIsk}
            grantFundName={grantIsk > 0 ? selectedFund?.name ?? null : null}
            paying={paying}
            error={paymentError}
            onBack={() => setStage("review")}
            onPay={handlePay}
          />
        )}

        {stage === "done" && pkg && (
          <DoneStage pkg={pkg} needsVisit={needsVisit} selectedSlotAt={selectedSlotAt} selectedLocation={selectedLocation} />
        )}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function StageIndicator({ stage, includeGrant }: { stage: Stage; includeGrant: boolean }) {
  const steps: Array<{ key: Stage; label: string }> = [
    { key: "package", label: "Package" },
    { key: "schedule", label: "Schedule" },
    ...(includeGrant ? [{ key: "grant" as Stage, label: "Union grant" }] : []),
    { key: "review", label: "Review" },
    { key: "pay", label: "Payment" },
    { key: "done", label: "Done" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === stage);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
              done ? "bg-emerald-500 text-white"
              : active ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-400"
            }`}>
              {done ? "✓" : i + 1}
            </span>
            <span className={`font-medium ${active ? "text-[#0F172A]" : "text-[#64748B]"}`}>{s.label}</span>
            {i < steps.length - 1 && <span className="text-gray-300">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function PackageStage({
  selected, onSelect, onContinue,
}: {
  selected: PackageKey | null;
  onSelect: (k: PackageKey) => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#475569] leading-relaxed">
        Pick the package that fits. Most people start with Foundational Health; Check-in is for follow-up rounds; Self Check-in is free and remote.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {PACKAGES.map((p) => {
          const isSelected = selected === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onSelect(p.key)}
              className={`relative overflow-hidden rounded-2xl border-2 bg-white shadow-sm text-left transition-all ${
                isSelected ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${p.accent}`} />
              <div className="p-5">
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 mb-3">{p.tag}</div>
                <h3 className="text-lg font-bold text-[#0F172A]">{p.name}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#0F172A]">
                    {p.priceIsk === 0 ? "Free" : p.priceIsk.toLocaleString("is-IS")}
                  </span>
                  {p.priceIsk > 0 && <span className="text-xs font-medium text-[#64748B]">ISK · one-time</span>}
                </div>
                <p className="text-sm text-[#475569] mt-2 leading-relaxed">{p.summary}</p>
                <ul className="mt-3 space-y-1">
                  {p.includes.map((x) => (
                    <li key={x} className="flex items-start gap-1.5 text-xs text-[#334155]">
                      <svg className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${p.dot}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          disabled={!selected}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
        >
          Continue
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

type StationSlotRow = {
  id: string;
  slot_at: string;
  duration_minutes: number;
  location: string | null;
};

function ScheduleStage({
  pkg, needsVisit, selectedSlotId, selectedSlotAt, notes, error,
  onPickSlot, setNotes,
  onBack, onContinue,
}: {
  pkg: PackageDef;
  needsVisit: boolean;
  selectedSlotId: string | null;
  selectedSlotAt: string | null;
  notes: string;
  error: string | null;
  onPickSlot: (id: string, at: string, location: string | null) => void;
  setNotes: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [slots, setSlots] = useState<StationSlotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!needsVisit) { setLoading(false); return; }
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("station_slots")
        .select("id, slot_at, duration_minutes, location")
        .is("client_id", null)
        .gt("slot_at", nowIso)
        .order("slot_at", { ascending: true })
        .limit(80);
      setSlots((data || []) as StationSlotRow[]);
      setLoading(false);
    })();
  }, [needsVisit]);

  const grouped = useMemo(() => {
    const map = new Map<string, StationSlotRow[]>();
    for (const s of slots) {
      const day = new Date(s.slot_at).toISOString().slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const canContinue = !needsVisit || !!selectedSlotId;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{pkg.name}</div>
        <h2 className="text-lg font-semibold text-[#0F172A]">
          {needsVisit ? "Pick an available time" : "Start your self check-in"}
        </h2>
        <p className="text-sm text-[#64748B] mt-1">
          {needsVisit
            ? "Only real open slots are shown. Remember to fast from midnight the night before your visit — water only."
            : "Free and remote. You can start the questionnaire from the confirmation screen."}
        </p>
      </div>

      {needsVisit && (
        loading ? (
          <div className="text-sm text-gray-500">Loading slots…</div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center text-sm text-gray-600">
            No open slots right now. We&apos;ll open new times shortly — please check back, or email{" "}
            <a href="mailto:contact@lifelinehealth.is" className="text-[#10B981] font-semibold hover:underline">contact@lifelinehealth.is</a>.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([day, daySlots]) => (
              <div key={day}>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                  {new Date(day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {daySlots.map((s) => {
                    const selected = s.id === selectedSlotId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onPickSlot(s.id, s.slot_at, s.location)}
                        className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors text-center ${
                          selected ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/40"
                        }`}
                      >
                        <div>{new Date(s.slot_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}</div>
                        <div className="text-[10px] text-gray-500">{s.duration_minutes} min</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {selectedSlotId && selectedSlotAt && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-900">
                Selected:{" "}
                <strong>
                  {new Date(selectedSlotAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                </strong>
              </div>
            )}
          </div>
        )
      )}

      <label className="block">
        <span className="text-xs font-medium text-gray-600">Notes for our team (optional)</span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
          placeholder="Anything we should know?"
        />
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-[#1F2937] hover:bg-gray-50 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
        >
          Review
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function GrantStage({
  pkg, unionCode, fund, previewGrantIsk, kennitala, consent, saving, error,
  onPickUnion, setKennitala, setConsent, onBack, onContinue, onSkip,
}: {
  pkg: PackageDef;
  unionCode: string | null;
  fund: UnionFund | null;
  previewGrantIsk: number;
  kennitala: string;
  consent: boolean;
  saving: boolean;
  error: string | null;
  onPickUnion: (code: string) => void;
  setKennitala: (v: string) => void;
  setConsent: (v: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  // A live fund is one we have a signed direct-settlement agreement with —
  // only those produce a discount. Everything else records the declaration.
  const isLive = previewGrantIsk > 0;
  const picked = !!unionCode;
  const net = Math.max(0, pkg.priceIsk - previewGrantIsk);
  const ktValid = isValidKennitala(kennitala);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Stéttarfélagsstyrkur</h2>
        <p className="text-sm text-[#64748B] mt-1 leading-relaxed">
          Flest stéttarfélög taka þátt í kostnaði við heilsufarsmat. Veldu félagið þitt — ef við
          erum með beingreiðslusamning við sjóðinn dregst styrkurinn frá strax og þú þarft ekki
          að sækja um neitt.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {UNION_FUNDS.map((f) => {
          const active = unionCode === f.code;
          return (
            <button
              key={f.code}
              type="button"
              onClick={() => onPickUnion(f.code)}
              aria-pressed={active}
              className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${
                active ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/40" : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-sm font-semibold text-[#0F172A]">{f.name}</div>
              <div className="text-[11px] text-[#64748B] mt-0.5">{f.region}</div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onPickUnion(OTHER_UNION_CODE)}
          aria-pressed={unionCode === OTHER_UNION_CODE}
          className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${
            unionCode === OTHER_UNION_CODE ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/40" : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="text-sm font-semibold text-[#0F172A]">Annað stéttarfélag</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Við skráum félagið og semjum næst</div>
        </button>
      </div>

      {picked && isLive && fund && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm space-y-1.5">
            <div className="flex items-center justify-between text-[#334155]">
              <span>{pkg.name}</span>
              <span>{pkg.priceIsk.toLocaleString("is-IS")} kr.</span>
            </div>
            <div className="flex items-center justify-between font-medium text-emerald-700">
              <span>Styrkur frá {fund.name}</span>
              <span>−{previewGrantIsk.toLocaleString("is-IS")} kr.</span>
            </div>
            <div className="h-px bg-emerald-200 my-1" />
            <div className="flex items-center justify-between font-bold text-[#0F172A] text-base">
              <span>Þú greiðir</span>
              <span>{net.toLocaleString("is-IS")} kr.</span>
            </div>
            <p className="text-[11px] text-emerald-900/80 pt-1">
              Skilyrði sjóðsins: {fund.seniority} Styrkurinn er í boði á {fund.periodMonths} mánaða fresti.
            </p>
          </div>

          <div>
            <label htmlFor="grant-kennitala" className="block text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-1.5">
              Kennitala
            </label>
            <input
              id="grant-kennitala"
              inputMode="numeric"
              autoComplete="off"
              value={formatKennitala(kennitala)}
              onChange={(e) => setKennitala(cleanKennitala(e.target.value).slice(0, 10))}
              placeholder="000000-0000"
              className={`w-full sm:w-56 rounded-lg border px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 ${
                kennitala.length === 10 && !ktValid
                  ? "border-red-300 focus:ring-red-100"
                  : "border-gray-200 focus:ring-blue-100 focus:border-blue-400"
              }`}
            />
            <p className="text-[11px] text-[#64748B] mt-1.5">
              Sjóðurinn þarf kennitöluna til að staðfesta aðild þína. Hún er dulkóðuð hjá okkur.
            </p>
            {kennitala.length === 10 && !ktValid && (
              <p className="text-[11px] text-red-600 mt-1">Kennitalan stenst ekki gilt form.</p>
            )}
          </div>

          <label className="flex items-start gap-2.5 text-sm text-[#334155] cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#10B981] focus:ring-[#10B981]"
            />
            <span className="leading-relaxed">{unionGrantConsentText(fund.name)}</span>
          </label>
        </div>
      )}

      {picked && !isLive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-relaxed">
          {pendingFundNote(fund?.name ?? "þínu félagi")}
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-[#1F2937] hover:bg-gray-50 shadow-sm disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Til baka
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A] underline underline-offset-2 disabled:opacity-50"
          >
            Ég er ekki í stéttarfélagi
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={saving || !picked || (isLive && (!ktValid || !consent))}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? "Skrái…" : "Áfram"}
            {!saving && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function ReviewStage({
  pkg, needsVisit, selectedSlotAt, selectedLocation, notes, fullName, email,
  grantIsk, grantFundName, payableIsk,
  onBack, onContinue, error,
}: {
  pkg: PackageDef;
  needsVisit: boolean;
  selectedSlotAt: string | null;
  selectedLocation: string | null;
  notes: string;
  fullName: string;
  email: string;
  grantIsk: number;
  grantFundName: string | null;
  payableIsk: number;
  onBack: () => void;
  onContinue: () => void;
  error: string | null;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
      <h2 className="text-lg font-semibold text-[#0F172A]">Review your booking</h2>

      <div className="rounded-xl border border-gray-100 bg-[#f8fafc] p-4 space-y-2 text-sm">
        <Row label="Package" value={pkg.name} />
        {needsVisit && selectedSlotAt && (
          <Row
            label="When"
            value={new Date(selectedSlotAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
          />
        )}
        {needsVisit && <Row label="Where" value={selectedLocation || "Lifeline station, Reykjavík"} />}
        <Row label="Name" value={fullName || "—"} />
        <Row label="Email" value={email} />
        {notes && <Row label="Notes" value={notes} />}
      </div>

      {pkg.priceIsk > 0 ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm space-y-1.5">
          {grantIsk > 0 && (
            <>
              <div className="flex items-center justify-between text-[#475569]">
                <span>{pkg.name}</span>
                <span>{pkg.priceIsk.toLocaleString("is-IS")} ISK</span>
              </div>
              {/* The member should see that their union paid — that visibility
                  is part of what the fund is buying from us. */}
              <div className="flex items-center justify-between text-emerald-700 font-medium">
                <span>Styrkur frá {grantFundName ?? "stéttarfélagi"}</span>
                <span>−{grantIsk.toLocaleString("is-IS")} ISK</span>
              </div>
              <div className="h-px bg-blue-100 my-1" />
            </>
          )}
          <div className="flex items-center justify-between font-semibold text-[#0F172A]">
            <span>{grantIsk > 0 ? "Þú greiðir" : "Total"}</span>
            <span>{payableIsk.toLocaleString("is-IS")} ISK</span>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Healthcare services are exempt from VAT in Iceland (Act 50/1988).
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-900">
          Free — no payment needed.
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-[#1F2937] hover:bg-gray-50 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95"
        >
          {pkg.priceIsk > 0 ? "Continue to payment" : "Confirm"}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#64748B]">{label}</span>
      <span className="font-medium text-[#0F172A] text-right">{value}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function PayStage({
  payableIsk, grantIsk, grantFundName, paying, error, onBack, onPay,
}: {
  payableIsk: number;
  grantIsk: number;
  grantFundName: string | null;
  paying: boolean;
  error: string | null;
  onBack: () => void;
  onPay: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Secure payment</h2>
        <p className="text-sm text-[#64748B] mt-1">
          Powered by {STRAUMUR_BRAND.name}. Supports {STRAUMUR_BRAND.cardsSupported.join(", ")}.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-200 bg-[#f8fafc] p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">
          <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
          </svg>
          Straumur payment
        </div>
        <p className="text-sm text-[#475569]">
          The Straumur checkout will open here once the API is connected. For now, click the button below to simulate payment and continue.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
          <strong>Test mode:</strong> no real charge is made. Your booking will be marked paid for internal testing.
        </div>
        {grantIsk > 0 && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-900">
            {grantFundName ?? "Stéttarfélagið þitt"} greiðir {grantIsk.toLocaleString("is-IS")} kr. beint til okkar.
            Þú greiðir aðeins mismuninn og þarft ekki að sækja um neitt.
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-[#64748B]">Charge amount</span>
          <span className="font-semibold text-[#0F172A]">{payableIsk.toLocaleString("is-IS")} ISK</span>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onBack}
          disabled={paying}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-[#1F2937] hover:bg-gray-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button
          type="button"
          onClick={onPay}
          disabled={paying}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95 disabled:opacity-60"
        >
          {paying && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {paying ? "Processing…" : `Pay ${payableIsk.toLocaleString("is-IS")} ISK`}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function DoneStage({
  pkg, needsVisit, selectedSlotAt, selectedLocation,
}: {
  pkg: PackageDef;
  needsVisit: boolean;
  selectedSlotAt: string | null;
  selectedLocation: string | null;
}) {
  const when = selectedSlotAt
    ? new Date(selectedSlotAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false })
    : "";
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm bg-white p-8 sm:p-10 text-center">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#10B981] to-[#3B82F6]" />
      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm mb-4">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-[#0F172A]">You&apos;re booked.</h2>
      <p className="text-sm text-[#475569] mt-2 max-w-md mx-auto leading-relaxed">
        {needsVisit
          ? `See you at ${selectedLocation || "the Lifeline station"} on ${when}. We'll email you a reminder the day before.`
          : `Your ${pkg.name} is ready. Start the questionnaire from your dashboard whenever you're ready.`}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <a
          href="/account"
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95 shadow-sm"
        >
          Go to dashboard
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
