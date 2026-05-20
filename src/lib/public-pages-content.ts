// Plain-text mirrors of the public /privacy and /terms pages.
//
// Why this file exists separately from src/app/privacy/page.tsx and
// src/app/terms/page.tsx:
// - The public pages are styled JSX (headings, lists, tables, links)
//   which is great for end users but unreadable when the lawyer wants
//   to review the literal contractual text.
// - The lawyer reviews documents on /admin/legal/drafts which lists
//   plain-text versions of every legal document. We want privacy + tos
//   to appear there in the same readable form as every other doc.
//
// MAINTENANCE: edit BOTH this file and the corresponding JSX page when
// content changes, then bump the version + last-updated below. The
// public JSX page is what users see; this renderer is what the lawyer
// reviews. They must stay in sync.

export type DocumentLanguage = "is" | "en";

export const PUBLIC_PRIVACY_VERSION = "v1.4";
export const PUBLIC_PRIVACY_LAST_UPDATED = "2026-04-29";
export const PUBLIC_TERMS_VERSION = "v1.3";
export const PUBLIC_TERMS_LAST_UPDATED = "2026-05-20";
export const PUBLIC_SALES_TERMS_VERSION = "v1.0";
export const PUBLIC_SALES_TERMS_LAST_UPDATED = "2026-05-20";

