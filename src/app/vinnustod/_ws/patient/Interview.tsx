"use client";

// Áætlunarsamtal and Eftirfylgd: booking, the guided conversation and
// finishing it.
//
// The Áætlunarsamtal is Lifeline's own plan session with the nurse or coach
// (renamed from "Viðtal" in the Medalia split, 2026-10-16). The doctor
// interview and anything clinical happen in Medalia; what is written here
// are lifestyle notes for the plan.
//
// These lost their mount point when the workspace became four tabs
// (2026-10-12) — booking, notes, "lokið" and the three-month follow-up all
// still worked and could not be reached. They live in one sheet now, opened
// from the client header's "Næsta verk", from the queue ("Bóka
// áætlunarsamtal", "Hefja samtal", "Bóka eftirfylgd") and from the notes on
// Aðgerðaáætlun.
// A sheet rather than a fifth tab, because the four tabs are places and
// this is an encounter: you open it, have the conversation, close it.

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, ExternalLink, Loader2, Video } from "lucide-react";
import { accountInput, useDialog } from "@/app/components/account/ui";
import { useWsApi } from "@/app/components/hc/ws-api";
import { PILLAR_META, type InterviewNotes } from "@/lib/hc/types";
import { day, dayTime, toLocalInput, wsBtn } from "../format";
import type { Detail, Journey, Record_ } from "../tasks";

// ── The sheet's body ─────────────────────────────────────────────────────

/**
 * Áætlunarsamtal until it is done, Eftirfylgd after — with both reachable.
 *
 * One sheet for both because they are the same act three months apart, and
 * the coach opening it should not have to know which one is current. Which
 * one shows is decided when the sheet opens, not on every reload: marking
 * the interview done from its last step would otherwise swap the sheet out
 * from under the coach mid-sentence, before she books the follow-up there.
 */
