// RFC 5545 helpers for the journey calendar feed. Ported from the
// Fjarlækningar HSU feed (api/hsu/calendar/[token]).

const pad = (n: number) => String(n).padStart(2, "0");

export const icsStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export const icsEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r\n?|\n/g, "\\n");

/** Lines longer than 75 bytes are folded with CRLF + space, never inside a UTF-8 character. */
export function icsFold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return parts.join("\r\n ");
}

export interface IcsEvent {
  uid: string;
  start: Date;
  minutes: number;
  title: string;
  description?: string;
  location?: string | null;
}

export function buildIcs(calName: string, events: IcsEvent[]): string {
  const now = icsStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lifeline Health//Heilsuferd//IS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    "X-WR-TIMEZONE:Atlantic/Reykjavik",
  ];
  for (const e of events) {
    const end = new Date(e.start.getTime() + e.minutes * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@lifelinehealth.is`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsStamp(e.start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsEscape(e.title)}`,
      ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
      ...(e.description ? [`DESCRIPTION:${icsEscape(e.description)}`] : []),
      "BEGIN:VALARM",
      "TRIGGER:-PT2H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(e.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
