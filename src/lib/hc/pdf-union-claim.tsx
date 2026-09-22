// Union reimbursement application (umsókn um endurgreiðslu) — ONE A4 page the
// member can email to their sjúkrasjóður as-is. It doubles as the payment
// receipt most funds require, so the member attaches nothing else.
//
// Deliberately contains NO health information: only who, what service,
// when, and how much. Server-only (@react-pdf/renderer).
//
// Layout is sized to fit one page with the longest realistic content
// (long names, a full address, eight "included" items); `wrap={false}` on the
// page keeps react-pdf from ever spilling onto a second page.

import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import path from "path";

const fontDir = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(fontDir, "NotoSans-Regular.ttf") },
    { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const LOGO = path.join(process.cwd(), "public", "lifeline-logo-rebrand.png");

const C = {
  ink: "#0F172A", body: "#334155", muted: "#64748B", faint: "#94A3B8", line: "#E2E8F0",
  brand: "#10B981", brandDark: "#047857", brandDeep: "#0F2A23", brandSoft: "#ECFDF5", brandLine: "#A7F3D0",
};

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 40, paddingHorizontal: 0, fontFamily: "Noto Sans", fontSize: 9.5, lineHeight: 1.45, color: C.body },
  band: { height: 6, backgroundColor: C.brand },
  inner: { paddingHorizontal: 44 },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 26 },
  logo: { width: 150, height: 25.25 },
  docTag: { alignItems: "flex-end" },
  docLabel: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 1.6, color: C.brandDark, textTransform: "uppercase" },
  docNo: { fontSize: 11, fontWeight: "bold", color: C.ink, marginTop: 3, lineHeight: 1.3 },
  docDate: { fontSize: 8.5, color: C.muted },

  title: { fontSize: 18, fontWeight: "bold", color: C.ink, marginTop: 20, lineHeight: 1.25 },
  subtitle: { fontSize: 9.5, color: C.muted, marginTop: 4 },

  cols: { flexDirection: "row", marginTop: 16, gap: 12 },
  col: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 11 },
  colBrand: { flex: 1, borderRadius: 6, padding: 11, backgroundColor: C.brandSoft, borderWidth: 1, borderColor: C.brandLine },
  label: { fontSize: 7, fontWeight: "bold", letterSpacing: 1.2, color: C.faint, textTransform: "uppercase", marginBottom: 5 },
  labelBrand: { fontSize: 7, fontWeight: "bold", letterSpacing: 1.2, color: C.brandDark, textTransform: "uppercase", marginBottom: 5 },
  name: { fontSize: 11.5, fontWeight: "bold", color: C.ink, marginBottom: 3, lineHeight: 1.3 },
  kv: { flexDirection: "row", marginTop: 1.5 },
  k: { width: 62, color: C.muted, fontSize: 8.5 },
  v: { flex: 1, color: C.ink, fontSize: 9 },

  section: { marginTop: 14 },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6, paddingHorizontal: 11 },
  trLast: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 11 },
  th: { flex: 1, fontSize: 8.5, color: C.muted },
  td: { flex: 2, fontSize: 9, color: C.ink },
  includes: { flexDirection: "row", flexWrap: "wrap", marginTop: 7, gap: 4 },
  chip: { fontSize: 7.5, color: C.brandDark, backgroundColor: C.brandSoft, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7 },

  money: { marginTop: 14, flexDirection: "row", gap: 12 },
  moneyLeft: { flex: 1.35, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 11 },
  moneyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  moneyTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: C.line },
  ask: { flex: 1, backgroundColor: C.brandDeep, borderRadius: 6, padding: 13, justifyContent: "center" },
  askLabel: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 1.4, color: C.brandLine, textTransform: "uppercase" },
  askValue: { fontSize: 22, fontWeight: "bold", color: "#FFFFFF", marginTop: 4, lineHeight: 1.2 },
  askRule: { fontSize: 8, color: "#BFD8CE", marginTop: 6, lineHeight: 1.4 },

  notes: { marginTop: 14, flexDirection: "row", gap: 12 },
  note: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 6, padding: 10 },
  noteTitle: { fontSize: 8, fontWeight: "bold", color: C.ink, marginBottom: 3 },
  noteText: { fontSize: 8, color: C.muted, lineHeight: 1.45 },

  sign: { flexDirection: "row", gap: 24, marginTop: 26 },
  signBox: { flex: 1 },
  signLine: { borderTopWidth: 0.8, borderTopColor: C.faint, paddingTop: 4, fontSize: 8, color: C.muted },

  footer: { position: "absolute", bottom: 18, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.faint, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6 },
});

