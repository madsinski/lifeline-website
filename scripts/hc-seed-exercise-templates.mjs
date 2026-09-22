// Seeds the health-check exercise templates (hc_exercise_templates) from the
// exercise library (`exercises`, managed in /admin/content). Model: most
// benefit for the least time — big multi-joint movements (squat, hinge, push,
// pull, carry, trunk), two to three full-body sessions a week, daily walking,
// easy cardio plus one interval session, and a three-phase 12-week build-up.
//
// Each item stores exercise_id + a snapshot of picture, video and muscles; the
// name and coaching cues are Icelandic. Keys match hc_plan_templates.
//
//   node scripts/hc-seed-exercise-templates.mjs            # upsert templates
//   node scripts/hc-seed-exercise-templates.mjs --test     # also refresh test patients' plans
//
// Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// library name → Icelandic name + cues
const X = {
  "Marching in Place": ["Ganga á staðnum", ["Lyftu hnjánum rólega og sveiflaðu höndunum.", "Auktu hraðann smám saman."]],
  "World's Greatest Stretch": ["Framstig með snúningi", ["Stígðu langt fram og settu hönd á gólfið innan við fremri fót.", "Snúðu bringunni og teygðu hina höndina upp í loft.", "Skiptu um hlið."]],
  "Arm Circles": ["Handleggjahringir", ["Byrjaðu á litlum hringjum og stækkaðu þá.", "Skiptu um átt eftir hálfa mínútu."]],
  "Cat-Cow": ["Köttur og kýr", ["Á fjórum fótum: sveigðu bakið upp og svo niður.", "Andaðu rólega í takt við hreyfinguna."]],
  "Bodyweight Squat": ["Hnébeygja að stól", ["Fætur í axlarbreidd, tær aðeins út á við.", "Sestu aftur og niður þar til rassinn snertir stólinn.", "Stattu upp með því að ýta í gólfið með öllum fætinum."]],
  "Incline Push-Up": ["Armbeygja við borð", ["Hendur á borðbrún, líkaminn bein lína frá hæl að höfði.", "Láttu bringuna síga að brúninni og ýttu frá.", "Því lægri sem stuðningurinn er, því erfiðari er æfingin."]],
  "Glute Bridges": ["Mjaðmalyfta", ["Liggðu á bakinu með hnén beygð og iljarnar í gólfinu.", "Þrýstu í hælana og lyftu mjöðmunum þar til líkaminn er beinn frá hné að öxl.", "Haltu í eina sekúndu efst."]],
  "Superman": ["Bakfetta á maga", ["Liggðu á maganum með hendur fram.", "Lyftu höndum og fótum örlítið frá gólfinu og haltu í tvær sekúndur.", "Horfðu niður í gólfið."]],
  "Dead Bug": ["Kviðæfing á baki", ["Liggðu á bakinu með hendur upp og hnén í 90°.", "Þrýstu mjóbakinu í gólfið allan tímann.", "Réttu úr gagnstæðri hendi og fæti til skiptis."]],
  "Plank": ["Planki", ["Olnbogar undir öxlum, líkaminn bein lína.", "Spenntu kvið og rass og andaðu rólega."]],
  "Reverse Lunge": ["Afturstig", ["Stígðu langt aftur og láttu aftara hnéð síga að gólfinu.", "Ýttu frá með fremri fætinum og stígðu aftur í upphafsstöðu.", "Haltu í stólbak ef jafnvægið er óstöðugt."]],
  "Pushups": ["Armbeygja", ["Hendur aðeins breiðari en axlir, líkaminn beinn.", "Farðu á hnén ef þarf, það telur jafnt.", "Láttu bringuna síga að gólfinu og ýttu frá."]],
  "Single Leg Glute Bridge": ["Mjaðmalyfta á öðrum fæti", ["Eins og mjaðmalyfta en annar fóturinn er réttur upp.", "Haltu mjöðmunum jöfnum."]],
  "Bird Dog": ["Hönd og fótur á fjórum fótum", ["Á fjórum fótum: réttu úr annarri hendi og gagnstæðum fæti.", "Haltu mjöðmunum kyrrum og bakinu beinu.", "Haltu í tvær sekúndur og skiptu."]],
  "Side Bridge": ["Hliðarplanki", ["Liggðu á hliðinni með olnbogann undir öxlinni.", "Lyftu mjöðmunum þar til líkaminn er beinn.", "Byrjaðu með neðra hnéð í gólfinu."]],
  "Trail Running/Walking": ["Rösk ganga", ["Gakktu það rösklega að þú getir talað en ekki sungið.", "Brekkur gera gönguna áhrifaríkari.", "Má skipta í 3 x 10 mínútur yfir daginn."]],
  "Goblet Squat": ["Hnébeygja með lóð", ["Haltu lóði við bringuna með báðum höndum.", "Sestu niður á milli hælanna með beint bak.", "Ýttu upp í gegnum allan fótinn."]],
  "One-Arm Dumbbell Row": ["Róður með handlóð", ["Styddu annarri hendi og hné á bekk.", "Dragðu lóðið að mjöðminni með olnbogann þétt við líkamann.", "Láttu það síga rólega niður."]],
  "Dumbbell Bench Press": ["Bekkpressa með handlóð", ["Liggðu á bekk með lóðin yfir bringunni.", "Láttu þau síga að bringunni með olnbogana í um 45°.", "Ýttu upp án þess að læsa olnbogunum."]],
  "Romanian Deadlift": ["Rúmensk réttstöðulyfta", ["Stöng eða handlóð fyrir framan lærin.", "Ýttu mjöðmunum aftur og láttu lóðin síga niður eftir lærunum með beint bak.", "Réttu úr þér með því að þrýsta mjöðmunum fram."]],
  "Farmer's Walk": ["Burðarganga", ["Haltu á þungum lóðum í báðum höndum.", "Gakktu með beint bak og axlirnar niður og aftur.", "Stutt og örugg skref."]],
  "Bicycling, Stationary": ["Þrekhjól", ["Jöfn ákefð: þú átt að geta talað í heilum setningum.", "Sund, skokk eða rösk ganga koma í sama stað."]],
  "Rowing, Stationary": ["Lotuþjálfun 4 x 4", ["Hitaðu upp í 10 mínútur á rólegum hraða.", "Fjórar lotur: 4 mínútur rösklega þar sem erfitt er að tala, 3 mínútur rólega á milli.", "Róðrarvél, hjól eða brekkuganga henta öll."]],
  "Dumbbell Lunges": ["Framstig með handlóð", ["Stígðu fram og láttu aftara hnéð síga að gólfinu.", "Hné fremri fótar fylgir tánum.", "Ýttu þér aftur upp."]],
  "Barbell Hip Thrust": ["Mjaðmalyfta með þyngd", ["Herðablöðin á bekk, lóð eða stöng yfir mjöðmunum.", "Lyftu mjöðmunum þar til líkaminn er beinn frá hné að öxl.", "Haltu í eina sekúndu efst."]],
  "Seated Cable Rows": ["Róður í vél", ["Sittu með beint bak og dragðu handfangið að kviðnum.", "Kreistu herðablöðin saman.", "Slakaðu rólega fram."]],
  "Dumbbell Shoulder Press": ["Axlapressa með handlóð", ["Lóðin við axlirnar og kviðurinn spenntur.", "Ýttu beint upp án þess að sveigja bakið.", "Láttu síga rólega niður."]],
  "Pallof Press": ["Pallof-pressa", ["Stattu á hlið við teygju eða kaðal með handfangið við bringuna.", "Ýttu höndunum beint fram og haltu í tvær sekúndur án þess að snúast.", "Skiptu um hlið."]],
  "Barbell Deadlift": ["Réttstöðulyfta", ["Stöngin yfir miðjum fæti og bakið beint.", "Ýttu gólfinu frá þér og réttu úr mjöðmum og hnjám samtímis.", "Lærðu tæknina með léttri þyngd fyrst."]],
  "Split Squat with Dumbbells": ["Klofbeygja með handlóð", ["Annar fótur fram, hinn aftur, lóð í höndunum.", "Láttu aftara hnéð síga beint niður.", "Kláraðu allar endurtekningarnar og skiptu svo."]],
  "Dumbbell Step Ups": ["Uppstig með handlóð", ["Stígðu upp á kassa eða bekk í hnéhæð.", "Ýttu upp með fremri fætinum, ekki spyrna með þeim aftari.", "Stígðu rólega niður."]],
  "Chin-Up": ["Upphífing", ["Undirgrip í axlarbreidd.", "Dragðu hökuna upp fyrir stöngina.", "Notaðu teygju eða vél til stuðnings ef þarf."]],
  "One-Arm Kettlebell Swings": ["Ketilbjöllusveifla", ["Mjaðmirnar vinna verkið, ekki handleggirnir.", "Þrýstu mjöðmunum kröftuglega fram og láttu bjölluna fljóta upp í brjósthæð.", "Beint bak allan tímann."]],
  "Band Pull Apart": ["Teygjutog", ["Haltu teygju í axlarhæð með beinum höndum.", "Dragðu hana í sundur að bringunni og kreistu herðablöðin saman.", "Slakaðu rólega til baka."]],
  "Step-Up": ["Uppstig", ["Stígðu upp á lágan pall eða neðstu tröppu.", "Haltu í handrið ef þarf.", "Skiptu um fót."]],
  "Swimming": ["Sund", ["Jöfn og róleg ákefð.", "Vatnið léttir álagið á liðina."]],
  "Elliptical Trainer": ["Skíðavél", ["Lítið álag á liðina og jöfn ákefð.", "Þú átt að geta talað í heilum setningum."]],
  "Child's Pose": ["Barnsstaða", ["Sestu á hælana og teygðu hendurnar fram á gólfið.", "Andaðu djúpt og rólega í eina mínútu."]],
};

