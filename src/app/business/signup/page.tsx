"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LifelineLogo from "@/app/components/LifelineLogo";
import { cleanKennitala, isValidKennitala, formatKennitala } from "@/lib/kennitala";

const AGREEMENT_VERSION = "1.0";

type Step = "auth" | "agreement" | "company" | "done";

export default function BusinessSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("auth");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

  const [agreementChecked, setAgreementChecked] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyKennitala, setCompanyKennitala] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setEmail(data.user.email || "");
        setStep("agreement");
      }
      setLoading(false);
    });
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (authMode === "login") {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        if (data.user) {
          setUserId(data.user.id);
          setStep("agreement");
        }
      } else {
        // Server-side create + auto-confirm so we can sign in immediately.
        const res = await fetch("/api/business/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, full_name: fullName }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Signup failed");
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        if (data.user) {
          setUserId(data.user.id);
          setStep("agreement");
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAgreement = () => {
    if (!agreementChecked) return;
    setStep("company");
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!userId) return;
    if (!companyName.trim()) { setError("Please enter a company name."); return; }
    if (!isValidKennitala(companyKennitala)) {
      setError("Kennitala must be 10 digits and pass the Icelandic checksum.");
      return;
    }
    setSubmitting(true);
    try {
      const cleaned = cleanKennitala(companyKennitala);
      const { data: enc, error: encErr } = await supabase.rpc("enc_kennitala", { p_text: cleaned });
      if (encErr) throw new Error(encErr.message);
      const { data, error: insErr } = await supabase
        .from("companies")
        .insert({
          name: companyName.trim(),
          kennitala_encrypted: enc,
          contact_person_id: userId,
          agreement_version: AGREEMENT_VERSION,
          agreement_accepted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      router.push(`/business/${data!.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/70 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <LifelineLogo className="w-8 h-8" />
          <span className="font-semibold">Lifeline Health</span>
        </Link>
        <span className="text-sm text-gray-500">Business onboarding</span>
      </header>

      <main className="max-w-xl mx-auto px-6 py-12">
        <Stepper step={step} />

        {step === "auth" && (
          <section className="bg-white rounded-2xl p-8 shadow-sm">
            <h1 className="text-2xl font-semibold mb-2">
              {authMode === "login" ? "Sign in to continue" : "Create your account"}
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              You are the <strong>contact person</strong> for your company. You&apos;ll receive notifications
              about employee registrations.
            </p>
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === "signup" && (
                <Field label="Your full name">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                  />
                </Field>
              )}
              <Field label="Work email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                />
              </Field>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? "Working…" : authMode === "login" ? "Sign in" : "Create account"}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                className="text-sm text-blue-600 hover:underline w-full text-center"
              >
                {authMode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </form>
          </section>
        )}

        {step === "agreement" && (
          <section className="bg-white rounded-2xl p-8 shadow-sm">
            <h1 className="text-2xl font-semibold mb-4">Service agreement</h1>
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 text-sm text-gray-700 bg-gray-50 mb-4 space-y-3">
              <p><strong>Lifeline Health Business Service Agreement v{AGREEMENT_VERSION}</strong></p>
              <p>
                By continuing, your organization agrees to Lifeline Health&apos;s standard business terms
                of service, data processing agreement, and privacy policy. Lifeline acts as a data
                processor for employee health data your employees choose to share, and as a data
                controller for platform operations.
              </p>
              <p>
                <strong>What your employees share with Lifeline:</strong> name, kennitala, contact info,
                sex, height, weight, activity level, and (when they visit a clinic) body composition
                measurements.
              </p>
              <p>
                <strong>What you, as the contact person, can see:</strong> whether each employee has
                completed onboarding. You cannot see their health data.
              </p>
              <p>
                Full legal text is available at{" "}
                <Link href="/terms" className="text-blue-600 hover:underline">lifelinehealth.is/terms</Link>.
              </p>
            </div>
            <label className="flex items-start gap-2 mb-6 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreementChecked}
                onChange={(e) => setAgreementChecked(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-700">
                I confirm I have the authority to bind my organization and I accept the agreement
                above (v{AGREEMENT_VERSION}).
              </span>
            </label>
            <button onClick={handleAgreement} disabled={!agreementChecked} className="btn-primary w-full">
              Accept &amp; continue
            </button>
          </section>
        )}

        {step === "company" && (
          <section className="bg-white rounded-2xl p-8 shadow-sm">
            <h1 className="text-2xl font-semibold mb-2">Your company</h1>
            <p className="text-sm text-gray-600 mb-6">
              We&apos;ll create a company workspace. You can add employees on the next screen.
            </p>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <Field label="Company name">
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Company kennitala (10 digits)">
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  value={companyKennitala}
                  onChange={(e) => setCompanyKennitala(e.target.value)}
                  onBlur={() => setCompanyKennitala((v) => formatKennitala(v))}
                  placeholder="123456-7890"
                  className="input"
                />
              </Field>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? "Creating…" : "Create company"}
              </button>
            </form>
          </section>
        )}
      </main>

      <style jsx global>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
        .btn-primary {
          background: linear-gradient(135deg,#3b82f6,#10b981);
          color: white;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          font-weight: 600;
          transition: opacity .15s;
        }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["auth", "agreement", "company"];
  const idx = order.indexOf(step);
  const labels = ["Account", "Agreement", "Company"];
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              i <= idx ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            {i + 1}
          </div>
          <span className={`text-sm ${i === idx ? "font-semibold" : "text-gray-500"}`}>{l}</span>
          {i < labels.length - 1 && <div className="w-8 h-px bg-gray-300" />}
        </div>
      ))}
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