export interface UnionClaimInput {
  claimNumber: string;
  issuedAtIso: string;
  union: { name: string; contactName?: string | null; contactEmail?: string | null };
  member: { fullName: string; kennitala: string | null; address: string | null; phone: string | null; email: string };
  service: {
    packageName: string;
    description: string | null;
    includes: string[];
    location: string | null;
    orderId: string;
    paidAtIso: string | null;
    paymentReference: string | null;
  };
  /** Full price of the service. */
  priceIsk?: number;
  /** Paid by an employer, when a company code was used. */
  employerIsk?: number;
  amountPaidIsk: number;
  reimbursableIsk: number;
  ruleExplanation: string;
}

const isk = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("is-IS", { day: "numeric", month: "long", year: "numeric", timeZone: "Atlantic/Reykjavik" }) : "—";
const kt = (k: string | null) => (k && k.length === 10 ? `${k.slice(0, 6)}-${k.slice(6)}` : k || "—");
const clip = (t: string | null | undefined, n: number) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t || "");

function KV({ k, v }: { k: string; v: string }) {
  return <View style={s.kv}><Text style={s.k}>{k}</Text><Text style={s.v}>{v}</Text></View>;
}

function ClaimDocument({ input }: { input: UnionClaimInput }) {
  const price = input.priceIsk ?? input.amountPaidIsk + (input.employerIsk ?? 0);
  const includes = input.service.includes.slice(0, 8);
  return (
    <Document title={`Umsókn um endurgreiðslu ${input.claimNumber}`} author="Lifeline Health ehf." subject={input.union.name}>
      <Page size="A4" style={s.page} wrap={false}>
        <View style={s.band} fixed />
        <View style={s.inner}>
          <View style={s.head}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            <Image src={LOGO} style={s.logo} />
            <View style={s.docTag}>
              <Text style={s.docLabel}>Umsókn um endurgreiðslu</Text>
              <Text style={s.docNo}>{input.claimNumber}</Text>
              <Text style={s.docDate}>{day(input.issuedAtIso)}</Text>
            </View>
          </View>

          <Text style={s.title}>Umsókn um styrk úr sjúkrasjóði</Text>
          <Text style={s.subtitle}>Vegna heilsufarsskoðunar hjá Lifeline Health. Skjalið er jafnframt greiðslukvittun.</Text>

          <View style={s.cols}>
            <View style={s.colBrand}>
              <Text style={s.labelBrand}>Til</Text>
              <Text style={s.name}>{clip(input.union.name, 60)}</Text>
              {input.union.contactName ? <KV k="B.t." v={clip(input.union.contactName, 50)} /> : null}
              {input.union.contactEmail ? <KV k="Netfang" v={input.union.contactEmail} /> : null}
            </View>
            <View style={s.col}>
              <Text style={s.label}>Umsækjandi</Text>
              <Text style={s.name}>{clip(input.member.fullName, 50)}</Text>
              <KV k="Kennitala" v={kt(input.member.kennitala)} />
              <KV k="Heimili" v={clip(input.member.address, 60) || "—"} />
              <KV k="Sími" v={input.member.phone || "—"} />
              <KV k="Netfang" v={clip(input.member.email, 48)} />
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.label}>Þjónusta</Text>
            <View style={s.table}>
              <View style={s.tr}><Text style={s.th}>Þjónusta</Text><Text style={[s.td, { fontWeight: "bold" }]}>{input.service.packageName}</Text></View>
              <View style={s.tr}><Text style={s.th}>Veitandi</Text><Text style={s.td}>Lifeline Health ehf., kt. 590925-1440</Text></View>
              {input.service.location ? <View style={s.tr}><Text style={s.th}>Staður</Text><Text style={s.td}>{input.service.location}</Text></View> : null}
              <View style={s.tr}><Text style={s.th}>Greiðsludagur</Text><Text style={s.td}>{day(input.service.paidAtIso)}</Text></View>
              <View style={input.service.paymentReference ? s.tr : s.trLast}><Text style={s.th}>Pöntunarnúmer</Text><Text style={s.td}>{input.service.orderId.slice(0, 8).toUpperCase()}</Text></View>
              {input.service.paymentReference ? <View style={s.trLast}><Text style={s.th}>Greiðslutilvísun</Text><Text style={s.td}>{clip(input.service.paymentReference, 40)}</Text></View> : null}
            </View>
            {includes.length ? (
              <View style={s.includes}>{includes.map((x) => <Text key={x} style={s.chip}>{clip(x, 48)}</Text>)}</View>
            ) : null}
          </View>

          <View style={s.money}>
            <View style={s.moneyLeft}>
              <Text style={s.label}>Greiðsla</Text>
              <View style={s.moneyRow}><Text>Verð þjónustu</Text><Text style={{ color: C.ink }}>{isk(price)}</Text></View>
              {input.employerIsk ? <View style={s.moneyRow}><Text>Greitt af vinnuveitanda</Text><Text style={{ color: C.ink }}>−{isk(input.employerIsk)}</Text></View> : null}
              <View style={s.moneyRow}><Text>Virðisaukaskattur</Text><Text style={{ color: C.muted }}>0 kr. (undanþegið)</Text></View>
              <View style={s.moneyTotal}><Text style={{ fontWeight: "bold", color: C.ink }}>Greitt af umsækjanda</Text><Text style={{ fontWeight: "bold", color: C.ink }}>{isk(input.amountPaidIsk)}</Text></View>
            </View>
            <View style={s.ask}>
              <Text style={s.askLabel}>Sótt er um</Text>
              <Text style={s.askValue}>{isk(input.reimbursableIsk)}</Text>
              {input.ruleExplanation ? <Text style={s.askRule}>{clip(input.ruleExplanation, 120)}</Text> : null}
            </View>
          </View>

          <View style={s.notes}>
            <View style={s.note}>
              <Text style={s.noteTitle}>Kvittun</Text>
              <Text style={s.noteText}>Heilbrigðisþjónusta er undanþegin virðisaukaskatti skv. 3. gr. laga nr. 50/1988. Skjalið er gefið út rafrænt og gildir án undirskriftar Lifeline.</Text>
            </View>
            <View style={s.note}>
              <Text style={s.noteTitle}>Persónuvernd</Text>
              <Text style={s.noteText}>Engar heilsufarsupplýsingar eða niðurstöður fylgja umsókninni. Endurgreiðsla greiðist inn á reikning umsækjanda samkvæmt verklagi sjóðsins.</Text>
            </View>
          </View>

          <View style={s.sign}>
            <View style={s.signBox}><Text style={s.signLine}>Undirskrift umsækjanda</Text></View>
            <View style={s.signBox}><Text style={s.signLine}>Móttekið af sjóði · dags.</Text></View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>Lifeline Health ehf. · kt. 590925-1440 · lifelinehealth.is · contact@lifelinehealth.is</Text>
          <Text>{input.claimNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderUnionClaimPdf(input: UnionClaimInput): Promise<Buffer> {
  const blob = await pdf(<ClaimDocument input={input} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
