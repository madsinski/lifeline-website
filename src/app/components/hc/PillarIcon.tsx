// The four pillars' icons: colour alone does not tell svefn from andleg líðan
// for everyone, so every pillar mark carries a shape too. One set for the
// participant's plan, the workstation and print.

import { Brain, Footprints, Leaf, Moon, type LucideIcon } from "lucide-react";
import { PILLAR_META, type Pillar } from "@/lib/hc/types";

export const PILLAR_ICON: Record<Pillar, LucideIcon> = {
  sleep: Moon,
  exercise: Footprints,
  nutrition: Leaf,
  mental: Brain,
};

/** The pillar's icon in its colour, on its soft background (a small tile). */
export default function PillarIcon({ pillar, size = "md" }: { pillar: Pillar; size?: "sm" | "md" | "lg" }) {
  const m = PILLAR_META[pillar];
  const Icon = PILLAR_ICON[pillar];
  const box = size === "sm" ? "h-6 w-6 rounded-md" : size === "lg" ? "h-10 w-10 rounded-xl" : "h-8 w-8 rounded-lg";
  const icon = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box}`} style={{ background: m.soft, color: m.color }} aria-hidden>
      <Icon className={icon} strokeWidth={2.2} />
    </span>
  );
}

/** Pill with icon + label, for cards and headers. */
export function PillarBadge({ pillar }: { pillar: Pillar }) {
  const m = PILLAR_META[pillar];
  const Icon = PILLAR_ICON[pillar];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: m.soft, color: m.ink }}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />{m.label}
    </span>
  );
}
