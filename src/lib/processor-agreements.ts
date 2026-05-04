// Internal compliance documents — Lifeline Health.
// These texts are intended to be reviewed by legal counsel, signed by
// authorised representatives, hashed (sha256), and stored under
// company_documents with the appropriate `kind` so they're durable
// evidence in a Persónuvernd audit.
//
// Same versioning discipline as agreement-templates.ts /
// platform-terms-content.ts: any text change MUST bump the version
// constant so the stored hash remains a unique fingerprint.
//
// LANGUAGE: Icelandic is the SOURCE language. English translations
// are courtesy translations for bilingual review. The IS version is
// what's hashed and signed.

export type DocumentLanguage = "is" | "en";

// ─── 1.7  Medalia joint-controller arrangement (GDPR Art. 26) ──

export const MEDALIA_JOINT_CONTROLLER_KEY = "medalia-joint-controller";
export const MEDALIA_JOINT_CONTROLLER_VERSION = "v1.2";

export function renderMedaliaJointControllerArrangement(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `JOINT CONTROLLER ARRANGEMENT FOR MEDICAL-RECORD DATA
Lifeline Health ehf. and Medalia ehf.
Version ${MEDALIA_JOINT_CONTROLLER_VERSION}
Per Article 26 of Regulation (EU) 2016/679 (GDPR) and Act no. 90/2018 on data protection.

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Parties
1.1 Lifeline Health ehf., reg. no. 590925-1440, Langholtsvegi 111, 104 Reykjavík ("Lifeline").
1.2 Medalia ehf., reg. no. 530224-0230, Kirkjubraut 13, 170 Seltjarnarnes ("Medalia"). Medalia operates a recognised medical-record system licensed under Act no. 55/2009 on medical records.

2. Purpose and scope
2.1 The parties work jointly to collect, store and provide access to medical-record data of individuals using Lifeline's healthcare service. Processing is based on Article 9(2)(h) GDPR (provision of healthcare) and Article 9(2)(a) GDPR (explicit consent) where applicable.
2.2 The parties are joint controllers within the meaning of Article 26 GDPR for the processing covered by this arrangement.

3. Allocation of responsibility
3.1 Lifeline is responsible for:
    a) obtaining the patient's informed consent;
    b) collection of base data (questionnaires, measurements, blood samples);
    c) clinical interpretation and the health-assessment summary;
    d) delivery of the health-assessment report to the patient and statutory follow-up;
    e) fulfilling its obligations as a healthcare service under Act no. 40/2007.
3.2 Medalia is responsible for:
    a) secure storage of medical-record data in a system licensed under Act no. 55/2009;
    b) access management, operation and statutory traceability logging under Article 14 of that Act;
    c) technical security (encryption at rest and in transit, backup, incident response);
    d) enforcement of the rights of data subjects within the medical-record system.

4. Joint responsibility
4.1 The parties are jointly responsible for:
    a) providing data subjects with the information required by Articles 13 and 14 GDPR;
    b) receiving and processing data-subject requests under Articles 15–22 GDPR (access, rectification, erasure, restriction, objection, portability);
    c) notifying personal-data breaches under Articles 33 and 34 GDPR.

5. Contact for data subjects
5.1 Data subjects may exercise their rights against either party. For simplicity Lifeline is the primary contact (pv@lifelinehealth.is). Lifeline forwards to Medalia where the request requires action within the medical-record system.
5.2 Each party shall respond to the data subject within 30 days of receipt of the request, in accordance with Article 12 GDPR.

6. Technical and organisational security
6.1 The parties undertake to maintain appropriate technical and organisational measures under Article 32 GDPR, including:
    a) encryption of sensitive data at rest and in transit;
    b) role-based access management (least privilege);
    c) statutory traceability logging of medical-record access;
    d) regular reviews and incident response.
6.2 Access by Lifeline staff to the medical record takes place inside Medalia. Lifeline does not operate an independent medical record outside Medalia.

7. Incident response and notifications
7.1 A party that becomes aware of a personal-data breach shall notify the other party without undue delay and no later than 24 hours after the incident becomes apparent.
7.2 Lifeline takes responsibility for notification to the Icelandic Data Protection Authority and data subjects under Articles 33 and 34 GDPR when the incident concerns data in collection or clinical interpretation. Medalia takes responsibility for notification when the incident concerns the medical-record system itself. The parties coordinate beforehand when both apply.

8. Sub-processors
8.1 Each party manages its own sub-processors under Article 28 GDPR and shares its current list with the other party on request.

9. Term and termination
9.1 This arrangement applies while the parties cooperate on healthcare under the service agreement.
9.2 On termination Medalia shall continue to retain the medical-record data in accordance with Act no. 55/2009. Lifeline deletes its own copies within 90 days.

10. Disclosure to data subjects
10.1 An extract of this arrangement shall be published in Lifeline's privacy notice (lifelinehealth.is/privacy) in accordance with Article 26(2) GDPR.

11. Governing law and venue
11.1 This arrangement is governed by Icelandic law. Any dispute shall be brought before the District Court of Reykjanes (Héraðsdómur Reykjaness).

12. Signatures
12.1 For Lifeline Health ehf.: ____________________________ Date: _________
12.2 For Medalia ehf.:         ____________________________ Date: _________`;
  }
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

