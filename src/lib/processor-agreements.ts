// Internal compliance documents — Lifeline Health.
// These texts are intended to be reviewed by legal counsel, signed by
// authorised representatives, hashed (sha256), and stored under
// company_documents with the appropriate `kind` so they're durable
// evidence in a Persónuvernd audit.
//
// Same versioning discipline as agreement-templates.ts /
// platform-terms-content.ts: any text change MUST bump the version
// constant so the stored hash remains a unique fingerprint.

// ─── 1.7  Medalia joint-controller arrangement (GDPR Art. 26) ──

export const MEDALIA_JOINT_CONTROLLER_KEY = "medalia-joint-controller";
export const MEDALIA_JOINT_CONTROLLER_VERSION = "v1.2";

export function renderMedaliaJointControllerArrangement(): string {
  return `SAMKOMULAG UM SAMEIGINLEGA ÁBYRGÐ Á VINNSLU SJÚKRASKRÁRGAGNA
Lifeline Health ehf. og Medalia ehf.
Útgáfa ${MEDALIA_JOINT_CONTROLLER_VERSION}
Skv. 26. gr. reglugerðar (ESB) 2016/679 (GDPR) og laga nr. 90/2018 um persónuvernd.

1. Aðilar
1.1 Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík
    (hér eftir „Lifeline").
1.2 Medalia ehf., kt. 530224-0230, Kirkjubraut 13, 170 Seltjarnarnes
    (hér eftir „Medalia"). Medalia rekur viðurkennt sjúkraskrárkerfi með leyfi
    skv. lögum nr. 55/2009 um sjúkraskrár.

2. Tilgangur og umfang
2.1 Aðilar starfa sameiginlega að því að safna, varðveita og veita aðgang að
    sjúkraskrárgögnum þeirra einstaklinga sem nýta heilbrigðisþjónustu
    Lifeline. Vinnslan grundvallast á 9. gr. (2)(h) GDPR (heilbrigðisþjónusta)
    og 9. gr. (2)(a) GDPR (afdráttarlaust samþykki) þar sem það á við.
2.2 Aðilar teljast sameiginlegir ábyrgðaraðilar í skilningi 26. gr. GDPR um
    þá vinnslu sem fellur undir samkomulag þetta.

3. Ábyrgðaskipting
3.1 Lifeline ber ábyrgð á:
    a) öflun upplýsts samþykkis skjólstæðings;
    b) söfnun grunngagna (spurningalistar, mælingar, blóðsýni);
    c) klínískri túlkun og samantekt heilsumats;
    d) miðlun heilsumatsskýrslu til skjólstæðings og lögbundinni eftirfylgni;
    e) að uppfylla skyldur sínar sem heilbrigðisstarfsemi skv. lögum nr. 40/2007.
3.2 Medalia ber ábyrgð á:
    a) öruggri varðveislu sjúkraskrárgagna í sjúkraskrárkerfi með leyfi skv.
       lögum nr. 55/2009;
    b) aðgangsstjórnun, rekstri og lögbundinni rekjanleikaskráningu skv. 14.
       gr. þeirra laga;
    c) tæknilegu öryggi (dulkóðun við hvíld og á flutningi, varagögn,
       atvikastjórnun);
    d) að framfylgja réttindum skráðra einstaklinga innan sjúkraskrárkerfisins.

4. Sameiginleg ábyrgð
4.1 Aðilar bera sameiginlega ábyrgð á:
    a) að veita skráðum einstaklingum upplýsingar skv. 13. og 14. gr. GDPR;
    b) að taka við og afgreiða beiðnir skráðra einstaklinga skv. 15.–22. gr.
       GDPR (aðgangur, leiðrétting, eyðing, takmörkun, andmæli, flutningur);
    c) að tilkynna persónuverndarbrot skv. 33. og 34. gr. GDPR.

5. Tengiliður fyrir skráða einstaklinga
5.1 Skráðir einstaklingar geta nýtt sér réttindi sín gagnvart hvorum aðila sem er.
    Til einföldunar er Lifeline aðaltengiliður (pv@lifelinehealth.is). Lifeline
    áframsendir Medalia ef beiðnin krefst aðgerða innan sjúkraskrárkerfisins.
5.2 Hvor aðili um sig skal svara skráðum einstaklingi innan 30 daga frá móttöku
    beiðni, sbr. 12. gr. GDPR.

6. Tæknilegt og skipulagt öryggi
6.1 Aðilar skuldbinda sig til að viðhafa viðeigandi tæknilegar og skipulagslegar
    ráðstafanir skv. 32. gr. GDPR, þ.m.t.:
    a) dulkóðun viðkvæmra gagna við hvíld og á flutningi;
    b) hlutverkaskipt aðgangsstjórnun (least privilege);
    c) lögboðna rekjanleikaskráningu á flettingar í sjúkraskrá;
    d) reglubundnar úttektir og atvikastjórnun.
6.2 Aðgangur starfsfólks Lifeline að sjúkraskrá fer fram inni í Medalia. Lifeline
    rekur ekki sjálfstæða sjúkraskrá utan Medalia.

7. Atvikastjórnun og tilkynningar
7.1 Aðili sem verður þess áskynja að persónuverndarbrot eigi sér stað skal
    tilkynna hinum aðila án ástæðulauss dráttar og eigi síðar en 24 klst. eftir
    að atvikið verður ljóst.
7.2 Lifeline tekur að sér tilkynningu til Persónuverndar og skráðra einstaklinga
    skv. 33. og 34. gr. GDPR þegar atvikið varðar gögn sem voru í söfnun eða
    klínískri túlkun. Medalia tekur að sér tilkynningu þegar atvikið varðar
    sjúkraskrárkerfið sjálft. Aðilar samræma sig fyrirfram þegar bæði eiga við.

8. Vinnsluaðilar (sub-processors)
8.1 Hvor aðili um sig sér um sína undirvinnsluaðila skv. 28. gr. GDPR og deilir
    núverandi lista með hinum aðila þegar farið er fram á það.

9. Gildistími og uppsögn
9.1 Samkomulag þetta gildir á meðan aðilar vinna saman að heilbrigðisþjónustu
    samkvæmt þjónustusamningi.
9.2 Við uppsögn skal Medalia varðveita sjúkraskrárgögn áfram skv. lögum nr.
    55/2009. Lifeline eyðir eigin afritum innan 90 daga.

10. Birting til skráðra einstaklinga
10.1 Útdráttur úr samkomulagi þessu skal birtur á persónuverndaryfirlýsingu
     Lifeline (lifelinehealth.is/privacy) skv. 26. gr. (2) GDPR.

11. Lögsaga og varnarþing
11.1 Um samkomulag þetta gilda íslensk lög. Rísi ágreiningur skal hann rekinn
     fyrir Héraðsdómi Reykjaness.

12. Undirritanir
12.1 Fyrir hönd Lifeline Health ehf.: ____________________________ Dags. _________
12.2 Fyrir hönd Medalia ehf.:           ____________________________ Dags. _________`;
}

