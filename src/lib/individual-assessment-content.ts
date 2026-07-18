// Icelandic legal texts for the B2C (self-pay individual) health
// assessment — the walk-in pathway where a person buys the heilsumat
// directly, has measurements taken at the Lyfja Smáratorg station,
// blood drawn + analysed at Sameind, and a doctor consultation by
// phone, video or in person.
//
// These are the individual-facing counterparts to the employer-
// sponsored (B2B) documents in agreement-templates.ts. Keep the two
// families separate: the B2B texts speak to „starfsmenn" and a
// „vinnuveitandi"; these speak to an individual who is the customer
// AND the data subject, with no employer in the loop.
//
// LANGUAGE: Icelandic is the SOURCE language and the only legally
// binding text. English is an unofficial courtesy translation for
// non-Icelandic-speaking reviewers.
//
// Two points are drafted with a sensible default and flagged for
// counsel in the drafts-page card descriptions (search „Lawyer note"):
//   1. Sameind's data-protection role (drafted as an independent
//      controller for the lab analysis).
//   2. Who performs the station measurements (drafted as Lifeline
//      personnel / agents operating a station at Lyfja Smáratorg).

export type DocumentLanguage = "is" | "en";

export const INDIVIDUAL_THJONUSTUSKILMALAR_VERSION = "individual-thjonustuskilmalar-v1.0";
export const INDIVIDUAL_HEALTH_CONSENT_VERSION = "individual-health-consent-v1.0";
export const INDIVIDUAL_PRIVACY_VERSION = "individual-privacy-v1.0";
export const INDIVIDUAL_QUALITY_CONSENT_VERSION = "individual-quality-consent-v1.0";

