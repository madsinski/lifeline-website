"use client";

// Public, read-only viewer for the Fjarlækningar × HSU print collateral
// (poster / referral guide / advert). Mirrors the admin studio's scaled A4
// preview + print path, minus any editing. Content is fetched server-side and
// passed in; this component only renders + prints.

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

// Client-only flag without a setState-in-effect (avoids hydration mismatch for
// the portalled print surface). Server → false, client → true.
const subscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
import { COLLATERAL_CSS } from "@/app/admin/presentations/collateral/collateral-css";
import {
  CollateralDoc,
  DOC_META,
  type DocId,
} from "@/app/admin/presentations/collateral/docs";
import type { CollateralContent } from "@/app/admin/presentations/collateral/content";

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

export default function CollateralViewer({
  content,
}: {
  content: CollateralContent;
}) {
  const [doc, setDoc] = useState<DocId>("poster");
  const mounted = useMounted();
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.5);

  const measure = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const avail = el.clientWidth - 32;
    setFit(Math.min(1, avail / A4_W));
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <div className="llcol min-h-screen bg-gray-100">
      <style dangerouslySetInnerHTML={{ __html: COLLATERAL_CSS + PRINT_CSS }} />

      {/* header */}
      <div className="mx-auto max-w-4xl px-4 pt-8 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/fjarlaekningar-logo.svg"
              alt="Fjarlækningar"
              className="h-7 w-auto"
            />
            <h1 className="mt-3 text-xl font-bold text-gray-900">
              Prentefni fyrir HSU
            </h1>
            <p className="text-sm text-gray-500">
              Veldu skjal, forskoðaðu og prentaðu eða vistaðu sem PDF (A4).
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Prenta / Vista sem PDF
          </button>
        </div>

        {/* document tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
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
              <div className="text-sm font-semibold text-gray-900">{content.docMeta[d.id].name}</div>
              <div className="text-xs text-gray-500">{content.docMeta[d.id].sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* preview */}
      <div className="mx-auto max-w-4xl px-4 pb-16">
        <p className="mb-2 text-xs text-gray-400">
          Í prentglugganum: veldu <b>A4</b>, spássíur <b>Engar</b> og kveiktu á{" "}
          <b>Bakgrunnsgrafík</b>.
        </p>
        <div ref={stageRef} className="flex justify-center rounded-xl bg-gray-200/60 p-4">
          <div
            style={{
              width: A4_W * fit,
              height: A4_H * fit,
              overflow: "hidden",
              ["--fit" as string]: String(fit),
            }}
          >
            <CollateralDoc doc={doc} content={content} />
          </div>
        </div>
      </div>

      {/* print surface (portalled to body; shown only in @media print) */}
      {mounted &&
        createPortal(
          <div className="llcol-print llcol">
            <CollateralDoc doc={doc} content={content} />
          </div>,
          document.body,
        )}
    </div>
  );
}
