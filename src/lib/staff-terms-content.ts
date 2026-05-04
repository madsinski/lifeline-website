// Staff-level legal documents accepted by every team member at onboarding.
// Same hash-and-version pattern as platform-terms-content: the exact
// string returned by the render functions is sha256-hashed and stored
// in staff_agreement_acceptances.text_hash. Any change — even
// whitespace — MUST bump the version so existing staff get re-prompted.
//
// LANGUAGE: Icelandic is the SOURCE language and the only legally
// binding text for click-through acceptance — hashes are always
// computed against the IS version. English translations are courtesy
// translations for non-Icelandic-speaking staff and for the lawyer's
// bilingual review. Acceptance flows must always pass language="is".

export type DocumentLanguage = "is" | "en";

export type StaffRoleLabel = "admin" | "coach" | "doctor" | "nurse" | "psychologist" | "lawyer";

// The employment form the staff member is on. Drives which contract
// doc they sign at onboarding:
//   - salaried    → no click-through contract (admin uploads a bespoke
//                   ráðningarsamningur PDF via the documents vault
//                   because salary figures are individual).
//   - piece_rate  → Lausráðningarsamningur click-through, 2000 ISK per
//                   measurement, Lifeline is the employer of record,
//                   full launþegi rights (orlof, pension, veikindi…).
//                   Lifeline must be on launagreiðandaskrá.
//   - contractor  → Verktakasamningur click-through for genuinely
//                   independent contractors (IT consultant etc.). Not
//                   used for clinicians by default.
export type EmploymentType = "salaried" | "piece_rate" | "contractor";

// Sensible default when an admin creates a staff record without
// explicitly picking one.
export function defaultEmploymentType(role: StaffRoleLabel): EmploymentType {
  if (role === "admin" || role === "coach") return "salaried";
  if (role === "lawyer") return "contractor";
  return "piece_rate";
}

// ─── Keys / versions ─────────────────────────────────────────
export const STAFF_NDA_KEY = "staff-nda";
export const STAFF_NDA_VERSION = "v1.1";

export const STAFF_CONFIDENTIALITY_KEY = "staff-confidentiality";
export const STAFF_CONFIDENTIALITY_VERSION = "v1.0";

export const STAFF_ACCEPTABLE_USE_KEY = "staff-acceptable-use";
export const STAFF_ACCEPTABLE_USE_VERSION = "v1.0";

export const STAFF_DATA_PROTECTION_KEY = "staff-data-protection";
export const STAFF_DATA_PROTECTION_VERSION = "v1.0";

// Operational onboarding checklist — covers the day-to-day boundary
// between Lifeline's wellness surface (this app) and the sjúkraskrá
// (Medalia), incident reporting, approved tools, and offboarding. The
// staff member ticks through every item; the signed PDF lives in their
// document vault for their own later review and admin audit.
// Bump version whenever the operational rules change.
export const STAFF_ONBOARDING_CHECKLIST_KEY = "staff-onboarding-checklist";
export const STAFF_ONBOARDING_CHECKLIST_VERSION = "v1.0";

// Lausráðningarsamningur — on-call employment contract for clinicians
// on piece-rate pay. Lifeline withholds tax, pays tryggingagjald +
// pension mótframlag, accrues orlof. Correct instrument when the
// clinician works under Lifeline's healthcare license, uses Lifeline's
// equipment/protocols, and measurements feed the Lifeline sjúkraskrá.
export const STAFF_PIECE_RATE_EMPLOYMENT_KEY = "staff-piece-rate-employment";
export const STAFF_PIECE_RATE_EMPLOYMENT_VERSION = "v1.1";
// Compensation constants — baked into the v1.0 text. Change → bump version.
export const STAFF_PIECE_RATE_ISK_PER_MEASUREMENT = 2000;
export const STAFF_PIECE_RATE_PAYMENT_DUE_DAY = 5; // 5th of next month

// Verktakasamningur — kept for truly independent contractors only
// (non-clinical freelancers, consultants, etc.). NOT required for
// clinicians by default — they should be on the piece_rate employment
// contract because they work under Lifeline's healthcare license.
export const STAFF_CONTRACTOR_KEY = "staff-contractor-agreement";
export const STAFF_CONTRACTOR_VERSION = "v1.1";
export const STAFF_CONTRACTOR_ISK_PER_MEASUREMENT = 2000;
export const STAFF_CONTRACTOR_PAYMENT_DAYS = 28;

// ─── Required-by-role matrix ────────────────────────────────
// Every active staff member signs NDA + acceptable-use + data-protection.
// Clinicians (doctor, nurse, psychologist) additionally sign the
// healthcare-confidentiality declaration under lög nr. 34/2012.
// Admin + coach don't handle patient clinical data directly so we
// don't ask them to make that clinical attestation — they're still
// covered by the broader NDA.
export type StaffAgreementKey =
  | typeof STAFF_NDA_KEY
  | typeof STAFF_CONFIDENTIALITY_KEY
  | typeof STAFF_ACCEPTABLE_USE_KEY
  | typeof STAFF_DATA_PROTECTION_KEY
  | typeof STAFF_ONBOARDING_CHECKLIST_KEY
  | typeof STAFF_PIECE_RATE_EMPLOYMENT_KEY
  | typeof STAFF_CONTRACTOR_KEY;

// Required click-through docs derived from (role, employment_type):
//   • All staff: NDA + tækjareglur + persónuverndarfræðsla.
//   • Clinicians (doctor/nurse/psychologist): + þagnarskylda.
//   • piece_rate: + Lausráðningarsamningur (click-through).
//   • contractor: + Verktakasamningur (click-through).
//   • salaried:   no additional click-through — the admin uploads a
//                 bespoke ráðningarsamningur PDF to the staff's
//                 documents vault because salary figures are per-person.
//   • lawyer (external counsel): NDA + persónuverndarfræðsla only.
//                 Skips operational checklist + acceptable-use (those
//                 are written for staff who handle client data day-to-day);
//                 the lawyer reviews documents, doesn't access clinical
//                 systems.
//
// Backwards-compat: if employment_type is null/undefined the function
// uses defaultEmploymentType(role).
export function requiredAgreementsForStaff(
  role: StaffRoleLabel,
  employmentType: EmploymentType | null | undefined,
): Array<{ key: StaffAgreementKey; version: string; title: string }> {
  // Lawyer = external counsel. They are the ones REVIEWING and signing
  // off on the NDA / Persónuverndarfræðsla as legal documents — they
  // don't separately accept them as staff click-throughs. Confidentiality
  // and data-protection obligations for external counsel are covered by
  // the engagement letter signed with the law firm itself, not by the
  // in-app onboarding gate. So: zero required agreements at the
  // app-level.
  if (role === "lawyer") {
    return [];
  }

  const emp = employmentType || defaultEmploymentType(role);
  const base: Array<{ key: StaffAgreementKey; version: string; title: string }> = [
    { key: STAFF_NDA_KEY, version: STAFF_NDA_VERSION, title: "Trúnaðarsamningur (NDA)" },
    { key: STAFF_ACCEPTABLE_USE_KEY, version: STAFF_ACCEPTABLE_USE_VERSION, title: "Tækjareglur og aðgangsstjórnun" },
    { key: STAFF_DATA_PROTECTION_KEY, version: STAFF_DATA_PROTECTION_VERSION, title: "Persónuverndarfræðsla" },
    { key: STAFF_ONBOARDING_CHECKLIST_KEY, version: STAFF_ONBOARDING_CHECKLIST_VERSION, title: "Móttökugátlisti og verklagsreglur" },
  ];
  if (role === "doctor" || role === "nurse" || role === "psychologist") {
    base.push({ key: STAFF_CONFIDENTIALITY_KEY, version: STAFF_CONFIDENTIALITY_VERSION, title: "Yfirlýsing um þagnarskyldu (heilbrigðisstarfsmaður)" });
  }
  if (emp === "piece_rate") {
    base.push({ key: STAFF_PIECE_RATE_EMPLOYMENT_KEY, version: STAFF_PIECE_RATE_EMPLOYMENT_VERSION, title: "Lausráðningarsamningur (afkastahvetjandi launakerfi)" });
  } else if (emp === "contractor") {
    base.push({ key: STAFF_CONTRACTOR_KEY, version: STAFF_CONTRACTOR_VERSION, title: "Verktakasamningur (sjálfstæður verktaki)" });
  }
  // salaried: no click-through contract — admin uploads a bespoke PDF.
  return base;
}

// Deprecated alias — old callers will still compile but should migrate.
export function requiredAgreementsForRole(role: StaffRoleLabel): Array<{ key: StaffAgreementKey; version: string; title: string }> {
  return requiredAgreementsForStaff(role, null);
}

