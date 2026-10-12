// Admin: the discount codes, and making them.
//
// The validation, redemption and paywall plumbing has been live since the
// subscription work, but there was no way to create a code — so the feature
// existed and could not be used. This is the missing surface.
//
// GET    → every code with its usage
// POST   → create one
// PATCH  → turn one off, or back on, or change what it is worth
//
// Reads need any active staff; writes need an admin with MFA, because a
// code is money. See src/lib/hc/admin-gate.ts.
//
// Schema: supabase/migration-hc-discount-codes.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import { normaliseCode } from "@/lib/hc/discount";

export const runtime = "nodejs";

const KINDS = ["percent", "amount", "free_months"] as const;
const APPLIES = ["subscription", "health_check", "both"] as const;

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;

  const [{ data: codes }, { data: redemptions }] = await Promise.all([
    supabaseAdmin.from("hc_discount_codes").select("*").order("created_at", { ascending: false }),
    /* amount_off_isk / months_free, not "value_applied" — I guessed that
       name first and the select would have failed silently, leaving every
       usage count at zero. */
    supabaseAdmin.from("hc_discount_redemptions").select("code, amount_off_isk, months_free, redeemed_at"),
  ]);

  /* Usage counted from the redemptions rather than read off used_count, so
     the number shown is the one in the ledger. used_count is the counter the
     redeem path increments; if the two ever disagree, this surfaces it
     instead of hiding it. */
  const byCode: Record<string, { uses: number; last: string | null }> = {};
  for (const r of redemptions ?? []) {
    const k = r.code as string;
    const prev = byCode[k] ?? { uses: 0, last: null };
    byCode[k] = {
      uses: prev.uses + 1,
      last: !prev.last || (r.redeemed_at as string) > prev.last ? (r.redeemed_at as string) : prev.last,
    };
  }

  return NextResponse.json({
    codes: (codes ?? []).map((c) => ({
      ...c,
      redemptions: byCode[c.code as string]?.uses ?? 0,
      last_used_at: byCode[c.code as string]?.last ?? null,
      /* Whether it would actually work right now, which is what somebody
         about to hand it out needs to know — "active" alone does not say
         whether it has expired or run out. */
      usable: c.active
        && (!c.starts_at || (c.starts_at as string) <= new Date().toISOString())
        && (!c.expires_at || (c.expires_at as string) >= new Date().toISOString())
        && (c.max_uses == null || (byCode[c.code as string]?.uses ?? 0) < (c.max_uses as number)),
    })),
  });
}

export async function POST(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const body = await req.json().catch(() => ({}));

  /* Normalised through the same function the redeem path uses, so a code
     typed here in lower case is the code a customer can actually enter. */
  /* Stricter at creation than normaliseCode is at reading: that accepts up
     to 40 characters and anything in them, because it has to cope with
     whatever a customer types. A code we hand out should be short and
     unambiguous, so this is the narrower end. */
  const code = normaliseCode(String(body.code ?? ""));
  if (!/^[A-Z0-9]{3,24}$/.test(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }
  const kind = String(body.kind ?? "");
  if (!(KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  }
  const applies_to = String(body.applies_to ?? "subscription");
  if (!(APPLIES as readonly string[]).includes(applies_to)) {
    return NextResponse.json({ error: "bad_applies" }, { status: 400 });
  }
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "bad_value" }, { status: 400 });
  if (kind === "percent" && value > 100) return NextResponse.json({ error: "bad_percent" }, { status: 400 });
  /* free_months is a count of months, so a fractional one is a typo. */
  if (kind === "free_months" && !Number.isInteger(value)) {
    return NextResponse.json({ error: "bad_months" }, { status: 400 });
  }
  if (kind === "free_months" && applies_to === "health_check") {
    return NextResponse.json({ error: "months_need_subscription" }, { status: 400 });
  }

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const date = (v: unknown) => {
    if (typeof v !== "string" || !v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const { error } = await supabaseAdmin.from("hc_discount_codes").insert({
    code, kind, value, applies_to,
    max_uses: num(body.max_uses),
    max_per_client: num(body.max_per_client) ?? 1,
    starts_at: date(body.starts_at),
    expires_at: date(body.expires_at),
    active: body.active !== false,
    note: typeof body.note === "string" ? body.note.trim().slice(0, 300) || null : null,
  });
  /* A duplicate is the ordinary mistake here — somebody re-creating a code
     they already made — so it gets its own answer rather than a 500. */
  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "exists" : error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true, code });
}

export async function PATCH(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const body = await req.json().catch(() => ({}));
  const code = normaliseCode(String(body.code ?? ""));
  if (!code) return NextResponse.json({ error: "bad_code" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "bad_value" }, { status: 400 });
    patch.value = value;
  }
  if (body.expires_at !== undefined) {
    const v = body.expires_at;
    if (v === null || v === "") patch.expires_at = null;
    else {
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "bad_date" }, { status: 400 });
      patch.expires_at = d.toISOString();
    }
  }
  if (typeof body.note === "string") patch.note = body.note.trim().slice(0, 300) || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing_to_do" }, { status: 400 });

  /* The code is the primary key and is never changed: a code in somebody's
     inbox has to keep meaning what it meant. Turn it off and make another. */
  const { error } = await supabaseAdmin.from("hc_discount_codes").update(patch).eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