// [library name, prescription, rest|null, block, note?]
const w = (n, p, note) => [n, p, null, "warmup", note];
const m = (n, p, rest = "60–90 sek", note) => [n, p, rest, "main", note];
const f = (n, p, note) => [n, p, null, "finisher", note];

const PRINCIPLES_BASE = [
  "Stórar hreyfingar fyrst: hnébeygja, mjaðmalyfta, að ýta og toga. Þær nota flesta vöðva á stystum tíma.",
  "Tvær styrktaræfingar á viku skila stærstum hluta ávinningsins. Þriðja æfingin er bónus.",
  "Síðustu 2–3 endurtekningarnar eiga að vera krefjandi en tæknin helst góð.",
  "Bættu smám saman við: einni endurtekningu, einu setti eða aðeins meiri þyngd.",
  "Rösk ganga á hverjum degi telur. Þú átt að geta talað en ekki sungið.",
  "Samkvæmni skiptir meira máli en fullkomnun. Stutt æfing er betri en engin.",
];

const PROGRESSION = [
  { weeks: "Vika 1–4", title: "Læra hreyfingarnar", text: "Tvö sett af hverri æfingu. Einbeittu þér að tækninni og hættu þegar 3–4 endurtekningar eru eftir í tankinum." },
  { weeks: "Vika 5–8", title: "Byggja upp", text: "Þrjú sett. Þegar þú nærð efri mörkum endurtekninga í öllum settum skaltu auka þyngdina eða velja erfiðari útgáfu." },
  { weeks: "Vika 9–12", title: "Styrkja og festa", text: "Síðustu endurtekningarnar eru krefjandi. Haltu taktinum í vikunni og undirbúðu endurmatið í viku 12." },
];

