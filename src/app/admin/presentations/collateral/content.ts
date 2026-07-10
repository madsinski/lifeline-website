// Editable content model for the Fjarlækningar × HSU print collateral.
//
// The collateral is a DYNAMIC LIST of A4 documents (docs.tsx renders each from
// its fields). Each document has a layout `type` (poster / referral / advert),
// an editable tab name + tagline, and per-document sharing (web address +
// Medalia portal link; the QR encodes the portal link). Documents can be
// duplicated, deleted and reordered in the studio (page.tsx / CollateralStudio).
// Persisted as one JSONB blob in a single-row Supabase table.

export type Step = { title: string; body: string };
export type Service = { icon: string; label: string };
export type Safety = { bold: string; text: string };
export type AfterItem = { k: string; bold: string; text: string; icon?: string };

export type DocType = "poster" | "referral" | "advert";

export const MEDALIA_PORTAL_URL =
  "https://app.medalia.dev/0b9e8a71-34dc-4354-bf79-03826914bcce";

export type PosterFields = {
  badge: string;
  eyebrow: string;
  // Free-form heading: ==double equals== colours words blue; newlines break lines.
  heading: string;
  lead: string;
  servicesTitle: string;
  services: Service[];
  stepsTitle: string;
  steps: Step[];
  ctaLabel: string;
  url: string;
  portalUrl: string;
  footerNote: string;
  safety: Safety;
};

export type ReferralFields = {
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
  shareTitle: string;
  url: string;
  portalUrl: string;
  safety: Safety;
  contactLabel: string;
  contactEmail: string;
};

export type AdvertFields = {
  badge: string;
  headingA: string;
  headingAccent: string;
  lead: string;
  servicesTitle: string;
  services: Service[];
  steps: Step[];
  ctaLabel: string;
  url: string;
  portalUrl: string;
  partnerNote: string;
  safety: Safety;
};

export type Doc =
  | { id: string; type: "poster"; name: string; sub: string; poster: PosterFields }
  | { id: string; type: "referral"; name: string; sub: string; referral: ReferralFields }
  | { id: string; type: "advert"; name: string; sub: string; advert: AdvertFields };

export type CollateralContent = { docs: Doc[] };

// The nine services from the Medalia menu „Hvernig getum við aðstoðað þig?“.
// `icon` maps to /public/fjarlaekningar-icons/portal/<icon>.png — the fixed set.
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

const DEFAULT_SERVICES: Service[] = [
  { icon: "kvef-hosti-halsbolga", label: "Kvef, hósti og hálsbólga" },
  { icon: "thvagfaera-leggangasykingar", label: "Þvagfæra- og leggangasýkingar" },
  { icon: "getnadarvorn", label: "Getnaðarvörn" },
  { icon: "frjokornaofnaemi", label: "Frjókornaofnæmi" },
  { icon: "frunsa", label: "Frunsa" },
  { icon: "ristill", label: "Ristill" },
  { icon: "risvandamal", label: "Risvandamál" },
  { icon: "njalgur", label: "Njálgur" },
  { icon: "lyfjuendurnyjun", label: "Lyfjaendurnýjun" },
];

// ── Default field sets (team-reviewed HSN presentation language) ──────────
export const DEFAULT_POSTER: PosterFields = {
  badge: "Í samstarfi við HSU",
  eyebrow: "Íslensk fjarlækningaþjónusta",
  heading: "Þarftu að hitta lækni?\nÞú getur gert það ==þar sem þú ert.==",
  lead: "Fjarlækningar leysa einföld og afmörkuð erindi. Þú svarar stuttum spurningalista og læknir metur málið og leggur til meðferð — sama þjónusta og á læknastofu, en skilvirkari leið og styttri biðlistar.",
  servicesTitle: "Við getum meðal annars aðstoðað með:",
  services: DEFAULT_SERVICES,
  stepsTitle: "Svona virkar það",
  steps: [
    { title: "Skráðu þig inn", body: "Á fjarlaekningar.is með rafrænum skilríkjum — í tölvu eða síma." },
    { title: "Veldu vandamál", body: "Svaraðu markvissum spurningalista um einkennin þín." },
    { title: "Fáðu meðferð", body: "Læknir metur og leggur til meðferð. Lyfseðill fer rafrænt í lyfjagátt." },
  ],
  ctaLabel: "Byrjaðu hér",
  url: "fjarlaekningar.is",
  portalUrl: MEDALIA_PORTAL_URL,
  footerNote: "Svar innan tveggja klukkustunda á opnunartíma, alla daga milli 10 og 22.",
  safety: { bold: "Neyðartilfelli?", text: " Hringdu í 112 eða leitaðu á bráðamóttöku." },
};

export const DEFAULT_REFERRAL: ReferralFields = {
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
    { k: "2h", icon: "clock", bold: "Innan tveggja klukkustunda.", text: " Læknir svarar erindum á opnunartíma, alla daga milli 10 og 22." },
    { k: "Rx", icon: "pill", bold: "Lyfseðill fer rafrænt í lyfjagátt", text: " og er tilbúinn í því apóteki sem sjúklingur velur." },
    { k: "←", icon: "undo", bold: "Tilvísun til baka.", text: " Þurfi sjúklingur skoðun eða frekari rannsókn vísar læknir aftur í hefðbundna þjónustu HSU." },
    { k: "lás", icon: "lock", bold: "Öruggt.", text: " Öll samskipti fara um sjúklingagátt Medalia — dulkóðuð og eingöngu aðgengileg sjúklingi og lækni." },
  ],
  shareTitle: "Þrjár leiðir til að deila þjónustunni með sjúklingi",
  url: "fjarlaekningar.is",
  portalUrl: MEDALIA_PORTAL_URL,
  safety: { bold: "Neyðartilfelli:", text: " Fjarlækningar eru ekki fyrir bráðaþjónustu. Hringdu í 112 eða Læknavaktina 1700." },
  contactLabel: "Spurningar?",
  contactEmail: "info@fjarlaekningar.is",
};

