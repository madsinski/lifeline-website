"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import StaticPhone from "./StaticPhone";
import StaticLaptop from "./StaticLaptop";

// One mockup slot rendering either a phone or a laptop frame (chosen in the
// website CMS). The screen is clickable to enlarge the screenshot in a
// lightbox — with a visible hint so it's clear it can be clicked.
export default function DeviceMockup({
  device,
  screenshot,
  alt = "Lifeline Health app",
  phoneHeight = "70vh",
  laptopMaxWidth = "560px",
}: {
  device?: string;
  screenshot: string;
  alt?: string;
  phoneHeight?: string;
  laptopMaxWidth?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const inner = device === "laptop"
    ? <StaticLaptop screenshot={screenshot} alt={alt} maxWidth={laptopMaxWidth} />
    : <StaticPhone screenshot={screenshot} alt={alt} phoneHeight={phoneHeight} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt} — stækka`}
        className="group relative block w-full cursor-zoom-in appearance-none border-0 bg-transparent p-0 text-left"
      >
        {inner}
        {/* Hover overlay hint */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 8v6m-3-3h6m5-1a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
          Smelltu til að stækka
        </span>
        {/* Persistent corner affordance so it's clear even without hovering */}
        <span className="pointer-events-none absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#1F2937] shadow-md ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-110">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6m0 0v6m0-6L14 10M9 21H3m0 0v-6m0 6l7-7" /></svg>
        </span>
      </button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[10060] grid cursor-zoom-out place-items-center p-[5vmin]"
          style={{ background: "rgba(3,16,12,0.92)" }}
        >
          <button
            type="button"
            aria-label="Loka"
            onClick={() => setOpen(false)}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white/90 hover:bg-white/20"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- lightbox screenshot outside next/image layout */}
          <img
            src={screenshot}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="block max-h-[90vh] w-auto max-w-[min(95vw,1100px)] cursor-default rounded-2xl object-contain shadow-2xl"
          />
        </div>,
        document.body,
      )}
    </>
  );
}