export function renderPublicPrivacyPolicy(language: DocumentLanguage = "en"): string {
  if (language === "is") {
    return `LIFELINE HEALTH — PERSÓNUVERNDARYFIRLÝSING
Útgáfa ${PUBLIC_PRIVACY_VERSION}  ·  Síðast uppfært ${PUBLIC_PRIVACY_LAST_UPDATED}

Þessi yfirlýsing lýsir hvaða persónuupplýsingar Lifeline Health ehf.
(„Lifeline", „við") safnar um þig, hvers vegna, hvernig við notum þær,
hverjum við miðlum þeim, hve lengi við varðveitum þær og þeim réttindum
sem þú átt yfir þeim. Hún gildir samhliða notkunarskilmálum okkar — ef
eitthvað hér rekst á við annað þá ræður þetta skjal í persónuvernd.

1. HVER FER MEÐ GÖGNIN ÞÍN
Lifeline Health ehf., íslenskt félag (Reykjavík), er ábyrgðaraðili
persónuupplýsinga þinna. Spurningar og beiðnir má senda á
contact@lifelinehealth.is.

2. FLOKKAR GAGNA SEM VIÐ SÖFNUM
- Auðkenni og tengiliðir: nafn, kennitala, netfang, símanúmer, heimilisfang.
- Aðgangur: lykilorð (geymt sem salt-hashað, aldrei í læsilegu formi),
  innskráningarsaga, tæki + IP á lotu-stigi.
- Heilsuprófíll: fæðingardagur, kyn, hæð, þyngd, virknistig, heilsumarkmið,
  sjúkrasaga sem þú velur að deila.
- Mælingar: niðurstöður líkamssamsetningarmælinga (fituprósenta,
  vöðvamassi, fasahorn, BMR, líkamsvökvi o.fl.) frá mælingaaðila okkar Biody.
- Notkun: skráðar máltíðir, vigtanir, framvinda áætlana, samskipti við
  Lifeline-þjálfara.
- B2B-aðlögun (eingöngu B2B): fyrirtækið sem þú tilheyrir og staða aðlögunar.

3. HVERNIG VIÐ SÖFNUM ÞEIM
- Beint frá þér þegar þú skráir þig, svarar matskönnunum eða notar appið.
- Frá vinnuveitanda þínum (eingöngu B2B) sem gefur okkur nafn, kennitölu,
  netfang og síma áður en þér er boðið — þú fyllir út afganginn sjálf(ur).
- Frá Biody Manager þegar þú mætir í líkamssamsetningarmælingu hjá
  samstarfs-stofu okkar.
- Sjálfvirkt um appið (t.d. tímabelti símans, gerð tækis fyrir stuðning).

4. AF HVERJU VIÐ NOTUM ÞÆR (LAGAGRUNDVÖLLUR)
- Efni samnings (6. gr. (1)(b) GDPR). Að veita þér þá þjónustu sem þú
  skráðir þig fyrir — mat, skýrslur, þjálfun, líkamssamsetningareftirlit.
- Afdráttarlaust samþykki fyrir sérflokki (9. gr. (2)(a)). Heilsugögn eru
  einungis unnin þegar þú hefur samþykkt skilmála okkar í aðlögunarferli.
- Lögmætir hagsmunir (6. gr. (1)(f)). Forvarnir gegn svikum, villuleit og
  öruggur rekstur kerfisins.
- Samþykki (6. gr. (1)(a)). Markaðspóstur og notkun ópersónugreinanlegra
  gagna í rannsóknum — bæði opt-in; þú getur dregið samþykki til baka hvenær
  sem er.
- Lagaskylda (6. gr. (1)(c)). Þar sem íslensk heilbrigðislög, skattalög eða
  dómsúrskurðir krefjast varðveislu eða miðlunar.

5. HVERNIG VIÐ GEYMUM KENNITÖLU ÞÍNA
Kennitala telst viðkvæmt persónugagn samkvæmt íslenskum lögum. Við fylgjum
lágmörkunarreglu: aðeins síðustu fjórir stafir eru geymdir í gagnagrunni
okkar, og einungis í þeim takmarkaða tilgangi að þekkja starfsmannalista í
B2B-aðlögun og finna tvítekningar. Við geymum, dulkóðum eða sendum ekki
fulla kennitölu — hvorki til starfsfólks né þriðja aðila. Krefjist
regluverks- eða klínísks ferlis þess í framtíðinni mun það ferli liggja inni
í Medalia (löggildu sjúkraskrárkerfi) þar sem aðgangur er skráður
samkvæmt lögum nr. 55/2009 §14, ekki í þessu appi.

6. HVERJUM VIÐ MIÐLUM GÖGNUM ÞÍNUM
  Móttakandi                       | Tilgangur                                                                                                | Staðsetning
  Medalia ehf.                      | Löggilt sjúkraskrárkerfi skv. lögum 55/2009 — sameiginlegur ábyrgðaraðili með Lifeline (26. gr. GDPR) | Ísland
  Supabase Inc.                     | Gagnagrunnur, auðkenning, rekstrargögn                                                                  | EES (Frankfurt)
  Vercel Inc.                       | Vefhýsing, afhending                                                                                   | EES + USA (með SCC)
  Resend (Lilo Labs Inc.)           | Sending sjálfvirks tölvupósts                                                                          | EES + USA (með SCC)
  Biody Manager (Aminogram SAS)     | Mælingafélagi fyrir líkamssamsetningu                                                                  | EES (Frakkland)
  Vinnuveitandi þinn (eingöngu B2B) | Staða aðlögunar — engin heilsugögn                                                                     | Ísland
  Íslensk yfirvöld                  | Þar sem lög krefjast (dómsúrskurður, heilbrigðislög)                                                   | Ísland

Við seljum aldrei persónuupplýsingar. Allir vinnsluaðilar eru bundnir
GDPR-vinnslusamningum. Flutningur út fyrir EES grundvallast á stöðluðum
samningsákvæðum ESB.

6a. HVAR SJÚKRASKRÁIN ÞÍN LIGGUR
Lifeline rekur löggilta heilbrigðisþjónustu samkvæmt lögum nr. 40/2007.
Formleg sjúkraskrá þín — þ.m.t. klínísk túlkun, blóðprufuniðurstöður,
læknisbréf og frágengið heilsumat — er varðveitt hjá Medalia ehf., löggildu
sjúkraskrárkerfi skv. lögum nr. 55/2009. Lifeline og Medalia eru
sameiginlegir ábyrgðaraðilar þeirrar skrár skv. 26. gr. GDPR.

Lifeline appið og admin-svæðið eru rekstrartæki (tímabókanir, áætlanir,
þjálfun, sjálfsmælingar) — ekki sjúkraskráin þín. Niðurstöður
líkamssamsetningar úr Biody-mælingum eru færðar í Medalia af
heilbrigðisstarfsmanni sem hluti af heilsumati þínu; afrit er einnig sýnt á
Lifeline-mælaborðinu þínu fyrir þína eigin sjálfsskráningu, með
afdráttarlausu samþykki þínu og einungis sýnilegt þér.

7. HVAÐ VIÐ DEILUM MEÐ BIODY MANAGER
Til að skrá þig sem sjúkling í mælitækinu sendum við Biody nafn þitt,
netfang, fæðingardag (úr kennitölu þinni), kyn, hæð og virknistig. Við
sendum EKKI kennitölu þína né lykilorð í Lifeline. Biody varðveitir
mælinganiðurstöðurnar og skilar okkur þeim; við tengjum þær við
Lifeline-aðganginn þinn.

8. VARÐVEISLA
- Virkir aðgangar: við varðveitum gögnin þín svo lengi sem þú notar Lifeline.
- Eyðing aðgangs: persónugreinanlegar upplýsingar eru eytt innan 30 daga
  frá ósk þinni, nema þar sem varðveisla er áskilin samkvæmt íslenskum lögum.
- Óvirk B2B-boð: ónotuð boð eru eytt eftir 12 mánuði.
- Skráningar (audit log): geymdar í 24 mánuði vegna öryggis og
  regluverkstilgangs.
- Ópersónugreinanleg samanteknu gögn: geta verið geymd ótímabundið þar sem
  þau bera ekki lengur kennsl á þig.

9. ÖRYGGISRÁÐSTAFANIR
- TLS-dulkóðun á flutningi; gagnagrunnur hjá Supabase með
  geymsludulkóðun á diskstigi.
- Hlutverkaskipt aðgangsstjórnun með Row-Level Security; sérgreinaskipt
  aðgreining á milli þjálfara, lækna og admin.
- Audit-skráning á öllum skrifum á heilsuviðkvæmar töflur (clients,
  messages, weight log, body composition events).
- Ársfjórðungsleg endurskoðun aðgangs starfsfólks — heimildir hvers
  starfsmanns yfirfarnar á 90 daga fresti.
- Lyklar þjónustureikninga geymdir í lykilageymi, aldrei í kóðagrunni.
- MFA (TOTP, AAL2) krafist í hverri lotu Lifeline-starfsfólks áður en
  aðgangur að admin er veittur.
- Sentry-hreinsun fjarlægir beiðnabolta á heilsuleiðum til að villuvöktun
  geti ekki lekið 9. gr. gögnum.

Engin kerfi eru fullkomlega örugg. Ef þú telur að aðgangurinn þinn hafi
verið brotinn, hafðu samband við contact@lifelinehealth.is.

10. RÉTTINDI ÞÍN
Samkvæmt íslenskum persónuverndarlögum og GDPR ESB hefur þú rétt á að:
- Fá aðgang að persónuupplýsingum sem við varðveitum um þig.
- Leiðrétta það sem er rangt.
- Eyða gögnum þínum („réttur til að gleymast"), með fyrirvara um
  lögbundna varðveislu.
- Takmarka eða andmæla tiltekinni vinnslu.
- Flytjanleiki — fá gögnin þín á vélrænu, samræmdu sniði.
- Draga samþykki til baka hvenær sem er fyrir markaðsefni eða
  rannsóknarnotkun.
- Leggja fram kvörtun hjá Persónuvernd á www.personuvernd.is.

Til að nýta þessi réttindi sendu tölvupóst á contact@lifelinehealth.is
(persónuverndarpósthólfið okkar) eða sendu beiðni úr aðgangsstillingum
þínum undir „Gögn og persónuvernd". Við svörum innan 30 daga skv. 12.
gr. GDPR. Beiðnir um sjúkraskrárgögn í Medalia eru samræmdar við okkar
sameiginlega ábyrgðaraðila skv. 26. gr. samkomulaginu.

11. KÖKUR OG TÖLFRÆÐI
Við notum aðeins nauðsynlegar kökur til að halda þér innskráðum. Við
notum ekki auglýsingakökur. Sú tölfræði sem við keyrum er
persónuverndarvæn og samanteknu (engin krossvefjandi rakning).

12. BÖRN
Lifeline er ekki ætlað börnum yngri en 18 ára. Ef þú telur að barn hafi
stofnað aðgang skaltu hafa samband og við eyðum honum.

13. B2B (FYRIRTÆKJAAÐLÖGUN) — SÉRTÆK ÁKVÆÐI
Þegar vinnuveitandi þinn aðlagar þig í gegnum Lifeline:
- Lifeline starfar sem vinnsluaðili tengiliðaupplýsinga sem
  vinnuveitandinn lætur okkur í té, og sem ábyrgðaraðili heilsugagna sem
  þú deilir beint með okkur.
- Tengiliður vinnuveitanda þíns sér nafn, netfang, síma og síðustu
  fjóra stafi kennitölu — EKKI líkamssamsetningu, mælingar eða nein
  klínísk gögn.
- Vinnuveitandi þinn fær einungis stöðu aðlögunar — ekkert klínískt.
- Ef þú hættir hjá fyrirtækinu helst Lifeline-aðgangurinn þinn áfram
  þinn. Þú ákveður hvort þú heldur honum.

14. ALÞJÓÐLEGIR FLUTNINGAR
Gögnin þín eru fyrst og fremst hýst innan ESS. Sumir vinnsluaðilar
okkar (t.d. Resend) starfa í Bandaríkjunum samkvæmt stöðluðum
samningsákvæðum ESB. Við flytjum ekki gögn til lögsagna án
fullnægjandi verndar.

15. SJÁLFVIRK ÁKVARÐANATAKA
Lifeline tekur ekki ákvarðanir með laga- eða sambærilega marktækum
áhrifum eingöngu á grundvelli sjálfvirkrar vinnslu. Allar klínískt
viðamiklar ákvarðanir fela í sér löggiltan Lifeline-lækni.

16. BREYTINGAR Á ÞESSARI YFIRLÝSINGU
Við tilkynnum þér um efnislegar breytingar a.m.k. 14 dögum áður en þær
taka gildi, með tölvupósti eða í appinu. Núverandi útgáfa er ávallt á
lifelinehealth.is/privacy.

17. SAMBAND
Spurningar, áhyggjur eða beiðnir um persónugögnin þín:
contact@lifelinehealth.is.

— Lifeline Health ehf. · Reykjavík, Ísland`;
  }
  return `LIFELINE HEALTH — PRIVACY POLICY
Version ${PUBLIC_PRIVACY_VERSION}  ·  Last updated ${PUBLIC_PRIVACY_LAST_UPDATED}

This policy explains what personal data Lifeline Health ehf. ("Lifeline",
"we", "our") collects about you, why we collect it, how we use it, who
we share it with, how long we keep it, and the rights you have over it.
It sits alongside our Terms of Service — if anything here conflicts,
this document wins for privacy matters.

1. WHO CONTROLS YOUR DATA
Lifeline Health ehf., an Icelandic company (Reykjavík), is the data
controller for your personal data. For questions or requests, email
contact@lifelinehealth.is.

2. CATEGORIES OF DATA WE COLLECT
- Identity & contact: name, kennitala, email, phone number, address.
- Account: password (stored as a salted hash, never in plain text),
  login history, device + IP at session level.
- Health profile: date of birth, sex, height, weight, activity level,
  health goals, medical history you choose to share.
- Measurements: body-composition results (fat %, muscle mass, phase
  angle, BMR, body water, etc.) from our measurement partner Biody.
- Usage: meals logged, weigh-ins, program progress, app interactions,
  messages exchanged with Lifeline coaches.
- Business onboarding (B2B only): the company you belong to and
  onboarding completion status.

3. HOW WE COLLECT IT
- Directly from you when you register, complete assessments, or use
  the app.
- From your employer (B2B only) who provides your name, kennitala,
  email and phone before inviting you — you then complete the rest
  yourself.
- From Biody Manager when you attend a body-composition scan at one
  of our partner clinics.
- Automatically via the app (e.g. your phone's timezone, device type
  for support).

4. WHY WE USE IT (LEGAL BASIS)
- Performance of a contract (GDPR Art. 6(1)(b)). Providing the service
  you signed up for — assessments, reports, coaching, body composition
  tracking.
- Explicit consent for special-category data (Art. 9(2)(a)). Health
  data is only processed once you have agreed to our terms during
  onboarding.
- Legitimate interests (Art. 6(1)(f)). Fraud prevention, debugging
  errors, and secure operation of our platform.
- Consent (Art. 6(1)(a)). Marketing emails and use of anonymised data
  for research — both opt-in; you can withdraw consent at any time.
- Legal obligation (Art. 6(1)(c)). Where Icelandic health law, tax law,
  or court orders require retention or disclosure.

5. HOW WE STORE YOUR KENNITALA
Kennitala is considered sensitive personal data under Icelandic law.
We follow the principle of data minimisation: only the last four digits
are stored in our database, and only for the limited purposes of
identifying employee rosters in B2B onboarding and matching duplicates.
We do not store, decrypt, or transmit your full kennitala — neither to
staff nor to any third party. If a future regulatory or clinical process
requires it, that process will live inside Medalia (the licensed
sjúkraskrár-system) where access is logged under Icelandic law nr.
55/2009 §14, not in this app.

6. WHO WE SHARE YOUR DATA WITH
  Recipient                       | Purpose                                                                                                   | Location
  Medalia ehf.                     | Licensed health record system (sjúkraskrá) per Lög 55/2009 — joint controller with Lifeline (GDPR Art. 26) | Iceland
  Supabase Inc.                    | Database, authentication, operational data                                                                 | EU (Frankfurt)
  Vercel Inc.                      | Web hosting, delivery                                                                                      | EU + US (with SCCs)
  Resend (Lilo Labs Inc.)          | Transactional email delivery                                                                               | EU + US (with SCCs)
  Biody Manager (Aminogram SAS)    | Body-composition measurement partner                                                                       | EU (France)
  Your employer (B2B only)         | Onboarding completion status — no health data                                                              | Iceland
  Icelandic authorities            | Where legally required (court order, health law)                                                           | Iceland

We never sell personal data. All processors are bound by GDPR-compliant
data processing agreements. Transfers outside the EEA rely on EU
Standard Contractual Clauses.

6a. WHERE YOUR HEALTH RECORD LIVES
Lifeline operates as a licensed healthcare service (heilbrigðisþjónusta)
under Icelandic law nr. 40/2007. Your formal medical record (sjúkraskrá)
— including clinical interpretations, blood-test results, doctor's
notes, and finalised health-assessment outcomes — is held in Medalia
ehf., a sjúkraskrár-system licensed under Icelandic law nr. 55/2009.
Lifeline and Medalia act as joint controllers for that record under
GDPR Art. 26.

The Lifeline app and admin console are operational tools (scheduling,
programs, coaching, self-tracking) — not your medical record. Body-
composition values from Biody scans are entered into Medalia by a
clinician as part of your assessment; a copy is also shown in your
Lifeline dashboard for your own self-tracking, with your explicit
consent and only visible to you.

7. WHAT WE SHARE WITH BIODY MANAGER
To register you as a patient on the measurement device, we send Biody
your name, email, date of birth (derived from your kennitala), sex,
height, and activity level. We do NOT send your kennitala or your
Lifeline account password. Biody stores the measurement data and
returns it to us; we link it to your Lifeline account.

8. RETENTION
- Active accounts: we keep your data for as long as you use Lifeline.
- Account deletion: personally identifying information is deleted
  within 30 days of your request, except where retention is required
  by Icelandic law.
- Inactive B2B invitations: unused invitations are deleted after 12
  months.
- Audit logs: kept for 24 months for security and regulatory purposes.
- Anonymised aggregates: may be kept indefinitely as they no longer
  identify you.

9. SECURITY MEASURES
- TLS encryption in transit; database hosted on Supabase with at-rest
  encryption at the storage layer.
- Role-based access control via Row-Level Security; specialty-based
  separation between coaches, clinicians, and admins.
- Audit logging on every write to health-sensitive tables (clients,
  messages, weight log, body composition events).
- Quarterly staff access review — every team member's permissions are
  revisited every 90 days.
- Service-role credentials stored in a secrets manager, never in
  source code.
- MFA (TOTP, AAL2) required for every Lifeline staff session before
  admin access is granted.
- Sentry redaction strips request bodies on health-related routes so
  error monitoring cannot leak Art. 9 data.

No system is perfectly secure. If you believe your account has been
compromised, contact contact@lifelinehealth.is.

10. YOUR RIGHTS
Under the Icelandic Data Protection Act and the EU GDPR you have the
right to:
- Access the personal data we hold about you.
- Correct anything that is wrong.
- Delete your data (the "right to be forgotten"), subject to legal
  retention.
- Restrict or object to certain processing.
- Portability — receive your data in a structured, machine-readable
  format.
- Withdraw consent at any time for marketing or research use.
- Lodge a complaint with the Icelandic Data Protection Authority
  (Persónuvernd) at www.personuvernd.is.

To exercise any of these rights, email contact@lifelinehealth.is (our
data protection inbox) or submit a request from your account settings
under Data & privacy. We respond within 30 days per GDPR Art. 12.
Health record requests that need data held in Medalia are coordinated
with our joint-controller per the Art. 26 arrangement.

11. COOKIES & ANALYTICS
We use strictly necessary cookies to keep you signed in. We do not use
advertising cookies. Any analytics we run is privacy-preserving and
aggregate (no cross-site tracking).

12. CHILDREN
Lifeline is not intended for children under 18. If you believe a child
has created an account, contact us and we will delete it.

13. B2B (COMPANY ONBOARDING) SPECIFICS
When your employer onboards you through Lifeline:
- Lifeline acts as a data processor for the contact details your
  employer provides, and as a data controller for the health data you
  share directly with us.
- Your employer's contact person can see your name, email, phone, and
  the last four digits of your kennitala — NOT your body composition,
  measurements, or any clinical data.
- Your employer receives only onboarding completion status — nothing
  clinical.
- If you leave the company, your Lifeline account remains yours. You
  decide whether to keep it.

14. INTERNATIONAL TRANSFERS
Your data is primarily hosted in the EU. Some of our processors (e.g.
Resend) operate in the US under EU Standard Contractual Clauses. We do
not transfer data to jurisdictions without adequate protections.

15. AUTOMATED DECISION-MAKING
Lifeline does not make decisions with legal or similarly significant
effects based solely on automated processing. All clinically relevant
decisions involve a qualified Lifeline physician.

16. CHANGES TO THIS POLICY
We will notify you of material changes at least 14 days before they
take effect, by email or in-app. The current version is always at
lifelinehealth.is/privacy.

17. CONTACT
Questions, concerns, or requests about your personal data:
contact@lifelinehealth.is.

— Lifeline Health ehf. · Reykjavík, Iceland`;
}

