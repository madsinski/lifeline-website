"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BusinessHeader from "@/app/business/BusinessHeader";
import { useI18n } from "@/lib/i18n";

type Stage = "password" | "welcome" | "consent" | "profile" | "account" | "done";

const TERMS_VERSION = "1.2";

const ORDER: Stage[] = ["welcome", "consent", "profile", "account"];

export default function OnboardPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";

  const [stage, setStage] = useState<Stage>("password");

  // Scroll to top on every forward step
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [password, setPassword] = useState("");

  const [memberId, setMemberId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [kennitala, setKennitala] = useState("");

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [researchOptOut, setResearchOptOut] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);

  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] =
    useState<"sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "">("");

  const [accountPassword, setAccountPassword] = useState("");

  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/business/onboard/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json();
      if (res.status === 429) throw new Error(j.error || "Too many attempts. Try again later.");
      if (!res.ok) throw new Error(j.error || "Invalid password");
      setMemberId(j.id);
      setFullName(j.full_name || "");
      setEmail(j.email || "");
      setPhone(j.phone || "");
      setKennitala(j.kennitala || "");
      setStage(j.completed_at ? "done" : "welcome");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!sex || !heightCm || !weightKg || !activityLevel) {
      setError("Please fill in all fields on the previous step.");
      setStage("profile");
      return;
    }
    if (!accountPassword || accountPassword.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/business/onboard/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          account_password: accountPassword,
          sex,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          activity_level: activityLevel,
          terms_version: TERMS_VERSION,
          research_opt_out: researchOptOut,
          marketing_opt_out: marketingOptOut,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Registration failed");
      setStage("done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <BusinessHeader
        minimal
        pillI18nKey="b2b.onboard.header"
        pillLabel="Employee registration"
      />

      <main className="max-w-2xl mx-auto px-6 py-12">
        {stage !== "password" && stage !== "done" && <Progress stage={stage} />}

        {stage === "password" && <PasswordStage
          password={password} setPassword={setPassword}
          error={error} loading={loading} onSubmit={verifyPassword}
        />}

        {stage === "welcome" && <WelcomeStage
          firstName={(fullName.split(" ")[0] || "").trim()}
          onContinue={() => setStage("consent")}
        />}

        {stage === "consent" && <ConsentStage
          acceptTerms={acceptTerms} setAcceptTerms={setAcceptTerms}
          researchOptOut={researchOptOut} setResearchOptOut={setResearchOptOut}
          marketingOptOut={marketingOptOut} setMarketingOptOut={setMarketingOptOut}
          onBack={() => setStage("welcome")}
          onContinue={() => setStage("profile")}
        />}

        {stage === "profile" && <ProfileStage
          fullName={fullName} setFullName={setFullName}
          email={email} phone={phone} setPhone={setPhone} kennitala={kennitala}
          sex={sex} setSex={setSex}
          heightCm={heightCm} setHeightCm={setHeightCm}
          weightKg={weightKg} setWeightKg={setWeightKg}
          activityLevel={activityLevel} setActivityLevel={setActivityLevel}
          error={error}
          onBack={() => setStage("consent")}
          onContinue={() => {
            if (!sex || !heightCm || !weightKg || !activityLevel) {
              setError("Please fill in every field.");
              return;
            }
            setError("");
            setStage("account");
          }}
        />}

        {stage === "account" && <AccountStage
          accountPassword={accountPassword} setAccountPassword={setAccountPassword}
          email={email}
          loading={loading} error={error}
          onBack={() => setStage("profile")}
          onSubmit={completeOnboarding}
        />}

        {stage === "done" && <DoneStage firstName={(fullName.split(" ")[0] || "").trim()} />}

        {/* Silently consume unused vars so TS doesn't complain about one-time setters */}
        <input type="hidden" value={memberId || ""} readOnly />
      </main>

      <style jsx global>{`
        .input { width:100%; padding:0.625rem 0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; background:white; }
        .input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
        .input:disabled { background:#f9fafb; color:#6b7280; }
        .btn-primary { background:linear-gradient(135deg,#3b82f6,#10b981); color:white; padding:0.75rem 1.25rem; border-radius:0.75rem; font-weight:600; transition:transform .08s; }
        .btn-primary:hover:not(:disabled) { transform:translateY(-1px); }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
        .btn-ghost { padding:0.625rem 1rem; border:1px solid #e5e7eb; border-radius:0.625rem; font-weight:500; background:white; color:#374151; }
        .btn-ghost:hover { background:#f9fafb; }
      `}</style>
    </div>
  );
}

