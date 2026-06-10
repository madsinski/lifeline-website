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
export const SECURITY_POSTURE_VERSION = "v1.6";
export const SECURITY_POSTURE_LAST_UPDATED = "2026-06-10";

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
  Langholtsvegi 111, 104 Reykjavík
  Netfang: contact@lifelinehealth.is
  Vefsíða: https://www.lifelinehealth.is

Persónuverndarfulltrúi (DPO):
  Mads Christian Aanesen, tæknistjóri (CTO) og stofnandi
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
  - Innri köll á Biody-sync edge function krefjast BÆÐI service-role
    bearer token (JWT-hlið Supabase gateway) OG HMAC-undirritunar
    (X-Lifeline-Signature, B2B_BIODY_SIGNING_SECRET). Tvöföld vörn:
    lekið service-role-key eitt sér nægir ekki til að falsa kall.

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
  - Lykilorð eru slegin inn tvisvar (staðfestingarreitur með mismunar-
    vörn) í öllum flæðum sem setja lykilorð: B2C nýskráning, B2B
    fyrirtækjanýskráning, breyting lykilorðs, og boðsflæði starfsmanna.
  - Staðfesting netfangs fer fram á eigin léni (t.d.
    /auth/business-confirm) með token_hash + verifyOtp. Hráir Supabase
    action-hlekkir eru aldrei sendir í tölvupósti — dregur úr hættu á
    að virkir innskráningarhlekkir lendi hjá þriðja aðila (áframsending,
    skönnunarþjónustur pósthýsils).
  - Starfsfólk: sama auðkenning + skylda tvíþátta auðkenning (TOTP /
    AAL2) áður en hægt er að komast inn í admin svæði — að undanskildum
    ytri lögmönnum (role='lawyer') sem hafa eingöngu aðgang að
    /admin/legal/* (engin sjúklingaupplýsingar, engin klínísk gögn).
    Fyrir þá er ekki krafist AAL2; sönnun á undirskrift skjala er
    tryggð með auðkenndri lotu, IP-skráningu, SHA-256 á textaskjalinu
    og rafrænni vottun (PDF) sem er vistuð í legal_review_signoffs.

Hlutverkaskipt aðgangsstjórnun (RBAC):
  Hlutverk: coach, doctor, nurse, psychologist, admin, lawyer,
  medical_advisor.
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
  - Medical advisor (utanaðkomandi læknisfræðilegur ráðgjafi):
    les-aðgangur að admin-svæðinu (MFA-skylda eins og annað starfsfólk);
    ALLAR skrifaðgerðir varðar bæði í RLS og API-gáttum.

Samtenging auth.users við starfsmannarafræði:
  - Allir starfsmannareikningar eru búnir til með auðkenni sem er
    samtengt auth.users.id frá byrjun (sjá /api/admin/staff/create).
    RLS fall is_active_staff() notar JOIN á auth.users via netfang ef
    auðkennin eru ekki samtengd, til að styðja við eldri starfsmanna-
    reikninga.

Aðgangsstjórnun að vefsíðu fyrir opnun (pre-launch gate):
  - Markaðsvefurinn er lokaður almenningi fram að opnun. Aðgangur er
    veittur í gegnum admin-stýrðan aðgangslista (/admin/access):
      - access_grants: heimildir per-notanda / per-fyrirtækis / per-hóps
        með valkvæðum gildistíma (expiry).
      - user_access_groups: hópaaðild fyrir sértæka hópa (t.d.
        fjárfestar, klínískir ráðgjafar).
      - access_invite_tokens: deilanlegir boðshlekkir fyrir óauðkennda
        yfirlesara — EINUNGIS SHA-256 hash tókans er vistað, hrái
        tókinn er aldrei geymdur.
  - Athugun og innlausn fer fram í SECURITY DEFINER föllum
    (has_site_access, validate_access_token, claim_access_token).
  - Eldri sameiginlegur leynilykill (hardcoded preview key) var
    fjarlægður að fullu 2026-06-02.
  - Athugið: gáttin ver markaðsefni fyrir opnun — hún er EKKI
    öryggismörk fyrir persónuupplýsingar; öll gögn eru áfram varin af
    auðkenningu, RLS og API-gáttum óháð henni.

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

Villuskráning (eigið kerfi — engin þriðju aðila þjónusta):
  - Eigin villuskráning í stað Sentry (Sentry fjarlægt að fullu
    2026-06): allar villur í framenda og bakenda eru skráðar beint í
    public.app_errors í Supabase (EES). Villugögn fara aldrei til
    þriðja aðila.
  - Bakendi: captureException/captureMessage hjálparföll, sjálfvirk
    skráning óafgreiddra villna í API-leiðum (withErrorReporting) og
    Next.js request-villum (instrumentation onRequestError).
  - Framendi: hnattrænn villuhandler sendir á /api/errors/capture
    (hraðatakmarkað á hvern notanda).
  - Kennitölur og netföng eru fjarlægð (regex) áður en vistað er — á
    BÁÐUM leiðum. Vafrakökur, hausar og request-body eru aldrei tekin
    með í villufærslur.
  - Triage í /admin/errors (aðeins admin) + dagleg samantekt í
    tölvupósti (error-log-digest cron).

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

Eigin villuskráningarkerfi (app_errors + /admin/errors) veitir
tæknilega sýn á atvik.

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
  Aðgangsheimildir fyrir opnun (gate)     | access_grants + access_invite_tokens (SHA-256)
  Persónuverndarbrot (atvikaskrá)         | health_audit_log + app_errors (admin/errors)

═══════════════════════════════════════════════════════════════════
18. TÆKNILEG OG SKIPULAGSLEG ÖRYGGISRÁÐSTAFANIR — ÚTDRÁTTUR
═══════════════════════════════════════════════════════════════════

Tæknilegt:
  ✓ Dálka-dulkóðun á Art. 9 og PII gögnum (pgcrypto + Vault)
  ✓ Row Level Security á öllum töflum með persónuupplýsingum
  ✓ MFA (TOTP / AAL2) skylda fyrir allt starfsfólk sem fær aðgang að
    sjúklingagögnum (admin / coach / doctor / nurse / psychologist /
    medical_advisor).
    Ytri lögmaður (lawyer) er undanþeginn — hefur eingöngu aðgang að
    skjalasafni, ekki klínískum gögnum.
  ✓ TLS 1.3 á öllum opinberum endapunktum
  ✓ HMAC-undirritun innri þjónustukalla (ásamt service-role bearer —
    hvorugt nægir eitt sér)
  ✓ Staðfesting netfangs með verifyOtp á eigin léni (engir hráir
    action-hlekkir í tölvupósti)
  ✓ Tvíinnsláttur lykilorðs í öllum lykilorðsflæðum
  ✓ Admin-stýrður aðgangslisti fyrir opnun vefsíðu (boðstókar geymdir
    aðeins sem SHA-256 hash)
  ✓ PII-hreinsun (kennitölur/netföng) í eigin villuskráningu — engin
    villugögn fara til þriðja aðila
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

v1.6 (2026-06-10)
  Villuskráning uppfærð: Sentry fjarlægt að fullu (áskrift hætt) og í
  staðinn komið eigið villuskráningarkerfi sem skráir beint í
  public.app_errors í Supabase (EES) — villugögn fara aldrei lengur
  til þriðja aðila, sem fækkar undirvinnsluaðilum um einn. PII-hreinsun
  (kennitölur/netföng, regex) staðfest á báðum leiðum — framenda-
  ingestion OG bakenda-reporter (bakendaleiðin var hert samhliða
  þessari uppfærslu). Triage í /admin/errors og dagleg tölvupósts-
  samantekt óbreytt. Starfsheiti DPO leiðrétt: tæknistjóri (CTO), ekki
  framkvæmdastjóri.

v1.5 (2026-06-10)
  Ensk fylgiútgáfa skjalsins bætt við (renderSecurityPostureEN) —
  efnislega samhljóða; íslenska útgáfan gildir ef misræmi kemur upp.
  Hlutverkalisti leiðréttur: medical_advisor (utanaðkomandi læknis-
  fræðilegur ráðgjafi, les-aðgangur með MFA-skyldu, skrif varin í RLS
  og API-gáttum) hafði vantað í skjalið frá v1.0.

v1.4 (2026-06-10)
  Aðgangsstjórnun að vefsíðu fyrir opnun endursmíðuð: sameiginlegi
  leynilykillinn (hardcoded preview key) fjarlægður og í staðinn kominn
  admin-stýrður aðgangslisti (access_grants / user_access_groups /
  access_invite_tokens) þar sem boðstókar eru eingöngu geymdir sem
  SHA-256 hash og athugun fer um SECURITY DEFINER föll. Auðkenningar-
  flæði hert: tvíinnsláttur lykilorðs í B2C/B2B nýskráningu og við
  breytingu lykilorðs; staðfesting netfangs fer nú um eigið lén með
  token_hash + verifyOtp í stað hrárra Supabase action-hlekkja í
  tölvupósti. Biody-sync samþætting lagfærð svo BÆÐI service-role
  bearer OG HMAC-undirritun séu áskilin saman (tvöföld vörn staðfest
  virk). B2B starfsmenn geta nú valið persónulegt innskráningarnetfang;
  vinnunetfang er varðveitt aðskilið (company_members.email) fyrir
  boð og HR-not — innskráningarauðkenni og HR-skrá eru aftengd.

v1.3 (2026-05-16)
  Þjónustukönnun (post-assessment service feedback) gerð klár fyrir
  útsendingu. Lagaheimild: lögmætir hagsmunir (GDPR Art. 6(1)(f)) —
  ekki sérstaks flokks gögn að jafnaði, en frjáls texti er dulkóðaður
  með pgcrypto sem var lagt fyrir áður. Gegnsæishlekkur bætt í
  inngangstexta könnunarinnar (Persónuverndarstefna, dulkóðun,
  réttur til afrits/eyðingar). Hvati settur á opin svið um að deila
  ekki viðkvæmum heilsuupplýsingum. Varðveislutími 3 ár settur á
  feedback_assignments með purge_expired_feedback_assignments() falli
  fyrir reglulega hreinsun. DSR runbook uppfærður til að ná yfir
  feedback_assignments + feedback_responses bæði í aðgangs- og
  eyðingarferli.

v1.2 (2026-05-04)
  Ytri lögmaður (role='lawyer') er undanþeginn AAL2 / TOTP MFA. Hann
  hefur eingöngu aðgang að /admin/legal/* þar sem engin sjúklingagögn
  liggja; sönnun á undirskrift skjala er tryggð með auðkenndri lotu,
  IP-skráningu, SHA-256 á textaskjalinu og rafrænni vottun (PDF) sem
  vistuð er í legal_review_signoffs. Allir aðrir hlutverkar (admin /
  coach / doctor / nurse / psychologist) þurfa áfram MFA.

v1.1 (2026-05-04)
  Lögheimili Lifeline Health ehf. uppfært í Langholtsveg 111, 104
  Reykjavík (var áður Þrastarási 71, 221 Hafnarfjörður). Sömu uppfærslu
  beitt í gegnum öll lagaleg skjöl: NDA, Lausráðningarsamningi,
  Verktakasamningi, B2B þjónustuskilmálum, Platform TOS + Employee
  TOS, Medalia samkomulagi, og PDF undirritunarskjölum. Útgáfa hvers
  skjals bumpuð.

v1.0 (2026-05-04)
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

// English companion rendering. Content mirrors renderSecurityPosture()
// exactly — when you change one, change the other. The Icelandic
// version is the legally authoritative one.
export function renderSecurityPostureEN(): string {
  return `LIFELINE HEALTH — SECURITY & PRIVACY POSTURE STATEMENT
Version ${SECURITY_POSTURE_VERSION}  ·  Last updated ${SECURITY_POSTURE_LAST_UPDATED}

(English companion translation of the Icelandic original. In case of
any discrepancy, the Icelandic version prevails.)

This document describes all technical and organisational security
measures that Lifeline Health ehf. has in place to protect personal
data, in accordance with Icelandic Act No. 90/2018 on Data Protection
and the Processing of Personal Data, Act No. 55/2009 on Medical
Records, Act No. 40/2007 on Health Services, and Regulation (EU)
2016/679 (GDPR).

It is intended for audits by Persónuvernd (the Icelandic Data
Protection Authority), for Lifeline's legal counsel when reviewing our
compliance, and for B2B customers who need to assess our security
posture before entrusting us with their employees' data.

═══════════════════════════════════════════════════════════════════
1. ENTITY AND CONTACT
═══════════════════════════════════════════════════════════════════

Data controller:
  Lifeline Health ehf.
  Reg. no. (kennitala) 590925-1440
  Langholtsvegur 111, 104 Reykjavík, Iceland
  Email: contact@lifelinehealth.is
  Website: https://www.lifelinehealth.is

Data Protection Officer (DPO):
  Mads Christian Aanesen, CTO and founder
  Email: contact@lifelinehealth.is (or pv@lifelinehealth.is once a
  dedicated address is established)

Supervisory authority:
  Persónuvernd · postur@personuvernd.is · www.personuvernd.is
  Data subjects may lodge complaints directly with the authority.

Other regulatory relationships:
  Directorate of Health (Act No. 41/2007) — Lifeline's healthcare licence.
  Icelandic Health Insurance — where applicable for medical-record data.

═══════════════════════════════════════════════════════════════════
2. SCOPE OF SERVICE
═══════════════════════════════════════════════════════════════════

Lifeline Health operates a healthcare service (health assessments,
blood tests, body-composition measurements, doctor consultations,
training and counselling) under Act No. 40/2007 on Health Services,
licensed by the Directorate of Health.

Technically the service consists of three layers:
  (a) Lifeline app + admin: operational tooling (bookings, training
      plans, coach messaging, self-tracking). Data protection under
      Act 90/2018. This is not a medical record.
  (b) Medalia: a medical-records system licensed under Act No. 55/2009
      hosting clients' formal medical records. Joint controllership
      under GDPR Art. 26.
  (c) Biody Manager: external measurement device + cloud service that
      stores raw body-composition measurements. Processor under GDPR
      Art. 28.

═══════════════════════════════════════════════════════════════════
3. LAWFUL BASIS
═══════════════════════════════════════════════════════════════════

Personal data:
  GDPR Art. 6(1)(b) — performance of a contract (service agreement
                      with the client or their employer).
  GDPR Art. 6(1)(c) — legal obligation (Acts 55/2009, 40/2007, tax law).
  GDPR Art. 6(1)(f) — legitimate interests (security, incident
                      management, debugging).

Health data / Art. 9 special categories:
  GDPR Art. 9(2)(a) — the client's explicit consent.
  GDPR Art. 9(2)(h) — healthcare provided by health professionals
                      bound by confidentiality under Act 34/2012.

Marketing and research purposes:
  GDPR Art. 6(1)(a) — separate opt-in consent, revocable at any time.

═══════════════════════════════════════════════════════════════════
4. DATA CATEGORIES
═══════════════════════════════════════════════════════════════════

General personal data (stored in Lifeline's Supabase):
  - Name, email, phone, address, date of birth
  - Last 4 digits of the national ID (kennitala) — the full kennitala
    is never stored in the Lifeline database (data minimisation,
    GDPR Art. 5(1)(c))
  - Subscription status, bookings, payments

Special categories / health data (Art. 9):
  - Medical-record data (diagnoses, doctors' letters, blood-test
    results, clinical interpretation): stored in Medalia.
  - Body-composition measurements: raw measurements live in Biody
    Manager. Fetched on demand into the Lifeline app with the user's
    explicit consent. No persistent storage in the Lifeline database
    since 2026-05-03.
  - Coach–client message threads (may contain health information):
    stored encrypted in the Lifeline database.

Wellness data (from the app):
  - Self-logged weight entries, activity, meals, reflections.
  - Plans, scores, item completions.

Staff and business data:
  - Staff records (name, email, role, licences, contracts).
  - B2B company data (contracts, invoices, employee rosters).

═══════════════════════════════════════════════════════════════════
5. HOSTING & DATA LOCATION
═══════════════════════════════════════════════════════════════════

  Provider             | Role                                | Location
  ─────────────────────┼─────────────────────────────────────┼──────────────
  Medalia ehf.         | Medical-records system (EHR)        | Iceland
  Biody Manager        | Body-composition measurements       | France (EEA)
  Supabase Inc.        | Database, authentication            | Germany (EEA)
  Vercel Inc.          | Web hosting, frontend services      | EEA + USA (SCC)
  Resend (Lilo Labs)   | Email delivery                      | EEA + USA (SCC)

All parties outside the EEA rely on Standard Contractual Clauses
under GDPR Art. 46.

═══════════════════════════════════════════════════════════════════
6. ENCRYPTION
═══════════════════════════════════════════════════════════════════

In transit:
  - TLS 1.3 on all public endpoints (managed by Vercel).
  - Internal calls to the Biody-sync edge function require BOTH a
    service-role bearer token (Supabase gateway JWT check) AND an
    HMAC signature (X-Lifeline-Signature, B2B_BIODY_SIGNING_SECRET).
    Defence in depth: a leaked service-role key alone is not enough
    to forge a call.

At rest:
  - The Supabase storage layer is encrypted by default (AES-256,
    AWS KMS).
  - Column-level encryption on top of that for Art. 9 and PII data:
      - messages.content (all client–coach messages)
      - clients.phone, address, date_of_birth,
        emergency_contact_name, emergency_contact_phone, kennitala_last4
    Uses pgcrypto pgp_sym_encrypt (AES-256) with a key held in
    Supabase Vault (vault.secrets.lifeline_encryption_key). Only
    SECURITY DEFINER helper functions (encrypt_text / decrypt_text)
    can retrieve the key. Plaintext columns were dropped from the
    tables on 2026-05-03; only the encrypted BYTEA columns remain.

  - Digitally stored PDF signature documents (staff-acceptance-pdfs,
    client-consent-pdfs, legal-signoff-pdfs, platform-acceptance-pdfs,
    staff-documents, company-docs): private Supabase Storage buckets,
    each with dedicated RLS policies.

═══════════════════════════════════════════════════════════════════
7. ACCESS CONTROLS
═══════════════════════════════════════════════════════════════════

Authentication:
  - Users: Supabase Auth (email + password; passwords stored
    salt-hashed with bcrypt).
  - Passwords are entered twice (confirmation field with mismatch
    guard) in every flow that sets a password: B2C signup, B2B company
    signup, password change, and staff invite flows.
  - Email confirmation happens on Lifeline's own domain (e.g.
    /auth/business-confirm) using token_hash + verifyOtp. Raw Supabase
    action links are never sent by email — reducing the risk that live
    sign-in links reach third parties (forwarding, mailbox-provider
    scanning services).
  - Staff: same authentication + mandatory two-factor authentication
    (TOTP / AAL2) before any access to the admin area — except for
    external lawyers (role='lawyer'), who can only reach /admin/legal/*
    (no patient data, no clinical data). For them AAL2 is not required;
    proof of document signature is ensured by an authenticated session,
    IP logging, a SHA-256 hash of the document text, and a digital
    certificate (PDF) stored in legal_review_signoffs.

Role-based access control (RBAC):
  Roles: coach, doctor, nurse, psychologist, admin, lawyer,
  medical_advisor.
  Each role has its own default permissions and dedicated access
  policies (Row Level Security in PostgreSQL).

Specialty-based separation (specialty RLS):
  - Doctors / nurses / psychologists: access to clinical communication
    with the client.
  - Coaches: access to the coaching surface.
  - Admin: superuser rights for operations and support.
  - Lawyer (external counsel): ONLY access to legal drafts + the
    signoff system. No access to client data, messages, or anything
    clinical.
  - Medical advisor (external medical adviser): read access to the
    admin area (subject to MFA like all other staff); ALL write
    operations are blocked both in RLS and at the API gates.

Linking auth.users to staff records:
  - All staff accounts are created with an id linked to auth.users.id
    from the start (see /api/admin/staff/create). The RLS function
    is_active_staff() falls back to a JOIN on auth.users via email
    when the ids are not linked, to support legacy staff accounts.

Pre-launch site access (gate):
  - The marketing site is closed to the public until launch. Access is
    granted through an admin-managed ACL (/admin/access):
      - access_grants: per-user / per-company / per-group grants with
        optional expiry.
      - user_access_groups: group membership for ad-hoc cohorts (e.g.
        investors, clinical advisors).
      - access_invite_tokens: shareable invite links for
        unauthenticated reviewers — ONLY the SHA-256 hash of the token
        is stored; the raw token is never persisted.
  - Validation and claiming run in SECURITY DEFINER functions
    (has_site_access, validate_access_token, claim_access_token).
  - The previous shared secret (hardcoded preview key) was fully
    removed on 2026-06-02.
  - Note: the gate protects marketing content before launch — it is
    NOT a security boundary for personal data; all data remains
    protected by authentication, RLS and API gates regardless of it.

Quarterly access review:
  - Every active staff member is reviewed every 90 days.
  - Automatic reminders in the admin (sidebar dot for overdue reviews;
    weekly notification to contact@lifelinehealth.is on Monday
    mornings).
  - Each decision (keep / change permissions / change role /
    deactivate) is recorded in staff_access_reviews with before/after
    role + permissions.

═══════════════════════════════════════════════════════════════════
8. AUDIT LOGGING
═══════════════════════════════════════════════════════════════════

Table public.health_audit_log:
  - Receives append-only entries for every INSERT/UPDATE/DELETE on
    clients, messages, weight_log, body_comp_events.
  - Automatic Postgres triggers; cannot be bypassed by application
    code.
  - Records actor_id, actor_email, actor_role, action, table_name,
    row_id, occurred_at.
  - Retention: 6 years per Act 55/2009 §13.

Access to the audit log:
  - Admin only (RLS).
  - Questions like "who viewed client X's data on date Y" can be
    answered in the Supabase SQL editor.

Error logging (in-house — no third-party service):
  - In-house error logging replaced Sentry (fully removed 2026-06):
    all frontend and backend errors are written directly to
    public.app_errors in Supabase (EEA). Error data never leaves for
    a third party.
  - Backend: captureException/captureMessage helpers, automatic
    capture of unhandled errors in API routes (withErrorReporting)
    and Next.js request errors (instrumentation onRequestError).
  - Frontend: a global error handler posts to /api/errors/capture
    (rate-limited per user).
  - Kennitala values and email addresses are scrubbed (regex) before
    storage — on BOTH paths. Cookies, headers and request bodies are
    never captured in error records.
  - Triage in /admin/errors (admin only) + a daily email digest
    (error-log-digest cron).

═══════════════════════════════════════════════════════════════════
9. DATA SUBJECT RIGHTS
═══════════════════════════════════════════════════════════════════

Under GDPR Arts. 15–22 / Arts. 17–26 of Act 90/2018, clients have:
  - Right of access (Art. 15)
  - Right to rectification (Art. 16)
  - Right to erasure (Art. 17, limited for medical records)
  - Right to restriction (Art. 18)
  - Right to object (Art. 21)
  - Right to data portability (Art. 20)
  - Right to withdraw consent (Art. 7(3))

Process:
  - The client submits a request via /account → Settings →
    Data & privacy → "Make a privacy request", with request types in
    plain language.
  - The request is stored in dsr_requests and emailed to
    contact@lifelinehealth.is with an action checklist and deadline
    (30 days per GDPR Art. 12(3)).
  - Admin manages the workflow at /admin/data-requests with status
    transitions (received → in_progress → completed/withdrawn/rejected).
  - Procedure and copy-paste SQL for each request type live in
    supabase/runbooks/dsr-runbook.md.

═══════════════════════════════════════════════════════════════════
10. PROCESSORS & JOINT CONTROLLERS
═══════════════════════════════════════════════════════════════════

Joint controller (GDPR Art. 26):
  - Medalia ehf., reg. no. 530224-0230, Kirkjubraut 13, 170
    Seltjarnarnes, Iceland
  - Data processing agreement: signed (stored in /admin/legal under
    kind='dpa').
  - Joint-controllership arrangement (Art. 26): draft under legal
    review (see renderMedaliaJointControllerArrangement). Counsel will
    decide whether both are needed or the DPA alone suffices.

Processors (GDPR Art. 28):
  - Aminogram SAS (Biody Manager) — processing agreement pending
    signature.
  - Supabase Inc. — DPA accepted via terms of service.
  - Vercel Inc. — DPA accepted via terms of service.
  - Resend (Lilo Labs) — DPA accepted via terms of service.

═══════════════════════════════════════════════════════════════════
11. BREACH RESPONSE
═══════════════════════════════════════════════════════════════════

Under GDPR Art. 33, Lifeline must notify Persónuvernd of personal
data breaches within 72 hours of discovery.

Internal process:
  - All staff are bound (via the onboarding checklist signed at
    onboarding) to report suspected incidents immediately to the DPO.
  - The DPO assesses severity and whether the notification duty
    applies.
  - If yes: notification to Persónuvernd + notification to affected
    clients per GDPR Art. 34 where required.
  - Incidents are recorded in health_audit_log + (where applicable) a
    dedicated incident report.

The in-house error-logging system (app_errors + /admin/errors)
provides the technical view of incidents.

═══════════════════════════════════════════════════════════════════
12. DATA PROTECTION IMPACT ASSESSMENT / DPIA
═══════════════════════════════════════════════════════════════════

DPIA-lite for the wellness-mode interim architecture (until the
Medalia API arrives) — signed by the DPO, stored in /admin/legal
under kind='dpia'.

Review cadence: annually, or on any major change to data flows.
Next review: 2027-05-04.

═══════════════════════════════════════════════════════════════════
13. STAFF TRAINING & CONTRACTS
═══════════════════════════════════════════════════════════════════

Before access is granted, every staff member signs the following
documents with an electronic signature (per Act No. 28/2001):

Everyone:
  - Non-disclosure agreement (NDA) — confidentiality over all
    internal data.
  - Device & access policy — which devices and systems may be used.
  - Privacy training — overview of GDPR / Act 90/2018.
  - Onboarding checklist and procedures — where data lives, incident
    reporting, the boundary between wellness data and the medical
    record.

Clinical staff (doctors, nurses, psychologists):
  - + Declaration of confidentiality under Act 34/2012.

Lawyers (external):
  - NDA + privacy training only (no clinical duties).

All signatures are preserved with:
  - SHA-256 of the contract text (text_hash)
  - Signer's IP address and browser fingerprint
  - Timestamp
  - Fully traceable PDF stored in the private bucket
    staff-acceptance-pdfs

═══════════════════════════════════════════════════════════════════
14. CLIENT CONSENT
═══════════════════════════════════════════════════════════════════

Every client consent is:
  - Separated per purpose (granular consent)
  - Stored as a record in public.client_consents (consent_key,
    version, text_hash, granted, granted_at, ip, user_agent,
    revoked_at)
  - Confirmed with a generated PDF certificate emailed to the client
  - Revocable by the client at any time

Key consents:
  - Health assessment consent (required for all health assessments)
  - biody-import-v1 — that body-composition measurements from Biody
    are fetched on demand into the Lifeline app (but not stored there)

═══════════════════════════════════════════════════════════════════
15. COOKIES & ANALYTICS
═══════════════════════════════════════════════════════════════════

Lifeline uses ONLY strictly necessary cookies (the authentication
session token cookie set by Supabase Auth). No advertising cookies.
No cross-site tracking.

If any analytics are added in the future: anonymised aggregate only,
no per-user tracking.

═══════════════════════════════════════════════════════════════════
16. ARCHITECTURE — WELLNESS vs. MEDICAL RECORD (EHR)
═══════════════════════════════════════════════════════════════════

This is a core point for a DPA audit:

The Lifeline app is a WELLNESS DASHBOARD, NOT a medical record.
  - The user sees their own self-tracking, bookings, training plans,
    and coach messages.
  - No clinical assessment or doctors' letters appear here.
  - The client is informed via a prominent notice on the dashboard:
    "This is your self-tracking dashboard — not your medical record."

The medical record lives in Medalia (Act 55/2009).
  - Clinical assessment, blood-test results, doctors' notes, medical
    treatment.
  - Access control and audit logging per §14 of Act 55/2009.

Body composition is fetched on demand from Biody.
  - After the user's explicit consent.
  - No persistent copies in Lifeline (since 2026-05-03).
  - The same pattern we intend for the Medalia API when it arrives.

This separation is documented in /privacy, /terms, and in the Health
Assessment Consent every client signs.

═══════════════════════════════════════════════════════════════════
17. EVIDENCE MAP — WHERE THE DPA FINDS WHAT
═══════════════════════════════════════════════════════════════════

All consents and agreements are electronically signed, SHA-256
hashed, and preserved in the following stores:

  What                                    | Table / Storage
  ───────────────────────────────────────┼────────────────────────────
  DPIA                                    | company_documents (kind='dpia')
  Joint controller (Medalia)              | company_documents (kind='joint_controller')
  Processing agreement (Medalia)          | company_documents (kind='dpa')
  Processing agreement (Biody)            | company_documents (kind='dpa')
  B2B service agreements                  | b2b_agreements + b2b_purchase_orders
  Staff signed agreements                 | staff_agreement_acceptances + staff-acceptance-pdfs/
  Client consents                         | client_consents + client-consent-pdfs/
  Lawyer signoffs                         | legal_review_signoffs + legal-signoff-pdfs/
  Health-data audit trail                 | health_audit_log
  Access reviews                          | staff_access_reviews
  Signature PDFs (all of the above)       | Supabase Storage (private buckets)
  Data subject requests (DSR)             | dsr_requests
  Pre-launch access grants (gate)         | access_grants + access_invite_tokens (SHA-256)
  Privacy incidents                       | health_audit_log + app_errors (admin/errors)

═══════════════════════════════════════════════════════════════════
18. TECHNICAL AND ORGANISATIONAL MEASURES — SUMMARY
═══════════════════════════════════════════════════════════════════

Technical:
  ✓ Column-level encryption of Art. 9 and PII data (pgcrypto + Vault)
  ✓ Row Level Security on every table holding personal data
  ✓ MFA (TOTP / AAL2) mandatory for all staff with access to patient
    data (admin / coach / doctor / nurse / psychologist /
    medical_advisor). External lawyer (lawyer) is exempt — has access
    only to the document archive, not clinical data.
  ✓ TLS 1.3 on all public endpoints
  ✓ HMAC signing of internal service calls (together with the
    service-role bearer — neither suffices alone)
  ✓ Email confirmation via verifyOtp on our own domain (no raw action
    links in email)
  ✓ Password double-entry in every password-setting flow
  ✓ Admin-managed pre-launch site access list (invite tokens stored
    only as SHA-256 hashes)
  ✓ PII scrubbing (kennitala/email) in the in-house error logging —
    no error data leaves for third parties
  ✓ Audit log via Postgres triggers (traceability per Act 55/2009)
  ✓ Daily encrypted backups (Supabase pg_dump → Storage)
  ✓ Automatic error logging and incident management

Organisational:
  ✓ Written agreements with all processors (GDPR Art. 28)
  ✓ Joint controller (Medalia) with a written arrangement
  ✓ Mandatory privacy training for all staff
  ✓ Clinical confidentiality declaration for health professionals
  ✓ Onboarding checklist with day-to-day rules + incident reporting
  ✓ Periodic (90-day) staff access reviews
  ✓ Lawful handling of the kennitala (only last 4 digits stored)
  ✓ DPIA for high-risk processing, signed by the DPO
  ✓ DSR process with SLA and a documented runbook
  ✓ Legal counsel reviews legal drafts before signature

═══════════════════════════════════════════════════════════════════
19. CHANGELOG
═══════════════════════════════════════════════════════════════════

v1.6 (2026-06-10)
  Error logging updated: Sentry fully removed (subscription ended) and
  replaced by an in-house error-logging system writing directly to
  public.app_errors in Supabase (EEA) — error data no longer goes to
  any third party, removing one subprocessor. PII scrubbing
  (kennitala/email regex) confirmed on both paths — the frontend
  ingestion endpoint AND the backend reporter (the backend path was
  hardened alongside this update). Triage in /admin/errors and the
  daily email digest unchanged. DPO job title corrected: CTO, not CEO.

v1.5 (2026-06-10)
  English companion rendering added (renderSecurityPostureEN) —
  substantively identical; the Icelandic version prevails in case of
  discrepancy. Role list corrected: medical_advisor (external medical
  adviser, read-only access with mandatory MFA, writes blocked in RLS
  and at the API gates) had been missing from the document since v1.0.

v1.4 (2026-06-10)
  Pre-launch site access rebuilt: the shared secret (hardcoded preview
  key) was removed in favour of an admin-managed access list
  (access_grants / user_access_groups / access_invite_tokens) where
  invite tokens are stored only as SHA-256 hashes and validation runs
  in SECURITY DEFINER functions. Authentication flows hardened:
  password double-entry on B2C/B2B signup and password change; email
  confirmation now runs on our own domain with token_hash + verifyOtp
  instead of raw Supabase action links in email. Biody-sync integration
  fixed so BOTH the service-role bearer AND the HMAC signature are
  required together (defence in depth confirmed working). B2B employees
  can now choose a personal login email; the work email is kept
  separately (company_members.email) for invites and HR — login
  identity and HR records are decoupled.

v1.3 (2026-05-16)
  Post-assessment service feedback survey prepared for sending. Lawful
  basis: legitimate interests (GDPR Art. 6(1)(f)) — not special-
  category data as a rule, but free-text answers are encrypted with
  the pre-existing pgcrypto setup. Transparency link added to the
  survey intro (privacy policy, encryption, right to copy/erasure).
  Open fields nudge respondents not to share sensitive health
  information. 3-year retention set on feedback_assignments with a
  purge_expired_feedback_assignments() function for periodic cleanup.
  DSR runbook updated to cover feedback_assignments +
  feedback_responses in both the access and erasure procedures.

v1.2 (2026-05-04)
  External lawyer (role='lawyer') exempted from AAL2 / TOTP MFA. They
  only access /admin/legal/* where no patient data lives; proof of
  document signature is ensured by an authenticated session, IP
  logging, SHA-256 of the document text and a digital certificate
  (PDF) stored in legal_review_signoffs. All other roles (admin /
  coach / doctor / nurse / psychologist) still require MFA.

v1.1 (2026-05-04)
  Registered address of Lifeline Health ehf. updated to Langholtsvegur
  111, 104 Reykjavík (previously Þrastarás 71, 221 Hafnarfjörður).
  The same update applied across all legal documents: NDA, part-time
  employment agreement, contractor agreement, B2B terms of service,
  Platform TOS + Employee TOS, the Medalia arrangement, and PDF
  signature documents. Each document's version bumped.

v1.0 (2026-05-04)
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