// ─── 1.8  Biody Manager Data Processing Agreement (GDPR Art. 28) ──

export const BIODY_DPA_KEY = "biody-dpa";
export const BIODY_DPA_VERSION = "v1.0";

export function renderBiodyDPA(): string {
  return `VINNSLUSAMNINGUR — BIODY MANAGER
Lifeline Health ehf. og Aminogram SAS (Biody Manager)
Útgáfa ${BIODY_DPA_VERSION}
Skv. 28. gr. reglugerðar (ESB) 2016/679 (GDPR) og laga nr. 90/2018.

1. Aðilar
1.1 Ábyrgðaraðili: Lifeline Health ehf., kt. 590925-1440 ("Ábyrgðaraðili").
1.2 Vinnsluaðili: Aminogram SAS, sem rekur Biody Manager mælitækja- og
    skýjaþjónustu ("Vinnsluaðili").

2. Efni og tilgangur vinnslunnar
2.1 Vinnsluaðili veitir tæki og hugbúnað til mælinga á líkamssamsetningu
    skjólstæðinga ábyrgðaraðila. Mælingar fara fram á starfsstöðvum sem
    ábyrgðaraðili hefur samning við.
2.2 Vinnsluaðili vinnur eingöngu með persónuupplýsingar skv. fyrirmælum
    ábyrgðaraðila og í þágu þeirrar þjónustu.

3. Tegundir persónuupplýsinga og flokkar skráðra einstaklinga
3.1 Persónuupplýsingar: nafn, netfang, fæðingardagur, kyn, hæð, virkni-
    stig (lifestyle level), niðurstöður líkamssamsetningarmælinga (fituprósenta,
    vöðvamassi, fasahorn, BMR, líkamsvökvi o.fl.), tímasetningar mælinga.
3.2 Flokkar: skjólstæðingar Lifeline yfir 18 ára aldri sem hafa veitt
    afdráttarlaust samþykki fyrir mælingu.
3.3 Vinnsluaðili tekur EKKI við kennitölu og fær ekki aðgang að lykilorðum
    skjólstæðinga.

4. Skyldur Vinnsluaðila
4.1 Vinnsluaðili skuldbindur sig til að:
    a) vinna persónuupplýsingar einungis samkvæmt skriflegum fyrirmælum
       ábyrgðaraðila;
    b) tryggja að starfsmenn sem hafa aðgang séu bundnir trúnaðarskyldu;
    c) viðhafa viðeigandi tæknilegar og skipulagslegar ráðstafanir skv.
       32. gr. GDPR;
    d) aðstoða ábyrgðaraðila við að uppfylla skyldur sínar gagnvart skráðum
       einstaklingum (15.–22. gr. GDPR);
    e) aðstoða ábyrgðaraðila við að tilkynna persónuverndarbrot;
    f) eyða eða skila öllum persónuupplýsingum þegar samningi lýkur, eftir
       ósk ábyrgðaraðila;
    g) gera tiltækar allar nauðsynlegar upplýsingar til að sýna fram á að
       skyldur skv. þessum samningi séu uppfylltar, og leyfa eftirlit eða
       úttektir, þ.m.t. úttektir framkvæmdar af þriðja aðila á vegum
       ábyrgðaraðila.

5. Undirvinnsluaðilar
5.1 Vinnsluaðili má einungis fela undirvinnsluaðila vinnslu með
    fyrirframskriflegri heimild ábyrgðaraðila. Listi yfir samþykkta
    undirvinnsluaðila er viðauki við samning þennan og uppfærður reglulega.
5.2 Vinnsluaðili tilkynnir ábyrgðaraðila a.m.k. 30 dögum fyrir breytingu á
    undirvinnsluaðilum og veitir ábyrgðaraðila tækifæri til að mótmæla.

6. Atvikastjórnun
6.1 Vinnsluaðili tilkynnir ábyrgðaraðila án ástæðulauss dráttar og eigi
    síðar en 24 klst. eftir að persónuverndarbrot kemur í ljós.
6.2 Tilkynningin skal innihalda þær upplýsingar sem 33. gr. (3) GDPR
    krefst, eftir því sem þær eru fáanlegar.

7. Flutningur til þriðju landa
7.1 Persónuupplýsingar eru hýstar innan EES (Frakkland). Verði flutningur
    út fyrir EES nauðsynlegur skal hann grundvallast á viðeigandi
    verndarráðstöfunum skv. 46. gr. GDPR (t.d. SCC).

8. Réttindi skráðra einstaklinga
8.1 Vinnsluaðili veitir ábyrgðaraðila tæknilegan stuðning til að uppfylla
    aðgangsbeiðnir, leiðréttingarbeiðnir, eyðingarbeiðnir og flutnings-
    beiðnir innan 7 daga frá ósk.

9. Trúnaður
9.1 Vinnsluaðili meðhöndlar allar persónuupplýsingar sem trúnaðarmál og
    tryggir að starfsfólk hafi undirritað trúnaðarskuldbindingu.

10. Bótaákvæði og ábyrgð
10.1 Aðilar bera þá ábyrgð sem leiðir af 82. gr. GDPR. Ákvæði þetta
     takmarkar ekki rétt skráðs einstaklings til bóta.

11. Gildistími og uppsögn
11.1 Samningurinn gildir á meðan þjónustusamband aðila stendur og lýkur með
     uppsögn þess. Skyldur skv. 4.1(f) lifa uppsögn af.

12. Lögsaga og varnarþing
12.1 Um samning þennan gilda íslensk lög. Rísi ágreiningur skal hann rekinn
     fyrir Héraðsdómi Reykjaness.

13. Undirritanir
13.1 Fyrir hönd Lifeline Health ehf.: ____________________________ Dags. _________
13.2 Fyrir hönd Aminogram SAS:        ____________________________ Dags. _________`;
}