// ── Stages ──────────────────────────────────────────────────────────────────

function PasswordStage({
  password, setPassword, error, loading, onSubmit,
}: {
  password: string; setPassword: (v: string) => void;
  error: string; loading: boolean; onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <section className="bg-white rounded-2xl p-8 shadow-sm">
      <h1 className="text-2xl font-semibold mb-2">Enter your invite password</h1>
      <p className="text-sm text-gray-600 mb-6">
        You should have received a 6-digit password by email together with this link.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="text"
          required autoFocus
          inputMode="numeric"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
          className="input text-center text-2xl tracking-[0.4em] font-mono"
        />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Checking…" : "Continue"}
        </button>
      </form>
    </section>
  );
}

function WelcomeStage({ firstName, onContinue }: { firstName: string; onContinue: () => void }) {
  const { t } = useI18n();
  return (
    <section className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 via-emerald-500 to-blue-500 rounded-2xl p-8 text-white shadow-sm">
        <p className="text-sm font-semibold tracking-[0.15em] uppercase opacity-90 mb-3">
          {t("onboard.welcome.eyebrow", "Welcome to Lifeline Health")}
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
          {firstName
            ? t("onboard.welcome.title_name", "Hi {{name}}, take control of your health.").replace("{{name}}", firstName)
            : t("onboard.welcome.title", "Hi, take control of your health.")}
        </h1>
        <p className="mt-3 text-base opacity-95 max-w-lg">
          {t("onboard.welcome.body",
            "Lifeline Health combines targeted health assessments with personalised daily coaching. Know your numbers, build better habits, track your progress — with guidance from Icelandic physicians and coaches.")}
        </p>
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">{t("onboard.next.heading", "What happens next")}</h2>
          <p className="text-sm text-gray-600">
            {t("onboard.next.subtitle",
              "A short registration so we can set up your Lifeline account and your body-composition profile.")}
          </p>
        </div>

        <ol className="space-y-4">
          <Step n={1} title={t("onboard.step1.title", "Accept terms & privacy")}>
            {t("onboard.step1.body", "Standard consent so we can legally look after your data.")}
          </Step>
          <Step n={2} title={t("onboard.step2.title", "Confirm your details")}>
            {t("onboard.step2.body",
              "Your contact info is already filled in — we just need your sex, height, weight and activity level for your body-composition profile.")}
          </Step>
          <Step n={3} title={t("onboard.step3.title", "Choose a password")}>
            {t("onboard.step3.body", "You'll sign in to the Lifeline app with your email and this password.")}
          </Step>
        </ol>

        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("onboard.after.heading", "After you register")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <MiniCard color="#3B82F6"
              title={t("onboard.after.assess.title", "Get assessed")}
              body={t("onboard.after.assess.body", "Body composition scan at a Lifeline station — already included in your plan.")} />
            <MiniCard color="#10B981"
              title={t("onboard.after.report.title", "Get your report")}
              body={t("onboard.after.report.body", "A Lifeline physician reviews your results and builds a personalised plan.")} />
            <MiniCard color="#8B5CF6"
              title={t("onboard.after.coach.title", "Start coaching")}
              body={t("onboard.after.coach.body", "Daily actions across exercise, nutrition, sleep and mental wellness in the app.")} />
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onContinue} className="btn-primary">{t("onboard.welcome.cta", "Let's get started")}</button>
        </div>
      </div>
    </section>
  );
}

