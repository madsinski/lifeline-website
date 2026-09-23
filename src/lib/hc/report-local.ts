// Reading an uploaded report, privately where we can.
//
// Order of attempts:
//   1. Pull the text out of the PDF here on the server (unpdf) and parse a
//      Lifeline Grunnheilsa report deterministically. Nothing leaves the box.
//   2. Only if that fails — a scan, a photo, another lab's layout — fall back
//      to the model, and say so, because that does send the document out.
//
// Server-only.

import { extractText, getDocumentProxy } from "unpdf";
import { isGrunnheilsa, parseGrunnheilsa, type Grunnheilsa } from "./grunnheilsa";
import { mapValues, parseReport, type MappedValue, type ReportFile } from "./report-import";

export type ReadMethod = "local" | "ai";

export interface ReadResult {
  method: ReadMethod;
  /** The full Grunnheilsa report when we parsed one ourselves. */
  report: Grunnheilsa | null;
  /** Flat values, in the shape the results card and hc_results already use. */
  values: MappedValue[];
  identity: { name: string | null; kennitala: string | null; sex: "m" | "f" | null; age: number | null; email: string | null; phone: string | null };
  reportDate: string | null;
  warnings: string[];
}

/** Text of every PDF in the upload, concatenated. Images yield nothing. */
async function pdfText(files: ReportFile[]): Promise<string> {
  const parts: string[] = [];
  for (const f of files) {
    if (f.mediaType !== "application/pdf") continue;
    try {
      const pdf = await getDocumentProxy(f.data);
      const { text } = await extractText(pdf, { mergePages: true });
      if (text) parts.push(text);
    } catch {
      // A PDF we cannot open is simply not a local candidate.
    }
  }
  return parts.join("\n");
}

/** Grunnheilsa rows → the flat value list the rest of the workstation speaks. */
export function valuesFromReport(report: Grunnheilsa): MappedValue[] {
  return report.items
    .filter((i) => i.slug || i.kind === "score" || i.kind === "risk")
    .map((i) => ({
      slug: i.slug ?? null,
      code: i.key.toUpperCase(),
      label: i.title,
      value: i.value,
      unit: i.unit,
      confidence: "high" as const,
    }));
}

export async function readReport(files: ReportFile[]): Promise<ReadResult> {
  const text = await pdfText(files);

  if (text && isGrunnheilsa(text)) {
    const report = parseGrunnheilsa(text);
    if (report.items.length >= 5) {
      return {
        method: "local",
        report,
        values: valuesFromReport(report),
        identity: {
          name: report.patient.name,
          kennitala: report.patient.kennitala,
          sex: report.patient.sex,
          age: report.patient.age,
          email: report.patient.email,
          phone: report.patient.phone,
        },
        reportDate: report.reportDate,
        warnings: [],
      };
    }
  }

  // Not one of ours, or not readable as text: hand it to the model.
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Skráin er ekki Lifeline-skýrsla og AI-lestur er ekki uppsettur.");
  }
  const parsed = await parseReport(files);
  const kt = (parsed.patient?.kennitala || "").replace(/\D/g, "");
  return {
    method: "ai",
    report: null,
    values: mapValues(parsed),
    identity: {
      name: parsed.patient?.name ?? null,
      kennitala: kt || null,
      sex: null,
      age: null,
      email: null,
      phone: null,
    },
    reportDate: parsed.report?.date_iso ?? null,
    warnings: [
      "Skráin var ekki lesin sem Lifeline-skýrsla, svo hún var send í AI-lestur.",
      ...(parsed.warnings ?? []),
    ],
  };
}
