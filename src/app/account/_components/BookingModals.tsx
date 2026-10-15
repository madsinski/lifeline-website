"use client";

// The account page's pickers and the late-cancellation request, on the
// shared Modal. Logic unchanged from page.tsx; copy translated, dates
// hand-formatted, confirm()/alert() replaced by useDialog().

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { SAMEIND_STATIONS, fullAddress } from "@/lib/sameind-locations";
import { Alert, Button, Modal, accountInput, accountInset, accountLabel, fmtDate, fmtDateTime, fmtIsk, fmtTime, useDialog } from "@/app/components/account/ui";
import { DOCTOR_ADDON_ISK } from "./useBooking";
import type { BloodTestBooking, DayRow, DoctorMode, DoctorSlot, MyDoctorSlot } from "./types";

const choice = (on: boolean) =>
  `rounded-hc-element px-3 py-2 text-left text-sm ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
    on ? "bg-hc-brand-surface text-hc-brand-text ring-2 ring-hc-brand-dark" : "bg-hc-surface text-hc-ink ring-slate-200 hover:ring-hc-control"}`;

export function BloodTestDayPickerModal({ companyId, days, existing, onClose, onBooked, onCancelled }: {
  companyId: string;
  days: DayRow[];
  existing: BloodTestBooking | null;
  onClose: () => void;
  onBooked: (booking: BloodTestBooking) => void;
  onCancelled: () => void;
}) {
  const { t, locale } = useI18n();
  const { confirm } = useDialog();
  const [selectedDay, setSelectedDay] = useState<string>(existing?.day || "");
  const [note, setNote] = useState<string>(existing?.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!selectedDay) { setError(t("acc.bt.pick", "Veldu dag.")); return; }
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError(t("acct.p.thu-tharft-ad-skra-thig", "Þú þarft að skrá þig inn")); setSaving(false); return; }
    const { error: upErr } = await supabase.from("blood_test_bookings").upsert({
      client_id: user.id,
      company_id: companyId,
      day: selectedDay,
      note: note.trim() || null,
    }, { onConflict: "client_id" });
    setSaving(false);
    if (upErr) { setError(upErr.message); return; }
    onBooked({ day: selectedDay, note: note.trim() || null });
    onClose();
  };

  const cancel = async () => {
    const ok = await confirm({
      title: t("acct.p.afboka-daginn-fyrir-blodprufu", "Afbóka daginn fyrir blóðprufu?"),
      confirmLabel: t("acc.cancel.confirm", "Já, afbóka"), cancelLabel: t("acc.common.no", "Nei"), tone: "danger",
    });
    if (!ok) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: delErr } = await supabase.from("blood_test_bookings").delete().eq("client_id", user.id);
    if (delErr) { setError(delErr.message); return; }
    // Was a full page reload; the parent clears the booking instead.
    onCancelled();
    onClose();
  };

  return (
    <Modal title={t("acct.p.veldu-dag-fyrir-blodprufu", "Veldu dag fyrir blóðprufu")} onClose={onClose} dismissable={!saving}
      description={t("acc.bt.desc", "Fyrirtækið þitt samþykkir ákveðna daga fyrir blóðprufu hjá Sameind. Mættu á hvaða stöð sem er á opnunartíma hennar.")}
      footer={<>
        {existing && <Button variant="dangerOutline" className="mr-auto" onClick={cancel}>{t("acct.q.cancelbooking", "Afbóka")}</Button>}
        <Button variant="secondary" onClick={onClose}>{t("acct.q.close", "Loka")}</Button>
        <Button onClick={save} busy={saving} disabled={!selectedDay}>{existing ? t("acc.common.update", "Uppfæra") : t("acc.bt.confirm", "Staðfesta dag")}</Button>
      </>}>
      <div className="space-y-4">
        {days.length === 0 ? (
          <p className="text-sm text-hc-ink-2">{t("acc.bt.none", "Fyrirtækið þitt hefur ekki samþykkt neina daga enn.")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("acct.p.veldu-dag-fyrir-blodprufu", "Veldu dag fyrir blóðprufu")}>
            {days.map((d) => (
              <button key={d.day} type="button" role="radio" aria-checked={d.day === selectedDay} onClick={() => setSelectedDay(d.day)} className={choice(d.day === selectedDay)}>
                <span className="block font-medium">{fmtDate(d.day, { weekday: true, year: false }, locale)}</span>
                {d.notes && <span className="mt-0.5 block text-xs text-hc-ink-3">{d.notes}</span>}
              </button>
            ))}
          </div>
        )}
        <label className="block">
          <span className={accountLabel}>{t("acct.q.note", "Athugasemd (valfrjálst)")}</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("acc.bt.note-ph", "t.d. ég mæti um kl. 8:30")} className={`${accountInput} mt-1`} />
        </label>
        <Alert tone="warn" compact title={t("acct.p.mikilvaegt-fasta-fyrir-blodprufu", "Mikilvægt — fasta fyrir blóðprufu")}>
          {t("acc.bt.fasting", "Fastaðu frá miðnætti kvöldið fyrir. Vatn er í lagi, en enginn matur, kaffi, te, safi eða áfengi.")}
        </Alert>
        <details className={`group ${accountInset}`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-hc-ink-2">
            <span>{t("acct.p.sameind-thu-getur-maett-a", "Sameind — þú getur mætt á hvaða stöð sem er")}</span>
            <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ul className="divide-y divide-hc-hairline border-t border-hc-hairline px-3">
            {SAMEIND_STATIONS.map((s) => (
              <li key={s.id} className="py-2 text-xs">
                <p className="font-medium text-hc-ink">{s.name}</p>
                <p className="text-hc-ink-2">{fullAddress(s)}</p>
                <p className="text-hc-ink-3">{s.hours}</p>
              </li>
            ))}
          </ul>
        </details>
        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}

