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

export const SELF_CONSENT_VERSION = "self-report-v1";

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
    title: "Þetta er ekki sjúkraskrá",
    body: "Lifeline er ekki heilbrigðisstofnun og þetta kemur ekki í stað mats læknis. Skýrslan þín í sjúklingagáttinni er áfram frumritið.",
  },
] as const;

/** The sentence beside the tick. Short on purpose: it is the agreement. */
export const SELF_CONSENT_LABEL =
  "Ég set þessa skýrslu inn sjálf(ur) og samþykki að Lifeline vinni með heilsufarsupplýsingarnar í henni eins og lýst er hér að ofan.";
