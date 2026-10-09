// The conversation with your coach.
//
// Message bodies are encrypted at rest (content_enc on `messages`), so reads
// and writes both go through messages_decrypted — the view with INSTEAD OF
// triggers. Writing to `messages` directly would store plaintext in a column
// the app does not read.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { data: convo } = await supabaseAdmin
    .from("conversations")
    .select("id, coach_name, created_at, archived")
    .eq("client_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!convo) return NextResponse.json({ conversation: null, messages: [] });

  const { data: msgs } = await supabaseAdmin
    .from("messages_decrypted")
    .select("id, sender_id, sender_name, sender_role, content, read, created_at")
    .eq("conversation_id", convo.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    conversation: { id: convo.id as string, coachName: (convo.coach_name as string) ?? null },
    messages: (msgs ?? []).map((m) => ({
      id: m.id as string,
      mine: m.sender_id === user.id,
      who: (m.sender_name as string) ?? null,
      role: (m.sender_role as string) ?? null,
      content: (m.content as string) ?? "",
      at: m.created_at as string,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: "too long" }, { status: 413 });

  const { data: convo } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("client_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "no conversation" }, { status: 404 });

  const { data: me } = await supabaseAdmin
    .from("clients").select("full_name").eq("id", user.id).maybeSingle();

  // Through the view, so the body is encrypted by the INSTEAD OF trigger.
  const { error } = await supabaseAdmin.from("messages_decrypted").insert({
    conversation_id: convo.id,
    sender_id: user.id,
    sender_name: (me?.full_name as string) ?? null,
    sender_role: "client",
    content,
    read: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
