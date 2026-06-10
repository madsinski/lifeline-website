"use client";

import { useState } from "react";

// Language-switchable viewer for the posture statement. Copy /
// download / print always act on the currently selected language.
export default function PostureDocument({
  textIS,
  textEN,
  version,
}: {
  textIS: string;
  textEN: string;
  version: string;
}) {
  const [lang, setLang] = useState<"is" | "en">("is");
  const [copied, setCopied] = useState(false);

  const text = lang === "is" ? textIS : textEN;
  const dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(text);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {(["is", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={
                "px-3 py-1.5 text-xs font-semibold transition-colors " +
                (lang === l
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50")
              }
            >
              {l === "is" ? "Íslenska" : "English"}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gray-400">
          {lang === "en"
            ? "Convenience translation — the Icelandic version prevails."
            : "Lagalega gildandi útgáfa."}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? "Copied ✓" : "Copy text"}
          </button>
          <a
            href={dataUrl}
            download={`lifeline-security-posture-${version}-${lang}.txt`}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Download .txt
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <section
        id="posture-print-area"
        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <pre className="px-6 py-5 text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50/40 max-h-[80vh] overflow-y-auto">
          {text}
        </pre>
      </section>

      {/* Print = only the document, full height, no admin chrome */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #posture-print-area, #posture-print-area * { visibility: visible; }
          #posture-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
            border-radius: 0;
          }
          #posture-print-area pre {
            max-height: none !important;
            overflow: visible !important;
            background: white !important;
            font-size: 9.5px;
            line-height: 1.55;
          }
        }
      `}</style>
    </div>
  );
}
