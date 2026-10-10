"use client";

// How to put Lifeline on your home screen or desktop, and why it matters.
//
// Notifications are the reason this exists. On iPhone, iOS allows web push
// only for an installed app — Safari will not even offer the permission
// otherwise. On Android and desktop Chrome push works in the tab, but an
// installed window still gets notifications when the browser is closed,
// which is the difference between a reminder and a reminder you saw.
//
// The steps differ per browser and there is no reliable way to detect the
// browser for certain, so the right one is guessed, shown first, and the
// others stay one tap away rather than being hidden behind a guess.

import { useState } from "react";
import { ChevronDown, Share, MonitorDown, MoreVertical, Check } from "lucide-react";

type Platform = "ios" | "android" | "desktop";

const STEPS: Record<Platform, { label: string; Icon: typeof Share; steps: string[]; note?: string }> = {
  ios: {
    label: "iPhone eða iPad",
    Icon: Share,
    steps: [
      "Opnaðu lifelinehealth.is í Safari (ekki Chrome — á iPhone er það Safari sem setur upp appið).",
      "Ýttu á Deila-táknið í tækjastikunni (kassi með ör upp úr).",
      "Skrunaðu niður og veldu „Bæta á heimaskjá“.",
      "Ýttu á „Bæta við“ og opnaðu Lifeline af heimaskjánum.",
      "Farðu í Stillingar → Áminningar og veldu „Tilkynning í símanum“.",
    ],
    note: "Á iPhone leyfir Apple tilkynningar aðeins í uppsettu appi. Safari spyr ekki um leyfi fyrr en þú opnar Lifeline af heimaskjánum.",
  },
  android: {
    label: "Android",
    Icon: MoreVertical,
    steps: [
      "Opnaðu lifelinehealth.is í Chrome.",
      "Ýttu á þrjá punkta uppi í hægra horninu.",
      "Veldu „Setja upp app“ eða „Bæta á heimaskjá“.",
      "Opnaðu Lifeline af heimaskjánum.",
      "Farðu í Stillingar → Áminningar og veldu „Tilkynning í símanum“.",
    ],
  },
  desktop: {
    label: "Tölva (Chrome eða Edge)",
    Icon: MonitorDown,
    steps: [
      "Ýttu á uppsetningartáknið hægra megin í veffangastikunni — skjár með ör niður.",
      "Sést það ekki? Þrír punktar → „Varpa, vista og deila“ → „Setja upp síðu sem app“.",
      "Veldu „Setja upp“. Lifeline opnast í sínum eigin glugga.",
      "Farðu í Stillingar → Áminningar og veldu „Tilkynning í símanum“.",
    ],
    note: "Uppsett app fær tilkynningar þótt vafrinn sé lokaður.",
  },
};

/** Best guess from the user agent, with the others a tap away. */
function guess(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export default function InstallGuide() {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Platform>(guess);
  const installed = typeof window !== "undefined"
    && (window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true);

  const cur = STEPS[pick];

  return (
    <section className="rounded-hc-card bg-hc-surface shadow-hc-card ring-1 ring-slate-200 print:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${installed ? "bg-hc-brand-surface text-hc-brand-dark" : "bg-slate-100 text-slate-500"}`}>
          {installed ? <Check className="h-5 w-5" aria-hidden /> : <MonitorDown className="h-5 w-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-hc-ink">Lifeline sem app</span>
          <span className="block text-sm text-slate-500">
            {installed
              ? "Uppsett á þessu tæki — tilkynningar virka."
              : "Settu Lifeline á heimaskjáinn til að fá tilkynningar"}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 p-4">
          {installed && (
            <p className="rounded-hc-element bg-hc-brand-surface px-3 py-2 text-sm font-medium text-hc-brand-dark">
              Þetta tæki er þegar með Lifeline uppsett. Leiðbeiningarnar hér fyrir neðan eru fyrir næsta tæki.
            </p>
          )}

          {/* The guess is only a guess, so all three are selectable. */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STEPS) as Platform[]).map((k) => (
              <button key={k} type="button" onClick={() => setPick(k)} aria-pressed={pick === k}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                  pick === k ? "bg-hc-ink text-white ring-hc-ink" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>
                {STEPS[k].label}
              </button>
            ))}
          </div>

          <ol className="space-y-2">
            {cur.steps.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-hc-ink">
                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                  {i + 1}
                </span>
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ol>

          {cur.note && (
            <p className="rounded-hc-element bg-amber-50 px-3 py-2 text-xs text-amber-900">{cur.note}</p>
          )}
        </div>
      )}
    </section>
  );
}
