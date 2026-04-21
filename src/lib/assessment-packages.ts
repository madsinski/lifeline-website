// Shared definitions for the three B2C assessment packages. Used by the
// /account/book flow and by the "Compare packages" dropdown on /account.

export type PackageKey = "foundational" | "checkin" | "self-checkin";

export interface PackageDef {
  key: PackageKey;
  name: string;
  tag: string;
  priceIsk: number;
  summary: string;
  includes: string[];
  accent: string;   // gradient classes used on headers
  tone: string;     // soft background classes for the card body
  dot: string;      // text color classes for bullet markers
}

export const PACKAGES: PackageDef[] = [
  {
    key: "foundational",
    name: "Foundational Health",
    tag: "Start here",
    priceIsk: 49_900,
    summary: "A full medical-grade baseline — measurements, targeted blood work, and a doctor-led action plan.",
    includes: [
      "On-site measurements (blood pressure, body composition)",
      "Targeted blood panel",
      "Full health questionnaire",
      "Doctor-reviewed personal report",
      "1:1 doctor consultation + action plan",
    ],
    accent: "from-[#3B82F6] to-[#10B981]",
    tone: "border-blue-100 bg-blue-50/40",
    dot: "text-[#3B82F6]",
  },
  {
    key: "checkin",
    name: "Check-in",
    tag: "Follow-up",
    priceIsk: 19_900,
    summary: "A lighter round 3–12 months after the foundational — track change, refresh the plan.",
    includes: [
      "On-site measurements",
      "Progress report vs baseline",
      "Updated health score",
      "Brief doctor review",
      "Refreshed action plan",
    ],
    accent: "from-[#10B981] to-[#14B8A6]",
    tone: "border-emerald-100 bg-emerald-50/40",
    dot: "text-[#10B981]",
  },
  {
    key: "self-checkin",
    name: "Self Check-in",
    tag: "Free",
    priceIsk: 0,
    summary: "A remote questionnaire pass — no visit, track your own progress between rounds.",
    includes: [
      "Online health questionnaire",
      "Self-reported metrics",
      "Updated health score",
      "Instant insight",
      "Lifeline reaches out if anything is flagged",
    ],
    accent: "from-[#8B5CF6] to-[#0EA5E9]",
    tone: "border-violet-100 bg-violet-50/40",
    dot: "text-[#8B5CF6]",
  },
];

export function formatPackagePrice(priceIsk: number): string {
  return priceIsk === 0 ? "Free" : `${priceIsk.toLocaleString("is-IS")} kr`;
}
