"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LifelineLogo from "@/app/components/LifelineLogo";
import BackButton from "@/app/components/BackButton";
import MedaliaButton from "@/app/components/MedaliaButton";
import { LanguagePicker, useI18n } from "@/lib/i18n";
import SlotPicker from "./SlotPicker";

type BiodyState = "unknown" | "active" | "activating" | "failed" | "needs_profile";

interface BodyCompEvent {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  room_notes: string | null;
  slot_minutes: number;
  slot_capacity: number;
  company_id: string;
}

interface BloodTestDay {
  id: string;
  day: string;
  notes: string | null;
}

export default function AccountWelcomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [biodyState, setBiodyState] = useState<BiodyState>("unknown");
  const [activateError, setActivateError] = useState("");
  const [events, setEvents] = useState<BodyCompEvent[]>([]);
  const [myBookingSlot, setMyBookingSlot] = useState<{ event_id: string; slot_at: string } | null>(null);
  const [bloodDays, setBloodDays] = useState<BloodTestDay[]>([]);
  const [pickerEvent, setPickerEvent] = useState<BodyCompEvent | null>(null);

  // Body-comp profile form (shown when fields are missing)
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<"sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "">("");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/account/login");
        return;
      }
      setUserId(user.id);
      const { data: client } = await supabase
        .from("clients")
        .select("full_name, company_id, biody_patient_id, sex, height_cm, weight_kg, activity_level, date_of_birth")
        .eq("id", user.id)
        .maybeSingle();
      if (client) {
        setFirstName((client.full_name || "").split(" ")[0] || "");
        const cData = client as Record<string, unknown>;
        if (cData.biody_patient_id) {
          setBiodyState("active");
        } else {
          // Check if body-comp fields are present
          const hasAll = cData.sex && cData.height_cm && cData.weight_kg && cData.activity_level && cData.date_of_birth;
          setBiodyState(hasAll ? "unknown" : "needs_profile");
          setSex((cData.sex as "male" | "female" | "") || "");
          setHeightCm(cData.height_cm ? String(cData.height_cm) : "");
          setWeightKg(cData.weight_kg ? String(cData.weight_kg) : "");
          setActivityLevel((cData.activity_level as typeof activityLevel) || "");
        }
        const cid = cData.company_id as string | null;
        if (cid) {
          setCompanyId(cid);
          const { data: c } = await supabase.from("companies").select("name").eq("id", cid).maybeSingle();
          if (c?.name) setCompanyName(c.name);
          // Upcoming body-comp events for this company
          const { data: ev } = await supabase
            .from("body_comp_events")
            .select("id, event_date, start_time, end_time, location, room_notes, slot_minutes, slot_capacity, company_id")
            .eq("company_id", cid)
            .eq("status", "scheduled")
            .gte("event_date", new Date().toISOString().slice(0, 10))
            .order("event_date");
          setEvents((ev || []) as BodyCompEvent[]);
          // My current booking (if any)
          const { data: myB } = await supabase
            .from("body_comp_event_bookings")
            .select("event_id, slot_at")
            .eq("client_id", user.id)
            .order("slot_at")
            .limit(1)
            .maybeSingle();
          if (myB) setMyBookingSlot(myB);
          // Blood test days
          const { data: bd } = await supabase
            .from("blood_test_days")
            .select("id, day, notes")
            .eq("company_id", cid)
            .gte("day", new Date().toISOString().slice(0, 10))
            .order("day");
          setBloodDays((bd || []) as BloodTestDay[]);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const saveProfileAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!sex || !heightCm || !weightKg || !activityLevel) {
      setActivateError("Please fill in every field."); return;
    }
    setProfileSaving(true);
    setActivateError("");
    try {
      const { error: upErr } = await supabase.from("clients").update({
        sex,
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        activity_level: activityLevel,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
      if (upErr) throw new Error(upErr.message);
      setBiodyState("unknown");
      // Auto-activate now that profile is complete
      await activateBiody();
    } catch (e) {
      setActivateError((e as Error).message);
      setBiodyState("needs_profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const activateBiody = async () => {
    setBiodyState("activating");
    setActivateError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/biody/activate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      setBiodyState("active");
    } else if (j.error === "missing_client_fields") {
      // Server detected missing fields — switch to the inline form
      setBiodyState("needs_profile");
      setActivateError(t("b2b.welcome.activate.need_info",
        "We need a few details before we can set up your body-composition profile."));
    } else {
      setBiodyState("failed");
      setActivateError(
        typeof j.detail === "string"
          ? j.detail
          : j.error || t("b2b.welcome.activate.failed", "Activation failed. Please contact support.")
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/70 backdrop-blur">
        <div className="flex items-center gap-4">
          <BackButton />
          <Link href="/" className="flex items-center gap-2">
            <LifelineLogo className="w-8 h-8" />
            <span className="font-semibold">Lifeline Health</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <LanguagePicker />
          <Link href="/account" className="text-sm text-gray-600 hover:text-gray-900">
            {t("b2b.welcome.skip", "Skip")} &rarr;
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <section className="rounded-2xl p-8 text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, #3B82F6, #10B981, #3B82F6)" }}>
          {companyName && (
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-90 mb-2">
              {t("b2b.welcome.hero.via", "Via {{company}}").replace("{{company}}", companyName)}
            </p>
          )}
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
            {firstName
              ? t("b2b.welcome.hero.title_name", "Welcome to Lifeline, {{name}}.").replace("{{name}}", firstName)
              : t("b2b.welcome.hero.title", "Welcome to Lifeline.")}
          </h1>
          <p className="mt-3 text-base opacity-95 max-w-xl">
            {t("b2b.welcome.hero.body",
              "You're all set up. Three quick things and you're ready to start building healthier habits with guidance from Icelandic physicians and coaches.")}
          </p>
        </section>

        {/* Intro video */}
        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-3">{t("b2b.welcome.intro.title", "A 90-second intro to Lifeline")}</h2>
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 via-white to-emerald-100 flex items-center justify-center border border-gray-100">
            <div className="text-center px-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-white/80 flex items-center justify-center shadow-sm mb-2">
                <svg className="w-6 h-6 text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="text-sm text-gray-600">{t("b2b.welcome.intro.coming", "Intro video — coming soon")}</div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            {t("b2b.welcome.intro.body",
              "Lifeline Health combines targeted assessments with daily coaching across four pillars — exercise, nutrition, sleep, mental wellness. You'll do a body-composition scan at a Lifeline station, receive a personalised report from a physician, and follow a tailored daily plan in the app.")}
          </p>
        </section>

        {/* Step-by-step */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("b2b.welcome.steps.heading", "Your next steps")}</h2>

          {biodyState === "needs_profile" ? (
            <div className="bg-white rounded-xl p-5 shadow-sm ring-1 ring-amber-200">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold text-sm shrink-0">1</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {t("b2b.welcome.step.activate.title", "Activate your body-composition profile")}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 mb-4">
                    {t("b2b.welcome.activate.need_info",
                      "We need a few details before we can set up your body-composition profile.")}
                  </p>
                  <form onSubmit={saveProfileAndActivate} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-700 mb-1">{t("b2b.onboard.profile.sex", "Sex")}</span>
                        <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female" | "")} required className="input">
                          <option value="">{t("b2b.onboard.profile.select", "Select…")}</option>
                          <option value="female">{t("b2b.onboard.profile.sex.female", "Female")}</option>
                          <option value="male">{t("b2b.onboard.profile.sex.male", "Male")}</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-700 mb-1">{t("b2b.onboard.profile.activity", "Activity level")}</span>
                        <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as "sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "")} required className="input">
                          <option value="">{t("b2b.onboard.profile.select", "Select…")}</option>
                          <option value="sedentary">{t("b2b.onboard.profile.activity.sedentary", "Sedentary — little or no exercise")}</option>
                          <option value="light">{t("b2b.onboard.profile.activity.light", "Light — exercise 1–3 days/week")}</option>
                          <option value="moderate">{t("b2b.onboard.profile.activity.moderate", "Moderate — exercise 3–5 days/week")}</option>
                          <option value="very_active">{t("b2b.onboard.profile.activity.very_active", "Very active — exercise 6–7 days/week")}</option>
                          <option value="extra_active">{t("b2b.onboard.profile.activity.extra_active", "Extra active — daily intense training")}</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-700 mb-1">{t("b2b.onboard.profile.height", "Height (cm)")}</span>
                        <input type="number" min={100} max={230} step={1} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required className="input" />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-700 mb-1">{t("b2b.onboard.profile.weight", "Weight (kg)")}</span>
                        <input type="number" min={30} max={300} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required className="input" />
                      </label>
                    </div>
                    {activateError && <div className="text-red-600 text-xs">{activateError}</div>}
                    <button type="submit" disabled={profileSaving} className="btn-primary-solid">
                      {profileSaving
                        ? t("b2b.welcome.step.activate.activating", "Activating…")
                        : t("b2b.welcome.activate.save_and_activate", "Save & activate")}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <StepCard
              n={1}
              title={t("b2b.welcome.step.activate.title", "Activate your body-composition profile")}
              body={t("b2b.welcome.step.activate.body",
                "Register yourself with our measurement partner Biody so your scan data is linked to your Lifeline account automatically.")}
              state={biodyState === "active" ? "done" : biodyState === "activating" ? "busy" : "pending"}
              action={
                biodyState === "active" ? (
                  <span className="text-emerald-700 font-medium text-sm">{t("b2b.welcome.step.activate.done", "Activated ✓")}</span>
                ) : (
                  <button
                    onClick={activateBiody}
                    disabled={biodyState === "activating"}
                    className="btn-primary-solid"
                  >
                    {biodyState === "activating"
                      ? t("b2b.welcome.step.activate.activating", "Activating…")
                      : t("b2b.welcome.step.activate.cta", "Activate profile")}
                  </button>
                )
              }
              error={biodyState === "failed" ? activateError : ""}
            />
          )}

          {companyId && events.length > 0 ? (
            <StepCard
              n={2}
              title={t("b2b.welcome.step.bc_event.title", "Book your 5-minute body-composition slot")}
              body={(() => {
                const e = events[0];
                const label = new Date(e.event_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
                return myBookingSlot && myBookingSlot.event_id === e.id
                  ? t("b2b.welcome.step.bc_event.booked",
                      "You're booked for {{time}} on {{date}} at {{location}}.")
                      .replace("{{time}}", new Date(myBookingSlot.slot_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }))
                      .replace("{{date}}", label)
                      .replace("{{location}}", e.location || t("b2b.welcome.step.bc_event.office", "your office"))
                  : t("b2b.welcome.step.bc_event.body",
                      "{{company}} scheduled a Lifeline nurse to visit on {{date}}, {{start}}–{{end}}. Pick a 5-minute slot that works for you.")
                      .replace("{{company}}", companyName || "Your company")
                      .replace("{{date}}", label)
                      .replace("{{start}}", e.start_time.slice(0, 5))
                      .replace("{{end}}", e.end_time.slice(0, 5));
              })()}
              state={myBookingSlot ? "done" : "pending"}
              action={
                <button onClick={() => setPickerEvent(events[0])} className="btn-primary-solid">
                  {myBookingSlot
                    ? t("b2b.welcome.step.bc_event.cta_change", "Change slot")
                    : t("b2b.welcome.step.bc_event.cta", "Pick a slot")}
                </button>
              }
            />
          ) : companyId ? (
            <StepCard
              n={2}
              title={t("b2b.welcome.step.bc_event.pending.title", "Body-composition day — not scheduled yet")}
              body={t("b2b.welcome.step.bc_event.pending.body",
                "Your company hasn't set a day for the on-site body-composition measurements yet. You'll get an email once it's scheduled.")}
              state="pending"
              action={null}
            />
          ) : (
            <StepCard
              n={2}
              title={t("b2b.welcome.step.scan.title", "Book your body-composition scan")}
              body={t("b2b.welcome.step.scan.body",
                "Come in to a Lifeline station to complete the full-body scan. The result becomes the starting point of your coaching plan.")}
              state="pending"
              action={
                <Link href="/assessment" className="btn-primary-solid">
                  {t("b2b.welcome.step.scan.cta", "Book scan")}
                </Link>
              }
            />
          )}

          {companyId && (
            <StepCard
              n={3}
              title={t("b2b.welcome.step.blood.title", "Blood test at Sameind")}
              body={
                bloodDays.length > 0
                  ? t("b2b.welcome.step.blood.body",
                      "{{company}} allows you to take your blood test on {{days}}. Walk in at any Sameind station during its opening hours — the full list is on your account Home.")
                      .replace("{{company}}", companyName || "Your company")
                      .replace("{{days}}", bloodDays.map((d) => new Date(d.day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })).join(", "))
                  : t("b2b.welcome.step.blood.pending",
                      "Your company hasn't picked the blood-test days yet. You'll be notified by email once they do.")
              }
              state="pending"
              action={null}
            />
          )}

          <StepCard
            n={companyId ? 4 : 3}
            title={t("b2b.welcome.step.portal.title", "Access your patient portal")}
            body={t("b2b.welcome.step.portal.body",
              "Your clinical records, appointments, and physician notes live in our secure patient portal (Medalia).")}
            state="pending"
            action={<MedaliaButton label={t("b2b.welcome.step.portal.cta", "Open portal")} size="sm" />}
          />

          <StepCard
            n={companyId ? 5 : 4}
            title={t("b2b.welcome.step.app.title", "Download the Lifeline app")}
            body={t("b2b.welcome.step.app.body",
              "Daily actions, meal logging, weigh-ins, and your coaching dashboard live in the app.")}
            state="pending"
            action={
              <button disabled className="btn-ghost-solid opacity-60 cursor-not-allowed">
                {t("b2b.welcome.step.app.cta", "Coming soon")}
              </button>
            }
          />
        </section>

        <div className="flex justify-center pt-4">
          <Link href="/account" className="btn-primary-solid">
            {t("b2b.welcome.goto_dashboard", "Go to my dashboard")}
          </Link>
        </div>

        {pickerEvent && (
          <SlotPicker
            event={pickerEvent}
            onClose={() => setPickerEvent(null)}
            onBooked={async () => {
              if (!userId) return;
              const { data: myB } = await supabase
                .from("body_comp_event_bookings")
                .select("event_id, slot_at")
                .eq("client_id", userId)
                .order("slot_at")
                .limit(1)
                .maybeSingle();
              setMyBookingSlot(myB || null);
            }}
          />
        )}
      </main>

      <style jsx global>{`
        .btn-primary-solid {
          display: inline-block;
          background: linear-gradient(135deg,#3b82f6,#10b981);
          color: white;
          padding: 0.625rem 1.125rem;
          border-radius: 0.625rem;
          font-weight: 600;
          font-size: 0.875rem;
          transition: transform .08s;
        }
        .btn-primary-solid:hover:not(:disabled) { transform: translateY(-1px); }
        .btn-primary-solid:disabled { opacity: .5; cursor: not-allowed; }
        .btn-ghost-solid {
          display: inline-block;
          padding: 0.625rem 1.125rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.625rem;
          font-weight: 500;
          font-size: 0.875rem;
          background: white;
          color: #374151;
        }
      `}</style>
    </div>
  );
}

function StepCard({
  n, title, body, state, action, error,
}: {
  n: number;
  title: string;
  body: string;
  state: "pending" | "busy" | "done";
  action: React.ReactNode | null;
  error?: string;
}) {
  const ring = state === "done" ? "ring-emerald-200" : state === "busy" ? "ring-blue-200" : "ring-gray-100";
  const numberBg = state === "done" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700";
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm ring-1 ${ring}`}>
      <div className="flex items-start gap-4">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${numberBg}`}>
          {state === "done" ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
            </svg>
          ) : n}
        </div>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600 mt-1">{body}</p>
            </div>
            <div className="shrink-0">{action}</div>
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
