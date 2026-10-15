"use client";

// The bodies of a client's workspace that are not the interview: the report
// and its confirmation, payments, plan adherence and the audit trail.

import { useState } from "react";
import { Bell, Check, Droplet, Ruler, Send, Stethoscope } from "lucide-react";
import ResultsCard, { sexOf } from "@/app/components/hc/ResultsCard";
import ReportView from "@/app/components/hc/ReportView";
import BeforeAfter from "@/app/components/hc/BeforeAfter";
import type { WsApi } from "@/app/components/hc/ws-api";
import { adherence, NUDGE_IS, nudgeStatus } from "@/lib/hc/adherence";
import { EVENT_LABELS, type JourneyEvent } from "@/lib/hc/events-labels";
import { PILLAR_META, type InterviewNotes, type PlanGoal, type Pillar } from "@/lib/hc/types";
import { day, dayTime, isDate, minutesSince, wsBtn } from "../format";
import type { Detail, Record_ } from "../tasks";

/** The report panel's one-line status, under its title on Skýrsla. */
export function resultsStatus(d: Detail): string {
  const j = d.journey;
  const hasResults = (d.results ?? []).length > 0;
  const resultsIn = !!(j.blood_results_at && j.measurements_done_at);
  if (j.report_generated_at) return `Staðfest ${dayTime(j.report_generated_at)}${j.report_sms_sent_at ? " · deilt með skjólstæðingi" : ""}`;
  if (d.report) return `Heilsufarsskýrsla ${isDate(d.report.report.reportDate)} · ${d.report.report.items.length} niðurstöður · bíður staðfestingar læknis`;
  if (hasResults) return `${(d.results ?? []).length} gildi skráð${j.blood_results_at ? ` · blóðprufa ${day(j.blood_results_at)}` : ""}`;
  return resultsIn ? "Rannsóknir komnar — lestu skýrsluna inn" : "Bíður blóðprufu og mælinga";
}

export function ResultsStep({ d, api, isDoctor, record, reload }: {
  d: Detail; api: WsApi; isDoctor: boolean; record: Record_; reload: () => Promise<void>;
}) {
  const j = d.journey;
  const bloodDone = !!(j.blood_test_done_at || j.blood_results_at);
  return (
    <div className="space-y-4">
      {/* Tests recorded by hand when no partner system does it. */}
      {!d.report && (!bloodDone || !j.measurements_done_at) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-hc-sunken px-3 py-2 text-sm">
          <span className="text-hc-ink-2">Skrá handvirkt:</span>
          {!bloodDone && <button type="button" onClick={() => void record({ event: "blood_test_done" })} className={wsBtn.secondary}><Droplet className="h-4 w-4" aria-hidden /> Blóðprufa tekin</button>}
          {!j.measurements_done_at && <button type="button" onClick={() => void record({ event: "measurements_done" })} className={wsBtn.secondary}><Ruler className="h-4 w-4" aria-hidden /> Mælingar gerðar</button>}
        </div>
      )}
      {d.compare && <BeforeAfter c={d.compare} />}
      {d.report && (
        <>
          <ReportView report={d.report.report} signals={d.report.signals}
            reference={d.report.reference} sex={d.report.sex} />
          <p className="text-xs text-hc-ink-2">
            Umferðarljósin eru viðmið Lifeline — þau sömu og í appinu. Skýrslan frá Medalia notar eigin orðalag og mörk, og þar sem
            þeim ber ekki saman birtist orðalag hennar við gildið.
          </p>
        </>
      )}
      <ResultsCard api={api} journeyId={j.id} sex={sexOf(d.patient.sex)} results={d.results ?? []}
        reportShown={!!d.report} onSaved={() => void reload()} />
      <ReportStep d={d} isDoctor={isDoctor} record={record} />
    </div>
  );
}

