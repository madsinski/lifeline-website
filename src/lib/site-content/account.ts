// CMS model for the client account home (/account).
//
// Today it holds one thing: the promo card at the top of the dashboard (the
// Lyfja health-check offer it shipped with). The card is OFF unless an admin
// sets "Sýna spjaldið" to Já in /admin/website → Aðgangur, so a stale offer
// can never sit on a customer's dashboard by default.

import type { SiteField, SiteSection, LocaleContent } from "./types";

// No reorderable bands — the dashboard's own layout owns the order.
export const ACCOUNT_SECTIONS: SiteSection[] = [];

const G_PROMO = "Kynningarspjald á forsíðu aðgangs";

export const ACCOUNT_FIELDS: SiteField[] = [
  {
    key: "promo_enabled", label: "Sýna spjaldið", group: G_PROMO, type: "select",
    help: "Nei = ekkert spjald á forsíðu aðgangsins. Breytingin birtist þegar þú ýtir á „Birta“.",
    options: [{ value: "no", label: "Nei" }, { value: "yes", label: "Já" }],
  },
  { key: "promo_badge", label: "Merki (lítið)", group: G_PROMO, type: "text" },
  { key: "promo_partner", label: "Samstarfsaðili", group: G_PROMO, type: "text" },
  { key: "promo_title", label: "Fyrirsögn", group: G_PROMO, type: "text" },
  { key: "promo_desc", label: "Texti", group: G_PROMO, type: "textarea" },
  { key: "promo_items", label: "Punktar", group: G_PROMO, type: "textarea", help: "Ein lína á punkt." },
  { key: "promo_price", label: "Verð", group: G_PROMO, type: "text", help: "Skildu eftir autt til að fela verðið." },
  { key: "promo_cta", label: "Hnappur — texti", group: G_PROMO, type: "text" },
  { key: "promo_cta_url", label: "Hnappur — hlekkur", group: G_PROMO, type: "link" },
  {
    key: "promo_qr", label: "QR-kóði", group: G_PROMO, type: "select",
    help: "Sýnir QR fyrir sama hlekk svo hægt sé að opna í síma.",
    options: [{ value: "yes", label: "Já" }, { value: "no", label: "Nei" }],
  },
  { key: "promo_qr_caption", label: "QR — skýring", group: G_PROMO, type: "text" },
];

const PORTAL_URL = "https://app.medalia.is/7ca0ca21-8947-46cb-afbd-2e2d15efef6e";

export const ACCOUNT_DEFAULTS_IS: LocaleContent = {
  promo_enabled: "no",
  promo_badge: "NÝTT",
  promo_partner: "Í samstarfi við Lyfju",
  promo_title: "Heilsufarsskoðun Lifeline hjá Lyfju",
  promo_desc: "Heildræn kortlagning á heilsu þinni með sérstakri áherslu á svefn, hreyfingu, næringu og andlega líðan.",
  promo_items: [
    "Heildrænn heilsuspurningalisti",
    "Mælingar á mælistöð Lyfju í Smáratorgi — blóðþrýstingur og líkamssamsetning",
    "Efnaskiptatengd blóðprufa hjá Sameind",
    "Ítarleg skýrsla með niðurstöðum úr öllum þáttum",
    "20 mínútna viðtal við lækni og persónuleg aðgerðaáætlun",
  ].join("\n"),
  promo_price: "49.990 kr.",
  promo_cta: "Panta heilsufarsskoðun",
  promo_cta_url: PORTAL_URL,
  promo_qr: "yes",
  promo_qr_caption: "Skannaðu til að opna í símanum",
};

export const ACCOUNT_DEFAULTS_EN: LocaleContent = {
  promo_enabled: "no",
  promo_badge: "NEW",
  promo_partner: "In partnership with Lyfja",
  promo_title: "Lifeline Health Check at Lyfja",
  promo_desc: "A holistic mapping of your health, with special focus on sleep, exercise, nutrition and mental wellness.",
  promo_items: [
    "Holistic health questionnaire",
    "Measurements at the Lyfja station in Smáratorg — blood pressure and body composition",
    "Metabolic blood panel at Sameind",
    "A detailed report covering every part of the check",
    "20-minute doctor consultation and a personal action plan",
  ].join("\n"),
  promo_price: "49,990 ISK",
  promo_cta: "Book a health check",
  promo_cta_url: PORTAL_URL,
  promo_qr: "yes",
  promo_qr_caption: "Scan to open on your phone",
};
