// Editable text inside SVG illustrations (full-bleed slides).
//
// The drawing stays as-is; its text is exposed as an ordered list of "slots":
// every <tspan> that holds text, or the <text> itself when it has no tspans,
// in document order. A slide stores `svgText: string[]` against those slots
// (empty entry = keep the drawing's own text), so the wording can be edited —
// and translated through the normal IS/EN overlay — without redrawing.
// Browser-only (DOMParser / XMLSerializer).

function slots(doc: Document): Element[] {
  const out: Element[] = [];
  doc.querySelectorAll("text").forEach((t) => {
    const spans = Array.from(t.querySelectorAll("tspan")).filter((s) => !s.querySelector("tspan"));
    if (spans.length) out.push(...spans);
    else out.push(t);
  });
  return out;
}

function parse(source: string): Document | null {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  return doc.querySelector("parsererror") ? null : doc;
}

/** The drawing's own texts, in slot order. */
export function readSvgTexts(source: string): string[] {
  const doc = parse(source);
  return doc ? slots(doc).map((el) => (el.textContent ?? "").trim()) : [];
}

/** The SVG with non-empty `texts[i]` written into slot i. */
export function applySvgTexts(source: string, texts: string[]): string {
  const doc = parse(source);
  if (!doc) return source;
  slots(doc).forEach((el, i) => {
    const t = texts[i];
    if (t && t.trim()) el.textContent = t;
  });
  return new XMLSerializer().serializeToString(doc);
}

export const isSvgUrl = (url?: string | null) => !!url && /\.svg(\?|#|$)/i.test(url);
