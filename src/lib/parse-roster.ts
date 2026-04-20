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

// Sentinel for whitespace-run fallback — multiple spaces/tabs between
// columns (common when pasting plain-text tables from email, chat, etc.)
const WS_DELIM = "\u0000WS\u0000";

function detectDelimiter(firstLine: string): string {
  const tab = (firstLine.match(/\t/g) || []).length;
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  // Prefer explicit delimiters when any are present.
  if (tab > 0 && tab >= semi && tab >= comma) return "\t";
  if (semi > 0 && semi >= comma) return ";";
  if (comma > 0) return ",";
  // Fallback: if the line has runs of 2+ whitespace characters, treat those as
  // column breaks. Handles pastes like "Name    1406221680    email@x.com  712345".
  if (/\S\s{2,}\S/.test(firstLine)) return WS_DELIM;
  // Otherwise, default to comma (single-cell parse will trigger validation
  // errors, which is the correct outcome for malformed input).
  return ",";
}

function splitCsvLine(line: string, delim: string): string[] {
  if (delim === WS_DELIM) {
    return line.trim().split(/\s{2,}/).map((s) => s.trim());
  }
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
  // Strip UTF-8 BOM (common in CSVs saved from Excel), normalize line endings, trim
  const text = (input || "").replace(/^\ufeff/, "").replace(/\r\n?/g, "\n").trim();
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
  const seenEmails = new Map<string, number>();
  const seenKennitalas = new Map<string, number>();

  dataLines.forEach((line, idx) => {
    const cells = splitCsvLine(line, delim);
    const row: RosterRow = { full_name: "", kennitala: "", email: "", phone: "", errors: [] };
    headerMap.forEach((key, i) => {
      if (!key) return;
      row[key] = (cells[i] ?? "").trim();
    });

    row.email = row.email.toLowerCase();
    row.kennitala = cleanKennitala(row.kennitala);
    row.phone = cleanIcelandicPhone(row.phone);

    if (!row.full_name) row.errors.push("Name required");
    if (!isValidKennitala(row.kennitala)) row.errors.push("Invalid kennitala");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.errors.push("Invalid email");
    if (row.phone && !isValidIcelandicPhone(row.phone)) row.errors.push("Invalid phone");

    // Duplicate detection within the same paste
    if (row.email) {
      const prev = seenEmails.get(row.email);
      if (prev !== undefined) row.errors.push(`Duplicate email (row ${prev + 1})`);
      else seenEmails.set(row.email, idx);
    }
    if (row.kennitala && isValidKennitala(row.kennitala)) {
      const prev = seenKennitalas.get(row.kennitala);
      if (prev !== undefined) row.errors.push(`Duplicate kennitala (row ${prev + 1})`);
      else seenKennitalas.set(row.kennitala, idx);
    }

    rows.push(row);
  });
  return rows;
}

export function generatePassword(): string {
  // 6 digits — memorable, fine for link-gated access.
  // Uses Web Crypto for unpredictable values; falls back to Math.random only
  // if the runtime is somehow missing it.
  const cryptoObj =
    typeof globalThis !== "undefined" && "crypto" in globalThis
      ? (globalThis as { crypto: Crypto }).crypto
      : null;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    return (100000 + (buf[0] % 900000)).toString();
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
}
