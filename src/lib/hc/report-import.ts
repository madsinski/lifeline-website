// Reading a health report into the workstation.
//
// A nurse uploads the Medalia PDF, a lab printout or photos of either; the
// file is parsed in this function's call stack and never stored. Only the
// extracted values are kept (hc_results), so the workstation can show them
// beside Lifeline's reference bands. The record itself stays in Medalia.
//
// Server-only: needs OPENAI_API_KEY.

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const REPORT_MODEL = process.env.OPENAI_MODEL_REPORT || "gpt-5.4";

/** Lab codes (the app's canonical catalog) → hc_knowledge slugs. */
export const CODE_TO_SLUG: Record<string, string> = {
  "INS-F": "insulin",
  "HOMA-IR": "homa-ir",
  HBA1C: "hba1c",
  "GLU-F": "fastandi-blodsykur",
  TC: "heildarkolesterol",
  "HDL-C": "hdl",
  "LDL-C": "ldl",
  TG: "thriglyserid",
  "APO-B": "apo-b",
  ALT: "alt",
  AST: "ast",
  GGT: "ggt",
  "25OHD": "d-vitamin",
  FERR: "ferritin",
  TSH: "tsh",
  HSCRP: "hscrp",
  // Measurements, not blood:
  BMI: "bmi",
  FAT: "fitumassi",
  MUSCLE: "vodvamassi",
  "BP-SYS": "blodthrystingur",
  "BP-DIA": "blodthrystingur-nedri",
  VO2MAX: "vo2max",
};

/** What the model is asked to look for, with the aliases a report may use. */
const CATALOG = `
INS-F      fastandi insúlín, insulin, s-insúlín        mIU/L
HOMA-IR    homa, homa-ir, insúlínviðnám                (stuðull)
HBA1C      hba1c, langtímablóðsykur, sykurpróf         mmol/mol eða %
GLU-F      glúkósi, fastandi blóðsykur, glucose        mmol/L
TC         heildarkólesteról, kólesteról, total chol   mmol/L
HDL-C      hdl, hdl-kólesteról                         mmol/L
LDL-C      ldl, ldl-kólesteról                         mmol/L
TG         þríglýseríð, triglycerides                  mmol/L
APO-B      apo b, apolipoprotein b                     g/L
ALT        alt, alat                                   U/L
AST        ast, asat                                   U/L
GGT        ggt, gamma gt                               U/L
25OHD      d-vítamín, vitamin d, 25-oh                 nmol/L
FERR       ferritín, ferritin                          µg/L
TSH        tsh                                         mIU/L
HSCRP      crp, hs-crp, hscrp                          mg/L
BMI        bmi, líkamsþyngdarstuðull                   kg/m2
FAT        fitumassi, fituhlutfall, body fat           %
MUSCLE     vöðvamassi, vöðvahlutfall, muscle mass      %
BP-SYS     blóðþrýstingur efri mörk, systolic          mmHg
BP-DIA     blóðþrýstingur neðri mörk, diastolic        mmHg
VO2MAX     vo2max, hámarkssúrefnisupptaka              ml/kg/mín
`.trim();

const schema = z.object({
  report: z.object({
    date_iso: z.string().nullable().describe("Date of the measurements, YYYY-MM-DD, if stated"),
    source: z.enum(["medalia", "lab", "measurement", "other"]).describe("What kind of document this is"),
    fasting: z.boolean().nullable(),
    notes: z.string().nullable().describe("Anything the nurse should know, in Icelandic"),
  }),
  values: z.array(z.object({
    code: z.string().describe("A code from the catalog, or UNKNOWN"),
    raw_label: z.string().describe("The label exactly as the document writes it"),
    value: z.number(),
    unit: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
  })),
  warnings: z.array(z.string()).describe("Anything unreadable or uncertain, in Icelandic"),
});

export type ParsedReport = z.infer<typeof schema>;
export type ParsedValue = ParsedReport["values"][number];

export interface ReportFile {
  /** Raw bytes of a PDF or an image. */
  data: Uint8Array;
  mediaType: string;
  filename?: string;
}

