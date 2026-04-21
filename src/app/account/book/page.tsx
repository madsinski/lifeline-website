"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createStraumurCharge, STRAUMUR_BRAND } from "@/lib/straumur";
import { PACKAGES, type PackageKey, type PackageDef } from "@/lib/assessment-packages";

type Stage = "package" | "schedule" | "review" | "pay" | "done";

export default function BookAssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeBookingId = searchParams.get("resume");
  const [authChecking, setAuthChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("package");
  const [selectedPkg, setSelectedPkg] = useState<PackageKey | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotAt, setSelectedSlotAt] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const pkg = useMemo(() => PACKAGES.find((p) => p.key === selectedPkg) ?? null, [selectedPkg]);
  const needsVisit = selectedPkg !== "self-checkin";

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/account/login?next=/account/book"); return; }
      setUserId(user.id);
      setEmail(user.email || "");
      const { data } = await supabase.from("clients").select("full_name, phone").eq("id", user.id).maybeSingle();
      if (data) {
        setFullName((data.full_name as string) || "");
        setPhone((data.phone as string | null) || null);
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

      // Only cancel stale drafts (older than 30 min). Recent pending
      // bookings are kept so the user can resume via ?resume=<id>.
      const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
      await supabase
        .from("body_comp_bookings")
        .update({ status: "cancelled" })
        .eq("client_id", user.id)
        .eq("payment_status", "pending")
        .eq("status", "requested")
        .lt("created_at", cutoff);

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
          await supabase.rpc("release_station_slot");
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
      // Check whether it's backed by a paid booking — if so, we must not
      // silently cancel it (the user already paid). Only auto-release when
      // all other active bookings are pending (unpaid drafts).
      if (row && row.ok === false && row.error === "already_booked") {
        const { data: otherActive } = await supabase
          .from("body_comp_bookings")
          .select("id, payment_status, scheduled_at")
          .eq("client_id", userId!)
          .neq("id", id)
          .in("status", ["requested", "confirmed"]);
        const anyPaid = (otherActive || []).some((b) => (b as { payment_status?: string }).payment_status === "paid");
        if (anyPaid) {
          setPaymentError(
            "You already have a paid measurement booking. Go to your dashboard to manage it, or email contact@lifelinehealth.is for help.",
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
          // Only cancel unpaid drafts here — paid bookings were filtered out
          // above. Then release any lingering station_slot claim so the RPC
          // retry doesn't hit 'already_booked' again.
          await supabase
            .from("body_comp_bookings")
            .update({ status: "cancelled" })
            .eq("client_id", userId!)
            .neq("id", id)
            .eq("payment_status", "pending")
            .in("status", ["requested", "confirmed"]);
          await supabase.rpc("release_station_slot");
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
        // Roll the booking back and clear any lingering slot claim so the user
        // can pick a different time without repeatedly hitting the same error.
        await supabase.from("body_comp_bookings").update({ status: "cancelled" }).eq("id", id);
        await supabase.rpc("release_station_slot");
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
    const res = await createStraumurCharge({
      amountIsk: pkg.priceIsk,
      reference: bookingId,
      description: `Lifeline Health — ${pkg.name}`,
      customer: { name: fullName || email, email, phone },
      returnUrl: typeof window !== "undefined" ? `${window.location.origin}/account/book?stage=done&booking=${bookingId}` : "",
    });
    if (!res.ok) {
      setPaymentError(res.error);
      setPaying(false);
      return;
    }
    // Note: we intentionally leave `status` as 'requested' — the Lifeline
    // staff confirms after reviewing the booking. The client's RLS update
    // policy also restricts status to 'requested'/'cancelled', so touching
    // it here would violate the check.
    const paidAt = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("body_comp_bookings")
      .update({
        payment_status: "paid",
        payment_provider: "straumur",
        payment_reference: res.providerReference,
        paid_at: paidAt,
      })
      .eq("id", bookingId);
    if (upErr) { setPaymentError(upErr.message); setPaying(false); return; }

    // Mirror into the unified payments ledger so it shows in billing history.
    await supabase.from("payments").insert({
      owner_type: "client",
      owner_id: userId,
      amount_isk: pkg.priceIsk,
      currency: "ISK",
      description: `Lifeline Health — ${pkg.name}`,
      provider: "straumur",
      provider_reference: res.providerReference,
      status: "succeeded",
      related_type: "body_comp_booking",
      related_id: bookingId,
      paid_at: paidAt,
    });

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

        <StageIndicator stage={stage} />

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
            onContinue={() => setStage("review")}
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
            onBack={() => setStage("schedule")}
            onContinue={handleReviewContinue}
            error={paymentError}
          />
        )}

        {stage === "pay" && pkg && (
          <PayStage
            pkg={pkg}
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

function StageIndicator({ stage }: { stage: Stage }) {
  const steps: Array<{ key: Stage; label: string }> = [
    { key: "package", label: "Package" },
    { key: "schedule", label: "Schedule" },
    { key: "review", label: "Review" },
    { key: "pay", label: "Payment" },
    { key: "done", label: "Done" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === stage);
  return (
    <ol className="flex items-center gap-2 text-xs">
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

function ReviewStage({
  pkg, needsVisit, selectedSlotAt, selectedLocation, notes, fullName, email,
  onBack, onContinue, error,
}: {
  pkg: PackageDef;
  needsVisit: boolean;
  selectedSlotAt: string | null;
  selectedLocation: string | null;
  notes: string;
  fullName: string;
  email: string;
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
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm">
          <div className="flex items-center justify-between font-semibold text-[#0F172A]">
            <span>Total</span>
            <span>{pkg.priceIsk.toLocaleString("is-IS")} ISK</span>
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
  pkg, paying, error, onBack, onPay,
}: {
  pkg: PackageDef;
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
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-[#64748B]">Charge amount</span>
          <span className="font-semibold text-[#0F172A]">{pkg.priceIsk.toLocaleString("is-IS")} ISK</span>
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
          {paying ? "Processing…" : `Pay ${pkg.priceIsk.toLocaleString("is-IS")} ISK`}
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
