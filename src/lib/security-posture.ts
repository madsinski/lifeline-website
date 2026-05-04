// Lifeline Health — Security & Privacy Posture Statement
//
// This document is the canonical, audit-ready summary of every
// technical and organisational measure Lifeline Health has in place
// for personal data protection. It exists primarily for Persónuvernd
// audits but is also the right thing to send to:
//   - Legal counsel reviewing our compliance posture
//   - B2B prospects' procurement / IT teams
//   - Insurance underwriters
//   - DPO of our joint controller (Medalia)
//
// MAINTENANCE RULE
// ────────────────
// When you change ANY substantive content in renderSecurityPosture(),
// you MUST:
//   1. Bump SECURITY_POSTURE_VERSION (e.g. v1.0 → v1.1 for non-breaking
//      additions; v1.x → v2.0 for material posture changes).
//   2. Update SECURITY_POSTURE_LAST_UPDATED to today's ISO date.
//   3. Add a one-line entry to the CHANGELOG section at the bottom of
//      the rendered text describing what changed and why.
//
// The version + last-updated are shown prominently in /admin/legal/drafts
// so an auditor (or anyone reading) can see at a glance whether the
// statement is current.

export const SECURITY_POSTURE_KEY = "security-posture";
export const SECURITY_POSTURE_VERSION = "v1.0";
export const SECURITY_POSTURE_LAST_UPDATED = "2026-05-04";

