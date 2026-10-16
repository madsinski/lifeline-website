// The admin's navigation map AND its access map — one table for both.
//
// Every /admin module is a NavItem in a group. Each item lists the staff
// roles that may open it; `admin` (and anyone holding manage_team) may open
// everything, so ADMIN_ONLY is just an empty list. The layout uses the same
// table twice: to filter the sidebar, and to guard the route itself, so a
// typed URL is held to exactly what the sidebar offers.
//
// Routes that are not in the sidebar (the pages the wrapper tabs mount, the
// detail pages) are mapped onto the item that owns them in ROUTE_OWNERS and
// inherit its roles. Anything unmapped is admin-only: a new page is closed
// until somebody puts it on the map.

import type { ReactNode } from "react";

export type StaffRole = "admin" | "coach" | "doctor" | "nurse" | "psychologist" | "medical_advisor" | "lawyer";

export type BadgeKey =
  | "clients" | "feedback" | "refund-requests" | "data-requests" | "access-review"
  | "errors" | "security" | "ai-feedback" | "surveys" | "business" | "audit"
  | "wearable-issues" | "action-feedback";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Roles besides admin that may see and open this. */
  roles: readonly StaffRole[];
  /** Any one of these permissions also grants it. */
  permissions?: readonly string[];
  badge?: BadgeKey;
}

export interface NavGroup {
  id: string;
  label: string;
  /** Starts folded (developer / app tooling). */
  collapsible?: boolean;
  items: NavItem[];
}

