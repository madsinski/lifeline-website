"use client";

// Samstarfsaðilar (Vera): putting a client in touch with a Vera heilsusetur
// partner — physio, psychologist, nutritionist — on their behalf, with
// their consent.
//
// Since the Medalia split (2026-10-16) that is all this does. Advice to see
// heilsugæsla or a specialist, and a Lifeline doctor's assessment, are the
// doctor's, in Medalia: they cannot be created here and there is nothing to
// decide. Rows from before the split are still listed, read-only, under the
// settled ones. The reasons that come up again and again are one click, and
// whatever the plan proposal suggested for a partner arrives as a chip.

import { useEffect, useState } from "react";
import { Check, Loader2, Mail, Plus, RotateCw, Send, Sparkles, X } from "lucide-react";
import {
  COMMON_REASONS, PARTNER_TARGETS, STATUS_IS, TARGET_IS, isPartner, partnerStatus,
  type PartnerProfession, type Referral, type ReferralTarget,
} from "@/lib/hc/referrals";
import { hcBtn, hcInput } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/** One referral the AI proposed, before anyone has accepted it. */
export interface ReferralSuggestion {
  target: ReferralTarget;
  reason: string;
  why?: string | null;
}

interface Staged { target: ReferralTarget; reason: string; from: "ai" | "nurse"; partnerId?: string }

/** A Vera heilsusetur partner, as the workstation sees it (no email). */
interface PartnerLite { id: string; name: string; profession: string; organization: string }

