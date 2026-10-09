// What a given kind of training actually loads, where it tends to go wrong,
// and what people usually do about it.
//
// WHAT THIS IS AND IS NOT
//
// It is descriptive: published injury epidemiology for the activity, and the
// warm-up practices used in that sport. It names its sources and its figures
// so a reader can check them.
//
// It is NOT a diagnosis, a treatment or a promise of prevention. Lifeline
// copy may describe and measure risk; it may not claim to prevent or treat
// (EU MDR). So the wording is "most commonly reported" and "commonly used",
// never "this protects you from". Where the evidence for prevention is
// genuinely weak — resistance-training warm-ups are the clear case — the
// entry says so rather than implying more than the literature supports.
//
// Figures are injury-site shares from the cited reviews. They describe
// populations, not the reader.

export interface ModalityGuide {
  /** What the session is training, in one phrase. */
  trains: string;
  /** The physiological label people recognise — HIIT, styrkur, zone 2. */
  tag: string;
  /** Loaded hardest, for the person's own awareness. */
  loads: string[];
  /** Most commonly reported injury sites, with the number and its source. */
  common: { area: string; note: string }[];
  /** What is normally done before and after. */
  warmup: string[];
  cooldown: string[];
  /** Honest statement of how good the evidence is. */
  evidence: string;
  sources: { label: string; url: string }[];
}

const FOOTBALL: ModalityGuide = {
  trains: "Sprettir, stefnubreytingar og þol í leik",
  tag: "HIIT / þrek",
  loads: ["Ökklar", "Aftanlæri", "Nárar", "Hné"],
  common: [
    { area: "Ökkli", note: "Algengasti meiðslastaðurinn í innanhússfótbolta — tognun á liðböndum um 10–11% tilfella." },
    { area: "Nárar", note: "Um 8% tilfella hjá áhugafólki og allt að 19% hjá afreksfólki." },
    { area: "Aftanlæri og læri", note: "Lærið er næstalgengast (um 20% hjá konum); tognanir eru algengastar." },
  ],
  warmup: [
    "FIFA 11+ eða sambærileg upphitun — hlaup, jafnvægi, styrkur, sprettir (15–20 mín)",
    "Jafnvægisæfingar á einum fæti fyrir ökklann",
    "Nordic hamstring fyrir aftanlærið",
    "Copenhagen adduction fyrir nárann",
  ],
  cooldown: ["Rólegt skokk niður", "Teygjur á nárum, aftanlæri og kálfum"],
  evidence:
    "FIFA 11+ dró marktækt úr meiðslum í neðri útlimum í slembiraðaðri rannsókn (OR 0,72). Áhrifin á ökkla og nára eru minna staðfest, og flestar rannsóknir eru á útifótbolta frekar en innanhúss.",
  sources: [
    { label: "Futsal injuries: a 7-season study", url: "https://www.sciencedirect.com/science/article/pii/S277269672300008X" },
    { label: "Injury prevention strategies for futsal players (systematic review)", url: "https://www.mdpi.com/2227-9032/12/14/1387" },
    { label: "FIFA 11+ cluster-randomised trial", url: "https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0251839" },
  ],
};

const CROSSFIT: ModalityGuide = {
  trains: "Blandað þol og styrkur á hárri ákefð",
  tag: "HIIT + styrkur",
  loads: ["Axlir", "Mjóbak", "Hné"],
  common: [
    { area: "Öxl", note: "21–26% tilfella. Tengt fimleikahreyfingum — kipping pull-ups, hringjum, muscle-ups." },
    { area: "Mjóbak", note: "18–27% tilfella. Tengt þungum lyftum — hnébeygju og réttstöðulyftu." },
    { area: "Hné", note: "13–16% tilfella." },
  ],
  warmup: [
    "Axlarhringir og bandaæfingar fyrir axlarbeltið",
    "Mjaðma- og brjóstbaksliðkun fyrir hnébeygju og lyftur",
    "Léttar útgáfur af hreyfingum dagsins áður en álag er aukið",
  ],
  cooldown: ["Rólegt niðurlag", "Liðkun á öxlum og mjöðmum"],
  evidence:
    "Tíðni meiðsla mælist um 3,5 á hverjar 1.000 æfingaklukkustundir og telst lág miðað við hópíþróttir. Flestar rannsóknir eru afturskyggnar, og yfirlitsgreinar raða öxl og baki ekki eins.",
  sources: [
    { label: "Musculoskeletal injuries in CrossFit: meta-analysis", url: "https://www.germanjournalsportsmedicine.com/archive/archive-2021/issue-7/musculoskeletal-injuries-in-crossfitr-a-systematic-review-and-meta-analysis-of-injury-rates-and-locations/" },
    { label: "Most common injuries in CrossFit training", url: "https://clinmedjournals.org/articles/ijsem/international-journal-of-sports-and-exercise-medicine-ijsem-8-228.pdf" },
  ],
};