// ─────────────────────────────────────────────────────────────────
// 1. Þjónustuskilmálar (B2C service terms)
// ─────────────────────────────────────────────────────────────────
export function renderIndividualThjonustuskilmalar(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `TERMS OF SERVICE
Lifeline Health ehf. — Individual health assessment

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Parties
Lifeline Health ehf., reg. no. 590925-1440, Langholtsvegi 111, 104 Reykjavík ("Lifeline Health"), provides a health assessment to individuals who purchase the service directly from the company. Lifeline Health is an independent healthcare service.

2. Scope
These terms govern participation by individuals in the health assessment provided by Lifeline Health and purchased directly by the individual. The service is available only to individuals 18 years or older.

3. Nature of the service
The health assessment consists of a clinical risk assessment based on responses to questionnaires, lifestyle information, physical measurements and blood-test results.

The service is delivered in the following steps:
(a) Questionnaire and lifestyle information. The individual completes an electronic questionnaire before the assessment.
(b) Physical measurements. Measurements (such as blood pressure, body composition and other relevant measurements) are taken at a Lifeline Health measurement station located on the premises of Lyfja, Smáratorg.
(c) Blood test. A blood sample is taken and analysed at Sameind ehf. The results of the blood test are provided to Lifeline Health for interpretation as part of the assessment.
(d) Doctor's consultation. Interpretation of results and recommendations are performed by a doctor on behalf of Lifeline Health ehf. in a consultation held by telephone, by video call or in person, as chosen and agreed.

4. Risk algorithms
In performing the health assessment, recognised standardised risk algorithms are used, such as SCORE2, together with custom risk models developed by the medical team of Lifeline Health.

5. Personal data
Lifeline Health ehf. is the controller for the processing of personal data within the meaning of Act no. 90/2018 on data protection and Regulation (EU) 2016/679 (GDPR).
Processing is carried out for the purpose of providing a healthcare service in the form of a health assessment, risk assessment and medical advice. Recording and retention of health information takes place in the Medalia medical-record system, and Medalia ehf., reg. no. 530224-0230, is a processor within the meaning of Act no. 90/2018.
Blood tests are performed by Sameind ehf., which is an independent controller in respect of the analysis of blood samples and provides Lifeline Health with the results as part of the assessment.

6. Storage of data
All information collected in connection with the service is recorded and retained in the Medalia medical-record system as part of the individual's medical record.
Retention and handling of data is carried out in accordance with Act no. 55/2009 on medical records, Act no. 90/2018 on data protection and Regulation (EU) 2016/679 (GDPR). Information is retained in accordance with the statutory obligation of healthcare professionals to record and preserve medical records.

7. Disclosure of data
Personally identifiable health information is not disclosed to any third party except (a) to the extent necessary to deliver the service (such as transmission to and from Sameind ehf. for the blood test), (b) on the instruction or with the consent of the individual, or (c) where required or permitted by law.

8. Price, payment and cancellation
The price of the service and the payment terms are stated at the time of purchase. Payment is made before the service is performed unless otherwise specifically agreed.
The consumer's right of purchase, including the right to withdraw from the contract (14-day period) and the exceptions thereto, is governed by Lifeline Health's sales terms available on the company's website. Where performance of the service (measurements, blood test or doctor's consultation) begins at the individual's request before the period has expired, the individual agrees to waive the right of withdrawal to the extent the service has already been performed, cf. Art. 18 of Act no. 16/2016 on consumer contracts.
Changes to booked appointments and no-shows are governed by Lifeline Health's applicable booking rules.

9. Limitation of liability
The Lifeline Health assessment does not replace medical diagnosis or treatment by an appropriate healthcare service outside Lifeline Health. Lifeline Health is not responsible for decisions taken on the basis of the results of the health assessment, nor for health consequences of lifestyle changes the user chooses to implement.

10. Governing law and venue
These terms are governed by Icelandic law. Any dispute regarding the interpretation or performance of these terms shall be brought before the District Court of Reykjavík (Héraðsdómur Reykjavíkur).`;
  }
  return `ÞJÓNUSTUSKILMÁLAR
Lifeline Health ehf. — Heilsumat einstaklinga

1. Aðilar
Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir nefnt „Lifeline Health“), veitir einstaklingum heilsumat sem þeir kaupa beint af félaginu. Lifeline Health er sjálfstæð heilbrigðisþjónusta.

2. Gildissvið
Skilmálar þessir gilda um þátttöku einstaklinga í heilsumati sem Lifeline Health veitir og keypt er beint af einstaklingnum. Þjónustan er eingöngu í boði fyrir einstaklinga 18 ára og eldri.

3. Eðli þjónustu
Heilsumat Lifeline Health felur í sér klínískt áhættumat sem byggir á svörum við spurningalistum, lífsstílsupplýsingum, líkamlegum mælingum og niðurstöðum úr blóðrannsóknum.

Þjónustan er veitt í eftirfarandi skrefum:
(a) Spurningalisti og lífsstílsupplýsingar. Einstaklingur svarar rafrænum spurningalista fyrir heilsumatið.
(b) Líkamlegar mælingar. Mælingar (svo sem blóðþrýstingur, líkamssamsetning og aðrar viðeigandi mælingar) fara fram á mælingastöð Lifeline Health í húsnæði Lyfju, Smáratorgi.
(c) Blóðrannsókn. Blóðsýni er tekið og greint hjá Sameind ehf. Niðurstöður blóðrannsóknar eru afhentar Lifeline Health til túlkunar sem hluti af heilsumatinu.
(d) Læknisviðtal. Túlkun niðurstaðna og ráðleggingar eru framkvæmdar af lækni á vegum Lifeline Health ehf. í viðtali sem fer fram símleiðis, í fjarfundi (myndsímtali) eða með staðfundi, eftir vali og samkomulagi.

4. Áhættureiknirit
Við framkvæmd heilsumats er stuðst við viðurkennd stöðluð áhættureiknirit, svo sem SCORE2, auk sérhannaðra áhættulíkana þróaðra af læknateymi Lifeline Health.

5. Persónuupplýsingar
Lifeline Health ehf. er ábyrgðaraðili vinnslu persónuupplýsinga í skilningi laga nr. 90/2018 um persónuvernd og vinnslu persónuupplýsinga og reglugerðar (ESB) 2016/679 (GDPR).
Vinnsla persónuupplýsinga fer fram í þeim tilgangi að veita heilbrigðisþjónustu í formi heilsumats, áhættumats og læknisfræðilegrar ráðgjafar. Skráning og varðveisla heilbrigðisupplýsinga fer fram í Medalia sjúkraskrárkerfinu og telst Medalia ehf., kt. 530224-0230, vinnsluaðili í skilningi laga nr. 90/2018.
Blóðrannsóknir eru framkvæmdar af Sameind ehf., sem er sjálfstæður ábyrgðaraðili vinnslu að því er varðar greiningu blóðsýna og afhendir Lifeline Health niðurstöður sem hluta af heilsumatinu.

6. Geymsla gagna
Allar upplýsingar sem safnað er í tengslum við þjónustuna eru skráðar og varðveittar í Medalia sjúkraskrárkerfinu sem hluti af sjúkraskrá viðkomandi einstaklings.
Varðveisla og meðferð gagna fer fram í samræmi við lög nr. 55/2009 um sjúkraskrár, lög nr. 90/2018 um persónuvernd og vinnslu persónuupplýsinga og reglugerð (ESB) 2016/679 (GDPR). Upplýsingar eru varðveittar í samræmi við lögbundna skyldu heilbrigðisstarfsmanna til skráningar og varðveislu sjúkraskráa.

7. Miðlun upplýsinga
Persónugreinanlegar heilsufarsupplýsingar eru ekki afhentar þriðja aðila nema (a) að því marki sem nauðsynlegt er til framkvæmdar þjónustunnar (svo sem miðlun til og frá Sameind ehf. vegna blóðrannsóknar), (b) samkvæmt fyrirmælum eða samþykki einstaklingsins sjálfs, eða (c) þar sem lög mæla fyrir um eða heimila slíka miðlun.

8. Verð, greiðsla og afpöntun
Verð þjónustunnar og greiðsluskilmálar koma fram við kaup. Greiðsla fer fram fyrir framkvæmd þjónustunnar nema um annað sé sérstaklega samið.
Um kauprétt neytenda, þ.m.t. rétt til að falla frá samningi (14 daga frestur) og undantekningar þar frá, gilda söluskilmálar Lifeline Health sem aðgengilegir eru á vefsvæði félagsins. Þar sem framkvæmd þjónustunnar (mælingar, blóðrannsókn eða læknisviðtal) hefst að ósk einstaklingsins áður en fresturinn er liðinn, samþykkir einstaklingurinn að falla frá afpöntunarréttinum að því marki sem þjónustan hefur þegar verið innt af hendi, sbr. 18. gr. laga nr. 16/2016 um neytendasamninga.
Um breytingar á bókuðum tímum og útivist (t.d. ef ekki er mætt í bókaðan tíma) fer samkvæmt gildandi bókunarreglum Lifeline Health.

9. Takmörkun ábyrgðar
Heilsumat Lifeline Health kemur ekki í stað læknisfræðilegrar greiningar eða meðferðar hjá viðeigandi heilbrigðisþjónustu utan Lifeline Health. Lifeline Health ber ekki ábyrgð á ákvörðunum sem teknar eru á grundvelli niðurstaðna heilsumats eða heilsufarslegum afleiðingum breytinga á lífsstíl sem notandi velur að innleiða.

10. Lögsaga og varnarþing
Um skilmála þessa gilda íslensk lög. Rísi ágreiningur vegna túlkunar eða framkvæmdar skilmála þessara skal hann rekinn fyrir Héraðsdómi Reykjavíkur.`;
}

