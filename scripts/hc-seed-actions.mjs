// What moves each value, in both directions.
//
// The report view teaches rather than just reports: every row opens to show
// its reference range, why the number matters, and what pushes it the right
// way or the wrong way. This fills the last two.
//
// Lifestyle levers only, phrased as what tends to move a number. Nothing here
// diagnoses, treats or prescribes — where that is the answer, the line says to
// take it to the doctor, because the clinical report lives in Medalia.
//
//   node --env-file=.env.local scripts/hc-seed-actions.mjs
//
// Idempotent: patches improves/worsens on existing rows, creates nothing.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY vantar."); process.exit(1); }

/** slug: [improves, worsens] */
const A = {
  // ── Efnaskipti ────────────────────────────────────────────────────────
  "fastandi-blodsykur": [
    ["Ganga í 10–15 mínútur eftir stærstu máltíðina", "Skipta sykruðum drykkjum út fyrir vatn", "Styrktarþjálfun tvisvar í viku — vöðvar taka upp sykur", "Sjö til níu klukkustunda svefn"],
    ["Sykraðir drykkir og sætindi milli mála", "Nætursvefn undir sex klukkustundum", "Langar setur án þess að standa upp", "Áfengi að kvöldi"],
  ],
  insulin: [
    ["Minnka fín kolvetni í stærstu máltíðunum", "Styrktarþjálfun tvisvar til þrisvar í viku", "Léttast um 5% ef þyngd er yfir viðmiðum", "Reglulegur svefn"],
    ["Tíð snarl yfir daginn", "Sykraðir drykkir", "Svefnskuldir", "Kviðfita"],
  ],
  hba1c: [
    ["Sömu aðgerðir og fyrir fastandi blóðsykur — hér mælast þær í mánuðum", "Trefjar upp í 30 g á dag", "Dagleg hreyfing, líka létt"],
    ["Viðvarandi sykrað mataræði", "Hreyfingarleysi vikum saman"],
  ],
  "homa-ir": [
    ["Styrktarþjálfun — stærsta einstaka breytan", "Minni sykur og fín kolvetni", "Svefn í reglu", "Þyngdartap ef þyngd er yfir viðmiðum"],
    ["Sykraðir drykkir", "Kyrrseta", "Svefnleysi", "Áfengi"],
  ],
  efnaskiptaheilsa: [
    ["Styrktarþjálfun tvisvar í viku", "Minni sykur og unnin matvara", "Svefn í reglu", "Þyngdartap ef þyngd er yfir viðmiðum"],
    ["Sykraðir drykkir", "Kyrrseta", "Svefnleysi", "Áfengi"],
  ],

  // ── Hjarta og blóðfitur ───────────────────────────────────────────────
  heildarkolesterol: [
    ["Skipta mettaðri fitu út fyrir ómettaða — ólífuolía, hnetur", "Trefjar: hafrar, baunir, bygg", "Feitur fiskur tvisvar í viku", "Dagleg hreyfing"],
    ["Mikil mettuð fita og transfita", "Unnar kjötvörur", "Hreyfingarleysi"],
  ],
  hdl: [
    ["Þolþjálfun — það sem hækkar HDL mest", "Ólífuolía, hnetur og feitur fiskur", "Hætta nikótíni"],
    ["Reykingar og nikótín", "Hreyfingarleysi", "Mikið af fínum kolvetnum"],
  ],
  ldl: [
    ["Skipta mettaðri fitu út fyrir ómettaða", "Leysanlegar trefjar daglega", "Hreyfing og þyngdartap ef við á"],
    ["Mettuð fita og transfita", "Kyrrseta"],
  ],
  thriglyserid: [
    ["Minnka áfengi — oft það sem munar mest", "Minnka sykur og sykraða drykki", "Omega-3 úr feitum fiski", "Hreyfing"],
    ["Áfengi", "Sykraðir drykkir og fín kolvetni", "Að borða stórt seint á kvöldi"],
  ],
  blodthrystingur: [
    ["Minna salt — mest úr brauði, áleggi og tilbúnum mat", "150 mínútur af þolþjálfun á viku", "Minna áfengi", "Svefn í reglu og þyngdartap ef við á"],
    ["Salt í tilbúnum mat", "Áfengi", "Viðvarandi streita og lítill svefn", "Nikótín"],
  ],
  "blodthrystingur-nedri": [
    ["Sömu aðgerðir og fyrir efri mörkin", "Þolþjálfun og minna salt", "Minna áfengi"],
    ["Salt, áfengi og nikótín", "Streita og svefnleysi"],
  ],
  hjartaheilsa: [
    ["Hætta nikótíni — stærsta einstaka aðgerðin", "Koma blóðþrýstingi í viðmið", "Blóðfitur í viðmið", "Dagleg hreyfing"],
    ["Reykingar og nikótín", "Hár blóðþrýstingur sem er ekki tekinn á", "Hreyfingarleysi"],
  ],

  // ── Lifur ─────────────────────────────────────────────────────────────
  alt: [
    ["Minnka áfengi", "Léttast ef þyngd er yfir viðmiðum — lifrarfita svarar hratt", "Minna sykur og frúktósa", "Dagleg hreyfing"],
    ["Áfengi", "Sykraðir drykkir", "Hröð þyngdaraukning", "Fæðubótarefni í stórum skömmtum — ræddu þau við lækni"],
  ],
  ast: [
    ["Minnka áfengi", "Hreyfing í reglu", "Léttast ef við á"],
    ["Áfengi", "Mjög hörð æfing rétt fyrir blóðprufu getur hækkað gildið tímabundið"],
  ],

  // ── Líkamssamsetning ──────────────────────────────────────────────────
  bmi: [
    ["Prótein og trefjar í hverja máltíð", "Styrktarþjálfun til að halda vöðvum", "Svefn — svefnleysi ýtir undir matarlyst", "Dagleg hreyfing"],
    ["Fljótandi kaloríur", "Svefnleysi", "Kyrrseta"],
  ],
  thyngd: [
    ["Prótein, trefjar og styrktarþjálfun ef markmiðið er að léttast", "Svefn í reglu"],
    ["Fljótandi kaloríur", "Svefnleysi", "Að miða við töluna eina — vöðvi og fita hreyfast sitt í hvora átt"],
  ],
  fitumassi: [
    ["Styrktarþjálfun með nægu próteini", "Hægur kaloríuhalli fremur en harður", "Svefn"],
    ["Sykraðir drykkir og unnin matvara", "Kyrrseta", "Svefnleysi"],
  ],
  vodvamassi: [
    ["Styrktarþjálfun tvisvar til þrisvar í viku", "1,6 g prótein á hvert kíló líkamsþyngdar á dag", "Svefn — vöðvi byggist upp í svefni"],
    ["Kyrrseta", "Of lítið prótein", "Harður kaloríuhalli án styrktarþjálfunar"],
  ],

  // ── Stoðirnar ─────────────────────────────────────────────────────────
  lifstilseinkunn: [
    ["Byrjaðu á þeirri stoð sem kemur lægst út", "Ein venja í einu, í fjórar vikur"],
    ["Að taka allt í gegn á sama degi", "Að miða við fullkomnun fremur en samkvæmni"],
  ],
  "skor-svefn-venjur": [
    ["Fastur fótaferðartími alla daga, líka um helgar", "Dagsljós fyrsta klukkutímann eftir að þú vaknar", "Ekkert koffín eftir klukkan tvö", "Skjárinn frá 60 mínútum fyrir svefn", "Svalt og dimmt svefnherbergi"],
    ["Að sofa út um helgar og vakna á ólíkum tíma", "Síðdegiskaffi", "Áfengi að kvöldi — þú sofnar fyrr og sefur verr", "Síminn í rúminu"],
  ],
  "skor-svefn-vandamal": [
    ["Taka einkennin upp við lækni fremur en að þrauka", "Regla á fótaferðartíma", "Hreyfing á daginn, ekki síðustu tvo tíma fyrir svefn"],
    ["Áfengi sem svefnmeðal", "Óreglulegur svefntími", "Að láta einkenni standa ómeðhöndluð árum saman"],
  ],
  "skor-hreyfing-venjur": [
    ["150 mínútur af þolþjálfun á viku — rösk ganga telur", "Styrktarþjálfun tvisvar í viku", "Standa upp einu sinni á klukkutíma"],
    ["Kyrrseta allan vinnudaginn", "Allt-eða-ekkert hugsun: sleppt úr einni viku og þá öllu"],
  ],
  "skor-hreyfing-vandamal": [
    ["Aðlagaðar æfingar fremur en engar", "Mat sjúkraþjálfara þegar verkur stýrir", "Stigvaxandi álag, 10% í viku"],
    ["Að hætta alveg þegar eitthvað er aumt", "Að auka álagið of hratt"],
  ],
  "skor-naering-venjur": [
    ["Prótein í hverja máltíð", "Grænmeti og ávextir — 500 g á dag", "Trefjar upp í 30 g", "Elda heima fjóra daga í viku"],
    ["Unnin matvara sem uppistaða", "Sykraðir drykkir", "Sleppa máltíðum og snarla í staðinn"],
  ],
  "skor-naering-vandamal": [
    ["Taka einkennin upp við lækni eða næringarfræðing", "Matardagbók í tvær vikur til að finna mynstrið"],
    ["Að útiloka heila fæðuflokka upp á eigin spýtur", "Að lifa á fæðubótarefnum í stað matar"],
  ],
  "skor-matarhegdun": [
    ["Fastar máltíðir á föstum tímum", "Borða ekki fyrir framan skjá", "Taka á svefni og streitu — þau stýra þessu oftar en matseðillinn", "Stuðningur sálfræðings þegar mynstrið er fast"],
    ["Að sleppa máltíðum og verða mjög svangur", "Strangir kúrar sem enda í lotum", "Svefnleysi og streita"],
  ],
  "skor-koffin": [
    ["Halda sig undir 400 mg á dag", "Ekkert koffín eftir klukkan tvö", "Vatn í staðinn fyrir þriðja kaffið"],
    ["Orkudrykkir", "Kaffi eftir kvöldmat", "Að nota koffín til að bæta upp svefnleysi"],
  ],
  "skor-nikotin": [
    ["Hætta alveg — ekkert magn er hlutlaust", "Nikótínuppbót í samráði við lækni", "Forðast kveikjurnar fyrstu vikurnar"],
    ["Að skipta í veip eða púða og telja það öruggt", "Að hætta án stuðnings og reyna aftur einn"],
  ],
  "skor-afengi": [
    ["Áfengislausir dagar í hverri viku", "Halda sig innan viðmiða þegar drukkið er", "Ekki nota áfengi til að sofna eða slaka á"],
    ["Daglegt áfengi, líka lítið magn", "Að drekka til að sofna", "Að drekka undir streitu"],
  ],
  "skor-onnur-efni": [
    ["Ræða við lækni eða fagmann — það er engin skömm í því", "Stuðningur í nærumhverfi"],
    ["Að takast á við það einn", "Að blanda við áfengi"],
  ],
  "skor-skjanotkun": [
    ["Skjálaus síðasti klukkutími fyrir svefn", "Tilkynningar af", "Síminn hlaðinn utan svefnherbergis"],
    ["Síminn í rúminu", "Endalaust skrollað á kvöldin", "Skjár sem hvíld frá skjá"],
  ],
  "skor-fjarhaettuspil": [
    ["Útiloka sig frá spilasíðum og -stöðum", "Fjárhagsþak sem einhver annar heldur", "Ræða við fagmann"],
    ["Að spila undir streitu eða í vímu", "Að reyna að vinna tapið til baka"],
  ],
  "skor-andleg-heilsa": [
    ["Dagleg hreyfing — mælist á við margt annað", "Svefn í reglu", "Félagsleg tengsl, líka þegar þig langar ekki", "Fagleg hjálp; lífsstíll kemur ekki í staðinn fyrir hana"],
    ["Einangrun", "Áfengi", "Svefnleysi"],
  ],
  "skor-streita": [
    ["Rólegur andardráttur eða hugleiðsla, fimm mínútur á dag", "Hreyfing utandyra", "Svefn í reglu", "Skýr mörk milli vinnu og heimilis"],
    ["Koffín seint á daginn", "Svefnleysi", "Að taka á sig meira en kemst fyrir", "Áfengi"],
  ],
  "skor-vellidan": [
    ["Það sem bætir svefn, hreyfingu og streitu bætir þetta líka", "Tengsl við fólk og eitthvað sem þér þykir vert", "Útivera"],
    ["Einangrun", "Viðvarandi álag án hvíldar", "Svefnleysi"],
  ],
};

let ok = 0, missing = [];
for (const [slug, [improves, worsens]] of Object.entries(A)) {
  const r = await fetch(`${URL}/rest/v1/hc_knowledge?slug=eq.${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ improves, worsens, updated_by: "seed" }),
  });
  const body = await r.json().catch(() => []);
  if (!r.ok) { console.error(slug, r.status, JSON.stringify(body).slice(0, 160)); continue; }
  if (!body.length) { missing.push(slug); continue; }
  ok++;
}
console.log(`Uppfært: ${ok} færslur.`);
if (missing.length) console.log(`Ekki til í hc_knowledge: ${missing.join(", ")}`);
