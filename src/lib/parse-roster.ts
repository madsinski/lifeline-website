import { cleanKennitala, isValidKennitala, cleanIcelandicPhone, isValidIcelandicPhone } from "./kennitala";

export interface RosterRow {
  full_name: string;
  kennitala: string;
  email: string;
  phone: string;
  errors: string[];
}

const HEADER_ALIASES: Record<string, keyof Omit<RosterRow, "errors">> = {
  name: "full_name", "full name": "full_name", fullname: "full_name", navn: "full_name", nafn: "full_name",
  kennitala: "kennitala", "personal id": "kennitala", "personal identifier": "kennitala", ssn: "kennitala",
  email: "email", "email address": "email", netfang: "email", "e-mail": "email",
  phone: "phone", "phone number": "phone", simi: "phone", sími: "phone", mobile: "phone",
};

function detectDelimiter(firstLine: string): string {
  const tab = (firstLine.match(/\t/g) || []).length;
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  if (tab >= semi && tab >= comma) return "\t";
  if (semi >= comma) return ";";
  return ",";
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      cur += c;
    } else {
      if (c === '"') { inQuotes = true; continue; }
      if (c === delim) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseRoster(input: string): RosterRow[] {
  const text = (input || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n").filter((l) => l.trim().length);
  if (!lines.length) return [];

  const delim = detectDelimiter(lines[0]);
  const firstCols = splitCsvLine(lines[0], delim);
  const isHeader = firstCols.some((c) =>
    HEADER_ALIASES[c.toLowerCase()] != null
  );

  const headerMap: Array<keyof Omit<RosterRow, "errors"> | null> = isHeader
    ? firstCols.map((c) => HEADER_ALIASES[c.toLowerCase()] ?? null)
    : ["full_name", "kennitala", "email", "phone"];

  const dataLines = isHeader ? lines.slice(1) : lines;
  const rows: RosterRow[] = [];

  for (const line of dataLines) {
    const cells = splitCsvLine(line, delim);
    const row: RosterRow = { full_name: "", kennitala: "", email: "", phone: "", errors: [] };
    headerMap.forEach((key, i) => {
      if (!key) return;
      row[key] = (cells[i] ?? "").trim();
    });

    row.kennitala = cleanKennitala(row.kennitala);
    row.phone = cleanIcelandicPhone(row.phone);

    if (!row.full_name) row.errors.push("Name required");
    if (!isValidKennitala(row.kennitala)) row.errors.push("Invalid kennitala");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.errors.push("Invalid email");
    if (row.phone && !isValidIcelandicPhone(row.phone)) row.errors.push("Invalid phone");

    rows.push(row);
  }
  return rows;
}

export function generatePassword(): string {
  // 6 digits — memorable, fine for link-gated access.
  return Math.floor(100000 + Math.random() * 900000).toString();
}
