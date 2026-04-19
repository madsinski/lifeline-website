"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

type StepStatus = "done" | "pending" | "blocked";

export default function AccountWelcomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [biodyActive, setBiodyActive] = useState(false);
  const [hasBodyCompSlot, setHasBodyCompSlot] = useState(false);
  const [hasBloodBooking, setHasBloodBooking] = useState(false);
  const [hasAnyDoctor, setHasAnyDoctor] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/account/login"); return; }
      const { data: client } = await supabase
        .from("clients")
        .select("full_name, company_id, biody_patient_id, video_consultation_portal_confirmed_at")
        .eq("id", user.id)
        .maybeSingle();
      if (client) {
        setFirstName((client.full_name || "").split(" ")[0] || "");
        setBiodyActive(!!client.biody_patient_id);
        setHasAnyDoctor(!!client.video_consultation_portal_confirmed_at);
        const cid = client.company_id as string | null;
        if (cid) {
          const { data: c } = await supabase.from("companies").select("name").eq("id", cid).maybeSingle();
          if (c?.name) setCompanyName(c.name);
          const [{ data: myB }, { data: myBlood }] = await Promise.all([
            supabase.from("body_comp_event_bookings").select("slot_at").eq("client_id", user.id).limit(1).maybeSingle(),
            supabase.from("blood_test_bookings").select("day").eq("client_id", user.id).limit(1).maybeSingle(),
          ]);
          setHasBodyCompSlot(!!myB);
          setHasBloodBooking(!!myBlood);
        }
        // Check in-person doctor slot too
        const { data: drSlot } = await supabase
          .from("doctor_slots")
          .select("id")
          .eq("client_id", user.id)
          .is("completed_at", null)
          .limit(1)
          .maybeSingle();
        if (drSlot) setHasAnyDoctor(true);
      }
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl p-8 sm:p-10 text-white shadow-sm" style={{ background: "linear-gradient(135deg, #3B82F6, #10B981)" }}>
          <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          {companyName && (
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-90 mb-2">
              {t("b2b.welcome.hero.via", "Via {{company}}").replace("{{company}}", companyName)}
            </p>
          )}
          <h1 className="relative text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
            {firstName
              ? t("b2b.welcome.hero.title_name", "Welcome to Lifeline, {{name}}.").replace("{{name}}", firstName)
              : t("b2b.welcome.hero.title", "Welcome to Lifeline.")}
          </h1>
          <p className="relative mt-3 text-base sm:text-lg opacity-95 max-w-xl leading-relaxed">
            {t("b2b.welcome.hero.body", "We're glad you're here. Take a minute to get oriented — then head to your dashboard to take the next steps at your own pace.")}
          </p>
        </section>

        {/* Intro video */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="font-semibold text-lg text-[#1F2937]">
            {t("b2b.welcome.intro.title", "A 90-second intro to Lifeline")}
          </h2>
          <div className="mt-4 aspect-video w-full rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 via-white to-emerald-100 flex items-center justify-center border border-gray-100">
            <div className="text-center px-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-white shadow-md flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-blue-700 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="text-sm text-gray-600">
                {t("b2b.welcome.intro.coming", "Intro video — coming soon")}
              </div>
            </div>
          </div>
        </section>

        {/* Our promise */}
        <section className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-10 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] via-[#0D9488] to-[#10B981]" />
          <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-2">
            {t("b2b.welcome.promise.kicker", "Our promise to you")}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] leading-tight">
            {t("b2b.welcome.promise.title", "Real health change, the least effort it takes.")}
          </h2>
          <div className="mt-5 space-y-4 text-[#334155] leading-relaxed max-w-2xl">
            <p>
              {t("b2b.welcome.promise.p1",
                "We built Lifeline for the person who wants genuine change without guessing. Our job is to make the path clear — so every step you take actually moves your health forward.")}
            </p>
            <p>
              {t("b2b.welcome.promise.p2",
                "You'll get a medical-grade assessment, a plain-language report, and a doctor-led action plan. We only measure what drives change, and we only ask for the effort that actually matters.")}
            </p>
            <p>
              {t("b2b.welcome.promise.p3",
                "Your data stays yours. Everything clinical lives in your secure patient portal. Your employer only sees anonymised group trends — never anything that can be traced back to you.")}
            </p>
            <p>
              {t("b2b.welcome.promise.p4",
                "We'll be alongside you — in person, in the app, and through your health coach. Welcome aboard.")}
            </p>
          </div>

          {/* Team photo + signature */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-5 gap-6 items-center">
            <div className="sm:col-span-3 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-100 via-white to-emerald-100 aspect-[16/9] relative border border-gray-100">
              <Image
                src="/team-photo.jpg"
                alt={t("b2b.welcome.team.alt", "The Lifeline team")}
                fill
                sizes="(max-width: 640px) 100vw, 60vw"
                className="object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-center pointer-events-none">
                <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-sm text-[#64748B] mb-1">
                {t("b2b.welcome.team.with_love", "With care,")}
              </div>
              <div className="font-signature text-2xl sm:text-3xl text-[#0F172A]" style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}>
                {t("b2b.welcome.team.signature", "— The Lifeline team")}
              </div>
              <p className="mt-3 text-xs text-[#64748B] leading-relaxed">
                {t("b2b.welcome.team.note", "Physicians, coaches and engineers — all working to make your health journey genuinely easier.")}
              </p>
            </div>
          </div>
        </section>

        {/* Your next steps (status only — actions happen on the dashboard) */}
        <NextStepsCard
          biodyActive={biodyActive}
          hasBodyCompSlot={hasBodyCompSlot}
          hasBloodBooking={hasBloodBooking}
          hasAnyDoctor={hasAnyDoctor}
        />

        {/* Dashboard CTA */}
        <div className="flex justify-center">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-white text-base font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:opacity-95 transition-all"
            style={{ background: "linear-gradient(135deg, #3B82F6, #10B981)" }}
          >
            {t("b2b.welcome.cta.dashboard", "Go to your dashboard")}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <style jsx global>{`
          .input { width:100%; padding:0.625rem 0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; }
          .input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
        `}</style>
      </main>
    </div>
  );
}

