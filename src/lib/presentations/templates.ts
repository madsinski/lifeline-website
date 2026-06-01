// ============================================================================
// Built-in starting templates offered in the "New presentation" dialog.
// standard-v1/v2 are the current standard deck on the Lifeline design; the
// remaining four seed the same proven 18-slide content on a different visual
// design (palette + typography). The design is also switchable later in the
// editor, so a template is really "content + a starting design".
// template_version records provenance on the row.
// ============================================================================
import type { PresentationData, Slide, DesignId } from "./types";
import { newId } from "./types";
import { standardDeckSlides } from "./standard-deck";

export interface PresentationTemplate {
  id: string;
  name: string;
  description: string;
  design: DesignId;
}

export const TEMPLATES: PresentationTemplate[] = [
  { id: "standard-v1", name: "Standard — v1", description: "Full 18-slide deck · Lifeline emerald.", design: "lifeline" },
  { id: "standard-v2", name: "Standard — v2", description: "Full 18-slide deck · Lifeline emerald.", design: "lifeline" },
  { id: "midnight", name: "Midnight", description: "Full deck · indigo on deep navy, premium tech feel.", design: "midnight" },
  { id: "clinical", name: "Clinical", description: "Full deck · calm medical blue with serif headings.", design: "clinical" },
  { id: "warm", name: "Warm editorial", description: "Full deck · terracotta on cream, serif headings.", design: "warm" },
  { id: "mono", name: "Mono", description: "Full deck · high-contrast black & emerald.", design: "mono" },
  { id: "bloom", name: "Bloom · Wellness", description: "Full deck · soft rounded, minty & airy.", design: "bloom" },
  { id: "vital", name: "Vital · Medical", description: "Full deck · crisp white, dotted grid, data-forward.", design: "vital" },
  { id: "pulse", name: "Pulse · Motivational", description: "Full deck · big bold type, energetic emerald→lime.", design: "pulse" },
  { id: "journey", name: "Journey · Personal", description: "Full deck · cream editorial with handwritten accents.", design: "journey" },
];

/** Returns a fresh copy of the standard slides with brand-new slide IDs. */
function cloneWithFreshIds(slides: Slide[]): Slide[] {
  // JSON round-trip is safe: slides are plain JSON-serialisable data.
  return slides.map((s) => ({ ...(JSON.parse(JSON.stringify(s)) as Slide), id: newId() }));
}

export function buildTemplateData(templateId: string): PresentationData {
  const tpl = TEMPLATES.find((t) => t.id === templateId);
  return { slides: cloneWithFreshIds(standardDeckSlides()), design: tpl?.design ?? "lifeline" };
}

export function isKnownTemplate(id: string): boolean {
  return TEMPLATES.some((t) => t.id === id);
}
