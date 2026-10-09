// .ics subscription of a customer's journey appointments (Apple / Outlook /
// other). Same items as the Google push sync (src/lib/hc/appointments.ts).
// The unguessable token in the URL is the credential.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildIcs } from "@/lib/hc/ics";
import { clientAppointments, trainingCommitments } from "@/lib/hc/appointments";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.replace(/\.ics$/, "");
  if (token.length < 20) return new Response("Not found", { status: 404 });
  const { data: feed } = await supabaseAdmin.from("account_calendar_feeds").select("user_id").eq("token", token).maybeSingle();
  if (!feed) return new Response("Not found", { status: 404 });
  /**
   * Appointments and the training week both.
   *
   * The feed carried bookings only, so somebody who subscribed to it saw
   * their nurse viðtal and none of the training they had actually planned —
   * which is the half of the week that changes. The Google push sync has
   * taken both all along; this is the same two sources, so the two paths
   * cannot show different weeks.
   *
   * Only commitments with an hour on them become events: a lift someone has
   * pencilled in for "Thursday" with no time is not a calendar entry, and
   * trainingCommitments already drops those.
   */
  const [appts, training] = await Promise.all([
    clientAppointments(feed.user_id),
    trainingCommitments(feed.user_id).catch(() => []),
  ]);
  const items = [...appts, ...training];
  const ics = buildIcs("Lifeline heilsuferð", items.map((i) => ({
    uid: `hc-${i.id}`, start: new Date(i.start), minutes: i.minutes, title: i.summary, description: i.description, location: i.location,
  })));
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="lifeline-heilsuferd.ics"', "Cache-Control": "no-store" },
  });
}
