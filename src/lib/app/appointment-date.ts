// Parse what appointments.date and .time actually hold.
//
// Both columns are `text`, and they store US display strings written by the
// app's booking UI rather than values a database can order:
//
//   date  "April 13, 2026"   (77 of 77 rows; none are ISO)
//   time  "12:20 PM" (60)    or "11:30" (17)
//
// This matters beyond formatting. A PostgREST filter like
// .gte("date", "2026-10-08") on a text column is an alphabetical compare,
// and "April 13, 2026" sorts after "2026-10-08" because "A" > "2" — so every
// April appointment passes as "upcoming". Any date filter has to happen
// after parsing, which is what this is for.
//
// Writing real `date`/`time` columns is the actual fix and belongs in the app
// that writes them; this reads what is there today without touching it.

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * A real Date from the stored strings, or null when the shape is unknown —
 * null rather than a guess, so a bad row drops out of a list instead of
 * appearing on the wrong day.
 */
export function parseAppointment(date: string | null, time: string | null): Date | null {
  if (!date) return null;
  let y: number, m: number, d: number;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])];
  } else {
    // "April 13, 2026" — and tolerate a missing comma.
    const us = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(date.trim());
    if (!us) return null;
    const mo = MONTHS[us[1].toLowerCase()];
    if (mo === undefined) return null;
    [y, m, d] = [Number(us[3]), mo, Number(us[2])];
  }

  let hh = 0, mm = 0;
  if (time) {
    const t = time.trim();
    const h12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t);
    const h24 = /^(\d{1,2}):(\d{2})/.exec(t);
    if (h12) {
      hh = Number(h12[1]) % 12;
      if (h12[3].toUpperCase() === "PM") hh += 12;
      mm = Number(h12[2]);
    } else if (h24) {
      [hh, mm] = [Number(h24[1]), Number(h24[2])];
    }
  }

  const dt = new Date(y, m, d, hh, mm);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Which appointments count as coming up.
 *
 * Only "booked" does. The statuses in the table are booked (3), completed (1)
 * and cancelled (73), so excluding just "cancelled" would leave a finished
 * appointment sitting in the list as though it were still ahead.
 */
export const UPCOMING_STATUS = "booked";

/** The app's own type values. Note the hyphen in blood-test. */
export const APPOINTMENT_KIND: Record<string, string> = {
  measurement: "measurement-appt",
  "blood-test": "bloodtest-appt",
  consultation: "coach-consultation",
};
