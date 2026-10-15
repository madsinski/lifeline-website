// What a discount code would do, before anybody agrees to pay.
//
// POST { code, target } → { ok, label, price_isk, amount_off_isk, months_free }
//
// Reports; does not redeem. A customer who pastes a code five times has not
// spent it — /api/hc/subscribe redeems it, once, after the charge.
//
// ── Why the answers are vague ────────────────────────────────────────
//
// Every failure returns the same { ok: false }. Expired, spent, already used
// by this person, meant for the other product, never existed: one answer. A
// response that distinguished them would turn this into an oracle for
// finding real codes, and a marketing code is only worth anything while it
// is not public.
//
// A code list is also short and guessable by nature ("LAUNCH20"), so there
// is a per-person attempt cap on top. It is deliberately generous — somebody
// fumbling a code they were given should never be locked out — and far below
// what a search would need.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/hc/server";
import { priceWithCode, type DiscountTarget } from "@/lib/hc/discount";
import { supabaseAdmin } from "@/lib/supabase-admin";

import { APP_PACKAGE_KEY, COACHING_PACKAGE_KEY } from "@/lib/hc/coaching-config";

export const runtime = "nodejs";

const ATTEMPT_WINDOW_MIN = 10;
const ATTEMPT_LIMIT = 12;

/** List prices come from the catalogue, never from the request. */
async function listPrice(target: DiscountTarget, pkgKey?: string): Promise<number | null> {
  /* Two subscription tiers: priced against whichever the person is looking at. */
  const key = target === "subscription"
    ? (pkgKey === COACHING_PACKAGE_KEY ? COACHING_PACKAGE_KEY : APP_PACKAGE_KEY)
    : null;
  const q = supabaseAdmin.from("hc_packages").select("price_isk").eq("active", true);
  const { data } = key
    ? await q.eq("key", key).maybeSingle<{ price_isk: number }>()
    : await q.eq("kind", "health_check").order("price_isk").limit(1).maybeSingle<{ price_isk: number }>();
  return data?.price_isk ?? null;
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.code === "string" ? body.code : "";
  const target: DiscountTarget = body?.target === "health_check" ? "health_check" : "subscription";
  if (!raw.trim()) return NextResponse.json({ ok: false });

  /*
   * The attempt cap, counted from the audit trail we already write rather
   * than a table of its own.
   */
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("hc_audit")
    .select("id", { count: "exact", head: true })
    .eq("actor", `self:${user.id}`).eq("action", "discount_try")
    .gte("created_at", since);
  if ((count ?? 0) >= ATTEMPT_LIMIT) {
    return NextResponse.json({ ok: false, slow_down: true }, { status: 429 });
  }

  const price = await listPrice(target, typeof body?.package === "string" ? body.package : undefined);
  if (price == null) return NextResponse.json({ ok: false });

  const r = await priceWithCode(raw, target, price, user.id);

  // Every try, hit or miss — this is what the cap counts, and what shows a
  // pattern of guessing after the fact.
  await supabaseAdmin.from("hc_audit").insert({
    actor: `self:${user.id}`, action: "discount_try", journey_id: null,
    detail: { ok: r.ok, reason: r.reason ?? null },
  }).then(() => {}, () => {});

  if (!r.ok) return NextResponse.json({ ok: false });
  return NextResponse.json({
    ok: true,
    label: r.label,
    price_isk: r.priceIsk,
    amount_off_isk: r.amountOffIsk,
    months_free: r.monthsFree,
  });
}
