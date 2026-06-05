// ============================================================================
// Presentation / slideshow data model.
//
// A presentation row's `data` jsonb column is a PresentationData. Slides are a
// discriminated-ish union keyed by `type`; each type uses a subset of the
// optional fields below. SLIDE_SCHEMAS describes, per type, which fields are
// editable and how — this single source of truth drives both the renderer
// (src/app/components/presentation/*) and the generic admin editor
// (src/app/admin/presentations/[id]).
//
// Headings & quotes support a lightweight accent marker: text wrapped in
// ==double equals== renders with the emerald→cyan gradient. Keep it to a
// word or short phrase.
// ============================================================================

export type SlideTheme = "dark" | "light";

// Visual designs — each is a palette + typography treatment applied to the
// whole deck via a data-design attribute on the deck root (see deck-css.ts).
export type DesignId =
  | "lifeline" | "midnight" | "clinical" | "warm" | "mono"
  | "bloom" | "vital" | "pulse" | "journey" | "fjarlaekningar";

export const DESIGNS: { id: DesignId; name: string; blurb: string }[] = [
  // Colour profiles (same layout, different palette)
  { id: "lifeline", name: "Lifeline", blurb: "Signature emerald + cyan." },
  { id: "fjarlaekningar", name: "Fjarlækningar", blurb: "Electric cyan + magenta, slate neutrals." },
  { id: "midnight", name: "Midnight", blurb: "Indigo on deep navy — premium tech." },
  { id: "clinical", name: "Clinical", blurb: "Calm medical blue, serif headings." },
  { id: "warm", name: "Warm", blurb: "Editorial terracotta on cream." },
  { id: "mono", name: "Mono", blurb: "High-contrast black & emerald." },
  // Distinct themed designs (shape + typography, Lifeline-branded)
  { id: "bloom", name: "Bloom · Wellness", blurb: "Soft rounded shapes, minty, airy." },
  { id: "vital", name: "Vital · Medical", blurb: "Crisp white, dotted grid, data-forward." },
  { id: "pulse", name: "Pulse · Motivational", blurb: "Big bold type, energetic emerald→lime." },
  { id: "journey", name: "Journey · Personal", blurb: "Cream editorial with handwritten accents." },
];

export const DEFAULT_DESIGN: DesignId = "lifeline";

export type IconKey =
  | "pulse" | "clip" | "shield" | "phone" | "doc" | "chart"
  | "users" | "spark" | "dumbbell" | "leaf" | "moon" | "brain"
  | "target" | "lock" | "cal" | "apple" | "smile";

export const ICON_OPTIONS: { value: IconKey; label: string }[] = [
  { value: "pulse", label: "Pulse / heartbeat" },
  { value: "clip", label: "Clipboard" },
  { value: "shield", label: "Shield" },
  { value: "phone", label: "Phone" },
  { value: "doc", label: "Stethoscope" },
  { value: "chart", label: "Chart" },
  { value: "users", label: "People" },
  { value: "spark", label: "Spark" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "leaf", label: "Leaf" },
  { value: "moon", label: "Moon" },
  { value: "brain", label: "Brain" },
  { value: "target", label: "Target" },
  { value: "lock", label: "Lock" },
  { value: "cal", label: "Calendar" },
  { value: "apple", label: "Apple" },
  { value: "smile", label: "Smiley face" },
];

export type PillarKey = "exercise" | "nutrition" | "sleep" | "mental";

export const PILLAR_OPTIONS: { value: PillarKey; label: string }[] = [
  { value: "exercise", label: "Exercise (orange)" },
  { value: "nutrition", label: "Nutrition (lime)" },
  { value: "sleep", label: "Sleep (purple)" },
  { value: "mental", label: "Mental (sky)" },
];

// Which company wordmark shows in a slide's header. Lets a single deck present
// more than one brand (e.g. a joint Lifeline + Fjarlækningar showcase). Default
// is Lifeline when unset, so existing decks are unaffected.
export type BrandKey = "lifeline" | "fjarlaekningar" | "worldclass";

export const BRAND_OPTIONS: { value: BrandKey; label: string }[] = [
  { value: "lifeline", label: "Lifeline Health" },
  { value: "fjarlaekningar", label: "Fjarlækningar" },
  { value: "worldclass", label: "World Class" },
];