const TEMPLATES = [
  {
    key: "byrjandi-heima", name: "Grunnur heima", level: "beginner", goal: "Koma hreyfingu af stað án búnaðar",
    session_minutes: 25,
    description: "Tvær stuttar styrktaræfingar fyrir allan líkamann heima og rösk ganga. Enginn búnaður nema stóll og gólfpláss.",
    principles: PRINCIPLES_BASE,
    sessions: [
      { day: "Mánudagur", title: "Allur líkaminn A", focus: "Styrkur", minutes: 25, items: [
        w("Marching in Place", "2 mín"), w("World's Greatest Stretch", "3 á hlið"),
        m("Bodyweight Squat", "3 x 10"), m("Incline Push-Up", "3 x 8–12"), m("Glute Bridges", "3 x 12"),
        m("Superman", "3 x 10", "45 sek"), f("Dead Bug", "2 x 8 á hlið"),
      ] },
      { day: "Miðvikudagur", title: "Rösk ganga", focus: "Þol", minutes: 30, items: [m("Trail Running/Walking", "30 mín", null)] },
      { day: "Föstudagur", title: "Allur líkaminn B", focus: "Styrkur", minutes: 25, items: [
        w("Arm Circles", "1 mín"), w("Cat-Cow", "1 mín"),
        m("Reverse Lunge", "3 x 8 á fót"), m("Pushups", "3 x 6–10", "60–90 sek", "Á hnjánum ef þarf."),
        m("Single Leg Glute Bridge", "3 x 8 á fót"), m("Bird Dog", "3 x 8 á hlið", "45 sek"),
        f("Side Bridge", "2 x 20 sek á hlið"),
      ] },
    ],
  },
  {
    key: "thol-og-styrkur", name: "Þol og styrkur", level: "intermediate", goal: "Byggja upp þol og styrk samhliða",
    session_minutes: 40,
    description: "Tvær styrktaræfingar, ein löng og róleg þolæfing og ein lotuæfing á viku. Rösk ganga aðra daga.",
    principles: [
      ...PRINCIPLES_BASE.slice(0, 4),
      "Flestar þolæfingar eru rólegar (þú getur talað). Ein lotuæfing á viku er nóg til að auka þolið hratt.",
      "Samkvæmni skiptir meira máli en fullkomnun. Stutt æfing er betri en engin.",
    ],
    sessions: [
      { day: "Mánudagur", title: "Styrkur A", focus: "Allur líkaminn", minutes: 40, items: [
        w("World's Greatest Stretch", "3 á hlið"), w("Arm Circles", "1 mín"),
        m("Goblet Squat", "3 x 8–12", "90 sek"), m("One-Arm Dumbbell Row", "3 x 10 á hlið"),
        m("Dumbbell Bench Press", "3 x 8–12"), m("Romanian Deadlift", "3 x 10", "90 sek", "Handlóð í stað stangar er í lagi."),
        f("Farmer's Walk", "3 x 30 m"),
      ] },
      { day: "Þriðjudagur", title: "Jöfn ákefð", focus: "Þol", minutes: 35, items: [m("Bicycling, Stationary", "30–40 mín", null)] },
      { day: "Fimmtudagur", title: "Lotuþjálfun", focus: "Hærri púls", minutes: 38, items: [m("Rowing, Stationary", "4 x 4 mín", "3 mín rólega")] },
      { day: "Laugardagur", title: "Styrkur B", focus: "Allur líkaminn", minutes: 40, items: [
        w("Marching in Place", "2 mín"), w("Cat-Cow", "1 mín"),
        m("Dumbbell Lunges", "3 x 8 á fót"), m("Barbell Hip Thrust", "3 x 10"), m("Seated Cable Rows", "3 x 10–12"),
        m("Dumbbell Shoulder Press", "3 x 8–10"), f("Pallof Press", "2 x 10 á hlið"), f("Plank", "2 x 30 sek"),
      ] },
    ],
  },
  {
    key: "styrkur-likamsraekt", name: "Styrkur í líkamsrækt", level: "intermediate", goal: "Byggja upp styrk og vöðvamassa",
    session_minutes: 50,
    description: "Þrjár æfingar fyrir allan líkamann í líkamsræktarstöð, hver með sína áherslu. Þrjár til fjórar aðalæfingar og stutt lokaæfing.",
    principles: PRINCIPLES_BASE,
    sessions: [
      { day: "Mánudagur", title: "Allur líkaminn A", focus: "Hnébeygja og ýta", minutes: 50, items: [
        w("World's Greatest Stretch", "3 á hlið"), w("Band Pull Apart", "15"),
        m("Goblet Squat", "4 x 6–10", "2 mín"), m("Dumbbell Bench Press", "3 x 8–10", "90 sek"),
        m("Seated Cable Rows", "3 x 10–12"), m("Romanian Deadlift", "3 x 8–10", "90 sek"), f("Farmer's Walk", "3 x 30 m"),
      ] },
      { day: "Miðvikudagur", title: "Allur líkaminn B", focus: "Réttstaða og toga", minutes: 50, items: [
        w("Cat-Cow", "1 mín"), w("Arm Circles", "1 mín"),
        m("Barbell Deadlift", "4 x 5", "2 mín"), m("Split Squat with Dumbbells", "3 x 8 á fót"),
        m("Dumbbell Shoulder Press", "3 x 8–10"), m("One-Arm Dumbbell Row", "3 x 10 á hlið"), f("Pallof Press", "2 x 10 á hlið"),
      ] },
      { day: "Föstudagur", title: "Allur líkaminn C", focus: "Einn fótur og kraftur", minutes: 45, items: [
        w("World's Greatest Stretch", "3 á hlið"), w("Marching in Place", "2 mín"),
        m("Dumbbell Step Ups", "3 x 8 á fót"), m("Barbell Hip Thrust", "3 x 8–12"), m("Pushups", "3 x 8–15"),
        m("Chin-Up", "3 x 5–8", "2 mín", "Með teygju eða í vél ef þarf."), f("One-Arm Kettlebell Swings", "3 x 12 á hönd"), f("Plank", "2 x 40 sek"),
      ] },
    ],
  },
  {
    key: "lidvaent", name: "Liðvæn hreyfing", level: "beginner", goal: "Hreyfing með litlu álagi á liði",
    session_minutes: 30,
    description: "Styrkur og þol án högga og stökka. Hentar vel með stoðkerfisverki eða aukna líkamsþyngd. Hreyfingarnar eru hægar og stýrðar.",
    principles: [
      "Stórar hreyfingar með stuðningi: stóll, borð og handrið gera æfingarnar öruggar.",
      "Tvær styrktaræfingar á viku skila stærstum hluta ávinningsins.",
      "Hreyfðu þig innan sársaukalausra marka. Smá óþægindi eru í lagi, skarpur verkur ekki.",
      "Hjól, sund og skíðavél gefa þol án högga á liðina.",
      "Bættu smám saman við: einni endurtekningu eða einu setti í einu.",
    ],
    sessions: [
      { day: "Mánudagur", title: "Styrkur með stuðningi", focus: "Allur líkaminn", minutes: 30, items: [
        w("Bicycling, Stationary", "8 mín"),
        m("Bodyweight Squat", "3 x 8–10"), m("Incline Push-Up", "3 x 8–10"), m("Band Pull Apart", "3 x 12", "45 sek"),
        m("Glute Bridges", "3 x 10"), m("Bird Dog", "2 x 6 á hlið", "45 sek"), f("Child's Pose", "1 mín"),
      ] },
      { day: "Miðvikudagur", title: "Þol án högga", focus: "Þol", minutes: 30, items: [
        m("Swimming", "25–30 mín", null, "Eða skíðavél í sama tíma."),
      ] },
      { day: "Föstudagur", title: "Styrkur og jafnvægi", focus: "Allur líkaminn", minutes: 30, items: [
        w("Elliptical Trainer", "8 mín"),
        m("Step-Up", "3 x 8 á fót"), m("Seated Cable Rows", "3 x 10–12"), m("Pallof Press", "2 x 10 á hlið", "45 sek"),
        m("Single Leg Glute Bridge", "2 x 8 á fót"), m("Side Bridge", "2 x 15 sek á hlið", "45 sek"), f("Child's Pose", "1 mín"),
      ] },
    ],
  },
];

