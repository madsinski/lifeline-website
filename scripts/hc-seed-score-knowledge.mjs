// The Grunnheilsa report's own 0–10 scores, as reference-book entries.
//
// Why these exist separately from the raw instruments:
//
// The report scores every pillar 0–10, higher is better. Behind each score
// sits a questionnaire on its own scale — PGSI 0–27 (higher is worse), CIUS,
// PHQ-9, GAD-7, caffeine in mg per day. Those already have entries here and
// they stay, because a nurse asking "what does PGSI 10 mean" needs them.
//
// What they must never do is band a score. A 10/10 on the gambling screen
// means no signs of a problem; PGSI 10 means the opposite. Banding the score
// against the instrument turned a perfect score red. And nine of the pillar
// scores all pointed at the single "stodaeinkunnir" entry, so in hc_results
// they overwrote each other.
//
// So every score gets its own slug on the 0–10 scale, with the legend the
// report itself prints: under 5 Ábótavant, 5–7.5 Sæmilegt, 7.5 and up Gott.
//
//   node --env-file=.env.local scripts/hc-seed-score-knowledge.mjs
//
// Idempotent: upserts on slug.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY vantar."); process.exit(1); }

// The legend the report prints at the foot of every page.
const BANDS = [
  { max: 5, tone: "high", label: "Ábótavant" },
  { max: 7.5, min: 5, tone: "watch", label: "Sæmilegt" },
  { min: 7.5, tone: "good", label: "Gott" },
];

const SOURCES = ["Viðmið Lifeline (samræmd við Lifeline-appið)", "Grunnheilsa-skýrsla, einkunnaskali 0–10"];

