// Requests for "Lifeline þjálfun", for Lifeline's own workers to confirm.
//
// GET  → { requests[] } pending ones, oldest first, with what a worker needs
//        to decide: name, contact, address, postcode/town and the evidence
//        gathered when it came in (employer, station visits, journey entry).
// POST { id, decision: "approve" | "decline", reason? } → decide. A decline
//        needs a short reason; it is shown to the person as written.
//
// Lifeline only: partner workers (Vera, heilsugæsla) neither see nor decide
// these — the same rule as /api/vinnustod/doctor-slots. Decisions are audited
// in hc_audit and the person is told (src/lib/hc/coaching-requests.ts).
// Schema: supabase/migration-coaching-requests.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor, type HcActor } from "@/lib/hc/ws-auth";
import { siteOrigin } from "@/lib/hc/server";
import { decideRequest, type CoachingEvidence } from "@/lib/hc/coaching-requests";

export const runtime = "nodejs";

function lifelineOwn(actor: HcActor): boolean {
  return actor.kind === "staff" || actor.worker.organization === "lifeline";
}

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!lifelineOwn(actor)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin.from("hc_coaching_requests")
    .select("id, client_id, status, postcode, town, evidence, created_at")
    .eq("status", "pending").order("created_at", { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as { id: string; client_id: string; status: string; postcode: string | null; town: string | null; evidence: CoachingEvidence; created_at: string }[];

  const ids = [...new Set(rows.map((r) => r.client_id))];
  const [{ data: people }, { data: journeys }] = ids.length
    ? await Promise.all([
        supabaseAdmin.from("clients_decrypted").select("id, full_name, email, phone, address").in("id", ids),
        supabaseAdmin.from("hc_journeys").select("id, client_id, entry, created_at").in("client_id", ids)
          .is("cancelled_at", null).order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];
  const person = new Map(((people ?? []) as { id: string; full_name: string | null; email: string | null; phone: string | null; address: string | null }[]).map((p) => [p.id, p]));
  const journeyOf = new Map<string, string>();
  for (const j of (journeys ?? []) as { id: string; client_id: string }[]) if (!journeyOf.has(j.client_id)) journeyOf.set(j.client_id, j.id);

  return NextResponse.json({
    requests: rows.map((r) => {
      const p = person.get(r.client_id);
      return {
        id: r.id, client_id: r.client_id, created_at: r.created_at,
        name: p?.full_name ?? null, email: p?.email ?? null, phone: p?.phone ?? null,
        /* The address as it is now; postcode/town as they were when asked. */
        address: p?.address ?? null, postcode: r.postcode, town: r.town,
        evidence: r.evidence ?? {},
        journey_id: journeyOf.get(r.client_id) ?? null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!lifelineOwn(actor)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const id = typeof b?.id === "string" ? b.id : "";
  const decision = b?.decision === "approve" || b?.decision === "decline" ? b.decision : null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !decision) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const reason = typeof b?.reason === "string" ? b.reason.trim().replace(/\s+/g, " ") : "";
  if (decision === "decline" && (reason.length < 3 || reason.length > 300)) {
    return NextResponse.json({ error: "Skrifaðu stutta ástæðu (3–300 stafir). Hún birtist viðkomandi." }, { status: 400 });
  }

  const r = await decideRequest(id, decision, actor.label, decision === "decline" ? reason : null, siteOrigin(req));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, id: r.request.id, status: r.request.status });
}
