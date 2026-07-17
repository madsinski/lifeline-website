// Shared model for the homepage "What's new" (Nýtt hjá Lifeline) carousel.
// Backed by supabase/migration-whats-new.sql (single row, id = 1, jsonb `data`).
// API-mediated: the homepage reads the public /api/whats-new; the admin editor
// (/admin/whats-new) reads/writes /api/admin/whats-new. This file is pure data
// + types (no JSX) so it can be imported from both server routes and client
// components.

export type Lang = "is" | "en";
export type L = { is: string; en: string };

export type WhatsNewCard = {
  key: string;
  enabled: boolean;
  badge: L;
  partner?: L; // optional co-brand chip (e.g. "Í samstarfi við Lyfju")
  title: L;
  desc: L;
  bullets: { is: string[]; en: string[] };
  price?: L; // optional price / pricing note
  cta: L;
  href: string; // internal ("/coaching") or external ("https://…")
  qrUrl?: string; // optional — renders a small QR on the card
};

export type WhatsNewContent = { cards: WhatsNewCard[] };

const PORTAL_URL = "https://app.medalia.is/7ca0ca21-8947-46cb-afbd-2e2d15efef6e";

// The built-in cards. These seed the DB and are the fallback whenever the
// stored blob is empty or the API is unreachable, so the homepage always has
// content even before anything is saved in the admin.
export const DEFAULT_WHATS_NEW: WhatsNewContent = {
  cards: [
    {
      key: "lyfja",
      enabled: true,
      badge: { is: "NÝTT", en: "NEW" },
      partner: { is: "Í samstarfi við Lyfju", en: "In partnership with Lyfja" },
      title: { is: "Heilsufarsskoðun Lifeline hjá Lyfju", en: "Lifeline Health Check at Lyfja" },
      desc: {
        is: "Heildræn kortlagning á heilsu þinni með áherslu á svefn, hreyfingu, næringu og andlega líðan.",
        en: "A holistic mapping of your health, focused on sleep, exercise, nutrition and mental wellness.",
      },
      bullets: {
        is: [
          "Heildrænn heilsuspurningalisti",
          "Mælingar hjá Lyfju og efnaskiptablóðprufa hjá Sameind",
          "Læknisviðtal og persónuleg aðgerðaáætlun",
        ],
        en: [
          "Holistic health questionnaire",
          "Measurements at Lyfja + metabolic blood panel at Sameind",
          "Doctor consultation and a personal action plan",
        ],
      },
      price: { is: "49.990 kr.", en: "49,990 ISK" },
      cta: { is: "Opna sjúklingagátt", en: "Open patient portal" },
      href: PORTAL_URL,
      qrUrl: PORTAL_URL,
    },
    {
      key: "coaching",
      enabled: true,
      badge: { is: "ÞJÁLFUN", en: "COACHING" },
      title: { is: "Áframhaldandi heilsuþjálfun", en: "Ongoing health coaching" },
      desc: {
        is: "Persónuleg þjálfun sem heldur utan um svefn, næringu, hreyfingu og andlega líðan — með daglegum skrefum og eftirfylgni.",
        en: "Personal coaching across sleep, nutrition, movement and mental wellbeing — with daily steps and follow-up.",
      },
      bullets: {
        is: [
          "Dagleg skref sniðin að þér",
          "Áhersla á svefn, næringu, hreyfingu og andlega líðan",
          "Eftirfylgni og stuðningur frá þjálfara",
        ],
        en: [
          "Daily steps tailored to you",
          "Focus on sleep, nutrition, movement and mental wellbeing",
          "Follow-up and support from a coach",
        ],
      },
      cta: { is: "Sjá þjálfun", en: "Explore coaching" },
      href: "/coaching",
    },
    {
      key: "workplace",
      enabled: true,
      badge: { is: "FYRIRTÆKI", en: "FOR TEAMS" },
      title: { is: "Heilsumat fyrir vinnustaði", en: "Health checks for your team" },
      desc: {
        is: "Gefðu starfsfólkinu skýra mynd af heilsu sinni — mælingar, blóðprufur og læknisyfirferð á einum stað.",
        en: "Give your people a clear picture of their health — measurements, bloodwork and doctor review in one place.",
      },
      bullets: {
        is: [
          "Mælingar á staðnum á um 5 mínútum",
          "Markviss efnaskiptablóðprufa",
          "Læknisyfirferð og aðgerðaáætlun fyrir hvern og einn",
        ],
        en: [
          "On-site measurements in about 5 minutes",
          "Targeted metabolic blood panel",
          "Doctor review and an action plan for each person",
        ],
      },
      price: { is: "Verð sniðið að teyminu", en: "Pricing tailored to your team" },
      cta: { is: "Hafðu samband", en: "Get in touch" },
      href: "/business",
    },
  ],
};

const str = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
const loc = (v: unknown): L => {
  const o = (v ?? {}) as Record<string, unknown>;
  return { is: str(o.is), en: str(o.en) };
};
const locArr = (v: unknown): { is: string[]; en: string[] } => {
  const o = (v ?? {}) as Record<string, unknown>;
  const arr = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);
  return { is: arr(o.is), en: arr(o.en) };
};

/** Coerce a stored (possibly partial / legacy) blob into valid content.
 *  Returns the built-in defaults when nothing is stored yet. */
export function mergeWhatsNew(stored: unknown): WhatsNewContent {
  const s = (stored ?? {}) as Record<string, unknown>;
  if (!Array.isArray(s.cards)) return DEFAULT_WHATS_NEW;
  const cards = (s.cards as unknown[]).map((raw, i): WhatsNewCard => {
    const c = (raw ?? {}) as Record<string, unknown>;
    return {
      key: str(c.key, `card-${i}`),
      enabled: c.enabled !== false,
      badge: loc(c.badge),
      partner: c.partner ? loc(c.partner) : undefined,
      title: loc(c.title),
      desc: loc(c.desc),
      bullets: locArr(c.bullets),
      price: c.price ? loc(c.price) : undefined,
      cta: loc(c.cta),
      href: str(c.href, "#"),
      qrUrl: c.qrUrl ? str(c.qrUrl) : undefined,
    };
  });
  return { cards };
}

/** A blank card for the "add card" action in the editor. */
export function blankCard(): WhatsNewCard {
  return {
    key: `card-${Date.now().toString(36)}`,
    enabled: true,
    badge: { is: "NÝTT", en: "NEW" },
    title: { is: "", en: "" },
    desc: { is: "", en: "" },
    bullets: { is: [], en: [] },
    cta: { is: "Skoða", en: "Learn more" },
    href: "/",
  };
}
