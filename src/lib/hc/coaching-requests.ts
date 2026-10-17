// "Lifeline þjálfun" is approved before it is paid for (Mads, 2026-10-17).
//
// The tier is for people who live in Vestmannaeyjar. The postcode in the
// person's own address is the first test (coachingEligibility), but it is
// typed by the person, so Lifeline confirms the request before the payment
// step opens. Flow:
//
//   person    POST /api/hc/coaching-request        → pending (or approved at once)
//   worker    /vinnustod Í dag → Samþykkja / Hafna  → approved | declined
//   person    notified (in-app dot, push, email, SMS if allowed)
//   person    pays on /app/askrift                  → /api/hc/subscribe checks
//                                                     approvedRequest()
//   fulfil    activateSubscription                  → used
//
// Evident cases are approved by the server when the request is made, and say
// why in `evidence`: an employer (B2B company) with its address in the
// region, or a measurement completed at the region's station. Everything the
// worker sees as a hint is gathered here too, once, and stored with the row.
//
// Server only. Schema: supabase/migration-coaching-requests.sql

import { supabaseAdmin } from "@/lib/supabase-admin";
import { postcodeFromAddress, splitAddress } from "@/lib/hc/address";
import { normalizeIsText, placeForPostcode } from "@/lib/is-postcodes";
import { notifyClient } from "@/lib/hc/notify";
import { hcAudit } from "@/lib/hc/server";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import { coachingEligibility, coachingPackage, type Eligibility } from "@/lib/hc/coaching";
import {
  APPROVAL_DAYS, CONTACT_EMAIL, NO_REQUEST, type CoachingQuota, type CoachingRequestView,
} from "@/lib/hc/coaching-config";

export type RequestStatus = "pending" | "approved" | "declined" | "cancelled" | "used";

export interface CoachingRequestRow {
  id: string;
  client_id: string;
  status: RequestStatus;
  postcode: string | null;
  town: string | null;
  evidence: CoachingEvidence;
  auto_approved: boolean;
  decided_by: string | null;
  decided_at: string | null;
  decline_reason: string | null;
  decision_seen_at: string | null;
  used_at: string | null;
  subscription_id: string | null;
  created_at: string;
  expires_at: string | null;
}

/** What the worker sees beside the address. Stored as it was when the request came in. */
export interface CoachingEvidence {
  /** The employer, from clients.company_id or the journey's company. */
  company?: { id: string; name: string | null; address: string | null; in_region: boolean } | null;
  /** The journey's entry ('b2c', 'b2b', 'coach', 'app', 'heilsugaesla'). */
  journey_entry?: string | null;
  /** Measurements completed at a station (station_slots.completed_at). */
  station_visits?: { count: number; in_region: number; last_at: string | null; last_location: string | null };
  /** hc_bookings measurements marked done (no location on the row). */
  measurements_done?: number;
  /** Had "Lifeline þjálfun" before. */
  previous_coaching?: boolean;
  /** Why it was approved without a worker, in words for the audit trail. */
  auto_reasons?: string[];
}

const COLS = "id, client_id, status, postcode, town, evidence, auto_approved, decided_by, decided_at, decline_reason, decision_seen_at, used_at, subscription_id, created_at, expires_at";

const isLive = (r: CoachingRequestRow) =>
  r.status === "approved" && !!r.expires_at && Date.parse(r.expires_at) > Date.now();

/** The newest request, whatever its status. */
export async function latestRequest(clientId: string): Promise<CoachingRequestRow | null> {
  const { data } = await supabaseAdmin.from("hc_coaching_requests").select(COLS)
    .eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as CoachingRequestRow | null) ?? null;
}

/** An approval that has not run out or been used: what lets somebody pay. */
export async function approvedRequest(clientId: string): Promise<CoachingRequestRow | null> {
  const { data } = await supabaseAdmin.from("hc_coaching_requests").select(COLS)
    .eq("client_id", clientId).eq("status", "approved").gt("expires_at", new Date().toISOString())
    .order("decided_at", { ascending: false }).limit(1).maybeSingle();
  return (data as CoachingRequestRow | null) ?? null;
}

/** The newest request as the app shows it. */
export function viewOf(r: CoachingRequestRow | null): CoachingRequestView {
  if (!r) return NO_REQUEST;
  const base = { id: r.id, created_at: r.created_at, decided_at: r.decided_at, expires_at: null, decline_reason: null };
  if (r.status === "pending") return { ...base, state: "pending" };
  if (isLive(r)) return { ...base, state: "approved", expires_at: r.expires_at };
  if (r.status === "declined") return { ...base, state: "declined", decline_reason: r.decline_reason };
  return NO_REQUEST;
}

