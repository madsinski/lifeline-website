"use client";

// Vertical scroll-snap onboarding deck used in three places:
//   - /account/welcome   (signed-in client, B2B or B2C)
//   - /how-it-works      (public preview, no auth, no name)
//   - /business/onboard  (could opt in later)
//
// 8 slides. One idea per screen. Sticky progress rail on the right
// (desktop) so users see where they are; sticky CTA appears on the
// last slide. The "skip to end" link in the top-right jumps directly
// to slide 8 for impatient readers.
//
// Variant logic:
//   - `b2b` / `b2c` / `public` controls slide 6 copy (data-privacy
//     story) and the final CTA destination.
//   - firstName/companyName personalize slides 1 + 6 when present.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DoctorsTeam from "./DoctorsTeam";
import { useI18n } from "@/lib/i18n";

export type SlideshowVariant = "b2b" | "b2c" | "public";

interface Props {
  variant: SlideshowVariant;
  firstName?: string;
  companyName?: string | null;
  /** Where the final CTA points. Defaults differ per variant. */
  ctaHref?: string;
  /** Final CTA label override. */
  ctaLabel?: string;
  /** Called once when the user reaches slide 8. Use to stamp
      welcome_seen_at on the client. */
  onComplete?: () => void;
}

const TOTAL = 8;

