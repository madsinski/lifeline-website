"use client";

// Everything /account loads, in the one auth effect it always had.
//
// Moved out of page.tsx unchanged in behaviour:
//   • getUser() (server-verified) before anything, → /account/login
//   • the email-verified gate (GDPR Art. 9 consent needs a verified identity)
//   • external counsel ("lawyer") is bounced to /admin/legal/drafts
//   • the hc prefetch, so /app paints instantly when they click through
//   • a business signup that never finished goes to /business/account
//   • an orphaned station_slots claim (its booking cancelled) is released
//   • onAuthStateChange is unsubscribed on unmount
//
// Dropped: the queries whose results nothing rendered — conversations,
// education_courses/_snippets, custom_programs, client_programs, programs,
// appointments, a second clients_decrypted "has data" probe, the staff
// greeting role and last_body_comp_at as a value of its own.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getMyStaffRole } from "@/lib/staff-role";
import * as hcCache from "@/lib/hc/client-cache";
import type { AccountState, CompanyEvent, DoctorSlot, MyDoctorSlot, PackageKey, Patch, SatisfactionContext } from "./types";

const DOCTOR_SLOT_COLS = "id, slot_at, duration_minutes, mode, location, meeting_link, doctor_name, notes";

export const INITIAL_STATE: AccountState = {
  profile: { firstName: "", lastName: "", phone: "", address: "", emergencyName: "", emergencyPhone: "", dob: "", sex: "" },
  avatarUrl: null,
  companyId: null,
  companyName: null,
  bodyCompStatus: "none",
  bodyCompPackage: null,
  bodyCompBookingAt: null,
  booking: { id: null, paid: false, amount: 0, scheduledAt: null },
  pendingRefundRequestId: null,
  resolvedRefund: null,
  pendingBooking: null,
  journeyChecks: {},
  checkinDoctorAddonPaidAt: null,
  biodyActivated: false,
  companyEvent: null,
  mySlotAt: null,
  upcomingBloodDays: [],
  upcomingMeasurementDays: [],
  myBloodTestBooking: null,
  myDoctorSlot: null,
  upcomingDoctorSlots: [],
  videoPortalConfirmedAt: null,
  lastWellbeingAt: null,
  satisfactionDone: { body_comp: false, doctor: false, overall: false },
  subscription: null,
};

const asPackage = (v: unknown): PackageKey | null =>
  v === "foundational" || v === "checkin" || v === "self-checkin" ? v : null;

function namesFromMeta(user: User): Partial<AccountState["profile"]> {
  const parts = String(user.user_metadata?.full_name || "").split(" ");
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "", phone: user.phone || user.user_metadata?.phone || "" };
}

export async function fetchOpenDoctorSlots(): Promise<DoctorSlot[]> {
  const { data } = await supabase
    .from("doctor_slots")
    .select(DOCTOR_SLOT_COLS)
    .is("client_id", null)
    .eq("mode", "in_person")
    .gt("slot_at", new Date().toISOString())
    .order("slot_at")
    .limit(50);
  return (data || []) as DoctorSlot[];
}

export async function fetchMyDoctorSlot(userId: string): Promise<MyDoctorSlot | null> {
  const { data } = await supabase
    .from("doctor_slots")
    .select(`${DOCTOR_SLOT_COLS}, booking_note`)
    .eq("client_id", userId)
    .is("completed_at", null)
    .maybeSingle();
  return (data as MyDoctorSlot | null) ?? null;
}

export async function fetchMyEventSlot(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("body_comp_event_bookings")
    .select("slot_at")
    .eq("client_id", userId)
    .order("slot_at")
    .limit(1)
    .maybeSingle();
  return (data?.slot_at as string | undefined) ?? null;
}