function ConsentStage({
  acceptTerms, setAcceptTerms,
  researchOptOut, setResearchOptOut,
  marketingOptOut, setMarketingOptOut,
  onBack, onContinue,
}: {
  acceptTerms: boolean; setAcceptTerms: (v: boolean) => void;
  researchOptOut: boolean; setResearchOptOut: (v: boolean) => void;
  marketingOptOut: boolean; setMarketingOptOut: (v: boolean) => void;
  onBack: () => void; onContinue: () => void;
}) {
  return (
    <section className="bg-white rounded-2xl p-8 shadow-sm">
      <h1 className="text-2xl font-semibold mb-2">Terms &amp; privacy</h1>
      <p className="text-sm text-gray-600 mb-6">
        Lifeline handles your health data under Icelandic law and the GDPR. Read our{" "}
        <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
        {" "}and{" "}
        <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
      </p>

      <div className="space-y-3">
        <Checkbox checked={acceptTerms} onChange={setAcceptTerms} required>
          <strong>I accept the Lifeline Health Terms of Service &amp; Privacy Policy</strong>{" "}
          <span className="text-gray-500">(v{TERMS_VERSION}).</span>
        </Checkbox>

        <Checkbox checked={researchOptOut} onChange={setResearchOptOut}>
          <strong>Opt out of research use.</strong>{" "}
          <span className="text-gray-600">Don&apos;t use my anonymised data to improve Lifeline or for clinical research.</span>
        </Checkbox>

        <Checkbox checked={marketingOptOut} onChange={setMarketingOptOut}>
          <strong>Opt out of marketing emails.</strong>{" "}
          <span className="text-gray-600">Don&apos;t send me product news or promotions from Lifeline.</span>
        </Checkbox>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button onClick={onBack} className="btn-ghost">Back</button>
        <button onClick={onContinue} disabled={!acceptTerms} className="btn-primary">Continue</button>
      </div>
    </section>
  );
}

