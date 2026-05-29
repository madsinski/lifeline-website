// Employment contract (ráðningarsamningur) template.
//
// The exact string returned by renderEmploymentContract() is hashed
// server-side and stored in employment_contracts.terms_hash — it proves
// what the candidate saw when they signed. Any content change MUST bump
// EMPLOYMENT_CONTRACT_VERSION.
//
// LANGUAGE: Icelandic is the source and the only legally binding text.
//
// ⚠️ PLACEHOLDER LEGAL TEXT ⚠️
// The clause bodies below are scaffolding so the system is end-to-end
// functional. They are NOT legal advice and must be reviewed and
// replaced with the company's actual ráðningarsamningur wording by a
// lawyer before any real contract is sent. Search for "[LÖGFRÆÐITEXTI]"
// to find every spot that needs real wording.

export const EMPLOYMENT_CONTRACT_VERSION = "radningarsamningur-v0.1-DRAFT";

export interface AgreedTerms {
  starfsheiti: string;        // job title
  fyrirtaeki: string;         // company
  salary: string;             // agreed monthly salary
  salaryStart: string;        // when salary begins
  equity: string;             // agreed equity
  vesting: string;            // vesting terms
  startDate: string;          // start date
  starfshlutfall: string;     // employment ratio
  stadsetning: string;        // location
}

export interface ContractParties {
  candidateName: string;
  candidateKennitala?: string;
  companyName: string;
  companyKennitala: string;
}

const COMPANY_KENNITALA = "590925-1440";
const COMPANY_LEGAL_NAME = "Lifeline Health ehf.";
const COMPANY_ADDRESS = "Langholtsvegi 111, 104 Reykjavík";

/**
 * Canonical Icelandic contract text. This exact string is hashed at
 * send time and again at sign time — both must match. Keep it
 * deterministic (no dates/now()/random) except for the agreed-terms
 * inputs, which are fixed once the contract is created.
 */
export function renderEmploymentContract(parties: ContractParties, terms: AgreedTerms): string {
  const L: string[] = [];
  const p = (s: string) => L.push(s);

  p("RÁÐNINGARSAMNINGUR");
  p("");
  p(`${COMPANY_LEGAL_NAME}, kt. ${COMPANY_KENNITALA}, ${COMPANY_ADDRESS} ("vinnuveitandi")`);
  p(`og`);
  p(`${parties.candidateName}${parties.candidateKennitala ? `, kt. ${parties.candidateKennitala}` : ""} ("starfsmaður")`);
  p("gera með sér eftirfarandi ráðningarsamning.");
  p("");

  p("1. STARF");
  p(`Starfsheiti: ${terms.starfsheiti}.`);
  p(`Starfshlutfall: ${terms.starfshlutfall}.`);
  p(`Starfsstöð: ${terms.stadsetning}.`);
  p(`Upphafsdagur: ${terms.startDate || "[ÓÁKVEÐINN]"}.`);
  p("[LÖGFRÆÐITEXTI: nánari starfslýsing, skyldur, yfirmaður, trúnaður.]");
  p("");

  p("2. LAUN");
  p(`Mánaðarlaun: ${terms.salary}.`);
  p(`Launakjör hefjast: ${terms.salaryStart}.`);
  p("[LÖGFRÆÐITEXTI: greiðsludagur, orlof, lífeyrir, veikindaréttur skv. lögum nr. 19/1979 og kjarasamningum.]");
  p("");

  p("3. EIGNARHLUTUR (HLUTAFÉ)");
  p(`Eignarhlutur: ${terms.equity}.`);
  p(`Áunnsla (vesting): ${terms.vesting}.`);
  p("[LÖGFRÆÐITEXTI: skilmálar hlutafjár, áunnsla, bakfærsla við starfslok, hluthafasamkomulag.]");
  p("");

  p("4. STARFSLOK");
  p("[LÖGFRÆÐITEXTI: uppsagnarfrestur, starfslokaákvæði, samkeppnisbann ef við á.]");
  p("");

  p("5. ALMENN ÁKVÆÐI");
  p("[LÖGFRÆÐITEXTI: persónuvernd, hugverkaréttindi, lög sem gilda, varnarþing.]");
  p("");

  p("6. UNDIRRITUN");
  p("Með rafrænni undirritun staðfestir starfsmaður að hafa lesið og samþykkt samning þennan.");
  p(`Útgáfa samnings: ${EMPLOYMENT_CONTRACT_VERSION}.`);

  return L.join("\n");
}
