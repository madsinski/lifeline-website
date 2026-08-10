"use client";

import Link from "next/link";
import NavbarEditor from "./NavbarEditor";
import SiteGateToggle from "./SiteGateToggle";

// Website CMS index — the editable marketing pages + the top-navbar manager.
export default function WebsiteCmsPage() {
  const pages = [
    {
      key: "home",
      label: "Forsíða",
      desc: "Hetja, hvernig það virkar, af hverju Lifeline, heilsumat, appið, teymið, samstarf, ákall.",
      path: "/",
    },
    {
      key: "coaching",
      label: "Þjálfun (Coaching)",
      desc: "Hetja, af hverju þjálfun, fjórar stoðir, dæmigerður dagur, áskriftir, samanburður, sækja appið.",
      path: "/coaching",
    },
    {
      key: "assessment",
      label: "Heilsumat (Assessment)",
      desc: "Hetja, ferlið, niðurstöður, framvinda, pakkar, prófunarstaðir, algengar spurningar.",
      path: "/assessment",
    },
    {
      key: "business",
      label: "Fyrirtæki (Companies)",
      desc: "Hetja, af hverju, hvernig, aðferðin, pakkar, virði, fyrirspurn, algengar spurningar.",
      path: "/business",
    },
    {
      key: "contact",
      label: "Hafa samband (Contact)",
      desc: "Hetja, skilaboðaform, samskiptaupplýsingar, viðskiptavinaspjald.",
      path: "/contact",
    },
  ];

  return (
    <div className="p-8 max-w-4xl">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[#047857] mb-1">Stjórnborð</div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vefsíða</h1>
          <p className="text-sm text-gray-600 mt-1 mb-6 max-w-2xl">
            Breyttu texta, röð kafla og þýðingum (íslenska/enska) á vefsíðunni. Forskoðaðu og birtu — breytingar fara
            ekki í loftið fyrr en þú ýtir á „Birta“.
          </p>
        </div>
        <a
          href="/?preview=lifelinepreview2026"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 rounded-md bg-[#10B981] px-4 py-2 text-sm font-medium text-white hover:bg-[#047857]"
        >
          Skoða vefinn
        </a>
      </div>

      {/* Master coming-soon switch */}
      <SiteGateToggle />

      {/* Pages */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Síður</h2>
      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 mb-8">
        {pages.map((p) => (
          <Link key={p.key} href={`/admin/website/${p.key}`} className="flex items-center gap-3 p-4 hover:bg-gray-50">
            <svg className="w-5 h-5 text-[#10B981] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <div className="min-w-0">
              <div className="font-medium text-gray-900">{p.label}</div>
              <div className="text-xs text-gray-500 truncate">{p.desc}</div>
            </div>
            <code className="ml-auto shrink-0 text-[11px] text-gray-400">{p.path}</code>
          </Link>
        ))}
        {/* What's new — the home-page carousel, managed as its own surface */}
        <Link href="/admin/website/whats-new" className="flex items-center gap-3 p-4 hover:bg-gray-50">
          <svg className="w-5 h-5 text-[#10B981] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
          <div className="min-w-0">
            <div className="font-medium text-gray-900">Það nýjasta („What&apos;s new“)</div>
            <div className="text-xs text-gray-500 truncate">Spjöldin efst á forsíðunni — bæta við, breyta, fela og raða.</div>
          </div>
          <code className="ml-auto shrink-0 text-[11px] text-gray-400">forsíða</code>
        </Link>
      </div>

      {/* Top navbar manager */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Efsta valmynd</h2>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-600 mb-4">
          Raðaðu hlekkjunum í efstu valmyndinni og feldu þá sem eiga ekki að birtast. Á við bæði tölvu- og
          farsímaútgáfuna.
        </p>
        <NavbarEditor />
      </div>
    </div>
  );
}
