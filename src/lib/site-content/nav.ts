// Top navbar configuration — the order and visibility of the marketing nav
// links. Stored in the site_content CMS under the "nav" key (blob: {order,
// hidden}). Labels still come from the translations table via t(), so this only
// controls sequence + show/hide. Both the public Navbar and the admin editor
// read from here.

import { resolveOrder, resolveHidden, type SiteContentBlob, type SiteSection } from "./types";

export interface NavItem {
  id: string;
  href: string;
  key: string;       // translations-table key for the label
  fallback: string;  // built-in label
  /** CMS-set label overrides (from the nav blob), per locale. */
  labelIs?: string;
  labelEn?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "assessment", href: "/assessment", key: "nav.assessment", fallback: "Heilsumat" },
  { id: "coaching", href: "/coaching", key: "nav.coaching", fallback: "Þjálfun" },
  { id: "business", href: "/business", key: "nav.companies", fallback: "Fyrirtæki" },
  { id: "contact", href: "/contact", key: "nav.contact", fallback: "Hafa samband" },
];

const AS_SECTIONS: SiteSection[] = NAV_ITEMS.map((n) => ({ id: n.id, label: n.fallback }));

/** Visible nav items in display order, honouring CMS order + hidden + labels. */
export function resolveNav(blob: SiteContentBlob | null | undefined): NavItem[] {
  const order = resolveOrder(AS_SECTIONS, blob);
  const hidden = resolveHidden(AS_SECTIONS, blob);
  const byId = new Map(NAV_ITEMS.map((n) => [n.id, n]));
  return order
    .filter((id) => !hidden.has(id))
    .map((id): NavItem | null => {
      const base = byId.get(id);
      if (!base) return null;
      return {
        ...base,
        labelIs: blob?.is?.[id]?.trim() || undefined,
        labelEn: blob?.en?.[id]?.trim() || undefined,
      };
    })
    .filter((n): n is NavItem => n !== null);
}
