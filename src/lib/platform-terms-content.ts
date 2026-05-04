// Platform-level legal documents accepted by every contact person at signup.
// The EXACT string returned by the render functions is hashed and stored in
// platform_agreement_acceptances.text_hash. Any change — even whitespace —
// MUST bump the version so existing users get re-prompted to accept.
//
// LANGUAGE: Icelandic is the SOURCE language (the version hashed +
// legally binding under §6.1 of each doc — Icelandic law). English
// translations are provided as a courtesy for non-Icelandic-speaking
// users and for the lawyer's bilingual review. If the IS and EN
// versions ever conflict, IS wins. Acceptance flows must always pass
// language="is" so the hash is computed against the binding text.

export type DocumentLanguage = "is" | "en";

export const TOS_VERSION = "v1.1";
export const DPA_VERSION = "v1.0";
export const EMPLOYEE_TOS_VERSION = "v1.1";
export const HEALTH_CONSENT_VERSION = "v1.0";

export const TOS_KEY = "terms-of-service";
export const DPA_KEY = "data-processing-agreement";
export const EMPLOYEE_TOS_KEY = "employee-terms-of-service";
export const HEALTH_CONSENT_KEY = "health-assessment-consent";

// ─── Terms of Service (platform use) ────────────────────────
export function renderTermsOfService(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `TERMS OF USE
Lifeline Health ehf. – Service portal for employers
Version ${TOS_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Parties and scope
1.1 Lifeline Health ehf., reg. no. 590925-1440, Langholtsvegi 111, 104 Reykjavík ("Lifeline Health") operates a service portal (heilsumat.lifelinehealth.is and related URLs) which allows employers to enrol employees in health-assessment services and manage their participation.
1.2 These terms govern all use of the service portal by employers, their contact persons, and any other authorised users.
1.3 By creating an account and ticking the acceptance checkbox the user confirms that they have read and accept these terms on behalf of the employer.

2. Access and authority
2.1 The employer's contact person warrants that they are authorised to act for the company and to bind it through their entries.
2.2 The contact person is responsible for keeping their login credentials secure and for notifying Lifeline Health without delay if account misuse is suspected.

3. Acceptable use
3.1 The user shall not:
    a) use the service portal unlawfully or contrary to general standards of decency;
    b) attempt to disrupt or impair the operation or security of the portal;
    c) submit false, misleading or deceptive information about employees;
    d) upload personal data which the user has no lawful basis to process.
3.2 Lifeline Health reserves the right to disable any account which breaches these terms.

4. Role and limitation of liability
4.1 The service portal is an administrative tool for managing health-assessment projects and does not replace the actual healthcare service or medical advice.
4.2 Lifeline Health uses reasonable efforts to keep the portal in operation but does not warrant that it will always be free from defects, interruptions or security incidents.
4.3 Lifeline Health is not liable for any loss to the user caused by malfunctions, third-party providers, or events beyond its reasonable control.

5. Intellectual property
5.1 All content on the service portal — including software, text, images, trademarks and design — is the property of Lifeline Health or its partners and protected by copyright and intellectual-property law.
5.2 The user may not copy, modify, distribute or commercially exploit the content without Lifeline Health's prior written consent.

6. Fees and commercial agreement
6.1 Use of the service portal itself is provided at no charge to the employer; fees for the actual health-assessment service are charged on the basis of a separate service agreement and purchase order signed electronically before service is delivered.
6.2 These terms do not replace the commercial service agreement for health-assessment services.

7. Termination
7.1 The user may at any time request that their account be closed by emailing contact@lifelinehealth.is.
7.2 Lifeline Health may close an account on reasonable notice or without notice if the user breaches these terms.

8. Changes to these terms
8.1 Lifeline Health may update these terms. For material changes the user will be asked to accept the new version before continued use is permitted.

9. Governing law and venue
9.1 These terms are governed by Icelandic law. Any dispute shall be brought before the District Court of Reykjanes (Héraðsdómur Reykjaness).`;
  }
  return `NOTKUNARSKILMÁLAR
Lifeline Health ehf. – Þjónustusíða fyrir vinnuveitendur
Útgáfa ${TOS_VERSION}

1. Aðilar og gildissvið
1.1 Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir „Lifeline Health") rekur þjónustusíðu (heilsumat.lifelinehealth.is og tengdar slóðir) sem gerir vinnuveitendum kleift að skrá starfsmenn í heilsumatsþjónustu og hafa umsjón með þátttöku þeirra.
1.2 Skilmálar þessir gilda um alla notkun þjónustusíðunnar af hálfu vinnuveitenda, tengiliða þeirra og annarra notenda sem aðgang hafa.
1.3 Með því að stofna aðgang og merkja við samþykki staðfestir notandi að hann hafi lesið og samþykki skilmála þessa fyrir hönd vinnuveitandans.

2. Aðgangur og heimild
2.1 Tengiliður vinnuveitanda ábyrgist að hann hafi heimild til að koma fram fyrir hönd fyrirtækisins og binda það með skráningum sínum.
2.2 Tengiliður ber ábyrgð á því að halda innskráningargögnum sínum öruggum og tilkynna Lifeline Health tafarlaust ef grunur leikur á misnotkun aðgangs.

3. Viðunandi notkun
3.1 Notandi skal ekki:
    a) nota þjónustusíðuna á ólöglegan hátt eða í andstöðu við almennt siðferði;
    b) reyna að trufla eða hindra rekstur síðunnar eða öryggi hennar;
    c) senda inn rangar, misvísandi eða blekkjandi upplýsingar um starfsmenn;
    d) hlaða inn persónuupplýsingum sem hann hefur ekki lögmæta heimild til að vinna með.
3.2 Lifeline Health áskilur sér rétt til að loka aðgangi sem brýtur gegn skilmálum þessum.

4. Hlutverk og takmörkun ábyrgðar
4.1 Þjónustusíðan er aðstoðartæki fyrir umsjón heilsumatsverkefna og kemur ekki í stað sjálfrar heilbrigðisþjónustunnar eða ráðgjafar lækna.
4.2 Lifeline Health leggur sig fram við að halda síðunni í rekstri en ábyrgist ekki að hún sé ávallt laus við galla, truflanir eða öryggisatvik.
4.3 Lifeline Health ber ekki ábyrgð á tjóni notanda af völdum bilana, utanaðkomandi þjónustuaðila eða vikna sem stafa af ófyrirséðum atvikum.

5. Hugverkaréttur
5.1 Allt efni þjónustusíðunnar, þar á meðal hugbúnaður, textar, myndefni, vörumerki og hönnun, er eign Lifeline Health eða samstarfsaðila þess og verndað samkvæmt höfundarréttar- og hugverkalögum.
5.2 Notanda er óheimilt að afrita, breyta, dreifa eða nýta efnið í viðskiptalegum tilgangi án skriflegs samþykkis Lifeline Health.

6. Gjaldtaka og viðskiptasamningur
6.1 Notkun þjónustusíðunnar sjálfrar er vinnuveitanda að kostnaðarlausu; gjaldtaka fyrir heilsumatsþjónustuna sjálfa fer fram á grundvelli sérstaks þjónustusamnings og innkaupapöntunar sem undirrituð er rafrænt áður en þjónusta er veitt.
6.2 Þessir skilmálar koma ekki í stað viðskiptasamnings um heilsumatsþjónustu.

7. Uppsögn
7.1 Notandi getur hvenær sem er óskað eftir því að aðgangur hans verði lokaður með tölvupósti á contact@lifelinehealth.is.
7.2 Lifeline Health getur lokað aðgangi með eðlilegum fyrirvara eða án fyrirvara ef notandi brýtur skilmálana.

8. Breytingar á skilmálum
8.1 Lifeline Health getur uppfært skilmála þessa. Við verulegar breytingar verður þess farið á leit að notandi samþykki nýja útgáfu áður en áframhaldandi notkun er heimiluð.

9. Lögsaga og varnarþing
9.1 Um skilmála þessa gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjaness.`;
}

