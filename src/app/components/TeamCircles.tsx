"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";

export interface TeamMember {
  /** Portrait URL. When omitted, a gradient initials circle is shown. */
  photo?: string;
  /** Small uppercase label above the name (e.g. "Co-founder"). */
  flag?: string;
  name: string;
  role: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}

function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </svg>
  );
}

/** Full-size portrait on a dark scrim. Click anywhere or Escape to close. */
function PortraitLightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
      className="fixed inset-0 z-[10060] grid cursor-zoom-out place-items-center gap-5 p-[5vmin]"
      style={{ background: "rgba(3,16,12,0.93)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- lightbox portrait outside next/image layout */}
      <img
        src={src}
        alt={name}
        className="block max-h-[88vh] w-auto rounded-2xl object-contain shadow-2xl"
        style={{ maxWidth: "min(94vw, 720px)", background: "#0c100f" }}
      />
      <div className="text-center text-lg font-bold text-[#eafaf3]">{name}</div>
    </div>,
    document.body
  );
}

function MemberPortrait({ member }: { member: TeamMember }) {
  const [open, setOpen] = useState(false);
  const { photo, name } = member;

  if (!photo) {
    return (
      <div
        className="grid h-28 w-28 place-items-center rounded-full border-4 border-white text-2xl font-extrabold text-white shadow-lg sm:h-32 sm:w-32"
        style={{ background: "linear-gradient(135deg,#10B981,#047857)" }}
        aria-hidden
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge photo: ${name}`}
        className="group relative inline-block cursor-zoom-in rounded-full transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:ring-offset-2"
      >
        <span className="relative block h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow-lg transition-shadow group-hover:shadow-xl sm:h-32 sm:w-32">
          <Image src={photo} alt={name} fill sizes="140px" className="object-cover object-top" />
        </span>
        <span className="absolute bottom-0.5 right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#10B981] text-white shadow-md">
          <ZoomIcon className="h-3.5 w-3.5" />
        </span>
      </button>
      {open && <PortraitLightbox src={photo} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

export default function TeamCircles({ members }: { members: TeamMember[] }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mx-auto grid max-w-5xl grid-cols-2 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
        {members.map((m, i) => (
          <div key={m.name + i} className="flex flex-col items-center gap-2 text-center">
            <MemberPortrait member={m} />
            {m.flag && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#059669]">{m.flag}</span>
            )}
            <h3 className="text-sm font-bold leading-tight text-[#1F2937] sm:text-base">{m.name}</h3>
            <p className="max-w-[18ch] text-xs leading-snug text-[#6B7280] sm:text-sm">{m.role}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 flex items-center justify-center gap-1.5 text-sm font-medium text-[#6B7280]">
        <ZoomIcon className="h-4 w-4 text-[#10B981]" />
        {t("home.team.zoomHint", "Click a photo to enlarge")}
      </p>
    </div>
  );
}