function ReportStep({ d, isDoctor, record }: { d: Detail; isDoctor: boolean; record: Record_ }) {
  const j = d.journey;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Confirmed: the remaining question is whether the client has been told it
  // is there. The report lives on their account, so sharing it is a message
  // pointing at it rather than an attachment.
  if (j.report_generated_at) {
    const shared = j.report_sms_sent_at;
    return (
      <div className="space-y-2 rounded-xl bg-hc-sunken p-3">
        <p className="text-sm text-hc-ink-2">
          Skýrslan var staðfest {dayTime(j.report_generated_at)}. Hún er í Medalia og á aðgangi skjólstæðingsins.
        </p>
        {shared ? (
          <p className="flex items-center gap-1.5 text-sm text-hc-ok-ink">
            <Check className="h-4 w-4" aria-hidden /> Deilt með skjólstæðingi {dayTime(shared)}.
          </p>
        ) : (
          <p className="text-sm text-hc-ink-2">Skjólstæðingurinn hefur ekki fengið sérstaka ábendingu um að hún sé tilbúin.</p>
        )}
        <button type="button" disabled={busy}
          onClick={async () => {
            setBusy(true);
            const e = await record({ action: "share_report" });
            setBusy(false);
            setMsg(e ?? "Skýrslunni deilt — skjólstæðingurinn fékk skilaboð.");
          }}
          className={shared ? wsBtn.secondary : wsBtn.primary}>
          <Send className="h-4 w-4" aria-hidden /> {shared ? "Senda aftur" : "Deila með skjólstæðingi"}
        </button>
        {msg && <p role="status" className="text-sm text-hc-ok-ink">{msg}</p>}
      </div>
    );
  }
  if (!j.blood_results_at && !j.report_imported_at) return <p className="text-sm text-hc-ink-2">Skýrslan er staðfest þegar blóðprufusvörin eru komin.</p>;
  return (
    <div className="space-y-2">
      {isDoctor ? (
        <>
          <p className="text-sm text-hc-ink-2">Farðu yfir gildin að ofan og staðfestu skýrsluna. Skjólstæðingurinn fær tölvupóst um leið.</p>
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); const e = await record({ event: "report_generated" }); setBusy(false); setMsg(e ?? "Skýrsla staðfest."); }}
            className={`${wsBtn.primary} w-full sm:w-auto`}><Stethoscope className="h-4 w-4" aria-hidden /> Staðfesta skýrsluna</button>
        </>
      ) : (
        <p className="text-sm text-hc-warn-ink">
          {j.report_imported_at
            ? "Skýrslan er komin inn og bíður staðfestingar læknis. Þú getur bókað og undirbúið viðtalið; skjólstæðingurinn sér skýrsluna þegar læknir hefur staðfest hana."
            : `Svörin komu fyrir ${minutesSince(j.blood_results_at)} mínútum. Læknir fær SMS ef skýrslan er ekki staðfest innan fimm mínútna.`}
        </p>
      )}
      {msg && <p role="status" className="text-sm text-hc-ok-ink">{msg}</p>}
    </div>
  );
}

export function Orders({ d, record }: { d: Detail; record: Record_ }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 text-sm">
        {d.orders.length === 0 && <li className="text-hc-ink-2">Engar greiðslur skráðar.</li>}
        {d.orders.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-hc-sunken px-3 py-2">
            <span>{o.kind === "health_check" ? "Heilsufarsskoðun" : o.kind === "followup_3m" ? "Eftirfylgd" : o.kind === "reevaluation" ? "Endurmat" : "Aukaviðtal"} · {o.payment_route === "company" ? "fyrirtæki" : o.payment_route === "union" ? "stéttarfélag" : "sjálf(ur)"}</span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-hc-ink-2">
              {o.activation_code}
              {o.activation_redeemed_at && <Check className="h-3.5 w-3.5 text-hc-ok-ink" aria-label="virkjaður" />}
            </span>
          </li>
        ))}
      </ul>
      {d.journey.stage === "protocol" && (
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); const e = await record({ action: "remind_client" }); setBusy(false); setMsg(e ?? "Áminning send."); }}
          className={wsBtn.primary}><Bell className="h-4 w-4" aria-hidden /> Senda áminningu um virkjun</button>
      )}
      {msg && <p role="status" className="text-sm text-hc-ok-ink">{msg}</p>}
    </div>
  );
}

