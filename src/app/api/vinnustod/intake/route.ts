// Start from a report: drop the PDF in, find out who it belongs to.
//
// POST multipart files[] → parses the report (never stores it), reads the
// patient's name and kennitala off it, and looks for that person among our
// clients. Nothing is written here; the nurse confirms, then
// POST /api/vinnustod/intake/commit creates or opens the journey.
//
// Actor: workstation session or Lifeline staff.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";
import { mapValues, parseReport, type ReportFile } from "@/lib/hc/report-import";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILES = 8;
const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

const digits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

/** Name tokens worth searching on — skip initials and short particles. */
function tokens(name: string | null): string[] {
  return (name || "")
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}]/gu, ""))
    .filter((t) => t.length > 2)
    .slice(0, 3);
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI-lestur er ekki uppsettur." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const uploaded = form?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
  if (!uploaded.length) return NextResponse.json({ error: "Engin skrá fylgdi." }, { status: 400 });
  if (uploaded.length > MAX_FILES) return NextResponse.json({ error: `Mest ${MAX_FILES} skrár í einu.` }, { status: 400 });

  const files: ReportFile[] = [];
  for (const f of uploaded) {
    const type = (f.type || "").toLowerCase();
    if (!ACCEPTED.includes(type)) return NextResponse.json({ error: `Skráargerð ekki studd: ${f.type || "óþekkt"}` }, { status: 400 });
    if (f.size > MAX_BYTES) return NextResponse.json({ error: `Skráin ${f.name} er of stór (hámark 12 MB).` }, { status: 400 });
    files.push({ data: new Uint8Array(await f.arrayBuffer()), mediaType: type, filename: f.name });
  }

  let parsed;
  try {
    parsed = await parseReport(files);
  } catch (e) {
    return NextResponse.json({ error: `Lesturinn mistókst: ${e instanceof Error ? e.message : "unknown"}` }, { status: 502 });
  }

  const kt = digits(parsed.patient?.kennitala);
  const name = parsed.patient?.name ?? null;

  // Find the person. Kennitala is encrypted with a randomised cipher, so it
  // cannot be matched by equality — we shortlist on name and confirm on the
  // last four digits.
  const matches: { client_id: string; full_name: string | null; email: string | null; kennitala_last4: string | null; journey_id: string | null; confident: boolean }[] = [];
  const words = tokens(name);
  if (words.length) {
    const { data: candidates } = await supabaseAdmin
      .from("clients_decrypted")
      .select("id, full_name, email, kennitala_encrypted")
      .or(words.map((w) => `full_name.ilike.%${w}%`).join(","))
      .limit(10);
    for (const c of candidates || []) {
      let last4: string | null = null;
      if (c.kennitala_encrypted) {
        const { data } = await supabaseAdmin.rpc("kennitala_last4", { p_enc: c.kennitala_encrypted });
        last4 = typeof data === "string" ? data : null;
      }
      const { data: journey } = await supabaseAdmin
        .from("hc_journeys")
        .select("id")
        .eq("client_id", c.id)
        .is("cancelled_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      matches.push({
        client_id: c.id,
        full_name: c.full_name,
        email: c.email,
        kennitala_last4: last4,
        journey_id: journey?.id ?? null,
        confident: !!(kt && last4 && kt.endsWith(last4)),
      });
    }
    matches.sort((a, b) => Number(b.confident) - Number(a.confident));
  }

  return NextResponse.json({
    identity: { name, kennitala: kt || null, kennitala_last4: kt ? kt.slice(-4) : null },
    report: parsed.report,
    values: mapValues(parsed),
    warnings: parsed.warnings ?? [],
    matches,
  });
}
