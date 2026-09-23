// The action library, rated.
//
// Lifeline's method is "mest fyrir minnst" — most effect for the least time —
// but the library had 22 actions and no way to say which ones those were, so
// the model ranked on prose. Every action now carries three numbers, each
// 1–5 and each higher-is-better:
//
//   effect    how much it tends to move what it targets
//   ease      how easily it fits a normal week (5 = almost no friction)
//   evidence  how good the evidence is that it does what we say
//
// plus minutes_per_week, because "ease" is a feel and fifteen minutes is a
// fact, and an evidence grade that is shown as it is:
//
//   A  meta-analyses or several consistent RCTs
//   B  RCTs with limits, or strong prospective cohorts
//   C  small trials, mechanistic reasoning or expert consensus
//
// The library deliberately reaches past conservative practice into longevity
// medicine — zone 2, VO2max, grip and carry, stability, protein at 1,6 g/kg,
// creatine — but a C is never dressed up as an A, and nothing here is written
// as treatment or as a promise to prevent disease. Where the honest answer is
// a clinician, the action says so.
//
// Where an action also exists in Medalia's own plan export, it carries
// Medalia's exact wording and granularity — "Bæta inntöku af plöntufæði",
// birta/hitastig/loftgæði as three separate actions rather than one. That is
// what lets a nurse drag a recommendation straight off the report's
// Ráðleggingar column into the plan and have it land as a rated action,
// instead of two vocabularies for the same thing.
//
//   node --env-file=.env.local scripts/hc-seed-plan-modules.mjs
//
// Idempotent: upserts on key.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY vantar."); process.exit(1); }

/** key, title, summary, details, frequency, tags, effect, ease, evidence, grade, note, minutes */
const M = (key, pillar, title, summary, details, frequency, tags, effect, ease, evidence, grade, note, minutes) =>
  ({ key, pillar, title, summary, details, frequency, tags, effect, ease, evidence, evidence_grade: grade, evidence_note: note, minutes_per_week: minutes, active: true });