const CLINICAL: StaffRole[] = ["nurse", "doctor", "psychologist"];
/** Front-line staff: the day's work. */
const DAILY: StaffRole[] = ["coach", ...CLINICAL];
/** Client records: front-line staff plus the medical advisor (read-only). */
const CLIENT_ROLES: StaffRole[] = [...DAILY, "medical_advisor"];
const ADMIN_ONLY: StaffRole[] = [];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "daily",
    label: "Dagleg vinna",
    items: [
      {
        href: "/admin",
        label: "Yfirlit",
        roles: [...DAILY, "medical_advisor"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
        ),
      },
      {
        href: "/admin/vinnustod",
        label: "Vinnustöð",
        roles: DAILY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
        ),
      },
      {
        href: "/admin/coach",
        label: "Þjálfarayfirlit",
        roles: DAILY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
        ),
      },
      {
        href: "/admin/conversations",
        label: "Skilaboð",
        roles: DAILY,
        badge: "feedback",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
        ),
      },
      {
        href: "/admin/scheduling",
        label: "Dagatal",
        roles: DAILY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
        ),
      },
      {
        href: "/admin/bookings",
        label: "Bókanir og endurgreiðslur",
        roles: DAILY,
        badge: "refund-requests",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
        ),
      },
    ],
  },
  {
    id: "clients",
    label: "Skjólstæðingar",
    items: [
      {
        href: "/admin/clients",
        label: "Skjólstæðingar",
        roles: CLIENT_ROLES,
        badge: "clients",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
        ),
      },
      {
        href: "/admin/coach/plans",
        label: "Aðgerðaáætlanir",
        roles: CLIENT_ROLES,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
          </svg>
        ),
      },
      {
        href: "/admin/surveys",
        label: "Kannanir",
        roles: CLIENT_ROLES,
        badge: "surveys",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
        ),
      },
      {
        href: "/admin/research",
        label: "Rannsóknir",
        roles: CLIENT_ROLES,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
        ),
      },
    ],
  },
  {
    id: "journey",
    label: "Heilsuferð og vörur",
    items: [
      {
        href: "/admin/heilsuferd",
        label: "Heilsuferð",
        roles: CLINICAL,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
        ),
      },
      {
        href: "/admin/unions",
        label: "Stéttarfélög",
        roles: ADMIN_ONLY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
        ),
      },
      {
        href: "/admin/onboarding",
        label: "Innleiðing",
        roles: ADMIN_ONLY,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "content",
    label: "Efni og vefur",
    items: [
      {
        href: "/admin/website",
        label: "Vefsíða",
        roles: ["medical_advisor"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
        ),
      },
      {
        href: "/admin/lectures",
        label: "Fræðsla",
        roles: ["coach", ...CLINICAL, "medical_advisor"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
        ),
      },
      {
        href: "/admin/knowledge",
        label: "Uppflettirit",
        roles: [...CLINICAL, "medical_advisor"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
        ),
      },
      {
        href: "/admin/station-instructions",
        label: "Stöðvarleiðbeiningar",
        roles: [...CLINICAL, "medical_advisor"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
      },
      {
        href: "/admin/presentations",
        label: "Kynningar",
        roles: ["medical_advisor"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12a2.25 2.25 0 002.25-2.25V3M3.75 3h16.5M3.75 3H2.25m18 0h1.5m-18 13.5L12 21m0 0l5.25-4.5M12 21V11.25" />
            </svg>
        ),
      },
      {
        href: "/admin/content",
        label: "Appefni",
        roles: ["coach", "medical_advisor"],
        badge: "audit",
        permissions: ["manage_programs"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
        ),
      },
    ],
  },
  {
    id: "companies",
    label: "Fyrirtæki",
    items: [
      {
        href: "/admin/companies",
        label: "Fyrirtæki",
        roles: ADMIN_ONLY,
        badge: "business",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
        ),
      },
      {
        href: "/admin/communication",
        label: "Markaðssetning",
        roles: ADMIN_ONLY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
        ),
      },
    ],
  },
  {
    id: "operations",
    label: "Rekstur",
    items: [
      {
        href: "/admin/business",
        label: "Fyrirtækjarekstur",
        roles: ADMIN_ONLY,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
          </svg>
        ),
      },
      {
        href: "/admin/legal",
        label: "Lögfræði",
        roles: ["lawyer", "medical_advisor"],
        permissions: ["view_legal"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        ),
      },
      {
        href: "/admin/data-requests",
        label: "Persónuverndarbeiðnir",
        roles: ADMIN_ONLY,
        badge: "data-requests",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
        ),
      },
      {
        href: "/admin/access-review",
        label: "Aðgangsrýni",
        roles: ADMIN_ONLY,
        badge: "access-review",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
        ),
      },
      {
        href: "/admin/security",
        label: "Öryggisvöktun",
        roles: ADMIN_ONLY,
        badge: "security",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
            </svg>
        ),
      },
      {
        href: "/admin/errors",
        label: "Villuskrá",
        roles: ADMIN_ONLY,
        badge: "errors",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
        ),
      },
    ],
  },
  {
    id: "settings",
    label: "Stillingar",
    items: [
      {
        href: "/admin/settings",
        label: "Teymi",
        roles: ADMIN_ONLY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
      },
      {
        href: "/admin/access",
        label: "Aðgangur",
        roles: ADMIN_ONLY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
        ),
      },
      {
        href: "/admin/translations",
        label: "Þýðingar",
        roles: ADMIN_ONLY,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "dev",
    label: "Þróun og app",
    collapsible: true,
    items: [
      {
        href: "/admin/analytics",
        label: "Greining",
        roles: ADMIN_ONLY,
        permissions: ["view_analytics"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
        ),
      },
      {
        href: "/admin/ai-test-bench",
        label: "Gervigreindarprófanir",
        roles: ADMIN_ONLY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
        ),
      },
      {
        href: "/admin/ai-feedback",
        label: "Endurgjöf á gervigreind",
        roles: ADMIN_ONLY,
        badge: "ai-feedback",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
        ),
      },
      {
        href: "/admin/action-feedback",
        label: "Endurgjöf á aðgerðir",
        roles: ADMIN_ONLY,
        badge: "action-feedback",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 1 0 5.636 5.636a9 9 0 0 0 12.728 12.728zM5.636 5.636L18.364 18.364" />
            </svg>
        ),
      },
      {
        href: "/admin/wearable-issues",
        label: "Vandamál með snjalltæki",
        roles: ADMIN_ONLY,
        badge: "wearable-issues",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <rect x="6" y="6" width="12" height="12" rx="3" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6M9 21h6M18.75 10.5v3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75V12l1.5 1.5" />
            </svg>
        ),
      },
      {
        href: "/admin/releases",
        label: "Útgáfur og áhætta",
        roles: ADMIN_ONLY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
        ),
      },
      {
        href: "/admin/beta",
        label: "Betaprófanir",
        roles: ADMIN_ONLY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
        ),
      },
      {
        href: "/admin/onboarding-bench",
        label: "Prófun nýskráningar",
        roles: ADMIN_ONLY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
            </svg>
        ),
      },
      {
        href: "/admin/wellness-pulse-bench",
        label: "Prófun vellíðunarpúls",
        roles: ADMIN_ONLY,
        icon: (
          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h3l3-9 4.5 18 3-9h3.75" />
            </svg>
        ),
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Pages reached through a wrapper's tabs or a link, mapped to the sidebar
 * item that owns them. Prefix match, like the items.
 */
export const ROUTE_OWNERS: Record<string, string> = {
  "/admin/calendar": "/admin/scheduling",
  "/admin/station-slots": "/admin/scheduling",
  "/admin/doctor-slots": "/admin/scheduling",
  "/admin/messages": "/admin/conversations",
  "/admin/feedback": "/admin/conversations",
  "/admin/programs": "/admin/content",
  "/admin/exercises": "/admin/content",
  "/admin/education": "/admin/content",
  "/admin/meals": "/admin/content",
  "/admin/payments": "/admin/business",
  "/admin/outreach": "/admin/communication",
  "/admin/company-inquiries": "/admin/communication",
  "/admin/email-list": "/admin/communication",
  "/admin/email-preview": "/admin/communication",
  "/admin/team": "/admin/settings",
  "/admin/checkins": "/admin/settings",
  "/admin/signatures": "/admin/settings",
  "/admin/job-description": "/admin/settings",
  "/admin/biody": "/admin/companies",
  "/admin/whats-new": "/admin/website",
};

/** Auth flow pages: never guarded by role (the layout handles them). */
export const SYSTEM_ROUTES = ["/admin/login", "/admin/mfa", "/admin/onboard"];

const under = (pathname: string, prefix: string) =>
  prefix === "/admin" ? pathname === "/admin" : pathname === prefix || pathname.startsWith(prefix + "/");

/** The sidebar item a path belongs to: the longest matching item, else its owner. */
export function navItemForPath(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const it of NAV_ITEMS) {
    if (under(pathname, it.href) && (!best || it.href.length > best.href.length)) best = it;
  }
  if (best && best.href !== "/admin") return best;
  let owner: string | null = null;
  for (const p of Object.keys(ROUTE_OWNERS)) {
    if (under(pathname, p) && (!owner || p.length > owner.length)) owner = p;
  }
  if (owner) return NAV_ITEMS.find((i) => i.href === ROUTE_OWNERS[owner!]) ?? null;
  return best;
}

