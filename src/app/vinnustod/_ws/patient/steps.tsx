"use client";

// The bodies of a client's workspace that are not the interview: the report
// copy, payments, plan adherence and the audit trail.

import { useState } from "react";
import { Bell, Check, ExternalLink, FileText, Loader2, Send } from "lucide-react";
import ResultsCard, { sexOf } from "@/app/components/hc/ResultsCard";
import ReportView from "@/app/components/hc/ReportView";
import BeforeAfter from "@/app/components/hc/BeforeAfter";
import type { WsApi } from "@/app/components/hc/ws-api";
import { adherence, NUDGE_IS, nudgeStatus } from "@/lib/hc/adherence";
import { EVENT_LABELS, type JourneyEvent } from "@/lib/hc/events-labels";
import { PILLAR_META, type InterviewNotes, type PlanGoal, type Pillar } from "@/lib/hc/types";
import { day, dayTime, isDate, wsBtn } from "../format";
import { reportOnFile, type Detail, type Record_ } from "../tasks";

/*
 * One action's outcome. These buttons used to print a failure in the same
 * green as a success ("Áminning send." and "Sending mistókst." looked the
 * same), and the manual-record buttons said nothing at all.
 */
type Outcome = { ok: boolean; text: string } | null;
function useAction(record: Record_) {
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<Outcome>(null);
  const run = async (key: string, payload: Record<string, unknown>, ok: string) => {
    if (busy) return;
    setBusy(key); setOut(null);
    const e = await record(payload);
    setBusy(null);
    setOut(e ? { ok: false, text: e } : { ok: true, text: ok });
  };
  return { busy, out, run };
}
function OutcomeLine({ out }: { out: Outcome }) {
  if (!out) return null;
  return out.ok
    ? <p role="status" className="text-sm text-hc-ok-ink">{out.text}</p>
    : <p role="alert" className="text-sm font-semibold text-hc-bad-ink">{out.text}</p>;
}
const Spin = () => <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;

/** The report panel's one-line status, under its title on Skýrsla. */
export function resultsStatus(d: Detail): string {
  const j = d.journey;
  if (d.report) return `Afrit af skýrslu frá ${isDate(d.report.report.reportDate)} · ${d.report.report.items.length} niðurstöður`;
  if (reportOnFile(j)) return "Afrit á skrá";
  return j.staff_import_consent_at ? "Engin skýrsla á skrá · leyfi til að sækja hana" : "Engin skýrsla á skrá";
}

/** Follow-up measurements only: the health check's own are entered in Medalia. */
const FOLLOWUP_CATEGORIES: ("blood" | "body")[] = ["body"];

const MEDALIA_URL = "https://provider.medalia.is";

/*
 * Skýrsla since the Medalia split (2026-10-16).
 *
 * The report is produced and signed in Medalia, and the original lives in
 * the sjúklingagátt. What is here is the client's copy — their own upload,
 * or one a member of staff fetched with their leave — so it is shown as a
 * copy, nobody confirms or shares it from here, and the import is only
 * offered once the client has said yes (staff_import_consent_at; the route
 * answers 403 without it).
 */
