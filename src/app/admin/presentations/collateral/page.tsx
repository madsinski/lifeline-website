"use client";

// Fjarlækningar print collateral studio — part of the presentations module.
// Renders three A4 print documents (reception poster, internal referral guide,
// newspaper advert) for the HSU pilot, with a scaled on-screen preview and a
// "Save as PDF" path that prints at true A4. Follows the deck's DeckPrint
// pattern: the print surface is portalled to <body> and the admin chrome is
// hidden in @media print so only the sheet prints.

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { COLLATERAL_CSS } from "./collateral-css";
import { CollateralDoc, DOC_META, type DocId } from "./docs";

// A4 portrait at 96dpi — the un-scaled pixel size of a `.a4` page.
const A4_W = 793.7;
const A4_H = 1122.5;

const PRINT_CSS = `
.llcol-print{position:fixed;left:-99999px;top:0;}
@media print{
  html,body{margin:0!important;padding:0!important;background:#fff!important;}
  body > *:not(.llcol-print){display:none!important;}
  .llcol-print{position:static!important;left:0!important;}
  .llcol-print .a4{transform:none!important;box-shadow:none!important;margin:0!important;
    break-after:page;page-break-after:always;}
  .llcol-print .a4:last-child{break-after:auto;page-break-after:auto;}
  .llcol-print .a4,.llcol-print .a4 *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  @page{size:A4;margin:0;}
}
`;

export default function CollateralStudio() {
  const [doc, setDoc] = useState<DocId>("poster");
  const [fit, setFit] = useState(0.6);
  const stageRef = useRef<HTMLDivElement>(null);

  // SSR-safe "on client" flag — false during SSR/hydration, true after, without
  // a setState-in-effect. Gates the portal (needs document.body).
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const measure = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const avail = el.clientWidth - 32; // padding
    setFit(Math.min(1, Math.max(0.2, avail / A4_W)));
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="llcol mx-auto max-w-6xl px-4 py-6">
      <style dangerouslySetInnerHTML={{ __html: COLLATERAL_CSS + PRINT_CSS }} />

      {/* header + controls */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Link href="/admin/presentations" className="hover:text-emerald-700">← Presentations</Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Fjarlækningar — prentefni fyrir HSU</h1>
          <p className="text-sm text-gray-500">Veggspjald, tilvísunarleiðbeiningar og blaðaauglýsing. A4 — vistast sem PDF.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Vista sem PDF
        </button>
      </div>

      {/* document tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {DOC_META.map((d) => (
          <button
            key={d.id}
            onClick={() => setDoc(d.id)}
            className={`rounded-lg border px-4 py-2 text-left transition ${
              doc === d.id
                ? "border-emerald-500 bg-emerald-50/60"
                : "border-gray-200 bg-white hover:border-emerald-300"
            }`}
          >
            <div className="text-sm font-semibold text-gray-900">{d.name}</div>
            <div className="text-xs text-gray-500">{d.sub}</div>
          </button>
        ))}
      </div>

      <p className="mb-3 text-xs text-gray-400">
        Í prentglugganum: veldu <b>A4</b>, spássíur <b>Engar</b> og kveiktu á <b>Bakgrunnsgrafík</b> til að fá litina rétta.
      </p>

      {/* scaled preview */}
      <div ref={stageRef} className="flex justify-center rounded-xl bg-gray-100 p-4">
        <div style={{ width: A4_W * fit, height: A4_H * fit, overflow: "hidden", ["--fit" as string]: String(fit) }}>
          <CollateralDoc doc={doc} />
        </div>
      </div>

      {/* print surface (portalled to body; hidden off-screen, shown in @media print) */}
      {mounted && createPortal(
        <div className="llcol-print llcol">
          <CollateralDoc doc={doc} />
        </div>,
        document.body,
      )}
    </div>
  );
}
