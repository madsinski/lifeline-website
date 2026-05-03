// Server-rendered viewer for the three Sprint 1+2 legal drafts.
// Pulls live text from src/lib/processor-agreements so the page stays
// in sync with the source. Each draft has copy + download buttons.

import Link from "next/link";
import {
  renderMedaliaJointControllerArrangement,
  MEDALIA_JOINT_CONTROLLER_VERSION,
  renderBiodyDPA,
  BIODY_DPA_VERSION,
  renderDPIAInterim,
  DPIA_INTERIM_VERSION,
} from "@/lib/processor-agreements";
import CopyButton from "./CopyButton";

interface DraftSection {
  id: string;
  title: string;
  version: string;
  filename: string;
  description: string;
  text: string;
}

export default function LegalDraftsPage() {
  const drafts: DraftSection[] = [
    {
      id: "medalia-joint-controller",
      title: "Medalia joint-controller arrangement",
      version: MEDALIA_JOINT_CONTROLLER_VERSION,
      filename: `medalia-joint-controller-${MEDALIA_JOINT_CONTROLLER_VERSION}.txt`,
      description:
        "GDPR Art. 26 joint-controller arrangement between Lifeline and Medalia for sjúkraskrá-grade health record data. Signed jointly with Medalia.",
      text: renderMedaliaJointControllerArrangement(),
    },
    {
      id: "biody-dpa",
      title: "Biody Manager DPA",
      version: BIODY_DPA_VERSION,
      filename: `biody-dpa-${BIODY_DPA_VERSION}.txt`,
      description:
        "GDPR Art. 28 data processing agreement with Aminogram SAS (Biody Manager) for body composition measurement processing.",
      text: renderBiodyDPA(),
    },
    {
      id: "dpia-interim",
      title: "DPIA — wellness-mode interim",
      version: DPIA_INTERIM_VERSION,
      filename: `dpia-interim-${DPIA_INTERIM_VERSION}.txt`,
      description:
        "Data Protection Impact Assessment under GDPR Art. 35 / Lög 90/2018 §29. Signed by the persónuverndarfulltrúi (DPO).",
      text: renderDPIAInterim(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Legal drafts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Read on this page or download a copy to send to counsel for review.
            Once signed and uploaded as a PDF, store the executed copy under{" "}
            <Link href="/admin/legal" className="underline underline-offset-2">Legal &amp; agreements</Link>.
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

      {drafts.map((d) => {
        const dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(d.text);
        return (
          <section key={d.id} id={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <header className="border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-[#1F2937]">
                  {d.title} <span className="text-xs font-normal text-gray-400">{d.version}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">{d.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={d.text} />
                <a
                  href={dataUrl}
                  download={d.filename}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Download .txt
                </a>
              </div>
            </header>
            <pre className="px-5 py-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50/30 max-h-[500px] overflow-y-auto">
              {d.text}
            </pre>
          </section>
        );
      })}
    </div>
  );
}
