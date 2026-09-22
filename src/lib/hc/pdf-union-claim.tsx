// Union reimbursement application (umsókn um endurgreiðslu) — one page the
// member can email to their sjúkrasjóður as-is. It doubles as the payment
// receipt most funds require, so the member attaches nothing else.
//
// Deliberately contains NO health information: only who, what service,
// when, and how much. Server-only (@react-pdf/renderer).

import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import path from "path";

const fontDir = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(fontDir, "NotoSans-Regular.ttf") },
    { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: { padding: 44, fontFamily: "Noto Sans", fontSize: 10, lineHeight: 1.5, color: "#111827" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 },
  brand: { fontSize: 18, fontWeight: "bold", color: "#047857" },
  brandSub: { fontSize: 8.5, color: "#6B7280", marginTop: 2 },
  docTitle: { fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#374151", textAlign: "right" },
  docMeta: { fontSize: 9, color: "#6B7280", textAlign: "right", marginTop: 2 },
  toBox: { backgroundColor: "#ECFDF5", borderRadius: 6, padding: 12, marginBottom: 16 },
  toLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#047857", marginBottom: 2 },
  toName: { fontSize: 12, fontWeight: "bold" },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#9CA3AF", marginBottom: 5 },
  row: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
  label: { width: 150, color: "#6B7280" },
  value: { flex: 1, fontWeight: "bold" },
  amounts: { marginTop: 4, borderWidth: 1, borderColor: "#D1FAE5", borderRadius: 6, padding: 12 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  amountTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: "#D1FAE5" },
  big: { fontSize: 13, fontWeight: "bold", color: "#047857" },
  note: { marginTop: 14, padding: 10, backgroundColor: "#F9FAFB", borderRadius: 4, fontSize: 8.5, color: "#4B5563", lineHeight: 1.5 },
  sign: { marginTop: 22, flexDirection: "row", justifyContent: "space-between" },
  signBox: { width: "45%", borderTopWidth: 0.8, borderTopColor: "#9CA3AF", paddingTop: 4, fontSize: 8.5, color: "#6B7280" },
  footer: { position: "absolute", bottom: 28, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#9CA3AF" },
});

export interface UnionClaimInput {
  claimNumber: string;
  issuedAtIso: string;
  union: { name: string; contactName?: string | null; contactEmail?: string | null };
  member: {
    fullName: string;
    kennitala: string | null;
    address: string | null;
    phone: string | null;
    email: string;
  };
  service: {
    packageName: string;
    description: string | null;
    includes: string[];
    location: string | null;
    orderId: string;
    paidAtIso: string | null;
    paymentReference: string | null;
  };
  amountPaidIsk: number;
  reimbursableIsk: number;
  ruleExplanation: string;
}

const isk = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("is-IS", { day: "numeric", month: "long", year: "numeric", timeZone: "Atlantic/Reykjavik" }) : "—";
const kt = (k: string | null) => (k && k.length === 10 ? `${k.slice(0, 6)}-${k.slice(6)}` : k || "—");

function ClaimDocument({ input }: { input: UnionClaimInput }) {
  return (
    <Document title={`Umsókn um endurgreiðslu ${input.claimNumber}`} author="Lifeline Health ehf.">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Lifeline Health</Text>
            <Text style={s.brandSub}>Lifeline Health ehf. · kt. 590925-1440 · lifelinehealth.is</Text>
          </View>
          <View>
            <Text style={s.docTitle}>Umsókn um endurgreiðslu</Text>
            <Text style={s.docMeta}>Nr. {input.claimNumber}</Text>
            <Text style={s.docMeta}>Dags. {day(input.issuedAtIso)}</Text>
          </View>
        </View>

        <View style={s.toBox}>
          <Text style={s.toLabel}>Til</Text>
          <Text style={s.toName}>{input.union.name}</Text>
          {input.union.contactName ? <Text>b.t. {input.union.contactName}</Text> : null}
          {input.union.contactEmail ? <Text style={{ color: "#4B5563" }}>{input.union.contactEmail}</Text> : null}
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Umsækjandi</Text>
          <View style={s.row}><Text style={s.label}>Nafn</Text><Text style={s.value}>{input.member.fullName}</Text></View>
          <View style={s.row}><Text style={s.label}>Kennitala</Text><Text style={s.value}>{kt(input.member.kennitala)}</Text></View>
          <View style={s.row}><Text style={s.label}>Heimilisfang</Text><Text style={s.value}>{input.member.address || "—"}</Text></View>
          <View style={s.row}><Text style={s.label}>Sími</Text><Text style={s.value}>{input.member.phone || "—"}</Text></View>
          <View style={s.row}><Text style={s.label}>Netfang</Text><Text style={s.value}>{input.member.email}</Text></View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Þjónusta</Text>
          <View style={s.row}><Text style={s.label}>Þjónusta</Text><Text style={s.value}>{input.service.packageName}</Text></View>
          <View style={s.row}><Text style={s.label}>Veitandi</Text><Text style={s.value}>Lifeline Health ehf., kt. 590925-1440</Text></View>
          {input.service.location ? <View style={s.row}><Text style={s.label}>Staður</Text><Text style={s.value}>{input.service.location}</Text></View> : null}
          <View style={s.row}><Text style={s.label}>Greiðsludagur</Text><Text style={s.value}>{day(input.service.paidAtIso)}</Text></View>
          <View style={s.row}><Text style={s.label}>Pöntunarnúmer</Text><Text style={s.value}>{input.service.orderId.slice(0, 8).toUpperCase()}</Text></View>
          {input.service.paymentReference ? <View style={s.row}><Text style={s.label}>Greiðslutilvísun</Text><Text style={s.value}>{input.service.paymentReference}</Text></View> : null}
          {input.service.description ? <Text style={{ marginTop: 6, color: "#374151" }}>{input.service.description}</Text> : null}
          {input.service.includes.length ? (
            <Text style={{ marginTop: 4, color: "#4B5563" }}>Innifalið: {input.service.includes.join(" · ")}</Text>
          ) : null}
        </View>

        <View style={s.amounts}>
          <View style={s.amountRow}><Text>Greitt fyrir þjónustuna</Text><Text style={{ fontWeight: "bold" }}>{isk(input.amountPaidIsk)}</Text></View>
          <View style={s.amountRow}><Text style={{ color: "#6B7280" }}>Virðisaukaskattur (heilbrigðisþjónusta, undanþegin)</Text><Text>0 kr.</Text></View>
          <View style={s.amountTotal}><Text style={{ fontWeight: "bold" }}>Sótt er um endurgreiðslu</Text><Text style={s.big}>{isk(input.reimbursableIsk)}</Text></View>
          {input.ruleExplanation ? <Text style={{ fontSize: 8.5, color: "#6B7280", marginTop: 4 }}>Samkvæmt reglum sjóðsins: {input.ruleExplanation}</Text> : null}
        </View>

        <View style={s.note}>
          <Text>Skjalið er jafnframt greiðslukvittun. Heilbrigðisþjónusta er undanþegin virðisaukaskatti skv. 3. gr. laga nr. 50/1988.</Text>
          <Text>Engar heilsufarsupplýsingar eða niðurstöður fylgja umsókninni.</Text>
          <Text>Endurgreiðsla greiðist inn á reikning umsækjanda samkvæmt verklagi sjóðsins.</Text>
        </View>

        <View style={s.sign}>
          <Text style={s.signBox}>Undirskrift umsækjanda</Text>
          <Text style={s.signBox}>Móttekið af sjóði</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>Lifeline Health ehf. · contact@lifelinehealth.is</Text>
          <Text>Umsókn {input.claimNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderUnionClaimPdf(input: UnionClaimInput): Promise<Buffer> {
  const blob = await pdf(<ClaimDocument input={input} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
