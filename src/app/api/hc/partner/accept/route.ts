// Accepting an ábyrgðarfélagi invitation.
//
// GET  ?t=<token>  → who is asking (name only), so the page can say it
// POST { token }   → become friends, both directions, and mark it accepted
//
// The token is the credential. It is long and random, single-purpose, and
// the row is API-mediated (RLS blocks the anon key) so it cannot be
// enumerated. Accepting requires a logged-in session: the invite says who
// asked, but only the person who signs in can agree on their own behalf.
//
// Accepting creates the friendship and nothing else. It does not set the
// inviter's partner — the inviter chooses that from their own candidate
// list afterwards, which keeps "we are connected" and "you are watching my
// streak" as two separate acts.
//
// Schema: supabase/migration-hc-partner-invites.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hcAudit, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

/** 14 days. Long enough to find the mail, short enough that a leaked link dies. */
const TTL_DAYS = 14;

interface Invite {
  id: string;
  inviter_id: string;
  email: string;
  status: string;
  created_at: string;
}

async function load(token: string): Promise<{ invite: Invite; inviter: string | null } | null> {
  if (!token || token.length < 24 || token.length > 128) return null;
  const { data } = await supabaseAdmin.from("hc_partner_invites")
    .select("id, inviter_id, email, status, created_at").eq("token", token).maybeSingle<Invite>();
  if (!data || data.status !== "pending") return null;
  if (Date.now() - new Date(data.created_at).getTime() > TTL_DAYS * 86400_000) {
    await supabaseAdmin.from("hc_partner_invites").update({ status: "expired" }).eq("id", data.id);
    return null;
  }
  const { data: who } = await supabaseAdmin.from("clients")
    .select("full_name").eq("id", data.inviter_id).maybeSingle();
  return { invite: data, inviter: (who?.full_name as string | null) ?? null };
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const found = await load(token);
  // A bad or spent token says only that. Nothing about the address it was
  // sent to, and nothing that distinguishes "never existed" from "used".
  if (!found) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 404 });
  return NextResponse.json({ ok: true, inviter: found.inviter });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const decline = body?.decline === true;

  const found = await load(token);
  if (!found) return NextResponse.json({ error: "invalid" }, { status: 404 });
  const { invite } = found;

  if (decline) {
    await supabaseAdmin.from("hc_partner_invites").update({ status: "declined" }).eq("id", invite.id);
    return NextResponse.json({ ok: true, declined: true });
  }

  if (invite.inviter_id === user.id) {
    return NextResponse.json({ error: "self" }, { status: 400 });
  }

  /*
   * Accepted straight away rather than left pending.
   *
   * The usual friend-request dance is request → the other person agrees.
   * Here the agreeing has already happened in the other order: the inviter
   * asked by email and this person clicked accept. Writing it as pending
   * would leave both sides waiting for a confirmation neither of them owes.
   */
  const { data: existing } = await supabaseAdmin.from("friendships")
    .select("id, status")
    .or(`and(requester_id.eq.${invite.inviter_id},addressee_id.eq.${user.id}),and(requester_id.eq.${user.id},addressee_id.eq.${invite.inviter_id})`)
    .limit(1).maybeSingle();

  if (existing) {
    if (existing.status !== "accepted") {
      await supabaseAdmin.from("friendships")
        .update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", existing.id);
    }
  } else {
    const { error } = await supabaseAdmin.from("friendships")
      .insert({ requester_id: invite.inviter_id, addressee_id: user.id, status: "accepted" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("hc_partner_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id);

  // Two people are now connected, which is a sharing act on both sides.
  await hcAudit(`self:${user.id}`, "accountability_partner_accepted", null, { inviter: invite.inviter_id });

  return NextResponse.json({ ok: true, inviter: found.inviter });
}
