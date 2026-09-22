// .ics subscription of a customer's journey appointments. Google and Apple
// Calendar poll it; the unguessable token in the URL is the credential.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildIcs, type IcsEvent } from "@/lib/hc/ics";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.replace(/\.ics$/, "");
  if (token.length < 20) return new Response("Not found", { status: 404 });
  const { data: feed } = await supabaseAdmin.from("account_calendar_feeds").select("user_id").eq("token", token).maybeSingle();
  if (!feed) return new Response("Not found", { status: 404 });

  const { data: journeys } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, location_id, blood_test_booked_for, measurements_booked_for, interview_booked_for, interview_mode, followup_booked_for")
    .eq("client_id", feed.user_id)
    .is("cancelled_at", null);
  const locIds = Array.from(new Set((journeys || []).map((j) => j.location_id).filter(Boolean)));
  const { data: locs } = locIds.length
    ? await supabaseAdmin.from("hc_locations").select("*").in("id", locIds)
    : { data: [] as Record<string, string | null>[] };
  const locOf = (id: string | null) => (locs || []).find((l) => l.id === id);

  const events: IcsEvent[] = [];
  for (const j of journeys || []) {
    const loc = locOf(j.location_id);
    const place = (site?: string | null, addr?: string | null) => [site, addr].filter(Boolean).join(", ") || null;
    if (j.blood_test_booked_for) events.push({
      uid: `hc-${j.id}-blood`, start: new Date(j.blood_test_booked_for), minutes: 20,
      title: "Blóðprufa – Lifeline heilsufarsskoðun",
      description: "Mættu fastandi frá miðnætti. Vatn er í lagi.",
      location: place(loc?.blood_test_site, loc?.blood_test_address),
    });
    if (j.measurements_booked_for) events.push({
      uid: `hc-${j.id}-measure`, start: new Date(j.measurements_booked_for), minutes: 30,
      title: "Mælingar – Lifeline heilsufarsskoðun",
      description: "Léttur klæðnaður, engin málmskart eða úr.",
      location: place(loc?.measurement_site, loc?.measurement_address),
    });
    if (j.interview_booked_for) events.push({
      uid: `hc-${j.id}-interview`, start: new Date(j.interview_booked_for), minutes: 45,
      title: "Viðtal við hjúkrunarfræðing – Lifeline",
      description: j.interview_mode === "video" ? "Myndsímtal. Hlekkurinn er í sjúklingagáttinni." : "Farið yfir niðurstöður og gerð aðgerðaáætlun.",
      location: j.interview_mode === "video" ? "Myndsímtal" : place(loc?.interview_site, loc?.interview_address),
    });
    if (j.followup_booked_for) events.push({
      uid: `hc-${j.id}-followup`, start: new Date(j.followup_booked_for), minutes: 30,
      title: "Eftirfylgdarviðtal – Lifeline",
      location: place(loc?.interview_site, loc?.interview_address),
    });
  }

  return new Response(buildIcs("Lifeline heilsuferð", events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="lifeline-heilsuferd.ics"',
      "Cache-Control": "no-store",
    },
  });
}
