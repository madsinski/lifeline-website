// ============================================================================
// Presentation translation helpers (English ⇄ Icelandic).
//
// Translatable content is discovered from SLIDE_SCHEMAS: any text/textarea
// field (top-level or inside a list item) that isn't flagged noTranslate.
// Each such field has a stable PATH within a slide, e.g. "heading",
// "bullets.0", "cards.1.body". The English text lives on the slide itself
// (data.slides); the Icelandic text lives in data.tIs[slideId][path].
// ============================================================================
import {
  SLIDE_SCHEMAS,
  type Slide, type FieldDef, type TextMap, type DeckTextMaps, type PresentationData,
} from "./types";

type AnyRec = Record<string, unknown>;

function isScalarTextList(f: FieldDef): boolean {
  return !!f.itemFields && f.itemFields.length === 1 && f.itemFields[0].key === "value";
}

/** Ordered list of translatable field paths for a slide, given its current data. */
export function translatablePaths(slide: Slide): string[] {
  const schema = SLIDE_SCHEMAS[slide.type];
  if (!schema) return [];
  const out: string[] = [];
  const rec = slide as unknown as AnyRec;
  for (const f of schema.fields) {
    if (f.kind === "text" || f.kind === "textarea") {
      if (!f.noTranslate) out.push(f.key as string);
    } else if (f.kind === "list") {
      const arr = rec[f.key as string];
      if (!Array.isArray(arr)) continue;
      if (isScalarTextList(f)) {
        const sf = f.itemFields![0];
        if ((sf.kind === "text" || sf.kind === "textarea") && !sf.noTranslate) {
          arr.forEach((_, i) => out.push(`${String(f.key)}.${i}`));
        }
      } else {
        arr.forEach((_, i) => {
          for (const sf of f.itemFields || []) {
            if ((sf.kind === "text" || sf.kind === "textarea") && !sf.noTranslate) {
              out.push(`${String(f.key)}.${i}.${sf.key}`);
            }
          }
        });
      }
    }
  }
  return out;
}

export function getAtPath(obj: unknown, path: string): string {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as AnyRec)[seg];
  }
  return typeof cur === "string" ? cur : "";
}

/** Sets a value at path, but only if every intermediate container exists. */
function setAtPath(obj: AnyRec, path: string, value: string): void {
  const segs = path.split(".");
  let cur: AnyRec = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const next = cur[segs[i]];
    if (next == null || typeof next !== "object") return; // structure mismatch — skip
    cur = next as AnyRec;
  }
  cur[segs[segs.length - 1]] = value;
}

/** The English (source) text of a slide as a path→text map. */
export function extractTextMap(slide: Slide): TextMap {
  const map: TextMap = {};
  for (const p of translatablePaths(slide)) map[p] = getAtPath(slide, p);
  return map;
}

function cloneSlide(s: Slide): Slide {
  return JSON.parse(JSON.stringify(s)) as Slide;
}

/** Returns a copy of the slide with non-empty overlay text applied. */
export function applyTextMap(slide: Slide, overlay?: TextMap): Slide {
  if (!overlay) return slide;
  const clone = cloneSlide(slide);
  const rec = clone as unknown as AnyRec;
  for (const [path, text] of Object.entries(overlay)) {
    if (text && text.trim()) setAtPath(rec, path, text);
  }
  return clone;
}

/** Resolve a deck's slides for a locale ("en" = source, "is" = overlay applied). */
export function resolveSlides(data: PresentationData, locale: "en" | "is"): Slide[] {
  if (locale === "en" || !data.tIs) return data.slides;
  return data.slides.map((s) => applyTextMap(s, data.tIs![s.id]));
}

/** True when at least one slide has any non-empty Icelandic text. */
export function hasIcelandic(data: PresentationData): boolean {
  if (!data.tIs) return false;
  return Object.values(data.tIs).some((m) => Object.values(m).some((v) => v && v.trim()));
}

// ---- bidirectional sync ----------------------------------------------------
export interface SyncItem { slideId: string; path: string; from: "en" | "is"; to: "en" | "is"; text: string; }
export interface SyncPlan { items: SyncItem[]; conflicts: number; }

/**
 * Diff current EN (on slides) and IS (in tIs) against the last-synced snapshot
 * to decide what to (re)translate, in which direction. English wins ties.
 */
export function planSync(data: PresentationData): SyncPlan {
  const snapEn = data.syncSnap?.en || {};
  const snapIs = data.syncSnap?.is || {};
  const items: SyncItem[] = [];
  let conflicts = 0;

  for (const slide of data.slides) {
    const id = slide.id;
    const enMap = extractTextMap(slide);
    const isMap = data.tIs?.[id] || {};
    for (const path of Object.keys(enMap)) {
      const enNow = enMap[path] || "";
      const isNow = isMap[path] || "";
      const enPrev = snapEn[id]?.[path] || "";
      const isPrev = snapIs[id]?.[path] || "";
      const enChanged = enNow !== enPrev;
      const isChanged = isNow !== isPrev;

      if (!enNow.trim() && !isNow.trim()) continue;            // nothing to do
      if (enNow.trim() && !isNow.trim()) { items.push({ slideId: id, path, from: "en", to: "is", text: enNow }); continue; }
      if (!enNow.trim() && isNow.trim()) { items.push({ slideId: id, path, from: "is", to: "en", text: isNow }); continue; }
      if (enChanged && !isChanged) { items.push({ slideId: id, path, from: "en", to: "is", text: enNow }); }
      else if (isChanged && !enChanged) { items.push({ slideId: id, path, from: "is", to: "en", text: isNow }); }
      else if (enChanged && isChanged) { conflicts++; items.push({ slideId: id, path, from: "en", to: "is", text: enNow }); }
    }
  }
  return { items, conflicts };
}

/** Recompute the snapshot of the current EN + IS state (called after a sync). */
export function snapshotOf(data: PresentationData): { en: DeckTextMaps; is: DeckTextMaps } {
  const en: DeckTextMaps = {};
  const is: DeckTextMaps = {};
  for (const slide of data.slides) {
    en[slide.id] = extractTextMap(slide);
    is[slide.id] = { ...(data.tIs?.[slide.id] || {}) };
  }
  return { en, is };
}

/**
 * Apply translated results back into a new PresentationData: EN→IS results go
 * into tIs; IS→EN results are written onto the slides; snapshot is refreshed.
 */
export function applySync(data: PresentationData, results: { slideId: string; path: string; to: "en" | "is"; text: string }[]): PresentationData {
  const slides = data.slides.map(cloneSlide);
  const byId: Record<string, Slide> = {};
  for (const s of slides) byId[s.id] = s;
  const tIs: DeckTextMaps = {};
  for (const [id, m] of Object.entries(data.tIs || {})) tIs[id] = { ...m };

  for (const r of results) {
    if (r.to === "is") {
      (tIs[r.slideId] ||= {})[r.path] = r.text;
    } else {
      const s = byId[r.slideId];
      if (s) setAtPath(s as unknown as AnyRec, r.path, r.text);
    }
  }

  const next: PresentationData = { ...data, slides, tIs };
  next.syncSnap = snapshotOf(next);
  return next;
}
