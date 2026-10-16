"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Modal, Button, Alert, accountInput, accountLabel } from "@/app/components/account/ui";
import { verifyAdminPassword } from "./DeleteConfirmModal";

// Bulk-delete modal shared between admin/doctor-slots and
// admin/station-slots. Filters by date range, weekday, optional
// time range, booking status, and (for doctor slots) reserved
// company. Previews the count before deleting.

type CompanyOption = { id: string; name: string };

interface PreviewRow {
  id: string;
  slot_at: string;
  client_id: string | null;
  company_id: string | null;
  day: string;
  time: string;
}

interface Props {
  tableName: "doctor_slots" | "station_slots";
  displayName: string;            // "doctor consultation slot" / "measurement slot"
  companies?: CompanyOption[];    // required if showCompanyFilter
  showCompanyFilter?: boolean;    // doctor_slots has company_id; station_slots doesn't
  onClose: () => void;
  onDone: (deletedCount: number) => void;
}

// Sunday-first to match Date.getDay().
const DAY_NAMES = ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"];

// The callers pass an English displayName; the copy here is Icelandic, so
// the noun comes from the table instead.
const KIND: Record<Props["tableName"], string> = {
  doctor_slots: "læknatíma",
  station_slots: "mælingatíma",
};
/** Dative after „eyða“: 1 tíma, 2 tímum. */
const slotsDat = (n: number) => `${n} ${n === 1 ? "tíma" : "tímum"}`;