export function DoctorSlotPickerModal({ slots, existing, onClose, onBooked, onCancelled }: {
  slots: DoctorSlot[];
  existing: MyDoctorSlot | null;
  onClose: () => void;
  onBooked: () => Promise<void> | void;
  onCancelled: () => void;
}) {
  const { t, locale } = useI18n();
  const { confirm } = useDialog();
  const [selectedId, setSelectedId] = useState<string>("");
  const [note, setNote] = useState<string>(existing?.booking_note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const modeLabel = (m: DoctorMode) => m === "video" ? t("acc.bk.video", "Myndsímtal") : m === "phone" ? t("acc.bk.phone", "Símtal") : t("acct.p.a-stadnum", "Á staðnum");

  const grouped = useMemo(() => {
    const map = new Map<string, DoctorSlot[]>();
    for (const s of slots) {
      const day = new Date(s.slot_at).toISOString().slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const save = async () => {
    if (!selectedId) { setError(t("acct.p.veldu-tima-2", "Veldu tíma.")); return; }
    setSaving(true);
    setError("");
    // Changing an existing claim is an atomic swap: claim the new slot
    // first, then release the old, so a failed claim leaves it intact.
    const rpcName = existing ? "change_doctor_slot" : "book_doctor_slot";
    const args = existing
      ? { p_to_slot_id: selectedId, p_note: note.trim() || null }
      : { p_slot_id: selectedId, p_note: note.trim() || null };
    const { data, error: bookErr } = await supabase.rpc(rpcName, args);
    setSaving(false);
    if (bookErr) { setError(bookErr.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.ok === false) {
      setError(
        row.error === "slot_unavailable" ? t("acc.dr.taken", "Einhver var að bóka þennan tíma. Veldu annan.")
        : row.error === "already_booked" ? t("acct.p.thu-att-thegar-bokun", "Þú átt þegar bókun.")
        : row.error === "company_reserved" ? t("acct.p.thessi-timi-er-fratekinn-fyrir", "Þessi tími er frátekinn fyrir annað fyrirtæki.")
        : row.error || t("acct.p.bokun-tokst-ekki", "Bókun tókst ekki."),
      );
      return;
    }
    await onBooked();
    onClose();
  };

  const cancel = async () => {
    const ok = await confirm({
      title: t("acct.p.afboka-vidtal-vid-laekni", "Afbóka viðtal við lækni?"),
      confirmLabel: t("acc.cancel.confirm", "Já, afbóka"), cancelLabel: t("acc.common.no", "Nei"), tone: "danger",
    });
    if (!ok) return;
    const { error: cancelErr } = await supabase.rpc("cancel_doctor_slot");
    if (cancelErr) { setError(cancelErr.message); return; }
    onCancelled();
    onClose();
  };

  return (
    <Modal title={existing ? t("acct.p.breyta-vidtali-vid-laekni", "Breyta viðtali við lækni") : t("acct.p.boka-vidtal-vid-laekni", "Bóka viðtal við lækni")}
      description={t("acct.q.meet11", "Hittu Lifeline-lækninn þinn einslega til að fara yfir skýrsluna og koma ykkur saman um aðgerðaáætlun.")}
      onClose={onClose} dismissable={!saving}
      footer={<>
        {existing && <Button variant="dangerOutline" className="mr-auto" onClick={cancel}>{t("acct.q.cancelbooking", "Afbóka")}</Button>}
        <Button variant="secondary" onClick={onClose}>{t("acct.q.close", "Loka")}</Button>
        <Button onClick={save} busy={saving} disabled={!selectedId}>{existing ? t("acc.common.update", "Uppfæra") : t("acc.dr.confirm", "Staðfesta tíma")}</Button>
      </>}>
      <div className="space-y-4">
        {existing && (
          <p className={`${accountInset} px-3 py-2 text-sm text-hc-ink-2`}>
            {t("acc.dr.current", "Núverandi bókun")}: <strong className="text-hc-ink">{fmtDateTime(existing.slot_at, { weekday: "short" }, locale)}</strong>
            {existing.doctor_name && <> · {existing.doctor_name}</>} · {modeLabel(existing.mode)}
          </p>
        )}
        {grouped.length === 0 ? (
          <p className={`${accountInset} p-5 text-center text-sm text-hc-ink-2`}>{t("acct.q.noslots", "Engir lausir tímar eins og er. Lifeline opnar nýja tíma fljótlega.")}</p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([day, daySlots]) => (
              <fieldset key={day}>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-hc-ink-3">{fmtDate(day, { weekday: true, year: false }, locale)}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {daySlots.map((s) => (
                    <button key={s.id} type="button" aria-pressed={selectedId === s.id} onClick={() => setSelectedId(s.id)} className={choice(selectedId === s.id)}>
                      <span className="block font-semibold">{fmtTime(s.slot_at)}</span>
                      <span className="block text-xs text-hc-ink-3">{s.duration_minutes} mín. · {modeLabel(s.mode)}</span>
                      {s.doctor_name && <span className="block truncate text-xs text-hc-ink-3">{s.doctor_name}</span>}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}
        <label className="block">
          <span className={accountLabel}>{t("acct.q.note", "Athugasemd (valfrjálst)")}</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("acct.p.eitthvad-sem-laeknirinn-aetti-ad", "Eitthvað sem læknirinn ætti að vita fyrir fram")} className={`${accountInput} mt-1`} />
        </label>
        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}

// Inside the 48-hour window a paid booking cannot be self-cancelled; this
// writes a refund_requests row for an admin to resolve in /admin/bookings.
export function RefundRequestModal({ bookingId, clientId, amountIsk, includeCheckinAddon, scheduledAt, onClose, onSubmitted }: {
  bookingId: string;
  clientId: string;
  amountIsk: number;
  includeCheckinAddon: boolean;
  scheduledAt: string | null;
  onClose: () => void;
  onSubmitted: (requestId: string) => void;
}) {
  const { t, locale } = useI18n();
  const [reason, setReason] = useState("");
  const [includeAddon, setIncludeAddon] = useState(includeCheckinAddon);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const total = amountIsk + (includeAddon ? DOCTOR_ADDON_ISK : 0);

  async function submit() {
    if (!reason.trim()) { setErr(t("acct.p.segdu-okkur-af-hverju-thu", "Segðu okkur af hverju þú þarft að afbóka svo við getum aðstoðað hratt.")); return; }
    setErr(""); setBusy(true);
    const { data, error } = await supabase.from("refund_requests").insert({
      client_id: clientId,
      booking_id: bookingId,
      booking_type: "body_comp_booking",
      reason: reason.trim(),
      requested_isk: total,
      include_checkin_addon: includeAddon,
      status: "pending",
    }).select("id").single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const requestId = (data as { id: string }).id;
    // Fire-and-forget admin notification; the row is already saved.
    fetch("/api/bookings/refund-request-submitted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    }).catch(() => {});
    onSubmitted(requestId);
  }

  return (
    <Modal title={t("acct.q.requestcancel", "Óska eftir afbókun")} onClose={onClose} dismissable={!busy}
      description={t("acc.rr.desc", "Innan við 48 klukkustundir eru í tímann, svo við förum yfir afbókunina handvirkt. Segðu okkur hvað er í gangi og við svörum í tölvupósti innan eins virks dags.")}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>{t("acct.q.close", "Loka")}</Button>
        <Button variant="danger" onClick={submit} busy={busy}>{t("acc.rr.send", "Senda afbókunarbeiðni")}</Button>
      </>}>
      <div className="space-y-4">
        <dl className={`${accountInset} space-y-1 p-3 text-sm`}>
          <div className="flex justify-between gap-3"><dt className="text-hc-ink-3">{t("acct.q.booking", "Bókun")}</dt><dd className="text-right font-medium text-hc-ink">{scheduledAt ? fmtDateTime(scheduledAt, { weekday: true, year: true }, locale) : "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-hc-ink-3">{t("acct.q.amountpaid", "Greidd upphæð")}</dt><dd className="font-medium text-hc-ink">{fmtIsk(total)}</dd></div>
        </dl>
        <label className="block">
          <span className={accountLabel}>{t("acct.q.reason", "Ástæða")}</span>
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} className={`${accountInput} mt-1`}
            placeholder={t("acc.rr.ph", "t.d. veikindi: ég kemst ekki og vil gjarnan færa tímann eða fá endurgreitt.")} />
        </label>
        {includeCheckinAddon && (
          <label className="flex items-center gap-2 text-sm text-hc-ink-2">
            <input type="checkbox" checked={includeAddon} onChange={(e) => setIncludeAddon(e.target.checked)} className="h-4 w-4 accent-emerald-700" />
            {t("acc.rr.addon", "Óska líka eftir endurgreiðslu á viðtali við lækni (18.500 kr.)")}
          </label>
        )}
        {err && <Alert tone="bad" compact>{err}</Alert>}
        <p className="text-xs text-hc-ink-3">{t("acc.rr.policy", "Endurgreiðsla innan 48 klukkustunda er metin í hverju tilviki. Ef hún er samþykkt berst upphæðin á kortið þitt innan 3–5 virkra daga.")}</p>
      </div>
    </Modal>
  );
}