export function renderBiodyDPA(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `DATA PROCESSING AGREEMENT — BIODY MANAGER
Lifeline Health ehf. and Aminogram SAS (Biody Manager)
Version ${BIODY_DPA_VERSION}
Per Article 28 of Regulation (EU) 2016/679 (GDPR) and Act no. 90/2018.

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Parties
1.1 Controller: Lifeline Health ehf., reg. no. 590925-1440 ("Controller").
1.2 Processor: Aminogram SAS, operator of the Biody Manager measurement-device and cloud service ("Processor").

2. Subject matter and purpose of processing
2.1 The Processor provides device and software for body-composition measurements of the Controller's patients. Measurements take place at sites the Controller has agreements with.
2.2 The Processor processes personal data only on the Controller's instructions and for the purpose of that service.

3. Categories of personal data and data subjects
3.1 Personal data: name, email, date of birth, sex, height, lifestyle level, results of body-composition measurements (fat percentage, muscle mass, phase angle, BMR, body water etc.), measurement timestamps.
3.2 Categories: Lifeline patients aged 18 or over who have given explicit consent to measurement.
3.3 The Processor does NOT receive a kennitala and has no access to patients' passwords.

4. Obligations of the Processor
4.1 The Processor undertakes to:
    a) process personal data only on the Controller's documented instructions;
    b) ensure that staff with access are bound by confidentiality;
    c) maintain appropriate technical and organisational measures under Article 32 GDPR;
    d) assist the Controller in fulfilling its obligations to data subjects (Articles 15–22 GDPR);
    e) assist the Controller in notifying personal-data breaches;
    f) delete or return all personal data on termination at the Controller's request;
    g) make available all information necessary to demonstrate compliance with this agreement, and allow inspections or audits, including those carried out by a third party on the Controller's behalf.

5. Sub-processors
5.1 The Processor may only engage a sub-processor with the prior written consent of the Controller. The list of approved sub-processors forms an annex to this agreement and is updated regularly.
5.2 The Processor notifies the Controller at least 30 days before any change to sub-processors and gives the Controller the opportunity to object.

6. Incident response
6.1 The Processor notifies the Controller without undue delay and no later than 24 hours after a personal-data breach is discovered.
6.2 The notification shall contain the information required by Article 33(3) GDPR, to the extent available.

7. Transfer to third countries
7.1 Personal data is hosted within the EEA (France). If transfer outside the EEA becomes necessary it shall be based on appropriate safeguards under Article 46 GDPR (e.g. SCCs).

8. Rights of data subjects
8.1 The Processor provides the Controller with technical support to fulfil access requests, rectification requests, erasure requests and portability requests within 7 days of the request.

9. Confidentiality
9.1 The Processor treats all personal data as confidential and ensures that staff have signed a confidentiality undertaking.

10. Liability and indemnity
10.1 The parties bear the liability that follows from Article 82 GDPR. This provision does not limit the data subject's right to compensation.

11. Term and termination
11.1 The agreement applies while the service relationship exists and ends on its termination. Obligations under §4.1(f) survive termination.

12. Governing law and venue
12.1 This agreement is governed by Icelandic law. Any dispute shall be brought before the District Court of Reykjanes (Héraðsdómur Reykjaness).

13. Signatures
13.1 For Lifeline Health ehf.: ____________________________ Date: _________
13.2 For Aminogram SAS:        ____________________________ Date: _________`;
  }
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

