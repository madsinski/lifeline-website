// Exercise and nutrition presets, built on Lifeline's principles.
//
// A preset is a skeleton, not a finished programme: it fixes how many
// sessions a week, what each one is for, and the progression — the things
// that should not be improvised per client. The actual exercises come from
// the library (976 of them) and the meals from the meal library (110), and
// the AI composer fills them in against this shape.
//
// The principles the skeletons follow:
//   • Big movements first: hnébeygja, mjaðmalyfta, ýta, toga, bera.
//   • Two strength sessions a week beats five planned and two done.
//   • Zone 2 is the base; one hard session a week on top of it, not instead.
//   • Samkvæmni fram yfir fullkomnun — the plan a person keeps is the plan
//     that works, so every preset states the minimum that still counts.
//
//   node --env-file=.env.local scripts/hc-seed-programs.mjs
//
// Idempotent: upserts on key.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY vantar."); process.exit(1); }

const S = (day, title, focus, minutes, items) => ({ day, title, focus, minutes, items });
const I = (name, prescription, note = null) => ({ name, prescription, note });

const EXERCISE = [
  {
    key: "minnsti-timi", name: "Minnsti tími", level: "beginner",
    goal: "Fyrir þá sem hafa engan tíma — tvær æfingar á viku og ekkert annað",
    days_per_week: 2, session_minutes: 30,
    description: "Tvær heilar æfingar á viku. Þetta er lágmarkið sem enn skilar árangri, og það er betra en fimm æfingar sem verða þrjár og svo engin.",
    principles: [
      "Allur líkaminn í hverri æfingu — engir „fótadagar“ sem falla niður.",
      "Stórar hreyfingar: hnébeygja, mjaðmalyfta, ýta, toga.",
      "Þrjár lotur af hverju, 8–12 endurtekningar, tvær endurtekningar eftir í tanknum.",
      "Dagleg ganga fyrir utan þetta — hún telur ekki sem æfing heldur sem grunnur.",
    ],
    progression: "Vikur 1–2: læra hreyfingarnar með léttri þyngd. Vikur 3–6: auka þyngd um 2,5–5% þegar allar lotur næst með góðri tækni. Vikur 7–12: bæta við fjórðu lotu í stærstu hreyfingunum.",
    sessions: [
      S("Mánudagur", "Allur líkaminn A", "Hnébeygja og ýta", 30, [
        I("Hnébeygja", "3 × 8–12"), I("Bekkpressa eða axlapressa", "3 × 8–12"),
        I("Róður", "3 × 8–12"), I("Planki", "3 × 30–45 sek."),
      ]),
      S("Fimmtudagur", "Allur líkaminn B", "Mjaðmalyfta og toga", 30, [
        I("Mjaðmalyfta eða réttstöðulyfta", "3 × 6–10"), I("Upphífing með teygju eða niðurtog", "3 × 8–12"),
        I("Framstig", "3 × 10 á hvorn fót"), I("Farmer's carry", "3 × 30 metrar"),
      ]),
    ],
  },
  {
    key: "efnaskipti", name: "Efnaskipti og blóðsykur", level: "intermediate",
    goal: "Þegar blóðsykur, insúlín eða HOMA-IR eru utan viðmiða",
    days_per_week: 5, session_minutes: 40,
    description: "Styrkur tvisvar, zone 2 þrisvar, og ganga eftir stærstu máltíð daglega. Vöðvarnir taka upp sykur úr blóðinu án insúlíns þegar þeir vinna — þess vegna er styrktarþjálfun hér ekki valfrjáls.",
    principles: [
      "Styrktarþjálfun tvisvar í viku er stærsta einstaka breytan á insúlínnæmi.",
      "Zone 2: hraði þar sem þú getur talað, 30–45 mínútur.",
      "Tíu til fimmtán mínútna ganga eftir stærstu máltíðinni, alla daga.",
      "Ekki æfa fastandi fyrstu vikurnar ef blóðsykur er óstöðugur.",
    ],
    progression: "Vikur 1–4: byggja upp zone 2 í 45 mínútur. Vikur 5–8: auka þyngd í styrk. Vikur 9–12: bæta við einni háákefðarlotu á viku.",
    sessions: [
      S("Mánudagur", "Styrkur — allur líkaminn", "Stórar hreyfingar", 40, [
        I("Hnébeygja", "3 × 8–10"), I("Axlapressa", "3 × 8–12"),
        I("Niðurtog", "3 × 8–12"), I("Kviðæfing", "3 × 12"),
      ]),
      S("Þriðjudagur", "Zone 2", "Rösk ganga, hjól eða sund", 40, [I("Zone 2", "40 mín. á hraða þar sem þú getur talað")]),
      S("Miðvikudagur", "Zone 2", "Rösk ganga, hjól eða sund", 40, [I("Zone 2", "40 mín.")]),
      S("Fimmtudagur", "Styrkur — allur líkaminn", "Mjaðmir og bak", 40, [
        I("Mjaðmalyfta", "3 × 6–10"), I("Bekkpressa", "3 × 8–12"),
        I("Róður", "3 × 8–12"), I("Farmer's carry", "3 × 30 m"),
      ]),
      S("Laugardagur", "Zone 2", "Lengri ganga eða hjól", 50, [I("Zone 2", "50 mín.")]),
    ],
  },
  {
    key: "blodthrystingur", name: "Hjarta og blóðþrýstingur", level: "beginner",
    goal: "Þegar blóðþrýstingur er yfir viðmiðum",
    days_per_week: 5, session_minutes: 35,
    description: "Þolþjálfun er það sem hreyfir blóðþrýsting mest, svo hún er uppistaðan. Léttur styrkur með, en engar þungar lotur með haldið niðri í sér andanum.",
    principles: [
      "150 mínútur af þolþjálfun á viku, skipt á flesta daga.",
      "Léttari þyngd og fleiri endurtekningar (12–15) — andaðu út í átakinu.",
      "Ekki Valsalva: engin þung lyfting með haldið niðri í sér andanum.",
      "Mældu blóðþrýsting einu sinni í viku, alltaf á sama tíma dags.",
    ],
    progression: "Vikur 1–3: 20 mínútur á dag. Vikur 4–8: 30–35 mínútur. Vikur 9–12: bæta við smá halla eða hraða, ekki tíma.",
    sessions: [
      S("Mánudagur", "Þol", "Rösk ganga", 35, [I("Rösk ganga", "35 mín., þú getur talað en ekki sungið")]),
      S("Þriðjudagur", "Léttur styrkur", "Allur líkaminn", 30, [
        I("Hnébeygja með eigin þyngd eða léttri stöng", "3 × 12–15"),
        I("Axlapressa með handlóðum", "3 × 12–15"), I("Róður í vél", "3 × 12–15"),
      ]),
      S("Miðvikudagur", "Þol", "Hjól eða sund", 35, [I("Þol", "35 mín.")]),
      S("Föstudagur", "Léttur styrkur", "Allur líkaminn", 30, [
        I("Mjaðmalyfta með léttri þyngd", "3 × 12–15"),
        I("Brjóstpressa í vél", "3 × 12–15"), I("Niðurtog", "3 × 12–15"),
      ]),
      S("Sunnudagur", "Þol", "Lengri ganga", 45, [I("Ganga", "45 mín.")]),
    ],
  },
  {
    key: "verkir-adlagad", name: "Aðlagað vegna verkja", level: "beginner",
    goal: "Þegar verkir eða stoðkerfisvandi hindra hreyfingu",
    days_per_week: 3, session_minutes: 30,
    description: "Að hætta alveg er verri kostur en að aðlaga. Hreyfingar valdar til að forðast það sem er aumt, álag aukið hægar en venjulega, og sjúkraþjálfari með í ráðum.",
    principles: [
      "Verkur upp í 3 af 10 á meðan og horfinn innan sólarhrings er í lagi.",
      "Aukning í álagi ekki meira en 10% í viku.",
      "Vélar og stuðningur fremur en frjáls þyngd fyrstu vikurnar.",
      "Mat sjúkraþjálfara ef verkur stýrir hreyfingunni — þetta kemur ekki í staðinn fyrir það.",
    ],
    progression: "Vikur 1–4: læra hreyfiferilinn án þyngdar. Vikur 5–8: þyngd sem leyfir 12–15 endurtekningar. Vikur 9–12: auka umfang, ekki þyngd.",
    sessions: [
      S("Mánudagur", "Neðri líkami", "Stuðningur og vélar", 30, [
        I("Fótapressa", "3 × 12–15"), I("Mjaðmabrú á gólfi", "3 × 12"),
        I("Kálfalyftur", "3 × 15"), I("Jafnvægi á öðrum fæti", "3 × 20 sek."),
      ]),
      S("Miðvikudagur", "Efri líkami", "Sitjandi og með stuðningi", 30, [
        I("Brjóstpressa í vél", "3 × 12–15"), I("Niðurtog", "3 × 12–15"),
        I("Axlalyftur með léttum lóðum", "2 × 15"),
      ]),
      S("Föstudagur", "Kjarni og hreyfanleiki", "Mjúkt", 25, [
        I("Fugl-hundur", "3 × 8 á hvora hlið"), I("Hliðarplanki á hnjám", "3 × 20 sek."),
        I("Mjaðmahreyfanleiki", "5 mín."),
      ]),
    ],
  },
  {
    key: "thol-upp", name: "Þol upp", level: "advanced",
    goal: "Þegar grunnurinn er kominn og hámarkssúrefnisupptaka er markmiðið",
    days_per_week: 5, session_minutes: 50,
    description: "Zone 2 sem grunnur og ein erfið lota á viku ofan á hann — ekki í staðinn fyrir hann. Þetta er sá hluti þjálfunar sem hækkar VO2max mest, og VO2max er einn sterkasti mælikvarðinn á langlífi.",
    principles: [
      "Áttatíu prósent af tímanum í zone 2, tuttugu prósent hart.",
      "Ein 4×4 lota á viku: fjórar mínútur harðar, fjórar rólegar, fjórum sinnum.",
      "Styrkur tvisvar í viku heldur áfram — þol kemur ekki í staðinn fyrir hann.",
      "Einn heill hvíldardagur. Framfarir verða í hvíldinni.",
    ],
    progression: "Vikur 1–4: byggja zone 2 upp í 60 mínútur. Vikur 5–8: bæta 4×4 lotunni við. Vikur 9–12: tvær hörðar lotur í viku ef hvíldin leyfir.",
    sessions: [
      S("Mánudagur", "Styrkur", "Stórar hreyfingar", 45, [
        I("Hnébeygja", "4 × 5–8"), I("Bekkpressa", "4 × 5–8"), I("Róður", "3 × 8–10"),
      ]),
      S("Þriðjudagur", "Zone 2", "Hjól eða skokk", 60, [I("Zone 2", "60 mín.")]),
      S("Miðvikudagur", "4×4 lotur", "Hart", 35, [I("4×4", "4 mín. hart / 4 mín. rólegt × 4, með upphitun og niðurlagi")]),
      S("Fimmtudagur", "Styrkur", "Mjaðmir og bak", 45, [
        I("Réttstöðulyfta", "4 × 4–6"), I("Upphífing", "4 × 6–10"), I("Framstig", "3 × 10"),
      ]),
      S("Laugardagur", "Zone 2 langt", "Lengsta æfing vikunnar", 75, [I("Zone 2", "75 mín.")]),
    ],
  },
  {
    key: "stodugleiki", name: "Stöðugleiki og styrkur", level: "beginner",
    goal: "Þegar jafnvægi, byltuhætta eða sjálfstæði með aldri er í fyrirrúmi",
    days_per_week: 3, session_minutes: 35,
    description: "Styrkur og jafnvægi saman. Jafnvægi tapast hljóðlega og er það sem ræður sjálfstæði síðar á ævinni — og það er þjálfanlegt á hverjum aldri.",
    principles: [
      "Jafnvægi í hverri æfingu, ekki sem sérstakur dagur.",
      "Að standa upp úr stól án að styðja sig er markmið, ekki æfing.",
      "Gripstyrkur telur: berðu þungt, stutta vegalengd.",
      "Aldrei jafnvægisæfing án þess að hafa eitthvað til að grípa í.",
    ],
    progression: "Vikur 1–4: jafnvægi með stuðningi. Vikur 5–8: án stuðnings. Vikur 9–12: jafnvægi á ójöfnu undirlagi eða með hreyfingu.",
    sessions: [
      S("Mánudagur", "Styrkur og jafnvægi", "Neðri líkami", 35, [
        I("Upp úr stól", "3 × 10"), I("Framstig með stuðningi", "3 × 8 á hvorn fót"),
        I("Standa á öðrum fæti", "3 × 20 sek. á hvorn"), I("Kálfalyftur", "3 × 15"),
      ]),
      S("Miðvikudagur", "Styrkur og grip", "Efri líkami", 35, [
        I("Róður með teygju", "3 × 12"), I("Axlapressa", "3 × 10"),
        I("Farmer's carry", "3 × 20 m"), I("Hælar og tær eftir línu", "3 × 10 skref"),
      ]),
      S("Föstudagur", "Allur líkaminn", "Hreyfanleiki og kjarni", 30, [
        I("Mjaðmabrú", "3 × 12"), I("Fugl-hundur", "3 × 8"),
        I("Hliðarskref með teygju", "3 × 10"), I("Standa á öðrum fæti með augun lokuð", "3 × 10 sek."),
      ]),
    ],
  },
];

