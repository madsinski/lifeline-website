"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import BusinessHeader from "../BusinessHeader";
import { cleanKennitala, isValidKennitala, formatKennitala } from "@/lib/kennitala";
import {
  TOS_KEY,
  TOS_VERSION,
  DPA_KEY,
  DPA_VERSION,
  renderTermsOfService,
  renderDataProcessingAgreement,
} from "@/lib/platform-terms-content";

const AGREEMENT_VERSION = "1.0"; // legacy column on companies — kept for backwards compat

type Step = "agreement" | "company" | "done";

export default function BusinessSignupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("agreement");

  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState<string | null>(null);

  const [tosChecked, setTosChecked] = useState(false);
  const [dpaChecked, setDpaChecked] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyKennitala, setCompanyKennitala] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      // No session — bounce to the canonical login page (signup tab) and come
      // back here once authenticated. /business/login is the single source of
      // truth for auth UI.
      if (!data.user) {
        router.replace("/business/login?mode=signup&next=/business/signup");
        return;
      }
      setUserId(data.user.id);
      // If they already manage companies, send them to the picker instead
      const { data: ownedCompanies } = await supabase
        .from("companies")
        .select("id")
        .eq("contact_person_id", data.user.id)
        .limit(1);
      if (ownedCompanies && ownedCompanies.length > 0) {
        router.replace("/business");
        return;
      }

      // Skip the agreement step if they've already accepted both current
      // versions (returning users creating an additional company).
      const { data: accRows } = await supabase
        .from("platform_agreement_acceptances")
        .select("document_key, document_version")
        .eq("user_id", data.user.id);
      const accepted = new Set((accRows ?? []).map((r: { document_key: string; document_version: string }) => `${r.document_key}@${r.document_version}`));
      const alreadyAccepted = accepted.has(`${TOS_KEY}@${TOS_VERSION}`) && accepted.has(`${DPA_KEY}@${DPA_VERSION}`);
      setStep(alreadyAccepted ? "company" : "agreement");
      setLoading(false);
    })();
  }, [router]);

  const handleAgreement = async () => {
    if (!tosChecked || !dpaChecked) return;
    setError("");
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (token) authHeaders.Authorization = `Bearer ${token}`;

      const acceptOne = async (key: string, version: string) => {
        const r = await fetch("/api/platform/accept-terms", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ document_key: key, document_version: version }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.detail || j.error || `Failed to record acceptance for ${key}`);
        }
      };

      // Record both acceptances. Order doesn't matter — idempotent via unique index.
      await Promise.all([
        acceptOne(TOS_KEY, TOS_VERSION),
        acceptOne(DPA_KEY, DPA_VERSION),
      ]);
      setStep("company");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/business/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: companyName.trim(),
          kennitala: cleanKennitala(companyKennitala),
          agreement_version: AGREEMENT_VERSION,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || j.error || "Failed to create company");
      router.push(`/business/${j.id}`);
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
      <BusinessHeader
        crumbs={[{ label: t("b2b.signup.header", "Business onboarding") }]}
      />

      <main className="max-w-xl mx-auto px-6 py-12">
        <Stepper step={step} />

        {step === "agreement" && (
          <section className="bg-white rounded-2xl p-8 shadow-sm space-y-6">
            <header>
              <h1 className="text-2xl font-semibold">Platform terms &amp; data processing</h1>
              <p className="text-sm text-gray-600 mt-1">
                Two documents cover your use of the Lifeline portal and how we handle your employees&apos; data under GDPR /
                Icelandic law nr. 90/2018. Please read and accept both. Your separate commercial service agreement is
                signed later, once your programme is set up.
              </p>
            </header>

            {/* Terms of Service */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">1. Notkunarskilmálar (Terms of Service) — {TOS_VERSION}</h2>
              <p className="text-xs text-gray-500 mb-2">How you and your team use the Lifeline portal.</p>
              <pre className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-4 text-[12px] leading-relaxed text-gray-800 bg-gray-50 whitespace-pre-wrap font-sans">
{renderTermsOfService()}
              </pre>
              <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={tosChecked}
                  onChange={(e) => setTosChecked(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  Ég hef lesið og samþykki Notkunarskilmála Lifeline Health ({TOS_VERSION}) fyrir hönd fyrirtækisins.
                </span>
              </label>
            </div>

            {/* Data Processing Agreement */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">2. Vinnslusamningur (Data Processing Agreement) — {DPA_VERSION}</h2>
              <p className="text-xs text-gray-500 mb-2">How Lifeline processes your employees&apos; personal data.</p>
              <pre className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-4 text-[12px] leading-relaxed text-gray-800 bg-gray-50 whitespace-pre-wrap font-sans">
{renderDataProcessingAgreement()}
              </pre>
              <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dpaChecked}
                  onChange={(e) => setDpaChecked(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  Ég staðfesti heimild mína til að binda fyrirtækið og samþykki Vinnslusamninginn ({DPA_VERSION}).
                </span>
              </label>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <p className="text-xs text-gray-500">
              Tímastimpill, IP-tala og vafraauðkenni verða skráð sem hluti af samþykkinu.{" "}
              <Link href="/terms" className="text-blue-600 hover:underline">Skoða á opinberri síðu →</Link>
            </p>

            <button
              onClick={handleAgreement}
              disabled={!tosChecked || !dpaChecked || submitting}
              className="btn-primary w-full"
            >
              {submitting ? "Saving…" : "Accept both & continue"}
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
  const { t } = useI18n();
  // Account is always shown as completed — this page only renders once the
  // user is authenticated (auth happens on /business/login). Active step is
  // either Agreement or Company.
  const order = ["account", "agreement", "company"] as const;
  const idx = order.indexOf(step === "done" ? "company" : step);
  const labels = [
    t("b2b.signup.stepper.account", "Account"),
    t("b2b.signup.stepper.agreement", "Agreement"),
    t("b2b.signup.stepper.company", "Company"),
  ];
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
