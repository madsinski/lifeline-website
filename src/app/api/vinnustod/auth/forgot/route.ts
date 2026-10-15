// "Gleymt lykilorð?" on the workstation sign-in. POST { email }.
//
// Always answers the same thing, whether or not the address belongs to a
// worker — the response must not tell anyone who works here. The lookup and
// the email run after the response (next/server `after`) so the timing does
// not tell either.
//
// Only an active worker who has already set a password gets a link: one who
// was never activated needs a fresh invite from an admin, and the staff-linked
// rows without a password (workerForStaff) must not gain a /vinnustod login
// this way. The link is a 2-hour "reset" link (issueWorkerLink); redeeming it
// revokes every session and trusted device (auth/activate).

import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { clientIp, sameOrigin, throttle } from "@/lib/hc/secrets";
import { siteOrigin } from "@/lib/hc/server";
import { issueWorkerLink } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

const SAME = { ok: true, message: "Ef netfangið er skráð fyrir vinnustöðina færðu tölvupóst með hlekk til að velja nýtt lykilorð. Hlekkurinn gildir í 2 klukkustundir." };

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await throttle(`ws-forgot:${clientIp(req)}`, 10, 900))) {
    return NextResponse.json({ error: "Of margar tilraunir. Reyndu aftur síðar." }, { status: 429 });
  }
  const { email } = await req.json().catch(() => ({}));
  const addr = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return NextResponse.json({ error: "Sláðu inn gilt netfang." }, { status: 400 });
  const origin = siteOrigin(req);

  after(async () => {
    // At most three links an hour per address, so nobody can flood an inbox.
    if (!(await throttle(`ws-forgot-email:${addr}`, 3, 3600))) return;
    const { data: w } = await supabaseAdmin
      .from("hc_workers")
      .select("id, name, email, active, password_hash")
      .eq("email", addr)
      .maybeSingle();
    if (!w?.active || !w.password_hash) return;
    const url = await issueWorkerLink(w.id, "reset", origin);
    await sendEmail({
      to: w.email,
      subject: "Nýtt lykilorð að vinnustöð Lifeline",
      html: renderBrandedEmail({
        title: `Halló ${String(w.name || "").split(" ")[0]}`,
        accentLabel: "Vinnustöð",
        bodyHtml: `<p style="margin:0 0 12px;">Beðið var um nýtt lykilorð að vinnustöð Lifeline. Veldu nýtt lykilorð með hlekknum hér fyrir neðan. Hann gildir í 2 klukkustundir.</p>
          <p style="margin:0;">Þegar nýja lykilorðið hefur verið vistað verða öll önnur tæki skráð út. Ef þú baðst ekki um þetta máttu hunsa póstinn.</p>`,
        ctaLabel: "Velja nýtt lykilorð",
        ctaUrl: url,
      }),
      text: `Veldu nýtt lykilorð að vinnustöð Lifeline (gildir í 2 klukkustundir): ${url}\n\nEf þú baðst ekki um þetta máttu hunsa póstinn.`,
    });
  });

  return NextResponse.json(SAME);
}
