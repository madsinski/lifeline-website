// Security & Privacy Posture page — full audit-ready statement.
// Same content the lawyer reviews via /admin/legal/drafts (the
// "Audit-ready security & privacy posture" doc) but here it's
// shown standalone for quick admin reference + sending to auditors
// or B2B procurement teams.

import Link from "next/link";
import {
  SECURITY_POSTURE_VERSION,
  SECURITY_POSTURE_LAST_UPDATED,
  renderSecurityPosture,
} from "@/lib/security-posture";
import LegalTabBar from "../LegalTabBar";
import CopyButton from "../drafts/CopyButton";

export default function SecurityPosturePage() {
  const text = renderSecurityPosture();
  const dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(text);

  return (
    <div className="space-y-5">
      <LegalTabBar />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Security &amp; Privacy Posture</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed">
            Comprehensive snapshot of every technical and organisational measure
            Lifeline has in place for personal data protection. Send this to
            Persónuvernd auditors, insurance underwriters, and B2B procurement
            teams. Maintained in <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">src/lib/security-posture.ts</code> —
            version + timestamp bumped automatically when content changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={text} />
          <a
            href={dataUrl}
            download={`lifeline-security-posture-${SECURITY_POSTURE_VERSION}.txt`}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Download .txt
          </a>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold tracking-wide text-gray-500">Version</span>
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
            {SECURITY_POSTURE_VERSION}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold tracking-wide text-gray-500">Last updated</span>
          <span className="text-xs font-medium text-gray-700">
            {new Date(SECURITY_POSTURE_LAST_UPDATED).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="ml-auto">
          <Link
            href="/admin/legal/drafts#security-posture"
            className="text-xs text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
          >
            View in Documents tab (with lawyer signoff) →
          </Link>
        </div>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <pre className="px-6 py-5 text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50/40 max-h-[80vh] overflow-y-auto">
          {text}
        </pre>
      </section>
    </div>
  );
}