// ─── 2.2  DPIA-lite for the wellness-mode interim ─────────────

export const DPIA_INTERIM_KEY = "dpia-wellness-interim";
export const DPIA_INTERIM_VERSION = "v1.0";

export function renderDPIAInterim(): string {
  return `MAT Á ÁHRIFUM Á PERSÓNUVERND (DPIA) — INTERIM WELLNESS-MODE
Lifeline Health ehf.
Útgáfa ${DPIA_INTERIM_VERSION}
Skv. 35. gr. GDPR og 29. gr. laga nr. 90/2018.

1. Bakgrunnur
1.1 Lifeline rekur heilbrigðisþjónustu skv. lögum nr. 40/2007 með leyfi frá
    Embætti landlæknis. Sjúkraskrá skjólstæðinga er varðveitt í Medalia
    (lög nr. 55/2009). Þangað til Medalia API tenging er tilbúin (áætlað
    innan 6 mánaða) starfar Lifeline appið og admin-svæðið sem velferðar-
    og sjálfsmælingatól (wellness-mode), aðskilið frá sjúkraskránni.

2. Lýsing á vinnslunni
2.1 Tegund gagna í Lifeline appi:
    a) Persónuupplýsingar: nafn, netfang, sími, heimilisfang, kennitala
       (síðustu 4 stafir), fæðingardagur.
    b) Sjálfsmælingar: þyngd, virkniupptökur, hreyfing, máltíðir,
       hugleiðingar — innslegnar af notanda eða sóttar með afdráttarlausu
       samþykki úr Biody Manager.
    c) Tímabókanir og samskipti við þjálfara.
2.2 Tegund gagna í Medalia (utan gildissviðs þessa DPIA): klínísk túlkun,
    blóðprufuniðurstöður, læknisbréf, full sjúkraskrá.

3. Lagagrundvöllur
3.1 Almennar persónuupplýsingar: 6. gr. (1)(b) GDPR (samningur).
3.2 Heilsufarsgögn í wellness-mode: 9. gr. (2)(a) GDPR (afdráttarlaust
    samþykki) auk 9. gr. (2)(h) (heilbrigðisþjónusta).
3.3 Sérstaklega vegna innflutnings frá Biody: skráð samþykki í
    client_consents (consent_key='biody-import-v1').

4. Áhætta sem metin er
4.1 Áhætta 1 — Klíníska gögn í Supabase utan sjúkraskrárkerfis.
    Líkur: lágar (vegna hlutverkaskiptingar og takmarkaðs aðgangs).
    Áhrif: há (Art. 9 gögn, lög nr. 55/2009).
    Mótvægi: (a) self-only RLS á body comp / weight log / macro_targets;
    (b) dulkóðun á klínískum dálkum við hvíld (sjá runbook); (c)
    skilaboða-skammstöfun „þetta eru ekki klínísk ráð"; (d) öllu starfsfólki
    bannað að nota appið sem sjúkraskrá og skv. móttökugátlista skuldbundið
    til að viðhalda því aðskilnaði.
4.2 Áhætta 2 — Misnotkun starfsmannsaðgangs.
    Líkur: lágar (lítill starfsmannafjöldi, undirritaðir samningar).
    Áhrif: há.
    Mótvægi: (a) hlutverkaskipt RLS (is_active_coach_or_clinician,
    is_admin_staff, is_active_psychologist); (b) audit_log skráir allar
    skrifaðgerðir; (c) ársfjórðungsleg endurskoðun aðgangs (staff_access_reviews).
4.3 Áhætta 3 — Kennitala í Supabase.
    Líkur: lágar (geymd sem síðustu 4 stafir).
    Áhrif: meðallmenn.
    Mótvægi: lágmörkunarreglan; engin geymsla á heilli kennitölu í Lifeline.
4.4 Áhætta 4 — Tilkynningarskil til Persónuverndar á 72 klst.
    Mótvægi: atvikastjórnun skjalfest í móttökugátlista starfsmanna; tengiliður
    pv@lifelinehealth.is; sjálfvirk tilkynning til viðkomandi yfirmanns.

5. Niðurstaða
5.1 Áhætta er metin viðunandi með framantöldum mótvægisaðgerðum, og afmörkun
    appsins sem velferðartóls (ekki sjúkraskrár) er trúverðug og tæknilega
    framkvæmanleg.
5.2 Endurskoðun: þetta DPIA skal endurskoðað:
    a) þegar Medalia API tengingin fer í loftið;
    b) við hverja meiri háttar breytingu á gagnaflæði;
    c) eigi síðar en 12 mánuðum frá útgáfudegi.

6. Undirritun persónuverndarfulltrúa
6.1 Persónuverndarfulltrúi: ____________________________
6.2 Dagsetning:               ____________________________
6.3 Næsta endurskoðun:        ____________________________`;
}