function NextStepsCard({
  biodyActive, hasBodyCompSlot, hasBloodBooking, hasAnyDoctor,
}: {
  biodyActive: boolean;
  hasBodyCompSlot: boolean;
  hasBloodBooking: boolean;
  hasAnyDoctor: boolean;
}) {
  const { t } = useI18n();
  const steps: Array<{ title: string; desc: string; status: StepStatus }> = [
    {
      title: t("b2b.welcome.next.bodycomp_profile", "Activate body-composition profile"),
      desc: t("b2b.welcome.next.bodycomp_profile_desc", "Quick details — height, weight, activity level."),
      status: biodyActive ? "done" : "pending",
    },
    {
      title: t("b2b.welcome.next.measurements", "Book your on-site measurement"),
      desc: t("b2b.welcome.next.measurements_desc", "Pick a 5-minute slot from your company's measurement day."),
      status: hasBodyCompSlot ? "done" : biodyActive ? "pending" : "blocked",
    },
    {
      title: t("b2b.welcome.next.bloodtest", "Pick your blood-test day"),
      desc: t("b2b.welcome.next.bloodtest_desc", "Walk-in at a partner lab during your company-approved days."),
      status: hasBloodBooking ? "done" : "pending",
    },
    {
      title: t("b2b.welcome.next.doctor", "Doctor consultation"),
      desc: t("b2b.welcome.next.doctor_desc", "In person or secure video meeting to review your results."),
      status: hasAnyDoctor ? "done" : "pending",
    },
  ];

  return (
    <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1F2937]">
        {t("b2b.welcome.next.title", "Your next steps")}
      </h2>
      <p className="text-sm text-[#6B7280] mt-1">
        {t("b2b.welcome.next.sub", "Here's what's coming. Complete each step at your own pace from your dashboard.")}
      </p>
      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 py-2">
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              s.status === "done" ? "bg-emerald-500 text-white"
              : s.status === "pending" ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-400"
            }`}>
              {s.status === "done" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm ${s.status === "done" ? "text-gray-500 line-through" : "text-[#1F2937]"}`}>
                {s.title}
              </div>
              <div className="text-xs text-[#6B7280] mt-0.5">{s.desc}</div>
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
              s.status === "done" ? "text-emerald-600"
              : s.status === "pending" ? "text-blue-600"
              : "text-gray-400"
            }`}>
              {s.status === "done" ? t("b2b.welcome.next.done", "Done")
                : s.status === "pending" ? t("b2b.welcome.next.pending", "Pending")
                : t("b2b.welcome.next.upcoming", "Upcoming")}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