export interface StatItem { value: string; label: string; }
export interface CardItem { icon: IconKey; title: string; body: string; }
export interface StepItem { title: string; body: string; }
export interface PillarItem { key: PillarKey; icon: IconKey; title: string; body: string; }
export interface NodeItem { icon: IconKey; title: string; body: string; }
export interface MemberItem { photo: string; flag?: string; name: string; role: string; }
export interface ChipItem { label: string; }

export type SlideType =
  | "title" | "stats" | "cards" | "quote" | "story" | "team" | "team-branch"
  | "pillars" | "steps" | "bullets" | "phone-feature"
  | "app-showcase" | "trio" | "coaching" | "timeline" | "closing"
  // from-scratch layout primitives
  | "statement" | "metric" | "feature-rows" | "hero-image" | "checklist"
  | "report";

export interface Slide {
  id: string;
  type: SlideType;
  theme: SlideTheme;
  brand?: BrandKey;       // header wordmark — defaults to Lifeline when unset
  kicker?: string;
  heading?: string;       // supports ==accent== highlight
  lead?: string;
  tagline?: string;       // big closing line (title/closing)
  footnote?: string;
  caption?: string;       // photo caption (story)
  tag?: string;           // small pill, e.g. "Optional" / "Coming soon"
  quote?: string;         // big quote (quote slide), supports ==accent==
  bg?: string;            // background image URL (title/closing)
  photo?: string;         // single editorial photo URL (story)
  phone?: string;         // single phone screenshot URL (phone-feature/coaching)
  phones?: string[];      // up to 3 phone screenshot URLs (app-showcase)
  trio?: { value: string; caption?: string }[]; // 3 equal-size phones + captions (trio)
  bullets?: string[];
  chips?: ChipItem[];
  stats?: StatItem[];
  cards?: CardItem[];
  steps?: StepItem[];
  pillars?: PillarItem[];
  nodes?: NodeItem[];
  members?: MemberItem[];
  // team-branch: shared members up top, then one branch per company
  common?: MemberItem[];
  commonLabel?: string;
  branch1Brand?: BrandKey; branch1Label?: string; branch1?: MemberItem[];
  branch2Brand?: BrandKey; branch2Label?: string; branch2?: MemberItem[];
  rows?: CardItem[];      // feature-rows
  items?: string[];       // checklist
  value?: string;         // metric — the giant number
  image?: string;         // hero-image — edge-bleed image
  columns?: 1 | 2 | 3 | 4; // grid width for `cards` / `checklist`
  notes?: string;         // presenter notes (shown with N key, never public)
}

// Translation overlays. A TextMap maps a field path (e.g. "heading",
// "bullets.0", "cards.1.body") to its translated string for one slide;
// DeckTextMaps keys those by slide id.
export type TextMap = Record<string, string>;
export type DeckTextMaps = Record<string, TextMap>;

export interface PresentationData {
  slides: Slide[];            // structure + English (source) text
  design?: DesignId;
  tIs?: DeckTextMaps;         // Icelandic text overlay, keyed by slide id → path → text
  syncSnap?: { en: DeckTextMaps; is: DeckTextMaps }; // last-synced snapshots, for change detection
}

