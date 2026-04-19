"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createStraumurCharge, STRAUMUR_BRAND } from "@/lib/straumur";

type PackageKey = "foundational" | "checkin" | "self-checkin";

type PackageDef = {
  key: PackageKey;
  name: string;
  tag: string;
  priceIsk: number;
  summary: string;
  includes: string[];
  accent: string;
  tone: string;
  dot: string;
};

const PACKAGES: PackageDef[] = [
  {
    key: "foundational",
    name: "Foundational Health",
    tag: "Start here",
    priceIsk: 49_900,
    summary: "A full medical-grade baseline — measurements, targeted blood work, and a doctor-led action plan.",
    includes: [
      "On-site measurements (blood pressure, body composition)",
      "Targeted blood panel",
      "Full health questionnaire",
      "Doctor-reviewed personal report",
      "1:1 doctor consultation + action plan",
    ],
    accent: "from-[#3B82F6] to-[#10B981]",
    tone: "border-blue-100 bg-blue-50/40",
    dot: "text-[#3B82F6]",
  },
  {
    key: "checkin",
    name: "Check-in",
    tag: "Follow-up",
    priceIsk: 19_900,
    summary: "A lighter round 3–12 months after the foundational — track change, refresh the plan.",
    includes: [
      "On-site measurements",
      "Progress report vs baseline",
      "Updated health score",
      "Brief doctor review",
      "Refreshed action plan",
    ],
    accent: "from-[#10B981] to-[#14B8A6]",
    tone: "border-emerald-100 bg-emerald-50/40",
    dot: "text-[#10B981]",
  },
  {
    key: "self-checkin",
    name: "Self Check-in",
    tag: "Free",
    priceIsk: 0,
    summary: "A remote questionnaire pass — no visit, track your own progress between rounds.",
    includes: [
      "Online health questionnaire",
      "Self-reported metrics",
      "Updated health score",
      "Instant insight",
      "Lifeline reaches out if anything is flagged",
    ],
    accent: "from-[#8B5CF6] to-[#0EA5E9]",
    tone: "border-violet-100 bg-violet-50/40",
    dot: "text-[#8B5CF6]",
  },
];

type Stage = "package" | "schedule" | "review" | "pay" | "done";