// ─────────────────────────────────────────────────────────────────
// 2. Upplýst samþykki (informed consent — click-through)
// ─────────────────────────────────────────────────────────────────
export function renderIndividualHealthConsent(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `INFORMED CONSENT
Participation in the health assessment of Lifeline Health ehf.

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

By giving my consent I confirm the following:

- I agree to participate in a health assessment with Lifeline Health ehf.
- I agree that my personal data, including sensitive health information, be processed for the purpose of performing a clinical risk assessment.
- I agree to undergo physical measurements and a blood test for the purposes of the assessment, including the taking and analysis of a blood sample at Sameind ehf., and that the results be provided to Lifeline Health for interpretation.
- I agree that information about my health be recorded and retained in the Medalia medical-record system in accordance with Act no. 90/2018 and Regulation (EU) 2016/679 (GDPR).
- I understand that the assessment is based on my answers and the information I provide.
- I understand that the results of the assessment are interpreted by a doctor on behalf of Lifeline Health ehf. in a consultation held by telephone, by video call or in person.
- I understand that the assessment does not replace medical diagnosis or treatment by my own doctor or another healthcare service.`;
  }
  return `UPPLÝST SAMÞYKKI
Þátttaka í heilsumati Lifeline Health ehf.

Með samþykki mínu staðfesti ég eftirfarandi:

- Ég samþykki að taka þátt í heilsumati hjá Lifeline Health ehf.
- Ég samþykki að persónuupplýsingar mínar, þ.m.t. viðkvæmar heilsufarsupplýsingar, séu unnar í þeim tilgangi að framkvæma klínískt áhættumat.
- Ég samþykki að láta framkvæma á mér líkamlegar mælingar og blóðrannsókn í þágu heilsumatsins, þ.m.t. töku og greiningu blóðsýnis hjá Sameind ehf., og að niðurstöður séu afhentar Lifeline Health til túlkunar.
- Ég samþykki að upplýsingar um heilsufar mitt séu skráðar og varðveittar í Medalia sjúkraskrárkerfinu í samræmi við lög nr. 90/2018 og reglugerð (ESB) 2016/679 (GDPR).
- Ég geri mér grein fyrir að heilsumatið byggir á svörum mínum og þeim upplýsingum sem ég veiti.
- Ég geri mér grein fyrir að niðurstöður heilsumats eru túlkaðar af lækni á vegum Lifeline Health ehf. í viðtali sem fram fer símleiðis, í fjarfundi eða með staðfundi.
- Ég geri mér grein fyrir að heilsumatið kemur ekki í stað læknisfræðilegrar greiningar eða meðferðar hjá eigin lækni eða annarri heilbrigðisþjónustu.`;
}

