"use client";

// „Ný beiðni um Lifeline þjálfun“ — a row in Í dag, and the sheet where a
// Lifeline worker confirms or declines it.
//
// Lifeline þjálfun is for people who live in Vestmannaeyjar, and nobody pays
// before Lifeline has confirmed it (src/lib/hc/coaching-requests.ts). The
// sheet shows what there is to go on: the address they typed, and the hints
// gathered when the request came in (employer, measurements at the station,
// how they came in). A decline needs a short reason; the person sees it as
// written, so it is worded to them.

import { useState } from "react";
import { BadgeCheck, Mail, MessageSquare, Phone } from "lucide-react";
import Sheet from "@/app/components/hc/Sheet";
import { hcInput } from "@/app/components/hc/ui";
import { waited } from "@/app/components/hc/WsRequests";
import { useToast } from "@/app/components/hc/Toast";
import type { WsApi } from "@/app/components/hc/ws-api";
import { cleanName, isDate, wsBtn } from "./format";
import type { CoachingReq } from "./inbox";
import type { OpenClient } from "./tasks";

const ENTRY_IS: Record<string, string> = {
  b2c: "Einstaklingur, ekki í gegnum vinnuveitanda",
  b2b: "Í gegnum vinnuveitanda",
  coach: "Þjálfunarleið í appinu",
  app: "Appið eingöngu",
  heilsugaesla: "Tilvísun frá heilsugæslu",
};

/** The hints as short sentences, strongest first. */
export function evidenceLines(e: CoachingReq["evidence"]): { text: string; strong: boolean }[] {
  const out: { text: string; strong: boolean }[] = [];
  if (e.company) {
    out.push({
      text: `Vinnuveitandi: ${e.company.name ?? "fyrirtæki"}${e.company.address ? ` (${e.company.address})` : ""}${e.company.in_region ? " · í Vestmannaeyjum" : ""}`,
      strong: e.company.in_region,
    });
  }
  const v = e.station_visits;
  if (v && v.count > 0) {
    out.push({
      text: v.in_region > 0
        ? `Mæling lokið á mælistöð í Vestmannaeyjum (${v.in_region})`
        : `Mæling lokið annars staðar${v.last_location ? `: ${v.last_location}` : ""}${v.last_at ? `, ${isDate(v.last_at)}` : ""}`,
      strong: v.in_region > 0,
    });
  }
  if ((e.measurements_done ?? 0) > 0) out.push({ text: `Mælingar skráðar lokið í heilsuferð: ${e.measurements_done}`, strong: false });
  if (e.journey_entry) out.push({ text: `Leið inn: ${ENTRY_IS[e.journey_entry] ?? e.journey_entry}`, strong: false });
  if (e.previous_coaching) out.push({ text: "Hefur áður verið í Lifeline þjálfun", strong: false });
  return out;
}

const Dot = () => <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-hc-signal-yellow" aria-hidden />;

/** One request in „Bíður þín“. */
export function CoachingRequestRow({ r, onReview }: { r: CoachingReq; onReview: (r: CoachingReq) => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Dot />
      <button type="button" onClick={() => onReview(r)} className="min-w-0 flex-1 rounded-lg text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
        <span className="block font-semibold text-hc-ink">{cleanName(r.name)}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-hc-ink-2">
          <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">Ný beiðni um Lifeline þjálfun{r.postcode ? ` · ${r.postcode} ${r.town ?? ""}`.trimEnd() : ""}</span>
        </span>
        <span className="text-xs text-hc-ink-2">beið í {waited(r.created_at)}</span>
      </button>
      <button type="button" onClick={() => onReview(r)}
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-hc-brand/40 bg-hc-surface px-4 text-sm font-semibold text-hc-brand-text transition hover:bg-hc-brand-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
        Skoða
      </button>
    </li>
  );
}

