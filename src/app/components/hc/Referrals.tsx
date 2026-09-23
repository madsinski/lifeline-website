"use client";

// "Þarf tilvísun?" — the question a health check keeps asking.
//
// A screening finds things it is not meant to treat, so a good share of these
// end in "somebody else should look at this". Before, that was one free-text
// box and one destination. Now there are five destinations, the reasons that
// come up again and again are one click, and whatever the plan proposal
// suggested arrives as a draggable chip.
//
// The nurse proposes and the doctor decides — she cannot set a status, and he
// gets a text, because a referral sitting unseen in a web page is the exact
// failure this is for.

import { useState } from "react";
import { Check, Loader2, Plus, Send, Stethoscope, X } from "lucide-react";
import {
  COMMON_REASONS, REFERRAL_TARGETS, STATUS_IS, TARGET_IS,
  type Referral, type ReferralTarget,
} from "@/lib/hc/referrals";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/** One referral the AI proposed, before anyone has accepted it. */
export interface ReferralSuggestion {
  target: ReferralTarget;
  reason: string;
  why?: string | null;
}

interface Staged { target: ReferralTarget; reason: string; from: "ai" | "nurse" }

export default function Referrals({ api, journeyId, referrals, suggestions, isDoctor, onChanged }: {
  api: Api;
  journeyId: string;
  referrals: Referral[];
  /** From the plan proposal, when one has been made. */
  suggestions?: ReferralSuggestion[];
  isDoctor: boolean;
  onChanged: () => void;
}) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [note, setNote] = useState("");
  const [pick, setPick] = useState<ReferralTarget>("heilsugaesla");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [over, setOver] = useState(false);

  const add = (target: ReferralTarget, reason: string, from: "ai" | "nurse" = "nurse") => {
    setMsg("");
    setStaged((prev) =>
      prev.some((x) => x.target === target && x.reason === reason) ? prev : [...prev, { target, reason, from }]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    try {
      const d = JSON.parse(e.dataTransfer.getData("text/plain")) as { t?: string; target?: ReferralTarget; reason?: string; from?: "ai" | "nurse" };
      if (d.t === "referral" && d.target && d.reason) add(d.target, d.reason, d.from ?? "nurse");
    } catch { /* something else was dragged */ }
  };

  const dragProps = (target: ReferralTarget, reason: string, from: "ai" | "nurse") => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) =>
      e.dataTransfer.setData("text/plain", JSON.stringify({ t: "referral", target, reason, from })),
  });

  const send = async () => {
    if (!staged.length) return;
    setBusy(true); setMsg("");
    const r = await api(`/api/vinnustod/journeys/${journeyId}/referrals`, {
      method: "POST",
      body: JSON.stringify({ items: staged.map((x) => ({ target: x.target, reason: x.reason, note: note || null, suggested_by: x.from })) }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Tókst ekki að skrá tilvísun."); return; }
    setStaged([]); setNote("");
    setMsg(j.note ?? (j.notified ? "Skráð og læknir fékk skeyti." : "Skráð."));
    onChanged();
  };

  const decide = async (id: string, status: "approved" | "declined" | "done") => {
    setBusy(true); setMsg("");
    const r = await api(`/api/vinnustod/journeys/${journeyId}/referrals`, { method: "PATCH", body: JSON.stringify({ id, status }) });
    setBusy(false);
    if (!r.ok) { setMsg("Tókst ekki að uppfæra."); return; }
    onChanged();
  };

  const open = referrals.filter((x) => x.status === "requested");
  const closed = referrals.filter((x) => x.status !== "requested");
  const fresh = (suggestions ?? []).filter(
    (s) => !referrals.some((r) => r.target === s.target && r.reason === s.reason) &&
           !staged.some((x) => x.target === s.target && x.reason === s.reason));

  return (
    <div className="space-y-3">
      {/* What is already on the doctor's desk */}
      {open.length > 0 && (
        <ul className="space-y-1.5">
          {open.map((r) => (
            <li key={r.id} className="rounded-xl bg-amber-50 p-2.5 ring-1 ring-amber-200">
              <p className="text-sm font-semibold text-amber-900">
                {TARGET_IS[r.target].label}
                <span className="ml-1.5 font-normal">· {r.reason}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800">
                {STATUS_IS[r.status]}
                {r.doctor_notified_at ? " · skeyti sent" : " · skeyti ekki sent"}
                {r.suggested_by === "ai" ? " · tillaga AI" : ""}
              </p>
              {r.note && <p className="mt-1 text-xs text-amber-900/80">{r.note}</p>}
              {isDoctor && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" disabled={busy} onClick={() => decide(r.id, "approved")}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5" /> Samþykkja
                  </button>
                  <button type="button" disabled={busy} onClick={() => decide(r.id, "declined")}
                    className="inline-flex min-h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    Ekki þörf
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* The field itself */}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-3 transition ${over ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50/60"}`}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tilvísun</p>
        {staged.length === 0 ? (
          <p className="mt-1 text-xs leading-snug text-slate-500">
            Dragðu tillögu eða ástæðu hingað — eða veldu úr listanum fyrir neðan.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {staged.map((x, i) => (
              <li key={`${x.target}-${x.reason}`} className="flex items-start gap-2 rounded-lg bg-white p-2 text-sm ring-1 ring-slate-200">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TARGET_IS[x.target].color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">{TARGET_IS[x.target].label}</span>
                  <span className="block text-xs text-slate-600">{x.reason}</span>
                </span>
                <button type="button" aria-label="Fjarlægja" onClick={() => setStaged(staged.filter((_, k) => k !== i))}
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {staged.length > 0 && (
          <>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Til læknisins — fer ekki til skjólstæðings"
              className="mt-2 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            <button type="button" disabled={busy} onClick={send}
              className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Senda til læknis
            </button>
          </>
        )}
      </div>

      {msg && <p role="status" className="text-xs leading-snug text-emerald-800">{msg}</p>}

      {/* What the plan proposal thought */}
      {fresh.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden /> Tillögur úr greiningunni
          </p>
          <ul className="space-y-1">
            {fresh.map((s) => (
              <li key={`${s.target}-${s.reason}`} {...dragProps(s.target, s.reason, "ai")}
                className="cursor-grab rounded-lg bg-white p-2 text-sm ring-1 ring-slate-200 hover:ring-slate-300">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TARGET_IS[s.target].color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">{TARGET_IS[s.target].label}</span>
                    <span className="block text-xs text-slate-600">{s.reason}</span>
                    {s.why && <span className="mt-0.5 block text-[11px] text-slate-500">{s.why}</span>}
                  </span>
                  <button type="button" aria-label="Bæta við" onClick={() => add(s.target, s.reason, "ai")}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The common reasons, one click each */}
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Algengar ástæður</p>
        <div className="flex flex-wrap gap-1">
          {REFERRAL_TARGETS.map((t) => (
            <button key={t} type="button" onClick={() => setPick(t)}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${pick === t ? "text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              style={pick === t ? { backgroundColor: TARGET_IS[t].color } : undefined}>
              {TARGET_IS[t].label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{TARGET_IS[pick].blurb}</p>
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {COMMON_REASONS[pick].map((reason) => (
            <li key={reason}>
              <button type="button" {...dragProps(pick, reason, "nurse")} onClick={() => add(pick, reason)}
                className="cursor-grab rounded-lg border border-slate-200 bg-white px-2 py-1 text-left text-xs text-slate-700 hover:border-slate-400 hover:bg-slate-50">
                {reason}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Settled */}
      {closed.length > 0 && (
        <ul className="space-y-1 border-t border-slate-100 pt-2">
          {closed.map((r) => (
            <li key={r.id} className="flex items-baseline gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{TARGET_IS[r.target].label}</span>
              <span className="min-w-0 flex-1 truncate">{r.reason}</span>
              <span className="shrink-0">{STATUS_IS[r.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