// ─── NDA (all staff) ─────────────────────────────────────────
export function renderStaffNDA(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `STAFF NON-DISCLOSURE AGREEMENT
Lifeline Health ehf. – Confidentiality undertaking
Version ${STAFF_NDA_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Parties and scope
1.1 Lifeline Health ehf., reg. no. 590925-1440, Langholtsvegi 111, 104 Reykjavík ("Lifeline Health") and the undersigned employee enter into this agreement on the handling of confidential information.
1.2 The agreement covers all confidential information which the employee gains access to in their role, whether oral, written, electronic or otherwise observable.

2. What is confidential information
2.1 Confidential information for the purposes of this agreement is all non-public information relating to:
    a) client health data, including name, kennitala, medical history and measurements;
    b) operating plans, financial information, business relationships and contracts;
    c) technical information, including software, system design, algorithms and documentation;
    d) product roadmaps, project plans and unpublished marketing material;
    e) staff information, including pay terms and contracts.

3. Obligations of the employee
3.1 The employee undertakes to:
    a) keep confidential information secret and use it solely in connection with their role at Lifeline Health;
    b) not disclose confidential information to any third party without Lifeline Health's prior written consent;
    c) protect confidential information against unauthorised access, theft and unlawful disclosure;
    d) return all confidential information, copies and IT equipment to Lifeline Health on termination.

4. Exceptions
4.1 The confidentiality obligation does not apply to information which:
    a) is or becomes public without the employee's involvement;
    b) the employee can demonstrably prove they already had before this agreement;
    c) the employee lawfully obtains from a third party not bound by confidentiality;
    d) must be disclosed to public authorities or courts under statutory obligation — in which case the employee must inform Lifeline Health without delay unless legally prohibited.

5. Duration
5.1 The obligations under this agreement apply during employment and for three (3) years after termination, unless statute provides otherwise — the duty of confidentiality regarding health data is however lifelong, in accordance with Act no. 34/2012 on healthcare professionals and the separate declaration thereon.

6. Breach and damages
6.1 Breach of this agreement may give rise to summary dismissal, liability in damages towards Lifeline Health and criminal liability under law, including Article 136 of the General Penal Code (Act no. 19/1940) and Act no. 75/2019 on the protection of trade secrets.

7. Governing law and venue
7.1 This agreement is governed by Icelandic law. Any dispute shall be brought before the District Court of Reykjanes (Héraðsdómur Reykjaness).`;
  }
  return `TRÚNAÐARSAMNINGUR STARFSMANNS
Lifeline Health ehf. – Samningur um trúnað og þagmælsku
Útgáfa ${STAFF_NDA_VERSION}

1. Aðilar og gildissvið
1.1 Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir „Lifeline Health") og undirritaður starfsmaður gera með sér samning þennan um meðferð trúnaðarupplýsinga.
1.2 Samningurinn gildir um allar trúnaðarupplýsingar sem starfsmaður fær aðgang að í starfi sínu, hvort sem þær eru munnlegar, skriflegar, rafrænar eða sýnilegar á annan hátt.

2. Hvað telst trúnaðarupplýsingar
2.1 Trúnaðarupplýsingar í skilningi samnings þessa eru allar upplýsingar sem ekki eru opinberar og varða:
    a) heilbrigðisupplýsingar skjólstæðinga, þar með talið nafn, kennitala, sjúkrasögu og mælingar;
    b) rekstraráætlanir, fjárhagsupplýsingar, viðskiptasambönd og samningagerð;
    c) tæknilegar upplýsingar, þ.m.t. hugbúnað, kerfishönnun, reiknirit og skjöl;
    d) vöruáform, verkefnaáætlanir og markaðsefni sem ekki hefur verið gefið út;
    e) starfsmannaupplýsingar, þ.m.t. launakjör og samninga.

3. Skyldur starfsmanns
3.1 Starfsmaður skuldbindur sig til að:
    a) halda trúnaðarupplýsingum leyndum og nota þær eingöngu í þágu starfs síns hjá Lifeline Health;
    b) miðla trúnaðarupplýsingum ekki til þriðja aðila án skriflegrar heimildar Lifeline Health;
    c) verja trúnaðarupplýsingar gegn óheimilum aðgangi, þjófnaði og óleyfilegri birtingu;
    d) skila öllum trúnaðarupplýsingum, afritum og tölvutengdum búnaði til Lifeline Health við starfslok.

4. Undantekningar
4.1 Skyldur um trúnað gilda ekki um upplýsingar sem:
    a) eru eða verða opinberar án tilstillis starfsmanns;
    b) starfsmaður sannarlega hafði þegar áður en samningurinn var gerður;
    c) berast starfsmanni löglega frá þriðja aðila sem ekki er bundinn trúnaði;
    d) þarf að veita stjórnvöldum eða dómstólum samkvæmt lagaskyldu — í slíkum tilvikum ber starfsmanni að upplýsa Lifeline Health tafarlaust nema slíkt sé bannað samkvæmt lögum.

5. Tímalengd
5.1 Skyldur samkvæmt samningi þessum gilda meðan á starfi stendur og í þrjú (3) ár eftir starfslok, nema annað leiði af lagaskyldu — þagnarskylda vegna heilbrigðisupplýsinga er þó ævilöng, sbr. lög nr. 34/2012 um heilbrigðisstarfsmenn og sérstaka yfirlýsingu þar um.

6. Brot og skaðabætur
6.1 Brot á samningi þessum getur varðað uppsögn starfs án uppsagnarfrests, skaðabótaskyldu gagnvart Lifeline Health og refsiábyrgð samkvæmt lögum, sbr. 136. gr. almennra hegningarlaga nr. 19/1940 og lög nr. 75/2019 um vernd atvinnuleyndarmála.

7. Lögsaga og varnarþing
7.1 Um samning þennan gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjaness.`;
}

// ─── Healthcare confidentiality (doctor / nurse / psychologist) ───
// The statutory þagnarskylda required by lög nr. 34/2012 um
// heilbrigðisstarfsmenn + lög nr. 74/1997 um sjúklingaréttindi.
// Lifelong and non-waivable — treated as a separate doc from the NDA
// so the clinical obligation is recorded explicitly.
export function renderStaffConfidentiality(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `HEALTHCARE PROFESSIONAL CONFIDENTIALITY DECLARATION
Lifeline Health ehf. – Pursuant to Act no. 34/2012 and Act no. 74/1997
Version ${STAFF_CONFIDENTIALITY_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

The undersigned healthcare professional, working for Lifeline Health ehf. (reg. no. 590925-1440), hereby declares:

1. Statutory duty of confidentiality
1.1 I am aware of my duty of confidentiality under Article 17 of Act no. 34/2012 on healthcare professionals and Articles 12–14 of Act no. 74/1997 on patients' rights, which covers everything I may learn in my role about a patient's health, treatment, personal circumstances, social relationships and other matters.
1.2 The confidentiality obligation also applies to information I may derive from registered medical-record data, examination results, physical measurements and health-assessment reports.

2. Scope
2.1 I undertake not to disclose any information covered by the confidentiality obligation to any third party — orally, in writing or electronically — except where:
    a) the patient has given written and informed consent;
    b) it is necessary for the patient's treatment within the Lifeline Health team and other parties providing or participating in that treatment, in accordance with Article 17(5) of Act no. 34/2012;
    c) required by law or court order.

3. Cases of doubt
3.1 If there is any doubt about whether disclosure is permissible, I shall seek guidance from Lifeline Health's chief physician, the Data Protection Officer or the managing director before any information is provided.

4. Access to medical records
4.1 I am aware that all access and processing in the medical-record system (Medalia, under Act no. 55/2009 on medical records) is logged and traceable, and that unauthorised use or browsing of medical records may give rise to both termination of employment and possible criminal liability.

5. Lifelong confidentiality
5.1 The duty of confidentiality is lifelong and does not end on termination of my employment with Lifeline Health.

6. Consequences of breach
6.1 Breach of the confidentiality obligation may give rise to:
    a) summary dismissal;
    b) notification to the Directorate of Health under Article 12 of Act no. 41/2007 on the Directorate of Health and Public Health;
    c) fines or imprisonment up to one year under Article 136 of the General Penal Code (Act no. 19/1940);
    d) liability in damages to the patient and Lifeline Health.

7. Confirmation
7.1 By electronic signature I confirm that I have read, understood and accepted this declaration and that it forms part of the terms of my engagement with Lifeline Health.`;
  }
  return `YFIRLÝSING UM ÞAGNARSKYLDU HEILBRIGÐISSTARFSMANNS
Lifeline Health ehf. – Skv. lögum nr. 34/2012 og lögum nr. 74/1997
Útgáfa ${STAFF_CONFIDENTIALITY_VERSION}

Undirritaður heilbrigðisstarfsmaður, sem starfar fyrir Lifeline Health ehf. (kt. 590925-1440), lýsir því hér með yfir:

1. Lögbundin þagnarskylda
1.1 Ég er meðvitaður/-uð um þagnarskyldu mína samkvæmt 17. gr. laga nr. 34/2012 um heilbrigðisstarfsmenn og 12.–14. gr. laga nr. 74/1997 um réttindi sjúklinga, sem tekur til alls sem ég kann að fá vitneskju um í starfi mínu um heilsufar sjúklings, meðferð, einkahagi, félagsleg tengsl og atvik önnur.
1.2 Þagnarskyldan gildir einnig um upplýsingar sem ég kann að vinna úr skráðum sjúkraskrárgögnum, niðurstöðum rannsókna, líkamsmælingum og heilsumatskýrslum.

2. Umfang
2.1 Ég heiti því að miðla engum upplýsingum sem falla undir þagnarskylduna til þriðja aðila, hvorki munnlega, skriflega né rafrænt, nema:
    a) sjúklingur hafi veitt skriflegt og upplýst samþykki;
    b) slíkt sé nauðsynlegt vegna meðferðar sjúklings innan teymis Lifeline Health og þeirra aðila sem veita eða taka þátt í meðferðinni, sbr. 5. mgr. 17. gr. laga nr. 34/2012;
    c) það sé skylt samkvæmt lögum eða dómsúrskurði.

3. Vafaatriði
3.1 Komi upp vafi um hvort heimilt sé að miðla upplýsingum ber mér að leita leiðbeininga hjá yfirlækni Lifeline Health, persónuverndarfulltrúa eða framkvæmdastjóra áður en upplýsingar eru veittar.

4. Aðgangur að sjúkraskrá
4.1 Ég er meðvituð/-aður um að öll flett og vinnsla í sjúkraskrárkerfinu (Medalia, skv. lögum nr. 55/2009 um sjúkraskrár) er skráð og rekjanleg, og að óheimil notkun eða flett á sjúkraskrá varðar bæði starfslokum og mögulegri refsiábyrgð.

5. Ævilöng þagnarskylda
5.1 Þagnarskyldan er ævilöng og fellur ekki niður við starfslok mín hjá Lifeline Health.

6. Afleiðingar brots
6.1 Brot gegn þagnarskyldunni getur varðað:
    a) uppsögn starfs án fyrirvara;
    b) tilkynningu til Embættis landlæknis skv. 12. gr. laga nr. 41/2007 um landlækni og lýðheilsu;
    c) sektum eða fangelsi allt að eitt ár skv. 136. gr. almennra hegningarlaga nr. 19/1940;
    d) skaðabótaskyldu gagnvart sjúklingi og Lifeline Health.

7. Staðfesting
7.1 Með rafrænni undirritun staðfesti ég að hafa lesið, skilið og samþykkt yfirlýsingu þessa og að hún er hluti af starfsskilmálum mínum hjá Lifeline Health.`;
}

