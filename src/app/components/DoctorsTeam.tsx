"use client";

// Healthcare-team grid. Replaces the previous AI-generated team photo
// everywhere it was used (/account/welcome, /business/onboard/[token],
// /business/[companyId]/welcome) and is the body of slide 7 in the
// onboarding slideshow.
//
// Photos: drop files at /public/team/{slug}.jpg (or .webp) and they
// show automatically. Until you upload real headshots the cards
// render initials-avatars on a gradient — no "missing image" placeholder
// state, so the page still looks finished while you record/edit photos.

import Image from "next/image";
import { useState } from "react";

export interface Doctor {
  slug: string;        // matches /public/team/{slug}.jpg
  name: string;
  fullTitle: string;   // "Læknir og forstjóri", "Læknir og fagstjóri", etc.
  bio?: string;        // 1-line, optional
  accent: "emerald" | "blue" | "violet" | "amber";
}

// Edit names + titles + bios here. Photos live at /public/team/{slug}.png.
export const LIFELINE_DOCTORS: Doctor[] = [
  {
    slug: "victor",
    name: "Victor Guðmundsson",
    fullTitle: "Læknir, Stofnandi",
    accent: "blue",
  },
  {
    slug: "mads",
    name: "Mads Christian Aanesen",
    fullTitle: "Læknir, Stofnandi",
    accent: "emerald",
  },
  {
    slug: "vignir",
    name: "Vignir Sigurðsson",
    fullTitle: "Sérfræðilæknir, Ráðgjafi, Stofnandi",
    accent: "violet",
  },
  {
    slug: "dagbjort",
    name: "Dagbjört Guðbrandsdóttir",
    fullTitle: "Læknir",
    accent: "amber",
  },
];

const ACCENT_GRADIENT: Record<Doctor["accent"], string> = {
  emerald: "from-emerald-400 to-emerald-600",
  blue: "from-blue-400 to-blue-600",
  violet: "from-violet-400 to-violet-600",
  amber: "from-amber-400 to-amber-600",
};

interface Props {
  /** Show one card per row on mobile (default: 2). */
  layout?: "grid" | "row";
  /** Hide bios — useful in tight slide layouts. */
  compact?: boolean;
}

export default function DoctorsTeam({ layout = "grid", compact = false }: Props) {
  const gridClass = layout === "row"
    ? "grid grid-cols-2 sm:grid-cols-4 gap-4"
    : "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4";

  return (
    <div className={gridClass}>
      {LIFELINE_DOCTORS.map((d) => (
        <DoctorCard key={d.slug} doctor={d} compact={compact} />
      ))}
    </div>
  );
}

function DoctorCard({ doctor, compact }: { doctor: Doctor; compact: boolean }) {
  const [imgError, setImgError] = useState(false);
  const initials = doctor.name.slice(0, 1).toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="relative aspect-square w-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        {!imgError ? (
          <Image
            src={`/team/${doctor.slug}.png`}
            alt={`${doctor.name}, ${doctor.fullTitle}`}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover object-top"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${ACCENT_GRADIENT[doctor.accent]} flex items-center justify-center`}>
            <span className="text-white font-bold text-5xl select-none">{initials}</span>
          </div>
        )}
      </div>
      <div className={`p-4 ${compact ? "pb-3" : ""}`}>
        <p className="text-base font-semibold text-[#1F2937] leading-tight">{doctor.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{doctor.fullTitle}</p>
        {!compact && doctor.bio && (
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{doctor.bio}</p>
        )}
      </div>
    </div>
  );
}