export function renderDPIAInterim(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `DATA PROTECTION IMPACT ASSESSMENT (DPIA) — INTERIM WELLNESS MODE
Lifeline Health ehf.
Version ${DPIA_INTERIM_VERSION}
Per Article 35 GDPR and Article 29 of Act no. 90/2018.

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Background
1.1 Lifeline operates a healthcare service under Act no. 40/2007 with a licence from the Directorate of Health. Patient medical-record data is stored in Medalia (Act no. 55/2009). Until the Medalia API integration is ready (estimated within 6 months) the Lifeline app and admin area operate as a wellness and self-tracking tool (wellness mode), separated from the medical record.

2. Description of processing
2.1 Type of data in the Lifeline app:
    a) Personal data: name, email, phone, address, kennitala (last 4 digits), date of birth.
    b) Self-measurements: weight, activity records, exercise, meals, reflections — entered by the user or imported with explicit consent from Biody Manager.
    c) Bookings and communications with the coach.
2.2 Type of data in Medalia (outside the scope of this DPIA): clinical interpretation, blood-test results, doctor's letters, the full medical record.

3. Legal basis
3.1 General personal data: Article 6(1)(b) GDPR (contract).
3.2 Health data in wellness mode: Article 9(2)(a) GDPR (explicit consent) and Article 9(2)(h) (provision of healthcare).
3.3 Specifically for import from Biody: recorded consent in client_consents (consent_key='biody-import-v1').

4. Risks assessed
4.1 Risk 1 — Clinical data in Supabase outside the medical-record system.
    Likelihood: low (due to role separation and limited access).
    Impact: high (Art. 9 data, Act no. 55/2009).
    Mitigation: (a) self-only RLS on body comp / weight log / macro_targets;
    (b) encryption of clinical columns at rest (see runbook); (c) message
    abbreviation "this is not clinical advice"; (d) all staff prohibited
    from using the app as a medical record and bound by the onboarding
    checklist to maintain that separation.
4.2 Risk 2 — Misuse of staff access.
    Likelihood: low (small staff, signed agreements).
    Impact: high.
    Mitigation: (a) role-based RLS (is_active_coach_or_clinician,
    is_admin_staff, is_active_psychologist); (b) audit_log records all
    write operations; (c) quarterly access review (staff_access_reviews).
4.3 Risk 3 — Kennitala in Supabase.
    Likelihood: low (stored as last 4 digits).
    Impact: medium.
    Mitigation: minimisation principle; no full-kennitala storage in Lifeline.
4.4 Risk 4 — 72-hour notification deadline to the Data Protection Authority.
    Mitigation: incident management documented in the staff onboarding
    checklist; contact pv@lifelinehealth.is; automatic notification to
    the relevant supervisor.

5. Conclusion
5.1 The risk is assessed as acceptable with the above mitigations, and the
    delineation of the app as a wellness tool (not the medical record) is
    credible and technically feasible.
5.2 Review: this DPIA shall be reviewed:
    a) when the Medalia API integration goes live;
    b) on any major change to data flow;
    c) no later than 12 months from the date of issue.

6. Signature of the Data Protection Officer
6.1 Data Protection Officer: ____________________________
6.2 Date:                     ____________________________
6.3 Next review:              ____________________________`;
  }
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

export function renderClientConsentBiodyImport(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `CONSENT TO DISPLAY BODY-COMPOSITION DATA IN THE LIFELINE APP
Version ${CLIENT_CONSENT_BIODY_IMPORT_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

I consent to my body-composition measurements from Biody Manager being
imported into my dashboard in the Lifeline app.

I understand that:
- This data is my SELF-TRACKING in the app, NOT my medical record.
  My medical record is held in Medalia under Act no. 55/2009.
- I can withdraw this consent at any time in /account/settings.
  The copies in the app are then deleted; the medical record in
  Medalia is unaffected.
- Lifeline staff see this data in Medalia (when needed), not via the
  app — the app column is private to me.

Legal basis: Article 9(2)(a) GDPR (explicit consent) and Act no.
90/2018 on data protection.`;
  }
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