const STRENGTH: ModalityGuide = {
  trains: "Vöðvastyrkur og -massi",
  tag: "Styrkur",
  loads: ["Mjóbak", "Axlir", "Hné"],
  common: [
    { area: "Öxl", note: "10–50% tilfella eftir rannsóknum. Tengt því að hlaða liðinn í óhagstæðri stöðu." },
    { area: "Mjóbak", note: "13–48% tilfella. Tengt ójafnvægi milli kvið-, fót- og bakvöðva." },
    { area: "Hné", note: "11–21% tilfella." },
  ],
  warmup: [
    "5 mín létt þolhreyfing",
    "1–2 léttar sett af aðalæfingu dagsins, 4–8 endurtekningar",
    "Liðkun á þeim liðum sem æfingin hleður mest",
  ],
  cooldown: ["Rólegt niðurlag", "Léttar teygjur á því sem var unnið"],
  evidence:
    "Tíðni er lág — um 1,0–4,4 meiðsli á 1.000 æfingaklukkustundir, lægri en í hópíþróttum. ATH: gögn um að upphitun fyrirbyggi meiðsli í lyftingum eru takmörkuð. Upphitun er studd fyrir frammistöðu; forvarnaráhrifin eru óviss.",
  sources: [
    { label: "Most common injuries in resistance training (2025 review)", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12591260/" },
    { label: "Essential warm-up techniques for resistance training", url: "https://us.humankinetics.com/blogs/excerpt/essential-warm-up-techniques-for-resistance-training" },
  ],
};

const RUNNING: ModalityGuide = {
  trains: "Loftháð þol á jöfnu álagi",
  tag: "Zone 2 / þol",
  loads: ["Hné", "Hásin og kálfi", "Sköflungur"],
  common: [
    { area: "Hné", note: "Algengast — um 27% meiðsla, oftast verkur undan hnéskel (patellofemoral)." },
    { area: "Hásin og kálfi", note: "Um 25% meiðsla; hásinarbólga er með hæstu nýgengi einstakra greininga (10%)." },
    { area: "Sköflungur", note: "Beinhimnubólga (medial tibial stress syndrome) um 8–9%." },
  ],
  warmup: ["5–10 mín rólegt skokk", "Liðkun á mjöðmum og ökklum", "Stigvaxandi hraði síðustu mínúturnar"],
  cooldown: ["Rólegt niðurlag", "Teygjur á kálfum, aftanlæri og mjaðmabeygjum"],
  evidence:
    "Um 46% áhugahlaupara meiðast á ári og 70–80% meiðsla eru álagsmeiðsli. Fyrri meiðsli eru sterkasti þekkti áhættuþátturinn — tvöfalda líkur á nýjum.",
  sources: [
    { label: "Injuries in runners: systematic review", url: "https://journals.plos.org/plosone/article/file?type=printable&id=10.1371/journal.pone.0114937" },
    { label: "Recreational runners with a history of injury (JOSPT 2021)", url: "https://www.jospt.org/doi/10.2519/jospt.2021.9673" },
  ],
};

/**
 * Keyed on what the plan actually calls things. Matched loosely because a
 * session is named by a person ("Innanhússfótbolti", "Fótbolti með vinnunni")
 * and the guide should still find it.
 */
const BY_PHRASE: [RegExp, ModalityGuide][] = [
  [/fótbolt|futsal|innanhúss|football|soccer/i, FOOTBALL],
  [/crossfit|wod|functional fitness/i, CROSSFIT],
  [/lyfting|styrkt|styrkur|strength|ræktin|upper|lower|full body|core/i, STRENGTH],
  [/hlaup|skokk|run|zone ?2|þol|cardio/i, RUNNING],
];

/** By modality, when the name says nothing useful. */
const BY_MODALITY: Record<string, ModalityGuide> = {
  strength: STRENGTH,
  hiit: CROSSFIT,
  cardio: RUNNING,
};

export function guideFor(name: string | null | undefined, modality?: string | null): ModalityGuide | null {
  const n = name ?? "";
  for (const [re, g] of BY_PHRASE) if (re.test(n)) return g;
  return (modality && BY_MODALITY[modality]) || null;
}
