"use client";

// Per-document card with EN / IS language toggle. Most legal docs were
// drafted in Icelandic (the regulator + counsel both work in IS); a
// few — public Privacy / Terms — were drafted in English. Counsel
// asked for both versions to be one click apart.
//
// Translations that don't exist yet are shown as a clear placeholder
// pointing the lawyer back at the source-language version, so we
// never silently fall back and risk somebody signing off on the wrong
// text. Adding an IS or EN translation is a one-line change in
// drafts/page.tsx — just supply the second string.

import { useState } from "react";
import CopyButton from "./CopyButton";
import DocReviewPanel from "./DocReviewPanel";

export type DocLanguage = "is" | "en";

export interface DocCardProps {
  id: string;
  title: string;
  version: string;
  filenameBase: string;            // "privacy-policy-v1.4" — language suffix added at download time
  description: string;
  sourceLanguage: DocLanguage;     // language the doc was originally drafted in
  text: { is: string | null; en: string | null };
}

const LANG_LABEL: Record<DocLanguage, string> = { is: "Íslenska", en: "English" };

export default function DocCard(p: DocCardProps) {
  const [lang, setLang] = useState<DocLanguage>(p.sourceLanguage);

  const sourceText = p.text[lang];
  const otherLang: DocLanguage = lang === "is" ? "en" : "is";
  const hasTranslation = sourceText !== null;

  // Stable string for review / copy / download — the placeholder is also
  // text but we mark it so reviewers can't accidentally sign off on a
  // missing translation.
  const placeholder = `[${lang === "en" ? "English" : "Icelandic"} translation not yet drafted]
This document is currently maintained in ${LANG_LABEL[p.sourceLanguage]} only. Toggle to ${LANG_LABEL[p.sourceLanguage]} above to read the source version, or request a translation from the editor of src/lib/*-content.ts.`;

  const displayText = hasTranslation ? (sourceText as string) : placeholder;
  const dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(displayText);
  const downloadName = `${p.filenameBase}-${lang}.txt`;

  return (
    <section id={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <header className="border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-[#1F2937]">
            {p.title} <span className="text-xs font-normal text-gray-400 ml-1">{p.version}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">{p.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Language toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            {(["is", "en"] as DocLanguage[]).map((l) => {
              const active = l === lang;
              const missing = p.text[l] === null;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 transition-colors ${
                    active
                      ? "bg-[#1F2937] text-white"
                      : missing
                      ? "bg-white text-gray-400 hover:text-gray-600"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title={missing ? `${LANG_LABEL[l]} translation pending` : LANG_LABEL[l]}
                >
                  {LANG_LABEL[l]}
                  {missing && <span className="ml-1 text-[10px] align-top">·</span>}
                </button>
              );
            })}
          </div>
          <CopyButton text={displayText} />
          <a
            href={dataUrl}
            download={downloadName}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Download .txt
          </a>
        </div>
      </header>

      {!hasTranslation && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
          {LANG_LABEL[lang]} translation has not been drafted yet. Read the {LANG_LABEL[otherLang]} source above by switching language.
        </div>
      )}

      <pre className="px-5 py-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50/30 max-h-[420px] overflow-y-auto">
        {displayText}
      </pre>

      {/* Review panel always points at the SOURCE-language version so
          counsel can't accidentally sign off on a placeholder. */}
      <DocReviewPanel
        documentKey={p.id}
        documentVersion={p.version}
        documentTitle={p.title}
        documentText={(p.text[p.sourceLanguage] as string) ?? displayText}
      />
    </section>
  );
}
