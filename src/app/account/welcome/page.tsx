"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LifelineLogo from "@/app/components/LifelineLogo";
import BackButton from "@/app/components/BackButton";
import MedaliaButton from "@/app/components/MedaliaButton";

type BiodyState = "unknown" | "active" | "activating" | "failed";

export default function AccountWelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [biodyState, setBiodyState] = useState<BiodyState>("unknown");
  const [activateError, setActivateError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/account/login");
        return;
      }
      const { data: client } = await supabase
        .from("clients")
        .select("full_name, company_id, biody_patient_id")
        .eq("id", user.id)
        .maybeSingle();
      if (client) {
        setFirstName((client.full_name || "").split(" ")[0] || "");
        setBiodyState(client.biody_patient_id ? "active" : "unknown");
        const cid = (client as Record<string, unknown>).company_id as string | null;
        if (cid) {
          const { data: c } = await supabase.from("companies").select("name").eq("id", cid).maybeSingle();
          if (c?.name) setCompanyName(c.name);
        }
      }
      setLoading(false);
    })();
  }, [router]);

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
    } else {
      setBiodyState("failed");
      setActivateError(
        typeof j.detail === "string"
          ? j.detail
          : j.error === "missing_client_fields"
            ? "Your profile is missing sex, height, weight, or activity level. Complete your profile in Settings first."
            : j.error || "Activation failed. Please contact support."
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
        <Link href="/account" className="text-sm text-gray-600 hover:text-gray-900">
          Skip &rarr;
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <section className="rounded-2xl p-8 text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, #3B82F6, #10B981, #3B82F6)" }}>
          {companyName && (
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-90 mb-2">
              Via {companyName}
            </p>
          )}
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
            Welcome to Lifeline{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-3 text-base opacity-95 max-w-xl">
            You&apos;re all set up. Three quick things and you&apos;re ready to start building healthier
            habits with guidance from Icelandic physicians and coaches.
          </p>
        </section>

        {/* Intro video */}
        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-3">A 90-second intro to Lifeline</h2>
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 via-white to-emerald-100 flex items-center justify-center border border-gray-100">
            <div className="text-center px-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-white/80 flex items-center justify-center shadow-sm mb-2">
                <svg className="w-6 h-6 text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="text-sm text-gray-600">Intro video — coming soon</div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Lifeline Health combines targeted assessments with daily coaching across four pillars —
            exercise, nutrition, sleep, mental wellness. You&apos;ll do a body-composition scan at
            a Lifeline station, receive a personalised report from a physician, and follow a
            tailored daily plan in the app.
          </p>
        </section>

        {/* Step-by-step */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your next steps</h2>

          {/* Step 1: Activate Biody */}
          <StepCard
            n={1}
            title="Activate your body-composition profile"
            body="Register yourself with our measurement partner Biody so your scan data is linked to your Lifeline account automatically."
            state={biodyState === "active" ? "done" : biodyState === "activating" ? "busy" : "pending"}
            action={
              biodyState === "active" ? (
                <span className="text-emerald-700 font-medium text-sm">Activated ✓</span>
              ) : (
                <button
                  onClick={activateBiody}
                  disabled={biodyState === "activating"}
                  className="btn-primary-solid"
                >
                  {biodyState === "activating" ? "Activating…" : "Activate profile"}
                </button>
              )
            }
            error={biodyState === "failed" ? activateError : ""}
          />

          {/* Step 2: Book scan */}
          <StepCard
            n={2}
            title="Book your body-composition scan"
            body="Come in to a Lifeline station to complete the full-body scan. The result becomes the starting point of your coaching plan."
            state="pending"
            action={
              <Link href="/assessment" className="btn-primary-solid">
                Book scan
              </Link>
            }
          />

          {/* Step 3: Patient Portal */}
          <StepCard
            n={3}
            title="Access your patient portal"
            body="Your clinical records, appointments, and physician notes live in our secure patient portal (Medalia)."
            state="pending"
            action={<MedaliaButton label="Open portal" size="sm" />}
          />

          {/* Step 4: Download app */}
          <StepCard
            n={4}
            title="Download the Lifeline app"
            body="Daily actions, meal logging, weigh-ins, and your coaching dashboard live in the app."
            state="pending"
            action={
              <button disabled className="btn-ghost-solid opacity-60 cursor-not-allowed">
                Coming soon
              </button>
            }
          />
        </section>

        <div className="flex justify-center pt-4">
          <Link href="/account" className="btn-primary-solid">
            Go to my dashboard
          </Link>
        </div>
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
  action: React.ReactNode;
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