// ─── Data Processing Agreement (GDPR) ──────────────────────
export function renderDataProcessingAgreement(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `DATA PROCESSING AGREEMENT
Lifeline Health ehf. – Employee health assessment
Version ${DPA_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Background and purpose
1.1 This data processing agreement is entered into pursuant to Article 28 of Regulation (EU) 2016/679 of the European Parliament and the Council (GDPR) and Act no. 90/2018 on data protection and the processing of personal data.
1.2 The agreement governs all processing of personal data which Lifeline Health ehf. (the "processor") performs on behalf of the employer (the "controller") in connection with the health-assessment service.

2. Definitions
2.1 Terms used in this agreement have the meaning given in Article 4 GDPR.

3. Roles of the parties
3.1 The controller is the employee's employer and determines the purpose and means of processing the employee data which it transfers to the processor.
3.2 The processor processes the personal data only in accordance with the controller's documented instructions and in compliance with this agreement.
3.3 When an employee participates in the health assessment and provides their direct consent, Lifeline Health becomes an independent controller of that individual's health data under Act no. 34/2012 on healthcare professionals and Act no. 55/2009 on medical records. That processing falls outside this agreement.

4. Nature and purpose of processing
4.1 The purpose of processing is to enable Lifeline Health to offer the controller's employees participation in the health assessment and to manage bookings and the status of each employee throughout the process.
4.2 The nature of processing is collection, storage, transmission, deletion and other handling of personal data under this agreement.

5. Categories of personal data
5.1 The following categories of personal data will be processed on behalf of the controller:
    a) name, kennitala (Icelandic ID number), email and phone number of employees;
    b) the employee's status in the invitation flow (invitation sent, booking, attendance);
    c) the employee's affiliation with the employer (membership identifier).
5.2 Special categories of health data (Art. 9 GDPR) are not processed on behalf of the controller. Such processing takes place under the responsibility of Lifeline Health as an independent controller, on the basis of the employee's direct consent.

6. Categories of data subjects
6.1 The controller's employees enrolled in its health-assessment project.

7. Retention period
7.1 Information referred to in §5.1 is retained while the controller is an active customer of Lifeline Health.
7.2 When the engagement ends the processor will delete or return the data on the controller's instructions, unless Lifeline Health is required by Icelandic medical-record law to retain it for longer.

8. Sub-processors
8.1 The processor uses the following sub-processors to deliver the service:
    a) Medalia ehf. – hosting of the FHIR-compliant medical record (Iceland);
    b) Supabase Inc. – database and authentication (EEA);
    c) Resend Inc. – transactional email (EEA / United States, on the basis of Standard Contractual Clauses);
    d) Vercel Inc. – hosting of the service portal (EEA).
8.2 Changes to sub-processors will be notified with reasonable prior notice.

9. Security measures
9.1 The processor implements appropriate technical and organisational security measures pursuant to Article 32 GDPR, including encryption of kennitala, access control, monitoring of processing activities, and regular security reviews.
9.2 Personnel of the processor involved in the processing are bound by confidentiality.

10. Rights of data subjects
10.1 The processor assists the controller in fulfilling its obligations towards data subjects, including the right of access, rectification and erasure, to the extent reasonably possible.

11. Notification of personal-data breach
11.1 The processor will notify the controller without undue delay, and in any event no later than 48 hours after becoming aware of a breach, in accordance with Article 33 GDPR.

12. Deletion or return of data
12.1 At the end of the service, in accordance with the controller's instructions, the processor will delete or return all personal data it has processed, unless Icelandic law requires retention.

13. Liability
13.1 The parties are each responsible for their respective role under GDPR and Act no. 90/2018.

14. Governing law and venue
14.1 This processing agreement is governed by Icelandic law. Any dispute shall be brought before the District Court of Reykjanes (Héraðsdómur Reykjaness).`;
  }
  return `VINNSLUSAMNINGUR UM PERSÓNUUPPLÝSINGAR
Lifeline Health ehf. – Heilsumat starfsmanna
Útgáfa ${DPA_VERSION}

1. Bakgrunnur og markmið
1.1 Vinnslusamningur þessi er gerður í samræmi við 28. gr. reglugerðar Evrópuþingsins og -ráðsins (ESB) 2016/679 (GDPR) og lög nr. 90/2018 um persónuvernd og vinnslu persónuupplýsinga.
1.2 Samningurinn gildir um alla vinnslu persónuupplýsinga sem Lifeline Health ehf. (hér eftir „vinnsluaðili") framkvæmir fyrir hönd vinnuveitanda (hér eftir „ábyrgðaraðili") í tengslum við heilsumatsþjónustu.

2. Skilgreiningar
2.1 Hugtökin í samningi þessum hafa þá merkingu sem þeim er gefin í GDPR, sbr. 4. gr. reglugerðarinnar.

3. Hlutverk aðila
3.1 Ábyrgðaraðili er vinnuveitandi starfsmannsins og ákveður tilgang og aðferðir við vinnslu þeirra starfsmannagagna sem hann miðlar til vinnsluaðila.
3.2 Vinnsluaðili vinnur persónuupplýsingarnar einungis samkvæmt skjalfestum fyrirmælum ábyrgðaraðila og í samræmi við samning þennan.
3.3 Þegar starfsmaður tekur þátt í heilsumati og veitir beint samþykki sitt verður Lifeline Health sjálfstæður ábyrgðaraðili á heilbrigðisupplýsingum þess einstaklings samkvæmt lögum nr. 34/2012 um heilbrigðisstarfsmenn og lögum nr. 55/2009 um sjúkraskrár. Sú vinnsla fellur utan þessa vinnslusamnings.

4. Eðli og tilgangur vinnslu
4.1 Tilgangur vinnslunnar er að Lifeline Health geti boðið starfsmönnum ábyrgðaraðila þátttöku í heilsumati og haldið utan um bókanir og stöðu hvers starfsmanns í ferlinu.
4.2 Eðli vinnslunnar er söfnun, geymsla, miðlun, eyðing og önnur meðferð persónuupplýsinga samkvæmt samningi þessum.

5. Tegundir persónuupplýsinga
5.1 Eftirfarandi flokkar persónuupplýsinga verða unnir fyrir hönd ábyrgðaraðila:
    a) nafn, kennitala, netfang og símanúmer starfsmanna;
    b) staða starfsmanns í boðunarferli (boð sent, bókun, þátttaka);
    c) tengsl starfsmanns við vinnuveitanda (félagakennimerki).
5.2 Viðkvæmar heilsufarsupplýsingar (sbr. 9. gr. GDPR) eru ekki unnar fyrir hönd ábyrgðaraðila. Slík vinnsla fer fram á ábyrgð Lifeline Health sem sjálfstæðs ábyrgðaraðila með beinu samþykki starfsmanns.

6. Flokkar skráðra einstaklinga
6.1 Starfsmenn ábyrgðaraðila sem skráðir eru í heilsumatsverkefni hans.

7. Geymslutími
7.1 Upplýsingar skv. 5.1 eru geymdar meðan ábyrgðaraðili er virkur viðskiptavinur Lifeline Health.
7.2 Þegar samstarfi lýkur eyðir vinnsluaðili eða afhendir upplýsingarnar skv. fyrirmælum ábyrgðaraðila, nema Lifeline Health beri skylda til að varðveita þær lengur samkvæmt lögum um sjúkraskrár.

8. Undirvinnsluaðilar
8.1 Vinnsluaðili notar eftirtalda undirvinnsluaðila við framkvæmd þjónustunnar:
    a) Medalia ehf. – hýsing sjúkraskrár skv. FHIR staðli (Ísland);
    b) Supabase Inc. – gagnagrunnur og innskráning (EES);
    c) Resend Inc. – útsending tölvupósts (EES/Bandaríki, á grundvelli staðlaðra samningsákvæða);
    d) Vercel Inc. – hýsing þjónustusíðu (EES).
8.2 Breytingar á undirvinnsluaðilum verða tilkynntar með eðlilegum fyrirvara.

9. Öryggisráðstafanir
9.1 Vinnsluaðili innleiðir viðeigandi tæknilegar og skipulagslegar öryggisráðstafanir sbr. 32. gr. GDPR, þ.m.t. dulkóðun kennitalna, aðgangsstjórnun, eftirlit með aðgerðum og reglulega yfirferð á öryggi.
9.2 Starfsmenn vinnsluaðila sem koma að vinnslunni eru bundnir þagnarskyldu.

10. Réttindi skráðra einstaklinga
10.1 Vinnsluaðili aðstoðar ábyrgðaraðila við að uppfylla skyldur sínar gagnvart skráðum einstaklingum, þ.m.t. aðgangsrétt, leiðréttingarrétt og rétt til eyðingar, eftir því sem kostur er.

11. Tilkynning um öryggisbrot
11.1 Vinnsluaðili tilkynnir ábyrgðaraðila án ótilhlýðilegrar tafar, og eigi síðar en 48 klst. eftir að hann verður var við öryggisbrot, sbr. 33. gr. GDPR.

12. Eyðing eða afhending gagna
12.1 Við lok þjónustunnar, samkvæmt fyrirmælum ábyrgðaraðila, skal vinnsluaðili eyða eða afhenda öllum persónuupplýsingum sem hann hefur unnið, nema tilvist laga komi í veg fyrir slíkt.

13. Ábyrgð
13.1 Aðilar bera ábyrgð hvor fyrir sínu hlutverki samkvæmt GDPR og lögum nr. 90/2018.

14. Lögsaga og varnarþing
14.1 Um vinnslusamning þennan gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjaness.`;
}

