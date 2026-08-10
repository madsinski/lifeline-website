"use client";

import Link from "next/link";

// Website CMS index — the editable marketing pages. Batch 1: the home page.
// About / coaching / assessment / contact are added here as their modules land.
export default function WebsiteCmsPage() {
  const pages = [
    {
      key: "home",
      label: "Forsíða",
      desc: "Hetja, hvernig það virkar, af hverju Lifeline, heilsumat, appið, teymið, samstarf, ákall.",
      path: "/",
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

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
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
      </div>
    </div>
  );
}
