// Staff-level legal documents accepted by every team member at onboarding.
// Same hash-and-version pattern as platform-terms-content: the exact
// string returned by the render functions is sha256-hashed and stored
// in staff_agreement_acceptances.text_hash. Any change — even
// whitespace — MUST bump the version so existing staff get re-prompted.

export type StaffRoleLabel = "admin" | "coach" | "doctor" | "nurse" | "psychologist";

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
  return "piece_rate";
}

// ─── Keys / versions ─────────────────────────────────────────
export const STAFF_NDA_KEY = "staff-nda";
export const STAFF_NDA_VERSION = "v1.0";

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
export const STAFF_PIECE_RATE_EMPLOYMENT_VERSION = "v1.0";
// Compensation constants — baked into the v1.0 text. Change → bump version.
export const STAFF_PIECE_RATE_ISK_PER_MEASUREMENT = 2000;
export const STAFF_PIECE_RATE_PAYMENT_DUE_DAY = 5; // 5th of next month

// Verktakasamningur — kept for truly independent contractors only
// (non-clinical freelancers, consultants, etc.). NOT required for
// clinicians by default — they should be on the piece_rate employment
// contract because they work under Lifeline's healthcare license.
export const STAFF_CONTRACTOR_KEY = "staff-contractor-agreement";
export const STAFF_CONTRACTOR_VERSION = "v1.0";
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
//
// Backwards-compat: if employment_type is null/undefined the function
// uses defaultEmploymentType(role).
export function requiredAgreementsForStaff(
  role: StaffRoleLabel,
  employmentType: EmploymentType | null | undefined,
): Array<{ key: StaffAgreementKey; version: string; title: string }> {
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
export function renderStaffNDA(): string {
  return `TRÚNAÐARSAMNINGUR STARFSMANNS
Lifeline Health ehf. – Samningur um trúnað og þagmælsku
Útgáfa ${STAFF_NDA_VERSION}

1. Aðilar og gildissvið
1.1 Lifeline Health ehf., kt. 590925-1440, Þrastarási 71, 221 Hafnarfjörður (hér eftir „Lifeline Health") og undirritaður starfsmaður gera með sér samning þennan um meðferð trúnaðarupplýsinga.
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
export function renderStaffConfidentiality(): string {
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
export function renderStaffAcceptableUse(): string {
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
export function renderStaffDataProtectionBriefing(): string {
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
export function renderStaffOnboardingChecklist(): string {
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
export function renderStaffPieceRateEmployment(): string {
  const isk = STAFF_PIECE_RATE_ISK_PER_MEASUREMENT.toLocaleString("is-IS");
  return `LAUSRÁÐNINGARSAMNINGUR — AFKASTAHVETJANDI LAUNAKERFI
Lifeline Health ehf. – Lausráðningarsamningur heilbrigðisstarfsmanns
Útgáfa ${STAFF_PIECE_RATE_EMPLOYMENT_VERSION}

1. Aðilar
1.1 Vinnuveitandi: Lifeline Health ehf., kt. 590925-1440, Þrastarási 71, 221 Hafnarfjörður (hér eftir „Lifeline").
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
export function renderStaffContractorAgreement(): string {
  const isk = STAFF_CONTRACTOR_ISK_PER_MEASUREMENT.toLocaleString("is-IS");
  return `VERKTAKASAMNINGUR
Lifeline Health ehf. – Verktakasamningur um heilsumælingar í atvinnuskyni
Útgáfa ${STAFF_CONTRACTOR_VERSION}

1. Aðilar
1.1 Lifeline Health ehf., kt. 590925-1440, Þrastarási 71, 221 Hafnarfjörður (hér eftir „Lifeline" eða „verkkaupi").
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
export const STAFF_DOC_REGISTRY: Record<string, { version: string; title: string; render: () => string }> = {
  [STAFF_NDA_KEY]: { version: STAFF_NDA_VERSION, title: "Trúnaðarsamningur (NDA)", render: renderStaffNDA },
  [STAFF_CONFIDENTIALITY_KEY]: { version: STAFF_CONFIDENTIALITY_VERSION, title: "Yfirlýsing um þagnarskyldu (heilbrigðisstarfsmaður)", render: renderStaffConfidentiality },
  [STAFF_ACCEPTABLE_USE_KEY]: { version: STAFF_ACCEPTABLE_USE_VERSION, title: "Tækjareglur og aðgangsstjórnun", render: renderStaffAcceptableUse },
  [STAFF_DATA_PROTECTION_KEY]: { version: STAFF_DATA_PROTECTION_VERSION, title: "Persónuverndarfræðsla", render: renderStaffDataProtectionBriefing },
  [STAFF_ONBOARDING_CHECKLIST_KEY]: { version: STAFF_ONBOARDING_CHECKLIST_VERSION, title: "Móttökugátlisti og verklagsreglur", render: renderStaffOnboardingChecklist },
  [STAFF_PIECE_RATE_EMPLOYMENT_KEY]: { version: STAFF_PIECE_RATE_EMPLOYMENT_VERSION, title: "Lausráðningarsamningur (afkastahvetjandi launakerfi)", render: renderStaffPieceRateEmployment },
  [STAFF_CONTRACTOR_KEY]: { version: STAFF_CONTRACTOR_VERSION, title: "Verktakasamningur (sjálfstæður verktaki)", render: renderStaffContractorAgreement },
};
