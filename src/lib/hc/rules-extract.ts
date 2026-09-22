// Extract a union's reimbursement rules from its uploaded rules document
// (PDF, DOCX, TXT) into the UnionRules shape. The result is a DRAFT: it is
// shown next to the source in /admin/unions and only takes effect when a
// human saves it. Server-only.

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { docxToText } from "./doc-text";
import type { UnionRules } from "./reimbursement";

const MODEL = "gpt-5.4";

const ruleSchema = z.object({
  applies: z.boolean().describe("Does the fund reimburse this category at all?"),
  percent: z.number().nullable().describe("Share of the cost reimbursed, 0-100"),
  max_isk: z.number().nullable().describe("Maximum amount per claim in ISK"),
  fixed_isk: z.number().nullable().describe("Fixed grant amount in ISK, if the rule is a fixed amount rather than a percentage"),
  period_months: z.number().nullable().describe("How often the grant can be claimed, in months (12 = once a year)"),
  min_membership_months: z.number().nullable().describe("Months of paid membership required"),
  notes: z.string().nullable().describe("Conditions in Icelandic, one or two sentences"),
  source_quote: z.string().nullable().describe("The exact sentence(s) from the document this is based on"),
});

const schema = z.object({
  union_name: z.string().nullable(),
  health_check: ruleSchema.describe("Health check / heilsufarsskoðun / heilsumat / forvarnarskoðun / krabbameinsleit-type preventive check"),
  followup: ruleSchema.describe("Follow-up consultation with a nurse, lifestyle counselling, heilsuráðgjöf, viðtalsmeðferð"),
  requires_receipt: z.boolean(),
  application_notes: z.string().nullable().describe("How members apply, in Icelandic: deadlines, documents needed, where to send"),
  summary: z.string().describe("Two-sentence Icelandic summary of what the fund covers relevant to a lifestyle health check"),
  confidence: z.enum(["high", "medium", "low"]),
});

export type RulesExtraction = z.infer<typeof schema>;

const SYSTEM = `You read Icelandic union health-fund rules (reglur sjúkrasjóðs / styrktarsjóðs) and extract what the fund pays toward a preventive lifestyle health check sold by a licensed provider (blood test, measurements, doctor-confirmed report, nurse interview, 3-month action plan), and toward follow-up nurse consultations.
Look for categories such as: heilsufarsskoðun, heilsumat, forvarnir, líkamsrækt/heilsurækt (only if a health check is explicitly included), hjartavernd, krabbameinsleit, sálfræðiþjónusta/viðtalsmeðferð, heilsuefling.
Never invent numbers. If the document does not state something, return null. If no category plausibly covers the service, set applies=false. Quote the source sentence.`;

export async function extractUnionRules(file: { buffer: Buffer; mimeType: string; fileName: string }): Promise<{
  extraction: RulesExtraction;
  rules: UnionRules;
  text: string | null;
}> {
  const lower = file.fileName.toLowerCase();
  let text: string | null = null;
  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: string; mediaType: string; filename: string }
  > = [{ type: "text", text: "Extract the reimbursement rules from this document." }];

  if (file.mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    content.push({ type: "file", data: file.buffer.toString("base64"), mediaType: "application/pdf", filename: file.fileName });
  } else if (lower.endsWith(".docx")) {
    text = docxToText(file.buffer);
    if (!text) throw new Error("Gat ekki lesið texta úr DOCX-skjalinu.");
    content.push({ type: "text", text: text.slice(0, 120_000) });
  } else {
    text = file.buffer.toString("utf8");
    content.push({ type: "text", text: text.slice(0, 120_000) });
  }

  const result = await generateText({
    model: openai(MODEL),
    output: Output.object({ schema }),
    system: SYSTEM,
    messages: [{ role: "user", content }],
    maxOutputTokens: 2500,
  });
  const extraction = result.experimental_output as RulesExtraction;

  const toRule = (r: RulesExtraction["health_check"]) =>
    r.applies
      ? {
          percent: r.percent,
          max_isk: r.max_isk,
          fixed_isk: r.fixed_isk,
          period_months: r.period_months,
          min_membership_months: r.min_membership_months,
          notes: r.notes,
        }
      : undefined;

  const categories: UnionRules["categories"] = {};
  const hc = toRule(extraction.health_check);
  const fu = toRule(extraction.followup);
  if (hc) categories.health_check = hc;
  if (fu) categories.followup = fu;

  return {
    extraction,
    rules: { categories, requires_receipt: extraction.requires_receipt, application_notes: extraction.application_notes },
    text,
  };
}
