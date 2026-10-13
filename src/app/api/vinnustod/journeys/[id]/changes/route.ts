// What changed in the plan, who changed it, and when.
//
// The raw material was already there and nobody was reading it:
// hc_plan_versions keeps a full snapshot of the modules on every save, with
// by_kind telling "self" (the client edited their own plan) from "staff"
// (the coach did). So the history exists — what did not exist was the
// difference between one snapshot and the next, which is the only part a
// coach actually wants before an interview. "Version 11" says nothing;
// "they took out Hugleiðsla and added Dagleg ganga" is the conversation.
//
// Computed on read rather than stored: a diff of two snapshots is cheap,
// and storing it would be a third copy of the same facts that could drift
// from them.
//
// GET → { changes: [{ version, at, by, byKind, added[], removed[], edited[] }] }
// Auth: workstation actor, journey must be at a location they may see.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

interface Mod { uid?: string; title?: string; pillar?: string; frequency?: string | null; note?: string | null }

/** The modules of one version, keyed by uid so a reorder is not a change. */
function byUid(modules: unknown): Map<string, Mod> {
  const out = new Map<string, Mod>();
  if (!Array.isArray(modules)) return out;
  for (const m of modules as Mod[]) {
    if (m && typeof m.uid === "string") out.set(m.uid, m);
  }
  return out;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let jq = supabaseAdmin.from("hc_journeys").select("id, location_id").eq("id", id);
  const locs = actorLocationFilter(actor);
  if (locs !== null) {
    if (locs.length === 0) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    jq = jq.in("location_id", locs);
  }
  const { data: journey } = await jq.maybeSingle();
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data } = await supabaseAdmin.from("hc_plan_versions")
    .select("version, by_kind, by_label, goals, modules, created_at")
    .eq("journey_id", id)
    .order("version", { ascending: true })
    .limit(200);
  const versions = data ?? [];

  const changes: unknown[] = [];
  for (let i = 0; i < versions.length; i++) {
    const cur = versions[i];
    const prev = i > 0 ? versions[i - 1] : null;
    const now = byUid(cur.modules);
    const was = byUid(prev?.modules);

    const added: string[] = [];
    const removed: string[] = [];
    const edited: { title: string; what: string }[] = [];

    for (const [uid, m] of now) {
      const old = was.get(uid);
      if (!old) { if (prev) added.push(m.title ?? "aðgerð"); continue; }
      /* A reorder is not a change worth reporting — the uid is the same and
         so is everything on it. Only what the client would notice. */
      if ((old.title ?? "") !== (m.title ?? "")) edited.push({ title: m.title ?? "", what: `hét áður „${old.title}“` });
      else if ((old.frequency ?? "") !== (m.frequency ?? "")) edited.push({ title: m.title ?? "", what: `tíðni: ${old.frequency || "engin"} → ${m.frequency || "engin"}` });
      else if ((old.note ?? "") !== (m.note ?? "")) edited.push({ title: m.title ?? "", what: (m.note ?? "").trim() ? "ný athugasemd" : "athugasemd fjarlægð" });
    }
    for (const [uid, m] of was) if (!now.has(uid)) removed.push(m.title ?? "aðgerð");

    /* The first version is the plan being written, not a change to it. */
    const isFirst = !prev;
    if (!isFirst && !added.length && !removed.length && !edited.length) continue;

    changes.push({
      version: cur.version,
      at: cur.created_at,
      byKind: cur.by_kind,
      /* "self:<uuid>" is how the client's own saves are labelled, which is
         not a name — the UI says "skjólstæðingurinn" for those rather than
         printing a uuid at somebody. */
      by: cur.by_kind === "staff" ? (cur.by_label ?? "starfsmaður") : null,
      created: isFirst,
      added, removed, edited,
    });
  }

  /* Newest first: the question is "what has happened since I last looked". */
  changes.reverse();
  return NextResponse.json({ changes });
}
