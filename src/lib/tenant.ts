// ============================================================================
// Multi-tenant by hostname.
//
// The same Next.js app is served on both the Lifeline hosts
// (www.lifelinehealth.is) and a Fjarlækningar host (*.fjarlaekningar.is).
// Fjarlækningar is a sibling company that reuses the admin tooling under its
// own brand, restricted to a subset of modules.
//
// IMPORTANT: this scopes NAV + ROUTES + BRANDING by host only. It is NOT data
// isolation — the allowed modules read the same Supabase tables, so a
// Fjarlækningar admin sees the same rows as Lifeline. True per-company data
// separation (a company_id column + RLS + filtered queries) is a separate,
// larger project.
// ============================================================================

export type TenantId = "lifeline" | "fjarlaekningar";

export interface Tenant {
  id: TenantId;
  name: string;
  /** Brand accent (hex). Lifeline emerald / Fjarlækningar electric cyan. */
  accent: string;
  /** Top-level /admin sidebar hrefs to show. `null` = show all (Lifeline). */
  adminNav: string[] | null;
  /** All /admin route prefixes reachable by URL on this tenant. `null` = all. */
  adminRoutes: string[] | null;
  /** Where to send an admin who lands on a disallowed module route. */
  adminHome: string;
}

// Sidebar modules exposed to Fjarlækningar. Settings surfaces the Team and
// Translations tabs; the Team page links out to Signatures and the staff
// proposal (job-description) tooling.
const FJAR_NAV = [
  "/admin/presentations",
  "/admin/research",
  "/admin/legal",
  "/admin/releases",
  "/admin/surveys",
  "/admin/errors",
  "/admin/settings",
];

// Everything reachable by URL: the nav modules plus the sub-routes those
// modules link to, plus system routes (MFA gate) that must never be blocked.
const FJAR_ROUTES = [
  ...FJAR_NAV,
  "/admin/team",
  "/admin/translations",
  "/admin/signatures",
  "/admin/job-description",
  "/admin/mfa",
];

export const TENANTS: Record<TenantId, Tenant> = {
  lifeline: {
    id: "lifeline",
    name: "Lifeline",
    accent: "#10B981",
    adminNav: null,
    adminRoutes: null,
    adminHome: "/admin",
  },
  fjarlaekningar: {
    id: "fjarlaekningar",
    name: "Fjarlækningar",
    accent: "#00a8cc",
    adminNav: FJAR_NAV,
    adminRoutes: FJAR_ROUTES,
    adminHome: "/admin/presentations",
  },
};

/** Resolve a tenant id from a request host (any *.fjarlaekningar.is → fjar). */
export function tenantIdForHost(host?: string | null): TenantId {
  if (host && host.toLowerCase().includes("fjarlaekningar")) return "fjarlaekningar";
  return "lifeline";
}

export function tenantForHost(host?: string | null): Tenant {
  return TENANTS[tenantIdForHost(host)];
}

/** Prefix-match a pathname against a tenant's allowed admin routes. */
export function isAdminRouteAllowed(t: Tenant, pathname: string): boolean {
  if (!t.adminRoutes) return true;
  return t.adminRoutes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
