// Icelandic legal templates for B2B service agreement + purchase order.
// The exact string returned by renderThjonustuskilmalar() / renderThjonustusamningur()
// is hashed server-side and stored in b2b_agreements.terms_hash — which proves
// what the signatory saw when they signed. Any content change MUST bump the
// version string.
//
// LANGUAGE: Icelandic is the SOURCE language and the only legally
// binding text — hashes are always computed against the IS version.
// English translations are courtesy translations for non-Icelandic
// signatories' review. Signing flows must always pass language="is".

export type DocumentLanguage = "is" | "en";

export const THJONUSTUSKILMALAR_VERSION = "thjonustuskilmalar-v1.1";
export const THJONUSTUSAMNINGUR_VERSION = "thjonustusamningur-v1.0";

export function renderThjonustuskilmalar(language: DocumentLanguage = "is"): string {
  if (language === "en") {
    return `CLINICAL TERMS OF THE HEALTH ASSESSMENT
Lifeline Health ehf. – Employee health assessment

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

1. Parties
Lifeline Health ehf., reg. no. 590925-1440, Langholtsvegi 111, 104 Reykjavík ("Lifeline Health") provides health assessment to companies' employees under a service agreement with the relevant employer.

2. Scope
These terms govern all participation by employees in the health assessment provided by Lifeline Health. The service is available only to individuals 18 years or older.

3. Nature of the service
The health assessment consists of a clinical risk assessment based on responses to questionnaires, lifestyle information, physical measurements and, where applicable, laboratory results. Interpretation of results and recommendations are performed by a doctor on behalf of Lifeline Health.

4. Risk algorithms
In performing the health assessment, recognised standardised risk algorithms are used, such as SCORE2, together with custom risk models developed by the medical team of Lifeline Health.

5. Personal data
Lifeline Health is the controller for the processing of personal data within the meaning of Act no. 90/2018 and Regulation (EU) 2016/679 (GDPR). The data includes special-category personal data on health.

6. Storage of data
All data is recorded and stored in the Medalia medical-record system in accordance with the FHIR standard. Data is retained permanently in the individual's medical record.

7. Disclosure of data
Personally identifiable information is not provided to the employer. The employer is provided only with aggregated and non-identifiable information.

8. Liability
The Lifeline Health assessment does not replace medical diagnosis or treatment outside the company's services. Lifeline Health is not responsible for decisions taken on the basis of the results.

9. Governing law and venue
These terms are governed by Icelandic law. Any dispute shall be brought before the District Court of Reykjanes (Héraðsdómur Reykjaness).`;
  }
  return `KLÍNÍSKIR SKILMÁLAR HEILSUMATS
Lifeline Health ehf. – Heilsumat starfsmanna

1. Aðilar
Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir „Lifeline Health") veitir heilsumat til starfsmanna fyrirtækja samkvæmt þjónustusamningi við viðkomandi vinnuveitanda.

2. Gildissvið
Skilmálar þessir gilda um alla þátttöku starfsmanna í heilsumati sem Lifeline Health veitir. Þjónustan er eingöngu í boði fyrir einstaklinga 18 ára og eldri.

3. Eðli þjónustu
Heilsumat felur í sér klínískt áhættumat byggt á svörum við spurningalistum, lífsstílsupplýsingum, líkamlegum mælingum og eftir atvikum rannsóknarniðurstöðum. Túlkun niðurstaðna og ráðleggingar eru framkvæmdar af lækni á vegum Lifeline Health.

4. Áhættureiknirit
Við framkvæmd heilsumats er stuðst við viðurkennd stöðluð áhættureiknirit, svo sem SCORE2, auk sérhannaðra áhættulíkana þróaðra af læknateymi Lifeline Health.

5. Persónuupplýsingar
Lifeline Health er ábyrgðaraðili vinnslu persónuupplýsinga í skilningi laga nr. 90/2018 og reglugerðar (ESB) 2016/679 (GDPR). Upplýsingar fela í sér viðkvæmar persónuupplýsingar um heilsufar.

6. Geymsla gagna
Allar upplýsingar eru skráðar og varðveittar í Medalia sjúkraskrárkerfinu í samræmi við FHIR staðal. Gögn eru varðveitt varanlega í sjúkraskrá viðkomandi einstaklings.

7. Miðlun upplýsinga
Persónugreinanlegar upplýsingar eru ekki afhentar vinnuveitanda. Vinnuveitanda eru einungis afhentar samanteknar og ópersónugreinanlegar upplýsingar.

8. Ábyrgð
Heilsumat Lifeline Health kemur ekki í stað læknisfræðilegrar greiningar eða meðferðar utan þjónustu félagsins. Lifeline Health ber ekki ábyrgð á ákvörðunum sem teknar eru á grundvelli niðurstaðna.

9. Lögsaga og varnarþing
Um skilmála þessa gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjaness.`;
}

