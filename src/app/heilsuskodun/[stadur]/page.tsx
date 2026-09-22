// Public entry point per location, e.g. /heilsuskodun/vestmannaeyjar.
// Step one is always the same: create a free account and see your options
// from there. Bypasses the coming-soon gate (src/proxy.ts) so it can be
// shared on posters, by employers and by the heilsugæsla.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const [{ data: loc }, { data: pkg }] = await Promise.all([
    supabaseAdmin.from("hc_locations").select("slug, name, blood_test_site, measurement_site, interview_site").eq("slug", slug).eq("active", true).maybeSingle(),
    supabaseAdmin.from("hc_packages").select("name, price_isk, includes").eq("key", "heilsufarsskodun").maybeSingle(),
  ]);
  return { loc, pkg };
}

export async function generateMetadata({ params }: { params: Promise<{ stadur: string }> }): Promise<Metadata> {
  const { loc } = await load((await params).stadur);
  return {
    title: loc ? `Heilsufarsskoðun í ${loc.name} | Lifeline Health` : "Heilsufarsskoðun | Lifeline Health",
    description: "Svefn, hreyfing, næring og andleg líðan, mælingar og blóðprufa, viðtal og aðgerðaáætlun til þriggja mánaða.",
  };
}

export default async function LocationLanding({ params }: { params: Promise<{ stadur: string }> }) {
  const slug = (await params).stadur;
  const { loc, pkg } = await load(slug);
  if (!loc) notFound();

  const next = `/account/heilsuferd?stadur=${encodeURIComponent(loc.slug)}`;
  const signup = `/account/login?mode=signup&next=${encodeURIComponent(next)}`;
  const login = `/account/login?next=${encodeURIComponent(next)}`;

  const steps = [
    { t: "Stofnaðu frían aðgang", d: "Þar heldur þú utan um alla ferðina og sérð alltaf næsta skref." },
    { t: "Veldu pakka og greiðsluleið", d: "Greiddu sjálf(ur), fáðu endurgreiðslu frá stéttarfélagi eða notaðu kóða frá vinnuveitanda." },
    { t: "Blóðprufa og mælingar", d: `Blóðprufa á ${loc.blood_test_site || "Heilsugæslunni"} og mælingar hjá ${loc.measurement_site || "samstarfsaðila"}.` },
    { t: "Skýrsla og viðtal", d: "Læknir staðfestir skýrsluna og þú ferð yfir hana með hjúkrunarfræðingi." },
    { t: "Aðgerðaáætlun til 3 mánaða", d: "Svefn, hreyfing, næring og andleg líðan. Í símanum eða útprentuð." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#ecfdf5]">
      <section className="bg-gradient-to-br from-[#0F2A23] via-[#0B3B30] to-[#065F46] px-4 pb-16 pt-28 text-white sm:pt-32">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Heilsufarsskoðun · {loc.name}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Taktu fyrsta skrefið að betri heilsu</h1>
          <p className="mt-4 max-w-xl text-lg text-emerald-50/90">
            Stofnaðu frían aðgang og sjáðu valmöguleikana þína þaðan. Það kostar ekkert að byrja.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={signup} className="rounded-full bg-[#10B981] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-[#34D399]">
              Stofna frían aðgang
            </Link>
            <Link href={login} className="text-sm font-semibold text-emerald-100 hover:text-white">Ég á nú þegar aðgang →</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14">
        <h2 className="text-2xl font-bold text-[#0F172A]">Svona gengur þetta fyrir sig</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F172A] text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold text-[#0F172A]">{s.t}</p>
                <p className="mt-1 text-sm text-slate-600">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>

        {pkg && (
          <div className="mt-10 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xl font-bold text-[#0F172A]">{pkg.name}</h3>
              <p className="text-xl font-bold text-[#047857]">{Number(pkg.price_isk).toLocaleString("is-IS")} kr.</p>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {(Array.isArray(pkg.includes) ? pkg.includes : []).map((x: string) => (
                <li key={x} className="flex gap-2 text-sm text-slate-700"><span className="text-[#10B981]">✓</span>{x}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">Mörg stéttarfélög endurgreiða hluta kostnaðar. Þú sérð þína upphæð áður en þú greiðir.</p>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href={signup} className="inline-block rounded-full bg-[#10B981] px-7 py-3.5 font-semibold text-white shadow-lg shadow-green-500/25 hover:bg-[#047857]">
            Taka fyrsta skrefið
          </Link>
        </div>
      </section>
    </div>
  );
}