// ─── Biody import client consent (used by /account toggle) ────
// Versioned consent text for the Biody → Lifeline app data sync.
// Stored in client_consents with text_hash = sha256(this string).

export const CLIENT_CONSENT_BIODY_IMPORT_KEY = "biody-import-v1";
export const CLIENT_CONSENT_BIODY_IMPORT_VERSION = "v1.0";

export function renderClientConsentBiodyImport(): string {
  return `SAMÞYKKI FYRIR BIRTINGU LÍKAMSSAMSETNINGAR Í LIFELINE APPI
Útgáfa ${CLIENT_CONSENT_BIODY_IMPORT_VERSION}

Ég samþykki að líkamssamsetningarmælingar mínar úr Biody Manager séu
sóttar inn í mælaborðið mitt í Lifeline appinu.

Ég skil að:
- Þessi gögn eru SJÁLFSMÆLINGAR mínar í appinu, EKKI sjúkraskráin mín.
  Sjúkraskráin er varðveitt í Medalia skv. lögum nr. 55/2009.
- Ég get hvenær sem er afturkallað þetta samþykki í /account/settings.
  Þá eru afritin í appinu eytt; sjúkraskráin í Medalia helst óbreytt.
- Lifeline starfsmenn sjá þessi gögn í Medalia (þegar þörf krefur), ekki
  í gegnum appið — appdálkurinn er einkamál mitt.

Lagagrundvöllur: 9. gr. (2)(a) GDPR (afdráttarlaust samþykki) og lög nr.
90/2018 um persónuvernd.`;
}
