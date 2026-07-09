// Editable content model for the Fjarlækningar × HSU print collateral. The three
// A4 documents (docs.tsx) render purely from a CollateralContent object; the
// studio (page.tsx) edits it and persists it to a single-row Supabase table via
// /api/admin/presentations/collateral. DEFAULT_CONTENT reproduces the original
// hardcoded copy and is the fallback for any field missing from a stored row.

export type Step = { title: string; body: string };
export type Service = { icon: string; label: string };
export type Safety = { bold: string; text: string };
export type AfterItem = { k: string; bold: string; text: string };

export type CollateralContent = {
  services: Service[];
  poster: {
    badge: string;
    eyebrow: string;
    headingA: string;
    headingB: string;
    headingAccent: string;
    lead: string;
    servicesTitle: string;
    stepsTitle: string;
    steps: Step[];
    ctaLabel: string;
    url: string;
    footerNote: string;
    safety: Safety;
  };
  referral: {
    badge: string;
    eyebrow: string;
    heading: string;
    headingAccent: string;
    intro: string;
    yesTitle: string;
    yes: string[];
    noTitle: string;
    no: string[];
    referTitle: string;
    referSteps: Step[];
    afterTitle: string;
    after: AfterItem[];
    safety: Safety;
    contactLabel: string;
    contactEmail: string;
  };
  advert: {
    badge: string;
    headingA: string;
    headingAccent: string;
    lead: string;
    servicesTitle: string;
    steps: Step[];
    ctaLabel: string;
    url: string;
    partnerNote: string;
    safety: Safety;
  };
};

// The nine services from the Medalia menu „Hvernig getum við aðstoðað þig?“.
// `icon` maps to /public/fjarlaekningar-icons/<icon>.tile.svg — the fixed set.
export const SERVICE_ICONS = [
  "kvef-hosti-halsbolga",
  "thvagfaera-leggangasykingar",
  "frunsa",
  "ristill",
  "frjokornaofnaemi",
  "getnadarvorn",
  "risvandamal",
  "njalgur",
  "lyfjuendurnyjun",
] as const;

