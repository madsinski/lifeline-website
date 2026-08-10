// Shared types for the website CMS.
//
// Every editable page declares a list of fields; the CMS stores per-locale
// overrides as { is: {key:value}, en: {key:value} } and the public page renders
// a flattened map (locale → Icelandic-default fallback → built-in default).
//
// Ported from the Fjarlækningar site CMS and adapted to lifeline: the locale
// type matches @/lib/i18n ("is" | "en"), and consumption is client-side (the
// marketing pages are "use client" and read the locale from the i18n context),
// not server-rendered off a cookie.

export type FieldType =
  | "text"      // single-line
  | "textarea"  // multi-line
  | "heading"   // single-line, supports ==word== emerald highlighting
  | "list"      // pipe/newline-structured collection, edited by a custom control
  | "image"     // value is an image URL/path; one locale-independent value
  | "link"      // a URL / internal path / #anchor; locale-independent, not translated
  | "select"    // one of `options`; locale-independent, not translated (a dropdown)
  | "internal"; // bookkeeping owned by a custom editor: never auto-rendered

export interface SiteField {
  key: string;
  label: string;
  group: string;
  type: FieldType;
  /** Optional helper line under the field label in the editor. */
  help?: string;
  /** For type "select": the allowed values. First entry is the effective default. */
  options?: { value: string; label: string }[];
  /**
   * Hands this field to a purpose-built list control in the admin editor. The
   * columns describe the pipe-separated fields on each line. Only text columns
   * are translated; columns marked `asset` (image paths) or `url` are treated
   * as locale-independent machine values and skipped by the translator.
   */
  columns?: { key: string; label: string; kind?: "text" | "asset" | "url" }[];
}

export type Locale = "is" | "en";
export type LocaleContent = Record<string, string>;

/** A reorderable band on a page. The hero is structural and always renders
 *  first, so it is not one of these. */
export interface SiteSection {
  id: string;
  label: string;
}

export interface SiteContentBlob {
  is?: LocaleContent;
  en?: LocaleContent;
  /** Section ids in display order. Not locale-scoped: order is the same in
   *  every language. Absent means "the built-in order". */
  order?: string[];
  /** Section ids hidden from the public page. Kept separate from `order` so a
   *  hidden section keeps its place if it's shown again. */
  hidden?: string[];
}

/**
 * Resolve the section order for a page, tolerating drift between a stored order
 * and the code: unknown ids (a section that was removed) are dropped, and
 * sections added since the order was saved are appended in their declared
 * position rather than vanishing from the page.
 */
export function resolveOrder(
  sections: SiteSection[],
  blob: SiteContentBlob | null | undefined,
): string[] {
  const known = sections.map((s) => s.id);
  const stored = (blob?.order ?? []).filter((id) => known.includes(id));
  if (!stored.length) return known;
  const missing = known.filter((id) => !stored.includes(id));
  // Re-insert anything new at its declared index so a page never loses a
  // section just because the saved order predates it.
  const out = [...stored];
  for (const id of missing) out.splice(known.indexOf(id), 0, id);
  return out;
}

/** Section ids the visitor should not see. Unknown ids are ignored. */
export function resolveHidden(
  sections: SiteSection[],
  blob: SiteContentBlob | null | undefined,
): Set<string> {
  const known = new Set(sections.map((s) => s.id));
  return new Set((blob?.hidden ?? []).filter((id) => known.has(id)));
}

/**
 * Flatten a stored { is, en } blob for one locale, falling back:
 * locale value → Icelandic value → built-in default for the locale.
 * An empty CMS reproduces the original hard-coded page exactly, because the
 * built-in defaults are the strings the page shipped with.
 */
export function resolveFields(
  fields: SiteField[],
  defaultsIs: LocaleContent,
  defaultsEn: LocaleContent,
  content: SiteContentBlob | null | undefined,
  locale: Locale,
): LocaleContent {
  const loc = content?.[locale] ?? {};
  const is = content?.is ?? {};
  const out: LocaleContent = {};
  for (const f of fields) {
    const localeDefault = locale === "en" ? defaultsEn[f.key] ?? "" : defaultsIs[f.key] ?? "";
    out[f.key] = loc[f.key]?.trim()
      ? loc[f.key]
      : is[f.key]?.trim()
        ? is[f.key]
        : localeDefault.trim()
          ? localeDefault
          : defaultsIs[f.key] ?? "";
  }
  return out;
}
