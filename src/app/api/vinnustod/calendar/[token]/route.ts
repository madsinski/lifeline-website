// .ics feed of a workstation user's assigned interviews and follow-ups.
// The unguessable token in the URL is the credential. Initials only.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildIcs } from "@/lib/hc/ics";
import { workerAppointments } from "@/lib/hc/appointments";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.replace(/\.ics$/, "");
  if (token.length < 20) return new Response("Not found", { status: 404 });
  const { data: w } = await supabaseAdmin.from("hc_workers").select("id, active").eq("calendar_token", token).maybeSingle();
  if (!w?.active) return new Response("Not found", { status: 404 });
  const items = await workerAppointments(w.id);
  const ics = buildIcs("Lifeline — viðtöl", items.map((i) => ({
    uid: `hc-${i.id}`, start: new Date(i.start), minutes: i.minutes, title: i.summary, description: i.description, location: i.location,
  })));
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="lifeline-vidtol.ics"', "Cache-Control": "no-store" },
  });
}