export const DEFAULT_CONTENT: CollateralContent = {
  // Order + labels match the live Medalia patient portal exactly.
  services: [
    { icon: "kvef-hosti-halsbolga", label: "Kvef, hósti eða hálsbólga" },
    { icon: "thvagfaera-leggangasykingar", label: "Þvagfæra- og leggangasýkingar" },
    { icon: "getnadarvorn", label: "Getnaðarvörn" },
    { icon: "frjokornaofnaemi", label: "Frjókornaofnæmi" },
    { icon: "frunsa", label: "Frunsa" },
    { icon: "ristill", label: "Ristill" },
    { icon: "risvandamal", label: "Risvandamál" },
    { icon: "njalgur", label: "Njálgur" },
    { icon: "lyfjuendurnyjun", label: "Lyfjaendurnýjun" },
  ],
  poster: {
    badge: "Í samstarfi við HSU",
    eyebrow: "Fjarlæknaþjónusta",
    headingA: "Þarftu að hitta lækni?",
    headingB: "Þú getur gert það",
    headingAccent: "heiman frá þér.",
    lead: "Fjarlækningar er íslensk fjarlæknaþjónusta. Þú velur vandamálið, svarar stuttum spurningalista og læknir metur málið og ávísar réttri meðferð — án þess að þú þurfir að mæta.",
    servicesTitle: "Við getum meðal annars aðstoðað með:",
    stepsTitle: "Svona virkar það",
    steps: [
      { title: "Skráðu þig inn", body: "Á fjarlaekningar.is með rafrænum skilríkjum — í tölvu eða síma." },
      { title: "Veldu vandamál", body: "Svaraðu stuttum spurningalista um einkennin þín." },
      { title: "Fáðu meðferð", body: "Læknir metur og ávísar meðferð. Lyfseðill fer beint í apótek." },
    ],
    ctaLabel: "Byrjaðu hér",
    url: "fjarlaekningar.is",
    footerNote: "Lyfseðill sendur rafrænt í það apótek sem þú velur.",
    safety: { bold: "Neyðartilfelli?", text: " Hringdu í 112 eða leitaðu á bráðamóttöku." },
  },
  referral: {
    badge: "Innanhússleiðbeiningar",
    eyebrow: "Fyrir heilbrigðisstarfsfólk HSU",
    heading: "Að vísa sjúklingi í ",
    headingAccent: "Fjarlækningar",
    intro: "Fjarlækningar er íslensk fjarlæknaþjónusta fyrir almenna heilsugæslu, nú í tilraunasamstarfi við Heilbrigðisstofnun Suðurlands. Sjúklingur velur afmarkað vandamál, svarar spurningalista og læknir metur og ávísar meðferð. Þjónustan léttir álagi af móttöku fyrir væg, algeng erindi.",
    yesTitle: "Hentar vel fyrir",
    yes: [
      "Kvef, hósti eða hálsbólga",
      "Þvagfæra- og leggangasýkingar",
      "Getnaðarvörn",
      "Frjókornaofnæmi",
      "Frunsa",
      "Ristill",
      "Risvandamál",
      "Njálgur",
      "Lyfjaendurnýjun",
    ],
    noTitle: "Vísaðu ekki í fjarþjónustu",
    no: [
      "Bráð eða alvarleg einkenni — hringdu í 112",
      "Erindi sem krefjast skoðunar eða áþreifingar",
      "Ung börn og flókin fjölveikindi",
      "Óstöðugir langvinnir sjúkdómar",
      "Grunur um alvarlega undirliggjandi orsök",
    ],
    referTitle: "Hvernig þú vísar sjúklingi",
    referSteps: [
      { title: "Beindu á gáttina", body: "Bentu sjúklingi á fjarlaekningar.is — innskráning með rafrænum skilríkjum." },
      { title: "Sjúklingur velur erindi", body: "Velur vandamál og svarar spurningalista um einkennin." },
      { title: "Læknir lýkur máli", body: "Metur svörin, ávísar meðferð og gefur vottorð eða tilvísun eftir þörfum." },
    ],
    afterTitle: "Hvað gerist svo",
    after: [
      { k: "Rx", bold: "Lyfseðill fer rafrænt í lyfjagátt", text: " og er tilbúinn í því apóteki sem sjúklingur velur." },
      { k: "↩︎", bold: "Tilvísun til baka.", text: " Þurfi sjúklingur skoðun eða frekari rannsókn vísar læknir aftur í hefðbundna þjónustu HSU." },
      { k: "🔒", bold: "Öruggt.", text: " Öll samskipti fara um sjúklingagátt Medalia — dulkóðuð og eingöngu aðgengileg sjúklingi og lækni." },
    ],
    safety: { bold: "Neyðartilfelli:", text: " Fjarlækningar eru ekki fyrir bráðaþjónustu. Hringdu í 112." },
    contactLabel: "Spurningar?",
    contactEmail: "info@fjarlaekningar.is",
  },
  advert: {
    badge: "Ný þjónusta á Íslandi",
    headingA: "Læknishjálp —",
    headingAccent: "heiman frá þér.",
    lead: "Veldu vandamálið, svaraðu stuttum spurningalista og læknir ávísar réttri meðferð. Engin biðstofa, engin bið — læknir Fjarlækninga metur málið samdægurs.",
    servicesTitle: "Við aðstoðum meðal annars með",
    steps: [
      { title: "Skráðu þig inn", body: "Með rafrænum skilríkjum á fjarlaekningar.is." },
      { title: "Veldu vandamál", body: "Svaraðu spurningalista um einkennin." },
      { title: "Fáðu meðferð", body: "Læknir ávísar; lyfseðill fer beint í apótek." },
    ],
    ctaLabel: "Byrjaðu í dag",
    url: "fjarlaekningar.is",
    partnerNote: "Í tilraunasamstarfi við Heilbrigðisstofnun Suðurlands (HSU).",
    safety: { bold: "Neyðartilfelli:", text: " Hringdu í 112. Fjarlækningar eru ekki ætlaðar fyrir bráðaþjónustu." },
  },
};

// Merge a stored (possibly partial / older-schema) content object over defaults
// so every field always resolves to a value. Arrays are taken wholesale from the
// stored object when present.
export function mergeContent(stored: unknown): CollateralContent {
  const s = (stored ?? {}) as Partial<CollateralContent>;
  return {
    services: Array.isArray(s.services) && s.services.length ? s.services : DEFAULT_CONTENT.services,
    poster: { ...DEFAULT_CONTENT.poster, ...(s.poster ?? {}) },
    referral: { ...DEFAULT_CONTENT.referral, ...(s.referral ?? {}) },
    advert: { ...DEFAULT_CONTENT.advert, ...(s.advert ?? {}) },
  };
}