export function useAccountData(upgradeParam: string | null) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<AccountState>(INITIAL_STATE);

  const patch = useCallback((p: Patch) => {
    setState((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) }));
  }, []);

  useEffect(() => {
    // Use getUser() (hits the server) not getSession() so a revoked JWT
    // (e.g. signed out in another tab) is treated as logged-out even
    // though the client still has it cached locally.
    supabase.auth.getUser().then(async ({ data: { user: verifiedUser } }) => {
      if (!verifiedUser) {
        router.push("/account/login");
        setLoading(false);
        return;
      }
      // Email verification gate. GDPR Art. 9 health consent + Biody
      // activation should not run against an unverified identity.
      if (!verifiedUser.email_confirmed_at) {
        router.push("/account/login?verify=1");
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/account/login");
        setLoading(false);
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);

      // Lawyer hard-redirect: external counsel is never a client. Other
      // staff roles can legitimately be clients too. Through the SECURITY
      // DEFINER RPC (getMyStaffRole) — a raw staff select returns no role
      // for invited staff whose staff.id differs from their auth id.
      if (currentUser.email) {
        try {
          if ((await getMyStaffRole(currentUser.email)) === "lawyer") {
            router.replace("/admin/legal/drafts");
            return;
          }
        } catch { /* fall through */ }
      }

      // Warm what the app reads, so /app paints on arrival when they click
      // through. (This used to be a redirect into the app; it is a prefetch.)
      {
        const token = session.access_token ?? "";
        const hc = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const peek = await hcCache.load(hc, "/api/hc/journey/exists").then((e) => e.body as { exists?: boolean; has_plan?: boolean }).catch(() => null);
        if (peek?.exists) {
          hcCache.prefetch(hc, peek.has_plan ? ["/api/hc/actions", "/api/hc/plan"] : ["/api/hc/journey"]);
        }
      }

      const next: Partial<AccountState> = {};
      const profile = { ...INITIAL_STATE.profile };

      try {
        const { data: clientData } = await supabase
          .from("clients_decrypted")
          .select("full_name, phone, address, emergency_contact_name, emergency_contact_phone, date_of_birth, sex, welcome_seen_at, company_id, last_body_comp_at, biody_patient_id, video_consultation_portal_confirmed_at, avatar_url, checkin_doctor_addon_paid_at, journey_checks")
          .eq("id", currentUser.id)
          .single();

        if (clientData) {
          const cd = clientData as Record<string, unknown>;
          const companyId = (cd.company_id as string | null) || null;
          /* Somebody who signed up to manage a company and never finished
             belongs in the business portal; this page has nothing for them. */
          if (!companyId && !cd.welcome_seen_at
              && (currentUser.user_metadata?.account_origin as string | undefined) === "business") {
            router.replace("/business/account");
            setLoading(false);
            return;
          }

          const nameParts = String(cd.full_name || "").split(" ");
          Object.assign(profile, {
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            phone: (cd.phone as string) || "",
            address: (cd.address as string) || "",
            emergencyName: (cd.emergency_contact_name as string) || "",
            emergencyPhone: (cd.emergency_contact_phone as string) || "",
            dob: (cd.date_of_birth as string) || "",
            sex: (cd.sex as string) || "",
          });
          next.biodyActivated = !!cd.biody_patient_id;
          const jc = (cd.journey_checks as Record<string, unknown> | null) || {};
          next.journeyChecks = {
            questionnaire: typeof jc.questionnaire === "string" ? jc.questionnaire : undefined,
            blood_test: typeof jc.blood_test === "string" ? jc.blood_test : undefined,
            results_viewed: typeof jc.results_viewed === "string" ? jc.results_viewed : undefined,
          };
          next.videoPortalConfirmedAt = (cd.video_consultation_portal_confirmed_at as string | null) || null;
          next.avatarUrl = (cd.avatar_url as string | null) || null;
          next.checkinDoctorAddonPaidAt = (cd.checkin_doctor_addon_paid_at as string | null) || null;

          if (companyId) {
            next.companyId = companyId;
            const today = new Date().toISOString().slice(0, 10);
            const [{ data: c }, { data: ev }, mySlot, { data: bd }, { data: mcd }, { data: mbt }] = await Promise.all([
              supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
              // Upcoming B2B body-comp event
              supabase.from("body_comp_events")
                .select("id, event_date, start_time, end_time, location, room_notes, break_start, break_end, slot_minutes, slot_capacity, company_id")
                .eq("company_id", companyId).eq("status", "scheduled").gte("event_date", today)
                .order("event_date").limit(1).maybeSingle(),
              fetchMyEventSlot(currentUser.id),
              supabase.from("blood_test_days").select("day, notes").eq("company_id", companyId).gte("day", today).order("day"),
              // Lyfja walk-in measurement days (alternative to an on-site event)
              supabase.from("body_comp_days").select("day, notes").eq("company_id", companyId).gte("day", today).order("day"),
              supabase.from("blood_test_bookings").select("day, note").eq("client_id", currentUser.id).maybeSingle(),
            ]);
            if (c?.name) next.companyName = c.name as string;
            if (ev) next.companyEvent = ev as CompanyEvent;
            if (mySlot) next.mySlotAt = mySlot;
            next.upcomingBloodDays = (bd || []) as AccountState["upcomingBloodDays"];
            next.upcomingMeasurementDays = (mcd || []) as AccountState["upcomingMeasurementDays"];
            if (mbt) next.myBloodTestBooking = mbt as AccountState["myBloodTestBooking"];
          }

          // Doctor consultation — my active booking + open in-person slots;
          // and the two survey states the prompts read.
          const [myDr, drSlots, { data: wb }, { data: sats }] = await Promise.all([
            fetchMyDoctorSlot(currentUser.id),
            fetchOpenDoctorSlots(),
            supabase.from("client_wellbeing_surveys").select("created_at").eq("client_id", currentUser.id)
              .order("created_at", { ascending: false }).limit(1).maybeSingle(),
            supabase.from("client_satisfaction_surveys").select("context").eq("client_id", currentUser.id),
          ]);
          if (myDr) next.myDoctorSlot = myDr;
          next.upcomingDoctorSlots = drSlots;
          next.lastWellbeingAt = (wb?.created_at as string | undefined) || null;
          if (sats && sats.length) {
            const done = { ...INITIAL_STATE.satisfactionDone };
            for (const r of sats as Array<{ context: SatisfactionContext }>) done[r.context] = true;
            next.satisfactionDone = done;
          }

          // Body comp booking (solo / clinic path). Unpaid rows are abandoned
          // wizard drafts and must not make the page think the user is
          // mid-journey; legacy rows predate the payment columns
          // (amount_isk is null) and are let through.
          const { data: booking } = await supabase
            .from("body_comp_bookings")
            .select("id, scheduled_at, status, amount_isk, payment_status, package, created_at")
            .eq("client_id", currentUser.id)
            .in("status", ["requested", "confirmed", "completed"])
            .or("amount_isk.is.null,payment_status.eq.paid")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (booking) {
            const b = booking as Record<string, unknown>;
            if (b.status === "completed") next.bodyCompStatus = "completed";
            else {
              next.bodyCompStatus = "booked";
              next.bodyCompBookingAt = (b.scheduled_at as string | null) || null;
            }
            next.booking = {
              id: (b.id as string) || null,
              paid: (b.payment_status as string | null) === "paid",
              amount: (b.amount_isk as number | null) ?? 0,
              scheduledAt: (b.scheduled_at as string | null) ?? null,
            };
            // A pending refund request for this booking replaces the cancel button.
            const { data: rr } = await supabase
              .from("refund_requests")
              .select("id")
              .eq("client_id", currentUser.id)
              .eq("booking_id", b.id as string)
              .eq("status", "pending")
              .limit(1)
              .maybeSingle();
            if (rr?.id) next.pendingRefundRequestId = rr.id as string;
            const pkg = asPackage(b.package);
            if (pkg) next.bodyCompPackage = pkg;
            else {
              // Older rows predate the `package` column; infer from the amount.
              const amt = b.amount_isk as number | null | undefined;
              if (amt === 0) next.bodyCompPackage = "self-checkin";
              else if (amt === 19900) next.bodyCompPackage = "checkin";
              else if (amt === 49900) next.bodyCompPackage = "foundational";
            }
          } else if (cd.last_body_comp_at) {
            next.bodyCompStatus = "completed";
          }

          // A refund request resolved in the last 14 days, so the decision is
          // visible here and not only in the email.
          const resolvedCutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
          const { data: recentResolved } = await supabase
            .from("refund_requests")
            .select("id, status, admin_note, approved_isk, resolved_at")
            .eq("client_id", currentUser.id)
            .in("status", ["approved", "denied"])
            .gte("resolved_at", resolvedCutoff)
            .order("resolved_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (recentResolved) {
            const rr = recentResolved as { id: string; status: string; admin_note: string | null; approved_isk: number | null; resolved_at: string };
            if (rr.status === "approved" || rr.status === "denied") {
              next.resolvedRefund = { id: rr.id, status: rr.status, admin_note: rr.admin_note, approved_isk: rr.approved_isk, resolved_at: rr.resolved_at };
            }
          }

          // B2C fallback: no active booking loaded → station_slots is the
          // source of truth for who has claimed a measurement time.
          //   (a) claim without booking_id   → admin-set, shown as foundational
          //   (b) backing booking active     → rebuild state from it
          //   (c) backing booking cancelled  → orphan; release the slot
          if (!companyId && !booking) {
            const { data: solo } = await supabase
              .from("station_slots")
              .select("id, slot_at, booking_id")
              .eq("client_id", currentUser.id)
              .is("completed_at", null)
              .order("slot_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (solo?.slot_at) {
              const backingId = (solo as { booking_id?: string | null }).booking_id;
              const slotId = (solo as { id: string }).id;
              let orphan = false;
              if (backingId) {
                const { data: bk } = await supabase
                  .from("body_comp_bookings")
                  .select("id, package, amount_isk, payment_status, scheduled_at, status")
                  .eq("id", backingId)
                  .maybeSingle();
                if (bk && bk.status !== "cancelled") {
                  const k = bk as Record<string, unknown>;
                  next.bodyCompPackage = asPackage(k.package) ?? "foundational";
                  next.bodyCompStatus = "booked";
                  next.bodyCompBookingAt = solo.slot_at as string;
                  next.mySlotAt = solo.slot_at as string;
                  next.booking = {
                    id: k.id as string,
                    paid: (k.payment_status as string | null) === "paid",
                    amount: (k.amount_isk as number | null) ?? 0,
                    scheduledAt: (k.scheduled_at as string | null) ?? null,
                  };
                } else {
                  orphan = true;
                }
              } else {
                next.bodyCompStatus = "booked";
                next.bodyCompBookingAt = solo.slot_at as string;
                next.mySlotAt = solo.slot_at as string;
                next.bodyCompPackage = "foundational";
              }
              if (orphan) {
                await supabase.rpc("release_station_slot_by_id", { p_slot_id: slotId });
              }
            }
          }

          // A booking started but not paid for → "finish your booking".
          const { data: pending } = await supabase
            .from("body_comp_bookings")
            .select("id, scheduled_at, package, created_at")
            .eq("client_id", currentUser.id)
            .eq("status", "requested")
            .eq("payment_status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (pending) {
            const p = pending as Record<string, unknown>;
            next.pendingBooking = { id: p.id as string, package: (p.package as string | null) ?? null, scheduled_at: (p.scheduled_at as string | null) ?? null };
          }
        } else {
          Object.assign(profile, namesFromMeta(currentUser));
        }
      } catch {
        Object.assign(profile, namesFromMeta(currentUser));
      }

      // Active app subscription
      try {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("id, tier, status, trial_ends_at, current_period_start, current_period_end")
          .eq("client_id", currentUser.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        if (subData && subData.length > 0) next.subscription = subData[0] as AccountState["subscription"];
      } catch { /* none */ }

      patch({ ...next, profile });
      setLoading(false);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/account/login");
      else setUser(session.user);
    });

    return () => authSub.unsubscribe();
    // upgradeParam: an old pricing-page link (?upgrade=<tier>) used to re-run
    // this effect to switch section; the section is read from the URL now,
    // but a changed ?upgrade= still re-loads, as before.
  }, [router, upgradeParam, patch]);

  return { user, loading, state, patch };
}
