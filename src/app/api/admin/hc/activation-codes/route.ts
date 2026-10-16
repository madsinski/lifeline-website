// Medalia activation-code pool, for admin → Heilsuferð → Virkjunarkóðar.
//
// GET  → stock per package kind, paid orders still waiting for a code, and
//        the latest issued/voided codes (order, kind, when — never the code
//        itself: issued codes live on the order, voided ones are shown once,
//        at the moment of voiding, to forward to Medalia).
// POST { action: "import", codes, kinds?, batch? } → import a batch from
//        Medalia (JSON array of strings, or of objects with a code field),
//        then hand codes to orders that paid while the pool was empty.
// POST { action: "void", order_id, reason } → void that order's code
//        (refund/cancel) and return it for Medalia to deactivate.
//
// Reads: any active staff. Writes: admin + MFA (adminGate).
// Schema: supabase/migration-hc-activation-code-pool.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import { hcAudit, siteOrigin } from "@/lib/hc/server";
import { assignPendingCodes, codeStock, voidActivationCode } from "@/lib/hc/code-pool";
import { CODE_POOL_KINDS } from "@/lib/hc/shop";

export const runtime = "nodejs";

/* Every product sold in Lifeline has its own pool (src/lib/hc/shop.ts). */
const KINDS: readonly string[] = CODE_POOL_KINDS;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{3,63}$/;
const MAX_IMPORT = 5000;

/** Pull codes out of whatever shape Medalia's JSON export has. */
function extractCodes(input: unknown): string[] {
  const list = Array.isArray(input) ? input
    : input && typeof input === "object" && Array.isArray((input as { codes?: unknown }).codes) ? (input as { codes: unknown[] }).codes
    : [];
  return list.map((x) => {
    if (typeof x === "string") return x.trim();
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const v = o.code ?? o.Code ?? o.kodi ?? o.discount_code ?? o.discountCode;
      return typeof v === "string" ? v.trim() : "";
    }
    return "";
  });
}

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const [stock, { count: waiting }, { data: recent }] = await Promise.all([
    codeStock(),
    supabaseAdmin.from("hc_orders").select("id", { count: "exact", head: true }).eq("status", "paid").is("activation_code", null),
    supabaseAdmin.from("hc_activation_code_pool").select("order_id, kinds, batch, status, issued_at, voided_at, void_reason")
      .neq("status", "available").order("issued_at", { ascending: false, nullsFirst: false }).limit(50),
  ]);
  if (!stock) return NextResponse.json({ error: "Kóðasafnið er ekki til. Keyrið migration-hc-activation-code-pool.sql." }, { status: 500 });
  return NextResponse.json({ stock, waiting: waiting ?? 0, recent: recent ?? [] });
}

export async function POST(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));

  if (b?.action === "import") {
    const all = extractCodes(b.codes);
    const valid = all.filter((c) => CODE_RE.test(c));
    const invalid = all.length - valid.length;
    if (!valid.length) return NextResponse.json({ error: "Engir gildir kóðar fundust í skránni." }, { status: 400 });
    if (valid.length > MAX_IMPORT) return NextResponse.json({ error: `Of margir kóðar í einu (hámark ${MAX_IMPORT}).` }, { status: 400 });
    const kinds = Array.isArray(b.kinds) ? (b.kinds as unknown[]).filter((k): k is string => typeof k === "string" && KINDS.includes(k)) : [];
    const batch = typeof b.batch === "string" && b.batch.trim() ? b.batch.trim().slice(0, 80) : `Innflutt ${new Date().toISOString().slice(0, 10)}`;

    const { data, error } = await supabaseAdmin.rpc("hc_import_activation_codes", {
      p_codes: valid, p_kinds: kinds.length ? kinds : null, p_batch: batch,
    });
    if (error) return NextResponse.json({ error: "Innflutningur mistókst." }, { status: 500 });
    const row = (Array.isArray(data) ? data[0] : data) as { inserted: number; duplicates: number } | null;
    await hcAudit(`staff:${g.id}`, "code_pool_import", null, { batch, kinds, inserted: row?.inserted ?? 0, duplicates: row?.duplicates ?? 0, invalid });
    const pending = await assignPendingCodes(siteOrigin(req));
    return NextResponse.json({ ok: true, inserted: row?.inserted ?? 0, duplicates: row?.duplicates ?? 0, invalid, ...pending });
  }

  if (b?.action === "void") {
    if (typeof b.order_id !== "string") return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const reason = typeof b.reason === "string" ? b.reason.slice(0, 500) : "";
    const code = await voidActivationCode(b.order_id, reason);
    if (!code) return NextResponse.json({ error: "Enginn útgefinn kóði á þessari pöntun." }, { status: 404 });
    await hcAudit(`staff:${g.id}`, "code_pool_void", null, { order_id: b.order_id, reason });
    /* Shown once, here, so it can be sent to Medalia for deactivation. */
    return NextResponse.json({ ok: true, code });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
