// Client-safe location metadata (colour chips). Kept separate from
// @/lib/legal-doc-registry, which is server-only (imports supabase-admin).
// The DocLocation *type* is imported from the registry — types are erased
// at compile time, so that import is safe in client components.

import type { DocLocation } from "@/lib/legal-doc-registry";

export type { DocLocation };

export const LOCATION_BADGE: Record<DocLocation, { label: string; className: string }> = {
  website: { label: "Website", className: "bg-sky-100 text-sky-800" },
  b2c: { label: "B2C", className: "bg-emerald-100 text-emerald-800" },
  b2b: { label: "B2B", className: "bg-indigo-100 text-indigo-800" },
  app: { label: "App", className: "bg-violet-100 text-violet-800" },
  other: { label: "Other", className: "bg-gray-200 text-gray-700" },
};