export async function requestView(clientId: string): Promise<CoachingRequestView> {
  /* A live approval wins over a newer cancelled request. */
  const [approved, latest] = await Promise.all([approvedRequest(clientId), latestRequest(clientId)]);
  return viewOf(latest?.status === "pending" ? latest : approved ?? latest);
}

// ── Evidence ─────────────────────────────────────────────────────────

/** A free-text address or place that is in the region: a postcode on the list, or the place named. */
function textInRegion(s: string | null | undefined, q: CoachingQuota, extra: string[] = []): boolean {
  if (!s?.trim()) return false;
  const pc = postcodeFromAddress(s)?.postcode;
  if (pc && q.postcodes.includes(pc)) return true;
  const n = normalizeIsText(s);
  return ["vestmannaey", ...extra.map((x) => normalizeIsText(x))].some((x) => x.length >= 4 && n.includes(x));
}

async function gatherEvidence(clientId: string, q: CoachingQuota): Promise<{ evidence: CoachingEvidence; auto: boolean }> {
  const [{ data: client }, { data: journey }, { data: loc }, { data: slots }, { count: done }, { count: subs }] = await Promise.all([
    supabaseAdmin.from("clients_decrypted").select("company_id").eq("id", clientId).maybeSingle<{ company_id: string | null }>(),
    supabaseAdmin.from("hc_journeys").select("entry, company_id").eq("client_id", clientId)
      .is("cancelled_at", null).order("created_at", { ascending: false }).limit(1)
      .maybeSingle<{ entry: string | null; company_id: string | null }>(),
    supabaseAdmin.from("hc_locations").select("name, measurement_site, measurement_address").eq("slug", q.region)
      .maybeSingle<{ name: string | null; measurement_site: string | null; measurement_address: string | null }>(),
    supabaseAdmin.from("station_slots").select("location, completed_at").eq("client_id", clientId)
      .not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(20),
    supabaseAdmin.from("hc_bookings").select("id", { count: "exact", head: true })
      .eq("client_id", clientId).eq("kind", "measurement").eq("status", "done"),
    supabaseAdmin.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("client_id", clientId).eq("tier", "coaching"),
  ]);

  const regionNames = [loc?.name, loc?.measurement_site, loc?.measurement_address].filter((x): x is string => !!x);
  const reasons: string[] = [];

  let company: CoachingEvidence["company"] = null;
  const companyId = client?.company_id ?? journey?.company_id ?? null;
  if (companyId) {
    const { data: co } = await supabaseAdmin.from("companies")
      .select("id, name, company_address, billing_address").eq("id", companyId)
      .maybeSingle<{ id: string; name: string | null; company_address: string | null; billing_address: string | null }>();
    if (co) {
      const inRegion = textInRegion(co.company_address, q) || textInRegion(co.billing_address, q) || textInRegion(co.name, q);
      company = { id: co.id, name: co.name, address: co.company_address ?? co.billing_address, in_region: inRegion };
      if (inRegion) reasons.push(`Vinnuveitandi í Vestmannaeyjum: ${co.name ?? "fyrirtæki"}`);
    }
  }

  const visits = (slots ?? []) as { location: string | null; completed_at: string }[];
  const inRegionVisits = visits.filter((v) => textInRegion(v.location, q, regionNames));
  if (inRegionVisits.length) reasons.push(`Mæling lokið á mælistöð í Vestmannaeyjum (${inRegionVisits.length})`);

  return {
    evidence: {
      company,
      journey_entry: journey?.entry ?? null,
      station_visits: {
        count: visits.length, in_region: inRegionVisits.length,
        last_at: visits[0]?.completed_at ?? null, last_location: visits[0]?.location ?? null,
      },
      measurements_done: done ?? 0,
      previous_coaching: (subs ?? 0) > 0,
      auto_reasons: reasons,
    },
    auto: reasons.length > 0,
  };
}

// ── The person's side ────────────────────────────────────────────────

export type CreateResult =
  | { ok: true; request: CoachingRequestRow; created: boolean }
  | { ok: false; status: number; error: string };

/**
 * Send a request. Eligibility (a postcode in the region) is still required.
 * An open request is returned as it is; an approval that is still good
 * needs no new one.
 */