const MODULES = [
  // ── Svefn ────────────────────────────────────────────────────────────
  M("svefn-fastur-timi", "sleep", "Fastur fótaferðartími", "Farðu á fætur á sama tíma alla daga.",
    "Líka um helgar, frávik ekki meira en 30 mínútur. Þetta stillir líkamsklukkuna hraðar en nokkuð annað og dregur hin skrefin á eftir sér.",
    "Daglega", ["grunnur"], 5, 4, 4, "A", "Samhljóða niðurstöður um reglufestu og svefngæði.", 0),
  M("svefn-lengd", "sleep", "Sjö til níu klukkustundir", "Ætlaðu þér nægan tíma í rúminu.",
    "Flestir þurfa 7–9 klukkustundir. Reiknaðu aftur á bak frá fótaferðartímanum og settu háttatímann þar.",
    "Daglega", ["grunnur"], 5, 3, 5, "A", "Svefnlengd er ein best staðfesta breytan í heilsurannsóknum.", 0),
  M("svefn-dagsljos", "sleep", "Dagsljós fyrsta klukkutímann", "Út undir bert loft snemma dags.",
    "Tíu til fimmtán mínútur duga. Dagsbirta að morgni er sterkasta merkið sem líkamsklukkan fær.",
    "Daglega", ["grunnur"], 4, 4, 3, "B", "Vel staðfest áhrif á dægursveiflu; áhrif á svefngæði minna mæld.", 70),
  M("svefn-koffin", "sleep", "Koffín fyrir hádegi", "Ekkert koffín eftir klukkan tvö.",
    "Helmingunartími koffíns er 5–6 klukkustundir, svo síðdegiskaffið er hálft í líkamanum við háttatíma þótt þú sofnir.",
    "Daglega", ["grunnur"], 4, 3, 4, "A", "Slembirannsóknir sýna skert svefngæði við koffín síðdegis.", 0),
  M("svefn-afengi", "sleep", "Ekkert áfengi fyrir svefn", "Síðasti drykkur minnst þrem tímum fyrir háttatíma.",
    "Áfengi styttir tímann sem tekur að sofna en sundrar seinni hluta næturinnar, þar sem djúpsvefninn og draumsvefninn liggja.",
    "Þegar drukkið er", [], 4, 3, 4, "A", "Samhljóða slembirannsóknir á svefnbyggingu.", 0),
  M("svefn-skjalaust", "sleep", "Skjálaus síðasta klukkustund", "Sjónvarp, sími og tölva frá 60 mínútum fyrir svefn.",
    "Bæði birtan og innihaldið halda þér vakandi. Setjið símann í hleðslu utan svefnherbergisins.",
    "Daglega", [], 3, 3, 3, "B", "Áhrif staðfest en stærðin umdeild.", 0),
  // Medalia lists these three separately, so the library does too — that way a
  // recommendation off the report maps onto exactly one action.
  M("svefn-birta", "sleep", "Birta", "Algjört myrkur í svefnherberginu, eða svefngríma.",
    "Jafnvel lítil birta að nóttu dregur úr melatóníni. Myrkvunartjöld eða gríma — hvort sem er ódýrt og virkar á hverri nóttu eftir það.",
    "Einu sinni", ["grunnur"], 3, 4, 3, "B", "Vel staðfest samband birtu að nóttu og melatóníns.", 0),
  M("svefn-hitastig", "sleep", "Hitastig", "Um 18°C í svefnherberginu.",
    "Líkaminn þarf að kólna til að sofna. Of hlýtt herbergi er algengasta ástæða þess að fólk vaknar um nóttina.",
    "Einu sinni", ["grunnur"], 3, 4, 3, "B", "Hitastig og svefnbygging vel rannsökuð.", 0),
  M("svefn-loftgaedi", "sleep", "Loftgæði", "Ferskt loft í svefnherberginu.",
    "Opnaðu gluggann í tíu mínútur fyrir háttatíma, eða láttu hann standa á gátt.",
    "Daglega", [], 2, 5, 2, "C", "Smáar rannsóknir á CO2 í svefnherbergjum.", 0),
  M("svefn-kvoldmatur", "sleep", "Síðasta máltíð þremur tímum fyrir svefn", "Ekki fara saddur í rúmið.",
    "Melting og bakflæði trufla fyrri hluta nætur. Léttur kvöldmatur fyrr á kvöldin dugar oftast.",
    "Daglega", [], 3, 3, 3, "B", "Sterkust gögn hjá fólki með bakflæðiseinkenni.", 0),
  M("svefn-slokun", "sleep", "Slökun fyrir svefn", "Sama rútínan á hverju kvöldi.",
    "Tíu mínútur af því sama: lesa, teygja, róleg öndun. Líkaminn lærir merkið.",
    "Daglega", [], 3, 4, 3, "B", "Hugræn atferlismeðferð við svefnleysi byggir á þessum þætti.", 70),
  M("svefn-dagbok", "sleep", "Svefndagbók í tvær vikur", "Skráðu háttatíma, fótaferðartíma og hvernig þér leið.",
    "Tvær vikur duga til að sjá mynstrið. Þetta er líka það sem læknir eða sálfræðingur biður um fyrst.",
    "Í tvær vikur", ["mæling"], 3, 4, 4, "A", "Staðlað fyrsta skref í greiningu svefnvanda.", 15),
  M("svefn-kaefisvefn", "sleep", "Láttu skima fyrir kæfisvefni", "Hrotur, öndunarhlé eða dagsyfja kalla á mat.",
    "Kæfisvefn heldur uppi blóðþrýstingi og blóðsykri sama hversu góðar venjurnar eru. Þetta er mat læknis, ekki lífsstílsaðgerð.",
    "Einu sinni", ["tilvísun"], 5, 4, 5, "A", "Meðferð við kæfisvefni hefur mælanleg áhrif á blóðþrýsting og dagsyfju.", 0),

  // ── Hreyfing ─────────────────────────────────────────────────────────
  M("hreyfing-ganga", "exercise", "Dagleg ganga", "Þrjátíu mínútur, rösk.",
    "Byrjunin á öllu öðru. Telur sem þolþjálfun ef þú mæðist örlítið og getur enn talað.",
    "Daglega", ["grunnur"], 4, 5, 5, "A", "Ein best staðfesta einstaka hreyfiaðgerðin.", 210),
  M("hreyfing-ganga-eftir-mat", "exercise", "Ganga eftir máltíð", "Tíu til fimmtán mínútur eftir stærstu máltíðina.",
    "Vöðvarnir taka upp sykur úr blóðinu án insúlíns þegar þeir vinna. Þetta er ódýrasta aðgerðin gegn háum blóðsykri eftir mat.",
    "Daglega", ["grunnur", "efnaskipti"], 4, 5, 4, "A", "Slembirannsóknir sýna lægri blóðsykurstoppa eftir máltíð.", 90),
  M("hreyfing-zone2", "exercise", "Zone 2 þolþjálfun", "150 mínútur á viku á hraða þar sem þú getur talað.",
    "Púls um 60–70% af hámarki. Þetta byggir upp þolið sem allt annað hvílir á, og er sá hluti þjálfunar sem flestir sleppa.",
    "3–5 sinnum í viku", ["þol"], 5, 3, 5, "A", "Þol er sterklega tengt langlífi í stórum framsýnum rannsóknum.", 150),
  M("hreyfing-vo2max", "exercise", "Háákefðarlotur", "Ein erfið lota á viku.",
    "Fjórar mínútur á mikilli ákefð, fjórar mínútur rólegar, fjórum sinnum. Þetta er sá hluti sem hækkar hámarkssúrefnisupptöku mest.",
    "Vikulega", ["þol"], 5, 2, 4, "B", "Slembirannsóknir sýna hækkun á VO2max; langtímaútkomur úr rannsóknum á hópum.", 40),
  M("hreyfing-styrkur", "exercise", "Styrktarþjálfun", "Tvisvar til þrisvar í viku.",
    "Stórar hreyfingar: hnébeygja, mjaðmalyfta, ýta, toga, bera. Vöðvi er ekki útlit heldur forði — hann ver blóðsykurinn og stendur undir hreyfigetu síðar á ævinni.",
    "2–3 sinnum í viku", ["grunnur", "styrkur"], 5, 3, 5, "A", "Samhljóða gögn um vöðvamassa, beinþéttni og efnaskipti.", 120),
  M("hreyfing-grip", "exercise", "Grip og burður", "Berðu þungt, stutta vegalengd.",
    "Taktu þungar töskur og gakktu með þær. Gripstyrkur er einn besti einstaki mælikvarðinn á hreysti með aldri.",
    "2 sinnum í viku", ["styrkur"], 3, 4, 3, "B", "Gripstyrkur spáir vel fyrir; þjálfun hans er minna rannsökuð sérstaklega.", 20),
  M("hreyfing-stodugleiki", "exercise", "Jafnvægi og stöðugleiki", "Stattu á öðrum fæti meðan þú burstar tennur.",
    "Tíu sekúndur á hvorn fót. Jafnvægi tapast hljóðlega og er það sem ræður sjálfstæði síðar á ævinni.",
    "Daglega", ["stöðugleiki"], 3, 5, 3, "B", "Jafnvægisþjálfun dregur úr byltum hjá eldra fólki.", 10),
  M("hreyfing-kyrrseta", "exercise", "Rjúfa kyrrsetu", "Stattu upp á klukkustundar fresti.",
    "Tvær mínútur duga. Langar samfelldar setur hafa sjálfstæð áhrif, óháð því hvort þú æfir.",
    "Á vinnudögum", ["grunnur"], 3, 5, 3, "B", "Framsýnar rannsóknir; íhlutunargögn takmarkaðri.", 40),
  M("hreyfing-skref", "exercise", "Skrefamarkmið", "Sjö til átta þúsund skref á dag.",
    "Ávinningurinn eykst upp að um 8.000 skrefum og flatnar svo út. Tíu þúsund var auglýsing, ekki rannsókn.",
    "Daglega", [], 3, 4, 4, "A", "Stórar framsýnar rannsóknir á skrefafjölda og dánartíðni.", 0),
  M("hreyfing-throskun", "exercise", "Auktu álagið hægt", "Ekki meira en tíu prósent í viku.",
    "Flest meiðsli koma af of hröðu stökki fremur en of miklu álagi. Hægari aukning heldur þér að.",
    "Vikulega", [], 3, 4, 3, "C", "Þumalputtaregla í þjálffræði fremur en niðurstaða slembirannsókna.", 0),
  M("hreyfing-erfid-thol", "exercise", "Erfið þolþjálfun", "Þrisvar til fimm sinnum í viku.",
    "Spretthlaup, HIIT, boltaíþróttir eða crossfit. Má vera fyrir eða eftir aðra æfingu. Þetta er sá hluti sem hækkar hámarkssúrefnisupptöku.",
    "3–5 sinnum í viku", ["þol"], 5, 2, 4, "B", "Slembirannsóknir á VO2max; orðalag úr áætlun Medalia.", 90),
  M("hreyfing-almenn", "exercise", "Almenn hreyfing", "Hreyfðu þig á klukkustundar fresti.",
    "Eða farðu í stuttan göngutúr. Þetta er ekki æfing heldur það að sitja ekki kyrr — og það hefur sjálfstæð áhrif.",
    "Daglega", ["grunnur"], 3, 5, 3, "B", "Framsýnar rannsóknir á samfelldri kyrrsetu.", 60),
  M("hreyfing-thol", "exercise", "Þolþjálfun", "Eitthvað sem kemur púlsinum upp.",
    "Hjól, sund, skokk, hröð ganga — það sem þú heldur þig við skiptir meira máli en hvaða grein það er.",
    "3–5 sinnum í viku", [], 4, 3, 5, "A", "Vel staðfest á hjarta- og æðakerfi.", 150),

  // ── Næring ───────────────────────────────────────────────────────────
  M("naering-protein", "nutrition", "Prótein í hverri máltíð", "Um 1,6 g á hvert kíló líkamsþyngdar á dag.",
    "Um 30 g í hverja máltíð. Prótein heldur mettun lengur en nokkuð annað og er efniviðurinn í vöðvann sem styrktarþjálfunin byggir.",
    "Daglega", ["grunnur"], 4, 3, 4, "A", "Safngreiningar á mettun og vöðvauppbyggingu.", 0),
  M("naering-trefjar", "nutrition", "Trefjar og heilkorn", "Þrjátíu grömm á dag.",
    "Hafrar, baunir, bygg, grænmeti með hýði. Trefjar hægja á blóðsykri, lækka kólesteról og næra þarmaflóruna.",
    "Daglega", ["grunnur"], 4, 3, 4, "A", "Safngreiningar á blóðfitum og blóðsykri.", 0),
  M("naering-diskur", "nutrition", "Diskaaðferðin", "Hálfur diskur grænmeti, fjórðungur prótein, fjórðungur kolvetni.",
    "Engin talning. Þetta er reglan sem virkar á veitingastað, í mötuneyti og heima.",
    "Í hverri máltíð", ["grunnur"], 4, 4, 3, "B", "Einföld framsetning á vel staðfestum næringarviðmiðum.", 0),
  M("naering-sykradir-drykkir", "nutrition", "Vatn í stað sykraðra drykkja", "Sleppa gosi, safa og orkudrykkjum.",
    "Fljótandi sykur mettar ekki og fer beint í blóðsykurinn. Þetta er oftast stærsta einstaka breytingin í mataræði.",
    "Daglega", ["grunnur", "efnaskipti"], 4, 4, 4, "A", "Samhljóða gögn um sykraða drykki og efnaskipti.", 0),
  M("naering-unnin", "nutrition", "Draga úr gjörunninni matvöru", "Því færri innihaldsefni, því betra.",
    "Gjörunnin matvara er hönnuð til að vera borðuð hratt og mikið. Að skipta helmingnum út fyrir heimalagað er raunhæfara markmið en að hætta.",
    "Daglega", [], 5, 2, 4, "B", "Slembirannsókn Hall o.fl. og stórar framsýnar rannsóknir.", 0),
  M("naering-afengi", "nutrition", "Áfengislausir dagar", "Minnst fjórir dagar í viku án áfengis.",
    "Áfengi kemur fram í þríglýseríðum, lifrargildum og svefni. Það er sjaldan eitt glas sem skiptir máli heldur hversu margir dagar.",
    "Vikulega", ["efnaskipti"], 4, 3, 4, "A", "Skýrt skammtaháð samband við lifrargildi og blóðfitur.", 0),
  M("naering-fiskur", "nutrition", "Feitur fiskur tvisvar í viku", "Lax, makríll, síld eða bleikja.",
    "Omega-3 úr mat fremur en hylkjum þegar það er hægt. Hefur mælanleg áhrif á þríglýseríð.",
    "2 sinnum í viku", [], 3, 4, 4, "A", "Safngreiningar á þríglýseríðum.", 0),
  M("naering-olifuolia", "nutrition", "Ólífuolía í stað mettaðrar fitu", "Skiptu smjöri og hörðu fitunni út.",
    "Ekki minni fita heldur önnur fita. Þetta er sá hluti Miðjarðarhafsmataræðisins sem mest hefur verið mældur.",
    "Daglega", [], 3, 4, 4, "A", "PREDIMED og safngreiningar á blóðfitum.", 0),
  M("naering-salt", "nutrition", "Minna salt", "Mest úr brauði, áleggi og tilbúnum mat.",
    "Saltbaukurinn er sjaldan vandinn. Lestu innihaldið á því sem þú kaupir tilbúið.",
    "Daglega", ["blóðþrýstingur"], 3, 3, 4, "A", "Safngreiningar á salti og blóðþrýstingi.", 0),
  M("naering-timabil", "nutrition", "Tíu til tólf tímar án matar að nóttu", "Lokaðu eldhúsinu eftir kvöldmat.",
    "Ekki fasta heldur eðlileg nótt. Auðveldasta leiðin til að fækka kvöldsnarli án þess að telja neitt.",
    "Daglega", ["efnaskipti"], 3, 4, 3, "B", "Slembirannsóknir smáar en samhljóða um þyngd og blóðsykur.", 0),
  M("naering-skipulag", "nutrition", "Skipulag máltíða", "Ákveddu vikuna á sunnudegi.",
    "Þrír kvöldmatir ákveðnir fyrir fram duga. Flest óheppileg matarval verða þegar ekkert var planað.",
    "Vikulega", [], 3, 3, 3, "C", "Atferlisrök fremur en klínískar rannsóknir.", 30),
  M("naering-skammtar", "nutrition", "Minni skammtar, hægara át", "Leggðu frá þér gaffalinn milli bita.",
    "Mettunarmerkið kemur um tuttugu mínútum á eftir. Að borða hægar er það eina sem þarf til að heyra í því.",
    "Í hverri máltíð", [], 3, 3, 3, "C", "Smáar rannsóknir á áthraða og orkuinntöku.", 0),
  M("naering-d-vitamin", "nutrition", "D-vítamín yfir veturinn", "Ræddu skammtinn við lækni.",
    "Á Íslandi nær sólin ekki að halda uppi D-vítamíni frá október til mars. Mælt gildi ræður skammtinum, ekki ágiskun.",
    "Daglega að vetri", ["bætiefni"], 3, 5, 3, "B", "Sterk gögn um leiðréttingu skorts; almennur ávinningur umdeildur.", 0),
  M("naering-protein-morgunmatur", "nutrition", "Próteinríkur morgunmatur", "Þrjátíu grömm af próteini í fyrstu máltíð.",
    "Morgunmaturinn er sú máltíð sem oftast er nær eingöngu kolvetni. Prótein þar stillir matarlystina fyrir allan daginn.",
    "Daglega", ["grunnur"], 4, 4, 3, "B", "Slembirannsóknir á mettun og orkuinntöku síðar um daginn.", 0),
  M("naering-plontufaedi", "nutrition", "Bæta inntöku af plöntufæði", "Fjölbreytt plöntufæði, ekki bara meira af einu.",
    "Þrjátíu ólíkar plöntur í viku er gott viðmið — grænmeti, ávextir, baunir, hnetur, fræ, heilkorn. Fjölbreytnin er það sem þarmaflóran svarar.",
    "Daglega", ["grunnur"], 4, 3, 4, "A", "Sterk gögn um plöntufæði; fjölbreytnitalan sjálf er viðmið fremur en niðurstaða.", 0),
  M("naering-vokvi", "nutrition", "Bæta inntöku af vökva", "Vatn yfir daginn, ekki allt í einu.",
    "Þorsti kemur seint og er oft misskilinn sem svengd. Glas með hverri máltíð og eitt á milli dugar flestum.",
    "Daglega", [], 2, 5, 2, "C", "Lífeðlisfræðileg rök; klínískar útkomur lítið mældar hjá heilbrigðum.", 0),
  M("naering-vidbaettur-sykur", "nutrition", "Draga úr viðbættum sykri", "Í matvælum, ekki bara í drykkjum.",
    "Viðbættur sykur er oftast í því sem ekki er sætt á tungu: sósum, brauði, jógúrt, morgunkorni. Lestu innihaldslistann á fimm hlutum sem þú kaupir reglulega.",
    "Daglega", ["efnaskipti"], 4, 3, 4, "A", "Samhljóða gögn um viðbættan sykur og efnaskipti.", 0),
  M("naering-fraeoliur", "nutrition", "Draga úr notkun á fræolíum", "Notaðu ólífuolíu eða smjör til steikingar.",
    "Fræolíur eru fyrst og fremst merki um gjörunna matvöru. Deilt er um olíurnar sjálfar; það er ekki deilt um matinn sem þær koma í.",
    "Daglega", [], 2, 4, 2, "C", "Umdeilt. Gögnin styðja fremur að draga úr gjörunninni matvöru en olíunum sem slíkum.", 0),
  M("naering-snarl-kvold", "nutrition", "Dragðu úr snarli seint á kvöldin", "Lokaðu eldhúsinu eftir kvöldmat.",
    "Kvöldsnarl er sjaldan svengd. Það er þreyta, vani eða skjár — og það er sá hluti dagsins þar sem flestum verður mest á.",
    "Daglega", ["efnaskipti"], 3, 3, 3, "B", "Gögn um tímasetningu orkuinntöku og þyngd.", 0),
  M("naering-borda-undir-alagi", "nutrition", "Forðastu að borða undir álagi", "Sestu niður, ekki fyrir framan skjá.",
    "Undir álagi borðar fólk hraðar og meira og tekur ekki eftir mettuninni. Fimm mínútur við borð gera meira en nokkur talning.",
    "Í hverri máltíð", [], 3, 3, 2, "C", "Smáar rannsóknir á áthraða og athygli við máltíð.", 0),
  M("naering-magn", "nutrition", "Borðaðu minna magn í hverri máltíð", "Skammtur á disk, ekki skál á borðið.",
    "Það sem er á borðinu er borðað. Að skammta á disk í eldhúsinu og skilja pottinn eftir þar er einfaldasta breytingin.",
    "Í hverri máltíð", [], 3, 4, 3, "B", "Vel staðfest áhrif skammtastærðar á orkuinntöku.", 0),
  M("naering-kreatin", "nutrition", "Kreatín", "Þrjú til fimm grömm á dag, í samráði við lækni.",
    "Mest rannsakaða fæðubótarefnið sem til er og eitt það ódýrasta. Styður styrktarþjálfun; gerir ekkert eitt og sér.",
    "Daglega", ["bætiefni", "styrkur"], 3, 5, 4, "A", "Fjölmargar slembirannsóknir á styrk og vöðvamassa.", 0),

  // ── Andleg líðan ─────────────────────────────────────────────────────
  M("andlegt-ondun", "mental", "Öndunaræfing", "Fimm mínútur á dag.",
    "Innöndun í fjórar sekúndur, útöndun í sex. Lengri útöndun er það sem róar taugakerfið.",
    "Daglega", ["grunnur"], 3, 5, 3, "B", "Slembirannsóknir smáar en samhljóða um streitueinkenni.", 35),
  M("andlegt-utivera", "mental", "Útivera og dagsbirta", "Tuttugu mínútur úti.",
    "Helst í grænu umhverfi. Virkar bæði á dægursveifluna og á líðan, svo þetta telur tvisvar.",
    "Daglega", ["grunnur"], 3, 4, 3, "B", "Framsýnar rannsóknir og smærri íhlutanir.", 140),
  M("andlegt-tengsl", "mental", "Tengsl", "Eitt raunverulegt samtal í viku.",
    "Hringdu fremur en að senda skilaboð. Félagsleg tengsl eru meðal sterkustu þáttanna í langtímarannsóknum á heilsu.",
    "Vikulega", ["grunnur"], 4, 4, 3, "B", "Sterk framsýn gögn; íhlutanir erfiðari í rannsókn.", 30),
  M("andlegt-mork", "mental", "Mörk á vinnutíma", "Ákveddu hvenær vinnudagurinn endar.",
    "Tilkynningar af eftir þann tíma. Streita sem á sér engin endalok á daginn heldur svefninum uppi.",
    "Daglega", [], 4, 2, 3, "C", "Atferlisrök og starfsheilsurannsóknir.", 0),
  M("andlegt-thakklaeti", "mental", "Þrennt gott", "Skrifaðu þrennt sem gekk vel.",
    "Tvær mínútur að kvöldi. Einfalt, og ein af fáum jákvæðum sálfræðiaðgerðum sem heldur í slembirannsóknum.",
    "Daglega", [], 2, 5, 3, "B", "Endurteknar slembirannsóknir með hóflegri áhrifastærð.", 15),
  M("andlegt-hugleidsla", "mental", "Hugleiðsla", "Tíu mínútur, leidd í appi eða í kyrrð.",
    "Ekki að hætta að hugsa heldur að taka eftir því að hugurinn reikaði og koma til baka.",
    "Daglega", [], 3, 3, 3, "B", "Safngreiningar sýna hóflega áhrifastærð á kvíða og streitu.", 70),
  M("andlegt-skjar", "mental", "Tilkynningar af", "Slökktu á öllu nema símtölum.",
    "Tekur tvær mínútur að stilla. Stysta leiðin að minni truflun sem til er.",
    "Einu sinni", [], 3, 5, 2, "C", "Smáar rannsóknir á athygli og truflunum.", 0),
  M("andlegt-nikotin", "mental", "Hætta nikótíni", "Í hvaða formi sem er — með stuðningi.",
    "Stærsta einstaka aðgerðin fyrir hjartaheilsu. Líkurnar margfaldast með stuðningi og nikótínuppbót, svo ræddu það við lækni fremur en að reyna einn.",
    "Þar til hætt", ["tilvísun"], 5, 1, 5, "A", "Óumdeild gögn um hjarta- og æðaáhættu.", 0),
  M("andlegt-fagleg", "mental", "Fagleg aðstoð", "Sálfræðingur þegar einkennin eru viðvarandi.",
    "Lífsstíll vinnur með meðferð en kemur ekki í staðinn fyrir hana. Að byrja snemma er það sem ræður mestu.",
    "Eftir þörfum", ["tilvísun"], 5, 3, 5, "A", "Hugræn atferlismeðferð er meðal best staðfestu meðferða sem til eru.", 60),
];

const r = await fetch(`${URL}/rest/v1/hc_plan_modules?on_conflict=key`, {
  method: "POST",
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(MODULES.map((m, i) => ({ ...m, sort: (i + 1) * 10 }))),
});
const body = await r.text();
if (!r.ok) { console.error("Villa:", r.status, body.slice(0, 500)); process.exit(1); }
const saved = JSON.parse(body);
const byPillar = saved.reduce((a, m) => ({ ...a, [m.pillar]: (a[m.pillar] ?? 0) + 1 }), {});
console.log(`Vistað: ${saved.length} aðgerðir.`, byPillar);
