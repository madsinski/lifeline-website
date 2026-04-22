import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import path from "path";

// Load the same Noto Sans fonts used elsewhere so ð/þ/special chars render
// correctly. @react-pdf/font wants string paths (fontkit opens them), not
// Buffers.
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 },
  brand: { fontSize: 20, fontWeight: "bold", color: "#10B981" },
  brandSub: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  receiptLabel: { fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 2, color: "#6B7280" },
  receiptNum: { fontSize: 10, color: "#374151", marginTop: 4 },
  receiptDate: { fontSize: 9, color: "#9CA3AF", marginTop: 2 },

  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#9CA3AF", marginBottom: 4 },

  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { color: "#6B7280" },
  value: { color: "#111827", fontWeight: "bold" },

  lineTable: { marginTop: 4, marginBottom: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  lineDesc: { flex: 4, color: "#111827" },
  lineQty: { flex: 1, textAlign: "right", color: "#6B7280" },
  linePrice: { flex: 2, textAlign: "right", color: "#111827", fontWeight: "bold" },

  totalsBlock: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 2 },
  totalsLabel: { width: 140, textAlign: "right", color: "#6B7280", paddingRight: 8 },
  totalsValue: { width: 100, textAlign: "right", color: "#111827" },
  grandTotalRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 4 },
  grandTotalLabel: { width: 140, textAlign: "right", color: "#111827", fontWeight: "bold", paddingRight: 8 },
  grandTotalValue: { width: 100, textAlign: "right", color: "#10B981", fontWeight: "bold", fontSize: 13 },

  footnote: { marginTop: 20, padding: 10, backgroundColor: "#F9FAFB", borderRadius: 4, fontSize: 8.5, color: "#6B7280", lineHeight: 1.5 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#9CA3AF" },
});

export type BookingReceiptInput = {
  bookingId: string;
  receiptNumber: string;      // e.g. "LL-2026-000123"
  issuedAtIso: string;        // receipt issue date
  paidAtIso: string | null;   // original payment date
  packageName: string;        // "Foundational Health Assessment"
  scheduledAtIso: string | null;
  location: string | null;
  amountIsk: number;
  refundedIsk?: number | null;
  client: {
    fullName: string;
    email: string;
    addressLine?: string | null;
    kennitala?: string | null;
  };
  provider: {
    name: string;             // "Straumur"
    reference: string | null; // provider_reference
  };
};

function fmtIsk(n: number) {
  return n.toLocaleString("is-IS") + " ISK";
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Atlantic/Reykjavik" });
}
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Atlantic/Reykjavik" });
}

function ReceiptDocument({ input }: { input: BookingReceiptInput }) {
  const refunded = (input.refundedIsk ?? 0) > 0;
  const net = input.amountIsk - (input.refundedIsk ?? 0);
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Lifeline Health</Text>
            <Text style={s.brandSub}>Reykjavík · lifelinehealth.is · contact@lifelinehealth.is</Text>
          </View>
          <View>
            <Text style={s.receiptLabel}>{refunded ? "Credit note" : "Receipt"}</Text>
            <Text style={s.receiptNum}>{input.receiptNumber}</Text>
            <Text style={s.receiptDate}>Issued {fmtDate(input.issuedAtIso)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Billed to</Text>
          <Text style={{ fontWeight: "bold" }}>{input.client.fullName}</Text>
          <Text style={{ color: "#6B7280" }}>{input.client.email}</Text>
          {input.client.addressLine ? <Text style={{ color: "#6B7280" }}>{input.client.addressLine}</Text> : null}
          {input.client.kennitala ? <Text style={{ color: "#6B7280" }}>Kennitala: {input.client.kennitala}</Text> : null}
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Booking</Text>
          <View style={s.row}><Text style={s.label}>Booking reference</Text><Text style={s.value}>{input.bookingId.slice(0, 8)}</Text></View>
          {input.scheduledAtIso ? (
            <View style={s.row}><Text style={s.label}>Scheduled</Text><Text style={s.value}>{fmtDateTime(input.scheduledAtIso)}</Text></View>
          ) : null}
          {input.location ? (
            <View style={s.row}><Text style={s.label}>Location</Text><Text style={s.value}>{input.location}</Text></View>
          ) : null}
          {input.paidAtIso ? (
            <View style={s.row}><Text style={s.label}>Payment date</Text><Text style={s.value}>{fmtDate(input.paidAtIso)}</Text></View>
          ) : null}
          <View style={s.row}><Text style={s.label}>Payment provider</Text><Text style={s.value}>{input.provider.name}{input.provider.reference ? ` · ${input.provider.reference}` : ""}</Text></View>
        </View>

        <View style={s.lineTable}>
          <View style={s.lineRow}>
            <Text style={s.lineDesc}>{input.packageName}</Text>
            <Text style={s.lineQty}>1</Text>
            <Text style={s.linePrice}>{fmtIsk(input.amountIsk)}</Text>
          </View>
        </View>

        <View style={s.totalsBlock}>
          <View style={s.totalsRow}><Text style={s.totalsLabel}>Subtotal</Text><Text style={s.totalsValue}>{fmtIsk(input.amountIsk)}</Text></View>
          <View style={s.totalsRow}><Text style={s.totalsLabel}>VAT (healthcare, exempt)</Text><Text style={s.totalsValue}>0 ISK</Text></View>
          {refunded ? (
            <View style={s.totalsRow}><Text style={[s.totalsLabel, { color: "#DC2626" }]}>Refund</Text><Text style={[s.totalsValue, { color: "#DC2626" }]}>−{fmtIsk(input.refundedIsk ?? 0)}</Text></View>
          ) : null}
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>{refunded ? "Net" : "Total paid"}</Text>
            <Text style={s.grandTotalValue}>{fmtIsk(net)}</Text>
          </View>
        </View>

        <View style={s.footnote}>
          <Text>Healthcare services are exempt from VAT in Iceland under Act 50/1988, Article 3.</Text>
          <Text>This receipt is issued electronically and is valid without signature.</Text>
          {refunded ? <Text style={{ color: "#DC2626" }}>A refund of {fmtIsk(input.refundedIsk ?? 0)} was issued. Net amount paid: {fmtIsk(net)}.</Text> : null}
        </View>

        <View style={s.footer}>
          <Text>Lifeline Health · lifelinehealth.is</Text>
          <Text>Receipt {input.receiptNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderBookingReceiptPdf(input: BookingReceiptInput): Promise<Buffer> {
  const instance = pdf(<ReceiptDocument input={input} />);
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
