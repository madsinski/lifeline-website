// What somebody agrees to when they upload their own report.
//
// A report a nurse imports is processed under Art. 9(2)(h) — care by a
// health professional. A report uploaded by the person themselves is not
// that: no clinician has entered the picture, which is why own_report_at
// deliberately does not advance the clinical stage. The basis is Art.
// 9(2)(a), explicit consent.
//
// Explicit consent has to be a deliberate act on a specific, informed
// statement, and the controller has to be able to show what was agreed —
// Art. 7(1). That is why the wording lives here under a version: storing a
// boolean proves somebody ticked something, not what was in front of them.
//
// Change the words, bump the version. An old row keeps naming the wording
// it was given, which is the whole point.

/*
 * v2 corrects v1, which said Lifeline is not a healthcare provider. It is:
 * Lifeline Health ehf. holds a rekstrarleyfi. What is true is narrower and
 * more useful — the sjúkraskrá is Medalia, this surface is the coaching
 * service, and what it holds is a reading of the report rather than the
 * record itself. Any row consented under v1 keeps naming v1, which is why
 * the version is stored.
 */
export const SELF_CONSENT_VERSION = "self-report-v2";

/** The four things said before the tick, each one true of what we do. */
export const SELF_CONSENT_POINTS = [
  {
    title: "Skjalið sjálft er ekki geymt",
    body: "PDF-skjalið er lesið í minni á meðan beiðnin stendur yfir og hvergi vistað — hvorki hjá okkur né hjá þriðja aðila.",
  },
  {
    title: "Niðurstöðurnar eru dulkóðaðar",
    body: "Tölurnar úr skýrslunni eru vistaðar dulkóðaðar í gagnagrunni á EES-svæðinu. Starfsfólk sér þær aðeins ef þú ert í þeirra umsjá.",
  },
  {
    title: "Þú ræður hversu lengi",
    body: "Við spyrjum þig eftir ár hvort eigi að geyma þær áfram. Þú getur eytt þeim hvenær sem er í Aðgangi, og þá er samþykkið afturkallað um leið.",
  },
  {
    title: "Sjúkraskráin er áfram í Medalia",
    body: "Lifeline Health ehf. er með rekstrarleyfi fyrir heilbrigðisþjónustu, en sjúkraskráin þín er geymd í Medalia og frumritið af skýrslunni er þar. Heilsuferðin er þjálfunarþjónusta.",
  },
  {
    title: "Engu er breytt",
    body: "Við lesum tölurnar og sýnum þær á læsilegri hátt — með viðmiðum og skýringum. Niðurstöðunum sjálfum er ekki breytt, ekkert er reiknað upp á nýtt og ekkert fer til baka í sjúkraskrána.",
  },
] as const;

/** The sentence beside the tick. Short on purpose: it is the agreement. */
export const SELF_CONSENT_LABEL =
  "Ég set þessa skýrslu inn sjálf(ur) og samþykki að Lifeline vinni með heilsufarsupplýsingarnar í henni eins og lýst er hér að ofan.";
