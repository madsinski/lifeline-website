// What is coming up: the next few things on this person's journey.
//
// Reads clientAppointments(), the same function the .ics feed and the Google
// push both read, so the card on Í dag cannot disagree with the calendar
// somebody subscribed to. Journey steps, coach bookings and timed
// commitments all arrive from it already unioned.

import { NextRequest, NextResponse } from "next/server";
import { clientAppointments } from "@/lib/hc/appointments";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const items = await clientAppointments(user.id).catch(() => []);
  const now = Date.now();
  const soon = items
    /*
     * Weekly training is dropped.
     *
     * It arrives as one recurring event, which is right for a calendar and
     * wrong here: "coming up" would be the same football match every week
     * forever, pushing the blood test nobody wants to miss off the card. Í
     * dag already shows today's training on its own hero.
     */
    .filter((i) => !i.recurrence?.length)
    .filter((i) => new Date(i.start).getTime() > now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 6)
    .map((i) => ({
      id: i.id, start: i.start, minutes: i.minutes,
      title: i.summary.replace(/^Lifeline( Health)?\s*[–—-]\s*/, ""),
      location: i.location, meetingUrl: /^https?:\/\//.test(i.location ?? "") ? i.location : null,
    }));

  return NextResponse.json({ items: soon });
}
