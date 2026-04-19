export type CalendarEvent = {
  title: string;
  start: Date;
  /** Duration in minutes. If `end` is provided it wins. */
  durationMinutes?: number;
  end?: Date;
  description?: string;
  location?: string;
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a date as compact UTC for Google Calendar/ICS: 20260418T083000Z */
function formatUTC(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function computeEnd(ev: CalendarEvent): Date {
  if (ev.end) return ev.end;
  const mins = ev.durationMinutes ?? 30;
  return new Date(ev.start.getTime() + mins * 60_000);
}

/**
 * Build a Google Calendar deeplink. Opening it prompts the user to save the
 * event to their own calendar — no OAuth required, works in any browser.
 */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const end = computeEnd(ev);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${formatUTC(ev.start)}/${formatUTC(end)}`,
  });
  if (ev.description) params.set("details", ev.description);
  if (ev.location) params.set("location", ev.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Build an RFC 5545 .ics body for Apple Calendar / Outlook / anything else. */
export function icsBody(ev: CalendarEvent): string {
  const end = computeEnd(ev);
  const uid = `${formatUTC(ev.start)}-${Math.random().toString(36).slice(2, 10)}@lifelinehealth.is`;
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lifeline Health//Account//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatUTC(new Date())}`,
    `DTSTART:${formatUTC(ev.start)}`,
    `DTEND:${formatUTC(end)}`,
    `SUMMARY:${escape(ev.title)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${escape(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${escape(ev.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Trigger a browser download of an .ics file for the given event. */
export function downloadIcs(ev: CalendarEvent, filename = "lifeline-event.ics"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([icsBody(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
