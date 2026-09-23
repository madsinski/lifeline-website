// Seeds the nurse reference book (hc_knowledge) — what /vinnustod → "Fletta upp"
// searches. Ranges come from Lifeline's own reference set
// (src/lib/research/clinical.ts REFERENCE_NOTE, unified with the Lifeline app)
// and from docs/exercise-scoring-methodology.md. Lifestyle entries follow the
// standard public-health guidance named in `sources`.
//
// Wording rule: these entries describe what we measure and what Lifeline
// recommends. They never diagnose, treat or promise an outcome — the doctor
// confirms the report and clinical questions go to a doctor.
//
//   node scripts/hc-seed-knowledge.mjs          # upsert every entry
//
// Env: SUPABASE_SERVICE_ROLE_KEY (+ NEXT_PUBLIC_SUPABASE_URL to override).

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const LIFELINE = "Viðmið Lifeline (samræmd við Lifeline-appið)";
const WHO = "WHO 2020 — ráðleggingar um hreyfingu";
const DOCTOR = "Læknir staðfestir skýrsluna. Klínískum spurningum er vísað til læknis.";

const E = [
  // ── Blóðprufa ─────────────────────────────────────────────────────────────
  {
    slug: "insulin", category: "blood", sort: 10, title: "Insúlín (fastandi)", unit: "mIU/L",
    aliases: ["insúlín", "insulin", "fastandi insúlín"], tags: ["efnaskipti", "blóðsykur"], higher_better: false,
    summary: "Kjörsvið 2–25 mIU/L. Innan bilsins er lægra betra.",
    body_md: "Insúlín segir til um hversu mikið líkaminn þarf að framleiða til að halda blóðsykri í skefjum.\n\nGildi í efri hluta bilsins (um 15–25) fara oft saman við hærra HOMA-IR. Metið alltaf með fastandi blóðsykri og HOMA-IR, ekki eitt og sér.\n\nÞað sem hreyfir insúlín mest hjá okkar skjólstæðingum: regluleg hreyfing (bæði þol og styrkur), minni sykraðir drykkir og betri svefn.",
    bands: [
      { label: "Undir bili", tone: "low", max: 2 },
      { label: "Kjörsvið", tone: "good", min: 2, max: 25, note: "Lægra innan bilsins er hagstæðara." },
      { label: "Yfir bili", tone: "high", min: 25 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "homa-ir", category: "blood", sort: 11, title: "HOMA-IR", unit: "",
    aliases: ["homa", "homa ir", "insúlínnæmi"], tags: ["efnaskipti", "insúlín"], higher_better: false,
    summary: "Kjörsvið undir 1,9. 1,9–2,9 er vöktunarbil, 2,9 og yfir er hátt.",
    body_md: "HOMA-IR er reiknað úr fastandi insúlíni og fastandi blóðsykri og lýsir því hversu vel líkaminn svarar insúlíni.\n\nHærra gildi er merki um minna insúlínnæmi. Það er eitt af því sem svarar hraðast þegar hreyfing og mataræði breytast.",
    bands: [
      { label: "Kjörsvið", tone: "good", max: 1.9 },
      { label: "Fylgjast með", tone: "watch", min: 1.9, max: 2.9 },
      { label: "Yfir mörkum", tone: "high", min: 2.9 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "hba1c", category: "blood", sort: 12, title: "HbA1c (langtímablóðsykur)", unit: "mmol/mol",
    aliases: ["hba1c", "langtímablóðsykur", "sykurpróf"], tags: ["blóðsykur", "efnaskipti"], higher_better: false,
    summary: "Kjörsvið 20–39 mmol/mol. 39–46 er vöktunarbil, 46 og yfir er hátt.",
    body_md: "HbA1c endurspeglar meðalblóðsykur síðustu 8–12 vikurnar, svo það breytist hægt. Það er gagnlegt til að meta þróun milli heilsufarsskoðana frekar en dagsformið.\n\nÍsland notar IFCC-einingar (mmol/mol).",
    bands: [
      { label: "Kjörsvið", tone: "good", min: 20, max: 39 },
      { label: "Fylgjast með", tone: "watch", min: 39, max: 46 },
      { label: "Yfir mörkum", tone: "high", min: 46 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "fastandi-blodsykur", category: "blood", sort: 13, title: "Fastandi blóðsykur", unit: "mmol/L",
    aliases: ["glúkósi", "glucose", "blóðsykur", "fastandi glúkósi"], tags: ["blóðsykur", "efnaskipti"], higher_better: false,
    summary: "Kjörsvið 3,9–5,6 mmol/L. 5,6–6,9 er vöktunarbil, 6,9 og yfir er hátt.",
    body_md: "Mælt fastandi, því máltíð kvöldið áður hefur áhrif. Ef skjólstæðingur mætti ekki fastandi skal skrá það — gildið er þá ekki samanburðarhæft.",
    bands: [
      { label: "Undir bili", tone: "low", max: 3.9 },
      { label: "Kjörsvið", tone: "good", min: 3.9, max: 5.6 },
      { label: "Fylgjast með", tone: "watch", min: 5.6, max: 6.9 },
      { label: "Yfir mörkum", tone: "high", min: 6.9 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "heildarkolesterol", category: "blood", sort: 14, title: "Heildarkólesteról", unit: "mmol/L",
    aliases: ["kólesteról", "cholesterol", "heildarkólesteról"], tags: ["blóðfitur", "hjarta"], higher_better: false,
    summary: "Kjörsvið undir 5,2 mmol/L. 5,2–6,2 er vöktunarbil, 6,2 og yfir er hátt.",
    body_md: "Heildarkólesteról segir lítið eitt og sér. Skoðið það alltaf með HDL og þríglýseríðum, og í samhengi við blóðþrýsting og fjölskyldusögu.",
    bands: [
      { label: "Kjörsvið", tone: "good", max: 5.2 },
      { label: "Fylgjast með", tone: "watch", min: 5.2, max: 6.2 },
      { label: "Yfir mörkum", tone: "high", min: 6.2 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "hdl", category: "blood", sort: 15, title: "HDL-kólesteról", unit: "mmol/L",
    aliases: ["hdl", "góða kólesterólið"], tags: ["blóðfitur", "hjarta"], higher_better: true,
    summary: "Kjörsvið 1,0 mmol/L og yfir hjá körlum, 1,3 og yfir hjá konum. Hér er hærra betra.",
    body_md: "HDL hækkar helst með reglulegri hreyfingu og minni neyslu áfengis og sykraðra drykkja. Breytingar eru hægar — metið milli ára frekar en milli vikna.",
    bands: [
      { label: "Undir mörkum (karlar)", tone: "low", sex: "m", max: 1.0 },
      { label: "Kjörsvið (karlar)", tone: "good", sex: "m", min: 1.0 },
      { label: "Undir mörkum (konur)", tone: "low", sex: "f", max: 1.3 },
      { label: "Kjörsvið (konur)", tone: "good", sex: "f", min: 1.3 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "thriglyserid", category: "blood", sort: 16, title: "Þríglýseríð", unit: "mmol/L",
    aliases: ["þríglýseríð", "triglycerides", "blóðfita"], tags: ["blóðfitur", "efnaskipti"], higher_better: false,
    summary: "Kjörsvið undir 1,7 mmol/L. 1,7–2,3 er vöktunarbil, 2,3 og yfir er hátt.",
    body_md: "Þríglýseríð svara hratt breytingum á sykruðum drykkjum, áfengi og hreyfingu — oft sést munur milli heilsufarsskoðunar og eftirfylgdar eftir þrjá mánuði.\n\nMælist hátt ef skjólstæðingur var ekki fastandi.",
    bands: [
      { label: "Kjörsvið", tone: "good", max: 1.7 },
      { label: "Fylgjast með", tone: "watch", min: 1.7, max: 2.3 },
      { label: "Yfir mörkum", tone: "high", min: 2.3 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "alt", category: "blood", sort: 17, title: "ALT (lifrarpróf)", unit: "U/L",
    aliases: ["alt", "alat", "lifrarpróf"], tags: ["lifur"], higher_better: false,
    summary: "Kjörsvið að 41 U/L hjá körlum og að 33 U/L hjá konum.",
    body_md: "ALT hækkar meðal annars við áfengisneyslu, fitu í lifur og stundum eftir mjög erfiða æfingu síðustu daga fyrir prufu. Spyrjið út í hvort tveggja áður en gildi er túlkað.",
    bands: [
      { label: "Kjörsvið (karlar)", tone: "good", sex: "m", max: 41 },
      { label: "Yfir mörkum (karlar)", tone: "high", sex: "m", min: 41 },
      { label: "Kjörsvið (konur)", tone: "good", sex: "f", max: 33 },
      { label: "Yfir mörkum (konur)", tone: "high", sex: "f", min: 33 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "ast", category: "blood", sort: 18, title: "AST (lifrarpróf)", unit: "U/L",
    aliases: ["ast", "asat"], tags: ["lifur"], higher_better: false,
    summary: "Kjörsvið að 40 U/L hjá körlum og að 32 U/L hjá konum.",
    body_md: "AST kemur bæði úr lifur og vöðvum, svo erfið æfing dagana fyrir blóðprufu getur hækkað það tímabundið.",
    bands: [
      { label: "Kjörsvið (karlar)", tone: "good", sex: "m", max: 40 },
      { label: "Yfir mörkum (karlar)", tone: "high", sex: "m", min: 40 },
      { label: "Kjörsvið (konur)", tone: "good", sex: "f", max: 32 },
      { label: "Yfir mörkum (konur)", tone: "high", sex: "f", min: 32 },
    ],
    sources: [LIFELINE],
  },

  // ── Mælingar ──────────────────────────────────────────────────────────────
  {
    slug: "vodvamassi", category: "body", sort: 20, title: "Vöðvamassi (hlutfall)", unit: "%",
    aliases: ["vöðvamassi", "vöðvahlutfall", "muscle mass", "skeletal muscle"], tags: ["líkamssamsetning"], higher_better: true,
    summary: "Kjörsvið 40–44% hjá körlum og 31–36% hjá konum. Hér er hærra betra.",
    body_md: "Hlutfall beinagrindarvöðva af líkamsþyngd, mælt í Biody-mælingu.\n\nHlutfallið getur hækkað án þess að vöðvamassi í kílóum breytist, ef fitumassi lækkar. Skoðið því kílóin og hlutfallið saman.\n\nÞað sem skilar mestu: styrktaræfingar tvisvar til þrisvar í viku og nóg prótein.",
    bands: [
      { label: "Undir kjörsviði (karlar)", tone: "low", sex: "m", max: 40 },
      { label: "Kjörsvið (karlar)", tone: "good", sex: "m", min: 40, note: "Dæmigert kjörsvið 40–44%." },
      { label: "Undir kjörsviði (konur)", tone: "low", sex: "f", max: 31 },
      { label: "Kjörsvið (konur)", tone: "good", sex: "f", min: 31, note: "Dæmigert kjörsvið 31–36%." },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "fitumassi", category: "body", sort: 21, title: "Fitumassi (hlutfall)", unit: "%",
    aliases: ["fitumassi", "fituhlutfall", "body fat"], tags: ["líkamssamsetning"], higher_better: false,
    summary: "Kjörsvið 10–20% hjá körlum og 18–28% hjá konum.",
    body_md: "Mælt í Biody-mælingu. Vökvajafnvægi hefur áhrif, svo mælið við sambærilegar aðstæður milli skipta — helst á sama tíma dags og ekki strax eftir æfingu.",
    bands: [
      { label: "Undir kjörsviði (karlar)", tone: "low", sex: "m", max: 10 },
      { label: "Kjörsvið (karlar)", tone: "good", sex: "m", min: 10, max: 20 },
      { label: "Yfir kjörsviði (karlar)", tone: "watch", sex: "m", min: 20 },
      { label: "Undir kjörsviði (konur)", tone: "low", sex: "f", max: 18 },
      { label: "Kjörsvið (konur)", tone: "good", sex: "f", min: 18, max: 28 },
      { label: "Yfir kjörsviði (konur)", tone: "watch", sex: "f", min: 28 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "bmi", category: "body", sort: 22, title: "Líkamsþyngdarstuðull (BMI)", unit: "kg/m²",
    aliases: ["bmi", "þyngdarstuðull", "líkamsþyngdarstuðull"], tags: ["líkamssamsetning"], higher_better: false,
    summary: "Kjörsvið undir 25. 25–30 er yfirþyngd og 30 og yfir er offita.",
    body_md: "BMI greinir ekki á milli vöðva og fitu. Hjá þeim sem æfa styrk er líkamssamsetningin (fitu- og vöðvahlutfall) mun betri mælikvarði — notið BMI sem grófa viðmiðun.",
    bands: [
      { label: "Undir bili", tone: "low", max: 18.5 },
      { label: "Kjörsvið", tone: "good", min: 18.5, max: 25 },
      { label: "Yfirþyngd", tone: "watch", min: 25, max: 30 },
      { label: "Offita", tone: "high", min: 30 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "blodthrystingur", category: "body", sort: 23, title: "Blóðþrýstingur — efri mörk", unit: "mmHg",
    aliases: ["blóðþrýstingur", "efri mörk", "systólískur", "blood pressure"], tags: ["hjarta"], higher_better: false,
    summary: "Efri mörk: kjörsvið undir 120, 120–139 vöktunarbil, 140 og yfir hátt. Neðri mörk: undir 80 / 80–89 / 90 og yfir.",
    body_md: "Mælið eftir fimm mínútna hvíld, með bakstuðning og handlegg í hjartahæð, og notið rétta stærð af manséttu.\n\nEin há mæling er ekki niðurstaða: endurtakið eftir nokkrar mínútur og skráið báðar. Hátt gildi í mælingu fer til læknis með skýrslunni.",
    bands: [
      { label: "Kjörsvið", tone: "good", max: 120 },
      { label: "Fylgjast með", tone: "watch", min: 120, max: 140 },
      { label: "Yfir mörkum", tone: "high", min: 140 },
    ],
    sources: [LIFELINE],
  },

  // ── Andleg líðan og fíkn ──────────────────────────────────────────────────
  {
    slug: "phq-9", category: "mental", sort: 30, title: "PHQ-9 (depurð)", unit: "stig",
    aliases: ["phq9", "phq-9", "phq", "þunglyndiskvarði", "depurð"], tags: ["andleg líðan", "skimun"], higher_better: false,
    summary: "0–4 engin einkenni, 5–9 væg, 10–14 miðlungs, 15 og yfir talsverð.",
    body_md: "PHQ-9 er skimunartæki, ekki greining. PHQ-2 er stutta skimunin og 3 stig eða meira þar leiða til PHQ-9.\n\nSpurning 9 snýr að sjálfsskaða. Ef hún er ekki núll skal ræða hana strax í viðtalinu og fá lækni að málinu samdægurs.",
    bands: [
      { label: "Engin einkenni", tone: "good", min: 0, max: 5 },
      { label: "Væg", tone: "watch", min: 5, max: 10 },
      { label: "Miðlungs", tone: "high", min: 10, max: 15 },
      { label: "Talsverð", tone: "high", min: 15 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "gad-7", category: "mental", sort: 31, title: "GAD-7 (kvíði)", unit: "stig",
    aliases: ["gad7", "gad-7", "gad", "kvíðakvarði", "kvíði"], tags: ["andleg líðan", "skimun"], higher_better: false,
    summary: "0–4 engin einkenni, 5–9 væg, 10–14 miðlungs, 15 og yfir talsverð.",
    body_md: "GAD-2 er stutta skimunin; 3 stig eða meira leiða til GAD-7. Eins og PHQ-9 er þetta skimun sem styður viðtalið, ekki greining.",
    bands: [
      { label: "Engin einkenni", tone: "good", min: 0, max: 5 },
      { label: "Væg", tone: "watch", min: 5, max: 10 },
      { label: "Miðlungs", tone: "high", min: 10, max: 15 },
      { label: "Talsverð", tone: "high", min: 15 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "audit-c", category: "mental", sort: 32, title: "AUDIT-C (áfengi, skimun)", unit: "stig",
    aliases: ["audit c", "auditc", "áfengi", "alcohol"], tags: ["fíkn", "skimun"], higher_better: false,
    summary: "Skimun jákvæð við 4 stig hjá körlum og 3 stig hjá konum. Þá er tekið fullt AUDIT-10.",
    body_md: "AUDIT-10: 8 stig og yfir benda til skaðlegrar neyslu og 15 og yfir til ávana. Niðurstaðan er umræðuefni í viðtalinu og fer með skýrslunni til læknis.",
    bands: [
      { label: "Undir viðmiði (karlar)", tone: "good", sex: "m", max: 4 },
      { label: "Yfir viðmiði (karlar)", tone: "watch", sex: "m", min: 4 },
      { label: "Undir viðmiði (konur)", tone: "good", sex: "f", max: 3 },
      { label: "Yfir viðmiði (konur)", tone: "watch", sex: "f", min: 3 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "audit-10", category: "mental", sort: 33, title: "AUDIT-10 (áfengi, fullt)", unit: "stig",
    aliases: ["audit", "audit 10", "audit-10"], tags: ["fíkn", "skimun"], higher_better: false,
    summary: "8 stig og yfir benda til skaðlegrar neyslu, 15 og yfir til ávana.",
    body_md: "Tekið þegar AUDIT-C er yfir viðmiði. Ræðið niðurstöðuna hlutlaust og skráið hvað skjólstæðingurinn vill gera — læknir sér niðurstöðuna með skýrslunni.",
    bands: [
      { label: "Undir viðmiði", tone: "good", max: 8 },
      { label: "Skaðleg neysla", tone: "watch", min: 8, max: 15 },
      { label: "Bendir til ávana", tone: "high", min: 15 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "pgsi", category: "mental", sort: 34, title: "PGSI (spilahegðun)", unit: "stig",
    aliases: ["pgsi", "spilafíkn", "spilahegðun"], tags: ["fíkn", "skimun"], higher_better: false,
    summary: "1–2 lítil áhætta, 3–7 miðlungs, 8 og yfir vandi.",
    body_md: "Skimun fyrir spilahegðun. Ef stigin eru 8 eða fleiri skal bjóða samtal við lækni og benda á úrræði.",
    bands: [
      { label: "Engin merki", tone: "good", min: 0, max: 1 },
      { label: "Lítil áhætta", tone: "watch", min: 1, max: 3 },
      { label: "Miðlungs", tone: "watch", min: 3, max: 8 },
      { label: "Vandi", tone: "high", min: 8 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "skjanotkun-cius", category: "mental", sort: 35, title: "Skjánotkun (CIUS)", unit: "stig",
    aliases: ["cius", "skjánotkun", "skjátími"], tags: ["andleg líðan", "skimun"], higher_better: false,
    summary: "Hærri stig þýða áráttukenndari netnotkun. Lægra er betra.",
    body_md: "CIUS-5 er stutta skimunin og CIUS-14 sú lengri. Nýtist best sem umræðuefni um svefn: skjánotkun á kvöldin er algengasta ástæðan fyrir seinkuðum háttatíma.",
    bands: [],
    sources: [LIFELINE],
  },
  {
    slug: "beds-7", category: "mental", sort: 36, title: "BEDS-7 (lotuát)", unit: "stig",
    aliases: ["beds", "beds7", "lotuát", "átröskun"], tags: ["næring", "skimun"], higher_better: false,
    summary: "Skimun fyrir lotuátseinkennum. Hærri stig þýða fleiri einkenni.",
    body_md: "Jákvæð skimun er tilefni til samtals við lækni áður en næringaráætlun er sett upp. Forðist að setja strangar reglur um mataræði þegar skimun er jákvæð.",
    bands: [],
    sources: [LIFELINE],
  },

  // ── Einkunnir ─────────────────────────────────────────────────────────────
  {
    slug: "lifstilseinkunn", category: "score", sort: 40, title: "Lífstílseinkunn", unit: "0–10",
    aliases: ["lífstílseinkunn", "heildareinkunn", "lifestyle score"], tags: ["einkunn", "skýrsla"], higher_better: true,
    summary: "7,5 og yfir er gott, 5–7,5 sæmilegt og undir 5 ábótavant.",
    body_md: "Meðaltal fimm undireinkunna: svefn, hreyfing, næring, andleg líðan og fíkn. Hver þeirra er 0–10 og hærra er betra.\n\nPWI (vellíðunarkvarði) er sérstakur mælikvarði og telur ekki inn í lífstílseinkunnina.\n\nNotið einkunnina til að velja hvar á að byrja: lægsta stoðin gefur oftast mestan ávinning fyrir minnsta fyrirhöfn.",
    bands: [
      { label: "Ábótavant", tone: "high", max: 5 },
      { label: "Sæmilegt", tone: "watch", min: 5, max: 7.5 },
      { label: "Gott", tone: "good", min: 7.5 },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "stodaeinkunnir", category: "score", sort: 41, title: "Undireinkunnir stoðanna", unit: "0–10",
    aliases: ["svefn einkunn", "hreyfing einkunn", "næring einkunn", "andlegt einkunn", "fíkn einkunn"], tags: ["einkunn", "skýrsla"], higher_better: true,
    summary: "Svefn, hreyfing, næring, andleg líðan og fíkn fá hvert sína 0–10 einkunn. Hærra er betra.",
    body_md: "Einkunnirnar koma úr spurningalistanum og mælingunum. Þær eru hugsaðar til að forgangsraða í viðtalinu og til að bera saman við endurmat eftir ár.\n\nBreyting upp á eitt stig milli mælinga er raunveruleg breyting á vana, ekki mælióvissa.",
    bands: [
      { label: "Ábótavant", tone: "high", max: 5 },
      { label: "Sæmilegt", tone: "watch", min: 5, max: 7.5 },
      { label: "Gott", tone: "good", min: 7.5 },
    ],
    sources: [LIFELINE],
  },

  // ── Lífsstíll ─────────────────────────────────────────────────────────────
  {
    slug: "koffin", category: "lifestyle", sort: 50, title: "Koffín", unit: "mg á dag",
    aliases: ["koffín", "kaffi", "caffeine", "orkudrykkir"], tags: ["svefn", "næring"], higher_better: false,
    summary: "Að 400 mg á dag fyrir fullorðna (um 4 bollar af kaffi). Ekkert koffín síðustu 8–10 klst. fyrir svefn.",
    body_md: "Helmingunartími koffíns er um 5–6 klukkustundir, svo síðdegiskaffi er enn hálft í líkamanum við háttatíma.\n\n**Þumalputtaregla Lifeline:** ef svefn er vandamál, ekkert koffín eftir hádegi (um kl. 12–14 miðað við venjulegan háttatíma).\n\nGróf viðmið: espresso-skot um 65 mg, uppáhellt kaffi 95–120 mg í bolla, orkudrykkur 80–160 mg í dós, svart te um 45 mg.\n\nÞungaðar konur: að 200 mg á dag.",
    bands: [
      { label: "Innan viðmiða", tone: "good", max: 400 },
      { label: "Yfir viðmiðum", tone: "watch", min: 400, max: 600 },
      { label: "Langt yfir", tone: "high", min: 600 },
    ],
    sources: ["EFSA 2015 — koffínviðmið", LIFELINE],
  },
  {
    slug: "svefnlengd", category: "lifestyle", sort: 51, title: "Svefnlengd", unit: "klst.",
    aliases: ["svefn", "svefntími", "sleep"], tags: ["svefn"], higher_better: true,
    summary: "7–9 klukkustundir fyrir fullorðna. Fastur fótaferðartími skiptir meira máli en fastur háttatími.",
    body_md: "Við byrjum alltaf á fótaferðartímanum: hann stýrir dægursveiflunni og er það eina sem fólk ræður alveg við.\n\nÞrennt sem skilar mestu í svefni: fastur fótaferðartími alla daga, dagsbirta fyrsta klukkutímann eftir að fólk vaknar, og ekkert koffín eftir hádegi.",
    bands: [
      { label: "Of stuttur", tone: "low", max: 7 },
      { label: "Kjörsvið", tone: "good", min: 7, max: 9 },
      { label: "Langur", tone: "watch", min: 9, note: "Langur svefn og þreyta þrátt fyrir hann er tilefni til samtals." },
    ],
    sources: [LIFELINE],
  },
  {
    slug: "hreyfing-vikuskammtur", category: "lifestyle", sort: 52, title: "Hreyfing — vikuskammtur", unit: "mín. á viku",
    aliases: ["hreyfing", "þolþjálfun", "who", "vikuskammtur", "exercise"], tags: ["hreyfing"], higher_better: true,
    summary: "150–300 mín. af miðlungserfiðri hreyfingu á viku, eða 75–150 mín. kröftugri, ásamt styrktaræfingum tvo daga eða fleiri.",
    body_md: "Kröftug hreyfing telur tvöfalt á við miðlungserfiða. 150 mínútur af miðlungserfiðri hreyfingu jafngilda um 500 MET-mínútum, sem er fullur vikuskammtur.\n\nÁvinningurinn er mestur í fyrstu skrefunum: sá sem hreyfir sig ekkert græðir mest á fyrstu 60 mínútunum í viku. Ofar en um 1000 MET-mínútur flatnar ávinningurinn út.\n\nMiðlungserfitt = þú getur talað en ekki sungið.",
    bands: [
      { label: "Undir viðmiði", tone: "low", max: 150 },
      { label: "Nær viðmiði", tone: "good", min: 150, max: 300 },
      { label: "Yfir viðmiði", tone: "good", min: 300, note: "Meira telst ekki betra í einkunn." },
    ],
    sources: [WHO, "docs/exercise-scoring-methodology.md"],
  },
  {
    slug: "styrktarthjalfun", category: "lifestyle", sort: 53, title: "Styrktarþjálfun — skammtur", unit: "mín. á viku",
    aliases: ["styrktaræfingar", "styrkur", "lyftingar", "strength"], tags: ["hreyfing"], higher_better: true,
    summary: "Tvisvar í viku fyrir alla helstu vöðvahópa. Mesti ávinningurinn næst við 30–60 mínútur á viku.",
    body_md: "Ávinningur styrktarþjálfunar er J-laga: hann er mestur við 30–60 mínútur á viku og minnkar aftur yfir um 130–140 mínútum ef þol vantar á móti.\n\nStyrkur og þol saman skila mun meiru en hvort í sínu lagi. Þess vegna eru æfingaáætlanirnar okkar byggðar á tveimur styrktaræfingum fyrir allan líkamann og rólegri þolþjálfun þess á milli.",
    bands: [
      { label: "Undir viðmiði", tone: "low", max: 30 },
      { label: "Kjörsvið", tone: "good", min: 30, max: 140 },
      { label: "Mikið álag", tone: "watch", min: 140, note: "Athugið hvíld og endurheimt." },
    ],
    sources: ["Momma 2022 (16 ferilrannsóknir)", WHO],
  },
  {
    slug: "protein", category: "lifestyle", sort: 54, title: "Prótein", unit: "g/kg á dag",
    aliases: ["prótein", "protein", "eggjahvíta"], tags: ["næring"], higher_better: true,
    summary: "1,2–1,6 g á hvert kíló líkamsþyngdar á dag fyrir þá sem æfa styrk.",
    body_md: "Einfaldasta ráðið í viðtali: prótein í hverja máltíð, og byrjaðu máltíðina á próteini og grænmeti.\n\nFyrir 80 kg einstakling eru 1,2–1,6 g/kg um 95–130 g á dag. Það þarf ekki duft — fiskur, egg, skyr, kjöt, baunir og linsur duga.",
    bands: [
      { label: "Undir viðmiði", tone: "low", max: 1.2 },
      { label: "Kjörsvið", tone: "good", min: 1.2, max: 1.6 },
      { label: "Yfir viðmiði", tone: "watch", min: 1.6 },
    ],
    sources: ["Almenn ráðlegging fyrir fullorðna sem stunda styrktarþjálfun"],
  },
  {
    slug: "trefjar", category: "lifestyle", sort: 55, title: "Trefjar", unit: "g á dag",
    aliases: ["trefjar", "fiber", "fibre"], tags: ["næring"], higher_better: true,
    summary: "25–35 g á dag. Flestir ná um helmingi þess.",
    body_md: "Trefjar eru það sem auðveldast er að bæta við án þess að taka neitt í burtu: heilkorn í stað hvíts, baunir í pottrétti, ber og grænmeti í hverja máltíð.\n\nAukið hægt og með vatni, annars fylgja óþægindi í maga fyrstu vikuna.",
    bands: [
      { label: "Undir viðmiði", tone: "low", max: 25 },
      { label: "Kjörsvið", tone: "good", min: 25, max: 35 },
      { label: "Hátt", tone: "good", min: 35 },
    ],
    sources: ["Norrænar næringarráðleggingar"],
  },

  // ── Aðferðafræði ──────────────────────────────────────────────────────────
  {
    slug: "hvad-er-i-skyrslunni", category: "method", sort: 60, title: "Hvað er í heilsufarsskýrslunni",
    aliases: ["skýrsla", "heilsufarsskýrsla", "report"], tags: ["ferli"], higher_better: null, unit: "",
    summary: "Spurningalisti, mælingar, blóðprufa og samantekt læknis — og svo aðgerðaáætlun til þriggja mánaða.",
    body_md: "Lögin fjögur í skýrslunni:\n\n1. **Grunnstoðirnar** — svefn, næring, hreyfing og andleg líðan úr spurningalistanum.\n2. **Mælingar og blóðprufa** — líkamssamsetning, blóðþrýstingur og efnaskiptatengd gildi.\n3. **Samantekt læknis** — læknir les saman niðurstöðurnar og staðfestir skýrsluna.\n4. **Aðgerðaáætlun** — það sem skjólstæðingurinn gerir næstu þrjá mánuði.\n\n" + DOCTOR,
    bands: [],
    sources: [LIFELINE],
  },
  {
    slug: "mest-fyrir-minnst", category: "method", sort: 61, title: "„Mest fyrir minnst“ — hvernig við forgangsröðum",
    aliases: ["forgangsröðun", "mest fyrir minnst", "high yield"], tags: ["ferli", "áætlun"], higher_better: null, unit: "",
    summary: "Veljið fáar aðgerðir sem skila mestu: stórar hreyfingar, fastur fótaferðartími, prótein og trefjar í hverja máltíð.",
    body_md: "Reglurnar sem áætlanirnar okkar byggja á:\n\n- Byrjið á lægstu stoðinni í lífstílseinkunninni.\n- Þrjár til fimm aðgerðir í heildina, ekki fleiri. Fleiri aðgerðir þýða færri kláraðar.\n- Ein lykilvenja fyrst (oftast fótaferðartími eða dagleg ganga) — hún dregur hinar með sér.\n- Stórar hreyfingar í æfingaáætlun: hnébeygja, mjaðmalyfta, ýta, toga, bera.\n- Samkvæmni fram yfir fullkomnun: stutt æfing er betri en engin.",
    bands: [],
    sources: [LIFELINE],
  },
  {
    slug: "beidni-um-mat-laeknis", category: "method", sort: 62, title: "Hvenær bið ég lækni um mat",
    aliases: ["læknir", "beiðni", "mat læknis", "doctor review"], tags: ["ferli", "öryggi"], higher_better: null, unit: "",
    summary: "Sendu beiðni um mat læknis úr yfirliti skjólstæðingsins þegar eitthvað er utan viðmiða eða þig grunar að málið eigi heima hjá lækni.",
    body_md: "Dæmi um tilefni:\n\n- Mæling eða blóðgildi langt utan viðmiða.\n- Einkenni sem skjólstæðingur nefnir í viðtali og þarf að skoða nánar.\n- PHQ-9 spurning 9 (sjálfsskaði) ekki núll — þá samdægurs.\n- Skjólstæðingur spyr um lyf, greiningu eða meðferð.\n\nBeiðnin birtist strax á verkefnalista læknis. Þegar blóðprufusvör berast fær læknir sjálfkrafa SMS ef skýrslan er ekki staðfest innan fimm mínútna.\n\n" + DOCTOR,
    bands: [],
    sources: [LIFELINE],
  },
  {
    slug: "tilvisun-heilsugaeslu", category: "method", sort: 63, title: "Tilvísun til og frá heilsugæslu",
    aliases: ["tilvísun", "heilsugæsla", "referral"], tags: ["ferli"], higher_better: null, unit: "",
    summary: "Tilvísanir ganga í báðar áttir: heilsugæslan vísar í heilsufarsskoðun og við vísum til baka þegar vandi greinist.",
    body_md: "Heilsugæslan tekur blóðprufuna og er öryggisnetið. Þegar niðurstaða kallar á greiningu, lyf eða eftirfylgd fer málið þangað — merkið tilvísun á skjólstæðinginn og skráið ástæðuna.\n\nVið tökum á móti tilvísunum frá heilsugæslunni í hina áttina: fólk sem þarf skipulagða vinnu með svefn, hreyfingu, næringu og andlega líðan.",
    bands: [],
    sources: [LIFELINE],
  },
  {
    slug: "maelingar-gaedi", category: "method", sort: 64, title: "Að mæla rétt (Biody og blóðþrýstingur)",
    aliases: ["biody", "mæling", "mælingar", "gæði"], tags: ["ferli", "mælingar"], higher_better: null, unit: "",
    summary: "Sambærilegar aðstæður milli skipta: fastandi ef hægt er, ekki strax eftir æfingu, léttur klæðnaður, ekkert málmskart.",
    body_md: "**Biody-mæling:** vökvajafnvægi hefur mest áhrif. Mælið helst á sama tíma dags, ekki strax eftir æfingu eða sturtu og ekki eftir stóra máltíð.\n\n**Blóðþrýstingur:** fimm mínútna hvíld, bak stutt, fætur á gólfi, handleggur í hjartahæð, rétt stærð af manséttu. Endurtakið ef fyrsta mælingin er há og skráið báðar.\n\nSkráið alltaf frávik (t.d. „mætti ekki fastandi“) — annars er samanburður við endurmat ómarktækur.",
    bands: [],
    sources: [LIFELINE],
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
const byCat = rows.reduce((m, x) => ({ ...m, [x.category]: (m[x.category] ?? 0) + 1 }), {});
console.log(`Upserted ${rows.length} entries:`, Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join(", "));