const D = (meal, example) => ({ meal, example });

const NUTRITION = [
  {
    key: "protein-fokus", name: "Prótein í fókus",
    goal: "Þegar prótein er undir viðmiðum eða vöðvamassi er lágur",
    description: "Um 1,6 g prótein á hvert kíló líkamsþyngdar, skipt á máltíðir. Prótein heldur mettun lengur en nokkuð annað og er efniviðurinn í vöðvann sem styrktarþjálfunin byggir.",
    principles: [
      "Þrjátíu grömm af próteini í hverja máltíð, þrjár máltíðir.",
      "Morgunmaturinn er sú máltíð sem oftast vantar prótein — byrjaðu þar.",
      "Ekki sleppa próteini á æfingadögum, hvorki fyrir né eftir.",
      "Kjöt, fiskur, egg, mjólkurvörur, baunir og linsur — fjölbreytni fremur en hylki.",
    ],
    day_example: [
      D("Morgunmatur", "Skyr með berjum og hnetum, eða tvö egg og gróft brauð"),
      D("Hádegi", "Kjúklingur eða lax með byggi og grænmeti"),
      D("Millimál", "Kotasæla eða handfylli af hnetum"),
      D("Kvöldmatur", "Baunabuff eða fiskur, kartöflur og hálfur diskur grænmeti"),
    ],
  },
  {
    key: "trefjar", name: "Trefjar og þarmaflóra",
    goal: "Þegar trefjar eru undir viðmiðum, kólesteról hátt eða meltingin óregluleg",
    description: "Þrjátíu grömm af trefjum á dag og þrjátíu ólíkar plöntur í viku. Trefjar hægja á blóðsykri, lækka kólesteról og næra þarmaflóruna — og fjölbreytnin er það sem hún svarar.",
    principles: [
      "Þrjátíu grömm á dag, aukið hægt — of hratt og þú finnur fyrir því.",
      "Þrjátíu ólíkar plöntur í viku: grænmeti, ávextir, baunir, hnetur, fræ, heilkorn.",
      "Hafrar, baunir og bygg eru leysanlegar trefjar og þær hreyfa kólesterólið.",
      "Vatn með trefjunum, annars verður þetta verra og ekki betra.",
    ],
    day_example: [
      D("Morgunmatur", "Hafragrautur með hörfræjum, berjum og hnetum"),
      D("Hádegi", "Baunasalat með byggi, tómötum og ólífuolíu"),
      D("Millimál", "Epli og handfylli af möndlum"),
      D("Kvöldmatur", "Linsubaunapottur með rótargrænmeti og grófu brauði"),
    ],
  },
  {
    key: "thyngdarstjornun", name: "Þyngdarstjórnun",
    goal: "Þegar BMI eða fitumassi er yfir viðmiðum",
    description: "Prótein og trefjar í hverja máltíð, fljótandi kaloríur út, og styrktarþjálfun með — svo það sem fer sé fita og ekki vöðvi. Hægur halli heldur lengur en harður.",
    principles: [
      "Prótein og trefjar í hverja máltíð — mettun fremur en talning.",
      "Engar fljótandi kaloríur: gos, safi, alkóhól, sykrað kaffi.",
      "Skammtað á disk í eldhúsinu, potturinn verður eftir þar.",
      "Styrktarþjálfun tvisvar í viku, annars fer vöðvi með fitunni.",
      "Vigtin sveiflast um kíló frá degi til dags. Vikumeðaltal segir söguna.",
    ],
    day_example: [
      D("Morgunmatur", "Egg og grænmeti, eða skyr með berjum"),
      D("Hádegi", "Stór salatskál með kjúklingi eða baunum og ólífuolíu"),
      D("Millimál", "Gulrætur og hummus, eða hrein jógúrt"),
      D("Kvöldmatur", "Fiskur eða kjöt, hálfur diskur grænmeti, handfylli kolvetni"),
    ],
  },
  {
    key: "lifur-afengi", name: "Lifur og áfengi",
    goal: "Þegar ALAT, ASAT eða þríglýseríð eru yfir viðmiðum",
    description: "Áfengi og fljótandi sykur eru það tvennt sem lifrargildi svara hraðast. Fjórar til sex vikur af áfengislausum dögum sjást oft í næstu blóðprufu.",
    principles: [
      "Minnst fjórir áfengislausir dagar í viku — fleiri ef gildin eru langt yfir.",
      "Engir sykraðir drykkir. Frúktósi fer beint í lifrina.",
      "Draga úr gjörunninni matvöru fremur en að telja fitu.",
      "Fimm prósent þyngdartap lækkar lifrarfitu mælanlega ef þyngd er yfir viðmiðum.",
      "Ræddu fæðubótarefni við lækni — sum þeirra hlaða á lifrina.",
    ],
    day_example: [
      D("Morgunmatur", "Hafragrautur með berjum, vatn eða svart kaffi"),
      D("Hádegi", "Lax eða baunir með grænmeti og ólífuolíu"),
      D("Millimál", "Hnetur og epli"),
      D("Kvöldmatur", "Kjúklingur, kartöflur og stórt salat — enginn drykkur með nema vatn"),
    ],
  },
  {
    key: "matarhegdun", name: "Matarhegðun og máltíðaskipulag",
    goal: "Þegar matarhegðun er ábótavant — kvöldát, lotur eða tilfinningaát",
    description: "Þetta er sjaldan leyst með matseðli. Fastar máltíðir, engin skjár við borðið, og svefn og streita tekin með — þau stýra þessu oftar en maturinn sjálfur.",
    principles: [
      "Þrjár máltíðir á föstum tímum. Að sleppa máltíð er það sem býr til lotuna.",
      "Ekki borða fyrir framan skjá.",
      "Eldhúsinu lokað eftir kvöldmat — ákveðið fyrirfram, ekki í augnablikinu.",
      "Svefn og streita fyrst: sjö tímar breyta matarlyst meira en nokkur regla um mat.",
      "Stuðningur sálfræðings þegar mynstrið er fast. Það er ekki uppgjöf.",
    ],
    day_example: [
      D("Morgunmatur", "kl. 8 — skyr eða egg, alltaf eitthvað"),
      D("Hádegi", "kl. 12 — heil máltíð, sest niður, enginn skjár"),
      D("Millimál", "kl. 15 — ávöxtur og hnetur, ákveðið fyrirfram"),
      D("Kvöldmatur", "kl. 19 — heil máltíð. Eldhúsinu lokað eftir hana"),
    ],
  },
];

async function up(table, rows) {
  const r = await fetch(`${URL}/rest/v1/${table}?on_conflict=key`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows.map((x) => ({ ...x, active: true }))),
  });
  const body = await r.text();
  if (!r.ok) { console.error(table, r.status, body.slice(0, 400)); process.exit(1); }
  console.log(`${table}: ${JSON.parse(body).length} vistuð.`);
}

await up("hc_exercise_templates", EXERCISE);
await up("hc_nutrition_templates", NUTRITION);