export default function BookAssessmentPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("package");
  const [selectedPkg, setSelectedPkg] = useState<PackageKey | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
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
      setAuthChecking(false);
    })();
  }, [router]);

  async function createBooking(): Promise<string | null> {
    if (!userId || !pkg) return null;
    const scheduledAt = needsVisit && selectedDate && selectedTime
      ? new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
      : null;
    const payload = {
      client_id: userId,
      scheduled_at: scheduledAt,
      location: needsVisit ? "Lifeline station, Reykjavík" : null,
      status: needsVisit ? "requested" as const : "confirmed" as const,
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
    // reference to pass to Straumur. For free (Self Check-in), we skip to done.
    if (!pkg) return;
    if (pkg.priceIsk === 0) {
      const id = await createBooking();
      if (!id) return;
      setBookingId(id);
      setStage("done");
      return;
    }
    const id = bookingId ?? (await createBooking());
    if (!id) return;
    setBookingId(id);
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
    const { error: upErr } = await supabase
      .from("body_comp_bookings")
      .update({
        payment_status: "paid",
        payment_provider: "straumur",
        payment_reference: res.providerReference,
        paid_at: new Date().toISOString(),
        status: "confirmed",
      })
      .eq("id", bookingId);
    if (upErr) { setPaymentError(upErr.message); setPaying(false); return; }
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
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">Foundational Health</h1>
          </div>
          <Link href="/account" className="text-sm text-[#64748B] hover:text-[#0F172A]">← Back to dashboard</Link>
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
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            notes={notes}
            setSelectedDate={setSelectedDate}
            setSelectedTime={setSelectedTime}
            setNotes={setNotes}
            onBack={() => setStage("package")}
            onContinue={() => setStage("review")}
          />
        )}

        {stage === "review" && pkg && (
          <ReviewStage
            pkg={pkg}
            needsVisit={needsVisit}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
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
          <DoneStage pkg={pkg} needsVisit={needsVisit} selectedDate={selectedDate} selectedTime={selectedTime} />
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

function nextBusinessDates(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // start tomorrow
  while (out.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const TIME_SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"];

function ScheduleStage({
  pkg, needsVisit, selectedDate, selectedTime, notes,
  setSelectedDate, setSelectedTime, setNotes,
  onBack, onContinue,
}: {
  pkg: PackageDef;
  needsVisit: boolean;
  selectedDate: string;
  selectedTime: string;
  notes: string;
  setSelectedDate: (v: string) => void;
  setSelectedTime: (v: string) => void;
  setNotes: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const dates = useMemo(() => nextBusinessDates(10), []);
  const canContinue = !needsVisit || (selectedDate && selectedTime);
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{pkg.name}</div>
        <h2 className="text-lg font-semibold text-[#0F172A]">
          {needsVisit ? "Pick a time at the Lifeline station" : "When are you doing your self check-in?"}
        </h2>
        <p className="text-sm text-[#64748B] mt-1">
          {needsVisit
            ? "Lifeline station, Reykjavík. Fast from midnight the night before your visit — water only."
            : "You can start the questionnaire now from the confirmation screen."}
        </p>
      </div>

      {needsVisit && (
        <>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-2">Date</div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {dates.map((d) => {
                const obj = new Date(d + "T00:00:00");
                const selected = d === selectedDate;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setSelectedDate(d); setSelectedTime(""); }}
                    className={`rounded-lg border px-3 py-2 text-sm text-center transition-colors ${
                      selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-[#64748B]">
                      {obj.toLocaleDateString("en-GB", { weekday: "short" })}
                    </div>
                    <div className="font-semibold">
                      {obj.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-2">Time</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {TIME_SLOTS.map((t) => {
                  const selected = t === selectedTime;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTime(t)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                        selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
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

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <button type="button" onClick={onBack} className="text-sm text-gray-600 hover:text-gray-900">← Back</button>
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
  pkg, needsVisit, selectedDate, selectedTime, notes, fullName, email,
  onBack, onContinue, error,
}: {
  pkg: PackageDef;
  needsVisit: boolean;
  selectedDate: string;
  selectedTime: string;
  notes: string;
  fullName: string;
  email: string;
  onBack: () => void;
  onContinue: () => void;
  error: string | null;
}) {
  const vatRate = 24;
  const net = pkg.priceIsk > 0 ? Math.round(pkg.priceIsk / (1 + vatRate / 100)) : 0;
  const vat = pkg.priceIsk - net;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
      <h2 className="text-lg font-semibold text-[#0F172A]">Review your booking</h2>

      <div className="rounded-xl border border-gray-100 bg-[#f8fafc] p-4 space-y-2 text-sm">
        <Row label="Package" value={pkg.name} />
        {needsVisit && selectedDate && (
          <Row
            label="When"
            value={`${new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${selectedTime}`}
          />
        )}
        {needsVisit && <Row label="Where" value="Lifeline station, Reykjavík" />}
        <Row label="Name" value={fullName || "—"} />
        <Row label="Email" value={email} />
        {notes && <Row label="Notes" value={notes} />}
      </div>

      {pkg.priceIsk > 0 ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Net</span>
            <span>{net.toLocaleString("is-IS")} ISK</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">VAT ({vatRate}%)</span>
            <span>{vat.toLocaleString("is-IS")} ISK</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-[#0F172A] pt-2 border-t border-blue-100 mt-2">
            <span>Total</span>
            <span>{pkg.priceIsk.toLocaleString("is-IS")} ISK</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-900">
          Free — no payment needed.
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <button type="button" onClick={onBack} className="text-sm text-gray-600 hover:text-gray-900">← Back</button>
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
        <button type="button" onClick={onBack} disabled={paying} className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">← Back</button>
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
  pkg, needsVisit, selectedDate, selectedTime,
}: {
  pkg: PackageDef;
  needsVisit: boolean;
  selectedDate: string;
  selectedTime: string;
}) {
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
          ? `See you at the Lifeline station on ${new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at ${selectedTime}. We'll email you a reminder the day before.`
          : `Your ${pkg.name} is ready. Start the questionnaire from your dashboard whenever you're ready.`}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/account"
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95 shadow-sm"
        >
          Go to dashboard
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