// ─── Acceptable use / device policy ──────────────────────────
export function renderStaffAcceptableUse(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `DEVICE POLICY AND ACCESS MANAGEMENT
Lifeline Health ehf. – Information-security and system-use policy
Version ${STAFF_ACCEPTABLE_USE_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Scope
1.1 This policy applies to all use by the employee of Lifeline Health's systems, software and devices, whether issued by the company (managed device) or being the employee's personal device used for work (BYOD).

2. Access and passwords
2.1 The employee is personally responsible for their login credentials and may not share them with others.
2.2 Passwords must be at least 12 characters, unique (not reused from other services) and stored in a password manager.
2.3 The employee shall use two-factor authentication (2FA) wherever offered.

3. Devices that store or access health data
3.1 A device used to handle health data must:
    a) have a screen lock with password, fingerprint or face ID;
    b) have encrypted storage (FileVault, BitLocker, iOS/Android default);
    c) keep the operating system and security updates current;
    d) be free from known malware risks (informally: no pirated software, no untrusted browser extensions without approval).

4. Sensitive data
4.1 Health data and personally identifiable information must only be stored in approved systems (Medalia medical record, Lifeline admin, approved cloud services).
4.2 Health data must not be stored on local drives, in personal email accounts or in unapproved cloud services (e.g. personal Google Drive, Dropbox, iCloud).
4.3 Printing shall only occur when necessary and printed material must be destroyed securely (shredder) when no longer needed.

5. Email and communications
5.1 Personally identifiable health data must not be sent in plain email. Approved encrypted communication systems shall be used (Medalia documents, Signal where approved).
5.2 Customers and partners must not be invited to the employee's personal accounts.

6. Incident reporting
6.1 The employee shall notify their manager and the Data Protection Officer (pv@lifelinehealth.is) without delay in the case of:
    a) loss or theft of a device storing health data;
    b) suspected access breach;
    c) accidental disclosure of personal data (e.g. sending to the wrong recipient);
    d) suspected malware or cyberattack.

7. Use outside work
7.1 Lifeline Health equipment and accounts shall be used only for work. Personal use is permitted in moderation provided it does not breach this policy.

8. Monitoring
8.1 All activity in Lifeline Health systems is logged and Lifeline Health reserves the right to trace access if a breach is suspected. Breach of this policy may give rise to a warning, dismissal or criminal liability as applicable.

9. Confirmation
9.1 By electronic signature I confirm that I have read, understood and accepted this policy.`;
  }
  return `TÆKJAREGLUR OG AÐGANGSSTJÓRNUN
Lifeline Health ehf. – Reglur um upplýsingaöryggi og notkun kerfa
Útgáfa ${STAFF_ACCEPTABLE_USE_VERSION}

1. Gildissvið
1.1 Reglur þessar gilda um alla notkun starfsmanns á kerfum, hugbúnaði og tækjum Lifeline Health, hvort sem þau eru útgefin af félaginu (managed device) eða eru persónuleg tæki starfsmanns sem notuð eru til vinnu (BYOD).

2. Aðgangur og lykilorð
2.1 Starfsmaður ber persónulega ábyrgð á innskráningargögnum sínum og má ekki deila þeim með öðrum.
2.2 Lykilorð skulu vera a.m.k. 12 stafir, einstök (ekki endurnýtt frá öðrum þjónustum) og varðveitt í lykilorðageymi.
2.3 Starfsmaður skal nota tvíþátta auðkenningu (2FA) þegar hún er boðin.

3. Tæki sem geyma eða sækja heilsufarsgögn
3.1 Tæki sem notað er til að vinna með heilsufarsgögn skal:
    a) hafa skjálæsingu með lykilorði, fingrafari eða andlitsauðkenni;
    b) vera með dulkóðaða geymslu (FileVault, BitLocker, iOS/Android default);
    c) halda stýrikerfi og öryggisuppfærslum uppfærðum;
    d) vera laust við þekktan spilliforritahættu (óformlega: engar sjóræningjaútgáfur af hugbúnaði, engar útgerðar vafraviðbætur án samþykkis).

4. Viðkvæm gögn
4.1 Heilsufarsgögn og persónugreinanlegar upplýsingar skal eingöngu geyma í samþykktum kerfum (Medalia sjúkraskrá, Lifeline admin, samþykkt skýþjónusta).
4.2 Heilsufarsgögn skulu ekki vistast á staðbundnum drifum, í einkareikningum fyrir tölvupóst eða í ósamþykktum skýjaþjónustum (t.d. persónulegum Google Drive, Dropbox, iCloud).
4.3 Útprentun skal aðeins fara fram þegar nauðsynlegt er og útprentuðum gögnum skal eyða örugglega (tætari) þegar þeirra er ekki lengur þörf.

5. Tölvupóstur og samskipti
5.1 Persónugreinanlegar heilsufarsupplýsingar skulu ekki sendar í opnum tölvupósti. Nota skal samþykkt dulkóðuð samskiptakerfi (Medalia skjöl, Signal þegar það er samþykkt).
5.2 Viðskiptavinir og samstarfsaðilar skulu ekki boðaðir á persónulega reikninga starfsmanns.

6. Tilkynning um atvik
6.1 Starfsmaður skal tilkynna tafarlaust til yfirmanns og persónuverndarfulltrúa (pv@lifelinehealth.is):
    a) tap eða þjófnað á tæki sem geymir heilsufarsgögn;
    b) grun um aðgangsbrot;
    c) óviljandi miðlun á persónuupplýsingum (t.d. sending á rangan viðtakanda);
    d) grun um spilliforrit eða netárás.

7. Notkun utan starfs
7.1 Búnaður og aðgangar Lifeline Health skulu eingöngu notaðir í þágu starfs. Persónuleg notkun er heimil í hóflegu mæli svo fremi sem hún brjóti ekki gegn reglum þessum.

8. Eftirfylgni
8.1 Öll starfsemi í kerfum Lifeline Health er skráð og Lifeline Health áskilur sér rétt til að rekja aðgang ef grunur leikur á broti. Brot á reglum þessum getur varðað viðvörun, uppsögn eða refsiábyrgð eftir atvikum.

9. Staðfesting
9.1 Með rafrænni undirritun staðfesti ég að ég hafi lesið, skilið og samþykkt reglur þessar.`;
}

// ─── Data-protection briefing / processor declaration ───────
export function renderStaffDataProtectionBriefing(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `DATA-PROTECTION BRIEFING FOR STAFF
Lifeline Health ehf. – Statement on the handling of personal data
Version ${STAFF_DATA_PROTECTION_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Purpose
1.1 As an employee of Lifeline Health ehf., I process personal data on behalf of the company in the role of processor / processing agent, and I am bound by Act no. 90/2018 on data protection and the processing of personal data (GDPR, EU Regulation 2016/679).

2. Legal basis for processing
2.1 Health-data processing takes place on the basis of:
    a) the patient's explicit consent under Article 9(2)(a) GDPR; or
    b) the provision of healthcare under Article 9(2)(h) GDPR and Act no. 40/2007 on healthcare services.
2.2 Operational data (pay, contracts, access management) is processed on the basis of contract and legitimate interests.

3. Principles I shall follow
3.1 Lawfulness, fairness and transparency — only process data for purposes the patient has been informed of.
3.2 Purpose limitation — do not use data for purposes other than those originally defined.
3.3 Data minimisation — only process the data necessary for the task at hand.
3.4 Accuracy — ensure the data is correct and up to date.
3.5 Storage limitation — do not retain data longer than necessary.
3.6 Security — only process data in approved systems, in accordance with the Device Policy.

4. Patient rights
4.1 The patient has the right to:
    a) know what data is stored about them;
    b) request a copy (right of access);
    c) have inaccurate data corrected;
    d) request erasure where statute permits (the right to be forgotten is limited for medical records under Act no. 55/2009);
    e) withdraw consent at any time.
4.2 Requests from patients shall be forwarded to the Data Protection Officer (pv@lifelinehealth.is). The employee shall not respond directly to such requests.

5. Incident reporting (data breach)
5.1 Suspicion of a personal-data breach — whether unauthorised access, loss of data or wrong disclosure — shall be reported without delay to the Data Protection Officer.
5.2 Lifeline Health notifies the Icelandic Data Protection Authority and the patient as required by law.

6. Role of the employee vis-à-vis patients
6.1 The employee is not an independent controller — all processing takes place on behalf of Lifeline Health, which is the controller vis-à-vis patients. The employee may therefore not take independent decisions on disclosure or other processing outside established procedures.

7. Contacts
7.1 Lifeline Health Data Protection Officer: pv@lifelinehealth.is
7.2 Icelandic Data Protection Authority: postur@personuvernd.is · www.personuvernd.is

8. Confirmation
8.1 By electronic signature I confirm that I have received the data-protection briefing, understand my obligations under GDPR and Act no. 90/2018, and will follow the rules Lifeline Health sets for the handling of personal data.`;
  }
  return `PERSÓNUVERNDARFRÆÐSLA FYRIR STARFSMENN
Lifeline Health ehf. – Yfirlýsing um meðferð persónuupplýsinga
Útgáfa ${STAFF_DATA_PROTECTION_VERSION}

1. Tilgangur
1.1 Sem starfsmaður Lifeline Health ehf. vinn ég með persónuupplýsingar fyrir hönd fyrirtækisins í hlutverki vinnsluaðila/vinnanda, og mér ber að fylgja kröfum laga nr. 90/2018 um persónuvernd og vinnslu persónuupplýsinga (GDPR, sbr. reglugerð ESB 2016/679).

2. Lagagrundvöllur vinnslu
2.1 Vinnsla heilsufarsgagna fer fram á grundvelli:
    a) afdráttarlauss samþykkis skjólstæðings, sbr. 9. gr. GDPR (2)(a); eða
    b) heilbrigðisþjónustu, sbr. 9. gr. GDPR (2)(h) og lög nr. 40/2007 um heilbrigðisþjónustu.
2.2 Vinnsla rekstrargagna (launa, samninga, aðgangsstjórnunar) fer fram á grundvelli samnings og lögmætra hagsmuna.

3. Meginreglur sem starfsmaður skal fara eftir
3.1 Lögmæti, sanngirni og gagnsæi — eingöngu vinna með gögn í tilgangi sem skjólstæðingur er upplýstur um.
3.2 Markmiðabinding — ekki nota gögn í öðrum tilgangi en þeim sem upphaflega var skilgreindur.
3.3 Lágmörkun — eingöngu vinna með þau gögn sem eru nauðsynleg hverju sinni.
3.4 Áreiðanleiki — tryggja að gögnin séu rétt og uppfærð.
3.5 Takmörkun geymslu — ekki varðveita gögn lengur en nauðsyn krefur.
3.6 Öryggi — vinna með gögn eingöngu í samþykktum kerfum, sbr. Tækjareglur.

4. Réttindi skjólstæðings
4.1 Skjólstæðingur á rétt á að:
    a) vita hvaða gögn eru vistuð um hann;
    b) óska eftir afriti (aðgangsbeiðni);
    c) fá ranglegt gagn leiðrétt;
    d) óska eftir eyðingu þegar lagaskyldur leyfa (réttur til að gleymast er takmarkaður fyrir sjúkraskrár skv. lögum nr. 55/2009);
    e) afturkalla samþykki sitt hvenær sem er.
4.2 Fyrirspurnir frá skjólstæðingum skulu áframsendar á persónuverndarfulltrúa (pv@lifelinehealth.is). Starfsmaður skal ekki svara slíkum fyrirspurnum beint.

5. Atvikstilkynningar (data breach)
5.1 Grunur um persónuverndarbrot — hvort sem það varðar óheimilan aðgang, tap gagna eða ranga miðlun — skal tilkynna tafarlaust til persónuverndarfulltrúa.
5.2 Lifeline Health tilkynnir brot til Persónuverndar og skjólstæðings eftir því sem lög áskilja.

6. Hlutverk starfsmanns gagnvart skjólstæðingum
6.1 Starfsmaður er ekki sjálfstæður ábyrgðaraðili — öll vinnsla fer fram í umboði Lifeline Health sem er ábyrgðaraðili gagnvart skjólstæðingum. Starfsmaður má því ekki taka sjálfstæðar ákvarðanir um miðlun eða aðra vinnslu utan sett verkferla.

7. Tengiliðir
7.1 Persónuverndarfulltrúi Lifeline Health: pv@lifelinehealth.is
7.2 Persónuvernd (eftirlitsstofnun): postur@personuvernd.is · www.personuvernd.is

8. Staðfesting
8.1 Með rafrænni undirritun staðfesti ég að ég hafi fengið fræðslu um persónuvernd, skil skyldur mínar samkvæmt GDPR og lögum nr. 90/2018, og mun fylgja þeim reglum sem Lifeline Health setur um meðferð persónuupplýsinga.`;
}

