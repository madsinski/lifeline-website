// Adds the rest of the blood panel to the nurse reference book (hc_knowledge),
// so an imported report maps onto a reference entry and gets a traffic light.
//
// Ranges are the Lifeline app's canonical set (fhir-health-dashboard
// src/lib/bloodMarkers.ts): the "optimal" band is green, the clinical range
// around it is yellow, outside it is red. Kept identical so the app, the
// workstation and the client account all say the same thing.
//
//   node scripts/hc-seed-knowledge-markers.mjs
//
// Env: SUPABASE_SERVICE_ROLE_KEY.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const APP = "Viðmið Lifeline (samræmd við Lifeline-appið)";

const E = [
  {
    slug: "ldl", category: "blood", sort: 15, title: "LDL-kólesteról", unit: "mmol/L",
    aliases: ["ldl", "ldl-c", "vonda kólesterólið"], tags: ["blóðfitur", "hjarta"], higher_better: false,
    summary: "Kjörsvið undir 3,0 mmol/L. 3,0–4,9 er vöktunarbil, 4,9 og yfir er hátt.",
    body_md: "LDL ber kólesteról út í æðakerfið og er sá þáttur blóðfitunnar sem mest er horft til.\n\nMataræði hreyfir LDL hægar en þríglýseríð: mettuð fita, trefjar og þyngdarbreyting skipta mestu. Hátt gildi fer til læknis með skýrslunni.",
    bands: [
      { label: "Kjörsvið", tone: "good", max: 3.0 },
      { label: "Fylgjast með", tone: "watch", min: 3.0, max: 4.9 },
      { label: "Yfir mörkum", tone: "high", min: 4.9 },
    ],
    sources: [APP],
  },
  {
    slug: "apo-b", category: "blood", sort: 17, title: "ApoB", unit: "g/L",
    aliases: ["apob", "apo b", "apolipoprotein b"], tags: ["blóðfitur", "hjarta"], higher_better: false,
    summary: "Kjörsvið undir 1,0 g/L. 1,0–1,5 er vöktunarbil, 1,5 og yfir er hátt.",
    body_md: "ApoB telur fjölda þeirra agna sem geta safnast fyrir í æðaveggnum — ein ApoB-sameind á hverja ögn.\n\nÞegar ApoB og LDL segja ekki sömu sögu er ApoB talið lýsa áhættunni betur.",
    bands: [
      { label: "Kjörsvið", tone: "good", max: 1.0 },
      { label: "Fylgjast með", tone: "watch", min: 1.0, max: 1.5 },
      { label: "Yfir mörkum", tone: "high", min: 1.5 },
    ],
    sources: [APP, "ESC 2021"],
  },
  {
    slug: "ggt", category: "blood", sort: 19, title: "GGT (lifrarpróf)", unit: "U/L",
    aliases: ["ggt", "gamma gt"], tags: ["lifur"], higher_better: false,
    summary: "Kjörsvið að 60 U/L hjá körlum og að 40 U/L hjá konum.",
    body_md: "GGT er næmt fyrir áfengi og ákveðnum lyfjum. Hátt GGT með eðlilegt ALT og AST bendir oftast á áfengi eða lyf frekar en lifrarskaða.",
    bands: [
      { label: "Kjörsvið (karlar)", tone: "good", sex: "m", max: 60 },
      { label: "Fylgjast með (karlar)", tone: "watch", sex: "m", min: 60, max: 120 },
      { label: "Yfir mörkum (karlar)", tone: "high", sex: "m", min: 120 },
      { label: "Kjörsvið (konur)", tone: "good", sex: "f", max: 40 },
      { label: "Fylgjast með (konur)", tone: "watch", sex: "f", min: 40, max: 80 },
      { label: "Yfir mörkum (konur)", tone: "high", sex: "f", min: 80 },
    ],
    sources: [APP],
  },
  {
    slug: "d-vitamin", category: "blood", sort: 20, title: "D-vítamín (25-OH)", unit: "nmol/L",
    aliases: ["d vitamin", "d-vítamín", "25ohd", "vitamin d"], tags: ["vítamín"], higher_better: true,
    summary: "50 nmol/L er neðri mörk, 75 og yfir telst gott gildi.",
    body_md: "Á Íslandi er D-vítamín lágt hjá mörgum frá október fram í apríl — sólin dugar ekki á þessari breiddargráðu.\n\nRáðlegging: D-vítamín yfir vetrarmánuðina. Læknir metur skammt ef gildið er mjög lágt.",
    bands: [
      { label: "Undir mörkum", tone: "low", max: 50 },
      { label: "Nægilegt", tone: "watch", min: 50, max: 75 },
      { label: "Kjörsvið", tone: "good", min: 75, max: 250 },
      { label: "Mjög hátt", tone: "high", min: 250 },
    ],
    sources: [APP],
  },
  {
    slug: "ferritin", category: "blood", sort: 21, title: "Ferritín", unit: "µg/L",
    aliases: ["ferritín", "ferritin", "járnbirgðir"], tags: ["járn"], higher_better: null,
    summary: "Kjörsvið 30–400 µg/L hjá körlum og 13–150 µg/L hjá konum.",
    body_md: "Ferritín lýsir járnbirgðum líkamans. Lágt gildi fer oft saman við þreytu og lélegt úthald, einkum hjá konum á barneignaraldri.\n\nFerritín hækkar líka við bólgu, svo hátt gildi eitt og sér segir ekki að járnbirgðir séu miklar.",
    bands: [
      { label: "Undir mörkum (karlar)", tone: "low", sex: "m", max: 30 },
      { label: "Kjörsvið (karlar)", tone: "good", sex: "m", min: 30, max: 400 },
      { label: "Yfir mörkum (karlar)", tone: "high", sex: "m", min: 400 },
      { label: "Undir mörkum (konur)", tone: "low", sex: "f", max: 13 },
      { label: "Kjörsvið (konur)", tone: "good", sex: "f", min: 13, max: 150 },
      { label: "Yfir mörkum (konur)", tone: "high", sex: "f", min: 150 },
    ],
    sources: [APP],
  },
  {
    slug: "tsh", category: "blood", sort: 22, title: "TSH (skjaldkirtill)", unit: "mIU/L",
    aliases: ["tsh", "skjaldkirtill"], tags: ["skjaldkirtill"], higher_better: null,
    summary: "Kjörsvið 0,4–4,0 mIU/L.",
    body_md: "TSH er fyrsta skimun fyrir starfsemi skjaldkirtils. Hátt gildi bendir til vanvirkni, lágt til ofvirkni.\n\nGildi utan bils fer til læknis — það er ekki lífsstílsmál.",
    bands: [
      { label: "Undir mörkum", tone: "low", max: 0.4 },
      { label: "Kjörsvið", tone: "good", min: 0.4, max: 4.0 },
      { label: "Yfir mörkum", tone: "high", min: 4.0 },
    ],
    sources: [APP],
  },
  {
    slug: "hscrp", category: "blood", sort: 23, title: "hsCRP (bólga)", unit: "mg/L",
    aliases: ["crp", "hscrp", "hs-crp", "bólga"], tags: ["bólga", "hjarta"], higher_better: false,
    summary: "Kjörsvið undir 3,0 mg/L. 3–10 er vöktunarbil, 10 og yfir er hátt.",
    body_md: "hsCRP mælir lágstiga bólgu. Sýking eða veikindi síðustu daga hækka gildið tímabundið — spyrjið út í það áður en gildið er túlkað.\n\nÞað sem lækkar hsCRP hjá okkar skjólstæðingum: reglubundin hreyfing, betri svefn, minna áfengi og þyngdarbreyting.",
    bands: [
      { label: "Kjörsvið", tone: "good", max: 3.0 },
      { label: "Fylgjast með", tone: "watch", min: 3.0, max: 10 },
      { label: "Yfir mörkum", tone: "high", min: 10 },
    ],
    sources: [APP],
  },
  {
    slug: "vo2max", category: "body", sort: 24, title: "VO2max (þolgeta)", unit: "ml/kg/mín",
    aliases: ["vo2max", "vo2", "súrefnisupptaka", "þolgeta"], tags: ["þol", "hreyfing"], higher_better: true,
    summary: "Hærra er betra. Viðmiðin ráðast af aldri og kyni — bilin hér miðast við 40–49 ára.",
    body_md: "VO2max er sterkasti einstaki mælikvarðinn á þol og tengist heilsu til lengri tíma betur en flestar aðrar mælingar.\n\n**Bilin hér eru fyrir 40–49 ára.** Yngri þurfa hærra gildi fyrir sama flokk og eldri lægra — notaðu aldursleiðréttingu ef hún fylgir mælingunni.\n\nÞað sem hækkar VO2max mest: löng róleg þolæfing í viku hverri og ein lotuæfing (4 x 4 mínútur).",
    bands: [
      { label: "Undir meðallagi (karlar)", tone: "low", sex: "m", max: 32 },
      { label: "Meðallag (karlar)", tone: "watch", sex: "m", min: 32, max: 40 },
      { label: "Gott (karlar)", tone: "good", sex: "m", min: 40 },
      { label: "Undir meðallagi (konur)", tone: "low", sex: "f", max: 27 },
      { label: "Meðallag (konur)", tone: "watch", sex: "f", min: 27, max: 33 },
      { label: "Gott (konur)", tone: "good", sex: "f", min: 33 },
    ],
    sources: ["FRIEND-viðmið (aldursskipt)", "docs/exercise-scoring-methodology.md"],
  },
];

const rows = E.map((e) => ({
  slug: e.slug, category: e.category, title: e.title, aliases: e.aliases ?? [], unit: e.unit ?? null,
  summary: e.summary, body_md: e.body_md ?? null, bands: e.bands ?? [],
  higher_better: e.higher_better ?? null, sources: e.sources ?? [], tags: e.tags ?? [],
  sort: e.sort ?? 100, active: true, updated_at: new Date().toISOString(), updated_by: "seed",
}));

const r = await fetch(`${URL_}/rest/v1/hc_knowledge?on_conflict=slug`, {
  method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows),
});
if (!r.ok) { console.error(await r.text()); process.exit(1); }
console.log(`Upserted ${rows.length} markers:`, rows.map((x) => x.slug).join(", "));