export async function createRequest(clientId: string): Promise<CreateResult> {
  const pkg = await coachingPackage();
  if (!pkg.in_catalogue) return { ok: false, status: 404, error: "Lifeline þjálfun er ekki í boði að svo stöddu." };
  const el: Eligibility = await coachingEligibility(clientId, pkg.quota);
  if (!el.eligible) {
    return {
      ok: false, status: 403,
      error: el.reason === "no_address"
        ? "Skráðu heimilisfangið þitt með póstnúmeri til að senda beiðni."
        : "Lifeline þjálfun er í boði fyrir íbúa í Vestmannaeyjum.",
    };
  }
  const live = await approvedRequest(clientId);
  if (live) return { ok: true, request: live, created: false };
  const latest = await latestRequest(clientId);
  if (latest?.status === "pending") return { ok: true, request: latest, created: false };

  /* At most five requests a day: withdrawing and resending must not become
     a way to fill the workers' list. */
  const { count: today } = await supabaseAdmin.from("hc_coaching_requests").select("id", { count: "exact", head: true })
    .eq("client_id", clientId).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((today ?? 0) >= 5) return { ok: false, status: 429, error: "Of margar beiðnir í dag. Reyndu aftur á morgun eða skrifaðu á contact@lifelinehealth.is." };

  const { data: c } = await supabaseAdmin.from("clients_decrypted").select("address").eq("id", clientId).maybeSingle<{ address: string | null }>();
  const town = splitAddress(c?.address).town || (el.postcode ? placeForPostcode(el.postcode) : null) || null;
  const { evidence, auto } = await gatherEvidence(clientId, pkg.quota);
  const now = new Date();
  const row = {
    client_id: clientId, postcode: el.postcode, town, evidence,
    ...(auto
      ? {
          status: "approved", auto_approved: true, decided_by: "system", decided_at: now.toISOString(),
          expires_at: new Date(now.getTime() + APPROVAL_DAYS * 86_400_000).toISOString(),
          /* They see it on the page the moment they send it; nothing to light a dot for. */
          decision_seen_at: now.toISOString(),
        }
      : { status: "pending" }),
  };
  const { data, error } = await supabaseAdmin.from("hc_coaching_requests").insert(row).select(COLS).single();
  if (error) {
    /* Two taps at once: the unique index kept one; return it. */
    if (error.code === "23505") {
      const again = await latestRequest(clientId);
      if (again) return { ok: true, request: again, created: false };
    }
    console.error("[hc] coaching request insert failed", error.message);
    return { ok: false, status: 500, error: "Ekki tókst að senda beiðnina. Reyndu aftur." };
  }
  const req = data as CoachingRequestRow;
  await hcAudit(`self:${clientId}`, auto ? "coaching_request_auto_approved" : "coaching_request_sent", null, {
    request_id: req.id, postcode: el.postcode, auto_reasons: evidence.auto_reasons ?? [],
  });
  if (!auto) await notifyStaffOfFirstToday(req);
  return { ok: true, request: req, created: true };
}

/** Withdraw a pending request. */
export async function cancelRequest(clientId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("hc_coaching_requests")
    .update({ status: "cancelled", decided_by: `self:${clientId}`, decided_at: new Date().toISOString() })
    .eq("client_id", clientId).eq("status", "pending").select("id");
  if (data?.length) await hcAudit(`self:${clientId}`, "coaching_request_cancelled", null, { request_id: data[0].id });
  return !!data?.length;
}

/** The subscription started: the approval is spent. Called from activateSubscription. */
export async function markRequestUsed(clientId: string, subscriptionId: string): Promise<void> {
  const { data: live } = await supabaseAdmin.from("hc_coaching_requests").select("id")
    .eq("client_id", clientId).eq("status", "approved").order("decided_at", { ascending: false }).limit(1);
  const id = live?.[0]?.id as string | undefined;
  if (!id) return;
  await supabaseAdmin.from("hc_coaching_requests")
    .update({ status: "used", used_at: new Date().toISOString(), subscription_id: subscriptionId })
    .eq("id", id).eq("status", "approved");
}

// ── The worker's side ────────────────────────────────────────────────

export type DecideResult = { ok: true; request: CoachingRequestRow } | { ok: false; status: number; error: string };

/**
 * Approve or decline a pending request, and tell the person. Only a pending
 * row moves, so two workers deciding at once cannot both win.
 */