// ─── Onboarding checklist (all staff) ────────────────────────
// Operational rules a staff member must understand on day one:
// where each kind of data lives, what they may and may not do in
// the app, how to report incidents, what to do at offboarding.
// Bump STAFF_ONBOARDING_CHECKLIST_VERSION on any text change so
// existing staff get re-prompted.
export function renderStaffOnboardingChecklist(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `STAFF ONBOARDING CHECKLIST AND OPERATING PROCEDURES
Lifeline Health ehf. – Acknowledgement of onboarding briefing
Version ${STAFF_ONBOARDING_CHECKLIST_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

This checklist is a short guide to the day-to-day rules I undertake
to follow as a Lifeline Health employee. It does not replace the NDA,
the confidentiality declaration, the device policy or the data-
protection briefing — it explains how those provisions are applied
in my daily work. I confirm each item separately.

1. Where the medical record is and where it is not
1.1 The patient's medical record (clinical history, clinical interpretation,
    doctor's letters, blood-test results and body composition as part of
    the health assessment) is stored in Medalia, which operates the
    medical record under Act no. 55/2009 and is a joint controller
    with Lifeline under Article 26 GDPR.
1.2 The Lifeline app and admin area are operational tools — bookings,
    plans, communications between patient and coach, self-tracking.
    They are NOT the medical record. Until the Medalia API integration
    is complete the app operates as a wellness and self-tracking tool
    (wellness mode).
1.3 Clinical answers, interpretations and medical advice take place
    inside Medalia or in a doctor's consultation — not via chat in the
    app.

2. Access principle — minimisation
2.1 I only open the data I need to perform my role.
2.2 I do NOT look up patients I am not serving — neither out of
    curiosity, on behalf of a third party, nor for personal reasons.
2.3 All access and read activity is logged. Lifeline reserves the
    right to periodic access review and acts on abnormal usage.

3. Role boundaries
3.1 Coach: bookings, plans, exercise, motivational communication.
3.2 Doctor / nurse: clinical interpretation, risk assessment, medical
    consultations — performed in Medalia, not in the admin app.
3.3 Psychologist: mental health — psychology records and notes go in
    a separate system not accessible to other staff.
3.4 Admin: operations, contracts, company invoicing — without access
    to clinical data.

4. The messaging system — what is and is not allowed
4.1 Messages between me and the patient are NOT medical advice and
    must not contain clinical diagnosis, medication changes,
    interpretation of blood tests or disease diagnoses.
4.2 If a patient asks a medical question (medication, symptoms,
    interpretation of measurements) I refer them to Medalia or a
    doctor's consultation and end with a short, neutral reply ("I'll
    pass this on to our doctor").
4.3 I never copy messages, measurements or information out of the
    system — not into email, screenshots, personal devices or
    personal accounts.

5. Approved tools and channels
5.1 Health data is handled only in Medalia, Lifeline admin and
    approved encrypted communication systems (e.g. Signal where
    admin approves).
5.2 I never send kennitala, health information or measurements via
    regular email, SMS or other open channels.
5.3 I use two-factor authentication (2FA) where offered and sign out
    of devices I am not using.

6. Incidents — when and where to report
6.1 I report without delay (within an hour where possible) to the
    Data Protection Officer (pv@lifelinehealth.is) and my immediate
    supervisor if:
    a) a device storing work data is lost or stolen;
    b) I send data to the wrong recipient;
    c) I see unusual activity in the systems (a login I do not
       recognise, unexpected queries, unexpected messages);
    d) I become aware that I have looked up or processed data I
       should not have;
    e) a patient reports security or privacy concerns to me.
6.2 Lifeline is responsible for assessing the incident and notifying
    the Icelandic Data Protection Authority and the patient as
    appropriate within 72 hours, in accordance with Article 33 GDPR.
    My role is to report immediately — not to assess myself whether
    the incident is reportable.

7. Patient rights (GDPR 15–22)
7.1 If a patient requests:
    a) a copy of their data (right of access);
    b) correction of incorrect information;
    c) erasure (right to be forgotten — limited for medical records
       under Act no. 55/2009);
    d) data portability;
    e) withdrawal of consent;
       — I do not respond myself but forward the request to
    pv@lifelinehealth.is and confirm to the patient that the request
    has been received and will be answered within 30 days.

8. The boundary between wellness and medical record (interim mode)
8.1 Until the Medalia API arrives (estimated within 6 months) the
    Lifeline app is classified as a wellness and self-tracking tool.
8.2 I do not give medical advice in the app. I do not interpret
    blood tests, change medication or make diagnoses.
8.3 The patient may import their Biody-measured data into the app
    with explicit consent — this does not change the fact that the
    data is part of their medical record in Medalia. I look at that
    data in Medalia when I need it clinically — not in the app.

9. End of employment
9.1 On termination I return all devices, keys and accounts to
    Lifeline without delay.
9.2 Access to systems is revoked immediately and I confirm that no
    data remains on personal devices or personal accounts.
9.3 My duty of confidentiality under Act no. 34/2012 and these
    agreements is LIFELONG and does not end on termination.

10. Monitoring and self-review
10.1 I can at any time review this signed checklist in "My documents"
     within Lifeline admin and so refresh the rules.
10.2 Lifeline reviews these rules periodically; I confirm them again
     when a new version is issued.
10.3 The chief physician and Data Protection Officer are my contacts
     for questions about confidentiality, clinical boundaries and
     data protection.

11. Confirmation of each item
By electronic signature I confirm each item above:
[ ] 1.   I know where the medical record is and where it is not.
[ ] 2.   I respect the access rules and only look up what I need.
[ ] 3.   I know the boundaries of my role.
[ ] 4.   I know what is and is not allowed in the messaging system.
[ ] 5.   I use only approved channels and tools.
[ ] 6.   I know how and within what time to report incidents.
[ ] 7.   I forward patient requests to pv@lifelinehealth.is.
[ ] 8.   I respect the wellness/medical-record boundary in interim mode.
[ ] 9.   I know what happens on termination and that confidentiality is lifelong.
[ ] 10.  I know where to find these rules to refresh them.

12. Final confirmation
12.1 By electronic signature I confirm that:
     a) I have read and understood all 11 sections of this checklist;
     b) I will follow these rules in my daily work;
     c) I understand that breach may lead to a warning, dismissal,
        notification to the Directorate of Health (where applicable)
        and criminal liability.
12.2 Lifeline keeps a signed PDF copy of this checklist in my
     document store (staff-acceptance-pdfs), and I can access it at
     any time through "My documents" in the admin area.`;
  }
  return `MÓTTÖKUGÁTLISTI OG VERKLAGSREGLUR FYRIR STARFSMENN
Lifeline Health ehf. – Staðfesting móttökufræðslu
Útgáfa ${STAFF_ONBOARDING_CHECKLIST_VERSION}

Þessi gátlisti er stuttur leiðarvísir um þær daglegu reglur sem ég
sem starfsmaður Lifeline Health skuldbind mig til að fylgja. Hann
kemur ekki í stað NDA, þagnarskyldu, tækjareglna eða persónuverndar-
fræðslu — heldur útskýrir hvernig þau ákvæði eru framkvæmd í daglegu
starfi mínu. Ég staðfesti hvert atriði fyrir sig.

1. Hvar er sjúkraskráin og hvar er hún ekki
1.1 Sjúkraskrá skjólstæðings (sjúkdómssaga, klínísk túlkun, læknisbréf,
    blóðprufuniðurstöður og líkamssamsetning sem hluti af heilsumati)
    er varðveitt í Medalia, sem rekur sjúkraskrá samkvæmt lögum nr.
    55/2009 og er sameiginlegur ábyrgðaraðili með Lifeline skv. 26.
    gr. GDPR.
1.2 Lifeline appið og admin-svæðið eru rekstrartæki — tímabókanir,
    áætlanir, samskipti milli skjólstæðings og þjálfara, sjálfsmælingar.
    Þau eru EKKI sjúkraskrá. Þangað til Medalia API tengingin er tilbúin
    starfar appið sem velferðar- og sjálfsmælingatól (wellness mode).
1.3 Klínísk svör, túlkanir og læknisráðgjöf fara fram inni í Medalia
    eða í læknisviðtali — ekki gegnum spjall í appinu.

2. Aðgangsregla — lágmörkun
2.1 Ég opna eingöngu þau gögn sem ég þarf til að sinna mínu hlutverki.
2.2 Ég fletti EKKI upp skjólstæðingum sem ég er ekki að þjónusta —
    hvorki úr forvitni, í þágu þriðja aðila né af persónulegum ástæðum.
2.3 Allt aðgangs- og lestrarferli er skráð. Lifeline áskilur sér rétt
    til reglubundinnar úttektar á aðgangi og bregst við óeðlilegri notkun.

3. Hlutverkaskil
3.1 Coach: tímabókanir, áætlanir, hreyfing, hvetjandi samskipti.
3.2 Doctor / nurse: klínísk túlkun, áhættumat, læknisviðtöl — fer fram
    í Medalia, ekki í admin-appinu.
3.3 Psychologist: andleg heilsa — sálfræðiskráning og nótur fara í
    aðskilið kerfi sem aðrir starfsmenn hafa ekki aðgang að.
3.4 Admin: rekstrarstjórnun, samningar, fyrirtækjareikningar — án
    aðgangs að klínískum gögnum.

4. Skilaboðakerfið — hvað má og hvað ekki
4.1 Skilaboð milli mín og skjólstæðings eru EKKI læknisráðgjöf og eiga
    ekki að innihalda klíníska greiningu, lyfjabreytingar, túlkun blóð-
    prufa eða sjúkdómsgreiningar.
4.2 Ef skjólstæðingur spyr læknisfræðilegrar spurningar (lyf, einkenni,
    túlkun mælinga) vísa ég honum í Medalia eða læknisviðtal og lýk
    með stuttu, hlutlausu svari ("sendi þetta áfram á lækninn okkar").
4.3 Ég afrita aldrei skilaboð, mælingar eða upplýsingar út úr kerfinu —
    hvorki í tölvupóst, skjáskot, persónuleg símtæki né einkareikninga.

5. Samþykkt verkfæri og samskiptaleiðir
5.1 Heilsufarsgögn meðhöndla ég eingöngu í Medalia, Lifeline admin og
    samþykktum dulkóðuðum samskiptakerfum (t.d. Signal þegar admin
    samþykkir).
5.2 Ég sendi aldrei kennitölu, heilsufarsupplýsingar eða mælingar
    í gegnum venjulegan tölvupóst, SMS eða aðrar opnar leiðir.
5.3 Ég nota tvíþátta auðkenningu (2FA) þar sem hún er í boði og
    skrái mig út af tækjum sem ég nota ekki.

6. Atvik — hvenær og hvert ég tilkynni
6.1 Ég tilkynni án tafar (innan klukkustundar ef mögulegt) til
    persónuverndarfulltrúa (pv@lifelinehealth.is) og næsta yfirmanns ef:
    a) tæki sem geymir vinnugögn týnist eða er stolið;
    b) ég sendi gögn á rangan viðtakanda;
    c) ég sé óvenjulega virkni í kerfunum (innskráning ég kannast ekki
       við, óþekktar fyrirspurnir, óvænt skeyti);
    d) ég kemst að því að ég hafi flett upp eða unnið með gögn sem ég
       hefði ekki átt að gera;
    e) skjólstæðingur tilkynnir mér um öryggis- eða persónuverndaráhyggjur.
6.2 Lifeline ber ábyrgð á að meta atvikið og tilkynna Persónuvernd og
    skjólstæðing eftir atvikum innan 72 klst., sbr. 33. gr. GDPR.
    Mitt hlutverk er að tilkynna strax — ekki að meta sjálfur hvort
    atvik telst tilkynningarskylt.

7. Réttindi skjólstæðings (GDPR 15–22)
7.1 Ef skjólstæðingur biður um:
    a) afrit af sínum gögnum (aðgangsréttur);
    b) leiðréttingu á ranglegum upplýsingum;
    c) eyðingu (réttur til að gleymast — takmarkaður fyrir sjúkraskrá
       skv. lögum nr. 55/2009);
    d) flutning gagna (data portability);
    e) afturköllun samþykkis;
       — þá svara ég ekki sjálfur heldur áframsendi beiðnina á
    pv@lifelinehealth.is og staðfesti við skjólstæðing að beiðnin sé
    móttekin og verður svarað innan 30 daga.

8. Mörkin milli velferðar og sjúkraskrár (interim mode)
8.1 Þangað til Medalia API kemur (áætlað innan 6 mánaða) er Lifeline
    appið flokkað sem velferðar- og sjálfsmælingatól.
8.2 Ég gef ekki læknisráðgjöf í appinu. Ég túlka ekki blóðprufur,
    breyti ekki lyfjameðferð, geri ekki greiningar.
8.3 Skjólstæðingur getur sótt sín Biody-mæld gögn inn í appið með
    afdráttarlausu samþykki — það breytir ekki því að gögnin eru hluti
    af sjúkraskrá hans í Medalia. Ég skoða þau gögn í Medalia þegar
    ég þarf á þeim að halda klínískt — ekki í appinu.

9. Starfslok
9.1 Við starfslok skila ég öllum tækjum, lyklum og aðgöngum til
    Lifeline án tafar.
9.2 Aðgangur að kerfum er afturkallaður strax og ég staðfesti að
    engin gögn séu eftir í persónulegum tækjum eða einkareikningum.
9.3 Þagnarskylda mín skv. lögum nr. 34/2012 og þessum samningum er
    ÆVILÖNG og fellur ekki niður við starfslok.

10. Eftirlit og sjálfsskoðun
10.1 Ég get hvenær sem er skoðað þennan undirritaða gátlista í
     "Mín skjöl" innan Lifeline admin og þannig rifjað upp reglurnar.
10.2 Lifeline endurskoðar reglur þessar reglulega; ég staðfesti þær
     á ný þegar ný útgáfa er gefin út.
10.3 Yfirlæknir og persónuverndarfulltrúi eru tengiliðir mínir vegna
     spurninga um þagnarskyldu, klínísk mörk og persónuvernd.

11. Staðfesting hvers liðar
Með rafrænni undirritun staðfesti ég hvert atriði hér að ofan:
[ ] 1.   Ég veit hvar sjúkraskráin er og hvar hún er ekki.
[ ] 2.   Ég virði aðgangsreglur og fletti aðeins upp því sem ég þarf.
[ ] 3.   Ég þekki mín hlutverkaskil.
[ ] 4.   Ég veit hvað má og má ekki segja í skilaboðakerfinu.
[ ] 5.   Ég nota eingöngu samþykktar samskiptaleiðir og verkfæri.
[ ] 6.   Ég veit hvernig á að tilkynna atvik og innan hvaða tíma.
[ ] 7.   Ég áframsendi beiðnir skjólstæðinga til pv@lifelinehealth.is.
[ ] 8.   Ég virði velferðar/sjúkraskrár-mörkin í interim mode.
[ ] 9.   Ég veit hvað gerist við starfslok og að þagnarskylda er ævilöng.
[ ] 10.  Ég veit hvar ég get nálgast þessar reglur til upprifjunar.

12. Lokastaðfesting
12.1 Með rafrænni undirritun staðfesti ég að:
     a) ég hef lesið og skilið alla 11 liði þessa gátlista;
     b) ég mun fylgja þessum reglum í daglegu starfi;
     c) ég átta mig á að brot getur leitt til viðvörunar, uppsagnar,
        tilkynningar til Embættis landlæknis (ef við á) og refsiábyrgðar.
12.2 Lifeline geymir undirritað PDF-afrit af þessum gátlista í minni
     skjalageymslu (staff-acceptance-pdfs), og ég get nálgast það
     hvenær sem er gegnum "Mín skjöl" í admin-svæðinu.`;
}

