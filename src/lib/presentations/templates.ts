// ============================================================================
// Built-in starting templates offered in the "New presentation" dialog.
// Per product decision, v1 and v2 are both the current standard deck — pick
// either and customise. template_version is recorded on the row for
// provenance, and lets us diverge the two later without a migration.
// ============================================================================
import type { PresentationData, Slide } from "./types";
import { newId } from "./types";
import { standardDeckSlides } from "./standard-deck";

export interface PresentationTemplate {
  id: string;
  name: string;
  description: string;
}

export const TEMPLATES: PresentationTemplate[] = [
  { id: "standard-v1", name: "Standard — v1", description: "The full employee-introduction deck (18 slides)." },
  { id: "standard-v2", name: "Standard — v2", description: "The full employee-introduction deck (18 slides)." },
];

/** Returns a fresh copy of a template's slides with brand-new slide IDs. */
function cloneWithFreshIds(slides: Slide[]): Slide[] {
  return slides.map((s) => ({ ...structuredCloneSlide(s), id: newId() }));
}

// structuredClone isn't guaranteed in every runtime we target; JSON round-trip
// is safe here because slides are plain JSON-serialisable data.
function structuredCloneSlide(s: Slide): Slide {
  return JSON.parse(JSON.stringify(s)) as Slide;
}

export function buildTemplateData(templateId: string): PresentationData {
  // Both templates currently seed from the same standard deck.
  switch (templateId) {
    case "standard-v1":
    case "standard-v2":
    default:
      return { slides: cloneWithFreshIds(standardDeckSlides()) };
  }
}

export function isKnownTemplate(id: string): boolean {
  return TEMPLATES.some((t) => t.id === id);
}