export function renderPublicTermsOfService(language: DocumentLanguage = "en"): string {
  if (language === "is") {
    return `LIFELINE HEALTH — NOTKUNARSKILMÁLAR OG PERSÓNUVERND (OPINBER ÚTGÁFA)
Útgáfa ${PUBLIC_TERMS_VERSION}  ·  Síðast uppfært ${PUBLIC_TERMS_LAST_UPDATED}

Þessi síða nær yfir skilmála sem Lifeline Health ehf. („Lifeline", „við")
veitir þjónustu sína undir, og hvernig við förum með persónuupplýsingar
einstakra notenda („þú") og fyrirtækjaviðskiptavina. Hún er rituð á
einföldu máli. Formleg þýðing á íslensku er fáanleg eftir beiðni.

1. HVER VIÐ ERUM
Lifeline Health ehf. er íslenskt félag sem veitir stafræna heilsuþjálfun,
líkamssamsetningareftirlit og fjarheilbrigðisþjónustu í gegnum vefinn
lifelinehealth.is og Lifeline-snjallforritið.

2. ÞJÓNUSTA SEM VIÐ VEITUM
- Heilsumat, áætlanir og þjálfun veitt af löggiltu Lifeline-starfsfólki.
- Líkamssamsetningarmælingar framkvæmdar í samstarfsstofum með Biody
  Manager mælitækinu, og gerðar aðgengilegar þér rafrænt.
- Valfrjáls skráning í appi (máltíðir, vigtanir, venjur) og samfélagsvirkni.
- Fyrir fyrirtækjaviðskiptavini: aðlögun starfsfólks og samanteknu
  skýrslur.

3. AÐGANGURINN ÞINN
Til að nota Lifeline þarftu að stofna aðgang. Þú berð ábyrgð á að halda
lykilorði þínu öruggu og á virkni á aðganginum þínum. Þú þarft að vera
a.m.k. 18 ára, eða með leyfi forráðamanns, til að skrá þig.

4. PERSÓNUUPPLÝSINGAR SEM VIÐ SÖFNUM
Þegar þú skráir þig beint söfnum við:
- Nafni, netfangi, símanúmeri
- Fæðingardegi, kyni, hæð, þyngd, virknistigi
- Heilsumarkmiðum sem þú velur að deila
- Líkamssamsetningarmælingum, ef þú heimsækir samstarfsstofu
- Máltíðum, vigtunum, framvindu áætlana, og skilaboðum ef þú notar þá
  virkni

Ef þú gengur í gegnum aðlögun frá fyrirtækjaviðskiptavini (vinnuveitanda
þínum), gefur tengiliður fyrirtækisins okkur nafn þitt, kennitölu,
netfang og síma áður en þér er boðið. Þú fyllir svo inn restina sjálf(ur)
í aðlögunarferlinu. Lifeline deilir aldrei heilsugögnum þínum aftur til
vinnuveitanda þíns — aðeins stöðu aðlögunar.

5. HVERNIG VIÐ GEYMUM KENNITÖLU ÞÍNA
Kennitala þín er dulkóðuð í geymslu með stöðluðum samhverfu-dulkóðunar
aðferðum. Dulkóðunarlykillinn er stjórnaður aðskilið frá gagnagrunninum.
Aðeins þröngur hópur þjónustuferla — ekki einstaklingar — getur óskað
eftir afkóðun, og hver afkóðun er skráð. Lifeline-starfsfólk sem þarf
að bera kennsl á þig í stuðningssamhengi sér aðeins síðustu fjóra stafi
sjálfgefið.

6. HVAÐ VIÐ NOTUM GÖGNIN ÞÍN TIL
- Rekstur þjónustunnar. Að veita þá virkni sem þú baðst um.
- Öryggi og gæði. Að greina misnotkun, koma í veg fyrir svik, leiðrétta
  villur.
- Rannsóknir (opt-out). Við getum notað ópersónugreinanlegar útgáfur af
  gögnum þínum til að bæta Lifeline og fyrir ópersónugreinanlegar klínískar
  rannsóknir. Þú getur valið frá í aðlögun eða hvenær sem er úr
  aðgangsstillingum.
- Markaðsstarf (opt-out). Áviðunarvarnar uppfærslur og kynningar með
  tölvupósti. Þú getur valið frá í aðlögun, úr hvaða pósti sem er, eða úr
  aðgangsstillingum.

7. HVERJUM VIÐ MIÐLUM GÖGNUM
- Medalia ehf. — löggilt sjúkraskrárkerfi (lög nr. 55/2009) þar sem
  formleg sjúkraskrá þín er varðveitt. Lifeline og Medalia starfa sem
  sameiginlegir ábyrgðaraðilar fyrir sjúkraskrárgögn skv. 26. gr. GDPR.
- Biody Manager (mælingafélagi okkar fyrir líkamssamsetningu). Við
  deilum nafni, netfangi, fæðingardegi, kyni, hæð og virknistigi til að
  skrá þig sem sjúkling. Við sendum ekki kennitölu þína til Biody.
  Lifeline geymir aðeins síðustu fjóra stafi kennitölu þinnar
  (lágmörkun); við geymum ekki fulla kennitölu.
- Supabase (gagnagrunns- og auðkenningaraðilinn okkar) og Vercel
  (vefhýsingaraðilinn okkar), undir GDPR-samhæfðum vinnslusamningum.
- Resend (tölvupóstþjónusta okkar fyrir sjálfvirkan póst), sem afhendir
  boðspóst og tilkynningar.
- Íslensk heilbrigðis- og lögregluyfirvöld, ef lög krefjast.

Við seljum aldrei persónuupplýsingar þínar.

8. HVE LENGI VIÐ VARÐVEITUM GÖGNIN ÞÍN
Við varðveitum aðganginn þinn og tengd heilsugögn meðan aðgangurinn er
virkur. Ef þú eyðir aðganginum þínum eyðum við persónugreinanlegum
upplýsingum innan 30 daga, nema þar sem varðveisla er áskilin samkvæmt
íslenskum heilbrigðislögum. Ópersónugreinanlegar samanteknu upplýsingar
má geyma ótímabundið.

9. RÉTTINDI ÞÍN
Samkvæmt íslenskum persónuverndarlögum og GDPR ESB hefur þú rétt á að
fá aðgang að, leiðrétta, flytja, takmarka eða eyða persónuupplýsingum
þínum. Sendu tölvupóst á contact@lifelinehealth.is og við svörum innan
30 daga. Þú hefur einnig rétt á að leggja fram kvörtun hjá Persónuvernd
á www.personuvernd.is.

10. ÖRYGGI
Lifeline notar TLS fyrir gögn á flutningi, dulkóðun á viðkvæmum
dálkum í geymslu, hlutverkaskipta aðgangsstjórnun og audit-skráningu.
Engin kerfi eru fullkomin — ef þú telur að aðgangurinn þinn hafi verið
brotinn, hafðu samband við contact@lifelinehealth.is.

11. FYRIR FYRIRTÆKJAVIÐSKIPTAVINI (B2B)
Ef fyrirtækið þitt aðlagar starfsmenn í gegnum Lifeline gildir
eftirfarandi til viðbótar:
- Lifeline starfar sem vinnsluaðili fyrir heilsugögn sem starfsmenn
  velja að deila, og sem ábyrgðaraðili fyrir kerfisrekstur.
- Tengiliður fyrirtækisins þíns sér starfsmannalistann (nafn, netfang,
  síma, síðustu 4 stafi kennitölu) og stöðu aðlögunar — EKKI heilsugögn.
- Útflutningur á fullum kennitölum er aðeins aðgengilegur
  Lifeline-starfsfólki, vegna úttekta og regluverkstilgangs.
- Fyrirtækið þitt staðfestir að það hafi lögmætan grundvöll
  (ráðningarsamning, atvinnuheilbrigðisáætlun eða samþykki starfsmanns)
  til að deila tengiliðaupplýsingum starfsmanns með Lifeline.
- Lifeline mun eyða starfsmannafærslum eftir skriflegri beiðni þinni,
  nema þar sem varðveisla er lagaskylt.

12. GREIÐSLUR OG ÁSKRIFTIR
Kaup neytenda — stök heilsumatskaup og áskrift að Lifeline appinu —
falla undir sérstaka söluskilmála (Söluskilmálar) sem birtir eru á
lifelinehealth.is/soluskilmalar og lifelinehealth.is/sales-terms (EN).
Þar er kveðið nánar á um verðlagningu, sjálfvirka endurnýjun, 14 daga
afturköllunarrétt, endurgreiðslur og hlutverk greiðslumiðlara okkar.
Íslenska útgáfan er hin bindandi.

Fyrir B2B-viðskiptavini gildir aðskilinn þjónustusamningur og þeir
notendaskilmálar sem fyrirtækið hefur samþykkt.

13. LÆKNISFRÆÐILEGUR FYRIRVARI
Lifeline er heilsuþjálfunar- og velferðarþjónusta, ekki staðgöngull
löggilts læknis. Ráðfærðu þig alltaf við löggiltan heilbrigðisstarfsmann
áður en þú breytir lyfjameðferð, langvinnri sjúkdómastjórnun eða ef þú
ert ófrísk(ur), að gefa brjóst eða með heilsufarsástand. Í neyðartilfelli
hringdu í 112.

14. BREYTINGAR Á ÞESSUM SKILMÁLUM
Við getum uppfært þetta skjal stundum. Efnislegar breytingar verða
tilkynntar þér með tölvupósti eða í appinu a.m.k. 14 dögum áður en þær
taka gildi. Núverandi útgáfa er alltaf fáanleg á
lifelinehealth.is/terms.

15. LÖGSAGA
Þessir skilmálar eru stjórnað af íslenskum lögum. Deilur falla undir
einkarétt dómstóla Reykjavíkur, nema neytendaverndarlög kveði annað á.

16. SAMBAND
- Almennt: contact@lifelinehealth.is
- Persónuvernd: contact@lifelinehealth.is
- Öryggi: contact@lifelinehealth.is

— Lifeline Health ehf. · Reykjavík, Ísland`;
  }
  return `LIFELINE HEALTH — TERMS OF SERVICE & PRIVACY POLICY (PUBLIC)
Version ${PUBLIC_TERMS_VERSION}  ·  Last updated ${PUBLIC_TERMS_LAST_UPDATED}

This page covers the terms under which Lifeline Health ehf. ("Lifeline",
"we", "our") provides its services, and how we handle personal data
about individual users ("you") and business customers. It is written
in plain language. A formal Icelandic translation is available on
request.

1. WHO WE ARE
Lifeline Health ehf. is an Icelandic company providing digital health
coaching, body composition tracking, and telemedicine services through
the website lifelinehealth.is and the Lifeline mobile app.

2. SERVICES WE PROVIDE
- Health assessments, programs, and coaching delivered by licensed
  Lifeline staff.
- Body composition measurements performed at partner clinics using the
  Biody Manager device, and made available to you digitally.
- Optional in-app tracking (meals, weigh-ins, habits) and community
  features.
- For business customers: employee onboarding and aggregate reporting.

3. YOUR ACCOUNT
To use Lifeline you must create an account. You're responsible for
keeping your password safe and for activity on your account. You must
be at least 18 years old, or have parental consent, to register.

4. PERSONAL DATA WE COLLECT
When you register directly, we collect:
- Name, email, phone number
- Date of birth, sex, height, weight, activity level
- Health goals you choose to share
- Body composition measurements, if you visit a partner clinic
- Meal logs, weigh-ins, program progress, and messages if you use those
  features

If you onboard through a business customer (your employer), the contact
person at your company provides us your name, kennitala, email, and
phone before inviting you. You then fill in the remaining fields
yourself during onboarding. Lifeline never shares your health data
back to your employer — only onboarding completion status.

5. HOW WE STORE YOUR KENNITALA
Your kennitala is encrypted at rest using industry-standard symmetric
encryption. The encryption key is managed separately from the database.
Only a narrow set of server processes — not individuals — can request
a decryption, and every decryption is logged. Lifeline staff who need
to identify you in a support context see only the last four digits by
default.

6. WHAT WE USE YOUR DATA FOR
- Service operation. Providing the features you requested.
- Safety & quality. Detecting abuse, preventing fraud, debugging
  errors.
- Research (opt-out). We may use non-identifiable versions of your
  data to improve Lifeline and for anonymised clinical research. You
  can opt out during onboarding or at any time from your account
  settings.
- Marketing (opt-out). Occasional product updates and promotions by
  email. You can opt out during onboarding, from any email, or from
  account settings.

7. WHO WE SHARE DATA WITH
- Medalia ehf. — licensed sjúkraskrár-system (Icelandic law nr. 55/2009)
  where your formal medical record is held. Lifeline and Medalia act
  as joint controllers for health-record data under GDPR Art. 26.
- Biody Manager (our body composition measurement partner). We share
  name, email, date of birth, sex, height, and activity level to
  register you as a patient. We do not send your kennitala to Biody.
  Lifeline only stores the last four digits of your kennitala (data
  minimisation); we do not store the full number.
- Supabase (our database and authentication provider) and Vercel (our
  web hosting provider), under GDPR-compliant data processing
  agreements.
- Resend (our transactional email provider), which delivers
  invitations and notifications.
- Icelandic health authorities and law enforcement, if legally
  required.

We never sell your personal data.

8. HOW LONG WE KEEP YOUR DATA
We keep your account and related health data while your account is
active. If you delete your account, we delete personally identifying
information within 30 days, except where retention is required by
Icelandic health law. Anonymised aggregates may be kept indefinitely.

9. YOUR RIGHTS
Under the Icelandic Data Protection Act and the EU GDPR you have the
right to access, correct, export, restrict, or delete your personal
data. Email contact@lifelinehealth.is and we will respond within 30
days. You also have the right to lodge a complaint with the Icelandic
Data Protection Authority (Persónuvernd) at www.personuvernd.is.

10. SECURITY
Lifeline uses TLS for data in transit, encryption at rest for sensitive
fields, role-based access controls, and audit logging. No system is
perfect — if you believe your account has been compromised, contact
contact@lifelinehealth.is.

11. FOR BUSINESS CUSTOMERS (B2B)
If your organisation onboards employees through Lifeline, the following
applies in addition:
- Lifeline acts as a data processor for health data that employees
  choose to share, and as a data controller for platform operations.
- The contact person at your company can see the employee roster
  (name, email, phone, kennitala last-4) and onboarding completion
  status — NOT health data.
- A full kennitala export is available to Lifeline staff only, for
  audit and regulatory purposes.
- Your organisation represents that it has a lawful basis (employment
  contract, occupational-health programme, or employee consent) to
  share employee contact information with Lifeline.
- Lifeline will delete employee records at your written request,
  except where retention is legally required.

12. PAYMENT AND SUBSCRIPTIONS
Consumer purchases — one-off health assessments and Lifeline app
subscriptions — are governed by the dedicated Sales & Subscription
Terms published at lifelinehealth.is/sales-terms (and the legally
binding Icelandic original at lifelinehealth.is/soluskilmalar). Those
terms set out pricing, auto-renewal, the 14-day right of withdrawal,
refunds and the role of our payment processor.

For B2B customers, billing is governed by your separate service
agreement and the platform terms accepted by your organisation.

13. MEDICAL DISCLAIMER
Lifeline is a health coaching and wellness service, not a substitute
for a licensed physician. Always consult a qualified clinician before
making changes to medications, chronic-disease management, or if you
are pregnant, nursing, or have a medical condition. In an emergency,
call 112.

14. CHANGES TO THESE TERMS
We may update this document occasionally. Material changes will be
notified to you by email or in-app at least 14 days before they take
effect. The current version is always available at
lifelinehealth.is/terms.

15. GOVERNING LAW
These terms are governed by Icelandic law. Disputes are subject to the
exclusive jurisdiction of the courts of Reykjavík, unless consumer
protection law provides otherwise.

16. CONTACT
- General: contact@lifelinehealth.is
- Privacy: contact@lifelinehealth.is
- Security: contact@lifelinehealth.is

— Lifeline Health ehf. · Reykjavík, Iceland`;
}