// ─── Lausráðningarsamningur (piece-rate employment) ─────────
// Employment contract for clinicians paid per measurement. Lifeline
// is the employer of record, on launagreiðandaskrá, handles tax
// withholding + tryggingagjald + pension mótframlag + orlof. This
// is the CORRECT instrument when the clinician works under Lifeline's
// healthcare license (starfsleyfi skv. lögum nr. 40/2007), uses
// Lifeline's equipment + SOPs, and the measurements feed Lifeline's
// sjúkraskrá. Fixed salary details belong in a bespoke ráðningar-
// samningur PDF (kind: employment_contract) uploaded per employee.
export function renderStaffPieceRateEmployment(language: DocumentLanguage = "is"): string {
  const isk = STAFF_PIECE_RATE_ISK_PER_MEASUREMENT.toLocaleString("is-IS");
  if (language === "en") {
    const iskEn = STAFF_PIECE_RATE_ISK_PER_MEASUREMENT.toLocaleString("en-US");
    return `ON-CALL EMPLOYMENT CONTRACT — PERFORMANCE-BASED PAY
Lifeline Health ehf. – On-call employment contract for healthcare professionals
Version ${STAFF_PIECE_RATE_EMPLOYMENT_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Parties
1.1 Employer: Lifeline Health ehf., reg. no. 590925-1440, Langholtsvegi 111, 104 Reykjavík ("Lifeline").
1.2 Employee: the undersigned healthcare professional ("the employee").
1.3 This is an employment contract under Act no. 19/1979, Act no. 30/1987 on holiday and Act no. 55/1980 on the working terms of employees. Lifeline is registered with the Directorate of Internal Revenue's wage-payer register and withholds income tax and pays the social-security contribution under Act no. 113/1990.

2. Position and role
2.1 The employee is engaged as a healthcare professional to perform health measurements and related clinical tasks for Lifeline — including body-composition measurements, blood-pressure, height and weight measurements, and recording responses to health-assessment questionnaires.
2.2 The engagement is on-call without fixed working hours: Lifeline offers the employee individual measurement sessions with reasonable notice and the employee may accept or decline each session without reason and without consequence to the employment relationship.
2.3 All healthcare services the employee provides under this engagement are performed under Lifeline's healthcare licence (Act no. 40/2007 on healthcare services). The chief physician of Lifeline bears ultimate medical responsibility for the clinical process.

3. Professional licence
3.1 The employee warrants that they hold a current licence from the Directorate of Health under Act no. 34/2012 on healthcare professionals and shall notify Lifeline without delay if the licence lapses, is restricted or comes under review.
3.2 This contract terminates automatically without notice if the licence is revoked.

4. Place of work
4.1 Measurements take place at Lifeline's customers — typically in the capital region. By agreement the employee may perform measurements outside the capital region, in which case separate provisions on travel cost apply.

5. Pay and pay structure
5.1 Pay is performance-based (piece-rate): ${iskEn} ISK per complete measurement session the employee performs (one session = a combined health assessment for one individual: body composition, blood pressure, height, weight, and recording of questionnaire responses).
5.2 Pay covers normal preparation, travel within the capital region, and recording in the medical record (Medalia).
5.3 No overtime is paid above a measurement session, since the employee themselves decides how many sessions to take.
5.4 A holiday allowance of 10.17% is calculated on all pay under Act no. 30/1987 and added automatically to the pay slip.
5.5 December bonus and holiday bonus under the applicable trade-union collective agreement are paid pro rata according to measurement sessions performed.

6. Payment arrangements
6.1 Payroll runs at the end of each month. Lifeline pays out the wages for that month no later than the ${STAFF_PIECE_RATE_PAYMENT_DUE_DAY}th of the following month.
6.2 A pay slip is issued in accordance with Article 5(2) of Act no. 55/1980 and contains the number of measurement sessions, pay amount, withholding, pension contribution (own and employer match) and holiday allowance.
6.3 If wage payment is delayed beyond the due date without legitimate reason, default interest under Chapter III of Act no. 38/2001 applies.

7. Withholding, social-security contribution and pension
7.1 Lifeline withholds income tax under Act no. 45/1987 and pays the social-security contribution on gross wages under Act no. 113/1990. The employee enjoys accident-insurance entitlement from Icelandic Health Insurance during the engagement.
7.2 Lifeline pays an 11.5% employer pension contribution under Act no. 129/1997 on mandatory pension insurance.
7.3 The employee pays a 4% own pension contribution which is deducted from pay. Supplementary pension saving is voluntary and the employee notifies Lifeline of their election at the start of engagement.
7.4 The employee notifies Lifeline of their union (e.g. Icelandic Nurses' Association, Icelandic Medical Association) so that the correct union and sickness-fund contributions are paid.

8. Holiday and holiday entitlement
8.1 The employee enjoys minimum holiday under Act no. 30/1987: 24 working days per holiday year (1 May – 30 April), or a 10.17% holiday allowance in pay as applicable when the work is sessional rather than continuous.
8.2 Because of the on-call nature of the engagement, the holiday allowance is paid as a percentage of each pay (see §5.4) instead of continuous holiday days. Agreement on a longer holiday is permissible and shall then be made in writing.

9. Sickness and unpaid leave
9.1 The employee enjoys minimum sickness rights under Act no. 19/1979 and the applicable trade-union collective agreement — i.e. the right to sick pay for booked measurement sessions the employee was unable to attend due to demonstrable illness, to the extent provided by law and the collective agreement.
9.2 Sickness must be notified to Lifeline immediately by email or phone — before the measurement session begins where possible.
9.3 Long-term sickness or parental leave is governed by the general rules of Act no. 19/1979 and Act no. 144/2020 on parental and child leave.

10. Cancellation of measurement sessions
10.1 The employee may decline an individual measurement session before confirmation without reason.
10.2 If the employee has confirmed a measurement session they shall give at least 48 hours' notice of cancellation. Later cancellation is not permitted except for sickness or force majeure.
10.3 If Lifeline cancels a confirmed measurement session with less than 48 hours' notice, Lifeline shall pay the employee half-fee (${Math.round(STAFF_PIECE_RATE_ISK_PER_MEASUREMENT / 2).toLocaleString("en-US")} ISK) for each scheduled measurement in that session.

11. Confidentiality and data protection
11.1 The employee is bound by the statutory duty of confidentiality under Act no. 34/2012 and Act no. 74/1997, confirmed in a separate declaration (Confidentiality Declaration).
11.2 The employee shall comply with the separate non-disclosure agreement (NDA), the device policy and the data-protection briefing of Lifeline Health, signed simultaneously with this contract.
11.3 All data the employee processes in the engagement is the property of customers (personal data) and of Lifeline as controller under Act no. 90/2018 and as the operator of the medical record under Act no. 55/2009.

12. Professional supervision and complaints
12.1 The employee performs their duties in accordance with Lifeline's procedures, quality standards and safety rules.
12.2 The chief physician of Lifeline exercises professional supervision. Incidents arising in the engagement shall be reported within 24 hours using Lifeline's incident form.

13. Intellectual property
13.1 All systems, procedures, questionnaires and recording forms are the property of Lifeline. The employee receives a user licence to them during the engagement and returns all electronic access on termination.

14. Notice period
14.1 Notice period is governed by Article 3 of Act no. 19/1979:
    a) During the probation period (first 3 months): 1 week from either party.
    b) After the probation period: 1 month.
    c) After 5 years' service: 2 months.
    d) After 10 years' service: 3 months.
14.2 Notice shall be in writing (an email to the registered email address of the other party suffices).

15. Summary termination
15.1 Lifeline may terminate this contract immediately without notice if:
    a) the employee grossly breaches confidentiality or trust;
    b) the employee's licence lapses or is revoked;
    c) the employee materially breaches the contract despite written warning.

16. Governing law
16.1 This contract is governed by Icelandic law.
16.2 If a dispute arises and is not settled within 30 days it shall be brought before the District Court of Reykjanes (Héraðsdómur Reykjaness).

17. Confirmation
17.1 By electronic signature the employee confirms that they have read, understood and accepted this contract.
17.2 Electronic signature has the same binding effect as a handwritten signature under Act no. 28/2001 on electronic signatures. A confirmation email with PDF copy, IP address and timestamp is sent to the employee on signing.`;
  }
  return `LAUSRÁÐNINGARSAMNINGUR — AFKASTAHVETJANDI LAUNAKERFI
Lifeline Health ehf. – Lausráðningarsamningur heilbrigðisstarfsmanns
Útgáfa ${STAFF_PIECE_RATE_EMPLOYMENT_VERSION}

1. Aðilar
1.1 Vinnuveitandi: Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir „Lifeline").
1.2 Launþegi: undirritaður heilbrigðisstarfsmaður (hér eftir „starfsmaður").
1.3 Samningurinn er launþegasamningur skv. lögum nr. 19/1979, lögum nr. 30/1987 um orlof og lögum nr. 55/1980 um starfskjör launafólks. Lifeline er skráð á launagreiðendaskrá Ríkisskattstjóra og heldur eftir staðgreiðslu og greiðir tryggingagjald skv. lögum nr. 113/1990.

2. Staða og starfshlutverk
2.1 Starfsmaður er ráðinn sem heilbrigðisstarfsmaður til að framkvæma heilsumælingar og tilheyrandi klínísk störf á vegum Lifeline — m.a. líkamssamsetningarmælingar, blóðþrýstings-, hæðar- og þyngdarmælingar og skráningar úr heilsumatsspurningalistum.
2.2 Ráðningin er lausráðning án fastra vinnustunda: Lifeline býður starfsmanni einstakar mælingalotur með eðlilegum fyrirvara og starfsmaður getur þegið eða hafnað hverri lotu án ástæðu eða afleiðinga fyrir ráðningarsambandið.
2.3 Öll heilbrigðisþjónusta sem starfsmaður veitir í starfi sínu fer fram undir starfsleyfi Lifeline skv. lögum nr. 40/2007 um heilbrigðisþjónustu. Yfirlæknir Lifeline ber endanlega læknisfræðilega ábyrgð á klínísku ferli.

3. Starfsleyfi
3.1 Starfsmaður ábyrgist að hafa virkt starfsleyfi frá Embætti landlæknis skv. lögum nr. 34/2012 um heilbrigðisstarfsmenn og skal tilkynna Lifeline tafarlaust ef það fellur úr gildi, er takmarkað eða tekið til skoðunar.
3.2 Samningurinn fellur sjálfkrafa niður án uppsagnarfrests ef starfsleyfi er afturkallað.

4. Starfsstöð
4.1 Mælingar fara fram hjá viðskiptavinum Lifeline — að jafnaði á höfuðborgarsvæðinu. Með samkomulagi má starfsmaður sinna mælingum utan höfuðborgarsvæðisins og gilda þá sérstök ákvæði um aksturskostnað.

5. Laun og launaform
5.1 Laun eru afkastahvetjandi (e. piece-rate): ${isk} ISK grunnlaun fyrir hverja fullkomna mælingalotu sem starfsmaður framkvæmir (ein mælingalota = samsett heilsumat fyrir einn einstakling: líkamssamsetning, blóðþrýstingur, hæð, þyngd og skráning spurningasvara).
5.2 Laun innifela eðlilegan undirbúning, ferðir innan höfuðborgarsvæðisins og skráningar í sjúkraskrá (Medalia).
5.3 Engin viðbótarlaun greiðast fyrir yfirvinnu umfram mælingalotu þar sem starfsmaður ræður sjálfur fjölda lota sem hann tekur að sér.
5.4 Orlofsuppbót 10,17% reiknast af öllum launum skv. lögum nr. 30/1987 og kemur sjálfkrafa á launaseðil.
5.5 Desemberuppbót og orlofsuppbót skv. gildandi kjarasamningi viðeigandi stéttarfélags greiðast hlutfallslega miðað við unnar mælingalotur.

6. Greiðslufyrirkomulag
6.1 Launakerfið keyrir í lok hvers mánaðar. Lifeline greiðir út laun fyrir þann mánuð eigi síðar en ${STAFF_PIECE_RATE_PAYMENT_DUE_DAY}. dag næsta mánaðar.
6.2 Launaseðill er gefinn út skv. 2. mgr. 5. gr. laga nr. 55/1980 og inniheldur fjölda mælingalota, launafjárhæð, staðgreiðslu, lífeyrisframlag (eigið og mótframlag) og orlofsuppbót.
6.3 Dragist launagreiðsla umfram gjalddaga án réttmætrar ástæðu greiðast dráttarvextir skv. III. kafla laga nr. 38/2001.

7. Staðgreiðsla, tryggingagjald og lífeyrir
7.1 Lifeline dregur staðgreiðslu opinberra gjalda af launum skv. lögum nr. 45/1987 og greiðir tryggingagjald af heildarlaunum skv. lögum nr. 113/1990. Starfsmaður nýtur slysabótaréttar frá Sjúkratryggingum Íslands meðan á ráðningu stendur.
7.2 Lifeline greiðir 11,5% mótframlag í lífeyrissjóð starfsmanns skv. lögum nr. 129/1997 um skyldutryggingu lífeyrisréttinda.
7.3 Starfsmaður greiðir 4% eigið lífeyrisframlag sem dregið er af launum. Viðbótarlífeyrissparnaður er valfrjáls og starfsmaður tilkynnir Lifeline um val sitt í upphafi ráðningar.
7.4 Starfsmaður tilkynnir Lifeline hvaða stéttarfélagi hann tilheyrir (t.d. Hjúkrunarfræðingafélag Íslands, Læknafélag Íslands) svo rétt félagsgjöld og sjúkrasjóðsgjöld verði skilað.

8. Orlof og orlofsréttur
8.1 Starfsmaður nýtur lágmarksorlofs skv. lögum nr. 30/1987: 24 virkir dagar á orlofsári (1. maí – 30. apríl), eða 10,17% orlofsuppbót í launum eftir því sem við á þegar vinnan er fremur lotukennd en samfelld.
8.2 Vegna lausráðningar er orlofsuppbótin greidd sem hlutfall af hverju útborguðu launi (sbr. 5.4) í stað samfelldra orlofsdaga. Samkomulag um lengra orlof er heimilt og skal þá gerast skriflega.

9. Veikindi og launalaus leyfi
9.1 Starfsmaður nýtur lágmarksveikindaréttar skv. lögum nr. 19/1979 og kjarasamningi viðeigandi stéttarfélags — þ.e. rétt til veikindalauna fyrir bókaðar mælingalotur sem starfsmaður gat ekki mætt á vegna sannanlegra veikinda, að því marki sem kveðið er á um í lögum og kjarasamningi.
9.2 Veikindi skal tilkynna Lifeline strax með tölvupósti eða síma — áður en mælingalota hefst ef mögulegt er.
9.3 Langvarandi veikindi eða fæðingarorlof fer eftir almennum reglum laga nr. 19/1979 og laga nr. 144/2020 um fæðingar- og foreldraorlof.

10. Afbókanir á mælingalotum
10.1 Starfsmaður getur hafnað einstakri mælingalotu fyrir staðfestingu án skýringar.
10.2 Hafi starfsmaður staðfest mælingalotu skal hann tilkynna afbókun með a.m.k. 48 klst. fyrirvara. Síðari afbókun telst óheimil nema vegna veikinda eða óviðráðanlegra atvika.
10.3 Afbóki Lifeline staðfesta mælingalotu með skemmri fyrirvara en 48 klst. ber Lifeline að greiða starfsmanni hálft gjald (${Math.round(STAFF_PIECE_RATE_ISK_PER_MEASUREMENT / 2).toLocaleString("is-IS")} ISK) fyrir hverja fyrirhugaða mælingu í þeirri lotu.

11. Þagnarskylda og persónuvernd
11.1 Starfsmaður er bundinn lögbundinni þagnarskyldu skv. lögum nr. 34/2012 og lögum nr. 74/1997, sem er staðfest í sérstakri yfirlýsingu (Yfirlýsing um þagnarskyldu).
11.2 Starfsmaður fer eftir sérstökum trúnaðarsamningi (NDA), tækjareglum og persónuverndarfræðslu Lifeline sem undirritaðar eru samtímis samningi þessum.
11.3 Öll gögn sem starfsmaður vinnur með í starfi eru eign viðskiptavina (persónugögn) og Lifeline sem ábyrgðaraðila skv. lögum nr. 90/2018 og rekstraraðila sjúkraskrár skv. lögum nr. 55/2009.

12. Faglegt tilsjón og kvartanir
12.1 Starfsmaður sinnir störfum sínum í samræmi við verkferla, gæðastaðla og öryggisreglur Lifeline.
12.2 Yfirlæknir Lifeline fer með faglegt tilsjón. Atvik sem upp koma í starfi skal tilkynna innan 24 klst. með atvikaskráningarformi Lifeline.

13. Hugverkaréttur
13.1 Öll kerfi, verkferlar, spurningalistar og skráningarform eru eign Lifeline. Starfsmaður fær notendaleyfi að þeim meðan á ráðningu stendur og skilar öllum tölvutengdum aðgangi til baka við starfslok.

14. Uppsagnarfrestur
14.1 Uppsagnarfrestur fer eftir 3. gr. laga nr. 19/1979:
    a) Á reynslutíma (fyrstu 3 mánuðirnir): 1 vika frá hvorum aðila.
    b) Eftir reynslutíma: 1 mánuður.
    c) Eftir 5 ára starf: 2 mánuðir.
    d) Eftir 10 ára starf: 3 mánuðir.
14.2 Uppsögn skal vera skrifleg (tölvupóstur á skráð netfang hins aðila gildir).

15. Riftun án fyrirvara
15.1 Lifeline getur rift samningnum tafarlaust án uppsagnarfrests ef:
    a) starfsmaður brýtur gróflega þagnarskyldu eða trúnaðarskyldu;
    b) starfsleyfi starfsmanns fellur úr gildi eða er afturkallað;
    c) starfsmaður brýtur verulega gegn samningnum þrátt fyrir skriflega áminningu.

16. Lögsaga
16.1 Um samning þennan gilda íslensk lög.
16.2 Rísi ágreiningur og náist ekki sátt innan 30 daga skal hann rekinn fyrir Héraðsdómi Reykjaness.

17. Staðfesting
17.1 Með rafrænni undirritun staðfestir starfsmaður að hafa lesið, skilið og samþykkt samning þennan.
17.2 Rafræn undirritun hefur sömu bindandi áhrif og handskrifuð undirritun skv. lögum nr. 28/2001 um rafrænar undirskriftir. Staðfestingarpóstur með PDF-afriti, IP-tölu og tímastimpli er sendur starfsmanni við undirritun.`;
}