// ─────────────────────────────────────────────────────────────────
// 3. Persónuverndarstefna (privacy policy)
// ─────────────────────────────────────────────────────────────────
export function renderIndividualPrivacyPolicy(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `PRIVACY POLICY
Lifeline Health ehf. — Individual health assessment

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Controller
Lifeline Health ehf., reg. no. 590925-1440, is the controller for the processing of personal data in connection with the health assessment of individuals. Lifeline Health ehf. provides an independent healthcare service.

2. Processing of personal data
Personal data, including sensitive personal data on health, is processed in connection with performing the health assessment and providing medical advice. Processing is carried out for the purpose of providing a healthcare service and is based on legal obligation and the authorisation to process health information under Act no. 55/2009 on medical records, Act no. 90/2018 on data protection and Regulation (EU) 2016/679 (GDPR).

3. Storage and security of data
Information is recorded and retained in the Medalia medical-record system as part of the individual's medical record. Medalia acts as a processor on behalf of Lifeline Health ehf. under a data processing agreement. Retention and handling of data is carried out in accordance with the statutory obligation of healthcare professionals to record and preserve medical records under Act no. 55/2009 on medical records.

4. Delivery of the service through partners
Physical measurements are taken at a measurement station on the premises of Lyfja, Smáratorg, and blood tests are performed by Sameind ehf. Personal data is transmitted between Lifeline Health and Sameind ehf. to the extent necessary to perform the blood test and interpret the results.

5. Disclosure of data
Personally identifiable health information is not disclosed to any third party except to the extent necessary to deliver the service, on the individual's consent, or where required by law.

6. Research and product-development purposes
Non-identifiable data may be used for research or product-development purposes under separate informed consent to that effect.

7. Rights of data subjects
Individuals have the right to access their own information, to have inaccurate information corrected and, where applicable, to restrict the processing of personal data in accordance with applicable law. Requests for access or correction should be sent to contact@lifelinehealth.is.`;
  }
  return `PERSÓNUVERNDARSTEFNA
Lifeline Health ehf. — Heilsumat einstaklinga

1. Ábyrgðaraðili
Lifeline Health ehf., kt. 590925-1440, er ábyrgðaraðili vinnslu persónuupplýsinga í tengslum við heilsumat einstaklinga. Lifeline Health ehf. veitir sjálfstæða heilbrigðisþjónustu.

2. Vinnsla persónuupplýsinga
Unnið er með persónuupplýsingar, þ.m.t. viðkvæmar persónuupplýsingar um heilsufar, í tengslum við framkvæmd heilsumats og læknisfræðilegrar ráðgjafar. Vinnsla fer fram í þeim tilgangi að veita heilbrigðisþjónustu og byggir á lagaskyldu og heimild til vinnslu heilbrigðisupplýsinga samkvæmt lögum nr. 55/2009 um sjúkraskrár, lögum nr. 90/2018 um persónuvernd og vinnslu persónuupplýsinga og reglugerð (ESB) 2016/679 (GDPR).

3. Geymsla og öryggi gagna
Upplýsingar eru skráðar og varðveittar í Medalia sjúkraskrárkerfinu sem hluti af sjúkraskrá viðkomandi einstaklings. Medalia starfar sem vinnsluaðili fyrir hönd Lifeline Health ehf. á grundvelli vinnslusamnings. Varðveisla og meðferð gagna fer fram í samræmi við lögbundna skyldu heilbrigðisstarfsmanna til skráningar og varðveislu sjúkraskráa samkvæmt lögum nr. 55/2009 um sjúkraskrár.

4. Móttaka þjónustu hjá samstarfsaðilum
Líkamlegar mælingar fara fram á mælingastöð í húsnæði Lyfju, Smáratorgi, og blóðrannsóknir eru framkvæmdar af Sameind ehf. Persónuupplýsingum er miðlað milli Lifeline Health og Sameindar ehf. að því marki sem nauðsynlegt er vegna framkvæmdar blóðrannsóknar og túlkunar niðurstaðna.

5. Miðlun upplýsinga
Persónugreinanlegar heilsufarsupplýsingar eru ekki afhentar þriðja aðila nema að því marki sem nauðsynlegt er til framkvæmdar þjónustunnar, samkvæmt samþykki einstaklingsins eða þar sem lög mæla fyrir um slíka miðlun.

6. Rannsóknar- og vöruþróunartilgangur
Ópersónugreinanleg gögn kunna að vera notuð í rannsóknar- eða vöruþróunartilgangi samkvæmt aðskildu upplýstu samþykki þar að lútandi.

7. Réttindi skráðra einstaklinga
Einstaklingar eiga rétt á að fá aðgang að eigin upplýsingum, fá rangar upplýsingar leiðréttar og eftir atvikum takmarka vinnslu persónuupplýsinga í samræmi við gildandi lög. Beiðnir um aðgang eða leiðréttingu skulu berast á contact@lifelinehealth.is.`;
}