export function renderPublicSalesTerms(language: DocumentLanguage = "is"): string {
  if (language === "is") {
    return `LIFELINE HEALTH — SÖLUSKILMÁLAR
Heilsumat og áskrift að Lifeline appinu
Útgáfa ${PUBLIC_SALES_TERMS_VERSION}  ·  Síðast uppfært ${PUBLIC_SALES_TERMS_LAST_UPDATED}
Birt á: lifelinehealth.is/soluskilmalar

Söluskilmálar þessir gilda um kaup einstaklinga (hér eftir „neytandi"
eða „þú") á þjónustum Lifeline Health ehf. í gegnum lifelinehealth.is
og Lifeline snjallforritið. Skilmálarnir bætast við og takmarka ekki
almenna notkunarskilmála og persónuverndaryfirlýsingu Lifeline
(lifelinehealth.is/terms). Komi til ósamræmis gilda söluskilmálar
þessir um öll atriði er varða greiðslur, áskrift og endurgreiðslur.

1. SELJANDI OG REKSTRARFYRIRKOMULAG

   1.1 Seljandi þjónustanna, eins og rekstrinum er háttað í dag, er:
   - Lifeline Health ehf.
   - Kennitala: 590925-1440
   - Lögheimili: Langholtsvegi 111, 104 Reykjavík
   - Netfang: contact@lifelinehealth.is
   - Vefsíða: lifelinehealth.is

   Lifeline Health ehf. starfar sem heilbrigðisstofnun samkvæmt lögum nr.
   40/2007 um heilbrigðisþjónustu og er skráð sem slík hjá Embætti
   landlæknis.

   1.2 Lifeline Health ehf. vinnur að stofnun sérstaks dótturfélags sem
   mun reka heilsuþjálfun og lífsstílsráðgjöf (áskriftarþjónustuna sem
   lýst er í gr. 3.2) sem sjálfstæða einingu. Tilgangurinn er að halda
   heilbrigðisstarfsleyfi Lifeline Health skýrt aðgreindu frá þeirri
   starfsemi sem ekki fellur undir heilbrigðisþjónustu samkvæmt lögum
   nr. 40/2007. Þar til dótturfélagið hefur starfsemi er Lifeline Health
   ehf. seljandi beggja þjónusta sem taldar eru í gr. 3. Skilmálum
   þessum verður breytt með að lágmarki 30 daga fyrirvara þegar
   dótturfélagið tekur við sölu áskriftarþjónustunnar.

2. GILDISSVIÐ OG SAMÞYKKI
   Með því að ljúka greiðslu á vefsíðu Lifeline eða innan Lifeline
   snjallforritsins staðfestir neytandi að hann hafi lesið, skilji og
   samþykki skilmála þessa. Þjónustan er einungis seld einstaklingum 18
   ára og eldri sem hafa lögheimili á Íslandi eða innan EES.

3. ÞJÓNUSTUR SEM Í BOÐI ERU

   3.1 Heilsumat (stök kaup) — heilbrigðisþjónusta
   Heildstætt klínískt heilsumat sem felur í sér spurningalista,
   lífsstílsmat, líkamssamsetningarmælingu á samstarfsstöð,
   rannsóknarniðurstöður þar sem við á, og túlkun læknis á vegum Lifeline
   Health ehf. Heilsumat er heilbrigðisþjónusta í skilningi laga nr.
   40/2007 og er veitt af Lifeline Health ehf. samkvæmt starfsleyfi þess
   félags. Verðlagt sem stök kaup og afhent stafrænt í aðgangi neytanda í
   snjallforritinu og á vef.

   3.2 Áskrift að Lifeline appinu — heilsuþjálfun og lífsstílsráðgjöf
   Áframhaldandi aðgangur að persónulegri heilsuþjálfun, daglegri
   leiðsögn, næringaráætlunum, eftirfylgni og samskiptum við
   heilsuráðgjafa Lifeline. Áskriftarþjónustan er heilsu- og
   lífsstílsráðgjöf og er ekki heilbrigðisþjónusta í skilningi laga nr.
   40/2007 — hún kemur ekki í stað læknisþjónustu, klínískrar greiningar
   eða meðferðar. Áskrift er seld í mánaðarlegum eða árlegum tímabilum
   eins og fram kemur á söluskjá. Eins og fram kemur í gr. 1.2 mun
   rekstur þessarar þjónustu færast yfir til dótturfélags Lifeline Health
   þegar það félag tekur til starfa.

   Nákvæmt verð, innifaldir eiginleikar og tímabil eru ávallt birt á
   söluskjá áður en greiðsla er staðfest.

4. VERÐ, MYNT OG VIRÐISAUKASKATTUR
   Öll verð eru birt í íslenskum krónum (ISK). Heilbrigðisþjónusta
   Lifeline Health er undanþegin virðisaukaskatti samkvæmt 2. mgr. 2.
   gr. laga nr. 50/1988 um virðisaukaskatt, og því er ENGINN VSK lagður
   á verð heilsumats eða áskriftar að heilsuþjálfun.

   Lifeline áskilur sér rétt til að breyta verðlagi. Verðbreytingar
   gilda ekki um þegar greiddar þjónustur eða yfirstandandi
   áskriftartímabil. Breytingar á verði áskriftar eru tilkynntar með
   að lágmarki 30 daga fyrirvara í tölvupósti eða í forritinu áður en
   næsta endurnýjun á sér stað.

5. GREIÐSLUR OG GREIÐSLUMIÐLUN
   Greiðslur með greiðslukortum (Visa, Mastercard) eru meðhöndlaðar af
   samstarfsaðila okkar í greiðslumiðlun, Straumur greiðslumiðlun ehf.
   Lifeline geymir aldrei númer greiðslukorts á eigin þjónum. Aðeins
   eru geymdar dulkóðaðar tilvísanir („token") sem nauðsynlegar eru
   fyrir áskriftarendurnýjun.

   Greiðsla er heimiluð á greiðslustundu og bókuð þegar þjónustan er
   afhent eða áskriftartímabilið hefst. Reikningur er sendur í
   tölvupósti eftir hverja heppnaða greiðslu og er einnig aðgengilegur
   í aðgangi neytanda.

6. ÁSKRIFT, SJÁLFVIRK ENDURNÝJUN OG UPPSÖGN
   Áskrift endurnýjast sjálfkrafa við lok hvers tímabils á þágildandi
   verði þar til neytandi segir henni upp. Áminning um komandi
   endurnýjun árlegrar áskriftar er send í tölvupósti með að lágmarki
   7 daga fyrirvara.

   Neytandi getur sagt áskrift upp hvenær sem er án skýringa í gegnum
   stillingar í forritinu, á lifelinehealth.is/account eða með
   tölvupósti á contact@lifelinehealth.is. Uppsögn tekur gildi við lok
   yfirstandandi greidds tímabils — aðgangur helst óbreyttur til þess
   tíma. Hlutfallsleg endurgreiðsla á ónotuðum hluta tímabils er ekki
   veitt nema lög kveði á um annað.

7. AFHENDING ÞJÓNUSTU
   Stafræn þjónusta hefst um leið og greiðsla er staðfest:
   - Heilsumat (stök kaup): aðgangur að bókunarflæði og spurningalista
     opnast strax. Líkamssamsetningarmæling fer fram á samstarfsstöð á
     þeim tíma sem neytandi bókar.
   - Áskrift: fullur aðgangur að áskriftareiginleikum opnast strax og
     áskriftartímabilið hefst á greiðsludegi.

8. RÉTTUR TIL AÐ FALLA FRÁ SAMNINGI (14 DAGA AFTURKÖLLUNARRÉTTUR)
   Samkvæmt lögum nr. 16/2016 um neytendasamninga hefur neytandi að
   jafnaði 14 daga frest til að falla frá samningi sem gerður er með
   fjarsölu, án skýringa, frá og með þeim degi sem samningur var gerður.

   MIKILVÆG UNDANTEKNING FYRIR STAFRÆNA HEILBRIGÐISÞJÓNUSTU: Þar sem
   þjónustur Lifeline eru afhentar stafrænt strax eftir greiðslu og að
   beiðni neytanda, þá samþykkir neytandi á söluskjá:
   (a) að óska eftir því að afhending þjónustunnar hefjist INNAN 14
       daga afturköllunarfrestsins; og
   (b) að hann staðfesti að rétturinn til að falla frá samningi FALLI
       NIÐUR um leið og þjónustan hefur að fullu verið innt af hendi
       (sbr. d-lið 1. mgr. 18. gr. laga nr. 16/2016).

   Í reynd þýðir þetta:
   - Heilsumat (stök kaup): neytandi getur fallið frá samningi án
     skýringa þar til mat hefur farið fram. Eftir að mat hefur að fullu
     verið innt af hendi fellur afturköllunarrétturinn niður. Hafi
     neytandi þegar nýtt sér hluta þjónustunnar áður en hann fellur frá
     samningi, þá ber honum að greiða hlutfallslega fyrir þann hluta sem
     þegar hefur verið afhentur.
   - Áskrift: neytandi getur fallið frá samningi innan 14 daga frá
     stofnun áskriftar. Hafi áskriftin þegar veitt aðgang að efni er
     heimilt að draga hlutfallslegan kostnað af endurgreiðslunni
     samkvæmt 2. mgr. 21. gr. laga nr. 16/2016. Sjálfvirk endurnýjun
     stofnar ekki nýjan afturköllunarrétt — uppsögn áskriftar fer fram
     skv. gr. 6.

   Til að nýta sér afturköllunarréttinn skal neytandi senda skýra
   yfirlýsingu þar að lútandi á contact@lifelinehealth.is fyrir lok
   frestsins. Eyðublað fyrir afturköllun má finna í viðauka I við lög
   nr. 16/2016.

9. ENDURGREIÐSLUR
   Endurgreiðslur sem heimilar eru samkvæmt skilmálum þessum eða
   ófrávíkjanlegum lögum eru lagðar inn á sama greiðslumáta og notaður
   var við upphaflega greiðslu, eigi síðar en innan 14 DAGA frá því að
   beiðni telst gild. Engin umsýslugjöld eru lögð á endurgreiðslur.

10. MISTEKIST GREIÐSLA OG ENDURNÝJUN
    Mistakist sjálfvirk endurnýjun (t.d. vegna útrunnins korts eða
    ófullnægjandi innstæðu) reynir Lifeline aftur að innheimta í allt
    að 7 daga og lætur neytanda vita í tölvupósti. Hafi greiðsla ekki
    borist innan þess tíma stöðvast aðgangur að áskriftareiginleikum
    sjálfkrafa. Aðgangur er endurvirkjaður um leið og greiðsla berst.

11. ENDURGREIÐSLUKRÖFUR (CHARGEBACK) OG UMDEILDAR GREIÐSLUR
    Telji neytandi sig hafa verið ranglega rukkaðan er hann beðinn um
    að hafa samband beint við Lifeline á contact@lifelinehealth.is áður
    en endurgreiðslukrafa er lögð fram hjá útgáfubanka. Þetta auðveldar
    skjóta og rétta úrlausn. Lifeline svarar slíkum erindum innan 5
    virkra daga.

12. LÆKNISFRÆÐILEGUR FYRIRVARI
    Heilsumat (gr. 3.1) er heilbrigðisþjónusta og kemur ekki í stað
    sambands þíns við heimilislækni eða sérfræðing.

    Áskriftarþjónustan (gr. 3.2) er heilsuþjálfun og lífsstílsráðgjöf —
    ekki heilbrigðisþjónusta. Hún er viðbót við, en ekki staðganga,
    læknisfræðilega greiningu og meðferð. Innihald áskriftarinnar skal
    ekki nýtt til að taka klínískar ákvarðanir.

    Í neyðartilfellum skal alltaf hringja í 112. Hætta skal eða breyta
    lyfjameðferð eingöngu í samráði við lækni. Nánari ákvæði um
    ábyrgðartakmarkanir er að finna í almennum notkunarskilmálum
    (lifelinehealth.is/terms).

13. PERSÓNUVERND
    Vinnsla persónuupplýsinga við greiðslu og veitingu þjónustu er
    framkvæmd í samræmi við persónuverndaryfirlýsingu Lifeline
    (lifelinehealth.is/privacy) og lög nr. 90/2018 um persónuvernd og
    vinnslu persónuupplýsinga, ásamt reglugerð (ESB) 2016/679 (GDPR).
    Straumur greiðslumiðlun ehf. starfar sem sjálfstæður ábyrgðaraðili
    um vinnslu greiðsluupplýsinga.

14. KVARTANIR
    Kvartanir varðandi greiðslur, þjónustu eða framkvæmd skilmálanna
    skal senda á contact@lifelinehealth.is. Lifeline svarar formlega
    innan 14 daga frá móttöku. Náist ekki samkomulag getur neytandi
    vísað málinu til:
    - Neytendastofu — www.neytendastofa.is
    - Kærunefndar vöru- og þjónustukaupa —
      www.neytendastofa.is/kaerunefnd-voru-og-thjonustukaupa/
    - Persónuverndar (ef kvörtun varðar meðferð persónuupplýsinga) —
      www.personuvernd.is

15. BREYTINGAR Á SKILMÁLUM
    Lifeline áskilur sér rétt til að uppfæra skilmálana. Verulegar
    breytingar verða tilkynntar í tölvupósti eða innan forritsins með
    að lágmarki 30 daga fyrirvara áður en þær taka gildi. Ávallt gildir
    nýjasta útgáfa sem birt er á lifelinehealth.is/soluskilmalar.

16. LÖGSAGA OG VARNARÞING
    Um skilmála þessa gilda íslensk lög. Rísi ágreiningur skal hann
    rekinn fyrir Héraðsdómi Reykjavíkur, með fyrirvara um ófrávíkjanleg
    ákvæði laga til verndar neytendum, þar með talin réttur neytanda
    til að höfða mál fyrir dómstóli í eigin lögsögu.

17. TENGILIÐUR
    - Almennar fyrirspurnir og kvartanir: contact@lifelinehealth.is
    - Persónuvernd: contact@lifelinehealth.is

— Lifeline Health ehf. · kt. 590925-1440 · Langholtsvegi 111, 104 Reykjavík`;
  }
  return `LIFELINE HEALTH — SALES & SUBSCRIPTION TERMS
Health assessment and Lifeline app subscription
Version ${PUBLIC_SALES_TERMS_VERSION}  ·  Last updated ${PUBLIC_SALES_TERMS_LAST_UPDATED}
Published at: lifelinehealth.is/sales-terms

These sales terms govern consumer purchases (the "consumer", "you") of
Lifeline Health ehf. services through lifelinehealth.is and the Lifeline
mobile app. They supplement, and do not limit, Lifeline's general Terms
of Service and Privacy Policy (lifelinehealth.is/terms). In case of
conflict, these sales terms control for all matters concerning payment,
subscription and refunds. The legally binding version is the Icelandic
original (lifelinehealth.is/soluskilmalar); this English text is
provided for convenience.

1. SELLER AND CORPORATE STRUCTURE

   1.1 The seller of the services described in these terms, as the
   business is operated today, is:
   - Lifeline Health ehf.
   - Reg. no. (kennitala): 590925-1440
   - Registered address: Langholtsvegi 111, 104 Reykjavík, Iceland
   - Email: contact@lifelinehealth.is
   - Website: lifelinehealth.is

   Lifeline Health ehf. is a licensed healthcare provider operating
   under Act no. 40/2007 on Healthcare Services and is registered as
   such with the Directorate of Health (Embætti landlæknis).

   1.2 Lifeline Health ehf. is in the process of incorporating a
   separate daughter company to operate the health-coaching and
   lifestyle-guidance offering (the subscription service described in
   section 3.2) as a standalone entity. The purpose is to keep Lifeline
   Health ehf.'s healthcare operating licence cleanly separated from
   activity that does not constitute regulated healthcare under Act no.
   40/2007. Until that daughter company is operational, Lifeline Health
   ehf. is the seller of both services listed in section 3. These terms
   will be updated with at least 30 days' notice when the daughter
   company assumes responsibility for the subscription service.

2. SCOPE AND ACCEPTANCE
   By completing a payment on the Lifeline website or inside the
   Lifeline app you confirm that you have read, understood and accepted
   these terms. Services are sold only to individuals aged 18 or over
   who reside in Iceland or the EEA.

3. SERVICES OFFERED

   3.1 Health assessment (one-off purchase) — regulated healthcare
   A comprehensive clinical health assessment comprising questionnaires,
   lifestyle evaluation, a body-composition measurement at a partner
   station, laboratory results where applicable, and interpretation by
   a Lifeline Health ehf. physician. The health assessment is regulated
   healthcare (heilbrigðisþjónusta) within the meaning of Act no.
   40/2007, provided by Lifeline Health ehf. under its healthcare
   operating licence. Sold as a one-off purchase and delivered digitally
   inside your account in the app and on the web.

   3.2 Lifeline app subscription — health coaching and lifestyle guidance
   Ongoing access to personalised health coaching, daily guidance,
   nutrition plans, follow-up, and messaging with Lifeline coaches. The
   subscription service is health coaching and lifestyle guidance — it
   does not constitute regulated healthcare under Act no. 40/2007, and
   it does not replace medical care, clinical diagnosis or treatment.
   Subscriptions are sold on monthly or annual billing cycles as shown
   on the checkout screen. As noted in section 1.2, operation of this
   service will transfer to a Lifeline Health daughter company when that
   company becomes operational.

   The exact price, included features and billing period are always
   shown on the checkout screen before payment is confirmed.

4. PRICE, CURRENCY AND VAT
   All prices are displayed in Icelandic króna (ISK). Lifeline Health's
   services qualify as healthcare services exempt from value-added tax
   under Article 2(2) of Act no. 50/1988 on Value Added Tax, and
   therefore NO VAT is added to the price of health assessments or
   health-coaching subscriptions.

   Lifeline reserves the right to change prices. Price changes do not
   apply to services already paid for or to the current billing period
   of an existing subscription. Subscription price changes are notified
   at least 30 days before the next renewal by email or in-app.

5. PAYMENT AND PAYMENT PROCESSING
   Card payments (Visa, Mastercard) are processed by our payment
   partner Straumur greiðslumiðlun ehf. Lifeline never stores full card
   numbers on its servers — only encrypted tokens necessary for
   subscription renewal.

   Payment is authorised at checkout and captured when the service is
   delivered or the subscription period begins. A receipt is sent by
   email after every successful payment and is also available inside
   your account.

6. SUBSCRIPTIONS, AUTO-RENEWAL AND CANCELLATION
   Subscriptions automatically renew at the end of each billing period
   at the then-current price until you cancel. A reminder for upcoming
   renewal of an annual subscription is sent by email at least 7 days
   in advance.

   You may cancel at any time, without reason, through the settings in
   the app, at lifelinehealth.is/account, or by email to
   contact@lifelinehealth.is. Cancellation takes effect at the end of
   the current paid period — your access remains unchanged until then.
   Pro-rated refunds of unused portions of a billing period are not
   provided unless required by mandatory law.

7. DELIVERY OF THE SERVICE
   Digital services begin as soon as payment is confirmed:
   - Health assessment (one-off): the booking flow and questionnaires
     open immediately. The body-composition measurement is performed at
     a partner station at the time you book.
   - Subscription: full access to subscription features opens
     immediately and the subscription period starts on the payment date.

8. RIGHT OF WITHDRAWAL (14-DAY COOLING-OFF)
   Under Act no. 16/2016 on Consumer Contracts the consumer generally
   has 14 days to withdraw from a distance contract, without giving any
   reason, from the date the contract was concluded.

   IMPORTANT EXCEPTION FOR DIGITAL HEALTH SERVICES: because Lifeline's
   services are delivered digitally and immediately at your request,
   you expressly agree on the checkout screen:
   (a) to ask Lifeline to begin performance of the service WITHIN the
       14-day cooling-off period; and
   (b) to acknowledge that your right of withdrawal LAPSES once the
       service has been fully performed (Art. 18(1)(d) of Act no.
       16/2016).

   In practice this means:
   - Health assessment (one-off): you may withdraw without reason until
     the assessment has been performed. Once the assessment has been
     fully performed the right of withdrawal lapses. If you have used
     part of the service before withdrawing you must pay a proportionate
     amount for the portion already delivered.
   - Subscription: you may withdraw within 14 days of starting a new
     subscription. If the subscription has already given you access to
     content, a proportionate amount may be deducted from the refund
     pursuant to Art. 21(2) of Act no. 16/2016. Automatic renewal does
     not create a new withdrawal right — cancel under section 6.

   To exercise the right of withdrawal, send a clear statement to
   contact@lifelinehealth.is before the period expires. A withdrawal
   form is set out in Annex I to Act no. 16/2016.

9. REFUNDS
   Refunds payable under these terms or mandatory law are credited to
   the same payment method used for the original payment, no later than
   14 DAYS from the date the request is considered valid. No
   administrative fee is charged on refunds.

10. FAILED PAYMENT AND RENEWAL
    If automatic renewal fails (e.g. expired card or insufficient
    funds), Lifeline will retry the charge for up to 7 days and notify
    you by email. If payment is not received within that period, access
    to subscription features is automatically suspended. Access is
    restored as soon as payment is successful.

11. CHARGEBACKS AND DISPUTED CHARGES
    If you believe you have been wrongly charged, please contact
    Lifeline at contact@lifelinehealth.is before filing a chargeback
    with your card issuer. This allows a faster and correct resolution.
    Lifeline responds to such requests within 5 business days.

12. MEDICAL DISCLAIMER
    The health assessment (section 3.1) is a regulated healthcare
    service and is not a substitute for the care of your GP or
    specialist.

    The subscription service (section 3.2) is health coaching and
    lifestyle guidance — not regulated healthcare. It complements, but
    does not replace, medical diagnosis or treatment. Subscription
    content must not be used to make clinical decisions.

    In an emergency always call 112. Discontinue or change medication
    only in consultation with a physician. Further limitation-of-
    liability provisions are set out in the general Terms of Service
    (lifelinehealth.is/terms).

13. PRIVACY
    Processing of personal data in connection with payment and service
    provision is carried out in accordance with the Lifeline Privacy
    Policy (lifelinehealth.is/privacy), Act no. 90/2018 on Data
    Protection and the Processing of Personal Data, and Regulation (EU)
    2016/679 (GDPR). Straumur greiðslumiðlun ehf. acts as an independent
    data controller for processing of payment data.

14. COMPLAINTS
    Complaints regarding payment, service or the operation of these
    terms should be sent to contact@lifelinehealth.is. Lifeline will
    respond formally within 14 days of receipt. If a resolution cannot
    be reached, the consumer may refer the matter to:
    - The Icelandic Consumer Agency (Neytendastofa) —
      www.neytendastofa.is
    - The Appeals Committee for Goods and Services Purchases —
      www.neytendastofa.is/kaerunefnd-voru-og-thjonustukaupa/
    - The Icelandic Data Protection Authority (Persónuvernd) for
      complaints regarding the processing of personal data —
      www.personuvernd.is

15. CHANGES TO THESE TERMS
    Lifeline may update these terms. Material changes will be notified
    by email or in-app at least 30 days before they take effect. The
    current version is always available at
    lifelinehealth.is/sales-terms.

16. GOVERNING LAW AND JURISDICTION
    These terms are governed by Icelandic law. Disputes shall be
    brought before the District Court of Reykjavík, subject to mandatory
    consumer-protection law, including the consumer's right to bring
    proceedings in the courts of his or her own jurisdiction.

17. CONTACT
    - General enquiries and complaints: contact@lifelinehealth.is
    - Privacy: contact@lifelinehealth.is

— Lifeline Health ehf. · reg. no. 590925-1440 · Langholtsvegi 111,
  104 Reykjavík, Iceland`;
}
