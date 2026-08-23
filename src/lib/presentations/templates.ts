// ============================================================================
// Built-in starting templates offered in the "New presentation" dialog.
// standard-v1/v2 are the current standard deck on the Lifeline design; the
// remaining four seed the same proven 18-slide content on a different visual
// design (palette + typography). The design is also switchable later in the
// editor, so a template is really "content + a starting design".
// template_version records provenance on the row.
// ============================================================================
import type { PresentationData, Slide, DesignId, DeckTextMaps, TextMap } from "./types";
import { newId } from "./types";
import { standardDeckSlides } from "./standard-deck";
import { editorialDeck, keynoteDeck, clinicalDeck, energeticDeck, brochureDeck, lifelineFjarlaekningarDeck, investorDeck, worldclassDeck, hsuDeck, hsuDeckIs } from "./template-decks";

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
  // From-scratch decks — different layouts/elements, not re-skins.
  { id: "editorial", name: "Editorial", description: "Rebuilt from scratch · photo cover, pull-quotes & feature rows.", design: "journey" },
  { id: "keynote", name: "Keynote", description: "Rebuilt from scratch · minimal, one idea per slide, giant numbers.", design: "midnight" },
  { id: "clinical-report", name: "Clinical Report", description: "Rebuilt from scratch · data-forward metrics, checklists & steps.", design: "vital" },
  { id: "energetic", name: "Energetic", description: "Rebuilt from scratch · bold motivational statements & metrics.", design: "pulse" },
  { id: "brochure", name: "Brochure", description: "Rebuilt from scratch · image-led wellness brochure.", design: "bloom" },
  // Joint two-company showcase — short deck, per-slide brand switching.
  { id: "lifeline-fjarlaekningar", name: "Lifeline + Fjarlækningar", description: "Assessment, four pillars, coaching, Fjarlækningar + a team per company. Exportable to PDF.", design: "lifeline" },
  // Investor deck — 4 slides per company (History · Concept · Clients · Team).
  { id: "investor", name: "Investor — Fjarlækningar + Lifeline", description: "History, concept, clients & team for each company (Lifeline split into assessment + coaching). Exportable to PDF.", design: "lifeline" },
  // World Class gym-chain partnership pitch.
  { id: "worldclass", name: "World Class × Lifeline", description: "7 slides · gym partnership — measurements, nutrition, app, programs & co-marketing. Exportable to PDF.", design: "lifeline" },
  // HSU public-health partnership — board pitch for the Vestmannaeyjar pilot.
  { id: "hsu", name: "HSU × Lifeline — Framtíðar heilsa", description: "15 slides · public-health partnership pitch for the Vestmannaeyjar pilot. Ships with hand-written Icelandic.", design: "clinical" },
];

// From-scratch templates map to a bespoke deck builder + design.
//
// `is` is optional: a template may ship hand-written Icelandic instead of
// relying on the editor's machine translation. It returns one TextMap per
// slide, aligned by index — index rather than slide id, because the ids are
// regenerated on every create (see cloneWithFreshIds).
const CUSTOM_DECKS: Record<string, { fn: () => Slide[]; design: DesignId; is?: () => TextMap[] }> = {
  editorial: { fn: editorialDeck, design: "journey" },
  keynote: { fn: keynoteDeck, design: "midnight" },
  "clinical-report": { fn: clinicalDeck, design: "vital" },
  energetic: { fn: energeticDeck, design: "pulse" },
  brochure: { fn: brochureDeck, design: "bloom" },
  "lifeline-fjarlaekningar": { fn: lifelineFjarlaekningarDeck, design: "lifeline" },
  investor: { fn: investorDeck, design: "lifeline" },
  worldclass: { fn: worldclassDeck, design: "lifeline" },
  hsu: { fn: hsuDeck, design: "clinical", is: hsuDeckIs },
};

/** Returns a fresh copy of the standard slides with brand-new slide IDs. */
function cloneWithFreshIds(slides: Slide[]): Slide[] {
  // JSON round-trip is safe: slides are plain JSON-serialisable data.
  return slides.map((s) => ({ ...(JSON.parse(JSON.stringify(s)) as Slide), id: newId() }));
}

export function buildTemplateData(templateId: string): PresentationData {
  const custom = CUSTOM_DECKS[templateId];
  if (custom) {
    const slides = cloneWithFreshIds(custom.fn());
    const data: PresentationData = { slides, design: custom.design };
    if (custom.is) {
      const maps = custom.is();
      const tIs: DeckTextMaps = {};
      slides.forEach((slide, i) => { if (maps[i]) tIs[slide.id] = maps[i]; });
      data.tIs = tIs;
    }
    return data;
  }
  const tpl = TEMPLATES.find((t) => t.id === templateId);
  return { slides: cloneWithFreshIds(standardDeckSlides()), design: tpl?.design ?? "lifeline" };
}

/** Display name for a template id, for defaulting a new presentation's title. */
export function templateName(id: string): string | null {
  return TEMPLATES.find((t) => t.id === id)?.name ?? null;
}

export function isKnownTemplate(id: string): boolean {
  return TEMPLATES.some((t) => t.id === id);
}