export function isSystemRoute(pathname: string): boolean {
  return SYSTEM_ROUTES.some((p) => under(pathname, p));
}

/** admin, or anyone who may manage the team, sees everything. */
export function isAdminLevel(role: string | null, permissions: readonly string[]): boolean {
  return role === "admin" || permissions.includes("manage_team");
}

export function canSeeItem(item: NavItem, role: string | null, permissions: readonly string[]): boolean {
  if (!role) return false;
  if (role === "lawyer") return item.href === "/admin/legal";
  if (isAdminLevel(role, permissions)) return true;
  if ((item.roles as readonly string[]).includes(role)) return true;
  return !!item.permissions?.some((p) => permissions.includes(p));
}

/**
 * May this role open this path? System routes always; unmapped routes only
 * for admin level (fail closed).
 */
export function canOpenPath(pathname: string, role: string | null, permissions: readonly string[]): boolean {
  if (isSystemRoute(pathname)) return true;
  if (!role) return false;
  if (role === "lawyer") return under(pathname, "/admin/legal");
  if (isAdminLevel(role, permissions)) return true;
  const item = navItemForPath(pathname);
  return !!item && canSeeItem(item, role, permissions);
}

/** Where a role lands when it opens something it may not. */
export function homeFor(role: string | null): string {
  return role === "lawyer" ? "/admin/legal/drafts" : "/admin";
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Stjórnandi",
  coach: "Heilsuþjálfari",
  doctor: "Læknir",
  nurse: "Hjúkrunarfræðingur",
  psychologist: "Sálfræðingur",
  medical_advisor: "Læknisfræðilegur ráðgjafi",
  lawyer: "Lögmaður",
};

// Sub-page segments that have a name; anything that looks like an id reads
// „Nánar“ rather than a uuid.
const SEGMENT_LABELS: Record<string, string> = {
  plans: "Aðgerðaáætlanir",
  drafts: "Drög",
  "whats-new": "Nýjungar",
  "bulk-create": "Stofna í magni",
  new: "Nýtt",
  edit: "Breyta",
  audit: "Yfirferð",
};

/** Breadcrumbs from the nav labels: Group › Item › sub-page. */
export function breadcrumbsFor(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/admin") return [{ label: "Yfirlit" }];
  const item = navItemForPath(pathname);
  const group = item ? NAV_GROUPS.find((g) => g.items.includes(item)) : null;
  const crumbs: { label: string; href?: string }[] = [];
  if (group && group.label !== item?.label) crumbs.push({ label: group.label });
  if (item) crumbs.push({ label: item.label, href: item.href });
  const base = item && under(pathname, item.href) ? item.href : (Object.keys(ROUTE_OWNERS).find((p) => under(pathname, p)) ?? "/admin");
  const rest = pathname.slice(base.length).split("/").filter(Boolean);
  let path = base;
  for (const seg of rest) {
    path += "/" + seg;
    const label = SEGMENT_LABELS[seg]
      ?? (/^[0-9a-f-]{8,}$/i.test(seg) ? "Nánar" : decodeURIComponent(seg).replace(/-/g, " "));
    crumbs.push({ label, href: path });
  }
  if (crumbs.length === 0) crumbs.push({ label: "Stjórnborð" });
  return crumbs;
}