const PROMPT = `Þú lest heilsufarsskýrslur, blóðprufusvör og mæliblöð fyrir hjúkrunarfræðing hjá Lifeline.

Verkefnið:
• Lestu ÖLL mæligildi sem þú finnur og skilaðu þeim á forminu sem beðið er um.
• Notaðu kóða úr listanum hér að neðan þegar mæling passar. Ef mælingin er ekki á listanum skaltu setja code = "UNKNOWN" og skrifa heiti hennar í raw_label.
• Skilaðu tölunni nákvæmlega eins og hún stendur, með þeirri einingu sem skjalið notar. Ekki umreikna.
• Ef gildi er gefið sem bil eða "<" / ">" skaltu sleppa því og setja athugasemd í warnings.
• Ef sama mæling kemur oftar en einu sinni skaltu nota nýjustu dagsetninguna.
• Giskaðu aldrei á tölu. Ef þú ert ekki viss skaltu setja confidence = "low" og útskýra í warnings.
• Athugasemdir og viðvaranir skal skrifa á íslensku.

KÓÐALISTI (kóði — heiti sem geta birst — venjuleg eining):
${CATALOG}`;

/**
 * Parse one or more files (a PDF and/or images of the same report) into
 * structured values. Throws on model/transport errors.
 */
export async function parseReport(files: ReportFile[]): Promise<ParsedReport> {
  const parts = files.map((f) =>
    f.mediaType === "application/pdf"
      ? ({ type: "file", data: f.data, mediaType: "application/pdf", filename: f.filename ?? "report.pdf" } as const)
      : ({ type: "image", image: f.data, mediaType: f.mediaType } as const),
  );

  const result = await generateText({
    model: openai(REPORT_MODEL),
    output: Output.object({ schema }),
    maxOutputTokens: 8000,
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content: [{ type: "text", text: "Lestu þessa skýrslu." }, ...parts] },
    ],
  });
  return result.experimental_output as ParsedReport;
}

/** Unit conversions to the unit our reference bands use. */
const CONVERT: Record<string, { unit: string; from: Record<string, (v: number) => number> }> = {
  hba1c: {
    unit: "mmol/mol",
    // IFCC mmol/mol is what Iceland reports; NGSP % converts back.
    from: { "%": (v) => (v - 2.152) / 0.09148 },
  },
  insulin: { unit: "mIU/L", from: { "pmol/l": (v) => v * 0.144, "µu/ml": (v) => v, "μu/ml": (v) => v, "uiu/ml": (v) => v } },
  ferritin: { unit: "µg/L", from: { "ng/ml": (v) => v } },
  heildarkolesterol: { unit: "mmol/L", from: { "mg/dl": (v) => v * 0.02586 } },
  hdl: { unit: "mmol/L", from: { "mg/dl": (v) => v * 0.02586 } },
  ldl: { unit: "mmol/L", from: { "mg/dl": (v) => v * 0.02586 } },
  thriglyserid: { unit: "mmol/L", from: { "mg/dl": (v) => v * 0.01129 } },
  "fastandi-blodsykur": { unit: "mmol/L", from: { "mg/dl": (v) => v * 0.05551 } },
  "d-vitamin": { unit: "nmol/L", from: { "ng/ml": (v) => v * 2.5 } },
};

export interface MappedValue {
  /** hc_knowledge slug, or null when the marker is outside our reference. */
  slug: string | null;
  code: string;
  label: string;
  value: number;
  unit: string;
  confidence: "high" | "medium" | "low";
  /** Set when the value was converted into the unit our bands use. */
  converted_from?: string;
}

/** Map parsed rows onto reference slugs, converting units where we can. */
export function mapValues(parsed: ParsedReport): MappedValue[] {
  const out: MappedValue[] = [];
  for (const v of parsed.values) {
    const code = (v.code || "").trim().toUpperCase();
    const slug = CODE_TO_SLUG[code] ?? null;
    let value = v.value;
    let unit = (v.unit || "").trim();
    let converted: string | undefined;
    if (slug && CONVERT[slug]) {
      const rule = CONVERT[slug];
      const fn = rule.from[unit.toLowerCase()];
      if (fn && unit.toLowerCase() !== rule.unit.toLowerCase()) {
        converted = unit;
        value = Math.round(fn(value) * 100) / 100;
        unit = rule.unit;
      }
    }
    if (!Number.isFinite(value)) continue;
    out.push({ slug, code, label: v.raw_label || code, value, unit, confidence: v.confidence, converted_from: converted });
  }
  return out;
}