export default function WelcomeSlideshow({
  variant,
  firstName,
  companyName,
  ctaHref,
  ctaLabel,
  onComplete,
}: Props) {
  const { locale } = useI18n();
  const tr = (is: string, en: string) => (locale === "is" ? is : en);
  const [active, setActive] = useState(1);
  const completedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track which slide is in view via IntersectionObserver. Triggers
  // onComplete the first time slide 8 becomes ≥50% visible.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const slides = root.querySelectorAll<HTMLElement>("[data-slide]");
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            const idx = parseInt(e.target.getAttribute("data-slide") || "1", 10);
            setActive(idx);
            if (idx === TOTAL && !completedRef.current) {
              completedRef.current = true;
              onComplete?.();
            }
          }
        }
      },
      { root, threshold: [0.5] },
    );
    slides.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [onComplete]);

  const scrollToSlide = (idx: number) => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-slide="${idx}"]`);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const finalHref = ctaHref || (
    variant === "b2c" ? "/account/onboard" :
    variant === "b2b" ? "/account" :
    // Public fallback points to the assessment funnel — pricing is
    // not public yet (/pricing renders a coming-soon placeholder).
    "/assessment"
  );
  const finalLabel = ctaLabel || (
    variant === "public"
      ? tr("Skoða leiðir til þátttöku", "Explore ways to take part")
      : tr("Halda áfram", "Continue")
  );

  return (
    <div className="relative h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Skip to end */}
      <button
        type="button"
        onClick={() => scrollToSlide(TOTAL)}
        className="absolute top-4 right-4 z-30 text-xs font-medium text-gray-500 hover:text-gray-800 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-gray-200"
      >
        {tr("Sleppa →", "Skip →")}
      </button>

      {/* Progress rail */}
      <nav
        aria-label="Slide progress"
        className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-20 flex-col gap-2"
      >
        {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => scrollToSlide(n)}
            aria-label={tr(`Hoppa á glæru ${n}`, `Jump to slide ${n}`)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              active === n
                ? "bg-emerald-500 scale-125"
                : "bg-gray-300 hover:bg-gray-400"
            }`}
          />
        ))}
      </nav>

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth"
      >
        <Slide n={1}>
          <div className="text-center">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-emerald-700 mb-3">
              {tr("Velkomin/n í Lifeline Health", "Welcome to Lifeline Health")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold text-[#0F172A] leading-tight">
              {firstName
                ? tr(`Hæ ${firstName} — `, `Hi ${firstName} — `)
                : tr("Hæ — ", "Hi — ")}
              <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">{tr("heilsuferðin þín byrjar hér.", "your health journey starts here.")}</span>
            </h1>
            <p className="text-lg text-gray-600 mt-5 max-w-xl mx-auto leading-relaxed">
              {tr(
                "Þessi stutta kynning útskýrir hvernig Lifeline virkar — það tekur um 3 mínútur. Skrunaðu niður þegar þú ert tilbúin/n.",
                "This short intro explains how Lifeline works — it takes about 3 minutes. Scroll down when you are ready.",
              )}
            </p>
            <button
              type="button"
              onClick={() => scrollToSlide(2)}
              className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              {tr("Byrja", "Start")}
              <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        </Slide>

        <Slide n={2} kicker={tr("Hvað er Lifeline?", "What is Lifeline?")}>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            {tr(
              "Heilbrigðisþjónusta — ekki bara app eða ráðgjöf.",
              "A healthcare service — not just an app or advice.",
            )}
          </h2>
          {locale === "is" ? (
            <p className="text-lg text-gray-700 mt-5 leading-relaxed">
              Lifeline Health rekur löggilta heilbrigðisþjónustu samkvæmt
              <strong> lögum nr. 40/2007</strong>, með starfsleyfi frá Embætti landlæknis.
            </p>
          ) : (
            <p className="text-lg text-gray-700 mt-5 leading-relaxed">
              Lifeline Health operates a licensed healthcare service under
              <strong> Act no. 40/2007</strong>, licensed by the Directorate of Health (Embætti landlæknis).
            </p>
          )}
          <p className="text-lg text-gray-700 mt-3 leading-relaxed">
            {tr(
              "Á bak við þjónustuna eru læknar, hjúkrunarfræðingar og þjálfarar — allir með tilskilin starfsleyfi. Það þýðir að mat, túlkun og ráðgjöf sem þú færð er klínísk — ekki almennar lífsstílsráðleggingar.",
              "Behind the service are doctors, nurses and coaches — all duly licensed. That means the assessment, interpretation and advice you receive is clinical — not generic lifestyle tips.",
            )}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { label: tr("Læknisleyfi", "Medical licence"), value: "✓" },
              { label: tr("Sjúkraskrá (Medalia)", "Medical record (Medalia)"), value: "55/2009" },
              { label: tr("Persónuvernd", "Data protection"), value: "GDPR" },
            ].map((b) => (
              <div key={b.label} className="bg-white border border-gray-100 rounded-xl p-3">
                <p className="text-emerald-600 font-bold text-base">{b.value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{b.label}</p>
              </div>
            ))}
          </div>
        </Slide>

        <Slide n={3} kicker={tr("Heildræn nálgun", "A holistic approach")}>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            {tr(
              "Fjórar grunnstoðir — vegna þess að heilsa er meira en mataræði og hreyfing.",
              "Four foundations — because health is more than diet and exercise.",
            )}
          </h2>
          <p className="text-base text-gray-600 mt-5 max-w-2xl">
            {tr(
              "Heilsumat Lifeline byggir á því að líta heildrænt á alla fjóra þætti. Þeir hafa allir áhrif hver á annan, og engin einföld ráðlegging dugar fyrir alla.",
              "The Lifeline health assessment looks holistically at all four factors. They all affect one another, and no single piece of advice fits everyone.",
            )}
          </p>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Pillar emoji="🏃" name={tr("Hreyfing", "Exercise")} tone="bg-orange-50 text-orange-700" />
            <Pillar emoji="🥗" name={tr("Næring", "Nutrition")} tone="bg-lime-50 text-lime-700" />
            <Pillar emoji="🌙" name={tr("Svefn", "Sleep")} tone="bg-violet-50 text-violet-700" />
            <Pillar emoji="🧠" name={tr("Andleg líðan", "Mental wellbeing")} tone="bg-sky-50 text-sky-700" />
          </div>
        </Slide>

        <Slide n={4} kicker={tr("Heilsumatið þitt", "Your health assessment")}>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            {tr(
              "Fjögur skref — frá fyrstu mælingu að einstaklingsbundnu heilsuplani.",
              "Four steps — from the first measurement to a personalised health plan.",
            )}
          </h2>
          <ol className="mt-8 space-y-5">
            {[
              { n: 1, t: tr("Líkamssamsetningarmæling", "Body composition measurement"), d: tr("5 mín á Sameind. Biody mælir fitu, vöðva, BMR og fleira.", "5 min at Sameind. Biody measures fat, muscle, BMR and more."), time: tr("5 mín", "5 min") },
              { n: 2, t: tr("Blóðprufa", "Blood test"), d: tr("Þú gengur inn á Sameind á tilteknum dögum — föstudagar oftast. Fasta frá miðnætti.", "Walk in at Sameind on set days — usually Fridays. Fast from midnight."), time: tr("10 mín", "10 min") },
              { n: 3, t: tr("Læknir túlkar niðurstöður", "A doctor interprets the results"), d: tr("Læknir Lifeline fer yfir niðurstöðurnar og útbýr persónulegt heilsuplan.", "A Lifeline doctor reviews the results and prepares a personal health plan."), time: tr("Skrifað", "Written") },
              { n: 4, t: tr("Heilsuplanið þitt + eftirfylgd", "Your health plan + follow-up"), d: tr("Þú færð skýrslu og plan í þjónustusíðunni; þjálfari heldur áfram með þér.", "You get a report and plan in your service portal; a coach continues with you."), time: tr("Áfram", "Ongoing") },
            ].map((s) => (
              <li key={s.n} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 text-white font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                  {s.n}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[#0F172A]">{s.t}</p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{s.time}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Slide>

        <Slide n={5} kicker={tr("Hvað við mælum", "What we measure")}>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            {tr("Aðeins það sem hreyfir nálina.", "Only what moves the needle.")}
          </h2>
          <p className="text-base text-gray-600 mt-5 max-w-2xl">
            {tr(
              "Við mælum ekki allt sem hægt er að mæla — bara þá þætti sem segja okkur eitthvað sem getur breytt heilsu þinni.",
              "We don't measure everything that can be measured — only the factors that tell us something that can change your health.",
            )}
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <MeasureGroup
              title={tr("Líkamssamsetning", "Body composition")}
              items={[
                tr("Fituhlutfall", "Body fat percentage"),
                tr("Vöðvamassi", "Muscle mass"),
                tr("Fasahorn", "Phase angle"),
                tr("Líkamsvökvi", "Body water"),
                tr("Grunnefnaskipti (BMR)", "Basal metabolic rate (BMR)"),
              ]}
              tone="from-orange-50 to-orange-100/40"
            />
            <MeasureGroup
              title={tr("Blóðmælingar", "Blood measurements")}
              items={[
                tr("Blóðsykur (HbA1c)", "Blood sugar (HbA1c)"),
                tr("Lípíð (kólesteról, þríglýseríð)", "Lipids (cholesterol, triglycerides)"),
                tr("Lifrar- og nýrnastarfsemi", "Liver and kidney function"),
                tr("Vítamín D, B12", "Vitamin D, B12"),
                tr("Bólgumarkar (CRP)", "Inflammatory markers (CRP)"),
              ]}
              tone="from-rose-50 to-rose-100/40"
            />
            <MeasureGroup
              title={tr("Líkamleg lífsmörk", "Physical vitals")}
              items={[
                tr("Blóðþrýstingur", "Blood pressure"),
                tr("Hæð, þyngd, BMI", "Height, weight, BMI"),
                tr("Ummál, mittismál", "Circumference, waist measurement"),
              ]}
              tone="from-blue-50 to-blue-100/40"
            />
            <MeasureGroup
              title={tr("Lífsstíll og líðan", "Lifestyle and wellbeing")}
              items={[
                tr("Hreyfing", "Exercise"),
                tr("Næringarvenjur", "Nutrition habits"),
                tr("Svefn", "Sleep"),
                tr("Streita og andleg líðan", "Stress and mental wellbeing"),
                tr("Fjölskyldusaga", "Family history"),
              ]}
              tone="from-emerald-50 to-emerald-100/40"
            />
          </div>
        </Slide>

        <Slide n={6} kicker={tr("Þín gögn", "Your data")}>
          {variant === "b2b" ? (
            <>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
                {companyName
                  ? tr(`${companyName} sér aldrei niðurstöðurnar þínar.`, `${companyName} never sees your results.`)
                  : tr("Vinnuveitandinn sér aldrei niðurstöðurnar þínar.", "Your employer never sees your results.")}
              </h2>
              {locale === "is" ? (
                <p className="text-lg text-gray-700 mt-5 leading-relaxed">
                  Heilsugögnin þín lifa í <strong>Medalia sjúkraskrárkerfinu</strong> samkvæmt lögum
                  nr. 55/2009. Lifeline-starfsfólkið er bundið ævilangri þagnarskyldu samkvæmt
                  lögum nr. 34/2012 — eins og hver annar læknir.
                </p>
              ) : (
                <p className="text-lg text-gray-700 mt-5 leading-relaxed">
                  Your health data lives in the <strong>Medalia medical record system</strong> under Act
                  no. 55/2009. Lifeline staff are bound by lifelong confidentiality under
                  Act no. 34/2012 — like any other doctor.
                </p>
              )}
              <p className="text-lg text-gray-700 mt-3 leading-relaxed">
                {tr(
                  `${companyName || "Vinnuveitandinn"} fær aðeins staðfestingu á þátttöku — nöfn og fjölda — aldrei klínísk gögn um þig persónulega.`,
                  `${companyName || "Your employer"} only receives confirmation of participation — names and counts — never clinical data about you personally.`,
                )}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
                {tr(
                  "Gögnin þín — geymd örugg, varin af læknislögum.",
                  "Your data — stored securely, protected by medical law.",
                )}
              </h2>
              {locale === "is" ? (
                <p className="text-lg text-gray-700 mt-5 leading-relaxed">
                  Heilsugögnin þín lifa í <strong>Medalia sjúkraskrárkerfinu</strong> samkvæmt lögum
                  nr. 55/2009 um sjúkraskrár — sama lagaverk og á við hjá heilsugæslu og spítölum.
                </p>
              ) : (
                <p className="text-lg text-gray-700 mt-5 leading-relaxed">
                  Your health data lives in the <strong>Medalia medical record system</strong> under Act
                  no. 55/2009 on medical records — the same legal framework that applies at clinics and hospitals.
                </p>
              )}
              <p className="text-lg text-gray-700 mt-3 leading-relaxed">
                {tr(
                  "Lifeline-starfsfólkið er bundið ævilangri þagnarskyldu samkvæmt lögum nr. 34/2012. Þú getur hvenær sem er beðið um afrit, leiðréttingu eða eyðingu — sjá persónuverndaryfirlýsingu.",
                  "Lifeline staff are bound by lifelong confidentiality under Act no. 34/2012. You can request a copy, correction or deletion at any time — see the Privacy Policy.",
                )}
              </p>
            </>
          )}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { i: "🇮🇸", t: tr("Geymt á Íslandi", "Stored in Iceland") },
              { i: "🔒", t: tr("TLS + dulkóðun", "TLS + encryption") },
              { i: "📋", t: tr("Skráður aðgangur", "Logged access") },
            ].map((b) => (
              <div key={b.t} className="bg-white border border-gray-100 rounded-xl p-3 text-center">
                <p className="text-2xl">{b.i}</p>
                <p className="text-xs text-gray-600 mt-1 leading-snug">{b.t}</p>
              </div>
            ))}
          </div>
        </Slide>

        <Slide n={7} kicker={tr("Læknarnir okkar", "Our doctors")}>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            {tr("Þú ert í læknishöndum.", "You are in a doctor's hands.")}
          </h2>
          <p className="text-base text-gray-600 mt-5 max-w-2xl">
            {tr(
              "Allir læknar Lifeline hafa starfsleyfi frá Embætti landlæknis og koma að heilsumati þínu beint.",
              "Every Lifeline doctor is licensed by the Directorate of Health (Embætti landlæknis) and is directly involved in your health assessment.",
            )}
          </p>
          <div className="mt-8">
            <DoctorsTeam compact />
          </div>
        </Slide>

        <Slide n={8} kicker={tr("Þú ert tilbúin/n", "You are ready")}>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            {tr("Næsta skref.", "Next step.")}
          </h2>
          <p className="text-base text-gray-600 mt-5 max-w-2xl leading-relaxed">
            {variant === "public"
              ? tr(
                  "Þú ert búin/n með kynninguna. Skoðaðu hvernig hægt er að taka þátt — sem einstaklingur eða gegnum vinnuveitanda.",
                  "You have finished the intro. See how you can take part — as an individual or through your employer.",
                )
              : tr(
                  "Þú ert búin/n með kynninguna. Næsta skref er að bóka líkamssamsetningarmælingu og blóðprufu — það tekur um 5 mínútur saman.",
                  "You have finished the intro. The next step is to book a body composition measurement and blood test — it takes about 5 minutes together.",
                )}
          </p>
          <ul className="mt-6 space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>{tr("Bókaðu mælingaslot sem hentar þér.", "Book a measurement slot that suits you.")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>{tr("Mundu að fasta frá miðnætti fyrir blóðprufuna — vatn er í lagi.", "Remember to fast from midnight before the blood test — water is fine.")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>{tr("Þú færð staðfestingarpóst og áminningar áður en mælingin fer fram.", "You will get a confirmation email and reminders before the measurement takes place.")}</span>
            </li>
          </ul>
          <div className="mt-10">
            <Link
              href={finalHref}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-blue-600 to-emerald-500 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-shadow"
            >
              {finalLabel}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            <p className="text-xs text-gray-400 mt-4">
              {tr("Spurningar? Skrifaðu okkur á ", "Questions? Write to us at ")}
              <a className="underline" href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
            </p>
          </div>
        </Slide>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────

function Slide({ n, kicker, children }: { n: number; kicker?: string; children: React.ReactNode }) {
  return (
    <section
      data-slide={n}
      className="snap-start min-h-screen flex items-center justify-center px-6 py-16"
    >
      <div className="max-w-3xl w-full">
        {kicker && (
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-emerald-700 mb-3">
            {kicker}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

function Pillar({ emoji, name, tone }: { emoji: string; name: string; tone: string }) {
  return (
    <div className={`rounded-2xl p-5 text-center border border-gray-100 shadow-sm ${tone}`}>
      <div className="text-4xl">{emoji}</div>
      <p className="text-sm font-semibold mt-2">{name}</p>
    </div>
  );
}

function MeasureGroup({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br ${tone} border border-gray-100`}>
      <p className="text-sm font-semibold text-[#0F172A] mb-2">{title}</p>
      <ul className="text-xs text-gray-700 space-y-1">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span className="text-emerald-600 mt-0.5">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