export interface PresentationMeta {
  id: string;
  slug: string;
  title: string;
  template_version: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Presentation extends PresentationMeta {
  data: PresentationData;
}

// ----------------------------------------------------------------------------
// Editor schema — drives the generic field editor.
// ----------------------------------------------------------------------------
export type FieldKind = "text" | "textarea" | "image" | "icon" | "select" | "list";
export type ImageRole = "background" | "photo" | "phone";

export interface SubFieldDef {
  key: string;
  label: string;
  kind: "text" | "textarea" | "image" | "icon" | "select";
  imageRole?: ImageRole;
  options?: { value: string; label: string }[];
  noTranslate?: boolean; // text field that should NOT be translated (names, numeric values)
}

export interface FieldDef {
  key: keyof Slide;
  label: string;
  kind: FieldKind;
  help?: string;
  noTranslate?: boolean;
  imageRole?: ImageRole;
  options?: { value: string; label: string }[];
  // for kind === "list"
  itemFields?: SubFieldDef[];
  itemLabel?: string;
  max?: number;
}

export interface SlideSchema {
  type: SlideType;
  label: string;
  description: string;
  fields: FieldDef[];
}

const F = {
  brand: { key: "brand", label: "Header logo", kind: "select", noTranslate: true, help: "Which company wordmark shows top-left.", options: BRAND_OPTIONS.map((o) => ({ value: o.value, label: o.label })) } as FieldDef,
  kicker: { key: "kicker", label: "Kicker (small label)", kind: "text" } as FieldDef,
  heading: { key: "heading", label: "Heading", kind: "textarea", help: "Wrap a word in ==double equals== for the gradient accent." } as FieldDef,
  lead: { key: "lead", label: "Lead paragraph", kind: "textarea" } as FieldDef,
  footnote: { key: "footnote", label: "Footnote", kind: "text" } as FieldDef,
  tag: { key: "tag", label: "Corner tag", kind: "text", help: 'e.g. "Optional" or "Coming soon"' } as FieldDef,
  bullets: { key: "bullets", label: "Bullets", kind: "list", itemLabel: "bullet", itemFields: [{ key: "value", label: "Text", kind: "textarea" }] } as FieldDef,
};

// Shared sub-fields for a team member (used by `team` and `team-branch`).
const MEMBER_FIELDS: SubFieldDef[] = [
  { key: "photo", label: "Photo", kind: "image", imageRole: "photo" },
  { key: "flag", label: "Flag (small label)", kind: "text" },
  { key: "name", label: "Name", kind: "text", noTranslate: true },
  { key: "role", label: "Role", kind: "text" },
];
const brandSubOptions = BRAND_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

export const SLIDE_SCHEMAS: Record<SlideType, SlideSchema> = {
  title: {
    type: "title", label: "Title", description: "Opening slide with full-bleed background.",
    fields: [
      { key: "bg", label: "Background photo", kind: "image", imageRole: "background" },
      F.kicker, F.heading, F.lead,
      { key: "tagline", label: "Tagline line", kind: "text" },
    ],
  },
  stats: {
    type: "stats", label: "Stats", description: "Heading + a grid of big numbers.",
    fields: [
      F.kicker, F.heading, F.lead, F.footnote,
      { key: "stats", label: "Stats", kind: "list", itemLabel: "stat", itemFields: [
        { key: "value", label: "Big value", kind: "text", noTranslate: true },
        { key: "label", label: "Label", kind: "textarea" },
      ] },
    ],
  },
  cards: {
    type: "cards", label: "Cards", description: "Heading + a grid of icon cards.",
    fields: [
      F.kicker, F.heading, F.lead,
      { key: "columns", label: "Columns", kind: "select", options: [
        { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" },
      ] },
      { key: "cards", label: "Cards", kind: "list", itemLabel: "card", itemFields: [
        { key: "icon", label: "Icon", kind: "icon" },
        { key: "title", label: "Title", kind: "text" },
        { key: "body", label: "Body", kind: "textarea" },
      ] },
    ],
  },
  quote: {
    type: "quote", label: "Quote", description: "A single large statement.",
    fields: [ F.kicker, { key: "quote", label: "Quote", kind: "textarea", help: "Use ==accent== for the gradient." }, F.lead ],
  },
  story: {
    type: "story", label: "Story", description: "Text + bullets beside an editorial photo.",
    fields: [
      F.kicker, F.heading, F.lead, F.bullets,
      { key: "photo", label: "Photo", kind: "image", imageRole: "photo" },
      { key: "caption", label: "Photo caption", kind: "text" },
    ],
  },
  team: {
    type: "team", label: "Team", description: "Heading + a grid of team members.",
    fields: [
      F.kicker, F.heading, F.lead, F.footnote,
      { key: "members", label: "Members", kind: "list", itemLabel: "member", itemFields: MEMBER_FIELDS },
    ],
  },
  "team-branch": {
    type: "team-branch", label: "Team — branching", description: "Shared members up top, two company-specific branches below.",
    fields: [
      F.kicker, F.heading, F.lead,
      { key: "commonLabel", label: "Shared group label", kind: "text" },
      { key: "common", label: "Shared members", kind: "list", itemLabel: "member", itemFields: MEMBER_FIELDS },
      { key: "branch1Brand", label: "Branch 1 · logo", kind: "select", noTranslate: true, options: brandSubOptions },
      { key: "branch1Label", label: "Branch 1 · caption", kind: "text" },
      { key: "branch1", label: "Branch 1 · members", kind: "list", itemLabel: "member", itemFields: MEMBER_FIELDS },
      { key: "branch2Brand", label: "Branch 2 · logo", kind: "select", noTranslate: true, options: brandSubOptions },
      { key: "branch2Label", label: "Branch 2 · caption", kind: "text" },
      { key: "branch2", label: "Branch 2 · members", kind: "list", itemLabel: "member", itemFields: MEMBER_FIELDS },
    ],
  },
  pillars: {
    type: "pillars", label: "Pillars", description: "Four colour-coded pillar tiles.",
    fields: [
      F.kicker, F.heading, F.lead,
      { key: "pillars", label: "Pillars", kind: "list", itemLabel: "pillar", max: 4, itemFields: [
        { key: "key", label: "Colour", kind: "select", options: PILLAR_OPTIONS.map(o => ({ value: o.value, label: o.label })) },
        { key: "icon", label: "Icon", kind: "icon" },
        { key: "title", label: "Title", kind: "text" },
        { key: "body", label: "Body", kind: "textarea" },
      ] },
    ],
  },
  steps: {
    type: "steps", label: "Steps", description: "Numbered process steps.",
    fields: [
      F.kicker, F.heading,
      { key: "steps", label: "Steps", kind: "list", itemLabel: "step", itemFields: [
        { key: "title", label: "Title", kind: "text" },
        { key: "body", label: "Body", kind: "textarea" },
      ] },
    ],
  },
  bullets: {
    type: "bullets", label: "Text + bullets", description: "Heading, lead, chips and a bullet list.",
    fields: [
      F.tag, F.kicker, F.heading, F.lead, F.bullets,
      { key: "chips", label: "Chips (pills)", kind: "list", itemLabel: "chip", itemFields: [
        { key: "label", label: "Label", kind: "text" },
      ] },
      F.footnote,
    ],
  },
  "phone-feature": {
    type: "phone-feature", label: "Phone + bullets", description: "Bullets beside a phone screenshot.",
    fields: [
      F.kicker, F.heading, F.lead, F.bullets,
      { key: "phone", label: "Phone screenshot", kind: "image", imageRole: "phone" },
    ],
  },
  "app-showcase": {
    type: "app-showcase", label: "App showcase", description: "Up to three phone screenshots + bullets.",
    fields: [
      F.tag, F.kicker, F.heading,
      { key: "phones", label: "Phone screenshots (max 3)", kind: "list", itemLabel: "screenshot", max: 3, itemFields: [
        { key: "value", label: "Screenshot", kind: "image", imageRole: "phone" },
      ] },
      F.bullets,
    ],
  },
  trio: {
    type: "trio", label: "Three phones", description: "Three equal-size phone screenshots, centered, with captions.",
    fields: [
      F.kicker, F.heading, F.lead,
      { key: "trio", label: "Phones (max 3)", kind: "list", itemLabel: "phone", max: 3, itemFields: [
        { key: "value", label: "Screenshot", kind: "image", imageRole: "phone" },
        { key: "caption", label: "Caption", kind: "text" },
      ] },
    ],
  },
  coaching: {
    type: "coaching", label: "Coaching", description: "Text + phone beside cards.",
    fields: [
      F.kicker, F.heading, F.lead,
      { key: "phone", label: "Phone screenshot", kind: "image", imageRole: "phone" },
      { key: "cards", label: "Cards", kind: "list", itemLabel: "card", itemFields: [
        { key: "icon", label: "Icon", kind: "icon" },
        { key: "title", label: "Title", kind: "text" },
        { key: "body", label: "Body", kind: "textarea" },
      ] },
    ],
  },
  timeline: {
    type: "timeline", label: "Timeline", description: "Horizontal journey with nodes.",
    fields: [
      F.kicker, F.heading,
      { key: "nodes", label: "Nodes", kind: "list", itemLabel: "node", itemFields: [
        { key: "icon", label: "Icon", kind: "icon" },
        { key: "title", label: "Title", kind: "text" },
        { key: "body", label: "Body", kind: "textarea" },
      ] },
      F.lead,
    ],
  },
  closing: {
    type: "closing", label: "Closing", description: "Closing slide with full-bleed background.",
    fields: [
      { key: "bg", label: "Background photo", kind: "image", imageRole: "background" },
      F.kicker, F.heading, F.lead,
      { key: "tagline", label: "Tagline line", kind: "text" },
      F.footnote,
    ],
  },
  statement: {
    type: "statement", label: "Statement", description: "One bold, full-bleed statement.",
    fields: [ F.kicker, { key: "heading", label: "Statement", kind: "textarea", help: "Big. Use ==accent== for the gradient." }, F.lead ],
  },
  metric: {
    type: "metric", label: "Metric", description: "A giant number beside a supporting headline.",
    fields: [
      F.kicker,
      { key: "value", label: "Giant value", kind: "text", noTranslate: true },
      F.heading, F.lead, F.footnote,
    ],
  },
  "feature-rows": {
    type: "feature-rows", label: "Feature rows", description: "Full-width stacked rows with hairlines.",
    fields: [
      F.kicker, F.heading,
      { key: "rows", label: "Rows", kind: "list", itemLabel: "row", itemFields: [
        { key: "icon", label: "Icon", kind: "icon" },
        { key: "title", label: "Title", kind: "text" },
        { key: "body", label: "Body", kind: "textarea" },
      ] },
    ],
  },
  "hero-image": {
    type: "hero-image", label: "Hero image", description: "Heading beside an edge-bleed image.",
    fields: [
      { key: "image", label: "Image", kind: "image", imageRole: "background" },
      F.kicker, F.heading, F.lead,
      { key: "tagline", label: "Tagline line", kind: "text" },
    ],
  },
  checklist: {
    type: "checklist", label: "Checklist", description: "Big two-column list of checked items.",
    fields: [
      F.kicker, F.heading,
      { key: "columns", label: "Columns", kind: "select", options: [{ value: "1", label: "1" }, { value: "2", label: "2" }] },
      { key: "items", label: "Items", kind: "list", itemLabel: "item", itemFields: [{ key: "value", label: "Text", kind: "textarea" }] },
    ],
  },
  report: {
    type: "report", label: "Report (laptop)", description: "A wide screenshot in a laptop mock-up beside text.",
    fields: [
      F.kicker, F.heading, F.lead, F.bullets,
      { key: "image", label: "Screenshot", kind: "image", imageRole: "phone" },
    ],
  },
};

export const SLIDE_TYPE_ORDER: SlideType[] = [
  "title", "statement", "metric", "stats", "cards", "feature-rows",
  "checklist", "quote", "story", "team", "team-branch", "pillars", "steps", "bullets",
  "phone-feature", "report", "app-showcase", "trio", "coaching", "timeline", "hero-image", "closing",
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return "s-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** A sensible blank slide for the given type, used by "Add slide". */
export function makeBlankSlide(type: SlideType): Slide {
  const base: Slide = { id: newId(), type, theme: "light" };
  switch (type) {
    case "title":
      return { ...base, theme: "dark", kicker: "Welcome", heading: "Your ==headline== here", lead: "A short introductory sentence.", tagline: "Tagline." };
    case "stats":
      return { ...base, kicker: "Why this matters", heading: "A ==striking== heading", lead: "", stats: [ { value: "59%", label: "Describe the statistic." }, { value: "#1", label: "Describe the statistic." } ] };
    case "cards":
      return { ...base, theme: "dark", kicker: "Section", heading: "Three things to know", columns: 3, cards: [ { icon: "target", title: "First", body: "Body text." }, { icon: "pulse", title: "Second", body: "Body text." }, { icon: "chart", title: "Third", body: "Body text." } ] };
    case "quote":
      return { ...base, kicker: "Our purpose", quote: "A ==memorable== statement that lands." };
    case "story":
      return { ...base, theme: "dark", kicker: "Our story", heading: "A short story heading.", lead: "Set the scene in a sentence or two.", bullets: ["First point.", "Second point.", "Third point."], photo: "", caption: "" };
    case "team":
      return { ...base, kicker: "The team", heading: "Meet the team.", lead: "", members: [ { photo: "", name: "Full Name", role: "Role" } ], footnote: "" };
    case "team-branch":
      return { ...base, kicker: "The team", heading: "One team, ==two companies.==", commonLabel: "Shared founders",
        common: [ { photo: "", flag: "Co-founder", name: "Full Name", role: "Role" } ],
        branch1Brand: "lifeline", branch1Label: "", branch1: [ { photo: "", name: "Full Name", role: "Role" } ],
        branch2Brand: "fjarlaekningar", branch2Label: "", branch2: [ { photo: "", name: "Full Name", role: "Role" } ] };
    case "pillars":
      return { ...base, kicker: "The model", heading: "Four pillars.", pillars: [
        { key: "exercise", icon: "dumbbell", title: "Exercise", body: "" },
        { key: "nutrition", icon: "leaf", title: "Nutrition", body: "" },
        { key: "sleep", icon: "moon", title: "Sleep", body: "" },
        { key: "mental", icon: "brain", title: "Mental wellness", body: "" },
      ] };
    case "steps":
      return { ...base, kicker: "How it works", heading: "Simple steps.", steps: [ { title: "Step one", body: "" }, { title: "Step two", body: "" }, { title: "Step three", body: "" } ] };
    case "bullets":
      return { ...base, kicker: "Section", heading: "A ==clear== heading", lead: "", bullets: ["First point.", "Second point."], chips: [] };
    case "phone-feature":
      return { ...base, theme: "dark", kicker: "Feature", heading: "What you get.", bullets: ["First point.", "Second point."], phone: "" };
    case "app-showcase":
      return { ...base, theme: "dark", kicker: "The app", heading: "Everything in your pocket.", tag: "Coming soon", phones: [], bullets: ["First feature.", "Second feature."] };
    case "trio":
      return { ...base, theme: "dark", kicker: "The app", heading: "Everything in your ==pocket.==", trio: [ { value: "", caption: "Screen one" }, { value: "", caption: "Screen two" }, { value: "", caption: "Screen three" } ] };
    case "coaching":
      return { ...base, kicker: "Coaching", heading: "Smart guidance, and real humans.", lead: "", phone: "", cards: [ { icon: "spark", title: "First", body: "" }, { icon: "users", title: "Second", body: "" } ] };
    case "timeline":
      return { ...base, kicker: "Your journey", heading: "From start to finish.", nodes: [ { icon: "clip", title: "Start", body: "" }, { icon: "chart", title: "Finish", body: "" } ], lead: "" };
    case "closing":
      return { ...base, theme: "dark", kicker: "Getting started", heading: "A strong ==closing== line.", lead: "", tagline: "Tagline.", footnote: "" };
    case "statement":
      return { ...base, theme: "dark", kicker: "", heading: "A bold ==statement== that stands alone.", lead: "" };
    case "metric":
      return { ...base, theme: "dark", kicker: "By the numbers", value: "80%", heading: "What the number means.", lead: "A sentence of context.", footnote: "" };
    case "feature-rows":
      return { ...base, kicker: "Section", heading: "A few things, in a row.", rows: [
        { icon: "target", title: "First", body: "Body text." },
        { icon: "pulse", title: "Second", body: "Body text." },
        { icon: "chart", title: "Third", body: "Body text." },
      ] };
    case "hero-image":
      return { ...base, theme: "dark", kicker: "Section", heading: "A ==headline== beside an image.", lead: "Supporting copy.", tagline: "", image: "" };
    case "checklist":
      return { ...base, kicker: "Section", heading: "What's included.", columns: 2, items: ["First item.", "Second item.", "Third item.", "Fourth item."] };
    case "report":
      return { ...base, kicker: "Your report", heading: "Your complete health report.", lead: "Every marker, scored and explained.", bullets: ["A score for each area of your health.", "Plain-language explanations and next steps.", "Trends over time as you reassess."], image: "" };
  }
}
