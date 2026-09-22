// .ics subscription of a customer's journey appointments (Apple / Outlook /
// other). Same items as the Google push sync (src/lib/hc/appointments.ts).
// The unguessable token in the URL is the credential.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildIcs } from "@/lib/hc/ics";
import { clientAppointments } from "@/lib/hc/appointments";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.replace(/\.ics$/, "");
  if (token.length < 20) return new Response("Not found", { status: 404 });
  const { data: feed } = await supabaseAdmin.from("account_calendar_feeds").select("user_id").eq("token", token).maybeSingle();
  if (!feed) return new Response("Not found", { status: 404 });
  const items = await clientAppointments(feed.user_id);
  const ics = buildIcs("Lifeline heilsuferð", items.map((i) => ({
    uid: `hc-${i.id}`, start: new Date(i.start), minutes: i.minutes, title: i.summary, description: i.description, location: i.location,
  })));
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="lifeline-heilsuferd.ics"', "Cache-Control": "no-store" },
  });
}
