"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* eslint-disable @next/next/no-img-element -- printable document images; plain <img> keeps print/PDF + lightbox layout predictable. */

// An image that signals it can be enlarged (emerald zoom badge + an emerald
// line that grows across the bottom on hover) and opens a full-screen lightbox
// on click. All hover/lightbox chrome is no-print so the PDF is unaffected.
export default function ZoomableImage({ src, caption }: { src: string; caption?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <figure className="si-figure my-5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={caption ? `Stækka mynd: ${caption}` : "Stækka mynd"}
        className="group relative block w-full cursor-zoom-in appearance-none overflow-hidden rounded-lg border border-gray-200 bg-transparent p-0 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] print:shadow-none"
      >
        <img
          src={src}
          alt={caption || ""}
          className="block w-full transition-transform duration-300 group-hover:scale-[1.015]"
        />
        {/* Emerald zoom badge — fades in on hover / focus */}
        <span className="no-print pointer-events-none absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[#10B981] text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
          </svg>
        </span>
        {/* Emerald line grows across the bottom on hover */}
        <span className="no-print pointer-events-none absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-[#10B981] transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100" />
      </button>
      {caption && <figcaption className="mt-2 text-center text-xs text-[#64748B]">{caption}</figcaption>}

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={caption || "Mynd"}
          onClick={() => setOpen(false)}
          className="no-print fixed inset-0 z-[10060] grid cursor-zoom-out place-items-center gap-4 p-[4vmin] print:hidden"
          style={{ background: "rgba(3,16,12,0.92)" }}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Loka"
            className="absolute right-5 top-4 text-3xl leading-none text-white/70 hover:text-white"
          >×</button>
          <img
            src={src}
            alt={caption || ""}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86vh] max-w-[94vw] cursor-default rounded-lg object-contain shadow-2xl"
          />
          {caption && <div className="max-w-2xl text-center text-sm text-[#eafaf3]">{caption}</div>}
        </div>,
        document.body
      )}
    </figure>
  );
}