function ProfileStage({
  fullName, setFullName, email, phone, setPhone, kennitala,
  sex, setSex, heightCm, setHeightCm, weightKg, setWeightKg,
  activityLevel, setActivityLevel, error, onBack, onContinue,
}: {
  fullName: string; setFullName: (v: string) => void;
  email: string; phone: string; setPhone: (v: string) => void; kennitala: string;
  sex: "male" | "female" | ""; setSex: (v: "male" | "female" | "") => void;
  heightCm: string; setHeightCm: (v: string) => void;
  weightKg: string; setWeightKg: (v: string) => void;
  activityLevel: "sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "";
  setActivityLevel: (v: "sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "") => void;
  error: string; onBack: () => void; onContinue: () => void;
}) {
  return (
    <section className="bg-white rounded-2xl p-8 shadow-sm space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Confirm your details</h1>
        <p className="text-sm text-gray-600 mt-1">We use these to set up your body-composition profile.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Field label="Full name">
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email"><input type="email" value={email} disabled className="input" /></Field>
          <Field label="Phone">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Kennitala">
          <input
            type="text"
            value={maskKennitala(kennitala)}
            disabled
            className="input font-mono tracking-wider"
            title="Only the last 4 digits are shown for your protection. Lifeline holds your full kennitala encrypted."
          />
        </Field>
      </div>

      <div className="border-t border-gray-100 pt-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Body-composition profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Sex">
            <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female" | "")} required className="input">
              <option value="">Select…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </Field>
          <Field label="Activity level">
            <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as "sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "")} required className="input">
              <option value="">Select…</option>
              <option value="sedentary">Sedentary — little or no exercise</option>
              <option value="light">Light — exercise 1–3 days/week</option>
              <option value="moderate">Moderate — exercise 3–5 days/week</option>
              <option value="very_active">Very active — exercise 6–7 days/week</option>
              <option value="extra_active">Extra active — daily intense training</option>
            </select>
          </Field>
          <Field label="Height (cm)">
            <input type="number" min={100} max={230} step={1} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required className="input" />
          </Field>
          <Field label="Weight (kg)">
            <input type="number" min={30} max={300} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required className="input" />
          </Field>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost">Back</button>
        <button onClick={onContinue} className="btn-primary">Continue</button>
      </div>
    </section>
  );
}

function AccountStage({
  accountPassword, setAccountPassword, email, loading, error, onBack, onSubmit,
}: {
  accountPassword: string; setAccountPassword: (v: string) => void;
  email: string; loading: boolean; error: string;
  onBack: () => void; onSubmit: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <section className="bg-white rounded-2xl p-8 shadow-sm">
      <h1 className="text-2xl font-semibold mb-2">Create your Lifeline password</h1>
      <p className="text-sm text-gray-600 mb-6">
        You&apos;ll sign in to the Lifeline app at <strong>{email}</strong> with this password.
      </p>
      <Field label="Password (8+ characters)">
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            minLength={8}
            value={accountPassword}
            onChange={(e) => setAccountPassword(e.target.value)}
            required
            autoFocus
            className="input pr-20"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 px-2 py-1 hover:text-gray-800"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </Field>

      {error && <div className="text-red-600 text-sm mt-4">{error}</div>}

      <div className="flex items-center justify-between mt-8">
        <button onClick={onBack} className="btn-ghost" disabled={loading}>Back</button>
        <button onClick={onSubmit} disabled={loading || accountPassword.length < 8} className="btn-primary">
          {loading ? "Completing registration…" : "Complete registration"}
        </button>
      </div>
    </section>
  );
}

function DoneStage({ firstName }: { firstName: string }) {
  return (
    <section className="bg-white rounded-2xl p-10 shadow-sm text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold mb-2">You&apos;re all set{firstName ? `, ${firstName}` : ""}!</h1>
      <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
        Your Lifeline account is ready.
      </p>
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-left max-w-md mx-auto mb-7">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">What happens next</div>
        <ul className="space-y-1.5 text-sm text-blue-900/90">
          <li>• Your company schedules the on-site measurement day — you&apos;ll be notified.</li>
          <li>• When it&apos;s time, pick a 5-minute slot + your Sameind blood-test day from the dashboard.</li>
          <li>• A Lifeline doctor reviews your results and meets you 1:1.</li>
        </ul>
      </div>
      <div className="flex items-center justify-center gap-3">
        <a href="/account" className="btn-primary">Go to your dashboard</a>
        <Link href="/" className="btn-ghost">Back to home</Link>
      </div>
    </section>
  );
}

// ── Small components ────────────────────────────────────────────────────────

function Progress({ stage }: { stage: Stage }) {
  const idx = ORDER.indexOf(stage);
  const labels = ["Welcome", "Terms", "Details", "Password"];
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8 overflow-x-auto">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2 sm:gap-3 whitespace-nowrap">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              i <= idx ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            {i + 1}
          </div>
          <span className={`text-xs sm:text-sm ${i === idx ? "font-semibold text-gray-900" : "text-gray-500"}`}>{l}</span>
          {i < labels.length - 1 && <div className="w-5 sm:w-8 h-px bg-gray-300" />}
        </div>
      ))}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-semibold">
        {n}
      </div>
      <div>
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-sm text-gray-600">{children}</div>
      </div>
    </li>
  );
}

function MiniCard({ color, title, body }: { color: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="text-xs font-semibold tracking-wider uppercase mb-1" style={{ color }}>{title}</div>
      <div className="text-xs text-gray-600 leading-snug">{body}</div>
    </div>
  );
}

function maskKennitala(kt: string | null | undefined): string {
  const d = (kt || "").replace(/[^0-9]/g, "");
  if (d.length < 4) return "";
  return "••••••" + d.slice(-4);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({
  checked, onChange, children, required,
}: {
  checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; required?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" required={required} />
      <span className="text-sm text-gray-700 leading-relaxed">{children}</span>
    </label>
  );
}
