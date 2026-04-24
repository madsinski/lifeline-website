"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  // Staff
  STAFF_NDA_KEY, STAFF_NDA_VERSION, renderStaffNDA,
  STAFF_CONFIDENTIALITY_KEY, STAFF_CONFIDENTIALITY_VERSION, renderStaffConfidentiality,
  STAFF_ACCEPTABLE_USE_KEY, STAFF_ACCEPTABLE_USE_VERSION, renderStaffAcceptableUse,
  STAFF_DATA_PROTECTION_KEY, STAFF_DATA_PROTECTION_VERSION, renderStaffDataProtectionBriefing,
  STAFF_CONTRACTOR_KEY, STAFF_CONTRACTOR_VERSION, renderStaffContractorAgreement,
} from "@/lib/staff-terms-content";
import {
  // Platform
  TOS_KEY, TOS_VERSION, renderTermsOfService,
  DPA_KEY, DPA_VERSION, renderDataProcessingAgreement,
  EMPLOYEE_TOS_KEY, EMPLOYEE_TOS_VERSION, renderEmployeeTermsOfService,
  HEALTH_CONSENT_KEY, HEALTH_CONSENT_VERSION, renderHealthAssessmentConsent,
} from "@/lib/platform-terms-content";

// Legal template library — static text viewer + .txt download for each
// document we have templates for. Use this page when sending the docs
// to a lawyer for language review. Admin-only at the route level via
// the admin layout gate.

type TemplateMeta = {
  key: string;
  version: string;
  title: string;
  category: "staff" | "platform";
  audience: string;
  render: () => string;
};

const TEMPLATES: TemplateMeta[] = [
  // Staff
  { key: STAFF_NDA_KEY, version: STAFF_NDA_VERSION, title: "Trúnaðarsamningur (NDA)", category: "staff", audience: "All staff", render: renderStaffNDA },
  { key: STAFF_CONFIDENTIALITY_KEY, version: STAFF_CONFIDENTIALITY_VERSION, title: "Þagnarskylda heilbrigðisstarfsmanns", category: "staff", audience: "Clinicians (doctor / nurse / psychologist)", render: renderStaffConfidentiality },
  { key: STAFF_ACCEPTABLE_USE_KEY, version: STAFF_ACCEPTABLE_USE_VERSION, title: "Tækjareglur og aðgangsstjórnun", category: "staff", audience: "All staff", render: renderStaffAcceptableUse },
  { key: STAFF_DATA_PROTECTION_KEY, version: STAFF_DATA_PROTECTION_VERSION, title: "Persónuverndarfræðsla", category: "staff", audience: "All staff", render: renderStaffDataProtectionBriefing },
  { key: STAFF_CONTRACTOR_KEY, version: STAFF_CONTRACTOR_VERSION, title: "Verktakasamningur (case-by-case)", category: "staff", audience: "Clinicians paid per-measurement", render: renderStaffContractorAgreement },
  // Platform
  { key: TOS_KEY, version: TOS_VERSION, title: "Notkunarskilmálar (B2B)", category: "platform", audience: "Company contact persons", render: renderTermsOfService },
  { key: DPA_KEY, version: DPA_VERSION, title: "Gagnavinnslusamningur (DPA)", category: "platform", audience: "Company contact persons", render: renderDataProcessingAgreement },
  { key: EMPLOYEE_TOS_KEY, version: EMPLOYEE_TOS_VERSION, title: "Notkunarskilmálar (starfsmenn)", category: "platform", audience: "Employees of B2B companies", render: renderEmployeeTermsOfService },
  { key: HEALTH_CONSENT_KEY, version: HEALTH_CONSENT_VERSION, title: "Upplýst samþykki fyrir heilsumat", category: "platform", audience: "End users (employees + B2C)", render: renderHealthAssessmentConsent },
];

export default function LegalTemplatesPage() {
  const [activeKey, setActiveKey] = useState<string>(TEMPLATES[0].key);
  const active = useMemo(() => TEMPLATES.find((t) => t.key === activeKey) || TEMPLATES[0], [activeKey]);
  const activeText = useMemo(() => active.render(), [active]);

  const download = (t: TemplateMeta) => {
    const header = `${t.title}\nLifeline Health ehf.\nÚtgáfa ${t.version}\nCategory: ${t.category} · Audience: ${t.audience}\n\n`;
    const blob = new Blob([header + t.render()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.key}-${t.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    const parts: string[] = [];
    for (const t of TEMPLATES) {
      parts.push("=".repeat(70));
      parts.push(`${t.title}`);
      parts.push(`Lifeline Health ehf. · Útgáfa ${t.version}`);
      parts.push(`Category: ${t.category} · Audience: ${t.audience}`);
      parts.push("=".repeat(70));
      parts.push("");
      parts.push(t.render());
      parts.push("");
      parts.push("");
    }
    const blob = new Blob([parts.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeline-legal-templates-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-gray-500 mb-0.5">
            <Link href="/admin/business" className="hover:underline">Business</Link> · Legal templates
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Legal document templates</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Every templated Icelandic legal document we ship today. Browse the full text, or export as <code>.txt</code> so your lawyer can edit the language. Any change to a template needs the version bumped so existing signatures remain tied to the exact text that was signed.
          </p>
        </div>
        <button
          onClick={downloadAll}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 text-white hover:opacity-95 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download all as one .txt
        </button>
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-4">
        {/* Left: template list */}
        <aside className="space-y-4">
          {(["staff", "platform"] as const).map((cat) => (
            <div key={cat}>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                {cat === "staff" ? "Staff onboarding" : "Platform acceptances"}
              </div>
              <div className="space-y-1.5">
                {TEMPLATES.filter((t) => t.category === cat).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveKey(t.key)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      activeKey === t.key
                        ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200"
                        : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900 leading-tight">{t.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 truncate" title={t.audience}>{t.audience}</div>
                    <div className="text-[10px] font-mono text-gray-400 mt-0.5">{t.key} · {t.version}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Right: active template text */}
        <section className="bg-white border border-gray-200 rounded-xl">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-base font-bold text-gray-900">{active.title}</div>
              <div className="text-[11px] text-gray-500 font-mono mt-0.5">{active.key} · {active.version} · {active.audience}</div>
            </div>
            <button
              onClick={() => download(active)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download .txt
            </button>
          </div>
          <textarea
            readOnly
            value={activeText}
            className="w-full h-[640px] px-5 py-4 border-0 rounded-b-xl text-[12.5px] leading-relaxed font-mono text-gray-800 bg-gray-50 resize-none focus:outline-none"
          />
        </section>
      </div>
    </div>
  );
}
