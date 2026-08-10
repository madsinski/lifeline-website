// Registry of every CMS-editable marketing page. The admin editor and the
// public pages both read from here, so adding a page is a one-entry change.
//
// Batch 1 registers the home page. About / coaching / assessment / contact
// follow in later batches with their own field + section modules.

import {
  resolveFields,
  resolveOrder,
  resolveHidden,
  type Locale,
  type LocaleContent,
  type SiteContentBlob,
  type SiteField,
  type SiteSection,
} from "./types";
import { HOME_FIELDS, HOME_SECTIONS, HOME_DEFAULTS_IS, HOME_DEFAULTS_EN } from "./home";
import { COACHING_FIELDS, COACHING_SECTIONS, COACHING_DEFAULTS_IS, COACHING_DEFAULTS_EN } from "./coaching";

export interface SitePage {
  key: string;
  label: string;
  desc: string;
  /** Public path, for the "open page" link in the editor. */
  path: string;
  fields: SiteField[];
  /** Reorderable / hideable bands. */
  sections: SiteSection[];
  defaultsIs: LocaleContent;
  defaultsEn: LocaleContent;
}

export const SITE_PAGES: SitePage[] = [
  {
    key: "home",
    label: "Forsíða",
    desc: "Hetja, hvernig það virkar, af hverju Lifeline, heilsumat, appið, teymið, samstarf, ákall.",
    path: "/",
    fields: HOME_FIELDS,
    sections: HOME_SECTIONS,
    defaultsIs: HOME_DEFAULTS_IS,
    defaultsEn: HOME_DEFAULTS_EN,
  },
  {
    key: "coaching",
    label: "Þjálfun (Coaching)",
    desc: "Hetja, af hverju þjálfun, fjórar stoðir, dæmigerður dagur, áskriftir, samanburður, sækja appið.",
    path: "/coaching",
    fields: COACHING_FIELDS,
    sections: COACHING_SECTIONS,
    defaultsIs: COACHING_DEFAULTS_IS,
    defaultsEn: COACHING_DEFAULTS_EN,
  },
];

export function getSitePage(key: string): SitePage | undefined {
  return SITE_PAGES.find((p) => p.key === key);
}

/** Resolve a stored blob for any registered page key into a flat locale map. */
export function resolveContent(
  key: string,
  blob: SiteContentBlob | null | undefined,
  locale: Locale,
): LocaleContent {
  const page = getSitePage(key);
  if (!page) return {};
  return resolveFields(page.fields, page.defaultsIs, page.defaultsEn, blob, locale);
}

/** Section ids in display order for a page, honouring CMS reordering. */
export function resolveSections(
  key: string,
  blob: SiteContentBlob | null | undefined,
): string[] {
  const page = getSitePage(key);
  if (!page) return [];
  return resolveOrder(page.sections, blob);
}

/** Section ids hidden from the public page. */
export function resolveHiddenSections(
  key: string,
  blob: SiteContentBlob | null | undefined,
): Set<string> {
  const page = getSitePage(key);
  if (!page) return new Set();
  return resolveHidden(page.sections, blob);
}
