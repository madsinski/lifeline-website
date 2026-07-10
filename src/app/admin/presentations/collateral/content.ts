// Editable content model for the Fjarlækningar × HSU print collateral. The three
// A4 documents (docs.tsx) render purely from a CollateralContent object; the
// studio (page.tsx) edits it and persists it to a single-row Supabase table via
// /api/admin/presentations/collateral. DEFAULT_CONTENT reproduces the original
// hardcoded copy and is the fallback for any field missing from a stored row.

export type Step = { title: string; body: string };
export type Service = { icon: string; label: string };
export type Safety = { bold: string; text: string };
export type AfterItem = { k: string; bold: string; text: string };
// Editable display name + tagline for each printable (shown on the document
// tabs in the studio/viewer, not on the printed A4).
export type DocMeta = { name: string; sub: string };

export type CollateralContent = {
  // Tab names/taglines for the three printables.
  docMeta: { poster: DocMeta; referral: DocMeta; advert: DocMeta };
  services: Service[];
  poster: {
    badge: string;
    eyebrow: string;
    // Free-form heading. Wrap words in ==double equals== to colour them blue;
    // use line breaks for multiple lines. Everything else renders white.
    heading: string;
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
  docMeta: {
    poster: { name: "Veggspjald", sub: "Fyrir móttöku HSU — fyrir sjúklinga" },
    referral: { name: "Tilvísunarleiðbeiningar", sub: "A4 — fyrir heilbrigðisstarfsfólk" },
    advert: { name: "Blaðaauglýsing", sub: "A4 — dagblaðsauglýsing" },
  },
  // Concise portal labels for the nine-tile grid; wording aligned to the
  // team-reviewed HSN presentation.
  services: [
    { icon: "kvef-hosti-halsbolga", label: "Kvef, hósti og hálsbólga" },
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
    eyebrow: "Íslensk fjarlækningaþjónusta",
    heading: "Þarftu að hitta lækni?\nÞú getur gert það ==þar sem þú ert.==",
    lead: "Fjarlækningar leysa einföld og afmörkuð erindi. Þú svarar stuttum spurningalista og læknir metur málið og leggur til meðferð — sama þjónusta og á læknastofu, en skilvirkari leið og styttri biðlistar.",
    servicesTitle: "Við getum meðal annars aðstoðað með:",
    stepsTitle: "Svona virkar það",
    steps: [
      { title: "Skráðu þig inn", body: "Á fjarlaekningar.is með rafrænum skilríkjum — í tölvu eða síma." },
      { title: "Veldu vandamál", body: "Svaraðu markvissum spurningalista um einkennin þín." },
      { title: "Fáðu meðferð", body: "Læknir metur og leggur til meðferð. Lyfseðill fer rafrænt í lyfjagátt." },
    ],
    ctaLabel: "Byrjaðu hér",
    url: "fjarlaekningar.is",
    footerNote: "Svar innan tveggja klukkustunda á opnunartíma, alla daga milli 10 og 22.",
    safety: { bold: "Neyðartilfelli?", text: " Hringdu í 112 eða leitaðu á bráðamóttöku." },
  },
  referral: {
    badge: "Innanhússleiðbeiningar",
    eyebrow: "Fyrir heilbrigðisstarfsfólk HSU",
    heading: "Að vísa sjúklingi í ",
    headingAccent: "Fjarlækningar",
    intro: "Fjarlækningar er íslensk fjarlækningaþjónusta fyrir einföld og afmörkuð erindi, nú í tilraunasamstarfi til eins árs við Heilbrigðisstofnun Suðurlands. Sjúklingur svarar spurningalista sem sérhannaður er í samstarfi við íslenska sérfræðilækna, og læknir metur svörin og leggur til meðferð. Þjónustan léttir álagi af móttöku fyrir væg, algeng erindi og styttir biðlista.",
    yesTitle: "Hentar vel fyrir",
    yes: [
      "Kvef, hósti og hálsbólga",
      "Þvagfærasýkingar",
      "Sveppa- og bakteríusýkingar í leggöngum",
      "Frjókornaofnæmi",
      "Frunsa",
      "Ristill á húð",
      "Getnaðarvörn",
      "Njálgur",
      "Risvandamál",
      "Lyfjaendurnýjun",
      "Læknisvottorð tengt sinntu vandamáli",
    ],
    noTitle: "Vísaðu ekki í fjarþjónustu",
    no: [
      "Bráð eða alvarleg einkenni — hringdu í 112 eða Læknavaktina 1700",
      "Erindi sem krefjast skoðunar eða áþreifingar",
      "Frumgreining nýrra vandamála (metin og vísað í annan farveg)",
      "Ung börn og flókin fjölveikindi",
      "Óstöðugir langvinnir sjúkdómar",
    ],
    referTitle: "Hvernig þú vísar sjúklingi",
    referSteps: [
      { title: "Beindu á gáttina", body: "Bentu sjúklingi á fjarlaekningar.is — innskráning með rafrænum skilríkjum." },
      { title: "Sjúklingur velur erindi", body: "Velur vandamál af lista og svarar markvissum spurningalista um einkennin." },
      { title: "Læknir lýkur máli", body: "Fer yfir svörin, leggur til meðferð og gefur vottorð eða tilvísun eftir þörfum." },
    ],
    afterTitle: "Hvað gerist svo",
    after: [
      { k: "⏱", bold: "Innan tveggja klukkustunda.", text: " Læknir svarar erindum á opnunartíma, alla daga milli 10 og 22." },
      { k: "Rx", bold: "Lyfseðill fer rafrænt í lyfjagátt", text: " og er tilbúinn í því apóteki sem sjúklingur velur." },
      { k: "↩︎", bold: "Tilvísun til baka.", text: " Þurfi sjúklingur skoðun eða frekari rannsókn vísar læknir aftur í hefðbundna þjónustu HSU." },
      { k: "🔒", bold: "Öruggt.", text: " Öll samskipti fara um sjúklingagátt Medalia — dulkóðuð og eingöngu aðgengileg sjúklingi og lækni." },
    ],
    safety: { bold: "Neyðartilfelli:", text: " Fjarlækningar eru ekki fyrir bráðaþjónustu. Hringdu í 112 eða Læknavaktina 1700." },
    contactLabel: "Spurningar?",
    contactEmail: "info@fjarlaekningar.is",
  },
  advert: {
    badge: "Ný þjónusta á Íslandi",
    headingA: "Læknishjálp —",
    headingAccent: "þar sem þú ert.",
    lead: "Þú svarar stuttum spurningalista og læknir metur málið og leggur til meðferð. Sama þjónusta og á læknastofu — svar innan tveggja klukkustunda á opnunartíma, án biðstofu og biðlista.",
    servicesTitle: "Við aðstoðum meðal annars með",
    steps: [
      { title: "Skráðu þig inn", body: "Með rafrænum skilríkjum á fjarlaekningar.is." },
      { title: "Veldu vandamál", body: "Svaraðu markvissum spurningalista um einkennin." },
      { title: "Fáðu meðferð", body: "Læknir leggur til meðferð; lyfseðill fer rafrænt í lyfjagátt." },
    ],
    ctaLabel: "Byrjaðu í dag",
    url: "fjarlaekningar.is",
    partnerNote: "Í tilraunasamstarfi til eins árs við Heilbrigðisstofnun Suðurlands (HSU).",
    safety: { bold: "Neyðartilfelli:", text: " Hringdu í 112. Fjarlækningar eru ekki ætlaðar fyrir bráðaþjónustu." },
  },
};

// Merge a stored (possibly partial / older-schema) content object over defaults
// so every field always resolves to a value. Arrays are taken wholesale from the
// stored object when present.
export function mergeContent(stored: unknown): CollateralContent {
  const s = (stored ?? {}) as Partial<CollateralContent>;
  const dm = (s.docMeta ?? {}) as Partial<CollateralContent["docMeta"]>;
  return {
    docMeta: {
      poster: { ...DEFAULT_CONTENT.docMeta.poster, ...(dm.poster ?? {}) },
      referral: { ...DEFAULT_CONTENT.docMeta.referral, ...(dm.referral ?? {}) },
      advert: { ...DEFAULT_CONTENT.docMeta.advert, ...(dm.advert ?? {}) },
    },
    services: Array.isArray(s.services) && s.services.length ? s.services : DEFAULT_CONTENT.services,
    poster: { ...DEFAULT_CONTENT.poster, ...(s.poster ?? {}) },
    referral: { ...DEFAULT_CONTENT.referral, ...(s.referral ?? {}) },
    advert: { ...DEFAULT_CONTENT.advert, ...(s.advert ?? {}) },
  };
}
