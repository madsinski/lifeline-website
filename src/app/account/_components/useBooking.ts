"use client";

// The account page's booking actions, shared by Yfirlit and
// Heilsufarsskoðun so both tabs cancel, refund and confirm the same way.
// Native confirm()/alert() are replaced by the styled dialog (useDialog).

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { createStraumurCharge, refundStraumurCharge } from "@/lib/straumur";
import { useDialog, fmtIsk } from "@/app/components/account/ui";
import type { AccountState, JourneyCheckKey, Patch } from "./types";

export const DOCTOR_ADDON_ISK = 18500;
const SUPPORT = "contact@lifelinehealth.is";

export function useBooking({ user, state, patch, openRefundRequest }: {
  user: User | null;
  state: AccountState;
  patch: (p: Patch) => void;
  openRefundRequest: () => void;
}) {
  const router = useRouter();
  const { t, tv } = useI18n();
  const { confirm, alert } = useDialog();
  const [cancelBusy, setCancelBusy] = useState(false);
  const [videoConfirmBusy, setVideoConfirmBusy] = useState(false);
  const [payingDoctorAddon, setPayingDoctorAddon] = useState(false);

  const { booking, bodyCompPackage, checkinDoctorAddonPaidAt } = state;

  // Shared cancel + (optional) refund for body_comp_bookings.
  //   • unpaid draft  → confirm + cancel
  //   • paid, ≥ 48h   → confirm + Straumur refund + atomic
  //                     refund_and_cancel_booking RPC (payments row, booking,
  //                     station_slot and the optional doctor add-on, in one
  //                     SECURITY DEFINER transaction)
  //   • paid, < 48h   → open the refund-request form; no state change
  // Returns true if the booking was cancelled.
  const cancelCurrentBooking = useCallback(async (reason: "change" | "cancel"): Promise<boolean> => {
    if (!booking.id) return false;
    const scheduled = booking.scheduledAt ? new Date(booking.scheduledAt) : null;
    const hoursUntil = scheduled ? (scheduled.getTime() - Date.now()) / 3_600_000 : Infinity;
    const amount = booking.amount || 0;
    const hasCheckinAddon = bodyCompPackage === "checkin" && !!checkinDoctorAddonPaidAt;

    if (booking.paid && amount > 0) {
      if (hoursUntil < 48) {
        openRefundRequest();
        return false;
      }
      const total = fmtIsk(amount + (hasCheckinAddon ? DOCTOR_ADDON_ISK : 0));
      const ok = await confirm({
        title: reason === "change"
          ? t("acc.cancel.change-title", "Afbóka og velja annan pakka?")
          : t("acc.cancel.title", "Afbóka bókunina?"),
        body: (hasCheckinAddon
          ? tv("acc.cancel.refund-addon", "Full endurgreiðsla, {{amount}} (að meðtöldu viðtali við lækni), berst á kortið þitt innan 3–5 virkra daga.", { amount: total })
          : tv("acc.cancel.refund", "Full endurgreiðsla, {{amount}}, berst á kortið þitt innan 3–5 virkra daga.", { amount: total })),
        confirmLabel: t("acc.cancel.confirm", "Já, afbóka"),
        cancelLabel: t("acc.cancel.keep", "Halda bókuninni"),
        tone: "danger",
      });
      if (!ok) return false;
      setCancelBusy(true);
      try {
        // Straumur first: if the provider refuses, nothing in the DB moves.
        const { data: pay } = await supabase
          .from("payments")
          .select("provider_reference")
          .eq("related_type", "body_comp_booking")
          .eq("related_id", booking.id)
          .eq("status", "succeeded")
          .order("paid_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const providerRef = (pay as { provider_reference?: string } | null)?.provider_reference || booking.id;
        const refund = await refundStraumurCharge({ providerReference: providerRef, amountIsk: amount });
        if (!refund.ok) {
          await alert({
            title: t("acc.cancel.refund-failed", "Endurgreiðslan tókst ekki"),
            body: tv("acc.cancel.refund-failed-body", "{{err}}. Bókunin er óbreytt. Sendu okkur línu á {{email}} og við leysum málið.", { err: refund.error, email: SUPPORT }),
          });
          return false;
        }
        const { data, error } = await supabase.rpc("refund_and_cancel_booking", {
          p_booking_id: booking.id,
          p_include_checkin_addon: hasCheckinAddon,
        });
        const row = Array.isArray(data) ? data[0] : data;
        if (error || (row && row.ok === false)) {
          await alert({
            title: t("acc.cancel.failed", "Ekki tókst að ljúka afbókuninni"),
            body: tv("acc.cancel.failed-body", "{{err}}. Sendu okkur línu á {{email}}.", { err: error?.message || row?.error || "", email: SUPPORT }),
          });
          return false;
        }
        patch({ checkinDoctorAddonPaidAt: null });
        return true;
      } finally {
        setCancelBusy(false);
      }
    }

    // Unpaid draft — the RPC handles the no-refund path too.
    const ok = await confirm({
      title: reason === "change"
        ? t("acc.cancel.change-title", "Afbóka og velja annan pakka?")
        : t("acc.cancel.title", "Afbóka bókunina?"),
      confirmLabel: t("acc.cancel.confirm", "Já, afbóka"),
      cancelLabel: t("acc.cancel.keep", "Halda bókuninni"),
      tone: "danger",
    });
    if (!ok) return false;
    setCancelBusy(true);
    try {
      const { data, error } = await supabase.rpc("refund_and_cancel_booking", {
        p_booking_id: booking.id,
        p_include_checkin_addon: false,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || (row && row.ok === false)) {
        await alert({ title: t("acc.cancel.couldnot", "Ekki tókst að afbóka"), body: error?.message || row?.error || "" });
        return false;
      }
      return true;
    } finally {
      setCancelBusy(false);
    }
  }, [booking, bodyCompPackage, checkinDoctorAddonPaidAt, openRefundRequest, confirm, alert, patch, t, tv]);

  /** Cancel from the bookings list, then clear what the booking drove. */
  const cancelBodyCompBooking = useCallback(async () => {
    const done = await cancelCurrentBooking("cancel");
    if (done) {
      patch((s) => ({
        bodyCompStatus: "none",
        bodyCompBookingAt: null,
        bodyCompPackage: null,
        booking: { ...s.booking, id: null, paid: false },
        mySlotAt: null,
      }));
    }
  }, [cancelCurrentBooking, patch]);

  /** "Skipta um pakka": cancel (with refund if due), then the booking flow. */
  const changePackage = useCallback(async () => {
    if (!booking.id) { router.push("/account/book"); return; }
    const done = await cancelCurrentBooking("change");
    if (done) router.push("/account/book");
  }, [booking.id, cancelCurrentBooking, router]);

  const cancelPendingBooking = useCallback(async () => {
    const pending = state.pendingBooking;
    if (!pending) return;
    const ok = await confirm({
      title: t("acc.pending.cancel-title", "Hætta við ófrágengnu bókunina?"),
      body: t("acc.pending.cancel-body", "Bókunin hefur ekki verið greidd. Þú getur byrjað upp á nýtt hvenær sem er."),
      confirmLabel: t("acc.pending.cancel-confirm", "Já, hætta við"),
      cancelLabel: t("acc.pending.keep", "Nei"),
      tone: "danger",
    });
    if (!ok) return;
    // Through the atomic RPC so payments flags and slot claims stay consistent.
    const { data, error } = await supabase.rpc("refund_and_cancel_booking", {
      p_booking_id: pending.id,
      p_include_checkin_addon: false,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || (row && row.ok === false)) {
      await alert({ title: t("acc.cancel.couldnot", "Ekki tókst að afbóka"), body: error?.message || row?.error || "" });
      return;
    }
    patch({ pendingBooking: null });
  }, [state.pendingBooking, confirm, alert, patch, t]);

  const withdrawRefundRequest = useCallback(async () => {
    const id = state.pendingRefundRequestId;
    if (!id) return;
    const ok = await confirm({
      title: t("acc.refund.withdraw-title", "Draga afbókunarbeiðnina til baka?"),
      body: t("acc.refund.withdraw-body", "Bókunin þín stendur þá óbreytt."),
      confirmLabel: t("acc.refund.withdraw", "Draga til baka"),
      cancelLabel: t("acc.common.no", "Nei"),
    });
    if (!ok) return;
    await supabase.from("refund_requests").update({ status: "withdrawn" }).eq("id", id);
    patch({ pendingRefundRequestId: null });
  }, [state.pendingRefundRequestId, confirm, patch, t]);

  const cancelDoctorSlot = useCallback(async () => {
    if (!state.myDoctorSlot) return;
    const ok = await confirm({
      title: t("acc.doctor.cancel-title", "Afbóka viðtal við lækni?"),
      body: t("acc.doctor.cancel-body", "Tíminn losnar og aðrir geta bókað hann."),
      confirmLabel: t("acc.cancel.confirm", "Já, afbóka"),
      cancelLabel: t("acc.cancel.keep", "Halda bókuninni"),
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.rpc("cancel_doctor_slot");
    if (error) { await alert({ title: t("acc.cancel.couldnot", "Ekki tókst að afbóka"), body: error.message }); return; }
    patch({ myDoctorSlot: null });
  }, [state.myDoctorSlot, confirm, alert, patch, t]);

  const confirmVideoPortal = useCallback(async () => {
    const ok = await confirm({
      title: t("acc.video.confirm-title", "Staðfesta bókun á myndsímtali?"),
      body: t("acc.video.confirm-body", "Staðfestu aðeins ef þú hefur þegar bókað myndsímtal við lækni Lifeline í sjúklingagáttinni (Medalia)."),
      confirmLabel: t("acc.video.confirm", "Já, ég hef bókað"),
      cancelLabel: t("acc.common.notyet", "Ekki enn"),
    });
    if (!ok) return;
    setVideoConfirmBusy(true);
    const { error } = await supabase.rpc("confirm_video_consultation_portal");
    if (!error) patch({ videoPortalConfirmedAt: new Date().toISOString() });
    setVideoConfirmBusy(false);
  }, [confirm, patch, t]);

  const clearVideoPortal = useCallback(async () => {
    const ok = await confirm({
      title: t("acc.video.clear-title", "Hreinsa staðfestingu á myndsímtali?"),
      confirmLabel: t("acc.video.clear", "Hreinsa"),
      cancelLabel: t("acc.common.no", "Nei"),
    });
    if (!ok) return;
    setVideoConfirmBusy(true);
    const { error } = await supabase.rpc("clear_video_consultation_portal");
    if (!error) patch({ videoPortalConfirmedAt: null });
    setVideoConfirmBusy(false);
  }, [confirm, patch, t]);

  /** The doctor add-on to an Endurmat (checkin) package. */
  const payDoctorAddon = useCallback(async () => {
    if (!user) return;
    const ok = await confirm({
      title: t("acc.addon.title", "Bæta við viðtali við lækni?"),
      body: tv("acc.addon.body", "Viðtalið kostar {{amount}} og er greitt með korti í gegnum Straum.", { amount: fmtIsk(DOCTOR_ADDON_ISK) }),
      confirmLabel: t("acc.addon.confirm", "Greiða og bæta við"),
      cancelLabel: t("acct.cancel", "Hætta við"),
    });
    if (!ok) return;
    setPayingDoctorAddon(true);
    try {
      const { profile, companyId, companyName } = state;
      const res = await createStraumurCharge({
        amountIsk: DOCTOR_ADDON_ISK,
        reference: `checkin-doctor-${user.id}-${Date.now()}`,
        description: "Lifeline Health — Tími doctor consultation",
        customer: { name: `${profile.firstName} ${profile.lastName}`.trim() || user.email || "", email: user.email || "", phone: profile.phone || null },
        returnUrl: typeof window !== "undefined" ? window.location.href : "",
      });
      if (!res.ok) { await alert({ title: t("acc.addon.failed", "Greiðslan tókst ekki"), body: res.error }); return; }
      const paidAt = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("clients_decrypted")
        .update({ checkin_doctor_addon_paid_at: paidAt })
        .eq("id", user.id);
      if (updErr) { await alert({ title: t("acc.addon.record-failed", "Ekki tókst að skrá greiðsluna"), body: updErr.message }); return; }
      await supabase.from("payments").insert({
        owner_type: "client",
        owner_id: user.id,
        owner_company_id: companyId ?? null,
        owner_company_name: companyName ?? null,
        amount_isk: DOCTOR_ADDON_ISK,
        currency: "ISK",
        description: "Lifeline Health — Tími doctor consultation",
        provider: "straumur",
        provider_reference: res.providerReference,
        status: "succeeded",
        related_type: "checkin_doctor_addon",
        paid_at: paidAt,
      });
      patch({ checkinDoctorAddonPaidAt: paidAt });
    } finally {
      setPayingDoctorAddon(false);
    }
  }, [user, state, confirm, alert, patch, t, tv]);

  /** Manual journey ticks: optimistic, rolled back if the save fails. */
  const toggleJourneyCheck = useCallback(async (key: JourneyCheckKey) => {
    if (!user) return;
    const prev = state.journeyChecks;
    const nextChecks = { ...prev, [key]: prev[key] ? undefined : new Date().toISOString() };
    patch({ journeyChecks: nextChecks });
    // Strip undefined keys so the JSONB stays tidy.
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(nextChecks)) if (typeof v === "string") payload[k] = v;
    const { error } = await supabase
      .from("clients_decrypted")
      .update({ journey_checks: payload })
      .eq("id", user.id);
    if (error) {
      patch({ journeyChecks: prev });
      await alert({ title: t("acc.common.savefailed", "Ekki tókst að vista"), body: error.message });
    }
  }, [user, state.journeyChecks, patch, alert, t]);

  return {
    cancelBusy, videoConfirmBusy, payingDoctorAddon,
    cancelCurrentBooking, cancelBodyCompBooking, changePackage, cancelPendingBooking,
    withdrawRefundRequest, cancelDoctorSlot, confirmVideoPortal, clearVideoPortal,
    payDoctorAddon, toggleJourneyCheck,
  };
}

export type BookingActions = ReturnType<typeof useBooking>;
