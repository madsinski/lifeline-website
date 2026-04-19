"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

export default function AccountWelcomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/account/login"); return; }
      const { data: client } = await supabase
        .from("clients")
        .select("full_name, company_id")
        .eq("id", user.id)
        .maybeSingle();
      if (client) {
        setFirstName((client.full_name || "").split(" ")[0] || "");
        const cid = client.company_id as string | null;
        if (cid) {
          const { data: c } = await supabase.from("companies").select("name").eq("id", cid).maybeSingle();
          if (c?.name) setCompanyName(c.name);
        }
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
            {t("b2b.welcome.hero.body", "You're all set up. A few quick things and you're ready to start building healthier habits with guidance from Icelandic doctors and coaches.")}
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

        {/* Next steps — hero CTA to the dashboard */}
        <NextStepsHero />

        <style jsx global>{`
          .input { width:100%; padding:0.625rem 0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; }
          .input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
        `}</style>
      </main>
    </div>
  );
}

function NextStepsHero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden rounded-2xl shadow-sm text-white" style={{ background: "linear-gradient(135deg, #3B82F6, #10B981)" }}>
      <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="relative p-8 sm:p-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t("b2b.welcome.next.kicker", "Your next steps")}
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold leading-tight max-w-xl mx-auto">
          {t("b2b.welcome.next.title2", "Ready when you are.")}
        </h2>
        <p className="mt-3 text-base opacity-95 leading-relaxed max-w-xl mx-auto">
          {t("b2b.welcome.next.sub2", "Your dashboard has everything you need — take the next steps at your own pace.")}
        </p>
        <div className="mt-7 flex justify-center">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0F172A] text-base font-semibold shadow-lg shadow-black/20 hover:shadow-black/30 hover:opacity-95 transition-all"
          >
            {t("b2b.welcome.cta.dashboard", "Go to your dashboard")}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