// ─── Verktakasamningur (case-by-case contractor — non-clinical) ───
// For nurses / doctors / psychologists paid per measurement or visit
// instead of a fixed salary. Not a ráðningarsamningur — the contractor
// handles their own tax and pension. If you need to change the rate
// or payment window, bump STAFF_CONTRACTOR_VERSION so every existing
// signer has to re-acknowledge the new terms.
export function renderStaffContractorAgreement(language: DocumentLanguage = "is"): string {
  const isk = STAFF_CONTRACTOR_ISK_PER_MEASUREMENT.toLocaleString("is-IS");
  if (language === "en") {
    const iskEn = STAFF_CONTRACTOR_ISK_PER_MEASUREMENT.toLocaleString("en-US");
    return `INDEPENDENT CONTRACTOR AGREEMENT
Lifeline Health ehf. – Contractor agreement for commercial health measurements
Version ${STAFF_CONTRACTOR_VERSION}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Parties
1.1 Lifeline Health ehf., reg. no. 590925-1440, Langholtsvegi 111, 104 Reykjavík ("Lifeline" or "the customer").
1.2 The undersigned healthcare professional ("the contractor"), engaged as an independent contractor under this agreement.
1.3 The parties enter into this agreement as separate legal persons — the agreement does not create an employment relationship within the meaning of Act no. 28/1930 or Act no. 80/1938, and the contractor does not acquire employee rights (e.g. holiday, sick days, pension or unemployment-benefit rights) under this agreement.

2. Scope of work
2.1 The contractor performs health measurements for Lifeline's customers — body-composition, blood-pressure, height and weight measurements, and recording of responses to health questionnaires — in accordance with Lifeline's procedures and professional standards.
2.2 Measurements take place on specified measurement days at Lifeline's customers, at a time and place which Lifeline notifies with reasonable notice.
2.3 Each individual measurement session (a combined health assessment for one individual) constitutes one "measurement" within the meaning of this agreement.

3. Professional requirements and licence
3.1 The contractor warrants holding a valid licence as a nurse / doctor / healthcare assistant (as applicable) from the Directorate of Health under Act no. 34/2012 on healthcare professionals, and that the licence is valid while this agreement is in force.
3.2 The contractor shall notify Lifeline without delay if their licence lapses, is restricted, or is under review by the Directorate of Health. The agreement terminates automatically if the licence is revoked.
3.3 The contractor is bound by the procedures, safety rules and quality standards Lifeline sets for health measurements, since Lifeline operates as a healthcare service under Act no. 40/2007 and is responsible to patients.

4. Compensation
4.1 The contractor is paid ${iskEn} ISK per complete measurement performed.
4.2 The above amount is exclusive of VAT — healthcare services are VAT-exempt under Article 2(2) of Act no. 50/1988 on value-added tax.
4.3 Compensation covers time, preparation, travel within the capital region, recording in Lifeline's medical record, and follow-up after measurements.
4.4 Lifeline does not pay travel allowance, per diem or other expenses of the contractor unless agreed in writing.

5. Invoicing and payment
5.1 At the end of each month the contractor sends Lifeline an invoice with: number of measurements, location and date, total amount.
5.2 Lifeline pays correctly issued invoices within ${STAFF_CONTRACTOR_PAYMENT_DAYS} days of receipt.
5.3 If payment is delayed beyond the due date without legitimate reason Lifeline pays default interest under Chapter III of Act no. 38/2001 on interest and price-indexing.
5.4 The contractor is responsible for their own bookkeeping and tax withholding under Act no. 45/1987 on withholding of public charges and Act no. 50/1988 on value-added tax (although healthcare services are VAT-exempt).

6. Taxes, pension and insurance
6.1 The contractor operates under their own kennitala and is themselves responsible for:
    a) payment of withholding tax on the fee (Act no. 45/1987);
    b) payment of pension contributions to a recognised pension fund (Act no. 129/1997 on mandatory pension insurance);
    c) payment of social-security contribution and other public charges;
    d) own health and accident insurance.
6.2 Lifeline is not obliged to withhold or remit any public charges from the contractor's fee.

7. Cancellations and changes
7.1 Either party may cancel an individual measurement session with at least 48 hours' notice without compensation.
7.2 If Lifeline cancels a measurement session with less than 48 hours' notice, the contractor is paid a corresponding half-fee (1,000 ISK) per scheduled measurement in that session, provided the contractor had confirmed participation.
7.3 If the contractor fails to attend or is unable to perform a measurement session without 48 hours' notice, and Lifeline must arrange a substitute, Lifeline may withhold compensation for that session and may seek demonstrable extra cost of the substitute from the contractor.

8. Confidentiality and data protection
8.1 The contractor is bound by the specific duty of confidentiality of healthcare professionals under Act no. 34/2012 and patients' rights under Act no. 74/1997, as well as the confidentiality obligation towards Lifeline under a separate non-disclosure agreement which is part of the contractor's onboarding.
8.2 All personal data which the contractor accesses in the course of work under this agreement belongs to Lifeline's customers and to Lifeline itself as controller under Act no. 90/2018 on data protection. The contractor is a processor within the meaning of the Act.

9. Professional liability and insurance
9.1 Lifeline bears professional responsibility for the healthcare service vis-à-vis patients as the operator with a Directorate-of-Health licence.
9.2 The contractor is responsible for their own conduct and negligence under general rules of damages, and shall report to Lifeline all incidents arising in the work within 24 hours.
9.3 The contractor is advised to hold professional indemnity insurance.

10. Intellectual property and data processing
10.1 All systems, procedures, questionnaires, recording forms and other materials Lifeline provides to the contractor are Lifeline's property. The contractor receives a user licence to them while the agreement is in force.
10.2 Measurement data and medical-record data created in the course of work are the property of Lifeline's customers (personal data) and of Lifeline as the operator of the medical record under Act no. 55/2009.

11. Term and termination
11.1 The agreement enters into force on the contractor's electronic signature and is for an indefinite term.
11.2 Either party may terminate without reason on 14 days' written notice (an email to the registered email address of the other party suffices).
11.3 Lifeline may terminate without notice if:
    a) the contractor's licence lapses or is revoked;
    b) the contractor grossly breaches confidentiality or trust;
    c) the contractor fails to meet their obligations under this agreement despite warning.
11.4 Termination does not affect measurements already performed or amounts already due.

12. Assignment of rights and obligations
12.1 The contractor may not subcontract the work under this agreement to any third party without Lifeline's prior written consent.

13. Changes to the agreement
13.1 Changes to this agreement shall be made in writing and signed by both parties. Changes to compensation or termination provisions are material and require a new version of the agreement.

14. Governing law and venue
14.1 This agreement is governed by Icelandic law.
14.2 If a dispute arises between the parties and is not settled within 30 days it shall be brought before the District Court of Reykjanes (Héraðsdómur Reykjaness).

15. Confirmation
15.1 By electronic signature the contractor confirms that they have read, understood and accepted this agreement, and that they have authority to undertake their obligations under it.
15.2 Electronic signature has the same binding effect as a handwritten signature under Act no. 28/2001 on electronic signatures. Confirmation has been sent to the contractor by email as a PDF document together with timestamp and IP address.`;
  }
  return `VERKTAKASAMNINGUR
Lifeline Health ehf. – Verktakasamningur um heilsumælingar í atvinnuskyni
Útgáfa ${STAFF_CONTRACTOR_VERSION}

1. Aðilar
1.1 Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir „Lifeline" eða „verkkaupi").
1.2 Undirritaður heilbrigðisstarfsmaður (hér eftir „verktaki"), sem starfar sem verktaki samkvæmt samningi þessum.
1.3 Aðilar undirrita þennan samning sem sjálfstæða lögaðila — samningurinn stofnar ekki til ráðningarsambands í skilningi laga nr. 28/1930 eða laga nr. 80/1938, og verktaki hlýtur ekki launþegaréttindi (t.d. orlof, veikindadagar, lífeyri eða atvinnuleysisbótarétt) samkvæmt þessum samningi.

2. Umfang verkefnis
2.1 Verktaki framkvæmir heilsumælingar fyrir viðskiptavini Lifeline — líkamssamsetningarmælingar (body composition), blóðþrýstingsmælingar, hæðar- og þyngdarmælingar, og skráningar á svörum úr heilsuspurningalistum — í samræmi við verkferla Lifeline og faglega staðla.
2.2 Mælingar fara fram á tilteknum mælingadögum hjá viðskiptavinum Lifeline, á tíma og stað sem Lifeline tilkynnir með eðlilegum fyrirvara.
2.3 Hver einstök mælingalota (samsett heilsumat fyrir einn einstakling) telst ein „mæling" (e. measurement) í skilningi þessa samnings.

3. Faglegar kröfur og starfsleyfi
3.1 Verktaki ábyrgist að hafa gilt starfsleyfi sem hjúkrunarfræðingur/læknir/sjúkraliði (eftir atvikum) frá Embætti landlæknis, sbr. lög nr. 34/2012 um heilbrigðisstarfsmenn, og að starfsleyfið sé virkt á meðan samningurinn er í gildi.
3.2 Verktaki skal tilkynna Lifeline tafarlaust ef starfsleyfi fellur úr gildi, er takmarkað, eða er til skoðunar hjá Embætti landlæknis. Samningurinn fellur sjálfkrafa úr gildi ef starfsleyfi er afturkallað.
3.3 Verktaki er bundinn þeim verkferlum, öryggisreglum og gæðastöðlum sem Lifeline setur fyrir heilsumælingar, enda er Lifeline rekið sem heilbrigðisþjónusta skv. lögum nr. 40/2007 og ber ábyrgð gagnvart skjólstæðingum.

4. Endurgjald
4.1 Verktaki fær greitt ${isk} ISK fyrir hverja fullkomna mælingu sem hann framkvæmir.
4.2 Ofangreind fjárhæð er án VSK — heilbrigðisþjónusta er vsk-frjáls skv. 2. mgr. 2. gr. laga nr. 50/1988 um virðisaukaskatt.
4.3 Endurgjald innifelur tíma, undirbúning, ferðir innan höfuðborgarsvæðisins, skráningar í sjúkraskrá Lifeline og eftirfylgni eftir mælingar.
4.4 Lifeline greiðir hvorki akstur, dagpeninga né aðrar útlagðar kostnað verktaka nema sérstakt skriflegt samkomulag sé gert þar um.

5. Reikningagerð og greiðsla
5.1 Í lok hvers mánaðar sendir verktaki Lifeline reikning með upplýsingum um: fjölda mælinga, staðsetningu og dagsetningu, heildarfjárhæð.
5.2 Lifeline greiðir rétta reikninga innan ${STAFF_CONTRACTOR_PAYMENT_DAYS} daga frá móttöku.
5.3 Dragist greiðsla umfram gjalddaga án réttmætrar ástæðu greiðir Lifeline dráttarvexti skv. III. kafla laga nr. 38/2001 um vexti og verðtryggingu.
5.4 Verktaki ber ábyrgð á eigin bókhaldi og staðgreiðslu, sbr. lög nr. 45/1987 um staðgreiðslu opinberra gjalda og lög nr. 50/1988 um virðisaukaskatt (þó heilbrigðisþjónusta sé vsk-frjáls).

6. Skattar, lífeyrir og tryggingar
6.1 Verktaki starfar á eigin kennitölu og ber sjálfur ábyrgð á:
    a) greiðslu staðgreiðsluskatts af þóknun (sbr. lög nr. 45/1987);
    b) greiðslu lífeyrisiðgjalda í viðurkenndan lífeyrissjóð (sbr. lög nr. 129/1997 um skyldutryggingu lífeyrisréttinda);
    c) greiðslu tryggingagjalds og annarra opinberra gjalda;
    d) eigin sjúkra- og slysatryggingum.
6.2 Lifeline er ekki skuldbundið til að halda eftir eða skila neinum opinberum gjöldum af þóknun verktaka.

7. Afbókanir og breytingar
7.1 Hvor aðili getur afbókað einstaka mælingalotu með að lágmarki 48 klst. fyrirvara án endurgjalds.
7.2 Afbóki Lifeline mælingalotu með skemmri fyrirvara en 48 klst. greiðist verktaka samsvarandi helmingsgjald (1.000 ISK) fyrir hverja fyrirhugaða mælingu í þeirri lotu, enda hafi verktaki staðfest þátttöku.
7.3 Mæti verktaki ekki eða sé óstarfhæfur á mælingalotu án 48 klst. fyrirvara, og Lifeline þurfi að útvega staðgengil, getur Lifeline haldið eftir endurgjaldi fyrir þá lotu og krafið verktaka um sannanlegan aukakostnað vegna staðgengils.

8. Þagnarskylda og persónuvernd
8.1 Verktaki er bundinn sértækri þagnarskyldu heilbrigðisstarfsmanna skv. lögum nr. 34/2012 og réttindum sjúklinga skv. lögum nr. 74/1997, svo og trúnaðarskyldu gagnvart Lifeline skv. sérstökum trúnaðarsamningi sem er hluti af skráningu verktaka í kerfið.
8.2 Allar persónuupplýsingar sem verktaki fær aðgang að í störfum skv. samningi þessum tilheyra viðskiptavinum Lifeline og Lifeline sjálfu sem ábyrgðaraðila skv. lögum nr. 90/2018 um persónuvernd. Verktaki er vinnsluaðili í skilningi laganna.

9. Faglega ábyrgð og tryggingaskylda
9.1 Lifeline ber faglega ábyrgð á heilbrigðisþjónustunni gagnvart skjólstæðingum sem rekstraraðili með starfsleyfi landlæknis.
9.2 Verktaki ber sjálfur ábyrgð á eigin háttsemi og vanrækslu skv. almennum reglum um skaðabætur, og skal tilkynna Lifeline öll atvik sem upp koma við störfin innan 24 klst.
9.3 Verktaka er ráðlagt að hafa starfsábyrgðartryggingu.

10. Hugverkaréttur og gagnavinnsla
10.1 Öll kerfi, verkferlar, spurningalistar, skráningarform og önnur gögn sem Lifeline lætur verktaka í té eru eign Lifeline. Verktaki fær notendaleyfi til þeirra meðan samningurinn er í gildi.
10.2 Mælingargögn og sjúkraskrárgögn sem til verða við störfin eru eign viðskiptavina Lifeline (persónugögn) og Lifeline sem rekstraraðila sjúkraskrár skv. lögum nr. 55/2009.

11. Samningstími og uppsögn
11.1 Samningurinn tekur gildi við rafræna undirritun verktaka og er ótímabundinn.
11.2 Hvor aðili getur sagt samningnum upp án ástæðu með 14 daga skriflegum fyrirvara (tölvupóstur á skráð netfang hins aðila telst gildur).
11.3 Lifeline getur sagt samningnum upp án fyrirvara ef:
    a) starfsleyfi verktaka fellur úr gildi eða er afturkallað;
    b) verktaki brýtur gróflega trúnaðarskyldu eða þagnarskyldu;
    c) verktaki stendur ekki við skuldbindingar sínar skv. samningi þessum þrátt fyrir áminningu.
11.4 Uppsögn hefur ekki áhrif á mælingar sem þegar hafa verið framkvæmdar eða fjárhæðir sem þegar hafa fallið til greiðslu.

12. Yfirfærsla réttinda og skuldbindinga
12.1 Verktaki má ekki framselja störf skv. samningi þessum til þriðja aðila án skriflegs samþykkis Lifeline.

13. Breytingar á samningi
13.1 Breytingar á samningi þessum skulu gerðar skriflega og undirritaðar af báðum aðilum. Breytingar á endurgjaldi eða uppsagnarákvæðum teljast verulegar og kalla á nýja útgáfu samningsins.

14. Lögsaga og varnarþing
14.1 Um samning þennan gilda íslensk lög.
14.2 Rísi ágreiningur milli aðila og náist ekki sátt innan 30 daga skal hann rekinn fyrir Héraðsdómi Reykjaness.

15. Staðfesting
15.1 Með rafrænni undirritun staðfestir verktaki að hafa lesið, skilið og samþykkt samning þennan, og að hann hafi heimild til að gangast undir skuldbindingar sínar samkvæmt honum.
15.2 Rafræn undirritun hefur sömu bindandi áhrif og handskrifuð undirritun skv. lögum nr. 28/2001 um rafrænar undirskriftir. Staðfesting hefur verið send verktaka með tölvupósti sem PDF-skjal ásamt tímastimpli og IP-tölu.`;
}