// ─── Employee Terms of Service (platform use) ──────────────
// Covers an employee's personal use of the Lifeline portal / app —
// distinct from the commercial TOS the contact person accepts.
export function renderEmployeeTermsOfService(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `TERMS OF USE FOR EMPLOYEES
Lifeline Health ehf. – Service portal and mobile app
Version ${EMPLOYEE_TOS_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Parties and scope
1.1 Lifeline Health ehf., reg. no. 590925-1440, Langholtsvegi 111, 104 Reykjavík ("Lifeline Health") operates a service portal and mobile app which lets you participate in the health assessment your employer offers you.
1.2 These terms govern your personal use of the service. They do not replace the commercial terms which your employer has accepted with Lifeline Health.

2. Healthcare licence and Lifeline Health's role
2.1 Lifeline Health provides healthcare services under licence from the Directorate of Health (Embætti landlæknis) and is operated in accordance with Act no. 40/2007 on healthcare services and Act no. 34/2012 on healthcare professionals.
2.2 The healthcare professionals of Lifeline Health, including doctors, all hold the licences required by the Directorate of Health.
2.3 Your medical-record data is stored with Medalia ehf., a recognised medical-record service provider licensed under Act no. 55/2009 on medical records, in accordance with the FHIR standard.

3. Access and proper use
3.1 You must be 18 years or older to use the service.
3.2 You undertake to keep your login credentials secure and to notify Lifeline Health without delay if misuse is suspected.
3.3 You use the service at your own risk and undertake to provide accurate information in questionnaires and measurements.

4. Participation is voluntary
4.1 Participation in the health assessment is entirely voluntary. You may decline, withdraw at any time or stop using the service without consequence to your employment relationship.
4.2 Lifeline Health does not transmit information about your decision to your employer without your consent — see the privacy terms.

5. Access to results
5.1 The results of your health assessment will be available in the Medalia medical-record system. A Lifeline Health doctor interprets the results and advises you.
5.2 Your employer receives no personally identifiable health data about you.

6. Intellectual property
6.1 All content of the service portal and mobile app — software, text, images and design — is the property of Lifeline Health or its partners and protected by copyright and intellectual-property law.

7. Limitation of liability
7.1 Lifeline Health uses reasonable efforts to keep the service in operation but does not warrant that it will always be free from defects or interruptions.
7.2 Recommendations based on the health assessment are general guidance and do not replace emergency treatment or a visit to primary care when needed.

8. Termination of access
8.1 You may at any time request that your account be closed by emailing contact@lifelinehealth.is.
8.2 Lifeline Health may close an account on reasonable notice or without notice if the user breaches these terms.

9. Changes to these terms
9.1 Lifeline Health may update these terms. For material changes you will be asked to accept the new version before continued use is permitted.

10. Governing law and venue
10.1 These terms are governed by Icelandic law. Any dispute shall be brought before the District Court of Reykjanes (Héraðsdómur Reykjaness).`;
  }
  return `NOTKUNARSKILMÁLAR FYRIR STARFSMENN
Lifeline Health ehf. – Þjónustusíða og snjallforrit
Útgáfa ${EMPLOYEE_TOS_VERSION}

1. Aðilar og gildissvið
1.1 Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir „Lifeline Health") rekur þjónustusíðu og snjallforrit sem gerir þér kleift að taka þátt í heilsumati sem vinnuveitandi þinn býður þér.
1.2 Skilmálar þessir gilda um þína persónulegu notkun á þjónustunni. Þeir koma ekki í stað þeirra viðskiptaskilmála sem vinnuveitandi þinn hefur samþykkt við Lifeline Health.

2. Starfsleyfi og hlutverk Lifeline Health
2.1 Lifeline Health veitir heilsufarsþjónustu samkvæmt starfsleyfi frá Embætti landlæknis og er rekin í samræmi við lög nr. 40/2007 um heilbrigðisþjónustu og lög nr. 34/2012 um heilbrigðisstarfsmenn.
2.2 Heilbrigðisstarfsmenn Lifeline Health, þ.m.t. læknar, eru allir með tilskilin starfsleyfi frá landlækni.
2.3 Sjúkraskrárgögn þín eru varðveitt hjá Medalia ehf., viðurkenndum sjúkraskrárþjónustuaðila með leyfi til reksturs sjúkraskrár skv. lögum nr. 55/2009 um sjúkraskrár, í samræmi við FHIR staðal.

3. Aðgangur og sjálfvirk notkun
3.1 Til að nýta þjónustuna þarftu að vera 18 ára eða eldri.
3.2 Þú skuldbindur þig til að halda innskráningargögnum þínum öruggum og tilkynna Lifeline Health tafarlaust ef grunur leikur á misnotkun.
3.3 Þú notar þjónustuna á eigin ábyrgð og skuldbindur þig til að veita réttar upplýsingar í spurningalistum og mælingum.

4. Þátttaka er valfrjáls
4.1 Þátttaka í heilsumati er algjörlega valfrjáls. Þú getur hafnað þátttöku, hætt við hvenær sem er eða hætt að nota þjónustuna án afleiðinga fyrir starfssamband þitt.
4.2 Lifeline Health miðlar ekki upplýsingum um ákvörðun þína til vinnuveitanda án samþykkis þíns, sbr. skilmála um persónuvernd.

5. Aðgangur að niðurstöðum
5.1 Niðurstöður heilsumats þíns verða aðgengilegar í sjúkraskrákerfinu Medalia. Læknir Lifeline Health túlkar niðurstöður og veitir þér ráðgjöf.
5.2 Vinnuveitandi fær engar persónugreinanlegar heilsufarsupplýsingar um þig.

6. Hugverkaréttur
6.1 Allt efni þjónustusíðunnar og snjallforritsins, þ.m.t. hugbúnaður, textar, myndefni og hönnun, er eign Lifeline Health eða samstarfsaðila þess og verndað samkvæmt höfundarréttar- og hugverkalögum.

7. Ábyrgðartakmörkun
7.1 Lifeline Health leggur sig fram við að halda þjónustunni í rekstri en ábyrgist ekki að hún sé ávallt laus við galla eða truflanir.
7.2 Ráðleggingar byggðar á heilsumati eru almennar leiðbeiningar og koma ekki í stað bráðameðferðar eða heimsóknar á heilsugæslu þegar þörf krefur.

8. Uppsögn aðgangs
8.1 Þú getur hvenær sem er óskað eftir því að aðgangur þinn verði lokaður með tölvupósti á contact@lifelinehealth.is.
8.2 Lifeline Health getur lokað aðgangi með eðlilegum fyrirvara eða án fyrirvara ef notandi brýtur skilmálana.

9. Breytingar á skilmálum
9.1 Lifeline Health getur uppfært skilmála þessa. Við verulegar breytingar verður þess farið á leit að þú samþykkir nýja útgáfu áður en áframhaldandi notkun er heimiluð.

10. Lögsaga og varnarþing
10.1 Um skilmála þessa gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjaness.`;
}

