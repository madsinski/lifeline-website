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
import { mapValues, parseReport, parseReportText, type MappedValue, type ReportFile } from "./report-import";

/**
 * How the report was read.
 *   local        — our own parser, on our own server, nothing left the box.
 *   ai-text      — scrubbed text sent to the model; the document stayed here.
 *   ai-document  — the document itself was sent. Scans and photos only.
 *   needs-consent — we could not read it here and nobody has agreed to send it.
 */
export type ReadMethod = "local" | "ai-text" | "ai-document" | "needs-consent";

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

/**
 * Grunnheilsa rows → the flat value list the rest of the workstation speaks.
 *
 * Every row carries its hc_knowledge slug, and each slug is on the same scale
 * as the value: the 0–10 scores point at their own "skor-*" entries, not at
 * the questionnaire behind them. That matters twice over — nine of them used
 * to share "stodaeinkunnir" and overwrite each other in hc_results, and a
 * score pointed at PGSI or CIUS came back out wearing the inverted light.
 * See scripts/hc-seed-score-knowledge.mjs.
 */
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

export async function readReport(
  files: ReportFile[],
  /** Set once the nurse has agreed to send a document we cannot read here. */
  opts: { allowAi?: boolean } = {},
): Promise<ReadResult> {
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

  // Not one of ours. Anything past this point leaves the building, so it is
  // the nurse's call, not a silent fallback.
  if (!opts.allowAi) {
    return {
      method: "needs-consent",
      report: null,
      values: [],
      identity: { name: null, kennitala: null, sex: null, age: null, email: null, phone: null },
      reportDate: null,
      warnings: [
        text
          ? "Skjalið er ekki Lifeline-skýrsla. Við getum lesið það með AI, en þá fer textinn úr því til OpenAI í Bandaríkjunum. Kennitala, netfang og símanúmer eru fjarlægð fyrst."
          : "Það er enginn texti í skjalinu, svo það er líklega skannað eða mynd. Við getum lesið það með AI, en þá fer skjalið sjálft til OpenAI í Bandaríkjunum og ekki er hægt að fjarlægja auðkenni úr mynd.",
      ],
    };
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Skráin er ekki Lifeline-skýrsla og AI-lestur er ekki uppsettur.");
  }
  // Text can be scrubbed and costs less; only a scan has to travel whole.
  const viaText = text.trim().length > 200;
  const parsed = viaText ? await parseReportText(text) : await parseReport(files);
  const kt = (parsed.patient?.kennitala || "").replace(/\D/g, "");
  return {
    method: viaText ? "ai-text" : "ai-document",
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
      viaText
        ? "Skjalið var ekki lesið sem Lifeline-skýrsla. Textinn úr því var sendur í AI-lestur án kennitölu, netfangs og símanúmers."
        : "Skjalið var ekki lesið sem Lifeline-skýrsla og hafði engan texta, svo skjalið sjálft var sent í AI-lestur.",
      ...(parsed.warnings ?? []),
    ],
  };
}
