"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import LifelineLogo from "@/app/components/LifelineLogo";

type Stage = "password" | "consent" | "biody" | "done";

const TERMS_VERSION = "1.2";

export default function OnboardPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";

  const [stage, setStage] = useState<Stage>("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Password stage
  const [password, setPassword] = useState("");

  // Verified member payload
  const [memberId, setMemberId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [kennitala, setKennitala] = useState("");

  // Consent stage
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [researchOptOut, setResearchOptOut] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);

  // Biody stage
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<"sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "">("");
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
      if (j.completed_at) {
        setStage("done");
      } else {
        setStage("consent");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitConsent = () => {
    if (!acceptTerms) return;
    setStage("biody");
  };

  const submitBiody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sex || !heightCm || !weightKg || !activityLevel) {
      setError("Please fill in all fields."); return;
    }
    if (!accountPassword || accountPassword.length < 8) {
      setError("Choose a password of at least 8 characters for your Lifeline account."); return;
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
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/70 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <LifelineLogo className="w-8 h-8" />
          <span className="font-semibold">Lifeline Health</span>
        </Link>
        <span className="text-sm text-gray-500">Employee onboarding</span>
      </header>

      <main className="max-w-xl mx-auto px-6 py-12">
        {stage === "password" && (
          <section className="bg-white rounded-2xl p-8 shadow-sm">
            <h1 className="text-2xl font-semibold mb-2">Enter your invite password</h1>
            <p className="text-sm text-gray-600 mb-6">
              You should have received a password by email together with this link.
            </p>
            <form onSubmit={verifyPassword} className="space-y-4">
              <input
                type="text"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="input text-center text-xl tracking-widest font-mono"
              />
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Checking…" : "Continue"}
              </button>
            </form>
          </section>
        )}

        {stage === "consent" && (
          <section className="bg-white rounded-2xl p-8 shadow-sm">
            <div className="mb-6">
              <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-blue-100 via-white to-emerald-100 flex items-center justify-center text-sm text-gray-500">
                Intro video coming soon
              </div>
            </div>
            <h1 className="text-2xl font-semibold mb-2">Welcome, {fullName || "friend"}</h1>
            <p className="text-sm text-gray-600 mb-6">
              Lifeline Health helps you build lasting healthy habits through guided programs, body
              composition tracking, and nurse-led check-ins. Before we create your account, please
              review and confirm the following.
            </p>

            <div className="space-y-4">
              <Checkbox
                checked={acceptTerms}
                onChange={setAcceptTerms}
                required
              >
                I accept the Lifeline Health{" "}
                <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
                {" "}(v{TERMS_VERSION}).
              </Checkbox>

              <Checkbox checked={researchOptOut} onChange={setResearchOptOut}>
                <strong>Opt out of research.</strong> Don&apos;t use my non-identifiable data to improve
                Lifeline&apos;s services or for anonymised research.
              </Checkbox>

              <Checkbox checked={marketingOptOut} onChange={setMarketingOptOut}>
                <strong>Opt out of marketing.</strong> Don&apos;t send me promotional emails from Lifeline
                Health.
              </Checkbox>
            </div>

            <button
              onClick={submitConsent}
              disabled={!acceptTerms}
              className="btn-primary w-full mt-6"
            >
              Continue
            </button>
          </section>
        )}

        {stage === "biody" && (
          <section className="bg-white rounded-2xl p-8 shadow-sm">
            <h1 className="text-2xl font-semibold mb-2">A few last details</h1>
            <p className="text-sm text-gray-600 mb-6">
              We need these to set up your body composition profile with our measurement partner.
            </p>
            <form onSubmit={submitBiody} className="space-y-4">
              <Field label="Full name">
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
              </Field>
              <Field label="Email"><input type="email" value={email} disabled className="input bg-gray-50" /></Field>
              <Field label="Phone">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
              </Field>
              <Field label="Kennitala">
                <input type="text" value={kennitala} disabled className="input bg-gray-50 font-mono" />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Sex">
                  <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female" | "")} required className="input">
                    <option value="">Select…</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </Field>
                <Field label="Height (cm)">
                  <input type="number" min={100} max={230} step={1} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required className="input" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Weight (kg)">
                  <input type="number" min={30} max={300} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required className="input" />
                </Field>
                <Field label="Activity level">
                  <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as "sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "")} required className="input">
                    <option value="">Select…</option>
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="very_active">Very active</option>
                    <option value="extra_active">Extra active</option>
                  </select>
                </Field>
              </div>

              <Field label="Choose a password for your Lifeline account">
                <input type="password" minLength={8} value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} required className="input" placeholder="At least 8 characters" />
              </Field>

              {error && <div className="text-red-600 text-sm">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Completing registration…" : "Complete registration"}
              </button>
            </form>
          </section>
        )}

        {stage === "done" && (
          <section className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold mb-2">You&apos;re all set!</h1>
            <p className="text-sm text-gray-600 mb-6">
              Your Lifeline account is ready. You can sign in with your email and the password you just chose,
              then download the Lifeline app or access your dashboard.
            </p>
            <Link href="/account/login" className="btn-primary inline-block">Sign in</Link>
          </section>
        )}
      </main>

      <style jsx global>{`
        .input { width:100%; padding:0.625rem 0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; }
        .input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
        .btn-primary { background:linear-gradient(135deg,#3b82f6,#10b981); color:white; padding:0.75rem 1rem; border-radius:0.75rem; font-weight:600; }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>
    </div>
  );
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
  checked,
  onChange,
  children,
  required,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" required={required} />
      <span className="text-sm text-gray-700">{children}</span>
    </label>
  );
}
