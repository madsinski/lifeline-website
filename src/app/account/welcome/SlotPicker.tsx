"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Alert, Button, Modal, fmtDate, fmtTime, friendlyError, useDialog, useFlash } from "@/app/components/account/ui";

interface Slot {
  slot_at: string;
  booked_count: number;
  is_mine: boolean;
}

interface Event {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  room_notes: string | null;
  break_start: string | null;
  break_end: string | null;
  slot_minutes: number;
  slot_capacity: number;
}

interface Props {
  event: Event;
  onClose: () => void;
  onBooked: () => void;
}

export default function SlotPicker({ event, onClose, onBooked }: Props) {
  const { t, tv, locale } = useI18n();
  const { confirm } = useDialog();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  /* The grid re-marks "Þinn tími ✓" after a reload; this says it in words
     at the top of the modal, where it cannot be missed. */
  const [okMsg, flashOk, clearOk] = useFlash(5000);

  // Defence-in-depth: hide any slot that falls inside the day's lunch
  // break. The list_event_slots RPC already skips these once the
  // break-window migration is applied, but filtering here keeps the
  // break enforced in the UI regardless of RPC version.
  const inBreak = (slotAt: string): boolean => {
    if (!event.break_start || !event.break_end) return false;
    const hm = fmtTime(slotAt); // Icelandic wall-clock time, like the break columns
    return hm >= event.break_start.slice(0, 5) && hm < event.break_end.slice(0, 5);
  };

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc("list_event_slots", { p_event_id: event.id });
    if (err) setError(friendlyError(err, t("acc.slot.loadfailed", "Tókst ekki að sækja tímana.")));
    else setSlots(((data || []) as Slot[]).filter((s) => !inBreak(s.slot_at)));
    setLoading(false);
  };

  useEffect(() => {
    // Deferred a tick: load() sets state, and an effect body should not.
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const book = async (slotAt: string) => {
    setSaving(slotAt);
    setError("");
    clearOk();
    const { error: err } = await supabase.rpc("book_body_comp_slot", {
      p_event_id: event.id,
      p_slot_at: slotAt,
    });
    setSaving(null);
    if (err) {
      setError(
        err.message.includes("slot_full")
          ? t("b2b.welcome.slot.full", "Þessi tími var að fyllast. Veldu annan.")
          : err.message.includes("forbidden")
            ? t("b2b.welcome.slot.forbidden", "Þú getur aðeins bókað tíma á viðburði þíns eigin fyrirtækis.")
            : friendlyError(err, t("acc.slot.bookfailed", "Tókst ekki að bóka tímann.")),
      );
      load();
      return;
    }
    flashOk(tv("acc.slot.booked", "Tíminn kl. {{time}} er bókaður.", { time: fmtTime(slotAt) }));
    onBooked();
    load();
  };

  const cancel = async () => {
    const ok = await confirm({
      title: t("acct.slot.cancelconfirm2", "Afbóka mælingatímann? Þú getur valið annan lausan tíma strax á eftir."),
      confirmLabel: t("acc.cancel.confirm", "Já, afbóka"), cancelLabel: t("acc.common.no", "Nei"), tone: "danger",
    });
    if (!ok) return;
    setSaving("cancel");
    setError("");
    clearOk();
    const { error } = await supabase.rpc("cancel_body_comp_slot", { p_event_id: event.id });
    if (error) {
      setError(friendlyError(error, t("acc.slot.cancelfailed", "Tókst ekki að afbóka tímann.")));
      setSaving(null);
      return;
    }
    setSaving(null);
    flashOk(t("acc.slot.cancelled", "Tíminn var afbókaður. Þú getur valið annan."));
    onBooked();
    load();
  };

  const dateLabel = fmtDate(event.event_date, { weekday: true }, locale);
  const choice = (mine: boolean, full: boolean) =>
    `rounded-hc-element p-2 text-center text-sm ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
      mine ? "bg-hc-brand-surface font-semibold text-hc-brand-text ring-2 ring-hc-brand-dark"
        : full ? "cursor-not-allowed bg-hc-sunken text-hc-ink-3 ring-hc-hairline"
          : "bg-hc-surface text-hc-ink ring-slate-200 hover:ring-hc-control"}`;

  return (
    <Modal size="lg" title={t("b2b.welcome.slot.title", "Veldu 5 mínútna tíma")} onClose={onClose} dismissable={saving === null}
      description={<>
        <span className="block">{dateLabel} · {event.start_time.slice(0, 5)}–{event.end_time.slice(0, 5)}</span>
        {event.location && <span className="block text-xs">{event.location}</span>}
        {event.room_notes && <span className="block text-xs">{event.room_notes}</span>}
      </>}
      footer={<>
        {slots.some((s) => s.is_mine) && (
          <Button variant="dangerOutline" className="mr-auto" onClick={cancel} disabled={saving !== null} busy={saving === "cancel"}>{t("b2b.welcome.slot.cancel", "Afbóka")}</Button>
        )}
        <Button variant="secondary" onClick={onClose} disabled={saving !== null}>{t("acct.q.close", "Loka")}</Button>
      </>}>
      {loading && <p className="text-sm text-hc-ink-3">{t("b2b.welcome.slot.loading", "Sæki tíma…")}</p>}
      {error && <Alert tone="bad" compact className="mb-3">{error}</Alert>}
      {okMsg && !error && <Alert tone="ok" compact className="mb-3">{okMsg}</Alert>}
      {!loading && slots.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => {
            const full = s.booked_count >= event.slot_capacity && !s.is_mine;
            const mine = s.is_mine;
            return (
              <button key={s.slot_at} type="button" onClick={() => book(s.slot_at)} disabled={full || saving !== null} aria-pressed={mine} className={choice(mine, full)}>
                <span className="block font-mono">{fmtTime(s.slot_at)}</span>
                <span className="mt-0.5 block text-[11px]">
                  {mine ? t("b2b.welcome.slot.mine", "Þinn tími ✓")
                    : full ? t("acc.slot.full", "Fullt")
                    : tv("acc.slot.taken", "{{n}}/{{cap}} bókaðir", { n: s.booked_count, cap: event.slot_capacity })}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {!loading && slots.length === 0 && !error && (
        <p className="text-sm text-hc-ink-3">{t("b2b.welcome.slot.none", "Engir tímar enn.")}</p>
      )}
    </Modal>
  );
}
