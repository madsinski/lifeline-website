// Build the 4-sheet research Excel workbook (Wide + Long + Answers + Dictionary)
// from DB rows, with units in the Wide headers and missing-data highlighting:
//   - a feature column that is MOSTLY missing (>= 50% blank) -> red header
//   - individual blank cells -> light-red fill
// Mirrors the standalone openpyxl generator. Server-only (ExcelJS).

import ExcelJS from "exceljs";

export interface WbObservation {
  medalia_patient_id: string;
  timepoint_label: string;
  timepoint_order: number;
  obs_type: string;
  code: string;
  feature: string;
  display: string | null;
  observed_at: string | null;
  value_num: number | null;
  value_text: string | null;
  value_bool: boolean | null;
  unit: string | null;
}
export interface WbAnswer {
  medalia_patient_id: string;
  questionnaire_title: string | null;
  authored_at: string | null;
  link_id: string | null;
  question_text: string | null;
  value_text: string | null;
}

const RED_CELL = "FFFFC7CE";   // light red — a missing cell
const RED_HEADER = "FFC00000"; // dark red — a mostly-missing column
const HEADER = "FF1F4E4E";     // emerald header
const MOSTLY_MISSING = 0.5;

const obsValue = (o: WbObservation): number | string | boolean | null =>
  o.value_num ?? o.value_text ?? o.value_bool ?? null;

export async function buildResearchWorkbook(
  cohortName: string,
  observations: WbObservation[],
  answers: WbAnswer[],
): Promise<Buffer> {
  // resolve unit per feature: first non-empty, infer % for *_percent
  const unitByFeature = new Map<string, string>();
  const metaByFeature = new Map<string, { obs_type: string; code: string; display: string | null }>();
  for (const o of observations) {
    if (!metaByFeature.has(o.feature)) metaByFeature.set(o.feature, { obs_type: o.obs_type, code: o.code, display: o.display });
    const u = (o.unit || "").trim();
    if (u && !unitByFeature.get(o.feature)) unitByFeature.set(o.feature, u);
  }
  const features = [...metaByFeature.keys()].sort();
  for (const f of features) if (!unitByFeature.get(f) && f.endsWith("_percent")) unitByFeature.set(f, "%");
  const withUnit = (f: string) => (unitByFeature.get(f) ? `${f} (${unitByFeature.get(f)})` : f);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lifeline Research";

  const styleHeader = (ws: ExcelJS.Worksheet, redCols: Set<number> = new Set()) => {
    const row = ws.getRow(1);
    row.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: redCols.has(col) ? RED_HEADER : HEADER } };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const autosize = (ws: ExcelJS.Worksheet, headers: string[]) => {
    headers.forEach((h, i) => { ws.getColumn(i + 1).width = Math.min(Math.max(12, h.length + 2), 42); });
  };

  // ---------- WIDE ----------
  const wide = wb.addWorksheet("Wide");
  const wideHeader = ["patientId", "timepoint", ...features.map(withUnit)];
  wide.addRow(wideHeader);
  // grid keyed by patient+timepoint
  const grid = new Map<string, { patientId: string; timepoint: string; order: number; vals: Record<string, unknown> }>();
  for (const o of observations) {
    const k = `${o.medalia_patient_id}@@${o.timepoint_label}`;
    if (!grid.has(k)) grid.set(k, { patientId: o.medalia_patient_id, timepoint: o.timepoint_label, order: o.timepoint_order, vals: {} });
    const v = obsValue(o);
    if (v !== null && v !== undefined) grid.get(k)!.vals[o.feature] = v;
  }
  const wideRows = [...grid.values()].sort((a, b) => a.patientId.localeCompare(b.patientId) || a.order - b.order);
  for (const r of wideRows) {
    wide.addRow([r.patientId, r.timepoint, ...features.map((f) => r.vals[f] ?? null)]);
  }
  // missing-data marking (feature columns start at index 3 / column 3)
  const nRows = wideRows.length;
  const redHeaderCols = new Set<number>();
  features.forEach((f, fi) => {
    const col = fi + 3;
    const missRows: number[] = [];
    wideRows.forEach((r, ri) => { if (r.vals[f] === undefined || r.vals[f] === null) missRows.push(ri); });
    if (!missRows.length) return;
    const frac = nRows ? missRows.length / nRows : 0;
    if (frac >= MOSTLY_MISSING) redHeaderCols.add(col);
    for (const ri of missRows) {
      wide.getRow(ri + 2).getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_CELL } };
    }
  });
  styleHeader(wide, redHeaderCols);
  autosize(wide, wideHeader);
  wide.autoFilter = { from: { row: 1, column: 1 }, to: { row: nRows + 1, column: wideHeader.length } };

  // ---------- LONG ----------
  const long = wb.addWorksheet("Long");
  const longHeader = ["patientId", "timepoint", "type", "code", "feature", "display", "date", "value_num", "value_text", "value_bool", "unit"];
  long.addRow(longHeader);
  for (const o of observations) {
    long.addRow([o.medalia_patient_id, o.timepoint_label, o.obs_type, o.code, o.feature, o.display, o.observed_at, o.value_num, o.value_text, o.value_bool, o.unit]);
  }
  styleHeader(long);
  autosize(long, longHeader);

  // ---------- ANSWERS ----------
  const ans = wb.addWorksheet("Answers");
  const ansHeader = ["patientId", "questionnaireTitle", "authored", "linkId", "questionText", "value"];
  ans.addRow(ansHeader);
  for (const a of answers) {
    ans.addRow([a.medalia_patient_id, a.questionnaire_title, a.authored_at, a.link_id, a.question_text, a.value_text]);
  }
  styleHeader(ans);
  autosize(ans, ansHeader);

  // ---------- DICTIONARY ----------
  const dict = wb.addWorksheet("Dictionary");
  const dictHeader = ["feature", "type", "code", "display", "unit", "present", "missing", "pct_missing"];
  dict.addRow(dictHeader);
  for (const f of features) {
    const m = metaByFeature.get(f)!;
    const present = wideRows.filter((r) => r.vals[f] !== undefined && r.vals[f] !== null).length;
    const missing = nRows - present;
    dict.addRow([f, m.obs_type, m.code, m.display, unitByFeature.get(f) || "", present, missing, nRows ? Math.round((1000 * missing) / nRows) / 10 : 0]);
  }
  styleHeader(dict);
  autosize(dict, dictHeader);

  void cohortName;
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