/** Confirm or decline. Closes and reloads the list on success. */
export function CoachingRequestSheet({ api, r, onClose, onDone, onOpen }: {
  api: WsApi; r: CoachingReq; onClose: () => void; onDone: () => void; onOpen: OpenClient;
}) {
  const toast = useToast();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const lines = evidenceLines(r.evidence ?? {});

  const decide = async (decision: "approve" | "decline") => {
    if (busy) return;
    setBusy(true); setErr("");
    const res = await api("/api/vinnustod/coaching-requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, decision, ...(decision === "decline" ? { reason } : {}) }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j?.error === "string" && /[áðéíóúýþæö]/i.test(j.error) ? j.error : "Ekki tókst að vista. Reyndu aftur.");
      if (res?.status === 409) onDone();
      return;
    }
    toast.show(decision === "approve"
      ? `Samþykkt: ${cleanName(r.name)} fær tilkynningu og getur greitt.`
      : `Hafnað: ${cleanName(r.name)} fær tilkynningu með ástæðunni.`);
    onDone();
    onClose();
  };

  return (
    <Sheet title="Beiðni um Lifeline þjálfun" onClose={onClose} max="max-w-lg">
      <div className="space-y-4 px-4 pb-6 sm:px-5">
        <div>
          <p className="text-lg font-bold text-hc-ink">{cleanName(r.name)}</p>
          <p className="text-sm text-hc-ink-2">Send {isDate(r.created_at)} · beið í {waited(r.created_at)}</p>
        </div>

        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="font-semibold text-hc-ink-2">Heimilisfang</dt>
          <dd className="text-hc-ink">{r.address || "—"}</dd>
          <dt className="font-semibold text-hc-ink-2">Póstnúmer</dt>
          <dd className="text-hc-ink">{[r.postcode, r.town].filter(Boolean).join(" ") || "—"}</dd>
          {r.phone && (<><dt className="font-semibold text-hc-ink-2">Sími</dt><dd className="text-hc-ink">{r.phone}</dd></>)}
          {r.email && (<><dt className="font-semibold text-hc-ink-2">Netfang</dt><dd className="break-all text-hc-ink">{r.email}</dd></>)}
        </dl>

        <section aria-labelledby="cr-hints" className="rounded-2xl border border-hc-hairline bg-hc-sunken p-3">
          <h3 id="cr-hints" className="text-xs font-bold uppercase tracking-wide text-hc-ink-2">Vísbendingar</h3>
          {lines.length ? (
            <ul className="mt-1.5 space-y-1 text-sm">
              {lines.map((l) => (
                <li key={l.text} className={l.strong ? "font-semibold text-hc-ink" : "text-hc-ink-2"}>{l.text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-hc-ink-2">Engar aðrar upplýsingar en heimilisfangið. Hafðu samband ef þú vilt staðfesta búsetu.</p>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          {r.journey_id && (
            <button type="button" className={wsBtn.secondary} onClick={() => { onClose(); onOpen(r.journey_id!, { tab: "status", focus: "chat" }); }}>
              <MessageSquare className="h-4 w-4" aria-hidden /> Senda skilaboð
            </button>
          )}
          {r.email && <a className={wsBtn.ghost} href={`mailto:${r.email}`}><Mail className="h-4 w-4" aria-hidden /> Tölvupóstur</a>}
          {r.phone && <a className={wsBtn.ghost} href={`tel:${r.phone}`}><Phone className="h-4 w-4" aria-hidden /> Hringja</a>}
        </div>

        {declining ? (
          <div className="space-y-2 border-t border-hc-hairline pt-4">
            <label htmlFor="cr-reason" className="block text-sm font-semibold text-hc-ink">Ástæða (birtist viðkomandi)</label>
            <textarea id="cr-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3}
              placeholder="T.d.: Þjálfunin er eingöngu fyrir íbúa í Vestmannaeyjum og við gátum ekki staðfest búsetu."
              className={hcInput} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={wsBtn.primary} disabled={busy || reason.trim().length < 3} onClick={() => void decide("decline")}>
                Hafna beiðni
              </button>
              <button type="button" className={wsBtn.ghost} disabled={busy} onClick={() => { setDeclining(false); setErr(""); }}>Hætta við</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 border-t border-hc-hairline pt-4">
            <button type="button" className={wsBtn.primary} disabled={busy} onClick={() => void decide("approve")}>Samþykkja</button>
            <button type="button" className={wsBtn.secondary} disabled={busy} onClick={() => setDeclining(true)}>Hafna</button>
          </div>
        )}
        {err && <p className="text-sm font-semibold text-hc-bad-ink" role="alert">{err}</p>}
        <p className="text-xs text-hc-ink-2">Samþykki gildir í 14 daga. Viðkomandi fær tilkynningu í appinu og tölvupóst.</p>
      </div>
    </Sheet>
  );
}
