"use client";

// The icon for a sport, and the chips saying what it trains.
//
// Looked up by name from the preset catalogue so a sport looks the same
// wherever it appears — the week grid, the setup wizard, the add-a-day sheet
// and the "I did something else" sheet all draw from here.

import {
  Anchor, Bike, Cable, CircleDot, Dumbbell, Fish, Flag, Flame, Footprints, Goal, HeartPulse,
  Medal, Mountain, MountainSnow, Music, PersonStanding, Rabbit, Sailboat, Shovel, Snowflake,
  SportShoe, StretchHorizontal, Swords, Target, Timer, TreePine, Users, Volleyball, Waves,
  WavesLadder, Weight, Wind, Zap,
} from "lucide-react";
import { ACTIVITY_PRESETS, BENEFIT_IS, COVERS_IS, type Benefit, type Covers } from "@/lib/hc/adaptive-program";

const ICONS: Record<string, typeof Dumbbell> = {
  Anchor, Bike, Cable, CircleDot, Dumbbell, Fish, Flag, Flame, Footprints, Goal, HeartPulse,
  Medal, Mountain, MountainSnow, Music, PersonStanding, Rabbit, Sailboat, Shovel, Snowflake,
  SportShoe, StretchHorizontal, Swords, Target, Timer, TreePine, Users, Volleyball, Waves,
  WavesLadder, Weight, Wind, Zap,
};

const BY_NAME = new Map(ACTIVITY_PRESETS.map((p) => [p.name.toLowerCase(), p]));

/** The preset behind a name, when it came from the catalogue. */
export const presetFor = (name: string) => BY_NAME.get(name.trim().toLowerCase()) ?? null;

export default function ActivityIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const Icon = ICONS[presetFor(name)?.icon ?? ""] ?? Dumbbell;
  return <Icon className={className} aria-hidden />;
}

const COVER_CLS: Record<Covers, string> = {
  strength: "bg-orange-100 text-orange-900",
  hiit: "bg-rose-100 text-rose-900",
  cardio: "bg-sky-100 text-sky-900",
};

/**
 * What it trains, as chips. Half-credit is shown as half-credit — a sport
 * that contributes to the aerobic base without replacing it should not claim
 * the same badge as one that does.
 */
export function CoverChips({ covers, partial, benefits, className = "" }: {
  covers: Covers[];
  partial?: Covers[];
  benefits?: Benefit[];
  className?: string;
}) {
  const half = (partial ?? []).filter((c) => !covers.includes(c));
  if (covers.length === 0 && half.length === 0) {
    // It replaces nothing — so say what it IS for, which is not nothing.
    const b = benefits ?? [];
    return b.length
      ? (
        <span className={`flex flex-wrap gap-1 ${className}`}>
          {b.map((x) => (
            <span key={x} className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-violet-900">{BENEFIT_IS[x]}</span>
          ))}
        </span>
      )
      : <span className={`text-[11px] text-slate-500 ${className}`}>Kemur ekki í stað neins</span>;
  }
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {covers.map((c) => (
        <span key={c} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${COVER_CLS[c]}`}>{COVERS_IS[c]}</span>
      ))}
      {half.map((c) => (
        <span key={c} title="Telst sem hálf æfing — stuðlar að þessu án þess að koma í staðinn"
          className={`rounded-full border border-dashed px-1.5 py-0.5 text-[10px] font-semibold ${COVER_CLS[c]} border-current/40`}>
          ½ {COVERS_IS[c]}
        </span>
      ))}
    </span>
  );
}