export function InterviewSheet({ d, record, onPlan }: {
  d: Detail; record: Record_; onPlan: () => void;
}) {
  const j = d.journey;
  const [which, setWhich] = useState<"interview" | "followup">(() => (j.interview_done_at ? "followup" : "interview"));
  const props = { d, record, onPlan };
  return (
    <div className="space-y-4">
      {j.interview_done_at && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-hc-ok-ink">
            <Check className="h-4 w-4 shrink-0" aria-hidden /> Áætlunarsamtali lokið {day(j.interview_done_at)}.
          </p>
          <div className="flex rounded-hc-element bg-hc-sunken-2 p-1" role="radiogroup" aria-label="Áætlunarsamtal eða eftirfylgd">
            {([["interview", "Áætlunarsamtal"], ["followup", "Eftirfylgd"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={which === k} onClick={() => setWhich(k)}
                className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
                  which === k ? "bg-hc-surface text-hc-ink shadow-sm" : "text-hc-ink-2 hover:text-hc-ink"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
      {which === "followup" && j.interview_done_at ? <FollowupStep {...props} /> : <InterviewStep {...props} />}
    </div>
  );
}

/** The sheet's title, matching what it holds. */
export const interviewSheetTitle = (j: Journey) => (j.interview_done_at ? "Áætlunarsamtal og eftirfylgd" : "Áætlunarsamtal");

/* A booking's outcome. A failure used to print in the same green as a
   success, and the editor closed either way, so a time that did not save
   looked saved and had to be typed in again. */
function useRun(record: Record_) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (p: Record<string, unknown>, ok: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(true); setMsg(null);
    const e = await record(p);
    setBusy(false); setMsg(e ? { ok: false, text: e } : { ok: true, text: ok });
    return !e;
  };
  return { busy, msg, run };
}

function RunMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return msg.ok
    ? <p role="status" className="text-sm text-hc-ok-ink">{msg.text}</p>
    : <p role="alert" className="text-sm font-semibold text-hc-bad-ink">{msg.text}</p>;
}

function InterviewStep({ d, record, onPlan }: { d: Detail; record: Record_; onPlan: () => void }) {
  const j = d.journey;
  const { busy, msg, run } = useRun(record);
  return (
    <div className="space-y-4">
      {/* Bookable before the report copy is here: the report and the
          doctor interview are in Medalia, and the nurse reads them there. */}
      <Booking label="Áætlunarsamtal" at={j.interview_booked_for} done={j.interview_done_at} mode={j.interview_mode} meetingUrl={j.meeting_url}
        disabled={false} disabledText=""
        onBook={(at, mode, meeting_url) => run({ event: "interview_booked", at, mode, meeting_url }, "Áætlunarsamtal bókað og sett í dagatal.")} busy={busy}
        onCancel={(noShow) => run({ event: "interview_cancelled", note: noShow ? "no_show" : null }, noShow ? "Skráð: mætti ekki. Bókaðu nýjan tíma." : "Áætlunarsamtal afbókað.")} />
      <RunMsg msg={msg} />
      {(j.interview_booked_for || j.interview_done_at) && <Interview d={d} record={record} onPlan={onPlan} mode="interview" />}
    </div>
  );
}

function FollowupStep({ d, record, onPlan }: { d: Detail; record: Record_; onPlan: () => void }) {
  const j = d.journey;
  const { busy, msg, run } = useRun(record);
  return (
    <div className="space-y-3">
      <Booking label="Eftirfylgd" at={j.followup_booked_for} done={j.followup_done_at} mode={j.followup_mode ?? (j.followup_booked_for ? j.interview_mode : "video")} meetingUrl={j.followup_meeting_url ?? null}
        disabled={!j.interview_done_at} disabledText="Hægt að bóka eftir áætlunarsamtalið." suggest={90}
        onBook={(at, mode, meeting_url) => run({ event: "followup_booked", at, mode, meeting_url }, "Eftirfylgd bókuð og sett í dagatal.")} busy={busy}
        onCancel={(noShow) => run({ event: "followup_cancelled", note: noShow ? "no_show" : null }, noShow ? "Skráð: mætti ekki. Bókaðu nýjan tíma." : "Eftirfylgd afbókuð.")} />
      <RunMsg msg={msg} />
      {/* The follow-up conversation, guided like the first one but with its
          own notes and questions about how it went. Marking it done is the
          wizard's last step. */}
      {(j.followup_booked_for || j.followup_done_at) && <Interview d={d} record={record} onPlan={onPlan} mode="followup" />}
    </div>
  );
}

// ── Booking ──────────────────────────────────────────────────────────────

/*
 * Books the journey columns (interview_booked_for / followup_booked_for).
 *
 * Those columns are what the queue's next task, the diary, the .ics feed
 * and the Google push all read, so this — not a Þjálfari video booking in
 * hc_bookings — is the booking the Í dag list sees. It also covers what
 * BookVideo did: pick Myndsímtal and leave the link empty for a Meet link.
 */
function Booking({ label, at, done, mode, meetingUrl, disabled, disabledText, onBook, busy, suggest, onCancel }: {
  label: string; at: string | null; done: string | null; mode?: string | null; meetingUrl?: string | null;
  disabled: boolean; disabledText: string;
  /** Resolves true when the booking saved; the editor stays open otherwise. */
  onBook: (at: string, mode: "in_person" | "video", meetingUrl: string | null) => Promise<boolean>; busy: boolean; suggest?: number;
  /** Cancel the slot; noShow when the time has passed and nobody came. */
  onCancel?: (noShow: boolean) => void;
}) {
  const dialog = useDialog();
  const [editing, setEditing] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const [when, setWhen] = useState(() => {
    if (at) return toLocalInput(new Date(at));
    const d = new Date(Date.now() + (suggest ?? 1) * 86400_000);
    d.setMinutes(0, 0, 0);
    return toLocalInput(d);
  });
  const [m, setM] = useState<"in_person" | "video">(mode === "video" ? "video" : "in_person");
  const [link, setLink] = useState(meetingUrl ?? "");
  const whenId = `when-${label}`;
  const linkId = `link-${label}`;

  const cancel = async () => {
    const ok = await dialog.confirm({
      title: `Afbóka ${label.toLowerCase()}?`,
      body: "Skjólstæðingurinn fær tölvupóst um að tímanum hafi verið aflýst.",
      confirmLabel: "Afbóka", cancelLabel: "Halda tímanum", tone: "danger",
    });
    if (ok) onCancel?.(false);
  };
  const noShow = async () => {
    const ok = await dialog.confirm({
      title: "Skrá að skjólstæðingur mætti ekki?",
      body: "Tíminn losnar og þú getur bókað nýjan.",
      confirmLabel: "Mætti ekki", cancelLabel: "Hætta við",
    });
    if (ok) onCancel?.(true);
  };
  const save = async () => {
    const t = new Date(when);
    if (Number.isNaN(t.getTime())) return;
    if (await onBook(t.toISOString(), m, m === "video" ? (link.trim() || null) : null)) setEditing(false);
  };

  return (
    <div className="rounded-xl border border-hc-hairline p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold text-hc-ink">{label}</span><br />
          <span className="text-hc-ink-2">{done ? `Lokið ${dayTime(done)}` : at ? `${dayTime(at)}${mode === "video" ? " · myndsímtal" : ""}` : disabled ? disabledText : "Ekki bókað"}</span>
          {!done && at && mode === "video" && (
            <>
              <br />
              {meetingUrl ? (
                <a href={meetingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-hc-ok-ink hover:underline">
                  <Video className="h-4 w-4" aria-hidden /> Opna fjarfund
                </a>
              ) : (
                <span className="text-hc-warn-ink">Myndsímtal án hlekks — hann kemur sjálfkrafa þegar tíminn fer í Google-dagatalið, eða settu hann inn sjálf.</span>
              )}
            </>
          )}
        </p>
        {!done && !disabled && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={at ? wsBtn.secondary : wsBtn.primary}>{at ? "Breyta tíma" : "Bóka"}</button>
        )}
        {!done && at && !editing && onCancel && (
          new Date(at).getTime() < openedAt
            ? <button type="button" disabled={busy} onClick={() => void noShow()} className={wsBtn.ghost}>Mætti ekki</button>
            : <button type="button" disabled={busy} onClick={() => void cancel()} className={wsBtn.ghost}>Afbóka</button>
        )}
      </div>
      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-hc-sunken p-3">
          <div>
            <label htmlFor={whenId} className="text-xs font-semibold text-hc-ink-2">Dagur og tími</label>
            <input id={whenId} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${accountInput} mt-1 min-h-11 sm:w-auto`} />
          </div>
          {mode !== undefined && (
            <div className="flex gap-1" role="radiogroup" aria-label="Form">
              {([["in_person", "Á staðnum"], ["video", "Myndsímtal"]] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={m === k} onClick={() => setM(k)}
                  className={`${wsBtn.base} ${m === k ? "bg-hc-brand-dark text-white" : "bg-hc-surface text-hc-ink-2 ring-1 ring-hc-control"}`}>{l}</button>
              ))}
            </div>
          )}
          {m === "video" && (
            <div className="w-full">
              <label htmlFor={linkId} className="text-xs font-semibold text-hc-ink-2">Hlekkur á fjarfund (Meet, Teams eða Zoom)</label>
              <input id={linkId} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…"
                className={`${accountInput} mt-1 min-h-11`} />
              {/* Left empty, a Meet link is made for you: the booking syncs to
                  the interviewer's Google calendar and the conference is
                  created there, then written back here and on to the client. */}
              <p className="mt-1.5 text-xs leading-snug text-hc-ink-2">
                Skildu þetta eftir tómt og Google Meet-hlekkur verður búinn til sjálfkrafa þegar tíminn fer í dagatalið.
                Límdu hér að ofan ef þú vilt nota Teams, Zoom eða tiltekinn fund.
              </p>
              <a href="https://meet.google.com/new" target="_blank" rel="noreferrer" className={`${wsBtn.secondary} mt-2`}>
                <Video className="h-4 w-4" aria-hidden /> Búa til Meet sjálf
              </a>
            </div>
          )}
          <button type="button" disabled={busy || !when} onClick={() => void save()} className={wsBtn.primary}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Vista tíma
          </button>
          <button type="button" onClick={() => setEditing(false)} className={wsBtn.ghost}>Hætta við</button>
        </div>
      )}
    </div>
  );
}

// ── Notes, read-only, beside the plan ────────────────────────────────────

/** While building the plan: what was said in the conversation, per topic. */
export function NotesPeek({ j, onOpenInterview }: { j: Journey; onOpenInterview: () => void }) {
  const notes = (j.followup_booked_for && j.interview_done_at ? j.followup_notes : j.interview_notes) ?? {};
  const rows = [...TOPICS, ...LEGACY_TOPICS].filter((t) => (notes[t.key] ?? "").trim());
  return (
    <section className="rounded-xl bg-hc-sunken p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-hc-ink-2">Úr áætlunarsamtalinu</h2>
        <button type="button" onClick={onOpenInterview} className={wsBtn.ghost}>
          Opna áætlunarsamtalið <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {rows.length ? (
        <dl className="mt-2 space-y-2">
          {rows.map((t) => (
            <div key={t.key}>
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-hc-ink-2"><span className="h-2 w-2 rounded-full" style={{ background: t.color }} aria-hidden />{t.title}</dt>
              <dd className="mt-0.5 whitespace-pre-line text-sm text-hc-ink-2">{notes[t.key]}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="mt-1 text-sm text-hc-ink-2">Engir minnispunktar enn.</p>}
    </section>
  );
}

// ── Áætlunarsamtal: guided, step by step ─────────────────────────────────

/*
 * No clinical reading in the prep (Medalia split, 2026-10-16): interpreting
 * blood work and measurements is the doctor's, in the doctor interview in
 * Medalia. The nurse reads what was found and agreed there, and the
 * Áætlunarsamtal is about how the person wants to live with it.
 */
const PREP: string[] = [
  "Lestu skýrsluna (afritið hér eða í Medalia) og niðurstöður læknisviðtalsins í Medalia.",
  "Lestu svör við spurningalista um svefn, hreyfingu, næringu og andlega líðan.",
  "Merktu við 1–2 atriði í lífsstíl til að ræða.",
];

const FOLLOWUP_PREP: string[] = [
  "Skoðaðu framvinduna á flipanum „Staða“: hvað hefur gengið og hvað ekki síðustu vikur.",
  "Lestu hvað skjólstæðingurinn lagði til hliðar og athugasemdir hans.",
  "Rifjaðu upp markmiðin og minnispunkta úr áætlunarsamtalinu.",
  "Veldu 1–2 atriði til að breyta eða bæta við í áætluninni.",
];

/** Follow-up prompts per topic: how it went, not how things are. */
const FOLLOWUP_PROMPTS: Partial<Record<keyof InterviewNotes, string[]>> = {
  goals: ["Hvernig hefur gengið að ná markmiðunum?", "Hvað hefur breyst síðan síðast?"],
  sleep: ["Hvað hefur breyst í svefninum?", "Hvað hefur verið erfitt?"],
  exercise: ["Hvernig hefur æfingaáætlunin gengið?", "Þarf að auka eða minnka álagið?"],
  nutrition: ["Hvaða breytingar hafa haldist?", "Hvað hefur ekki gengið?"],
  mental: ["Hvernig er álagið núna miðað við síðast?", "Hvað hjálpaði?"],
};

const TOPICS: { key: keyof InterviewNotes; title: string; color: string; prompts: string[] }[] = [
  { key: "goals", title: "Hvað vill skjólstæðingurinn?", color: "#10B981", prompts: ["Hvað viltu fá út úr þessu?", "Hvað myndi breyta mestu fyrir þig næstu þrjá mánuði?"] },
  { key: "sleep", title: PILLAR_META.sleep.label, color: "var(--hc-sleep)", prompts: ["Hvenær ferðu að sofa og á fætur?", "Vaknarðu úthvíld(ur)?", "Skjánotkun, koffín, áfengi á kvöldin?"] },
  { key: "exercise", title: PILLAR_META.exercise.label, color: "var(--hc-exercise)", prompts: ["Hvernig hreyfingu stundar þú í dag?", "Hvað finnst þér skemmtilegt?", "Verkir eða takmarkanir?"] },
  { key: "nutrition", title: PILLAR_META.nutrition.label, color: "var(--hc-nutrition)", prompts: ["Hvernig lítur venjulegur dagur út?", "Reglulegar máltíðir? Sykraðir drykkir?", "Hver sér um innkaup og eldamennsku?"] },
  { key: "mental", title: PILLAR_META.mental.label, color: "var(--hc-mental)", prompts: ["Hvernig er álagið núna?", "Hvað gefur þér orku?", "Stuðningur, tengsl, hvíld?"] },
];

/* Notes written before the split may have a "measurements" topic; they are
   still shown beside the plan, never asked for again. */
const LEGACY_TOPICS: typeof TOPICS = [
  { key: "measurements", title: "Mælingar (eldri punktar)", color: "#475569", prompts: [] },
];

const STEPS = ["Undirbúningur", "Samtal", "Áætlun", "Ljúka"] as const;

function Interview({ d, record, onPlan, mode = "interview" }: { d: Detail; record: Record_; onPlan?: () => void; mode?: "interview" | "followup" }) {
  const api = useWsApi();
  const j = d.journey;
  const isFollowup = mode === "followup";
  const prep = isFollowup ? FOLLOWUP_PREP : PREP;
  // The wizard remembers where it was: closing the sheet unmounts it.
  const memo = `ws-iv:${j.id}:${mode}`;
  const [step, setStepState] = useState(() => {
    try { return Math.min(STEPS.length - 1, Number(sessionStorage.getItem(`${memo}:step`)) || 0); } catch { return 0; }
  });
  const setStep = (n: number) => { setStepState(n); try { sessionStorage.setItem(`${memo}:step`, String(n)); } catch { /* private mode */ } };
  const [checked, setCheckedState] = useState<boolean[]>(() => {
    try { const v = JSON.parse(sessionStorage.getItem(`${memo}:prep`) || "null"); if (Array.isArray(v) && v.length === prep.length) return v; } catch { /* none */ }
    return prep.map(() => false);
  });
  const setChecked = (v: boolean[]) => { setCheckedState(v); try { sessionStorage.setItem(`${memo}:prep`, JSON.stringify(v)); } catch { /* private mode */ } };
  const [notes, setNotes] = useState<InterviewNotes>((isFollowup ? j.followup_notes : j.interview_notes) ?? {});
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const { busy, msg, run } = useRun(record);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* What is typed but not yet sent. Closing the sheet inside the 900 ms
     used to clear the timer and drop the last words on the floor. */
  const pending = useRef<InterviewNotes | null>(null);

  const saveNotes = async (next: InterviewNotes) => {
    pending.current = null;
    setSaved("saving");
    const r = await api(`/api/vinnustod/journeys/${j.id}`, { method: "PATCH", body: JSON.stringify(isFollowup ? { followup_notes: next } : { interview_notes: next }) }).catch(() => null);
    setSaved(r?.ok ? "saved" : "error");
  };
  // Autosave notes a second after typing stops.
  const setNote_ = (k: keyof InterviewNotes, v: string) => {
    const next = { ...notes, [k]: v };
    setNotes(next);
    setSaved("saving");
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNotes(next), 900);
  };
  const saveRef = useRef(saveNotes);
  useEffect(() => { saveRef.current = saveNotes; });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current) void saveRef.current(pending.current);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      {/* Stepper */}
      <nav aria-label={isFollowup ? "Skref eftirfylgdar" : "Skref áætlunarsamtals"} className="lg:sticky lg:top-0 lg:self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-hc-ink-2">{isFollowup ? "Eftirfylgdarviðtal" : "Áætlunarsamtal"}</p>
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${step === i ? "bg-hc-brand-dark text-white" : "bg-hc-surface text-hc-ink-2 ring-1 ring-hc-hairline hover:bg-hc-sunken"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === i ? "bg-hc-surface text-hc-ink" : i < step ? "bg-hc-brand-dark text-white ring-1 ring-white/40" : "bg-hc-sunken-2 text-hc-ink-2"}`}>
                  {i < step ? <Check className="h-3.5 w-3.5" aria-label="lokið" /> : i + 1}
                </span>
                {s}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="min-w-0 space-y-4">
        {step === 0 && (
          <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 sm:p-5">
            <h3 className="text-lg font-bold text-hc-ink">Undirbúningur</h3>
            <p className="mb-4 text-sm text-hc-ink-2">{isFollowup ? "Um 10 mínútur fyrir eftirfylgdina." : "Um 10 mínútur fyrir áætlunarsamtalið."}</p>
            <ul className="space-y-2">
              {prep.map((p, i) => (
                <li key={i}>
                  <button type="button" role="checkbox" aria-checked={checked[i]} onClick={() => setChecked(checked.map((c, k) => (k === i ? !c : c)))}
                    className={`flex min-h-11 w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${checked[i] ? "border-hc-ok-ink/30 bg-hc-ok-surface text-hc-ok-ink" : "border-hc-hairline text-hc-ink hover:bg-hc-sunken"}`}>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked[i] ? "border-hc-brand-dark bg-hc-brand-dark text-white" : "border-hc-control"}`}>{checked[i] && <Check className="h-3.5 w-3.5" aria-hidden />}</span>
                    {p}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="https://provider.medalia.is" target="_blank" rel="noreferrer" className={wsBtn.secondary}><ExternalLink className="h-4 w-4" aria-hidden /> Opna í Medalia</a>
              <span className="flex-1" />
              <button type="button" onClick={() => setStep(1)} className={wsBtn.primary}>Hefja samtal <ChevronRight className="h-4 w-4" aria-hidden /></button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-hc-ink">Samtal</h3>
                <p className="text-sm text-hc-ink-2">Byrjaðu á því sem skjólstæðingurinn vill breyta. Punktarnir eru um lífsstíl, vistast sjálfkrafa og fylgja í áætlunina.</p>
                <p className="mt-1 text-xs text-hc-ink-2">Klínísk atriði eru skráð í Medalia, ekki hér.</p>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold ${saved === "error" ? "text-hc-bad-ink" : "text-hc-ink-2"}`} role="status">
                {saved === "saving" ? "Vistar…" : saved === "saved" ? <><Check className="h-3.5 w-3.5" aria-hidden /> Vistað</> : saved === "error" ? (
                  <>Vistun mistókst. <button type="button" onClick={() => void saveNotes(notes)} className="underline">Reyna aftur</button></>
                ) : ""}
              </span>
            </div>
            <div className="space-y-4">
              {TOPICS.map((t) => (
                <div key={t.key} className="rounded-xl border border-hc-hairline p-3" style={{ borderLeftWidth: 4, borderLeftColor: t.color }}>
                  <label htmlFor={`note-${t.key}`} className="font-semibold text-hc-ink">{t.title}</label>
                  <p className="mt-0.5 text-xs text-hc-ink-2">{((isFollowup ? FOLLOWUP_PROMPTS[t.key] : null) ?? t.prompts).join(" · ")}</p>
                  <textarea id={`note-${t.key}`} value={notes[t.key] ?? ""} onChange={(e) => setNote_(t.key, e.target.value)} rows={3}
                    className={`${accountInput} mt-2`} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <button type="button" onClick={() => setStep(0)} className={wsBtn.ghost}><ArrowLeft className="h-4 w-4" aria-hidden /> Undirbúningur</button>
              <button type="button" onClick={() => setStep(2)} className={wsBtn.primary}>Áfram í áætlun <ChevronRight className="h-4 w-4" aria-hidden /></button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 sm:p-5">
            <h3 className="text-lg font-bold text-hc-ink">Aðgerðaáætlun</h3>
            <p className="mt-1 text-sm text-hc-ink-2">Veldu sniðmát sem passar, dragðu inn 2–4 aðgerðir á stoð í mesta lagi og skrifaðu persónulegar athugasemdir. Punktar úr samtalinu fylgja sem samantekt.</p>
            {d.plan && (
              <p className="mt-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${d.plan.status === "published" ? "bg-hc-ok-surface text-hc-ok-ink ring-hc-ok-ink/20" : "bg-hc-warn-surface text-hc-warn-ink ring-hc-warn-ink/20"}`}>
                  {d.plan.status === "published" ? `Birt ${day(d.plan.published_at)}` : "Drög til"}
                </span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <button type="button" onClick={() => setStep(1)} className={wsBtn.ghost}><ArrowLeft className="h-4 w-4" aria-hidden /> Samtal</button>
              <div className="flex flex-wrap gap-2">
                {onPlan && <button type="button" onClick={onPlan} className={wsBtn.primary}>{d.plan ? "Opna áætlun" : "Búa til áætlun"} <ChevronRight className="h-4 w-4" aria-hidden /></button>}
                <button type="button" onClick={() => setStep(3)} className={wsBtn.secondary}>{isFollowup ? "Ljúka eftirfylgd" : "Ljúka áætlunarsamtali"}</button>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <FinishStep j={j} planPublished={d.plan?.status === "published"} busy={busy} run={run} isFollowup={isFollowup} />
        )}

        <RunMsg msg={msg} />
      </div>
    </div>
  );
}

function StepDot({ done, n }: { done: boolean; n: number }) {
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${done ? "bg-hc-brand-dark text-white" : "bg-hc-sunken-2 text-hc-ink-2"}`}>
      {done ? <Check className="h-4 w-4" aria-label="lokið" /> : n}
    </span>
  );
}

function FinishStep({ j, planPublished, busy, run, isFollowup }: {
  j: Journey; planPublished: boolean; busy: boolean; isFollowup: boolean;
  run: (p: Record<string, unknown>, ok: string) => Promise<boolean>;
}) {
  const [suggested] = useState(() => toLocalInput(new Date(new Date().setHours(10, 0, 0, 0) + 91 * 86400_000)));
  const [when, setWhen] = useState(j.followup_booked_for ? toLocalInput(new Date(j.followup_booked_for)) : suggested);
  const interviewDone = !!j.interview_done_at;
  const thisDone = !!(isFollowup ? j.followup_done_at : interviewDone);
  return (
    <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 sm:p-5">
      <h3 className="text-lg font-bold text-hc-ink">Ljúka</h3>
      <ol className="mt-4 space-y-3">
        <li className="flex flex-wrap items-center gap-3 rounded-xl border border-hc-hairline p-3">
          <StepDot done={thisDone} n={1} />
          <span className="flex-1 text-sm font-semibold text-hc-ink">{isFollowup ? "Merkja eftirfylgd lokið" : "Merkja áætlunarsamtali lokið"}</span>
          {!thisDone && (
            <button type="button" disabled={busy} onClick={() => run({ event: isFollowup ? "followup_done" : "interview_done" }, isFollowup ? "Eftirfylgd merkt lokið." : "Áætlunarsamtali merkt lokið.")} className={wsBtn.primary}>Merkja lokið</button>
          )}
        </li>
        <li className="flex flex-wrap items-center gap-3 rounded-xl border border-hc-hairline p-3">
          <StepDot done={planPublished} n={2} />
          <span className="flex-1 text-sm font-semibold text-hc-ink">Aðgerðaáætlun birt skjólstæðingi</span>
          {!planPublished && <span className="text-xs text-hc-warn-ink">Ekki birt enn</span>}
        </li>
        {!isFollowup && (
          <li className="flex flex-wrap items-end gap-3 rounded-xl border border-hc-hairline p-3">
            <StepDot done={!!j.followup_booked_for} n={3} />
            <div className="min-w-0 flex-1">
              <label htmlFor="finish-followup" className="text-sm font-semibold text-hc-ink">Bóka eftirfylgd eftir 3 mánuði <span className="font-normal text-hc-ink-2">(ráðlögð, valfrjáls)</span></label>
              <input id="finish-followup" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${accountInput} mt-1 min-h-11 sm:w-auto`} />
            </div>
            <button type="button" disabled={busy || !when || !interviewDone} onClick={() => run({ event: "followup_booked", at: new Date(when).toISOString() }, "Eftirfylgd bókuð og sett í dagatal.")} className={wsBtn.secondary}>
              {j.followup_booked_for ? "Breyta tíma" : "Bóka"}
            </button>
          </li>
        )}
      </ol>
      {!interviewDone && !isFollowup && <p className="mt-2 text-xs text-hc-ink-2">Eftirfylgd er hægt að bóka þegar áætlunarsamtali er merkt lokið.</p>}
      <p className="mt-3 text-xs text-hc-ink-2">Skjólstæðingurinn fær tölvupóst þegar áætlunin er birt. Eftirfylgd er greidd sérstaklega á aðgangi hans.</p>
    </section>
  );
}