export default function SlotsBulkDeleteModal({
  tableName, companies = [], showCompanyFilter = false, onClose, onDone,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [onlyUnbooked, setOnlyUnbooked] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>("any"); // "any" | "none" | <id>
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const loadPreview = useCallback(async () => {
    if (!startDate || !endDate) { setRows([]); return; }
    setLoadingPreview(true);
    setErr("");
    const startIso = new Date(`${startDate}T00:00:00`).toISOString();
    const endIso = new Date(`${endDate}T23:59:59`).toISOString();
    const cols = showCompanyFilter
      ? "id, slot_at, client_id, company_id"
      : "id, slot_at, client_id";
    let q = supabase
      .from(tableName)
      .select(cols)
      .gte("slot_at", startIso)
      .lte("slot_at", endIso)
      .order("slot_at");
    if (onlyUnbooked) q = q.is("client_id", null);
    if (showCompanyFilter) {
      if (companyFilter === "none") q = q.is("company_id", null);
      else if (companyFilter !== "any") q = q.eq("company_id", companyFilter);
    }
    const { data, error } = await q;
    setLoadingPreview(false);
    if (error) { setErr(error.message); setRows([]); return; }
    const list: PreviewRow[] = ((data as unknown as Record<string, unknown>[]) || []).map((r) => {
      const at = new Date(r.slot_at as string);
      return {
        id: r.id as string,
        slot_at: r.slot_at as string,
        client_id: (r.client_id as string | null) ?? null,
        company_id: (r.company_id as string | null) ?? null,
        day: at.toLocaleDateString("is-IS", { weekday: "short", day: "numeric", month: "short" }),
        time: at.toLocaleTimeString("is-IS", { hour: "2-digit", minute: "2-digit", hour12: false }),
      };
    })
      // Client-side filters for weekday + time range
      .filter((r) => {
        const at = new Date(r.slot_at);
        if (!weekdays.has(at.getDay())) return false;
        if (startTime) {
          const [sh, sm] = startTime.split(":").map(Number);
          const afterStart = at.getHours() > sh || (at.getHours() === sh && at.getMinutes() >= sm);
          if (!afterStart) return false;
        }
        if (endTime) {
          const [eh, em] = endTime.split(":").map(Number);
          const beforeEnd = at.getHours() < eh || (at.getHours() === eh && at.getMinutes() < em);
          if (!beforeEnd) return false;
        }
        return true;
      });
    setRows(list);
  }, [tableName, startDate, endDate, startTime, endTime, weekdays, onlyUnbooked, companyFilter, showCompanyFilter]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const bookedCount = useMemo(() => rows.filter((r) => r.client_id).length, [rows]);


  async function confirmDelete() {
    if (rows.length === 0) return;
    setDeleting(true);
    setErr("");
    const problem = await verifyAdminPassword(password);
    if (problem) { setErr(problem); setDeleting(false); return; }
    const ids = rows.map((r) => r.id);
    // Delete in chunks to keep URLs under the query-string limit
    const CHUNK = 100;
    let total = 0;
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { error } = await supabase.from(tableName).delete().in("id", chunk);
        if (error) throw error;
        total += chunk.length;
      }
      onDone(total);
    } catch (e) {
      setErr(`Ekki tókst að eyða${total ? ` (${slotsDat(total)} var eytt)` : ""}: ${(e as Error).message}`);
    } finally {
      setDeleting(false);
    }
  }

  const kind = KIND[tableName];
  const pill = (on: boolean) =>
    `min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
      on ? "border-hc-brand-dark bg-hc-brand-dark text-white" : "border-hc-hairline bg-hc-surface text-hc-ink-2 hover:bg-hc-sunken"}`;

  return (
    <Modal
      size="lg"
      title="Eyða mörgum tímum"
      description={`Veldu tímabil. Aðeins ${kind}r sem passa við síurnar verða fjarlægðir.`}
      onClose={onClose}
      dismissable={!deleting}
      footer={confirming ? (
        <>
          <Button variant="secondary" onClick={() => { setConfirming(false); setPassword(""); setErr(""); }} disabled={deleting}>Til baka</Button>
          <Button variant="danger" busy={deleting} disabled={deleting || !password || rows.length === 0} onClick={() => void confirmDelete()}>
            {deleting ? "Eyði…" : `Eyða ${slotsDat(rows.length)} endanlega`}
          </Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>Hætta við</Button>
          <Button variant="danger" disabled={deleting || loadingPreview || rows.length === 0} onClick={() => { setErr(""); setConfirming(true); }}>
            {`Eyða ${slotsDat(rows.length)}…`}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        {/* Locked while confirming, so the password confirms exactly the rows
            in the preview. */}
        <fieldset disabled={confirming || deleting} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className={accountLabel}>Frá</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${accountInput} mt-1`} />
            </label>
            <label>
              <span className={accountLabel}>Til</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${accountInput} mt-1`} />
            </label>
            <label>
              <span className={accountLabel}>Fyrsti tími (valfrjálst)</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${accountInput} mt-1`} />
            </label>
            <label>
              <span className={accountLabel}>Síðasti tími (valfrjálst)</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${accountInput} mt-1`} />
            </label>
          </div>

          <div role="group" aria-labelledby="slots-weekdays">
            <span id="slots-weekdays" className={accountLabel}>Vikudagar</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DAY_NAMES.map((label, i) => (
                <button key={i} type="button" aria-pressed={weekdays.has(i)} onClick={() => toggleWeekday(i)} className={pill(weekdays.has(i))}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {showCompanyFilter && (
            <label className="block">
              <span className={accountLabel}>Frátekið fyrir fyrirtæki</span>
              <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className={`${accountInput} mt-1`}>
                <option value="any">Allir (opnir eða fráteknir)</option>
                <option value="none">Opnir öllum</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>Frátekið fyrir {c.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 text-sm text-hc-ink-2">
            <input type="checkbox" checked={onlyUnbooked} onChange={(e) => setOnlyUnbooked(e.target.checked)} />
            Eyða aðeins óbókuðum tímum
          </label>
        </fieldset>

        {/* Preview */}
        <div className="rounded-hc-element bg-hc-sunken p-3 ring-1 ring-hc-hairline" aria-live="polite">
          {loadingPreview ? (
            <p className="text-sm text-hc-ink-3">Sæki forskoðun…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-hc-ink-3">Engir tímar passa við þessar síur.</p>
          ) : (
            <div>
              <p className="text-sm text-hc-ink">
                Eyðir <strong>{rows.length}</strong> {rows.length === 1 ? kind : `${kind.slice(0, -1)}um`}
                {bookedCount > 0 && <> — <strong className="text-hc-bad-ink">{bookedCount} {bookedCount === 1 ? "er þegar bókaður" : "eru þegar bókaðir"}</strong></>}.
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto font-mono text-[11px] text-hc-ink-3">
                {rows.slice(0, 15).map((r) => (
                  <div key={r.id}>{r.day} · {r.time}{r.client_id ? " · bókaður" : ""}</div>
                ))}
                {rows.length > 15 && <div>… og {rows.length - 15} til viðbótar</div>}
              </div>
            </div>
          )}
        </div>

        {confirming && (
          <div className="space-y-3">
            {bookedCount > 0 && (
              <Alert tone="bad" compact>
                {bookedCount} {bookedCount === 1 ? "tími er" : "tímar eru"} þegar {bookedCount === 1 ? "bókaður" : "bókaðir"} af skjólstæðingum. Þeim verður líka eytt.
              </Alert>
            )}
            <form onSubmit={(e) => { e.preventDefault(); if (password && !deleting) void confirmDelete(); }}>
              <label htmlFor="slots-delete-password" className={accountLabel}>
                Sláðu inn lykilorðið þitt til að staðfesta. Ekki er hægt að afturkalla þetta.
              </label>
              <input
                id="slots-delete-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                className={`${accountInput} mt-1`}
              />
            </form>
          </div>
        )}

        {err && <Alert tone="bad" compact>{err}</Alert>}
      </div>
    </Modal>
  );
}