// ─────────────────────────────────────────────────────────────────
// 4. Upplýst samþykki fyrir þátttöku í rannsókn / gæðamati
// ─────────────────────────────────────────────────────────────────
export function renderIndividualQualityResearchConsent(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `DECLARATION OF INFORMED CONSENT FOR PARTICIPATION IN QUALITY-ASSURANCE RESEARCH

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

Lifeline Health ehf. works continuously to improve the quality and safety of its service. To ensure internal quality assurance and the development of the service, the company requests your consent to the use of certain health information and data generated during your health examination. The aim is to analyse statistical information and quality indicators to improve processes, assessments and the client service experience.

Principal investigator: Guðmundur Vignir Sigurðsson, MD, PhD, Lifeline Health ehf.

Description of the research and its purpose: The purpose of this research is to improve the service, analyse outcomes, ensure internal quality assurance and develop the service through statistical processing of health information. The research is based solely on data that Lifeline Health ehf. collects during health examinations and monitoring; no new collection of samples or data will take place.

Handling of data and privacy: Information about your health, your questionnaire responses and your blood-test results will be rendered non-identifiable so that neither the researchers nor anyone else can trace them back to you once processing is complete. Processing of the data is carried out in accordance with data-protection law and the rules on the security of health data.

Right to decline participation and withdraw consent: Participation in the research is entirely voluntary. You are entitled to decline participation or to withdraw your consent at any time, without having to give reasons for that decision. Withdrawal of consent has no effect on your right to healthcare or your relationship with your doctor.

Confirmation of the participant: I have read the above information and hereby give my informed consent to the use of my health information for the above purpose in non-identifiable form.`;
  }
  return `YFIRLÝSING UM UPPLÝST SAMÞYKKI FYRIR ÞÁTTTÖKU Í RANNSÓKN / GÆÐAMATI

LifeLine Health ehf. vinnur stöðugt að því að bæta gæði og öryggi þjónustu sinnar. Til að tryggja innra gæðamat og þróun þjónustunnar óskar fyrirtækið eftir samþykki þínu fyrir notkun tiltekinna heilsufarsupplýsinga og gagna sem verða til við heilsufarsskoðun þína. Markmiðið er að greina tölfræðilegar upplýsingar og gæðavísa til að bæta ferla, greiningar og þjónustuupplifun skjólstæðinga.

Ábyrgðarmaður rannsóknar: Guðmundur Vignir Sigurðsson, MD, PhD, Lifeline Health ehf.

Lýsing á rannsókn og tilgangur: Tilgangur þessarar rannsóknar er að bæta þjónustu, greina árangur, tryggja innra gæðamat og þróun þjónustunnar með tölfræðilegri úrvinnslu heilsufarsupplýsinga. Rannsóknin byggir eingöngu á gögnum sem Lifeline Health ehf. safnar við heilsufarsskoðanir og eftirlit en engin ný söfnun sýna eða gagna mun eiga sér stað.

Meðferð gagna og persónuvernd: Upplýsingar um heilsufar þitt, svör við spurningalista og niðurstöður úr blóðrannsókn verða gerð ópersónugreinanleg þannig að hvorki rannsakendur né aðrir geti rakið þau aftur til þín þegar vinnslu er lokið. Vinnsla gagnanna fer fram í samræmi við lög um persónuvernd og reglur um öryggi heilbrigðisgagna.

Réttur til að hafna þátttöku og afturkalla samþykki: Þátttaka í rannsókninni er alfarið frjáls. Þér er heimilt að hafna þátttöku eða draga samþykki þitt til baka hvenær sem er, án þess að þurfa að gefa skýringar á þeirri ákvörðun. Afturköllun samþykkis hefur engin áhrif á rétt þinn til heilbrigðisþjónustu eða samband þitt við lækni.

Staðfesting þátttakanda: Ég hef kynnt mér ofangreindar upplýsingar og gef hér með upplýst samþykki mitt fyrir því að heilsufarsupplýsingar mínar séu notaðar í ofangreindum tilgangi á ópersónugreinanlegu formi.`;
}