// ─── Informed consent for health assessment ────────────────
// Explicit consent under GDPR Art. 9(2)(a) for special-category
// health data AND informed consent under lög nr. 74/1997 um
// réttindi sjúklinga. Separate from the TOS so the two can be
// audited + presented independently.
export function renderHealthAssessmentConsent(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `INFORMED CONSENT FOR HEALTH ASSESSMENT
Lifeline Health ehf. – Health-assessment service
Version ${HEALTH_CONSENT_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. About this consent
1.1 By ticking this consent you confirm that you have read and understood the information below and give your informed consent to the processing of your health data in connection with the health assessment provided by Lifeline Health ehf., reg. no. 590925-1440 ("Lifeline Health").
1.2 This consent is given pursuant to Article 9 of Regulation (EU) 2016/679 (GDPR), Article 11 of Act no. 90/2018 on processing of special-category personal data, and Act no. 74/1997 on patients' rights.

2. Who performs the health assessment?
2.1 Lifeline Health performs the health assessment under licence from the Directorate of Health (Embætti landlæknis) and in accordance with Act no. 40/2007 on healthcare services.
2.2 The doctors and other healthcare professionals of Lifeline Health hold the licences required by the Directorate of Health (Act no. 34/2012 on healthcare professionals) and are bound by the duty of confidentiality under Article 17 of that Act.

3. Who stores your medical-record data?
3.1 Your medical-record data is recorded and stored in the Medalia medical-record system operated by Medalia ehf., a recognised medical-record provider licensed under Act no. 55/2009 on medical records.
3.2 The data is stored to the FHIR standard and meets the requirements of data-protection and medical-record law concerning security and access control.
3.3 Lifeline Health and Medalia are joint controllers for the processing, each in their respective role, under Article 26 GDPR.

4. What data will be processed?
4.1 Your responses to questionnaires on lifestyle, health, family history and previous illness.
4.2 Physical measurements: height, weight, blood pressure, body composition (measured with the Biody device).
4.3 Blood-test results from Sameind or an equivalent recognised laboratory.
4.4 The doctor's clinical findings and risk assessment, e.g. on the basis of the SCORE2 algorithm.
4.5 Your communications with the healthcare professionals of Lifeline Health through the service portal.

5. For what purpose?
5.1 To perform a clinical health assessment and risk assessment for you.
5.2 To provide you with personalised recommendations and a health-promotion plan.
5.3 To maintain your medical record so as to ensure continuity of care.
5.4 To follow up on the results with you through the service portal.

6. Legal bases
6.1 For the actual processing of health data in the medical record: Article 13(1) of Act no. 55/2009 on medical records and Article 9(2)(h) GDPR (necessary for the provision of healthcare).
6.2 For other processing (e.g. communications via the service portal): Article 9(2)(a) GDPR (your explicit consent, given here).

7. Who has access to the data?
7.1 The healthcare professionals of Lifeline Health involved in your health assessment.
7.2 You yourself — you have access to your own data through the Lifeline Health service portal and Medalia's patient view.
7.3 Your employer does NOT receive personally identifiable health data about you. They receive only attendance confirmation or non-identifiable aggregate data.
7.4 Third parties have no access except with your specific consent or as required by law.

8. Retention period
8.1 Medical-record data is retained in accordance with Act no. 55/2009 on medical records, which prescribes a minimum retention period for medical records.
8.2 Other personal data is retained while you remain an active user of the service and deleted within a reasonable time after you stop using the service, unless statutory obligations require otherwise.

9. Your rights
9.1 You have the right to:
    a) access information about yourself;
    b) have inaccurate information corrected;
    c) have information erased where this is permitted by law;
    d) restrict processing or object to it;
    e) port your data to another provider;
    f) withdraw your consent at any time without effect on your employment relationship.
9.2 You also have the right to lodge a complaint with the Icelandic Data Protection Authority (personuvernd.is) if you believe your personal data has been handled improperly.

10. Withdrawing consent
10.1 You may withdraw your consent at any time by emailing contact@lifelinehealth.is.
10.2 Withdrawal does not affect the lawfulness of processing carried out on the basis of consent before withdrawal, nor processing based on other legal grounds (e.g. Act no. 55/2009 on medical records).

11. Risks and limitations of the service
11.1 The Lifeline Health assessment is a screening and risk assessment and does not replace medical diagnosis or treatment by primary care or a specialist.
11.2 The results reflect your health at the time of the examination and may change.
11.3 If you receive results that cause you concern, seek further assistance from primary care or a specialist.

12. Consent
12.1 By ticking the consent box you confirm that:
    a) you have received sufficient information about the purpose and nature of the processing;
    b) you give informed and direct consent to the processing of your health data;
    c) you understand that you may withdraw your consent at any time;
    d) you are 18 years or older.`;
  }
  return `UPPLÝST SAMÞYKKI FYRIR HEILSUMAT
Lifeline Health ehf. – Heilsumatsþjónusta
Útgáfa ${HEALTH_CONSENT_VERSION}

1. Um samþykkið
1.1 Með því að merkja við þetta samþykki staðfestir þú að þú hafir lesið og skilið upplýsingarnar hér að neðan og veitir upplýst samþykki fyrir vinnslu heilsufarsupplýsinga þinna í tengslum við heilsumat á vegum Lifeline Health ehf., kt. 590925-1440 (hér eftir „Lifeline Health").
1.2 Samþykki þetta er veitt samkvæmt 9. gr. reglugerðar (ESB) 2016/679 (GDPR) og 11. gr. laga nr. 90/2018 um vinnslu viðkvæmra persónuupplýsinga, auk laga nr. 74/1997 um réttindi sjúklinga.

2. Hver framkvæmir heilsumatið?
2.1 Lifeline Health framkvæmir heilsumatið samkvæmt starfsleyfi frá Embætti landlæknis og í samræmi við lög nr. 40/2007 um heilbrigðisþjónustu.
2.2 Læknar og annað heilbrigðisstarfsfólk Lifeline Health hafa tilskilin starfsleyfi frá landlækni, sbr. lög nr. 34/2012 um heilbrigðisstarfsmenn, og eru bundin þagnarskyldu skv. 17. gr. þeirra laga.

3. Hver varðveitir sjúkraskrárgögnin?
3.1 Sjúkraskrárgögn þín eru skráð og varðveitt í sjúkraskrárkerfinu Medalia sem rekið er af Medalia ehf., viðurkenndum sjúkraskrárþjónustuaðila með leyfi til reksturs sjúkraskrár skv. lögum nr. 55/2009 um sjúkraskrár.
3.2 Gögnin eru varðveitt í samræmi við FHIR staðal og uppfylla kröfur persónuverndarlaga og sjúkraskrárlaga varðandi öryggi og aðgangsstýringu.
3.3 Lifeline Health og Medalia bera sameiginlega ábyrgð á vinnslu gagna þinna, hvor um sitt hlutverk skv. 26. gr. GDPR.

4. Hvaða upplýsingar verða unnar?
4.1 Svör þín við spurningalistum um lífsstíl, heilsufar, fjölskyldusögu og fyrri veikindi.
4.2 Líkamlegar mælingar: hæð, þyngd, blóðþrýstingur, líkamssamsetning (mæld með Biody tæki).
4.3 Blóðprufuniðurstöður frá Sameind eða sambærilegri viðurkenndri rannsóknarstofu.
4.4 Klínísk niðurstaða og áhættumat læknis, t.d. á grundvelli SCORE2 reiknirits.
4.5 Samskipti þín við heilbrigðisstarfsfólk Lifeline Health í gegnum þjónustusíðuna.

5. Í hvaða tilgangi?
5.1 Að framkvæma klínískt heilsumat og áhættumat á þér.
5.2 Að veita þér einstaklingsbundnar ráðleggingar og heilsueflingaráætlun.
5.3 Að halda utan um sjúkraskrá þína til að tryggja samfellu í þjónustu.
5.4 Að fylgja eftir niðurstöðum með þér í gegnum þjónustusíðuna.

6. Lagaheimildir
6.1 Fyrir sjálfa vinnslu heilbrigðisupplýsinga í sjúkraskrá: 1. mgr. 13. gr. laga nr. 55/2009 um sjúkraskrár og h-liður 2. mgr. 9. gr. GDPR (nauðsynlegt vegna heilbrigðisþjónustu).
6.2 Fyrir aðra vinnslu (t.d. samskipti í gegnum þjónustusíðuna): a-liður 1. mgr. 9. gr. GDPR (sérstakt samþykki þitt, sem þú veitir hér).

7. Hver fær aðgang að gögnunum?
7.1 Heilbrigðisstarfsfólk Lifeline Health sem kemur að heilsumati þínu.
7.2 Þú sjálf(ur) — þú hefur aðgang að eigin gögnum í gegnum þjónustusíðu Lifeline Health og í sjúklingaeftirlit Medalia.
7.3 Vinnuveitandi þinn fær EKKI persónugreinanlegar heilsufarsupplýsingar um þig. Hann fær aðeins staðfestingu á mætingu eða ópersónugreinanlegar samanteknar upplýsingar.
7.4 Þriðji aðili fær ekki aðgang nema að þínu sérstaka samþykki eða samkvæmt lagaskyldu.

8. Geymslutími
8.1 Sjúkraskrárgögn eru varðveitt samkvæmt lögum nr. 55/2009 um sjúkraskrár, sem kveða á um lágmarksvarðveislutíma sjúkraskráa.
8.2 Aðrar persónuupplýsingar eru varðveittar svo lengi sem þú ert virkur notandi þjónustunnar og eyddar innan hæfilegs tíma eftir að þú hættir notkun, nema lagaskylda kveði á um annað.

9. Réttindi þín
9.1 Þú hefur rétt á að:
    a) fá aðgang að upplýsingum um sjálfa(n) þig;
    b) fá upplýsingar leiðréttar ef þær eru rangar;
    c) fá upplýsingum eytt þar sem því verður við komið samkvæmt lögum;
    d) takmarka vinnslu eða andmæla henni;
    e) flytja gögn þín til annars þjónustuveitanda;
    f) draga samþykki þitt til baka hvenær sem er án áhrifa á starfssamband þitt.
9.2 Þú hefur jafnframt rétt á að leggja fram kvörtun hjá Persónuvernd (personuvernd.is) ef þú telur að farið hafi verið með persónuupplýsingar þínar á óviðeigandi hátt.

10. Afturköllun samþykkis
10.1 Þú getur dregið samþykki þitt til baka hvenær sem er með tölvupósti á contact@lifelinehealth.is.
10.2 Afturköllun hefur ekki áhrif á lögmæti vinnslu sem fram fer á grundvelli samþykkis fyrir afturköllun, né á þá vinnslu sem byggir á öðrum lagaheimildum (t.d. lögum nr. 55/2009 um sjúkraskrár).

11. Áhætta og takmarkanir þjónustunnar
11.1 Heilsumat Lifeline Health er skimun og áhættumat og kemur ekki í stað læknisfræðilegrar greiningar eða meðferðar hjá heilsugæslu eða sérfræðilækni.
11.2 Niðurstöður endurspegla heilsufar þitt á þeim tíma sem skoðun fer fram og geta breyst.
11.3 Ef þú færð niðurstöður sem vekja áhyggjur skaltu leita frekari aðstoðar hjá heilsugæslu eða sérfræðilækni.

12. Samþykki
12.1 Með því að merkja við samþykkiskassann staðfestir þú að:
    a) þú hafir fengið fullnægjandi upplýsingar um tilgang og eðli vinnslunnar;
    b) þú veitir upplýst og beint samþykki fyrir vinnslu heilsufarsupplýsinga þinna;
    c) þú skiljir að þú getir dregið samþykkið til baka hvenær sem er;
    d) þú sért 18 ára eða eldri.`;
}
