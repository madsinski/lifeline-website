"use client";

// How to get the Grunnheilsa report out of the patient portal and into here.
//
// The report is made and signed in Medalia's sjúklingagátt; the app only
// ever gets a copy the person brings. Bringing it is four small things on a
// phone that most people have never done in that order — log in with
// rafræn skilríki, find the report, save the PDF somewhere a browser can
// reach, come back — so they are written out, per device.
//
// Drawn, not screenshotted, in the same spirit as InstallGuide: a sketch of
// the moment people get stuck (recognising the report and the save button)
// that stays true when the portal changes its colours, and says it is a
// sketch. The portal link is the location's own (portalFor), never a
// hand-typed address.

import { useState } from "react";
import { Download, ExternalLink, FileText, Share } from "lucide-react";
import Segmented from "./Segmented";

type Device = "phone" | "computer";

const STEPS: Record<Device, string[]> = {
  phone: [
    "Opnaðu sjúklingagáttina með hnappinum hér fyrir neðan.",
    "Skráðu þig inn með rafrænum skilríkjum í símanum.",
    "Finndu skýrsluna sem heitir „Grunnheilsa skýrsla“ og opnaðu hana.",
    "Ýttu á Deila-táknið (kassi með ör upp úr) eða niðurhal og veldu „Vista í Skrár“ (iPhone) eða „Hlaða niður“ (Android).",
    "Komdu aftur hingað, hakaðu við samþykkið og ýttu á „Velja PDF og hlaða upp“. Skýrslan er í „Skrár“ eða „Niðurhal“.",
  ],
  computer: [
    "Opnaðu sjúklingagáttina með hnappinum hér fyrir neðan.",
    "Skráðu þig inn með rafrænum skilríkjum. Þú staðfestir í símanum.",
    "Finndu skýrsluna sem heitir „Grunnheilsa skýrsla“ og opnaðu hana.",
    "Smelltu á niðurhal til að vista PDF-skjalið. Það fer í möppuna „Niðurhal“.",
    "Komdu aftur hingað, hakaðu við samþykkið, smelltu á „Velja PDF og hlaða upp“ og veldu skjalið í möppunni „Niðurhal“.",
  ],
};

function guess(): Device {
  if (typeof navigator === "undefined") return "phone";
  return /iPhone|iPad|iPod|Android/.test(navigator.userAgent) ? "phone" : "computer";
}

/** The portal's document list, with the report and the save button picked out. */
function Sketch({ device }: { device: Device }) {
  const phone = device === "phone";
  return (
    <figure className="m-0">
      <div className={`mx-auto overflow-hidden rounded-hc-card border border-hc-hairline bg-hc-sunken-2 p-3 ${phone ? "max-w-[15rem]" : ""}`}>
        <div className="mb-2 flex items-center gap-2 rounded-hc-element bg-hc-surface px-2.5 py-2 shadow-hc-card">
          <span className="truncate text-[11px] text-hc-ink-3">Sjúklingagátt</span>
          <span className="flex-1" />
          <span className="h-2 w-8 rounded-full bg-hc-sunken-2" aria-hidden />
        </div>
        <div className="rounded-hc-element bg-hc-surface p-1.5 shadow-hc-card">
          {["Tímabókanir", "Spurningalistar"].map((x) => (
            <div key={x} className="flex items-center justify-between px-2 py-1.5 text-[11px] text-hc-ink-3">
              <span>{x}</span><span aria-hidden>›</span>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-lg bg-hc-brand-surface px-2 py-2 ring-1 ring-hc-brand-dark/40">
            <FileText className="h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-hc-brand-text">Grunnheilsa skýrsla · PDF</span>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-hc-brand-dark text-white" aria-hidden>
              {phone ? <Share className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-1.5 text-center text-[11px] text-hc-ink-3">
        Einfölduð mynd. Gáttin getur litið örlítið öðruvísi út.
      </figcaption>
    </figure>
  );
}

export default function ReportHowto({ portalUrl }: { portalUrl: string }) {
  const [device, setDevice] = useState<Device>(guess);
  return (
    <div className="space-y-3">
      <Segmented<Device> label="Tækið þitt" size="sm" mode="tabs" panelId={(v) => `howto-${v}`}
        value={device} onChange={setDevice}
        options={[{ value: "phone", label: "Í síma" }, { value: "computer", label: "Í tölvu" }]} />
      <div id={`howto-${device}`} role="tabpanel" className="space-y-3">
        <Sketch device={device} />
        <ol className="space-y-2">
          {STEPS[device].map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-hc-ink">
              <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-hc-brand-surface text-xs font-bold text-hc-brand-text">{i + 1}</span>
              <span className="min-w-0">{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <a href={portalUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hc-control bg-hc-surface px-4 text-sm font-semibold text-hc-ink-2 hover:bg-hc-sunken">
        Opna sjúklingagáttina <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
}