export function ResultsStep({ d, api, reload, onAskConsent }: {
  d: Detail; api: WsApi; reload: () => Promise<void>;
  /** Opens the message sheet on the "may we fetch your report?" template. */
  onAskConsent: () => void;
}) {
  const j = d.journey;
  const consent = j.staff_import_consent_at ?? null;
  const fromClient = d.reportProvenance?.source === "self" || (!!j.own_report_at && !j.report_imported_at);
  return (
    <div className="space-y-4">
      {d.compare && <BeforeAfter c={d.compare} />}
      {d.report ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-hc-sunken px-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-hc-ink-2" aria-hidden />
            <span className="min-w-0 flex-1 font-semibold text-hc-ink">
              Afrit — frumrit í sjúklingagáttinni
              <span className="block text-xs font-normal text-hc-ink-2">
                {fromClient ? "Skjólstæðingurinn setti afritið inn sjálfur." : "Sótt af starfsfólki með leyfi skjólstæðingsins."}
              </span>
            </span>
            <a href={MEDALIA_URL} target="_blank" rel="noopener noreferrer" className={wsBtn.secondary}>
              <ExternalLink className="h-4 w-4" aria-hidden /> Opna í Medalia
            </a>
          </div>
          <ReportView report={d.report.report} signals={d.report.signals}
            reference={d.report.reference} sex={d.report.sex} />
          <p className="text-xs text-hc-ink-2">
            Umferðarljósin eru viðmið Lifeline — þau sömu og í appinu. Skýrslan frá Medalia notar eigin orðalag og mörk, og þar sem
            þeim ber ekki saman birtist orðalag hennar við gildið.
          </p>
        </>
      ) : (
        <div className="space-y-2 rounded-xl bg-hc-sunken p-3">
          <p className="text-sm font-semibold text-hc-ink">Engin skýrsla á skrá hér</p>
          <p className="text-sm text-hc-ink-2">
            Skýrslan verður til og er undirrituð í Medalia. Hér er aðeins afrit skjólstæðingsins: hann setur það inn sjálfur í appinu,
            eða leyfir okkur að sækja það fyrir sig.
          </p>
          {consent ? (
            <p className="flex items-start gap-1.5 text-sm text-hc-ok-ink">
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Leyfi til að sækja afritið fékkst {dayTime(consent)}. Sæktu PDF-skýrsluna í sjúklingagáttina og notaðu „Lesa inn skýrslu“ hér fyrir neðan.
            </p>
          ) : (
            <p className="text-sm text-hc-ink-2">Skjólstæðingurinn hefur ekki leyft starfsfólki að sækja afritið.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {!consent && (
              <button type="button" onClick={onAskConsent} className={wsBtn.primary}>
                <Send className="h-4 w-4" aria-hidden /> Biðja um leyfi
              </button>
            )}
            <a href={MEDALIA_URL} target="_blank" rel="noopener noreferrer" className={wsBtn.secondary}>
              <ExternalLink className="h-4 w-4" aria-hidden /> Opna í Medalia
            </a>
          </div>
        </div>
      )}
      <ResultsCard api={api} journeyId={j.id} sex={sexOf(d.patient.sex)} results={d.results ?? []}
        reportShown={!!d.report} onSaved={() => void reload()}
        categories={FOLLOWUP_CATEGORIES} title="Eftirfylgdarmælingar (skráðar líka í Medalia)"
        allowImport={!!consent} importOnBehalf
        emptyText="Engar eftirfylgdarmælingar skráðar. Mælingar heilsufarsskoðunarinnar eru skráðar í Medalia; hér skráir þú mælingar í eftirfylgd til að nota í þjálfuninni og skráir þær líka í Medalia." />
    </div>
  );
}

export function Orders({ d, record }: { d: Detail; record: Record_ }) {
  const { busy, out, run } = useAction(record);
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
      {/* Paid and not activated: resend the activation code. */}
      {d.orders.some((o) => o.paid_at) && !d.journey.protocol_activated_at && (
        <button type="button" disabled={!!busy} onClick={() => void run("remind", { action: "remind_client" }, "Áminning send.")}
          className={wsBtn.primary}>{busy ? <Spin /> : <Bell className="h-4 w-4" aria-hidden />} Senda áminningu um virkjun</button>
      )}
      <OutcomeLine out={out} />
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
  doctor_reviewed: "Læknir mat", doctor_interview_done: "Læknisviðtal í Medalia merkt lokið", protocol_confirmed_by_client: "Skjólstæðingur staðfesti virkjun", test_patient_seeded: "Prufuskjólstæðingur búinn til", set_booking: "Tími skráður af skjólstæðingi",
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
