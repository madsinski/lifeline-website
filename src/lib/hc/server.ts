// Server helpers for the heilsuferð API. Server-only — never import from a
// "use client" file (pulls in supabase-admin).
// Schema: supabase/migration-health-journey.sql

import { NextRequest, NextResponse, after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { stageFor } from "./stages";
import { syncForJourney } from "./calendar-sync";
import type { HcJourney } from "./types";
import type { UnionRules } from "./reimbursement";

export const DEFAULT_LOCATION = "vestmannaeyjar";

export async function requireUser(req: NextRequest): Promise<User | NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return user;
}

export function siteOrigin(req: Request): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://www.lifelinehealth.is").replace(/\/$/, "");
}

// ── Client profile ─────────────────────────────────────────────────────────

export interface ClientProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  company_id: string | null;
  kennitala_encrypted: string | null;
  date_of_birth: string | null;
  sex: string | null;
}

export async function getClientProfile(userId: string): Promise<ClientProfile | null> {
  const { data } = await supabaseAdmin
    .from("clients_decrypted")
    .select("id, email, full_name, phone, address, company_id, kennitala_encrypted, date_of_birth, sex")
    .eq("id", userId)
    .maybeSingle();
  return (data as ClientProfile | null) ?? null;
}

export function isProfileComplete(p: ClientProfile | null): boolean {
  return !!(p && p.full_name?.trim() && p.phone?.trim() && p.address?.trim() && p.kennitala_encrypted);
}

/** Decrypt a kennitala blob. Logs the access (lög nr. 90/2018 audit trail). */
export async function decryptKennitala(
  enc: string | null,
  ctx: { actorRole: string; purpose: string; subjectId: string; req?: Request },
): Promise<string | null> {
  if (!enc) return null;
  const { data } = await supabaseAdmin.rpc("dec_kennitala", { p_enc: enc });
  await supabaseAdmin.rpc("log_kennitala_access", {
    p_actor_role: ctx.actorRole,
    p_scope: "full",
    p_purpose: ctx.purpose,
    p_subject_kind: "client",
    p_subject_id: ctx.subjectId,
    p_ip: ctx.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    p_user_agent: ctx.req?.headers.get("user-agent") || null,
  }).then(() => {}, () => {});
  return typeof data === "string" ? data : null;
}

// ── Journeys ───────────────────────────────────────────────────────────────

export async function currentJourney(userId: string): Promise<HcJourney | null> {
  const { data } = await supabaseAdmin
    .from("hc_journeys")
    .select("*")
    .eq("client_id", userId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as HcJourney | null) ?? null;
}

export async function getOrCreateJourney(userId: string, locationSlug?: string | null): Promise<HcJourney> {
  const existing = await currentJourney(userId);
  if (existing) return existing;
  const profile = await getClientProfile(userId);
  const { data: loc } = await supabaseAdmin
    .from("hc_locations")
    .select("id")
    .eq("slug", locationSlug || DEFAULT_LOCATION)
    .eq("active", true)
    .maybeSingle();
  const { data, error } = await supabaseAdmin
    .from("hc_journeys")
    .insert({
      client_id: userId,
      location_id: loc?.id ?? null,
      entry: profile?.company_id ? "b2b" : "b2c",
      company_id: profile?.company_id ?? null,
      profile_completed_at: isProfileComplete(profile) ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`journey create: ${error?.message}`);
  return refreshStage(data as HcJourney);
}

/** Recompute and persist the stage after any change. */
export async function refreshStage(j: HcJourney): Promise<HcJourney> {
  const profile = await getClientProfile(j.client_id);
  const stage = stageFor(j, isProfileComplete(profile));
  if (stage === j.stage) return j;
  const { data } = await supabaseAdmin
    .from("hc_journeys")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", j.id)
    .select("*")
    .single();
  return (data as HcJourney) ?? { ...j, stage };
}

export async function patchJourney(
  journeyId: string,
  patch: Partial<HcJourney>,
  actor: string,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<HcJourney | null> {
  const touchesCalendar = Object.keys(patch).some((k) => CALENDAR_FIELDS.has(k));
  let previousInterviewer: string | null = null;
  if (touchesCalendar && "interviewer_id" in patch) {
    const { data: before } = await supabaseAdmin.from("hc_journeys").select("interviewer_id").eq("id", journeyId).maybeSingle();
    previousInterviewer = before?.interviewer_id ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("hc_journeys")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", journeyId)
    .select("*")
    .single();
  if (error || !data) return null;
  await hcAudit(actor, action, journeyId, { ...detail, patch });
  if (touchesCalendar) scheduleCalendarSync(data as HcJourney, previousInterviewer);
  return refreshStage(data as HcJourney);
}

// Journey fields that change what appears in someone's calendar.
const CALENDAR_FIELDS = new Set([
  "blood_test_booked_for", "blood_test_done_at", "measurements_booked_for", "measurements_done_at",
  "interview_booked_for", "interview_mode", "interviewer_id", "interview_done_at",
  "followup_booked_for", "followup_done_at", "cancelled_at", "completed_at",
]);

/**
 * Instant Google Calendar sync: runs right after the response is sent, so a
 * booking lands in the person's (and the nurse's) calendar within seconds
 * without slowing the request. Outside a request scope, just fire it.
 */
function scheduleCalendarSync(j: HcJourney, previousInterviewer: string | null) {
  const run = () => syncForJourney(j, previousInterviewer).catch(() => {});
  try {
    after(run);
  } catch {
    void run();
  }
}

export async function hcAudit(actor: string, action: string, journeyId: string | null, detail: Record<string, unknown> = {}) {
  await supabaseAdmin.from("hc_audit").insert({ actor, action, journey_id: journeyId, detail }).then(() => {}, () => {});
}

// ── Unions ─────────────────────────────────────────────────────────────────

export interface ApprovedUnion {
  id: string;
  code: string;
  name: string;
  settlement: "reimbursement" | "direct";
  rules: UnionRules;
  rules_summary: string | null;
  contact_email: string | null;
  contact_name: string | null;
}

/**
 * Unions a customer may pick at checkout: cooperation approved AND a signed,
 * unexpired agreement uploaded. Both gates, because "approved" alone is a
 * button and the agreement is the legal fact.
 */
export async function approvedUnions(): Promise<ApprovedUnion[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: unions } = await supabaseAdmin
    .from("hc_unions")
    .select("id, code, name, settlement, rules, rules_summary, contact_email, contact_name")
    .eq("cooperation_status", "approved")
    .order("name");
  if (!unions?.length) return [];
  const { data: docs } = await supabaseAdmin
    .from("hc_union_documents")
    .select("union_id, signed_at, valid_until")
    .eq("kind", "agreement")
    .in("union_id", unions.map((u) => u.id));
  const signed = new Set(
    (docs || [])
      .filter((d) => d.signed_at && (!d.valid_until || d.valid_until >= today))
      .map((d) => d.union_id as string),
  );
  return unions.filter((u) => signed.has(u.id)) as ApprovedUnion[];
}

// ── Partner API (patient portal) ───────────────────────────────────────────

export function partnerAuthorized(req: Request): boolean {
  const expected = process.env.HC_PARTNER_API_KEY;
  const got = req.headers.get("x-api-key") || "";
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}