export function renderSecurityPosture(): string {
  return `LIFELINE HEALTH — SECURITY & PRIVACY POSTURE STATEMENT
Útgáfa ${SECURITY_POSTURE_VERSION}  ·  Síðast uppfært ${SECURITY_POSTURE_LAST_UPDATED}

Þetta skjal lýsir öllum tæknilegum og skipulagslegum öryggisráðstöfunum
sem Lifeline Health ehf. hefur til verndar persónuupplýsingum, í samræmi
við lög nr. 90/2018 um persónuvernd og vinnslu persónuupplýsinga, lög
nr. 55/2009 um sjúkraskrár, lög nr. 40/2007 um heilbrigðisþjónustu, og
reglugerð (ESB) 2016/679 (GDPR).

Skjalið er ætlað til Persónuverndarúttekta, til lögmanns Lifeline við
endurskoðun á regluvörslu, og til B2B viðskiptavina sem þurfa að sjá
öryggismatningu okkar áður en þeir treysta okkur fyrir starfsmannagögnum
sínum.

═══════════════════════════════════════════════════════════════════
1. AÐILI OG TENGILIÐUR / ENTITY AND CONTACT
═══════════════════════════════════════════════════════════════════

Ábyrgðaraðili (Data controller):
  Lifeline Health ehf.
  Kt. 590925-1440
  Þrastarási 71, 221 Hafnarfjörður
  Netfang: contact@lifelinehealth.is
  Vefsíða: https://www.lifelinehealth.is

Persónuverndarfulltrúi (DPO):
  Mads Christian Aanesen, framkvæmdastjóri og stofnandi
  Netfang: contact@lifelinehealth.is (eða pv@lifelinehealth.is þegar
  sérstakt netfang verður stofnað)

Eftirlitsstofnun:
  Persónuvernd · postur@personuvernd.is · www.personuvernd.is
  Skráðir einstaklingar geta lagt fram kvörtun beint þar.

Önnur regluverkstengsl:
  Embætti landlæknis (Lög nr. 41/2007) — heilbrigðisleyfi Lifeline.
  Sjúkratryggingar Íslands — eftir atvikum vegna sjúkraskrárgagna.

═══════════════════════════════════════════════════════════════════
2. EÐLI ÞJÓNUSTU / SCOPE OF SERVICE
═══════════════════════════════════════════════════════════════════

Lifeline Health rekur heilbrigðisþjónustu (heilsumat, blóðprufur,
líkamssamsetningarmælingar, læknisviðtöl, þjálfun og ráðgjöf) skv.
lögum nr. 40/2007 um heilbrigðisþjónustu, með leyfi Embættis landlæknis.

Tæknilega samanstendur þjónustan af þremur lögum:
  (a) Lifeline app + admin: rekstrartól (tímabókanir, hreyfiáætlanir,
      samskipti við þjálfara, sjálfsmælingar). Persónuvernd undir lög
      90/2018. Þetta er ekki sjúkraskrá.
  (b) Medalia: sjúkraskrárkerfi með leyfi skv. lögum nr. 55/2009 sem
      hýsir formlega sjúkraskrá skjólstæðinga. Sameiginleg ábyrgð skv.
      26. gr. GDPR.
  (c) Biody Manager: utanaðkomandi mælitæki + skýjaþjónusta sem geymir
      hráar líkamssamsetningarmælingar. Vinnsluaðili skv. 28. gr. GDPR.

═══════════════════════════════════════════════════════════════════
3. LAGAGRUNDVÖLLUR VINNSLU / LAWFUL BASIS
═══════════════════════════════════════════════════════════════════

Persónuupplýsingar:
  6. gr. (1)(b) GDPR — efndir samnings (þjónustusamningur við
                       skjólstæðing eða atvinnurekanda).
  6. gr. (1)(c) GDPR — lögbundin skylda (lög 55/2009, lög 40/2007,
                       skattalög).
  6. gr. (1)(f) GDPR — lögmætir hagsmunir (öryggi, atvikastjórnun,
                       villuleit).

Heilsufarsgögn / Art. 9 sérflokkar:
  9. gr. (2)(a) GDPR — afdráttarlaust samþykki skjólstæðings.
  9. gr. (2)(h) GDPR — heilbrigðisþjónusta veitt af heilbrigðisstarfsfólki
                       sem bundið er þagnarskyldu skv. lögum 34/2012.

Markaðs- og rannsóknartilgangur:
  6. gr. (1)(a) GDPR — sérstakt opt-in samþykki, hvenær sem er afturkallanlegt.

═══════════════════════════════════════════════════════════════════
4. FLOKKAR PERSÓNUUPPLÝSINGA / DATA CATEGORIES
═══════════════════════════════════════════════════════════════════

Almennar persónuupplýsingar (geymdar í Lifeline Supabase):
  - Nafn, netfang, sími, heimilisfang, fæðingardagur
  - Síðustu 4 stafir kennitölu (heil kennitala er aldrei geymd í
    Lifeline gagnagrunni — gagnalágmörkunarregla 5. gr. (1)(c) GDPR)
  - Áskriftarstaða, tímabókanir, greiðslur

Sérflokkar / heilsufarsupplýsingar (Art. 9):
  - Sjúkraskrárgögn (greiningar, læknisbréf, blóðprufuniðurstöður,
    klínísk túlkun): geymd í Medalia.
  - Líkamssamsetningarmælingar: hráar mælingar í Biody Manager. Sóttar
    á eftirspurn (on-demand) inn í Lifeline app með afdráttarlausu
    samþykki notanda. Engin föst geymsla í Lifeline gagnagrunni síðan
    2026-05-03.
  - Skilaboðasamskipti við þjálfara (geta innihaldið heilsufarsupplýsingar):
    geymd dulkóðuð í Lifeline gagnagrunni.

Velferðargögn (frá appinu):
  - Sjálfsskráðar þyngdarskráningar, hreyfing, máltíðir, hugleiðingar.
  - Áætlanir, stigafjöldi, atriðislok.

Starfsmanna- og rekstrargögn:
  - Starfsfólkupplýsingar (nafn, netfang, hlutverk, leyfi, samningar).
  - B2B fyrirtækjaupplýsingar (samningar, reikningar, starfsmenn-listar).

═══════════════════════════════════════════════════════════════════
5. HÝSING OG LANDFRÆÐILEG STAÐSETNING / HOSTING & DATA LOCATION
═══════════════════════════════════════════════════════════════════

  Hýsingaraðili        | Hlutverk                            | Staðsetning
  ─────────────────────┼─────────────────────────────────────┼──────────────
  Medalia ehf.         | Sjúkraskrárkerfi (sjúkraskrá)        | Ísland
  Biody Manager        | Líkamssamsetningarmælingar           | Frakkland (EES)
  Supabase Inc.        | Gagnagrunnur, auðkenning              | Þýskaland (EES)
  Vercel Inc.          | Vefhýsing, framenda þjónusta          | EES + USA (SCC)
  Resend (Lilo Labs)   | Tölvupóstþjónusta (afhending)         | EES + USA (SCC)

Allir aðilar utan EES nota staðlaða samningsskilmála (Standard
Contractual Clauses) skv. 46. gr. GDPR.

═══════════════════════════════════════════════════════════════════
6. DULKÓÐUN / ENCRYPTION
═══════════════════════════════════════════════════════════════════

Á flutningi (in transit):
  - TLS 1.3 á öllum opinberum endapunktum (Vercel-stýrt).
  - HMAC-undirritaðar fyrirspurnir milli Lifeline og Biody-sync edge
    function (B2B_BIODY_SIGNING_SECRET) til að tryggja að lekið
    service-role-key eitt sér nægi ekki til að falsa kall.

Við hvíld (at rest):
  - Geymslulag Supabase er sjálfgefið dulkóðað (AES-256, AWS KMS).
  - Dálka-dulkóðun (column-level encryption) ofan á það fyrir Art. 9
    og PII gögn:
      - messages.content (öll skilaboð milli skjólstæðings og þjálfara)
      - clients.phone, address, date_of_birth,
        emergency_contact_name, emergency_contact_phone, kennitala_last4
    Notar pgcrypto pgp_sym_encrypt (AES-256) með lyklaorði sem geymt
    er í Supabase Vault (sjá vault.secrets.lifeline_encryption_key).
    Aðeins SECURITY DEFINER hjálparföll (encrypt_text / decrypt_text)
    geta sótt lyklaorðið. Klartextadálkar voru fjarlægðir úr töflunum
    2026-05-03; eingöngu dulkóðuðu BYTEA dálkarnir eru eftir.

  - Stafrænt geymdar PDF undirritanir (staff-acceptance-pdfs,
    client-consent-pdfs, legal-signoff-pdfs, platform-acceptance-pdfs,
    staff-documents, company-docs): Supabase Storage einkareiðir, allir
    með tilteknar RLS reglur.

═══════════════════════════════════════════════════════════════════
7. AÐGANGSSTJÓRNUN / ACCESS CONTROLS
═══════════════════════════════════════════════════════════════════

Auðkenning:
  - Notendur: Supabase Auth (netfang + lykilorð, lykilorð geymd salt-
    hashed með bcrypt).
  - Starfsfólk: sama auðkenning + skylda tvíþátta auðkenning (TOTP /
    AAL2) áður en hægt er að komast inn í admin svæði.

Hlutverkaskipt aðgangsstjórnun (RBAC):
  Hlutverk: coach, doctor, nurse, psychologist, admin, lawyer.
  Hvert hlutverk hefur eigin sjálfgefna heimildir og sérstaka aðgangs-
  reglur (Row Level Security í PostgreSQL).

Sérgreinar-aðskilnaður (specialty-based RLS):
  - Læknar / hjúkrunarfræðingar / sálfræðingar: aðgang að klínískum
    samskiptum við skjólstæðing.
  - Coaches: aðgang að þjálfaravetninu.
  - Admin: superuser-réttindi til rekstrar og stuðnings.
  - Lawyer (utanaðkomandi lögmaður): EINUNGIS aðgang að lagadrögum +
    samþykktarkerfinu. Ekkert aðgang að skjólstæðingsgögnum, skilaboðum,
    eða öðru klínísku.

Samtenging auth.users við starfsmannarafræði:
  - Allir starfsmannareikningar eru búnir til með auðkenni sem er
    samtengt auth.users.id frá byrjun (sjá /api/admin/staff/create).
    RLS fall is_active_staff() notar JOIN á auth.users via netfang ef
    auðkennin eru ekki samtengd, til að styðja við eldri starfsmanna-
    reikninga.

Reglubundin endurskoðun aðgangs (quarterly access review):
  - Á 90 daga fresti er hver virkur starfsmaður endurskoðaður.
  - Sjálfvirk áminning í admin (sidebar dot fyrir gjaldfallna; vikuleg
    tilkynning til contact@lifelinehealth.is á mánudagsmorgnum).
  - Ákvörðun (halda / breyta heimildum / breyta hlutverki / afvirkja)
    skráð í staff_access_reviews með fyrri/eftir hlutverki + heimildum.

═══════════════════════════════════════════════════════════════════
8. ATBURÐASKRÁNING / AUDIT LOGGING
═══════════════════════════════════════════════════════════════════

Tafla public.health_audit_log:
  - Fær rauðar inni færslur fyrir allar INSERT/UPDATE/DELETE aðgerðir
    á clients, messages, weight_log, body_comp_events.
  - Sjálfvirkir Postgres triggers, getur ekki verið afturkallað.
  - Skráir actor_id, actor_email, actor_role, action, table_name,
    row_id, occurred_at.
  - Geymslutími: 6 ár skv. lögum 55/2009 §13.

Aðgangur að atburðaskrá:
  - Aðeins admin (RLS).
  - Hægt að spyrjast fyrir um "hver skoðaði gögn skjólstæðings X á
    dagsetningu Y" í Supabase SQL Editor.

Villuskráning:
  - Sentry í framenda + bakhlið. Næmar reitir (cookies, kerfisheaders,
    health-route bodies) eru skornir út áður en þeim er sent.
  - Spegill villna í public.app_errors fyrir innra eftirlit í admin
    (/admin/errors). Kennitölur og netföng eru varin (regex scrubbing)
    áður en þeim er vistað.

═══════════════════════════════════════════════════════════════════
9. RÉTTINDI SKRÁÐRA EINSTAKLINGA / DATA SUBJECT RIGHTS
═══════════════════════════════════════════════════════════════════

Skv. 15.–22. gr. GDPR / 17.–26. gr. laga 90/2018 hafa skjólstæðingar:
  - Aðgangsrétt (Art. 15)
  - Leiðréttingarrétt (Art. 16)
  - Rétt til að gleymast (Art. 17, takmarkað fyrir sjúkraskrá)
  - Rétt til takmörkunar (Art. 18)
  - Rétt til andmæla (Art. 21)
  - Flutningsrétt (Art. 20)
  - Rétt til að afturkalla samþykki (Art. 7(3))

Verkferill:
  - Skjólstæðingur sendir beiðni í gegnum /account → Settings →
    Data & privacy → "Make a privacy request" með kjörmálstegund í
    plain language.
  - Beiðnin er vistuð í dsr_requests og send með tölvupósti á
    contact@lifelinehealth.is með aðgerðagátlista og frest (30 dagar
    skv. 12. gr. (3) GDPR).
  - Admin stjórnar verkflæðinu á /admin/data-requests með status
    transitions (received → in_progress → completed/withdrawn/rejected).
  - Verkferill og copy-paste SQL fyrir hvern beiðnatilfelli í
    supabase/runbooks/dsr-runbook.md.

═══════════════════════════════════════════════════════════════════
10. UNDIRVINNSLUAÐILAR OG SAMEIGINLEG ÁBYRGÐ / PROCESSORS & JOINT
═══════════════════════════════════════════════════════════════════

Sameiginlegur ábyrgðaraðili (26. gr. GDPR):
  - Medalia ehf., kt. 530224-0230, Kirkjubraut 13, 170 Seltjarnarnes
  - Vinnslusamningur: undirritaður (varðveittur í /admin/legal under
    kind='dpa').
  - Samkomulag um sameiginlega ábyrgð (skv. 26. gr.): drög til
    skoðunar lögmanns (sjá renderMedaliaJointControllerArrangement).
    Lögmaður á að ákveða hvort við þurfum bæði eða einungis vinnslu-
    samninginn.

Vinnsluaðilar (28. gr. GDPR):
  - Aminogram SAS (Biody Manager) — vinnslusamningur til undirritunar.
  - Supabase Inc. — DPA samþykktur með notkunarskilmálum.
  - Vercel Inc. — DPA samþykktur með notkunarskilmálum.
  - Resend (Lilo Labs) — DPA samþykktur með notkunarskilmálum.

═══════════════════════════════════════════════════════════════════
11. ATVIKASTJÓRNUN / BREACH RESPONSE
═══════════════════════════════════════════════════════════════════

Skv. 33. gr. GDPR er Lifeline skylt að tilkynna persónuverndaratvik
til Persónuverndar innan 72 klst frá uppgötvun.

Innra ferli:
  - Allt starfsfólk er bundið skv. móttökugátlista (signed at onboarding)
    að tilkynna grunsamleg atvik tafarlaust til DPO.
  - DPO metur alvarleika og hvort tilkynningarskylda á við.
  - Ef já: tilkynning til Persónuverndar + tilkynning til skjólstæðinga
    skv. 34. gr. GDPR ef þannig ber undir.
  - Atvik skráð í health_audit_log + (ef við á) sérstök dagskýrsla.

Sentry og admin/errors verkfærakistan veitir tæknilegri sýn á atvik.

═══════════════════════════════════════════════════════════════════
12. MAT Á ÁHRIFUM Á PERSÓNUVERND / DPIA
═══════════════════════════════════════════════════════════════════

DPIA-lite fyrir wellness-mode interim arkitektúr (þangað til Medalia
API kemur) — undirrituð af DPO, varðveitt í /admin/legal under
kind='dpia'.

Endurskoðunarcadence: árlega eða við hverja meiri háttar breytingu
á gagnaflæði. Næsta endurskoðun: 2027-05-04.

═══════════════════════════════════════════════════════════════════
13. STARFSMANNAFRÆÐSLA OG SAMNINGAR / STAFF TRAINING & CONTRACTS
═══════════════════════════════════════════════════════════════════

Hver starfsmaður undirritar með rafrænni undirritun (skv. lögum nr.
28/2001) eftirfarandi skjöl áður en aðgangur er veittur:

Allir:
  - Trúnaðarsamningur (NDA) — Trúnaður um öll innri gögn.
  - Tækjareglur og aðgangsstjórnun — hvaða tæki og kerfi mega notast.
  - Persónuverndarfræðsla — yfirlit yfir GDPR / lög 90/2018.
  - Móttökugátlisti og verklagsreglur — hvar gögn lifa, atvika-
    tilkynningar, mörk milli velferðar og sjúkraskrár.

Klínískt starfsfólk (læknar, hjúkrunarfræðingar, sálfræðingar):
  - + Yfirlýsing um þagnarskyldu skv. lögum 34/2012.

Lögmenn (utanaðkomandi):
  - Fá aðeins NDA + persónuverndarfræðslu (engin klínísk störf).

Allar undirritanir varðveittar með:
  - SHA-256 á samningstexta (text_hash)
  - IP-tala og vafraauðkenni undirritanda
  - Tímastimpill
  - PDF-skjal með full rakningu, geymt í einkaaðgangsbúk
    staff-acceptance-pdfs

═══════════════════════════════════════════════════════════════════
14. SAMÞYKKI SKJÓLSTÆÐINGS / CLIENT CONSENT
═══════════════════════════════════════════════════════════════════

Hvert samþykki skjólstæðings er:
  - Aðskilið per-tilgangs (granular consent)
  - Vistað sem bind í public.client_consents (consent_key, version,
    text_hash, granted, granted_at, ip, user_agent, revoked_at)
  - PDF staðfestingarskjal stofnað og sent á netfang skjólstæðings
  - Hvenær sem er afturkallanlegt af skjólstæðingi

Helstu samþykki:
  - Health assessment consent (skylt fyrir öll heilsumat)
  - biody-import-v1 — að líkamssamsetningarmælingar úr Biody séu
    sóttar á eftirspurn í Lifeline appið (en ekki geymdar þar)

═══════════════════════════════════════════════════════════════════
15. VAFRAKÖKUR OG GREINING / COOKIES & ANALYTICS
═══════════════════════════════════════════════════════════════════

Lifeline notar EINUNGIS strangt nauðsynlegar vafrakökur (auðkenningar-
session token í cookie, sett af Supabase Auth). Engar auglýsingar-
vafrakökur. Engin þvert-vefsíður (cross-site) rakning.

Ef einhverjar greiningar bætast við í framtíðinni: anonymised aggregate
only, no per-user tracking.

═══════════════════════════════════════════════════════════════════
16. ARKITEKTÚR — VELFERÐ vs. SJÚKRASKRÁ / WELLNESS vs. EHR
═══════════════════════════════════════════════════════════════════

Þetta er kjarnaatriði fyrir Persónuverndar úttekt:

Lifeline appið er VELFERÐAR-MÆLABORÐ, EKKI sjúkraskrá.
  - Notandi sér eigin sjálfsmælingar, tímabókanir, þjálfunaráætlanir,
    skilaboð við þjálfara.
  - Ekkert klínískt mat eða læknisbréf birtist hér.
  - Skjólstæðingur er upplýstur með áberandi tilkynningu á mælaborðinu:
    "This is your self-tracking dashboard — not your medical record."

Sjúkraskrá lifir í Medalia (lög 55/2009).
  - Klínískt mat, blóðprufuniðurstöður, læknisnótur, sjúkdómsmeðferð.
  - Aðgangsstjórnun og rakningarskráning skv. 14. gr. laga 55/2009.

Líkamssamsetning sækist á eftirspurn frá Biody.
  - Eftir afdráttarlaust samþykki notanda.
  - Engar fastar afritanir í Lifeline (síðan 2026-05-03).
  - Sami munstur og við ætlum fyrir Medalia API þegar hún kemur.

Þessi aðskilnaður er skjalfestur í /privacy, /terms, og í Health
Assessment Consent sem hvern skjólstæðing samþykkir.

═══════════════════════════════════════════════════════════════════
17. SAMÞYKKTARSÖNNUN — HVAR PERSÓNUVERND FINNUR HVAÐ
═══════════════════════════════════════════════════════════════════

Allar samþykktir og samningar eru rafrænt undirritaðir, sha256-hashaðir,
og varðveittir í eftirfarandi geymslum:

  Hvað                                   | Tafla / Geymsla
  ───────────────────────────────────────┼────────────────────────────
  DPIA                                    | company_documents (kind='dpia')
  Joint controller (Medalia)              | company_documents (kind='joint_controller')
  Vinnslusamningur (Medalia)              | company_documents (kind='dpa')
  Vinnslusamningur (Biody)                | company_documents (kind='dpa')
  B2B þjónustusamningar                   | b2b_agreements + b2b_purchase_orders
  Staff signed agreements                 | staff_agreement_acceptances + staff-acceptance-pdfs/
  Client consents                         | client_consents + client-consent-pdfs/
  Lawyer signoffs                         | legal_review_signoffs + legal-signoff-pdfs/
  Atburðaskrá heilsugagna                 | health_audit_log
  Endurskoðun aðgangs                     | staff_access_reviews
  Skráningar (sign-off PDFs allra ofangr) | Supabase Storage (privates buckets)
  Beiðnir skráðra einstaklinga (DSR)      | dsr_requests
  Persónuverndarbrot (atvikaskrá)         | health_audit_log + Sentry + admin/errors

═══════════════════════════════════════════════════════════════════
18. TÆKNILEG OG SKIPULAGSLEG ÖRYGGISRÁÐSTAFANIR — ÚTDRÁTTUR
═══════════════════════════════════════════════════════════════════

Tæknilegt:
  ✓ Dálka-dulkóðun á Art. 9 og PII gögnum (pgcrypto + Vault)
  ✓ Row Level Security á öllum töflum með persónuupplýsingum
  ✓ MFA (TOTP / AAL2) skylda fyrir allt starfsfólk
  ✓ TLS 1.3 á öllum opinberum endapunktum
  ✓ HMAC-undirritun innri þjónustukalla
  ✓ Sentry redaction á health-routes (PII í villuskráningu)
  ✓ Audit log með Postgres triggerum (rakningarskylda skv. lögum 55/2009)
  ✓ Daglegar dulkóðaðar afritanir (Supabase pg_dump → Storage)
  ✓ Sjálfkrafa villuskráning og atvikastjórnun

Skipulagslegt:
  ✓ Skriflegir samningar við alla undirvinnsluaðila (28. gr. GDPR)
  ✓ Sameiginlegur ábyrgðaraðili (Medalia) með skriflegt samkomulag
  ✓ Skylda þjónunarkennsla um persónuvernd fyrir allt starfsfólk
  ✓ Klínísk þagnarskyldu yfirlýsing fyrir heilbrigðisstarfsmenn
  ✓ Móttökugátlisti með daglegum reglum + atvikatilkynningarferli
  ✓ Reglubundin (90 daga) endurskoðun aðgangs starfsfólks
  ✓ Lögbundin meðferð kennitölu (geymd aðeins síðustu 4 stafir)
  ✓ DPIA fyrir áhættusama vinnslu, undirrituð af DPO
  ✓ DSR verkferill með SLA og dokumentaðri runbook
  ✓ Lögmaður endurskoðar lagadrög fyrir undirritun

═══════════════════════════════════════════════════════════════════
19. CHANGELOG
═══════════════════════════════════════════════════════════════════

${SECURITY_POSTURE_VERSION} (${SECURITY_POSTURE_LAST_UPDATED})
  Initial release. Captures security + compliance posture as built
  through external audit + Sprint 0 / Sprint 1 / Sprint 2 work
  (Apr 21 — May 4, 2026): RLS hardening, audit log, DSR workflow,
  consent system with PDF certificates, staff onboarding gating,
  quarterly access review, Biody on-demand fetch (replacing the
  shadow EHR), pgcrypto + Vault column encryption for messages.content
  + clients PII (plaintext columns dropped), lawyer role for external
  counsel, in-admin error log mirror, joint-controller arrangement
  drafted with Medalia.
`;
}
