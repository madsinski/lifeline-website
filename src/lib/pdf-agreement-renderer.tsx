import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import path from "path";
import type { PurchaseOrderLineItem } from "./agreement-templates";

// Load Noto Sans TTFs from disk. @react-pdf/font accepts string paths
// (fontkit.open) and calls fs internally — passing a Buffer breaks the
// internal isDataUrl() check ("dataUrl.substring is not a function").
const fontDir = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(fontDir, "NotoSans-Regular.ttf") },
    { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Noto Sans", fontSize: 10, lineHeight: 1.5, color: "#111827" },
  h1: { fontSize: 16, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  h2: { fontSize: 12, fontWeight: "bold", marginTop: 14, marginBottom: 4 },
  h3: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 4, textAlign: "justify" },
  subtle: { color: "#6B7280", fontSize: 9 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#E5E7EB", marginVertical: 12 },
  thickHr: { borderBottomWidth: 2, borderBottomColor: "#D1D5DB", marginTop: 18, marginBottom: 10 },
  partiesBlock: { marginBottom: 12 },

  // Table
  table: { marginTop: 6, marginBottom: 6, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 4 },
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  tRowLast: { flexDirection: "row" },
  tHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#D1D5DB", backgroundColor: "#F9FAFB" },
  tCellDesc: { flex: 5, padding: 6 },
  tCellQty: { flex: 1, padding: 6, textAlign: "right" },
  tCellPrice: { flex: 2, padding: 6, textAlign: "right" },
  tCellTotal: { flex: 2, padding: 6, textAlign: "right", fontWeight: "bold" },

  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  totalsLabel: { width: 180, textAlign: "right", paddingRight: 10, color: "#6B7280" },
  totalsValue: { width: 100, textAlign: "right", fontWeight: "bold" },
  grandTotal: { fontSize: 12, color: "#059669" },

  // Signing block
  signBlock: { marginTop: 20, padding: 14, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 6 },
  signLabel: { fontSize: 8, textTransform: "uppercase", color: "#6B7280", letterSpacing: 1, marginBottom: 2 },
  signValue: { fontSize: 11, fontWeight: "bold", borderBottomWidth: 1, borderBottomColor: "#D1D5DB", paddingBottom: 3, minHeight: 18 },
  signGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  signCol: { width: "50%", paddingRight: 12, paddingBottom: 8 },
  signNote: { fontSize: 8, color: "#6B7280", marginTop: 10, lineHeight: 1.4 },
  auditBox: { marginTop: 14, padding: 8, backgroundColor: "#F3F4F6", borderRadius: 4 },
  auditLine: { fontSize: 8, color: "#4B5563", marginBottom: 2, fontFamily: "Noto Sans" },

  footer: { position: "absolute", bottom: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#9CA3AF" },
});

function fmtIsk(n: number): string {
  return n.toLocaleString("is-IS") + " kr";
}
function fmtDateIs(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("is-IS", { day: "numeric", month: "long", year: "numeric" });
}
const cadenceLabel: Record<string, string> = {
  one_time: "Eingreiðsla",
  monthly: "Mánaðarlega",
  quarterly: "Ársfjórðungslega",
  yearly: "Árlega",
};

export interface AgreementPdfProps {
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
  signatoryName: string;
  signatoryRole: string;
  signatoryEmail: string;
  signedAt: string;            // ISO timestamp
  signatoryIp: string | null;
  signatoryUserAgent: string | null;
  termsHash: string;
  agreementVersion: string;
}

function AgreementDocument(p: AgreementPdfProps) {
  return (
    <Document
      title={`Þjónustusamningur — ${p.companyName} — ${p.poNumber}`}
      author="Lifeline Health ehf."
      subject={`${p.poNumber}`}
    >
      {/* ── PAGE 1: Service agreement ────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>ÞJÓNUSTUSAMNINGUR</Text>
        <Text style={[s.p, { textAlign: "center", color: "#6B7280", marginBottom: 12 }]}>
          Milli Lifeline Health ehf. og {p.companyName}
        </Text>

        <View style={s.partiesBlock}>
          <Text style={s.p}>
            {p.companyName}, kt. {p.companyKennitala}, í samningi þessum nefndur „kaupandi" og
            Lifeline Health ehf., kt. 590925-1440, í samningi þessum nefndur „þjónustuveitandi",
            gera með sér svohljóðandi:
          </Text>
        </View>

        <Text style={s.h2}>1. Markmið og efni samnings</Text>
        <Text style={s.p}>
          1.1 Efni samnings þessa er að þjónustuveitandi framkvæmi heilsufarsskoðanir og veiti heilsueflingarþjónustu
          fyrir starfsfólk kaupanda, í samræmi við ákvæði samnings þessa og gildandi lög og reglugerðir.
        </Text>
        <Text style={s.p}>
          1.2 Markmið samningsins er að styðja við heilbrigði, vellíðan og forvarnir starfsfólks kaupanda með faglegri
          og einstaklingsmiðaðri nálgun.
        </Text>
        <Text style={s.p}>
          1.3 Þjónustan skal sérstaklega byggja á fjórum grunnþáttum heilsu, þ.e. hreyfingu, næringu, svefni og andlegri heilsu.
        </Text>

        <Text style={s.h2}>2. Lýsing á þjónustu og afmörkun ábyrgðar</Text>
        <Text style={s.p}>
          2.1 Þjónustan felst í almennri heilsufarsskoðun og mati á áhættuþáttum byggt á svörum starfsmanna við
          spurningalistum og eftir atvikum mælingum og blóðprufum. Þjónustan telst heilbrigðisþjónusta í skilningi
          1. tl. 4. gr. laga nr. 40/2007 um heilbrigðisþjónustu.
        </Text>
        <Text style={s.p}>
          2.2 Þjónustan felur í sér skimun, mat og ráðgjöf en kemur ekki í stað hefðbundinnar þjónustu heilsugæslu eða
          sérfræðilækna, hvorki vegna bráðra veikinda né flókinna sjúkdómsástanda. Niðurstöður skoðunar endurspegla
          einungis heilsufar viðkomandi á þeim tíma sem skoðun fer fram og skulu túlkaðar í því samhengi.
        </Text>
        <Text style={s.p}>
          2.3 Þjónustuveitandi ábyrgist að þjónustan sé veitt í samræmi við faglegar kröfur, sbr. 13. gr. laga nr. 34/2012
          um heilbrigðisstarfsmenn. Þjónustuveitandi ber þó ekki ábyrgð á greiningu sjúkdóma eða kvilla sem ekki er unnt
          að greina með þeim aðferðum sem samið er um.
        </Text>
        <Text style={s.p}>
          2.4 Við framkvæmd þjónustunnar eru lagðir fyrir spurningalistar, framkvæmdar viðeigandi mælingar og teknar
          blóðprufur eftir því sem við á. Í kjölfarið er unnin skýrsla um niðurstöður og starfsmönnum boðið upp á
          læknisviðtal. Þjónustuveitandi útbýr jafnframt einstaklingsbundin heilsueflingarplön þar sem farið er yfir
          niðurstöður og veittar sérstakar ráðleggingar og áætlanir fyrir hvern starfsmann.
        </Text>
        <Text style={s.p}>
          2.5 Starfsmenn kaupanda fá niðurstöður sínar í gegnum þjónustusíðu þjónustuveitanda. Þjónustuveitandi skal
          tryggja að tæknilegar og skipulagslegar öryggisráðstafanir, þ.m.t. hýsing gagna, uppfylli kröfur persónuverndarlaga.
          Hýsingaraðili allra persónugreinanlegra gagna er Medalia sjúkraskráningarkerfi.
        </Text>
        <Text style={s.p}>
          2.6 Þjónustuveitandi sinnir reglubundnu eftirliti og eftirfylgni í tengslum við framangreinda þjónustu.
        </Text>
        <Text style={s.p}>
          2.7 Þjónustuaðili skal tryggja að allir heilbrigðisstarfsmenn sem veita þjónustu samkvæmt samningi þessum hafi
          tilskilin starfsleyfi frá landlækni á hverjum tíma, sbr. 6. gr. laga nr. 34/2012 um heilbrigðisstarfsmenn.
        </Text>

        <Text style={s.h2}>3. Skyldur kaupanda ({p.companyName})</Text>
        <Text style={s.p}>
          3.1 Kaupandi skal veita þjónustuveitanda nauðsynlegar upplýsingar, aðstoð og eftir atvikum aðstöðu sem þarf til
          að framkvæma þjónustuna.
        </Text>
        <Text style={s.p}>
          3.2 Kaupandi skal upplýsa starfsfólk sitt um þjónustuna, vinnslu persónuupplýsinga í tengslum við hana, og hvetja
          til þátttöku í heilsufarsskoðunum. Kaupandi skal tryggja að fram komi að þátttaka sé valfrjáls og að synjun um
          þátttöku hafi engin neikvæð áhrif á starfssamband viðkomandi.
        </Text>
        <Text style={s.p}>
          3.3 Kaupandi skal greiða þjónustuveitanda fyrir þjónustu í samræmi við 4. gr. samnings þessa.
        </Text>

        <Text style={s.h2}>4. Greiðslur</Text>
        <Text style={s.p}>
          4.1 Kaupandi greiðir fyrir þjónustuna samkvæmt meðfylgjandi innkaupapöntun (e. purchase order), sem telst
          viðauki við samning þennan.
        </Text>
        <Text style={s.p}>
          4.2 Reikningur fyrir veitta þjónustu skal sendur þegar vinnsla hefst og skal sá reikningur greiddur innan 14 daga.
        </Text>
        <Text style={s.p}>
          4.3 Ógreiddir reikningar bera dráttarvexti frá eindaga í samræmi við ákvæði laga nr. 38/2001, um vexti og verðtryggingu.
        </Text>

        <Text style={s.h2}>5. Persónuvernd og trúnaður</Text>
        <Text style={s.p}>
          5.1 Þjónustuveitandi skal fara með allar upplýsingar sem hann kemst að í starfi sínu og varða persónuleg málefni
          og einkahagi starfsmanna sem trúnaðarmál. Þjónustuveitandi skal gæta fyllstu þagnarskyldu um allt sem hann kemst
          að í starfi sínu um heilsufar starfsmanna, sbr. 1. mgr. 17. gr. laga nr. 34/2012 um heilbrigðisstarfsmenn.
        </Text>
        <Text style={s.p}>
          5.2 Kaupandi fær engar heilsufarsupplýsingar um einstaka starfsmenn nema með skriflegu og upplýstu samþykki
          viðkomandi starfsmanns, sbr. ákvæði laga nr. 74/1997 um réttindi sjúklinga. Kaupandi fær eingöngu staðfestingu á
          mætingu eða ópersónugreinanlegar tölfræðilegar samantektir, sé um slíkt samið.
        </Text>
        <Text style={s.p}>
          5.3 Aðilar skulu gera með sér sérstakan vinnslusamning í samræmi við 28. gr. reglugerðar (ESB) 2016/679 og lög
          nr. 90/2018, sem verður hluti af samningi þessum. Í vinnslusamningi skal m.a. kveðið á um viðfangsefni vinnslunnar,
          eðli hennar og tilgang, tegund persónuupplýsinga, flokka skráðra einstaklinga, skyldur og réttindi ábyrgðaraðila,
          notkun undirvinnsluaðila og ráðstafanir vegna flutnings gagna til þriðju landa.
        </Text>

        <Text style={s.h2}>6. Gæðakröfur og eftirlit</Text>
        <Text style={s.p}>
          6.1 Þjónustuaðili skal tryggja að þjónustan sé veitt í samræmi við bestu fáanlegu faglegu staðla og gildandi lög
          og reglugerðir.
        </Text>
        <Text style={s.p}>
          6.2 Kaupandi hefur rétt til að fylgjast með gæðum og framkvæmd þjónustunnar, þó með þeim takmörkunum sem leiðir
          af ákvæðum um persónuvernd og trúnað.
        </Text>

        <Text style={s.h2}>7. Ágreiningsmál</Text>
        <Text style={s.p}>
          7.1 Rísi ágreiningur um túlkun eða framkvæmd samnings þessa skulu aðilar leitast við að leysa hann með samkomulagi.
        </Text>
        <Text style={s.p}>
          7.2 Ef samkomulag næst ekki skal ágreiningur borinn undir Héraðsdóm Reykjavíkur.
        </Text>

        <Text style={s.h2}>8. Önnur ákvæði</Text>
        <Text style={s.p}>
          8.1 Breytingar á samningi þessum skulu vera skriflegar og samþykktar af báðum aðilum rafrænt eða með undirritun.
        </Text>
        <Text style={s.p}>
          8.2 Samningur þessi er gerður rafrænt og geymdur í þjónustukerfi Lifeline Health; hvor aðili getur óskað eftir
          afriti hvenær sem er.
        </Text>
        <Text style={s.p}>
          8.3 Um samning þennan fer að öðru leyti samkvæmt íslenskum lögum.
        </Text>

        <View style={s.footer} fixed>
          <Text>Lifeline Health ehf. · kt. 590925-1440</Text>
          <Text render={({ pageNumber, totalPages }) => `Síða ${pageNumber} af ${totalPages}`} />
        </View>
      </Page>

      {/* ── PAGE 2: Service terms ───────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>ÞJÓNUSTUSKILMÁLAR</Text>
        <Text style={[s.p, { textAlign: "center", color: "#6B7280", marginBottom: 12 }]}>
          Lifeline Health ehf. – Heilsumat starfsmanna
        </Text>

        <Text style={s.h3}>1. Aðilar</Text>
        <Text style={s.p}>
          Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir „Lifeline Health") veitir
          heilsumat til starfsmanna fyrirtækja samkvæmt þjónustusamningi við viðkomandi vinnuveitanda.
        </Text>

        <Text style={s.h3}>2. Gildissvið</Text>
        <Text style={s.p}>
          Skilmálar þessir gilda um alla þátttöku starfsmanna í heilsumati sem Lifeline Health veitir. Þjónustan er
          eingöngu í boði fyrir einstaklinga 18 ára og eldri.
        </Text>

        <Text style={s.h3}>3. Eðli þjónustu</Text>
        <Text style={s.p}>
          Heilsumat felur í sér klínískt áhættumat byggt á svörum við spurningalistum, lífsstílsupplýsingum, líkamlegum
          mælingum og eftir atvikum rannsóknarniðurstöðum. Túlkun niðurstaðna og ráðleggingar eru framkvæmdar af lækni á
          vegum Lifeline Health.
        </Text>

        <Text style={s.h3}>4. Áhættureiknirit</Text>
        <Text style={s.p}>
          Við framkvæmd heilsumats er stuðst við viðurkennd stöðluð áhættureiknirit, svo sem SCORE2, auk sérhannaðra
          áhættulíkana þróaðra af læknateymi Lifeline Health.
        </Text>

        <Text style={s.h3}>5. Persónuupplýsingar</Text>
        <Text style={s.p}>
          Lifeline Health er ábyrgðaraðili vinnslu persónuupplýsinga í skilningi laga nr. 90/2018 og reglugerðar (ESB)
          2016/679 (GDPR). Upplýsingar fela í sér viðkvæmar persónuupplýsingar um heilsufar.
        </Text>

        <Text style={s.h3}>6. Geymsla gagna</Text>
        <Text style={s.p}>
          Allar upplýsingar eru skráðar og varðveittar í Medalia sjúkraskrárkerfinu í samræmi við FHIR staðal. Gögn eru
          varðveitt varanlega í sjúkraskrá viðkomandi einstaklings.
        </Text>

        <Text style={s.h3}>7. Miðlun upplýsinga</Text>
        <Text style={s.p}>
          Persónugreinanlegar upplýsingar eru ekki afhentar vinnuveitanda. Vinnuveitanda eru einungis afhentar samanteknar
          og ópersónugreinanlegar upplýsingar.
        </Text>

        <Text style={s.h3}>8. Ábyrgð</Text>
        <Text style={s.p}>
          Heilsumat Lifeline Health kemur ekki í stað læknisfræðilegrar greiningar eða meðferðar utan þjónustu félagsins.
          Lifeline Health ber ekki ábyrgð á ákvörðunum sem teknar eru á grundvelli niðurstaðna.
        </Text>

        <Text style={s.h3}>9. Lögsaga og varnarþing</Text>
        <Text style={s.p}>
          Um skilmála þessa gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjaness.
        </Text>

        <View style={s.footer} fixed>
          <Text>Lifeline Health ehf. · kt. 590925-1440</Text>
          <Text render={({ pageNumber, totalPages }) => `Síða ${pageNumber} af ${totalPages}`} />
        </View>
      </Page>

      {/* ── PAGE 3: Purchase order + signature ──────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>INNKAUPAPÖNTUN</Text>
        <Text style={[s.p, { textAlign: "center", color: "#6B7280", marginBottom: 14 }]}>
          Viðauki við þjónustusamning — Nr. {p.poNumber}
        </Text>

        <Text style={s.h3}>Aðilar</Text>
        <Text style={s.p}>Kaupandi: {p.companyName} (kt. {p.companyKennitala})</Text>
        <Text style={s.p}>Þjónustuveitandi: Lifeline Health ehf. (kt. 590925-1440)</Text>

        <Text style={s.h3}>Þjónustuliðir</Text>
        <View style={s.table}>
          <View style={s.tHead}>
            <Text style={[s.tCellDesc, { fontWeight: "bold" }]}>Lýsing</Text>
            <Text style={[s.tCellQty, { fontWeight: "bold" }]}>Fj.</Text>
            <Text style={[s.tCellPrice, { fontWeight: "bold" }]}>Einingav.</Text>
            <Text style={[s.tCellTotal, { fontWeight: "bold" }]}>Samtals</Text>
          </View>
          {p.lineItems.map((li, i) => (
            <View key={i} style={i === p.lineItems.length - 1 ? s.tRowLast : s.tRow}>
              <Text style={s.tCellDesc}>{li.description}</Text>
              <Text style={s.tCellQty}>{li.qty}</Text>
              <Text style={s.tCellPrice}>{fmtIsk(li.unit_price_isk)}</Text>
              <Text style={s.tCellTotal}>{fmtIsk(li.total_isk)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Samtals án vsk.:</Text>
          <Text style={s.totalsValue}>{fmtIsk(p.subtotalIsk)}</Text>
        </View>
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Virðisaukaskattur:</Text>
          <Text style={s.totalsValue}>{fmtIsk(p.vatIsk)}</Text>
        </View>
        <View style={s.totalsRow}>
          <Text style={[s.totalsLabel, { color: "#059669" }]}>Samtals til greiðslu:</Text>
          <Text style={[s.totalsValue, s.grandTotal]}>{fmtIsk(p.totalIsk)}</Text>
        </View>

        <Text style={s.h3}>Greiðslufyrirkomulag</Text>
        <Text style={s.p}>
          {cadenceLabel[p.billingCadence] || p.billingCadence} — tímabil {fmtDateIs(p.startsAt)} til {p.endsAt ? fmtDateIs(p.endsAt) : "opið"}.
        </Text>
        <Text style={s.p}>
          Skv. 4. gr. þjónustusamnings er reikningur greiðanlegur innan 14 daga frá útgáfu. Dráttarvextir skv. lögum nr. 38/2001.
        </Text>

        <View style={s.thickHr} />

        <View style={s.signBlock}>
          <Text style={{ fontSize: 10, fontWeight: "bold", letterSpacing: 2, color: "#6B7280", marginBottom: 8 }}>
            RAFRÆN UNDIRRITUN
          </Text>
          <View style={s.signGrid}>
            <View style={s.signCol}>
              <Text style={s.signLabel}>Undirritun</Text>
              <Text style={s.signValue}>{p.signatoryName || "—"}</Text>
            </View>
            <View style={s.signCol}>
              <Text style={s.signLabel}>Starfsheiti</Text>
              <Text style={s.signValue}>{p.signatoryRole || "—"}</Text>
            </View>
            <View style={s.signCol}>
              <Text style={s.signLabel}>Netfang</Text>
              <Text style={s.signValue}>{p.signatoryEmail || "—"}</Text>
            </View>
            <View style={s.signCol}>
              <Text style={s.signLabel}>Dagsetning</Text>
              <Text style={s.signValue}>{fmtDateIs(p.signedAt)}</Text>
            </View>
          </View>
          <Text style={s.signNote}>
            Rafræn undirritun þessi er skráð með tímastimpli, IP-tölu og vafraauðkenni undirritanda í þjónustukerfi
            Lifeline Health. Undirritunin er bindandi og jafngild rituðu undirritun, sbr. lög nr. 28/2001 um rafrænar
            undirskriftir.
          </Text>
          <View style={s.auditBox}>
            <Text style={s.auditLine}>Tímastimpill (UTC): {new Date(p.signedAt).toISOString()}</Text>
            <Text style={s.auditLine}>IP-tala: {p.signatoryIp || "—"}</Text>
            <Text style={s.auditLine}>Vafraauðkenni: {(p.signatoryUserAgent || "—").slice(0, 120)}</Text>
            <Text style={s.auditLine}>Útgáfa samnings: {p.agreementVersion}</Text>
            <Text style={s.auditLine}>SHA-256 samningstexta: {p.termsHash}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>Lifeline Health ehf. · kt. 590925-1440</Text>
          <Text render={({ pageNumber, totalPages }) => `Síða ${pageNumber} af ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderAgreementPdf(props: AgreementPdfProps): Promise<Buffer> {
  const instance = pdf(<AgreementDocument {...props} />);
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
