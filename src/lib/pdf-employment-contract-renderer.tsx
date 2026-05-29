import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import path from "path";
import { renderEmploymentContract, type AgreedTerms, type ContractParties } from "./employment-contract-template";

// Noto Sans from disk — see pdf-agreement-renderer for why string paths.
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
  h1: { fontSize: 16, fontWeight: "bold", marginBottom: 14, textAlign: "center" },
  h2: { fontSize: 12, fontWeight: "bold", marginTop: 14, marginBottom: 4 },
  p: { marginBottom: 4, textAlign: "justify" },
  placeholder: { marginBottom: 4, color: "#9CA3AF", fontStyle: "italic" },
  thickHr: { borderBottomWidth: 2, borderBottomColor: "#D1D5DB", marginTop: 18, marginBottom: 10 },

  signBlock: { marginTop: 20, padding: 14, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 6 },
  signLabel: { fontSize: 8, textTransform: "uppercase", color: "#6B7280", letterSpacing: 1, marginBottom: 2 },
  signValue: { fontSize: 11, fontWeight: "bold", borderBottomWidth: 1, borderBottomColor: "#D1D5DB", paddingBottom: 3, minHeight: 18 },
  signGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  signCol: { width: "50%", paddingRight: 12, paddingBottom: 8 },
  signNote: { fontSize: 8, color: "#6B7280", marginTop: 10, lineHeight: 1.4 },
  auditBox: { marginTop: 14, padding: 8, backgroundColor: "#F3F4F6", borderRadius: 4 },
  auditLine: { fontSize: 8, color: "#4B5563", marginBottom: 2 },

  footer: { position: "absolute", bottom: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#9CA3AF" },
});

function fmtDateIs(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("is-IS", { day: "numeric", month: "long", year: "numeric" });
}

export interface EmploymentContractPdfProps {
  parties: ContractParties;
  terms: AgreedTerms;
  signatoryName: string;
  signatoryKennitala: string | null;
  signedAt: string;            // ISO timestamp
  signatoryIp: string | null;
  signatoryUserAgent: string | null;
  companySignatoryName: string | null;
  companySignedAt: string | null;
  termsHash: string;
  contractVersion: string;
}

// Render the canonical contract text line-by-line so the PDF body is the
// exact text that was hashed. Headings (title + "N." sections) are styled.
function ContractBody({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        if (i === 0) return <Text key={i} style={s.h1}>{line}</Text>;
        if (line.trim() === "") return <View key={i} style={{ height: 6 }} />;
        if (/^\d+\.\s/.test(line)) return <Text key={i} style={s.h2}>{line}</Text>;
        if (line.startsWith("[")) return <Text key={i} style={s.placeholder}>{line}</Text>;
        return <Text key={i} style={s.p}>{line}</Text>;
      })}
    </>
  );
}

function EmploymentContractDocument(p: EmploymentContractPdfProps) {
  // Body text must equal the canonical hashed text exactly, so kennitala
  // is omitted here and shown only in the signature block below.
  const text = renderEmploymentContract({ ...p.parties, candidateKennitala: undefined }, p.terms);
  return (
    <Document
      title={`Ráðningarsamningur — ${p.parties.candidateName}`}
      author="Lifeline Health ehf."
      subject={p.terms.starfsheiti}
    >
      <Page size="A4" style={s.page}>
        <ContractBody text={text} />

        <View style={s.thickHr} />

        <View style={s.signBlock}>
          <Text style={{ fontSize: 10, fontWeight: "bold", letterSpacing: 2, color: "#6B7280", marginBottom: 8 }}>
            RAFRÆN UNDIRRITUN
          </Text>
          <View style={s.signGrid}>
            <View style={s.signCol}>
              <Text style={s.signLabel}>Starfsmaður</Text>
              <Text style={s.signValue}>{p.signatoryName || "—"}</Text>
            </View>
            <View style={s.signCol}>
              <Text style={s.signLabel}>Kennitala</Text>
              <Text style={s.signValue}>{p.signatoryKennitala || "—"}</Text>
            </View>
            <View style={s.signCol}>
              <Text style={s.signLabel}>Dagsetning</Text>
              <Text style={s.signValue}>{fmtDateIs(p.signedAt)}</Text>
            </View>
            <View style={s.signCol}>
              <Text style={s.signLabel}>Fyrir hönd Lifeline Health ehf.</Text>
              <Text style={s.signValue}>{p.companySignatoryName || "—"}</Text>
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
            {p.companySignedAt && (
              <Text style={s.auditLine}>Mótundirritun fyrirtækis (UTC): {new Date(p.companySignedAt).toISOString()}</Text>
            )}
            <Text style={s.auditLine}>Útgáfa samnings: {p.contractVersion}</Text>
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

export async function renderEmploymentContractPdf(props: EmploymentContractPdfProps): Promise<Buffer> {
  const instance = pdf(<EmploymentContractDocument {...props} />);
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