export interface ServiceAgreementParams {
  companyName: string;
  companyKennitala: string; // formatted "123456-7890" or raw "1234567890"
}

export function renderThjonustusamningur(p: ServiceAgreementParams, language: DocumentLanguage = "is"): string {
  const { companyName, companyKennitala } = p;
  if (language === "en") {
    return `SERVICE AGREEMENT BETWEEN LIFELINE HEALTH EHF AND ${companyName.toUpperCase()}

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

${companyName}, reg. no. ${companyKennitala} ("the customer"), and Lifeline Health ehf., reg. no. 590925-1440 ("the service provider"), enter into the following:

SERVICE AGREEMENT

1. Purpose and subject matter
1.1 The subject of this agreement is for the service provider to perform health examinations and provide health-promotion services for the customer's staff, in accordance with this agreement and applicable law and regulation.
1.2 The purpose of this agreement is to support the health, wellbeing and prevention of illness of the customer's staff with a professional and individualised approach.
1.3 The service shall be based in particular on the four foundations of health: exercise, nutrition, sleep and mental health.

2. Description of the service and limitation of liability
2.1 The service consists of a general health examination and assessment of risk factors based on staff responses to questionnaires and, as applicable, measurements and blood tests. The service constitutes a healthcare service within the meaning of Article 4(1) of Act no. 40/2007 on healthcare services.
2.2 The service consists of screening, assessment and advice but does not replace conventional services of primary care or specialists, neither for acute illness nor for complex disease conditions. The results of the examination only reflect the individual's health at the time of the examination and are to be interpreted in that context.
2.3 The service provider warrants that the service is delivered in accordance with professional requirements (Article 13 of Act no. 34/2012 on healthcare professionals). The service provider is however not responsible for the diagnosis of conditions which cannot be diagnosed by the methods agreed.
2.4 In delivering the service, questionnaires are administered, appropriate measurements taken, and blood tests collected as applicable. A report is then prepared on the results and staff are offered a doctor's consultation. The service provider also produces individualised health-promotion plans which review the results and provide specific recommendations and plans for each member of staff.
2.5 The customer's staff receive their results through the service provider's portal. The service provider shall ensure that technical and organisational security measures, including data hosting, meet the requirements of data-protection law. The host of all personally identifiable data is the Medalia medical-record system.
2.6 The service provider performs regular monitoring and follow-up in connection with the above service.
2.7 The service provider shall ensure that all healthcare professionals delivering the service under this agreement at all times hold the licences required by the Directorate of Health (Article 6 of Act no. 34/2012 on healthcare professionals).

3. Obligations of the customer (${companyName})
3.1 The customer shall provide the service provider with the necessary information, assistance and, as applicable, facilities required to deliver the service.
3.2 The customer shall inform its staff about the service, the processing of personal data in connection with it, and encourage participation in the health examinations. The customer shall ensure that it is communicated that participation is voluntary and that refusal to participate has no negative effect on the staff member's employment.
3.3 The customer shall pay the service provider for the service in accordance with §4 of this agreement.

4. Payment
4.1 The customer pays for the service in accordance with the attached purchase order, which forms an annex to this agreement.
4.2 An invoice for delivered service shall be issued when work begins and is payable within 14 days.
4.3 Unpaid invoices accrue default interest from the due date in accordance with Act no. 38/2001 on interest and price-indexing.

5. Data protection and confidentiality
5.1 The service provider shall treat all information it learns in the course of its work concerning the personal matters and private affairs of staff as confidential. The service provider shall observe the strictest duty of confidentiality regarding everything it learns about staff health, in accordance with Article 17(1) of Act no. 34/2012 on healthcare professionals.
5.2 The customer receives no health information about individual staff members except with the written and informed consent of the staff member concerned, in accordance with Act no. 74/1997 on patients' rights. The customer receives only attendance confirmation or non-identifiable statistical aggregates, where so agreed.
5.3 The parties shall enter into a separate data processing agreement in accordance with Article 28 of Regulation (EU) 2016/679 and Act no. 90/2018, which forms part of this agreement. The data processing agreement shall set out, inter alia, the subject matter of the processing, its nature and purpose, the type of personal data, the categories of data subjects, the duties and rights of the controller, the use of sub-processors and measures concerning transfers of data to third countries.

6. Quality requirements and monitoring
6.1 The service provider shall ensure that the service is delivered in accordance with the best available professional standards and applicable law and regulation.
6.2 The customer has the right to monitor the quality and delivery of the service, subject to the limitations following from data-protection and confidentiality provisions.

7. Disputes
7.1 If a dispute arises about the interpretation or performance of this agreement the parties shall endeavour to resolve it by agreement.
7.2 If no agreement is reached the dispute shall be brought before the District Court of Reykjavík (Héraðsdómur Reykjavíkur).

8. Other provisions
8.1 Changes to this agreement shall be in writing and accepted by both parties electronically or by signature.
8.2 This agreement is concluded electronically and stored in the Lifeline Health service system; either party may request a copy at any time.
8.3 In all other respects this agreement is governed by Icelandic law.`;
  }
  return `ÞJÓNUSTUSAMNINGUR MILLI LIFELINE HEALTH EHF OG ${companyName.toUpperCase()}

${companyName}, kt. ${companyKennitala}, í samningi þessum nefndur „kaupandi" og Lifeline Health ehf., kt. 590925-1440, í samningi þessum nefndur „þjónustuveitandi", gera með sér svohljóðandi:

ÞJÓNUSTUSAMNING

1. Markmið og efni samnings
1.1 Efni samnings þessa er að þjónustuveitandi framkvæmi heilsufarsskoðanir og veiti heilsueflingarþjónustu fyrir starfsfólk kaupanda, í samræmi við ákvæði samnings þessa og gildandi lög og reglugerðir.
1.2 Markmið samningsins er að styðja við heilbrigði, vellíðan og forvarnir starfsfólks kaupanda með faglegri og einstaklingsmiðaðri nálgun.
1.3 Þjónustan skal sérstaklega byggja á fjórum grunnþáttum heilsu, þ.e. hreyfingu, næringu, svefni og andlegri heilsu.

2. Lýsing á þjónustu og afmörkun ábyrgðar
2.1 Þjónustan felst í almennri heilsufarsskoðun og mati á áhættuþáttum byggt á svörum starfsmanna við spurningalistum og eftir atvikum mælingum og blóðprufum. Þjónustan telst heilbrigðisþjónusta í skilningi 1. tl. 4. gr. laga nr. 40/2007 um heilbrigðisþjónustu.
2.2 Þjónustan felur í sér skimun, mat og ráðgjöf en kemur ekki í stað hefðbundinnar þjónustu heilsugæslu eða sérfræðilækna, hvorki vegna bráðra veikinda né flókinna sjúkdómsástanda. Niðurstöður skoðunar endurspegla einungis heilsufar viðkomandi á þeim tíma sem skoðun fer fram og skulu túlkaðar í því samhengi.
2.3 Þjónustuveitandi ábyrgist að þjónustan sé veitt í samræmi við faglegar kröfur, sbr. 13. gr. laga nr. 34/2012 um heilbrigðisstarfsmenn. Þjónustuveitandi ber þó ekki ábyrgð á greiningu sjúkdóma eða kvilla sem ekki er unnt að greina með þeim aðferðum sem samið er um.
2.4 Við framkvæmd þjónustunnar eru lagðir fyrir spurningalistar, framkvæmdar viðeigandi mælingar og teknar blóðprufur eftir því sem við á. Í kjölfarið er unnin skýrsla um niðurstöður og starfsmönnum boðið upp á læknisviðtal. Þjónustuveitandi útbýr jafnframt einstaklingsbundin heilsueflingarplön þar sem farið er yfir niðurstöður og veittar sérstakar ráðleggingar og áætlanir fyrir hvern starfsmann.
2.5 Starfsmenn kaupanda fá niðurstöður sínar í gegnum þjónustusíðu þjónustuveitanda. Þjónustuveitandi skal tryggja að tæknilegar og skipulagslegar öryggisráðstafanir, þ.m.t. hýsing gagna, uppfylli kröfur persónuverndarlaga. Hýsingaraðili allra persónugreinanlegra gagna er Medalia sjúkraskráningarkerfi.
2.6 Þjónustuveitandi sinnir reglubundnu eftirliti og eftirfylgni í tengslum við framangreinda þjónustu.
2.7 Þjónustuaðili skal tryggja að allir heilbrigðisstarfsmenn sem veita þjónustu samkvæmt samningi þessum hafi tilskilin starfsleyfi frá landlækni á hverjum tíma, sbr. 6. gr. laga nr. 34/2012 um heilbrigðisstarfsmenn.

3. Skyldur kaupanda (${companyName})
3.1 Kaupandi skal veita þjónustuveitanda nauðsynlegar upplýsingar, aðstoð og eftir atvikum aðstöðu sem þarf til að framkvæma þjónustuna.
3.2 Kaupandi skal upplýsa starfsfólk sitt um þjónustuna, vinnslu persónuupplýsinga í tengslum við hana, og hvetja til þátttöku í heilsufarsskoðunum. Kaupandi skal tryggja að fram komi að þátttaka sé valfrjáls og að synjun um þátttöku hafi engin neikvæð áhrif á starfssamband viðkomandi.
3.3 Kaupandi skal greiða þjónustuveitanda fyrir þjónustu í samræmi við 4. gr. samnings þessa.

4. Greiðslur
4.1 Kaupandi greiðir fyrir þjónustuna samkvæmt meðfylgjandi innkaupapöntun (e. purchase order), sem telst viðauki við samning þennan.
4.2 Reikningur fyrir veitta þjónustu skal sendur þegar vinnsla hefst og skal sá reikningur greiddur innan 14 daga.
4.3 Ógreiddir reikningar bera dráttarvexti frá eindaga í samræmi við ákvæði laga nr. 38/2001, um vexti og verðtryggingu.

5. Persónuvernd og trúnaður
5.1 Þjónustuveitandi skal fara með allar upplýsingar sem hann kemst að í starfi sínu og varða persónuleg málefni og einkahagi starfsmanna sem trúnaðarmál. Þjónustuveitandi skal gæta fyllstu þagnarskyldu um allt sem hann kemst að í starfi sínu um heilsufar starfsmanna, sbr. 1. mgr. 17. gr. laga nr. 34/2012 um heilbrigðisstarfsmenn.
5.2 Kaupandi fær engar heilsufarsupplýsingar um einstaka starfsmenn nema með skriflegu og upplýstu samþykki viðkomandi starfsmanns, sbr. ákvæði laga nr. 74/1997 um réttindi sjúklinga. Kaupandi fær eingöngu staðfestingu á mætingu eða ópersónugreinanlegar tölfræðilegar samantektir, sé um slíkt samið.
5.3 Aðilar skulu gera með sér sérstakan vinnslusamning í samræmi við 28. gr. reglugerðar (ESB) 2016/679 og lög nr. 90/2018, sem verður hluti af samningi þessum. Í vinnslusamningi skal m.a. kveðið á um viðfangsefni vinnslunnar, eðli hennar og tilgang, tegund persónuupplýsinga, flokka skráðra einstaklinga, skyldur og réttindi ábyrgðaraðila, notkun undirvinnsluaðila og ráðstafanir vegna flutnings gagna til þriðju landa.

6. Gæðakröfur og eftirlit
6.1 Þjónustuaðili skal tryggja að þjónustan sé veitt í samræmi við bestu fáanlegu faglegu staðla og gildandi lög og reglugerðir.
6.2 Kaupandi hefur rétt til að fylgjast með gæðum og framkvæmd þjónustunnar, þó með þeim takmörkunum sem leiðir af ákvæðum um persónuvernd og trúnað.

7. Ágreiningsmál
7.1 Rísi ágreiningur um túlkun eða framkvæmd samnings þessa skulu aðilar leitast við að leysa hann með samkomulagi.
7.2 Ef samkomulag næst ekki skal ágreiningur borinn undir Héraðsdóm Reykjavíkur.

8. Önnur ákvæði
8.1 Breytingar á samningi þessum skulu vera skriflegar og samþykktar af báðum aðilum rafrænt eða með undirritun.
8.2 Samningur þessi er gerður rafrænt og geymdur í þjónustukerfi Lifeline Health; hvor aðili getur óskað eftir afriti hvenær sem er.
8.3 Um samning þennan fer að öðru leyti samkvæmt íslenskum lögum.`;
}

