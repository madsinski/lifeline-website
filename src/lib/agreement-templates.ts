// Icelandic legal templates for B2B service agreement + purchase order.
// The exact string returned by renderThjonustuskilmalar() / renderThjonustusamningur()
// is hashed server-side and stored in b2b_agreements.terms_hash — which proves
// what the signatory saw when they signed. Any content change MUST bump the
// version string.

export const THJONUSTUSKILMALAR_VERSION = "thjonustuskilmalar-v1.1";
export const THJONUSTUSAMNINGUR_VERSION = "thjonustusamningur-v1.0";

export function renderThjonustuskilmalar(): string {
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

export function renderThjonustusamningur(p: ServiceAgreementParams): string {
  const { companyName, companyKennitala } = p;
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

export function renderPurchaseOrder(p: PurchaseOrderParams): string {
  const fmt = (n: number) => n.toLocaleString("is-IS") + " kr";
  const lines = p.lineItems.map((li, i) =>
    `${i + 1}. ${li.description} — ${li.qty} × ${fmt(li.unit_price_isk)} = ${fmt(li.total_isk)}`,
  ).join("\n");
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
${lines}

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