export async function decideRequest(
  id: string, decision: "approve" | "decline", by: string, reason: string | null, origin: string,
): Promise<DecideResult> {
  const now = new Date();
  const patch = decision === "approve"
    ? { status: "approved", decided_by: by, decided_at: now.toISOString(), decline_reason: null,
        expires_at: new Date(now.getTime() + APPROVAL_DAYS * 86_400_000).toISOString() }
    : { status: "declined", decided_by: by, decided_at: now.toISOString(), decline_reason: reason };
  const { data, error } = await supabaseAdmin.from("hc_coaching_requests")
    .update(patch).eq("id", id).eq("status", "pending").select(COLS);
  if (error) return { ok: false, status: 500, error: error.message };
  const row = (data?.[0] ?? null) as CoachingRequestRow | null;
  if (!row) return { ok: false, status: 409, error: "Beiðnin hefur þegar verið afgreidd eða afturkölluð." };

  const { data: j } = await supabaseAdmin.from("hc_journeys").select("id").eq("client_id", row.client_id)
    .is("cancelled_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle<{ id: string }>();
  await hcAudit(by, decision === "approve" ? "coaching_request_approved" : "coaching_request_declined", j?.id ?? null, {
    request_id: row.id, client_id: row.client_id, ...(reason ? { reason } : {}),
  });

  /* Telling them must never undo the decision: every channel is best effort. */
  try {
    await notifyDecision(row, origin);
  } catch (e) {
    console.error("[hc] coaching decision notify failed", e instanceof Error ? e.message : e);
  }
  return { ok: true, request: row };
}

async function notifyDecision(row: CoachingRequestRow, origin: string) {
  const url = `${origin}/app/askrift?pakki=thjalfun`;
  if (row.status === "approved") {
    await notifyClient(row.client_id, {
      title: "Beiðnin þín var samþykkt",
      body: "Þú getur nú gengið frá áskrift að Lifeline þjálfun.",
      url: "/app/askrift?pakki=thjalfun", tag: `coaching-request-${row.id}`,
      sms: `Lifeline: Beiðnin þín um Lifeline þjálfun var samþykkt. Þú getur gengið frá áskrift hér: ${url}`,
      email: {
        subject: "Beiðnin þín um Lifeline þjálfun var samþykkt",
        text: `Við höfum staðfest beiðnina þína um Lifeline þjálfun. Þú getur gengið frá áskriftinni á síðunni Áskrift næstu ${APPROVAL_DAYS} daga.`,
        cta: { label: "Ganga frá áskrift", url },
      },
    });
  } else {
    await notifyClient(row.client_id, {
      title: "Svar við beiðni um Lifeline þjálfun",
      body: "Við gátum ekki samþykkt beiðnina. Ástæðan er á síðunni Áskrift.",
      url: "/app/askrift", tag: `coaching-request-${row.id}`,
      sms: `Lifeline: Við gátum ekki samþykkt beiðnina þína um Lifeline þjálfun. Nánar á ${origin}/app/askrift`,
      email: {
        subject: "Svar við beiðni um Lifeline þjálfun",
        text: `Við gátum ekki samþykkt beiðnina þína um Lifeline þjálfun að þessu sinni. Ástæða: ${row.decline_reason ?? "—"} Ef þú hefur spurningar geturðu svarað þessum pósti eða skrifað á ${CONTACT_EMAIL}.`,
        cta: { label: "Opna Áskrift", url: `${origin}/app/askrift` },
      },
    });
  }
}

/**
 * One email to contact@ for the first request of the day that a worker has
 * to look at; the workstation's Í dag list carries the rest. Best effort.
 */
async function notifyStaffOfFirstToday(req: CoachingRequestRow) {
  try {
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin.from("hc_coaching_requests").select("id", { count: "exact", head: true })
      .eq("auto_approved", false).gte("created_at", dayStart.toISOString()).neq("id", req.id);
    if ((count ?? 0) > 0) return;
    const to = process.env.HC_COACHING_REQUEST_EMAIL || CONTACT_EMAIL;
    const text = "Ný beiðni um Lifeline þjálfun bíður staðfestingar. Opnaðu Vinnustöðina (Í dag) til að samþykkja eða hafna henni. Fleiri beiðnir í dag birtast þar án tölvupósts.";
    await sendEmail({
      to, subject: "Ný beiðni um Lifeline þjálfun",
      text,
      html: renderBrandedEmail({
        title: "Ný beiðni um Lifeline þjálfun",
        bodyHtml: `<p style="margin:0;">${text}</p>`,
        ctaLabel: "Opna Vinnustöðina", ctaUrl: "https://www.lifelinehealth.is/vinnustod",
      }),
    });
  } catch (e) {
    console.error("[hc] coaching request staff email failed", e instanceof Error ? e.message : e);
  }
}

// ── Notifications list (/api/hc/notifications) ───────────────────────

/** Decisions from the last 30 days, for the app's notification list. */
export async function decisionNotes(clientId: string) {
  const { data, error } = await supabaseAdmin.from("hc_coaching_requests")
    .select("id, status, decided_at, decision_seen_at, decline_reason, auto_approved")
    .eq("client_id", clientId).in("status", ["approved", "declined", "used"]).eq("auto_approved", false)
    .gte("decided_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order("decided_at", { ascending: false }).limit(3);
  if (error) return [];
  return (data ?? []) as { id: string; status: RequestStatus; decided_at: string; decision_seen_at: string | null; decline_reason: string | null }[];
}

export async function markDecisionsSeen(clientId: string) {
  await supabaseAdmin.from("hc_coaching_requests").update({ decision_seen_at: new Date().toISOString() })
    .eq("client_id", clientId).is("decision_seen_at", null).not("decided_at", "is", null)
    .then(() => null, () => null);
}
