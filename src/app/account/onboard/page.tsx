"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  HEALTH_CONSENT_VERSION,
  renderHealthAssessmentConsent,
} from "@/lib/platform-terms-content";

// Post-signup B2C onboarding wizard. Collects the body-composition profile
// fields the Biody activation requires (sex / DOB / height / weight /
// activity_level), records the health-assessment informed consent, and
// lands the user on the dashboard with welcome_seen_at set.
//
// Parallels the B2B wizard at /business/onboard/[token] but is simpler —
// B2C users are already authed (just confirmed email) and already have a
// password, so we skip the Password + Account stages.

type Stage = "welcome" | "consent" | "profile" | "saving";
type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "";

export default function AccountOnboardPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("welcome");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");

  // Consent. Research/marketing opt-outs were already captured
  // at signup (/account/login) — no need to re-prompt here.
  const [acceptHealth, setAcceptHealth] = useState(false);

  // Profile
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("");

  // Scroll to top on every stage change so the user sees the new step header
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  // Auth gate + preload. If the user is actually B2B, bounce to the B2B welcome.
  // If the user already has a complete profile + welcome_seen_at, bounce
  // straight to /account so revisits don't re-run the wizard.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/account/login?next=/account/onboard"); return; }
      setEmail(user.email || "");
      const { data } = await supabase
        .from("clients_decrypted")
        .select("full_name, sex, date_of_birth, height_cm, weight_kg, activity_level, company_id, welcome_seen_at")
        .eq("id", user.id)
        .maybeSingle();
      const fn = ((data?.full_name as string | null) || user.email?.split("@")[0] || "").split(" ")[0];
      setFirstName(fn || "there");
      // B2B user should not land here — send them to the B2B welcome page
      if (data?.company_id) {
        router.replace("/account/welcome");
        return;
      }
      // Already onboarded? Go straight to dashboard.
      if (
        data?.welcome_seen_at &&
        data?.sex && data?.date_of_birth && data?.height_cm && data?.weight_kg && data?.activity_level
      ) {
        router.replace("/account");
        return;
      }
      // Pre-fill whatever they may have set before (e.g. opened BiodyProfileModal once)
      if (data?.sex) setSex(data.sex as "male" | "female");
      if (data?.date_of_birth) setDob(data.date_of_birth as string);
      if (data?.height_cm) setHeightCm(String(data.height_cm));
      if (data?.weight_kg) setWeightKg(String(data.weight_kg));
      if (data?.activity_level) setActivityLevel(data.activity_level as ActivityLevel);
      setLoading(false);
    })();
  }, [router]);

  const submit = async () => {
    if (!sex || !dob || !heightCm || !weightKg || !activityLevel) {
      setError("Please fill in every field.");
      setStage("profile");
      return;
    }
    if (!acceptHealth) {
      setError("Please accept the health-data consent to continue.");
      setStage("consent");
      return;
    }
    setStage("saving");
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/account/onboard/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sex,
          date_of_birth: dob,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          activity_level: activityLevel,
          accept_health_consent: true,
          // research_opt_out + marketing_opt_out captured at signup
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setError(typeof j.detail === "string" ? j.detail : j.error || "Setup failed. Please contact support.");
        setStage("profile");
        return;
      }
      router.push("/account");
    } catch (e) {
      setError((e as Error).message || "Setup failed.");
      setStage("profile");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#ecfdf5]">
      <main className="max-w-2xl mx-auto px-6 py-10 sm:py-14 space-y-8">
        {/* Signed-in-as confirmation. No "expected" email to compare
            against here (unlike the B2B/claim flows with an invite
            token), so we just show the current identity prominently
            with an easy 'Wrong account? Sign out' escape hatch — that
            prevents the cross-tab session bleed where someone clicks
            a confirmation link with another Lifeline session open. */}
        {email && (
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-gray-200 bg-white/60 px-4 py-2.5 text-xs">
            <span className="text-gray-600">
              Skráð/ur inn sem <strong className="text-gray-900 font-mono">{email}</strong>
            </span>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Skrá út og opna skráninguna aftur með öðrum aðganga?")) return;
                await supabase.auth.signOut();
                router.replace("/account/login?next=/account/onboard");
              }}
              className="text-gray-500 hover:text-gray-800 underline underline-offset-2"
            >
              Rangur aðgangur? Skrá út
            </button>
          </div>
        )}
        <StageIndicator stage={stage} />

        {stage === "welcome" && (
          <WelcomeStage firstName={firstName} onContinue={() => setStage("consent")} />
        )}
        {stage === "consent" && (
          <ConsentStage
            acceptHealth={acceptHealth} setAcceptHealth={setAcceptHealth}
            onBack={() => setStage("welcome")}
            onContinue={() => { setError(""); setStage("profile"); }}
          />
        )}
        {stage === "profile" && (
          <ProfileStage
            email={email}
            sex={sex} setSex={setSex}
            dob={dob} setDob={setDob}
            heightCm={heightCm} setHeightCm={setHeightCm}
            weightKg={weightKg} setWeightKg={setWeightKg}
            activityLevel={activityLevel} setActivityLevel={setActivityLevel}
            error={error}
            onBack={() => setStage("consent")}
            onContinue={submit}
          />
        )}
        {stage === "saving" && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-[#475569]">Setting up your profile…</p>
          </div>
        )}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function StageIndicator({ stage }: { stage: Stage }) {
  const order: Stage[] = ["welcome", "consent", "profile"];
  const idx = order.indexOf(stage);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {[
        { key: "welcome", label: "Welcome" },
        { key: "consent", label: "Consent" },
        { key: "profile", label: "Profile" },
      ].map((s, i) => {
        const done = i < idx;
        const active = i === idx;
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
            {i < 2 && <span className="text-gray-300">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function WelcomeStage({ firstName, onContinue }: { firstName: string; onContinue: () => void }) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl text-white p-8 shadow-sm"
        style={{ background: "linear-gradient(135deg, #10B981, #3B82F6)" }}>
        <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Welcome to Lifeline Health</div>
          <h1 className="text-2xl sm:text-3xl font-bold">Hi {firstName}, take control of your health.</h1>
          <p className="mt-3 text-base opacity-95 max-w-lg leading-relaxed">
            Lifeline Health combines targeted health assessments with personalised daily coaching. Know your numbers, build better habits, track your progress — with guidance from Icelandic physicians and coaches.
          </p>
        </div>
      </section>

      <section className="bg-white rounded-2xl p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1 text-[#0F172A]">What happens next</h2>
          <p className="text-sm text-[#64748B]">Two short steps so we can set up your Lifeline account and body-composition profile.</p>
        </div>
        <ol className="space-y-4">
          <Step n={1} title="Accept the health-data consent">Standard consent so we can legally process your health information.</Step>
          <Step n={2} title="Confirm your details">Sex, date of birth, height, weight, activity level — for your body-composition profile.</Step>
        </ol>
        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-3">After you register</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <MiniCard
              color="#3B82F6"
              title="Get assessed"
              body="Book your Foundational Health assessment at the Lifeline station in Reykjavík."
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
            />
            <MiniCard
              color="#10B981"
              title="Get your report"
              body="A Lifeline physician reviews your results and builds a personalised plan."
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            />
            <MiniCard
              color="#8B5CF6"
              title="Start coaching"
              body="Daily actions across exercise, nutrition, sleep and mental wellness in the app."
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button onClick={onContinue} className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95">
            Let&apos;s get started
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}

function ConsentStage({
  acceptHealth, setAcceptHealth,
  onBack, onContinue,
}: {
  acceptHealth: boolean; setAcceptHealth: (v: boolean) => void;
  onBack: () => void; onContinue: () => void;
}) {
  return (
    <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[#0F172A]">Upplýst samþykki fyrir heilsumat</h1>
        <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
          Áður en þú getur hafið heilsumat þarftu að veita upplýst samþykki fyrir vinnslu heilsufarsupplýsinga skv. 9. gr. GDPR og laga nr. 74/1997 um réttindi sjúklinga. Samþykkið er skráð rafrænt með tímastimpli, IP-tölu og vafraauðkenni. Þú færð staðfestingarskjal með tölvupósti.
        </p>
      </header>

      <div>
        <h2 className="text-sm font-semibold text-[#0F172A] mb-2">
          Upplýst samþykki fyrir heilsumat ({HEALTH_CONSENT_VERSION})
        </h2>
        <pre className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg p-4 text-[12px] leading-relaxed text-gray-800 bg-gray-50 whitespace-pre-wrap font-sans">
{renderHealthAssessmentConsent()}
        </pre>
        <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
          <input type="checkbox" checked={acceptHealth} onChange={(e) => setAcceptHealth(e.target.checked)} className="mt-1" />
          <span className="text-sm text-[#334155]">
            Ég veiti upplýst og beint samþykki fyrir vinnslu heilsufarsupplýsinga minna í tengslum við heilsumat Lifeline Health ({HEALTH_CONSENT_VERSION}).
          </span>
        </label>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button onClick={onBack} className="px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-[#1F2937] hover:bg-gray-50 shadow-sm">
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={!acceptHealth}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
        >
          {acceptHealth ? "Halda áfram →" : "Samþykktu skjalið"}
        </button>
      </div>
    </section>
  );
}

function ProfileStage({
  email,
  sex, setSex, dob, setDob, heightCm, setHeightCm, weightKg, setWeightKg,
  activityLevel, setActivityLevel, error, onBack, onContinue,
}: {
  email: string;
  sex: "male" | "female" | ""; setSex: (v: "male" | "female" | "") => void;
  dob: string; setDob: (v: string) => void;
  heightCm: string; setHeightCm: (v: string) => void;
  weightKg: string; setWeightKg: (v: string) => void;
  activityLevel: ActivityLevel; setActivityLevel: (v: ActivityLevel) => void;
  error: string; onBack: () => void; onContinue: () => void;
}) {
  // Keep per-field local state so in-progress typing is visible even
  // when the combined ISO dob isn't complete yet. Seed from the parent
  // once (prefilled values from /account/clients row), then sync OUT
  // to the parent whenever all three fields become well-formed.
  const digits = (s: string, max: number) => s.replace(/[^0-9]/g, "").slice(0, max);
  const [initialY = "", initialM = "", initialD = ""] = (dob || "").split("-");
  const [dd, setDd] = useState(initialD);
  const [mm, setMm] = useState(initialM);
  const [yyyy, setYyyy] = useState(initialY);

  // Propagate a complete date (or clear) to the parent form.
  useEffect(() => {
    if (dd.length === 2 && mm.length === 2 && yyyy.length === 4) {
      const day = Math.min(31, Math.max(1, parseInt(dd, 10) || 0));
      const mon = Math.min(12, Math.max(1, parseInt(mm, 10) || 0));
      setDob(`${yyyy}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    } else if (dob) {
      // One of the three got cleared or shortened → invalidate the parent
      setDob("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dd, mm, yyyy]);

  return (
    <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-[#0F172A]">Confirm your details</h1>
        <p className="text-sm text-[#64748B] mt-1">These set up your body-composition profile with our measurement partner.</p>
      </div>

      <div>
        <div className="text-xs font-medium text-[#475569] mb-1">Email</div>
        <input type="email" value={email} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-[#64748B]" />
      </div>

      <div className="border-t border-gray-100 pt-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#0F172A]">Body-composition profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Sex">
            <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female" | "")} required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Select…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </Field>
          <Field label="Activity level">
            <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)} required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Select…</option>
              <option value="sedentary">Sedentary — little or no exercise</option>
              <option value="light">Light — exercise 1–3 days/week</option>
              <option value="moderate">Moderate — exercise 3–5 days/week</option>
              <option value="very_active">Very active — exercise 6–7 days/week</option>
              <option value="extra_active">Extra active — daily intense training</option>
            </select>
          </Field>
          <Field label="Height (cm)">
            <input type="number" min={100} max={230} step={1} value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </Field>
          <Field label="Weight (kg)">
            <input type="number" min={30} max={300} step={0.1} value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </Field>
          <div className="sm:col-span-2">
            <div className="text-xs font-medium text-[#475569] mb-1">Date of birth</div>
            <div className="flex items-stretch gap-2">
              <label className="flex-1">
                <span className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Day</span>
                <input type="text" inputMode="numeric" autoComplete="bday-day" placeholder="DD" maxLength={2}
                  value={dd}
                  onChange={(e) => setDd(digits(e.target.value, 2))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center tabular-nums" />
              </label>
              <label className="flex-1">
                <span className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Month</span>
                <input type="text" inputMode="numeric" autoComplete="bday-month" placeholder="MM" maxLength={2}
                  value={mm}
                  onChange={(e) => setMm(digits(e.target.value, 2))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center tabular-nums" />
              </label>
              <label className="flex-[1.4]">
                <span className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Year</span>
                <input type="text" inputMode="numeric" autoComplete="bday-year" placeholder="YYYY" maxLength={4}
                  value={yyyy}
                  onChange={(e) => setYyyy(digits(e.target.value, 4))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center tabular-nums" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button onClick={onBack} className="px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-[#1F2937] hover:bg-gray-50 shadow-sm">
          Back
        </button>
        <button onClick={onContinue}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95">
          Save & finish setup
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center"
        style={{ background: "linear-gradient(135deg,#3B82F6,#10B981)" }}>{n}</span>
      <div>
        <div className="font-semibold text-[#0F172A] text-sm">{title}</div>
        <div className="text-sm text-[#64748B] leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

function MiniCard({ color, title, body, icon }: { color: string; title: string; body: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4 bg-gradient-to-br from-white to-gray-50/50">
      <div
        className="w-9 h-9 rounded-full mb-3 flex items-center justify-center"
        style={{ background: `${color}1A`, color }}
      >
        {icon}
      </div>
      <div className="font-semibold text-[#0F172A] text-sm">{title}</div>
      <div className="text-xs text-[#64748B] mt-1 leading-relaxed">{body}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#475569] mb-1">{label}</span>
      {children}
    </label>
  );
}

