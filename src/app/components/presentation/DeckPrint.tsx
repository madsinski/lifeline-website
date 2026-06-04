"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Slide } from "@/lib/presentations/types";
import { DECK_CSS } from "./deck-css";
import { DeckDefs, SlideView } from "./SlideView";

function hasBg(s: Slide): boolean {
  return (s.type === "title" || s.type === "closing") && !!s.bg;
}

// PDF / print layout. Each slide is laid out as its own fixed 1280×720 page and
// rendered with the deck's `is-stage` mode (the single-slide preview variant,
// so every slide is visible at once rather than only the active one). The print
// stylesheet maps one page per physical sheet at 16:9 landscape and forces
// background graphics so gradients/photos survive "Save as PDF".
const PRINT_CSS = `
.ll-pdf{position:fixed;inset:0;z-index:10000;overflow:auto;background:#3b3f45;}
.ll-pdf-scroll{display:flex;flex-direction:column;align-items:center;gap:22px;padding:78px 22px 60px;}
.ll-pdf-page{width:1280px;height:720px;position:relative;overflow:hidden;background:#000;
  box-shadow:0 14px 50px -10px rgba(0,0,0,.6);}
.ll-pdf-page .lldeck{width:100%;height:100%;}
.ll-pdf-bar{position:fixed;top:0;left:0;right:0;z-index:10001;display:flex;align-items:center;gap:12px;
  padding:12px 18px;background:rgba(20,22,26,.96);color:#e7eef0;
  font-family:var(--font-inter),Inter,system-ui,sans-serif;}
.ll-pdf-bar .grow{flex:1 1 auto;font-size:.82rem;color:#aeb6bb;}
.ll-pdf-bar button{border:0;border-radius:8px;padding:.5rem .95rem;font-size:.85rem;font-weight:600;cursor:pointer;}
.ll-pdf-bar .primary{background:#10B981;color:#04241b;}
.ll-pdf-bar .primary:hover{background:#0ea372;}
.ll-pdf-bar .ghost{background:rgba(255,255,255,.1);color:#e7eef0;}
.ll-pdf-bar .ghost:hover{background:rgba(255,255,255,.18);}

@media print{
  html,body{margin:0!important;padding:0!important;background:#fff!important;}
  /* The print surface is portalled to <body>; hide every other body child
     (admin chrome, app shell) so only the slides print. */
  body > *:not(.ll-pdf){display:none!important;}
  .ll-pdf{display:block!important;position:static;background:#fff;overflow:visible;}
  .ll-pdf-bar{display:none!important;}
  .ll-pdf-scroll{display:block;padding:0;gap:0;}
  .ll-pdf-page{box-shadow:none;margin:0;break-after:page;page-break-after:always;}
  .ll-pdf-page:last-child{break-after:auto;page-break-after:auto;}
  .ll-pdf-page,.ll-pdf-page *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  @page{size:1280px 720px;margin:0;}
}
`;

function PrintStyle() {
  return <style dangerouslySetInnerHTML={{ __html: DECK_CSS + PRINT_CSS }} />;
}

/**
 * Full-screen print/PDF view. Renders every slide as a page and exposes a
 * "Save as PDF" button that opens the browser print dialog. Pass the slides
 * already resolved for the desired language.
 */
export function DeckPrint({ slides, design, onClose }: { slides: Slide[]; design?: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if ((e.key === "p" || e.key === "P") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); window.print(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="ll-pdf">
      <PrintStyle />
      {/* One shared symbol sheet for every page (ids are global). */}
      <DeckDefs />
      <div className="ll-pdf-bar">
        <strong style={{ fontSize: ".9rem" }}>Export PDF</strong>
        <span className="grow">Click “Save as PDF”, then in the print dialog set Margins → None and enable Background graphics. {slides.length} slides.</span>
        <button className="primary" onClick={() => window.print()}>Save as PDF</button>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <div className="ll-pdf-scroll">
        {slides.map((s) => (
          <div key={s.id} className="ll-pdf-page">
            <div className="lldeck is-stage" data-design={design || "lifeline"}>
              <section className={`slide ${s.theme}${hasBg(s) ? " has-bg" : ""} active`}>
                <SlideView slide={s} />
              </section>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
