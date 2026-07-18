// Server-rendered viewer for every legal document Lifeline maintains,
// grouped by LOCATION (website / b2c / b2b / app / other) so it's clear
// where each document lives and what approval it needs.
//
// The document set + draft overlay now lives in @/lib/legal-doc-registry
// so this page and the no-login external-counsel link
// (/legal-review/[token]) render exactly the same content.
//
// Override path: an admin- or lawyer-pasted revision in
// legal_document_drafts is shown here instead of the source-code text.

import Link from "next/link";
import { getLegalDocGroups, LOCATION_ORDER, LOCATION_META, type DocLocation } from "@/lib/legal-doc-registry";
import DocCard from "./DocCard";
import LegalTabBar from "../LegalTabBar";
import ReviewLinkManager from "./ReviewLinkManager";
import { LOCATION_BADGE } from "./locationBadge";

// Force dynamic rendering — we hit the DB on every request to pick up
// the latest admin-pasted draft for each document.
export const dynamic = "force-dynamic";

function anchorFor(loc: DocLocation): string {
  return `loc-${loc}`;
}

export default async function LegalDraftsPage() {
  const groups = await getLegalDocGroups();

  return (
    <div className="space-y-8">
      <LegalTabBar />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Documents</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed">
            Every legal document Lifeline maintains, grouped by where it lives. Each card shows the{" "}
            <span className="font-medium">location</span> and the{" "}
            <span className="font-medium">approval required</span>. Send to counsel with Copy / Download,
            have them sign off in-app, or generate a no-login review link below. Signed click-through
            acceptances live under the{" "}
            <Link href="/admin/legal" className="underline underline-offset-2">Signed acceptances</Link> tab.
          </p>
        </div>
        <a
          href="https://github.com/madsinski/lifeline-website/blob/main/supabase/runbooks/sprint1-2-followup.md"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
        >
          Sign-off runbook ↗
        </a>
      </div>

      {/* No-login external-counsel links */}
      <ReviewLinkManager />

      {/* Location index */}
      <nav className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Jump to location</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {LOCATION_ORDER.filter((loc) => groups.some((g) => g.location === loc)).map((loc) => {
            const g = groups.find((gr) => gr.location === loc)!;
            return (
              <li key={loc}>
                <a href={`#${anchorFor(loc)}`} className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2">
                  {LOCATION_META[loc].title}
                </a>
                <span className="text-gray-400 ml-1.5">({g.docs.length})</span>
              </li>
            );
          })}
        </ul>
      </nav>

      {groups.map((group) => (
        <div key={group.location} id={anchorFor(group.location)} className="space-y-4 scroll-mt-4">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold mt-0.5 ${LOCATION_BADGE[group.location].className}`}>
              {LOCATION_BADGE[group.location].label}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[#1F2937]">{group.title}</h2>
              <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">{group.blurb}</p>
            </div>
          </div>
          {group.docs.map((d) => (
            <DocCard
              key={d.id}
              id={d.id}
              title={d.title}
              version={d.version}
              filenameBase={d.filenameBase}
              description={d.description}
              sourceLanguage={d.sourceLanguage}
              location={d.location}
              approval={d.approval}
              text={d.text}
              drafts={d.drafts}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