const names = [...new Set(TEMPLATES.flatMap((t) => t.sessions.flatMap((s) => s.items.map((i) => i[0]))))];
const q = new URLSearchParams({ select: "id,name,equipment,illustration_url,video_url,primary_muscles,secondary_muscles", name: `in.(${names.map((n) => `"${n}"`).join(",")})` });
const lib = await (await fetch(`${URL_}/rest/v1/exercises?${q}`, { headers: H })).json();
const byName = new Map();
for (const r of lib) {
  const cur = byName.get(r.name);
  if (!cur || (!cur.video_url && r.video_url)) byName.set(r.name, r);
}
const missing = names.filter((n) => !byName.has(n));
if (missing.length) { console.error("Not in library:", missing); process.exit(1); }

const rows = TEMPLATES.map((t) => ({
  key: t.key, name: t.name, level: t.level, goal: t.goal, description: t.description,
  days_per_week: t.sessions.length, session_minutes: t.session_minutes,
  principles: t.principles, progression: PROGRESSION, active: true, updated_at: new Date().toISOString(),
  sessions: t.sessions.map((s) => ({
    day: s.day, title: s.title, focus: s.focus, minutes: s.minutes,
    items: s.items.map(([n, prescription, rest, block, note]) => {
      const r = byName.get(n);
      const [is, cues] = X[n] ?? [n, []];
      return {
        name: is, prescription, rest, block, note: note ?? null, cues,
        exercise_id: r.id, image: r.illustration_url, video: r.video_url, equipment: r.equipment,
        muscles: [...(r.primary_muscles ?? []), ...(r.secondary_muscles ?? [])].slice(0, 4),
      };
    }),
  })),
}));

const up = await fetch(`${URL_}/rest/v1/hc_exercise_templates?on_conflict=key`, {
  method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows),
});
if (!up.ok) { console.error(await up.text()); process.exit(1); }
console.log(`Upserted ${rows.length} templates:`, rows.map((r) => `${r.key} (${r.sessions.reduce((n, s) => n + s.items.length, 0)} æfingar)`).join(", "));

if (process.argv.includes("--test")) {
  const plans = await (await fetch(`${URL_}/rest/v1/hc_action_plans?select=id,exercise&created_by=eq.prufug%C3%B6gn`, { headers: H })).json();
  for (const p of plans) {
    const key = p.exercise?.key?.replace(/-custom$/, "");
    const t = rows.find((r) => r.key === key);
    if (!t) continue;
    const { active: _a, updated_at: _u, ...copy } = t;
    const r = await fetch(`${URL_}/rest/v1/hc_action_plans?id=eq.${p.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ exercise: copy }) });
    console.log(`test plan ${p.id.slice(0, 8)} → ${key}: ${r.status}`);
  }
}
