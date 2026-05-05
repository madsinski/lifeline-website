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
    "/pricing"
  );
  const finalLabel = ctaLabel || (
    variant === "public" ? "Skoða leiðir til þátttöku" : "Halda áfram"
  );

  return (
    <div className="relative h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Skip to end */}
      <button
        type="button"
        onClick={() => scrollToSlide(TOTAL)}
        className="absolute top-4 right-4 z-30 text-xs font-medium text-gray-500 hover:text-gray-800 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-gray-200"
      >
        Sleppa →
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
            aria-label={`Hoppa á glæru ${n}`}
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
              Velkomin/n í Lifeline Health
            </p>
            <h1 className="text-4xl md:text-6xl font-bold text-[#0F172A] leading-tight">
              {firstName ? `Hæ ${firstName} — ` : "Hæ — "}
              <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">heilsuferðin þín byrjar hér.</span>
            </h1>
            <p className="text-lg text-gray-600 mt-5 max-w-xl mx-auto leading-relaxed">
              Þessi stutta kynning útskýrir hvernig Lifeline virkar — það tekur um 3 mínútur.
              Skrunaðu niður þegar þú ert tilbúin/n.
            </p>
            <button
              type="button"
              onClick={() => scrollToSlide(2)}
              className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Byrja
              <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        </Slide>

        <Slide n={2} kicker="Hvað er Lifeline?">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            Heilbrigðisþjónusta — ekki bara app eða ráðgjöf.
          </h2>
          <p className="text-lg text-gray-700 mt-5 leading-relaxed">
            Lifeline Health rekur löggilta heilbrigðisþjónustu samkvæmt
            <strong> lögum nr. 40/2007</strong>, með starfsleyfi frá Embætti landlæknis.
          </p>
          <p className="text-lg text-gray-700 mt-3 leading-relaxed">
            Á bak við þjónustuna eru læknar, hjúkrunarfræðingar og þjálfarar — allir með tilskilin
            starfsleyfi. Það þýðir að mat, túlkun og ráðgjöf sem þú færð er klínísk —
            ekki almennar lífsstílsráðleggingar.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Læknisleyfi", value: "✓" },
              { label: "Sjúkraskrá (Medalia)", value: "55/2009" },
              { label: "Persónuvernd", value: "GDPR" },
            ].map((b) => (
              <div key={b.label} className="bg-white border border-gray-100 rounded-xl p-3">
                <p className="text-emerald-600 font-bold text-base">{b.value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{b.label}</p>
              </div>
            ))}
          </div>
        </Slide>

        <Slide n={3} kicker="Heildræn nálgun">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            Fjórar grunnstoðir — vegna þess að heilsa er meira en mataræði og hreyfing.
          </h2>
          <p className="text-base text-gray-600 mt-5 max-w-2xl">
            Heilsumat Lifeline byggir á því að líta heildrænt á alla fjóra þætti.
            Þeir hafa allir áhrif hver á annan, og engin einföld ráðlegging dugar fyrir alla.
          </p>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Pillar emoji="🏃" name="Hreyfing" tone="bg-orange-50 text-orange-700" />
            <Pillar emoji="🥗" name="Næring" tone="bg-lime-50 text-lime-700" />
            <Pillar emoji="🌙" name="Svefn" tone="bg-violet-50 text-violet-700" />
            <Pillar emoji="🧠" name="Andleg líðan" tone="bg-sky-50 text-sky-700" />
          </div>
        </Slide>

        <Slide n={4} kicker="Heilsumatið þitt">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            Fjögur skref — frá fyrstu mælingu að einstaklingsbundnu heilsuplani.
          </h2>
          <ol className="mt-8 space-y-5">
            {[
              { n: 1, t: "Líkamssamsetningarmæling", d: "5 mín á Sameind. Biody mælir fitu, vöðva, BMR og fleira.", time: "5 mín" },
              { n: 2, t: "Blóðprufa", d: "Þú gengur inn á Sameind á tilteknum dögum — föstudagar oftast. Fasta frá miðnætti.", time: "10 mín" },
              { n: 3, t: "Læknir túlkar niðurstöður", d: "Læknir Lifeline fer yfir niðurstöðurnar og útbýr persónulegt heilsuplan.", time: "Skrifað" },
              { n: 4, t: "Heilsuplanið þitt + eftirfylgd", d: "Þú færð skýrslu og plan í þjónustusíðunni; þjálfari heldur áfram með þér.", time: "Áfram" },
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

        <Slide n={5} kicker="Hvað við mælum">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            Aðeins það sem hreyfir nálina.
          </h2>
          <p className="text-base text-gray-600 mt-5 max-w-2xl">
            Við mælum ekki allt sem hægt er að mæla — bara þá þætti sem segja
            okkur eitthvað sem getur breytt heilsu þinni.
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <MeasureGroup
              title="Líkamssamsetning"
              items={["Fituhlutfall", "Vöðvamassi", "Fasahorn", "Líkamsvökvi", "Grunnefnaskipti (BMR)"]}
              tone="from-orange-50 to-orange-100/40"
            />
            <MeasureGroup
              title="Blóðmælingar"
              items={["Blóðsykur (HbA1c)", "Lípíð (kólesteról, þríglýseríð)", "Lifrar- og nýrnastarfsemi", "Vítamín D, B12", "Bólgumarkar (CRP)"]}
              tone="from-rose-50 to-rose-100/40"
            />
            <MeasureGroup
              title="Líkamleg lífsmörk"
              items={["Blóðþrýstingur", "Hæð, þyngd, BMI", "Ummál, mittismál"]}
              tone="from-blue-50 to-blue-100/40"
            />
            <MeasureGroup
              title="Lífsstíll og líðan"
              items={["Hreyfing", "Næringarvenjur", "Svefn", "Streita og andleg líðan", "Fjölskyldusaga"]}
              tone="from-emerald-50 to-emerald-100/40"
            />
          </div>
        </Slide>

        <Slide n={6} kicker="Þín gögn">
          {variant === "b2b" ? (
            <>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
                {companyName ? `${companyName} sér aldrei niðurstöðurnar þínar.` : "Vinnuveitandinn sér aldrei niðurstöðurnar þínar."}
              </h2>
              <p className="text-lg text-gray-700 mt-5 leading-relaxed">
                Heilsugögnin þín lifa í <strong>Medalia sjúkraskrárkerfinu</strong> samkvæmt lögum
                nr. 55/2009. Lifeline-starfsfólkið er bundið ævilangri þagnarskyldu samkvæmt
                lögum nr. 34/2012 — eins og hver annar læknir.
              </p>
              <p className="text-lg text-gray-700 mt-3 leading-relaxed">
                {companyName || "Vinnuveitandinn"} fær aðeins staðfestingu á þátttöku — nöfn og fjölda — aldrei klínísk gögn um þig persónulega.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
                Gögnin þín — geymd örugg, varin af læknislögum.
              </h2>
              <p className="text-lg text-gray-700 mt-5 leading-relaxed">
                Heilsugögnin þín lifa í <strong>Medalia sjúkraskrárkerfinu</strong> samkvæmt lögum
                nr. 55/2009 um sjúkraskrár — sama lagaverk og á við hjá heilsugæslu og spítölum.
              </p>
              <p className="text-lg text-gray-700 mt-3 leading-relaxed">
                Lifeline-starfsfólkið er bundið ævilangri þagnarskyldu samkvæmt lögum nr. 34/2012.
                Þú getur hvenær sem er beðið um afrit, leiðréttingu eða eyðingu — sjá persónuverndaryfirlýsingu.
              </p>
            </>
          )}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { i: "🇮🇸", t: "Geymt á Íslandi" },
              { i: "🔒", t: "TLS + dulkóðun" },
              { i: "📋", t: "Skráður aðgangur" },
            ].map((b) => (
              <div key={b.t} className="bg-white border border-gray-100 rounded-xl p-3 text-center">
                <p className="text-2xl">{b.i}</p>
                <p className="text-xs text-gray-600 mt-1 leading-snug">{b.t}</p>
              </div>
            ))}
          </div>
        </Slide>

        <Slide n={7} kicker="Læknarnir okkar">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            Þú ert í læknishöndum.
          </h2>
          <p className="text-base text-gray-600 mt-5 max-w-2xl">
            Allir læknar Lifeline hafa starfsleyfi frá Embætti landlæknis og koma að heilsumati þínu beint.
          </p>
          <div className="mt-8">
            <DoctorsTeam compact />
          </div>
        </Slide>

        <Slide n={8} kicker="Þú ert tilbúin/n">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight">
            Næsta skref.
          </h2>
          <p className="text-base text-gray-600 mt-5 max-w-2xl leading-relaxed">
            {variant === "public"
              ? "Þú ert búin/n með kynninguna. Skoðaðu hvernig hægt er að taka þátt — sem einstaklingur eða gegnum vinnuveitanda."
              : "Þú ert búin/n með kynninguna. Næsta skref er að bóka líkamssamsetningarmælingu og blóðprufu — það tekur um 5 mínútur saman."}
          </p>
          <ul className="mt-6 space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Bókaðu mælingaslot sem hentar þér.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Mundu að fasta frá miðnætti fyrir blóðprufuna — vatn er í lagi.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Þú færð staðfestingarpóst og áminningar áður en mælingin fer fram.</span>
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
              Spurningar? Skrifaðu okkur á <a className="underline" href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
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