export default function Referrals({ api, journeyId, referrals, suggestions, onChanged }: {
  api: Api;
  journeyId: string;
  referrals: Referral[];
  /** From the plan proposal, when one has been made. Only partner ones are offered. */
  suggestions?: ReferralSuggestion[];
  /** Kept for callers; nothing here is a doctor's decision any more. */
  isDoctor?: boolean;
  onChanged: () => void;
}) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [note, setNote] = useState("");
  const [pick, setPick] = useState<PartnerProfession>("physio");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [over, setOver] = useState(false);
  /* Vera partners: who can be contacted, and the nurse's confirmation that
     the client agreed to their name, kennitala and contact details going out. */
  const [partners, setPartners] = useState<PartnerLite[] | null>(null);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    let live = true;
    void api("/api/vinnustod/partners").then((r) => r.ok ? r.json() : null).catch(() => null)
      .then((j) => { if (live) setPartners(j?.partners ?? []); });
    return () => { live = false; };
  }, [api]);
  const partnerName = (id: string | null | undefined) => partners?.find((p) => p.id === id)?.name ?? null;
  const stagedPartner = staged.filter((x) => isPartner(x.target));
  const needsPick = stagedPartner.some((x) => !x.partnerId);

  const add = (target: ReferralTarget, reason: string, from: "ai" | "nurse" = "nurse") => {
    if (!isPartner(target)) return;
    setMsg(null);
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
    if (!staged.length || busy) return;
    setBusy(true); setMsg(null);
    const r = await api(`/api/vinnustod/journeys/${journeyId}/referrals`, {
      method: "POST",
      body: JSON.stringify({
        items: staged.map((x) => ({ target: x.target, reason: x.reason, note: note || null, suggested_by: x.from, partner_id: x.partnerId ?? null })),
        consent,
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r) { setMsg({ ok: false, text: "Engin tenging. Ekkert var sent — reyndu aftur." }); return; }
    if (!r.ok) {
      const said = typeof j.error === "string" && /[áéíóúýþæöð]/i.test(j.error) ? j.error : null;
      setMsg({ ok: false, text: said || "Tókst ekki að senda. Reyndu aftur." });
      return;
    }
    setStaged([]); setNote(""); setConsent(false);
    setMsg({ ok: true, text: j.note ?? "Sent á samstarfsaðila." });
    onChanged();
  };

  /* Partner contacts: one action each (resend / contact made), any staff. */
  const partnerAct = async (id: string, action: "resend" | "contacted") => {
    if (busy) return;
    setBusy(true); setMsg(null);
    const r = await api(`/api/vinnustod/journeys/${journeyId}/referrals`, { method: "PATCH", body: JSON.stringify({ id, action }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setMsg({ ok: false, text: typeof j.error === "string" && /[áéíóúýþæöð]/i.test(j.error) ? j.error : "Tókst ekki. Reyndu aftur." }); return; }
    setMsg({ ok: true, text: action === "resend" ? "Sent aftur." : "Skráð: samband komið á." });
    onChanged();
  };

  const partnerOpen = referrals.filter((x) => isPartner(x.target) && (x.status === "sent" || x.status === "failed"));
  // Everything else is settled — including doctor-path rows from before the
  // split, which nobody decides here any more and are shown as history.
  const closed = referrals.filter((x) => !partnerOpen.includes(x));
  const fresh = (suggestions ?? []).filter(
    (s) => isPartner(s.target) &&
           !referrals.some((r) => r.target === s.target && r.reason === s.reason) &&
           !staged.some((x) => x.target === s.target && x.reason === s.reason));

  return (
    <div className="space-y-3">
      {/* Partner contacts in flight */}
      {partnerOpen.length > 0 && (
        <ul className="space-y-1.5">
          {partnerOpen.map((r) => (
            <li key={r.id} className={`rounded-hc-element p-2.5 ring-1 ${r.status === "failed" ? "bg-hc-bad-surface ring-hc-bad-ink/30" : "bg-hc-ok-surface ring-hc-ok-ink/30"}`}>
              <p className={`flex items-center gap-1.5 text-sm font-semibold ${r.status === "failed" ? "text-hc-bad-ink" : "text-hc-ok-ink"}`}>
                <Mail className="h-4 w-4 shrink-0" aria-hidden /> {partnerStatus(r, partnerName(r.partner_id))}
              </p>
              <p className="mt-0.5 text-xs text-hc-ink-2">{TARGET_IS[r.target].label} · {r.reason}{r.sent_at ? ` · ${new Date(r.sent_at).toISOString().slice(0, 10)}` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.status === "sent" && (
                  <button type="button" disabled={busy} onClick={() => void partnerAct(r.id, "contacted")} className={hcBtn.primary}>
                    <Check className="h-4 w-4" aria-hidden /> Samband komið á
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => void partnerAct(r.id, "resend")} className={hcBtn.secondary}>
                  <RotateCw className="h-4 w-4" aria-hidden /> Senda aftur
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* The field itself */}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`rounded-hc-element border-2 border-dashed p-3 transition ${over ? "border-hc-brand-dark bg-hc-ok-surface" : "border-hc-control bg-hc-sunken"}`}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-hc-ink-2">Samstarfsaðilar (Vera)</p>
        {staged.length === 0 ? (
          <p className="mt-1 text-xs leading-snug text-hc-ink-2">
            Dragðu tillögu eða ástæðu hingað — eða veldu úr listanum fyrir neðan.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {staged.map((x, i) => (
              <li key={`${x.target}-${x.reason}`} className="flex items-start gap-2 rounded-lg bg-hc-surface p-2 text-sm ring-1 ring-hc-hairline">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TARGET_IS[x.target].color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-hc-ink">{TARGET_IS[x.target].label}</span>
                  <span className="block text-xs text-hc-ink-2">{x.reason}</span>
                  {isPartner(x.target) && (() => {
                    const mine = (partners ?? []).filter((p) => p.profession === x.target);
                    return mine.length ? (
                      <select value={x.partnerId ?? ""} aria-label="Meðferðaraðili hjá Vera"
                        onChange={(e) => setStaged(staged.map((y, k) => k === i ? { ...y, partnerId: e.target.value || undefined } : y))}
                        className={`mt-1.5 ${hcInput}`}>
                        <option value="">Veldu meðferðaraðila…</option>
                        {mine.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.organization}</option>)}
                      </select>
                    ) : (
                      <span className="mt-1 block text-xs font-semibold text-hc-bad-ink">
                        {partners === null ? "Sæki samstarfsaðila…" : "Enginn skráður hjá Vera. Stjórnandi skráir undir Heilsuferð → Samstarfsaðilar."}
                      </span>
                    );
                  })()}
                </span>
                <button type="button" aria-label="Fjarlægja" onClick={() => setStaged(staged.filter((_, k) => k !== i))}
                  className="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-hc-ink-3 hover:bg-hc-sunken-2 hover:text-hc-ink-2">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {staged.length > 0 && (
          <>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              aria-label="Innri athugasemd"
              placeholder="Innri athugasemd — fer hvorki til skjólstæðings né meðferðaraðila"
              className={`mt-2 ${hcInput}`} />
            <div className="mt-2 space-y-1.5 rounded-hc-element bg-hc-surface p-2.5 ring-1 ring-hc-hairline">
              <p className="text-xs text-hc-ink-2">
                Meðferðaraðilinn fær aðeins nafn, kennitölu og samskiptaupplýsingar í tölvupósti. Ástæðan og athugasemdin fara ekki með. Skjólstæðingurinn fær afrit.
              </p>
              <label className="flex min-h-11 items-start gap-2 text-sm font-semibold text-hc-ink">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#047857]" />
                Skjólstæðingur hefur samþykkt að nafn, kennitala og samskiptaupplýsingar séu sendar meðferðaraðilanum
              </label>
            </div>
            <button type="button" disabled={busy || needsPick || !consent} onClick={() => void send()}
              className={`${hcBtn.primary} mt-2 w-full`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Senda á samstarfsaðila
            </button>
          </>
        )}
      </div>

      {msg && (msg.ok
        ? <p role="status" className="text-xs leading-snug text-hc-ok-ink">{msg.text}</p>
        : <p role="alert" className="text-sm font-semibold leading-snug text-hc-bad-ink">{msg.text}</p>)}

      {/* What the plan proposal thought */}
      {fresh.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Tillögur úr greiningunni
          </p>
          <ul className="space-y-1">
            {fresh.map((s) => (
              <li key={`${s.target}-${s.reason}`} {...dragProps(s.target, s.reason, "ai")}
                className="cursor-grab rounded-lg bg-hc-surface p-2 text-sm ring-1 ring-hc-hairline hover:ring-hc-control">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TARGET_IS[s.target].color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-hc-ink">{TARGET_IS[s.target].label}</span>
                    <span className="block text-xs text-hc-ink-2">{s.reason}</span>
                    {s.why && <span className="mt-0.5 block text-[11px] text-hc-ink-2">{s.why}</span>}
                  </span>
                  <button type="button" aria-label="Bæta við" onClick={() => add(s.target, s.reason, "ai")}
                    className="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-hc-ink-3 hover:bg-hc-ok-surface hover:text-hc-ok-ink">
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The common reasons, one click each */}
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Algengar ástæður</p>
        <div className="flex flex-wrap gap-1">
          {PARTNER_TARGETS.map((t) => (
            /* Selected is brand-dark for every target: white on the
               targets' own colours (amber, emerald, sky) failed AA, and the
               navy one vanished in the dark theme. The colour stays as a dot. */
            <button key={t} type="button" onClick={() => setPick(t)} aria-pressed={pick === t}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${pick === t ? "bg-hc-brand-dark text-white" : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-hc-brand-surface hover:text-hc-brand-text"}`}>
              <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white/60" style={{ backgroundColor: TARGET_IS[t].color }} aria-hidden />
              {TARGET_IS[t].label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-hc-ink-2">{TARGET_IS[pick].blurb}</p>
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {COMMON_REASONS[pick].map((reason) => (
            <li key={reason}>
              <button type="button" {...dragProps(pick, reason, "nurse")} onClick={() => add(pick, reason)}
                className="min-h-11 cursor-grab rounded-lg border border-hc-border bg-hc-surface px-2.5 py-1.5 text-left text-xs text-hc-ink-2 hover:border-hc-control hover:bg-hc-sunken">
                {reason}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Settled */}
      {closed.length > 0 && (
        <ul className="space-y-1 border-t border-hc-hairline pt-2">
          {closed.map((r) => (
            <li key={r.id} className="flex items-baseline gap-2 text-xs text-hc-ink-2">
              <span className="font-semibold text-hc-ink-2">{TARGET_IS[r.target]?.label ?? r.target}</span>
              <span className="min-w-0 flex-1 truncate">{r.reason}</span>
              <span className="shrink-0">{isPartner(r.target) ? partnerStatus(r, partnerName(r.partner_id)) : STATUS_IS[r.status] ?? r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