/** [slug, title, tags, aliases, summary, body_md] */
const SCORES = [
  ["skor-svefn-vandamal", "Svefn — læknisfræðileg vandamál", ["svefn"], ["svefnvandamál", "svefneinkunn vandamál"],
   "Hversu mikið svefninn er truflaður af einkennum sem þarf að skoða nánar. Lág einkunn kallar á samtal, ekki greiningu.",
   "Þessi einkunn dregur saman svör um svefnleysi, kæfisvefnseinkenni, óreglulegan svefn og dagsyfju.\n\nLág einkunn segir ekki hvað er að — hún segir að hér sé eitthvað sem á að ræða og hugsanlega vísa áfram. Sjá [[svefnlengd]] fyrir sjálfa svefnlengdina og [[beds-7]] fyrir kæfisvefnsskimunina."],
  ["skor-svefn-venjur", "Svefn — venjur", ["svefn"], ["svefnvenjur", "svefneinkunn venjur"],
   "Það sem viðkomandi stýrir sjálfur: fastur fótaferðartími, skjár fyrir svefn, koffín, svefnaðstæður.",
   "Venjur eru þar sem mest er að hafa á fyrstu vikum, því þær breytast hraðar en einkenni.\n\nFastur fótaferðartími er oftast fyrsta aðgerðin: hann dregur hinar með sér. Sjá [[koffin]] og [[skor-koffin]]."],
  ["skor-hreyfing-vandamal", "Hreyfing — læknisfræðileg vandamál", ["hreyfing"], ["hreyfivandamál"],
   "Verkir, stoðkerfisvandi eða annað sem hindrar hreyfingu. Lág einkunn þýðir að áætlunin þarf að taka mið af því.",
   "Þetta er ekki mælikvarði á hreyfingu heldur á hindranir. Lág einkunn er ástæða til að velja æfingar með hliðsjón af verkjum og eftir atvikum fá mat sjúkraþjálfara — ekki til að sleppa hreyfingu."],
  ["skor-hreyfing-venjur", "Hreyfing — venjur", ["hreyfing"], ["hreyfivenjur"],
   "Vikulegt magn þol- og styrktarþjálfunar og hversu regluleg hún er.",
   "Sjá [[hreyfing-vikuskammtur]] og [[styrktarthjalfun]] fyrir sjálf viðmiðin.\n\nEinkunn nálægt núlli þýðir nánast engin skipulögð hreyfing. Þá er dagleg ganga raunhæfari fyrsta aðgerð en æfingaprógramm."],
  ["skor-naering-vandamal", "Næring — læknisfræðileg vandamál", ["næring"], ["næringarvandamál"],
   "Einkenni frá meltingu, frásogsvandi, óþol eða ofnæmi sem hafa áhrif á hvað viðkomandi getur borðað.",
   "Lág einkunn hér þýðir að næringaráætlun þarf að taka mið af einkennum og að rétt getur verið að fá mat læknis eða næringarfræðings."],
  ["skor-naering-venjur", "Næring — venjur", ["næring"], ["næringarvenjur", "mataræði einkunn"],
   "Grænmeti, prótein, trefjar, unnin matvara og sykraðir drykkir.",
   "Sjá [[protein]] og [[trefjar]] fyrir viðmiðin sjálf.\n\nEin breyting í einu skilar mestu: prótein í hverja máltíð, eða trefjar upp, áður en allt mataræðið er tekið í gegn."],
  ["skor-matarhegdun", "Matarhegðun", ["næring", "andlegt"], ["matarhegðun", "át", "áthegðun"],
   "Hvernig borðað er, ekki hvað: kvöldát, át í tilfinningasveiflum, lotur, óreglulegar máltíðir.",
   "Lág einkunn hér getur skýrt af hverju góðar næringarvenjur haldast ekki. Hún er sjaldan leyst með matseðli.\n\nHún er líka vísbending um að tala við sálfræðing þegar mynstrið er fast. Þetta er skimun, ekki greining á átröskun."],
  ["skor-koffin", "Koffín (einkunn)", ["svefn", "næring"], ["koffíneinkunn", "kaffieinkunn"],
   "Einkunn fyrir koffínneyslu — magn og tímasetning. 10 þýðir innan viðmiða og ekki of seint á daginn.",
   "Einkunnin er 0–10 og er ekki það sama og magnið. Sjá [[koffin]] fyrir mg-viðmiðin og helmingunartímann."],
  ["skor-nikotin", "Nikótín", ["fíkn"], ["nikótín", "tóbak", "veip", "níkótínpúðar"],
   "Notkun nikótíns í hvaða formi sem er. 10 þýðir engin notkun.",
   "Nikótín truflar svefn og þrengir æðar. Að hætta er sú einstaka aðgerð sem skilar mestu fyrir hjartaheilsu af öllu sem hægt er að gera í lífsstíl."],
  ["skor-afengi", "Áfengi", ["fíkn"], ["áfengi", "alkóhól", "drykkja"],
   "Magn og mynstur áfengisneyslu. 10 þýðir innan viðmiða eða engin neysla.",
   "Sjá [[audit-c]] og [[audit-10]] fyrir skimunartækin sjálf.\n\nÁfengi kemur fram í lifrarensímum ([[alt]], [[ast]], [[ggt]]) og í þríglýseríðum ([[thriglyserid]]), og það sundrar svefnbyggingunni þótt fólk sofni fyrr."],
  ["skor-onnur-efni", "Önnur efni", ["fíkn"], ["önnur efni", "vímuefni", "kannabis"],
   "Notkun annarra efna en áfengis og nikótíns. 10 þýðir engin notkun.",
   "Spurt er til að áætlunin sé raunhæf og til að vita hvort vísa eigi áfram. Svarið er meðhöndlað sem hver önnur heilsufarsupplýsing og fer ekki út fyrir teymið."],
  ["skor-skjanotkun", "Skjánotkun", ["andlegt", "svefn"], ["skjánotkun", "skjátími", "símanotkun"],
   "Hversu mikið skjánotkun er farin að stjórna tíma og svefni. 10 þýðir í jafnvægi.",
   "Sjá [[skjanotkun-cius]] fyrir CIUS-skimunina sem einkunnin byggir á.\n\nAlgengasta tengingin er við svefn: skjár síðasta klukkutímann fyrir háttatíma seinkar bæði háttatíma og djúpsvefni."],
  ["skor-fjarhaettuspil", "Fjárhættuspil", ["andlegt", "fíkn"], ["fjárhættuspil", "spilavandi", "spilafíkn"],
   "Skimun fyrir vanda vegna fjárhættuspila. 10 þýðir engin merki um vanda.",
   "**Ekki rugla saman við [[pgsi]].** PGSI er 0–27 og þar er hærra verra; þessi einkunn er 0–10 og þar er hærra betra. Tíu hér þýðir engin vandamál, ekki alvarlegan spilavanda."],
  ["skor-andleg-heilsa", "Andleg heilsa", ["andlegt"], ["andleg heilsa", "þunglyndi", "depurð"],
   "Skimun fyrir þunglyndiseinkennum síðustu tvær vikur: depurð, áhugaleysi, orkuleysi, svefntruflanir.",
   "Sjá [[phq-9]] fyrir skimunartækið.\n\nLág einkunn er ástæða til að fá mat læknis eða sálfræðings. Lífsstílsáætlun kemur ekki í staðinn fyrir það, en svefn og hreyfing vinna með meðferð."],
  ["skor-streita", "Streita", ["andlegt"], ["streita", "kvíði", "álag"],
   "Tíðni og alvarleiki kvíða- og streitueinkenna síðustu tvær vikur.",
   "Sjá [[gad-7]] fyrir skimunartækið.\n\nStreita heldur oft svefnvandanum uppi, svo hún er stundum fyrsta stoðin þótt svefneinkunnin sé lægri."],
  ["skor-vellidan", "Almenn vellíðan", ["andlegt"], ["vellíðan", "lífsgæði", "almenn vellíðan"],
   "Hvernig viðkomandi metur sína eigin líðan og lífsgæði í heild.",
   "Þetta er sjálfsmat og gagnast mest í samanburði við endurmat: breyting hér er oft það sem fólk tekur sjálft eftir, áður en mælingarnar hreyfast."],
];

const rows = SCORES.map(([slug, title, tags, aliases, summary, body_md], i) => ({
  slug, category: "score", title, aliases, unit: "0–10", summary, body_md,
  bands: BANDS, higher_better: true, sources: SOURCES, tags,
  sort: 100 + i, active: true, updated_by: "seed",
}));

// Weight is recorded but carries no traffic light of its own — BMI and fat
// percentage do that. Without an entry it landed in hc_results as an
// unrecognised marker.
rows.push({
  slug: "thyngd", category: "body", title: "Þyngd", aliases: ["þyngd", "body weight", "kg"],
  unit: "kg",
  summary: "Skráð til að fylgja þróun. Þyngd ein og sér fær ekkert umferðarljós — sjá BMI og fitumassa.",
  body_md: "Þyngd segir lítið án samhengis: sami maður getur bætt á sig vöðva og lést af fitu án þess að talan hreyfist.\n\nSjá [[bmi]], [[fitumassi]] og [[vodvamassi]]. Þróun yfir mánuði er upplýsandi, dagleg sveifla er vatn.",
  bands: [], higher_better: false, sources: SOURCES, tags: ["mælingar"],
  sort: 60, active: true, updated_by: "seed",
});

const r = await fetch(`${URL}/rest/v1/hc_knowledge?on_conflict=slug`, {
  method: "POST",
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(rows),
});
const body = await r.text();
if (!r.ok) { console.error("Villa:", r.status, body.slice(0, 400)); process.exit(1); }
console.log(`Vistað: ${JSON.parse(body).length} færslur (${SCORES.length} einkunnir + þyngd).`);