// ─── Registry: key → renderer, for generic code paths ────────
// The render() default of "is" preserves the legally binding text for
// existing callers that hash text for click-through acceptance.
export const STAFF_DOC_REGISTRY: Record<string, { version: string; title: string; render: (lang?: DocumentLanguage) => string }> = {
  [STAFF_NDA_KEY]: { version: STAFF_NDA_VERSION, title: "Trúnaðarsamningur (NDA)", render: renderStaffNDA },
  [STAFF_CONFIDENTIALITY_KEY]: { version: STAFF_CONFIDENTIALITY_VERSION, title: "Yfirlýsing um þagnarskyldu (heilbrigðisstarfsmaður)", render: renderStaffConfidentiality },
  [STAFF_ACCEPTABLE_USE_KEY]: { version: STAFF_ACCEPTABLE_USE_VERSION, title: "Tækjareglur og aðgangsstjórnun", render: renderStaffAcceptableUse },
  [STAFF_DATA_PROTECTION_KEY]: { version: STAFF_DATA_PROTECTION_VERSION, title: "Persónuverndarfræðsla", render: renderStaffDataProtectionBriefing },
  [STAFF_ONBOARDING_CHECKLIST_KEY]: { version: STAFF_ONBOARDING_CHECKLIST_VERSION, title: "Móttökugátlisti og verklagsreglur", render: renderStaffOnboardingChecklist },
  [STAFF_PIECE_RATE_EMPLOYMENT_KEY]: { version: STAFF_PIECE_RATE_EMPLOYMENT_VERSION, title: "Lausráðningarsamningur (afkastahvetjandi launakerfi)", render: renderStaffPieceRateEmployment },
  [STAFF_CONTRACTOR_KEY]: { version: STAFF_CONTRACTOR_VERSION, title: "Verktakasamningur (sjálfstæður verktaki)", render: renderStaffContractorAgreement },
};