export function Adherence({ d }: { d: Detail }) {
  const a = adherence(d.plan?.modules ?? [], d.logs ?? [], d.prefs ?? []);
  const status = nudgeStatus(a, !!d.plan);
  const hidden = (d.prefs ?? []).filter((p) => p.hidden);
  const notes = (d.prefs ?? []).filter((p) => (p.note ?? "").trim());
  const titleOf = (uid: string) => d.plan?.modules?.find((m) => m.uid === uid)?.title ?? "aðgerð";
  const tone = status === "on-track" ? "bg-hc-ok-surface text-hc-ok-ink ring-hc-ok-ink/30"
    : status === "needs-nudge" ? "bg-hc-warn-surface text-hc-warn-ink ring-hc-warn-ink/30"
    : "bg-hc-sunken text-hc-ink-2 ring-hc-hairline";
  return (
    <section className={`flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3 ring-1 ${tone}`}>
      <div>
        {/* opacity-80, not 70: at 70% the amber and green states measured
            under the 4.5:1 small text needs. 80% puts every state above 5.2. */}
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">Framvinda</p>
        <p className="font-semibold">{NUDGE_IS[status]}</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-bold tabular-nums">{a.percent}%</p>
        <p className="text-[11px] opacity-80">7 dagar</p>
      </div>
      {a.streak > 1 && (
        <div className="text-center">
          <p className="text-xl font-bold tabular-nums">{a.streak}</p>
          <p className="text-[11px] opacity-80">dagar í röð</p>
        </div>
      )}
      <div className="text-center">
        <p className="text-xl font-bold tabular-nums">{a.done}/{a.target}</p>
        <p className="text-[11px] opacity-80">merkingar</p>
      </div>
      <span className="flex-1" />
      <p className="text-sm">
        {a.lastDoneOn ? `Síðast merkt ${day(a.lastDoneOn)}` : "Ekkert merkt enn"}
        {hidden.length ? ` · ${hidden.length} lagt til hliðar` : ""}
      </p>
      {/* What the client WROTE, and only that: their own words are the
          follow-up's agenda. Which actions were set aside is a plan
          question and lives in the plan step. */}
      {notes.length > 0 && (
        <ul className="w-full space-y-1 border-t border-current/10 pt-2 text-sm">
          {notes.map((p) => <li key={`n-${p.action_uid}`}><strong>{titleOf(p.action_uid)}:</strong> „{p.note}“</li>)}
        </ul>
      )}
    </section>
  );
}

export function seedFromNotes(n: InterviewNotes | null): { summary?: string; goals?: PlanGoal[] } | undefined {
  if (!n) return undefined;
  const pillars: Pillar[] = ["sleep", "exercise", "nutrition", "mental"];
  const lines = pillars.filter((p) => n[p]?.trim()).map((p) => `${PILLAR_META[p].label}: ${n[p]!.trim()}`);
  const summary = [n.goals?.trim() ? `Markmið skjólstæðings: ${n.goals.trim()}` : "", ...lines].filter(Boolean).join("\n");
  return summary ? { summary } : undefined;
}

// ── Saga ────────────────────────────────────────────────────────────────────

const ACTION_TEXT: Record<string, string> = {
  paid: "Greitt", paid_followup: "Eftirfylgd greidd", profile_complete: "Upplýsingar skráðar", welcome_seen: "Kynning skoðuð",
  plan_published: "Áætlun birt", plan_republished: "Áætlun uppfærð", plan_created: "Drög að áætlun", report_sms_escalation: "SMS til læknis",
  union_claim_sent: "Umsókn send stéttarfélagi", reminder_sent: "Áminning send", message_sent: "Skilaboð send", doctor_review_requested: "Beðið um mat læknis",
  doctor_reviewed: "Læknir mat", protocol_confirmed_by_client: "Skjólstæðingur staðfesti virkjun", test_patient_seeded: "Prufuskjólstæðingur búinn til", set_booking: "Tími skráður af skjólstæðingi",
};
function actionText(a: string) {
  if (a.startsWith("event:")) return EVENT_LABELS[a.slice(6) as JourneyEvent] ?? a;
  return ACTION_TEXT[a] ?? a;
}

export function History({ audit }: { audit: Detail["audit"] }) {
  return (
    <ol className="relative space-y-4 border-l-2 border-hc-hairline pl-5">
      {audit.map((a, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-hc-surface bg-hc-brand-dark" aria-hidden />
          <p className="text-sm font-semibold text-hc-ink">{actionText(a.action)}</p>
          <p className="text-xs text-hc-ink-2">{dayTime(a.at)} · {a.actor}{a.note ? ` · ${a.note}` : ""}</p>
        </li>
      ))}
      {audit.length === 0 && <li className="text-sm text-hc-ink-2">Engin saga enn.</li>}
    </ol>
  );
}