export const DEFAULT_ADVERT: AdvertFields = {
  badge: "Ný þjónusta á Íslandi",
  headingA: "Læknishjálp —",
  headingAccent: "þar sem þú ert.",
  lead: "Þú svarar stuttum spurningalista og læknir metur málið og leggur til meðferð. Sama þjónusta og á læknastofu — svar innan tveggja klukkustunda á opnunartíma, án biðstofu og biðlista.",
  servicesTitle: "Við aðstoðum meðal annars með",
  services: DEFAULT_SERVICES,
  steps: [
    { title: "Skráðu þig inn", body: "Með rafrænum skilríkjum á fjarlaekningar.is." },
    { title: "Veldu vandamál", body: "Svaraðu markvissum spurningalista um einkennin." },
    { title: "Fáðu meðferð", body: "Læknir leggur til meðferð; lyfseðill fer rafrænt í lyfjagátt." },
  ],
  ctaLabel: "Byrjaðu í dag",
  url: "fjarlaekningar.is",
  portalUrl: MEDALIA_PORTAL_URL,
  partnerNote: "Í tilraunasamstarfi til eins árs við Heilbrigðisstofnun Suðurlands (HSU).",
  safety: { bold: "Neyðartilfelli:", text: " Hringdu í 112. Fjarlækningar eru ekki ætlaðar fyrir bráðaþjónustu." },
};

export const DEFAULT_CONTENT: CollateralContent = {
  docs: [
    { id: "poster", type: "poster", name: "Veggspjald", sub: "Fyrir móttöku HSU — fyrir sjúklinga", poster: DEFAULT_POSTER },
    { id: "referral", type: "referral", name: "Tilvísunarleiðbeiningar", sub: "A4 — fyrir heilbrigðisstarfsfólk", referral: DEFAULT_REFERRAL },
    { id: "advert", type: "advert", name: "Blaðaauglýsing", sub: "A4 — dagblaðsauglýsing", advert: DEFAULT_ADVERT },
  ],
};

// Return the default field set for a document layout type (used when adding a
// new document in the studio).
export function defaultDoc(type: DocType, id: string): Doc {
  if (type === "poster") return { id, type, name: "Veggspjald", sub: "A4", poster: DEFAULT_POSTER };
  if (type === "referral") return { id, type, name: "Tilvísunarleiðbeiningar", sub: "A4", referral: DEFAULT_REFERRAL };
  return { id, type, name: "Blaðaauglýsing", sub: "A4", advert: DEFAULT_ADVERT };
}

// Coerce a stored (possibly partial / legacy) blob into a valid CollateralContent.
// Understands both the new { docs: [...] } shape and the legacy
// { poster, referral, advert, docMeta, services } shape.
export function mergeContent(stored: unknown): CollateralContent {
  const s = (stored ?? {}) as Record<string, unknown>;

  if (Array.isArray(s.docs) && s.docs.length) {
    const docs = (s.docs as unknown[])
      .map((d, i) => coerceDoc(d, i))
      .filter((d): d is Doc => d !== null);
    if (docs.length) return { docs };
  }

  // Legacy single-of-each shape → three docs.
  if (s.poster || s.referral || s.advert) {
    const dm = (s.docMeta ?? {}) as Record<string, { name?: string; sub?: string }>;
    const services = Array.isArray(s.services) && s.services.length ? (s.services as Service[]) : DEFAULT_SERVICES;
    return {
      docs: [
        { id: "poster", type: "poster", name: dm.poster?.name ?? "Veggspjald", sub: dm.poster?.sub ?? "", poster: { ...DEFAULT_POSTER, ...(s.poster as object ?? {}), services } },
        { id: "referral", type: "referral", name: dm.referral?.name ?? "Tilvísunarleiðbeiningar", sub: dm.referral?.sub ?? "", referral: { ...DEFAULT_REFERRAL, ...(s.referral as object ?? {}) } },
        { id: "advert", type: "advert", name: dm.advert?.name ?? "Blaðaauglýsing", sub: dm.advert?.sub ?? "", advert: { ...DEFAULT_ADVERT, ...(s.advert as object ?? {}), services } },
      ],
    };
  }

  return DEFAULT_CONTENT;
}

function coerceDoc(raw: unknown, i: number): Doc | null {
  const d = (raw ?? {}) as Record<string, unknown>;
  const type = d.type as DocType;
  const id = typeof d.id === "string" && d.id ? d.id : `doc-${i}`;
  const name = typeof d.name === "string" ? d.name : "";
  const sub = typeof d.sub === "string" ? d.sub : "";
  if (type === "poster") return { id, type, name: name || "Veggspjald", sub, poster: { ...DEFAULT_POSTER, ...(d.poster as object ?? {}) } };
  if (type === "referral") return { id, type, name: name || "Tilvísunarleiðbeiningar", sub, referral: { ...DEFAULT_REFERRAL, ...(d.referral as object ?? {}) } };
  if (type === "advert") return { id, type, name: name || "Blaðaauglýsing", sub, advert: { ...DEFAULT_ADVERT, ...(d.advert as object ?? {}) } };
  return null;
}