// Shared line-item shape used by PO UI + DB jsonb + PDF rendering.
export interface PurchaseOrderLineItem {
  description: string;
  qty: number;
  unit_price_isk: number;
  total_isk: number;
}

export interface PurchaseOrderParams {
  companyName: string;
  companyKennitala: string;
  poNumber: string;
  lineItems: PurchaseOrderLineItem[];
  subtotalIsk: number;
  vatIsk: number;
  totalIsk: number;
  billingCadence: string;
  startsAt: string | null;
  endsAt: string | null;
}

export function renderPurchaseOrder(p: PurchaseOrderParams, language: DocumentLanguage = "is"): string {
  const fmt = (n: number) => n.toLocaleString("is-IS") + " kr";
  const fmtEn = (n: number) => n.toLocaleString("en-US") + " ISK";
  const linesIs = p.lineItems.map((li, i) =>
    `${i + 1}. ${li.description} — ${li.qty} × ${fmt(li.unit_price_isk)} = ${fmt(li.total_isk)}`,
  ).join("\n");
  const linesEn = p.lineItems.map((li, i) =>
    `${i + 1}. ${li.description} — ${li.qty} × ${fmtEn(li.unit_price_isk)} = ${fmtEn(li.total_isk)}`,
  ).join("\n");
  if (language === "en") {
    const cadenceLabelEn: Record<string, string> = {
      one_time: "One-off payment",
      monthly: "Monthly",
      quarterly: "Quarterly",
      yearly: "Annually",
    };
    return `PURCHASE ORDER (ANNEX TO THE SERVICE AGREEMENT)

UNOFFICIAL ENGLISH TRANSLATION. The Icelandic version is the legally
binding text; in case of any conflict the Icelandic version prevails.

PO number: ${p.poNumber}
Customer: ${p.companyName} (reg. no. ${p.companyKennitala})
Service provider: Lifeline Health ehf. (reg. no. 590925-1440)

Service items:
${linesEn}

Subtotal (excl. VAT): ${fmtEn(p.subtotalIsk)}
VAT: ${fmtEn(p.vatIsk)}
Total payable: ${fmtEn(p.totalIsk)}

Billing cadence: ${cadenceLabelEn[p.billingCadence] || p.billingCadence}
Period: ${p.startsAt || "—"} to ${p.endsAt || "open"}

Per §4 of the service agreement, the invoice is payable within 14 days of issue. Default interest under Act no. 38/2001.`;
  }
  const cadenceLabel: Record<string, string> = {
    one_time: "Eingreiðsla",
    monthly: "Mánaðarlega",
    quarterly: "Ársfjórðungslega",
    yearly: "Árlega",
  };
  return `INNKAUPAPÖNTUN (VIÐAUKI VIÐ ÞJÓNUSTUSAMNING)

Nr. pöntunar: ${p.poNumber}
Kaupandi: ${p.companyName} (kt. ${p.companyKennitala})
Þjónustuveitandi: Lifeline Health ehf. (kt. 590925-1440)

Þjónustuliðir:
${linesIs}

Samtals án vsk.: ${fmt(p.subtotalIsk)}
Virðisaukaskattur: ${fmt(p.vatIsk)}
Samtals til greiðslu: ${fmt(p.totalIsk)}

Greiðslufyrirkomulag: ${cadenceLabel[p.billingCadence] || p.billingCadence}
Tímabil: ${p.startsAt || "—"} til ${p.endsAt || "opið"}

Skv. 4. gr. þjónustusamnings er reikningur greiðanlegur innan 14 daga frá útgáfu. Dráttarvextir skv. lögum nr. 38/2001.`;
}

// Combined document that the signatory sees at sign time — this exact string
// is hashed. Any change, even whitespace, produces a different hash.
export function renderFullAgreementForSigning(
  agreementParams: ServiceAgreementParams,
  poParams: PurchaseOrderParams,
): string {
  return [
    renderThjonustusamningur(agreementParams),
    "\n\n— — —\n\n",
    renderThjonustuskilmalar(),
    "\n\n— — —\n\n",
    renderPurchaseOrder(poParams),
  ].join("");
}
