import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// Register Noto Sans for Icelandic diacritic support. Idempotent across modules.
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
  badge: {
    alignSelf: "flex-start",
    fontSize: 9,
    fontWeight: "bold",
    color: "#047857",
    backgroundColor: "#ECFDF5",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  h1: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#6B7280", marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: "#6B7280", letterSpacing: 1.5, marginTop: 14, marginBottom: 6, textTransform: "uppercase" },
  kvRow: { flexDirection: "row", marginBottom: 4 },
  kvLabel: { width: 140, color: "#6B7280", fontSize: 10 },
  kvValue: { flex: 1, fontSize: 10, fontWeight: "bold" },
  auditBox: { marginTop: 8, padding: 10, backgroundColor: "#F3F4F6", borderRadius: 4 },
  auditLine: { fontSize: 9, color: "#4B5563", marginBottom: 3 },
  divider: { borderBottomWidth: 2, borderBottomColor: "#D1D5DB", marginTop: 20, marginBottom: 14 },
  docHeader: { fontSize: 14, fontWeight: "bold", marginBottom: 6 },
  docText: { fontSize: 9.5, lineHeight: 1.45, color: "#1F2937", textAlign: "justify" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#9CA3AF" },
  legalNote: { fontSize: 9, color: "#6B7280", marginTop: 12, lineHeight: 1.5, fontStyle: "italic" },
});

export interface AcceptancePdfProps {
  userEmail: string;
  userId: string;
  documentKey: string;
  documentTitle: string;        // human-readable, e.g. "Notkunarskilmálar (Terms of Service)"
  documentVersion: string;
  documentText: string;         // full rendered text of the document
  textHash: string;             // sha256 hex
  ip: string | null;
  userAgent: string | null;
  acceptedAt: string;           // ISO timestamp
}

function AcceptanceDocument(p: AcceptancePdfProps) {
  const dateLong = new Date(p.acceptedAt).toLocaleString("is-IS", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <Document
      title={`Acceptance — ${p.documentKey}@${p.documentVersion} — ${p.userEmail}`}
      author="Lifeline Health ehf."
      subject={`${p.documentKey} ${p.documentVersion}`}
    >
      {/* ── PAGE 1: Certificate + audit ───────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.badge}>STAÐFEST · RAFRÆNT SAMÞYKKT</Text>
        <Text style={s.h1}>Staðfesting á samþykki</Text>
        <Text style={s.subtitle}>Certificate of acceptance — Lifeline Health ehf.</Text>

        <Text style={s.sectionTitle}>Samþykkt skjal</Text>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Titill</Text>
          <Text style={s.kvValue}>{p.documentTitle}</Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Auðkenni</Text>
          <Text style={s.kvValue}>{p.documentKey}</Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Útgáfa</Text>
          <Text style={s.kvValue}>{p.documentVersion}</Text>
        </View>

        <Text style={s.sectionTitle}>Undirritandi</Text>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Netfang</Text>
          <Text style={s.kvValue}>{p.userEmail}</Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Notandaauðkenni</Text>
          <Text style={[s.kvValue, { fontFamily: "Noto Sans", fontSize: 8, fontWeight: "normal" }]}>{p.userId}</Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Tímastimpill</Text>
          <Text style={s.kvValue}>{dateLong}</Text>
        </View>

        <Text style={s.sectionTitle}>Rafræn sönnun (Digital audit trail)</Text>
        <View style={s.auditBox}>
          <Text style={s.auditLine}>Tímastimpill (UTC): {new Date(p.acceptedAt).toISOString()}</Text>
          <Text style={s.auditLine}>IP-tala: {p.ip || "—"}</Text>
          <Text style={s.auditLine}>Vafraauðkenni: {(p.userAgent || "—").slice(0, 200)}</Text>
          <Text style={s.auditLine}>SHA-256 texta: {p.textHash}</Text>
        </View>

        <Text style={s.legalNote}>
          Þessi staðfesting er rafræn sönnun þess að ofangreindur aðili hafi samþykkt skjalið á tímapunktinum sem skráður
          er hér að ofan. Samþykkið er bindandi og jafngilt rituðu samþykki, sbr. lög nr. 28/2001 um rafrænar
          undirskriftir. Frumtexti skjalsins er varðveittur í þjónustukerfi Lifeline Health og hashurinn (SHA-256) er
          sannprófanlegur sönnun þess hvaða útgáfa var samþykkt.
        </Text>

        <View style={s.footer} fixed>
          <Text>Lifeline Health ehf. · kt. 590925-1440</Text>
          <Text render={({ pageNumber, totalPages }) => `Síða ${pageNumber} af ${totalPages}`} />
        </View>
      </Page>

      {/* ── PAGE 2+: Full document text ───────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.docHeader}>{p.documentTitle}</Text>
        <Text style={[s.subtitle, { marginBottom: 10 }]}>Útgáfa {p.documentVersion} · SHA-256: {p.textHash.slice(0, 24)}…</Text>
        <View style={s.divider} />
        <Text style={s.docText}>{p.documentText}</Text>

        <View style={s.footer} fixed>
          <Text>Lifeline Health ehf. · kt. 590925-1440</Text>
          <Text render={({ pageNumber, totalPages }) => `Síða ${pageNumber} af ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderAcceptancePdf(props: AcceptancePdfProps): Promise<Buffer> {
  const instance = pdf(<AcceptanceDocument {...props} />);
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
