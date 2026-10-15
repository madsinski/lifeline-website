"use client";

// "Hafa samband" — the one place the participant asks for anything.
//
// Five situations, one form: a question, a talk, a new measurement, a
// programme that does not fit, an injury. They are the same object underneath
// (hc_requests) because from the coach's side they are all "someone needs
// something", and splitting them into five buttons that each went somewhere
// different would only make it harder to find the right one.
//
// Anything already asked is listed below with its answer, so the page is also
// where you go to see what came back.

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, MessageCircle, Stethoscope, X } from "lucide-react";
import {
  MEASUREMENTS, MEETING_WAYS, REQUEST_IS, REQUEST_KINDS, STATUS_IS, TOPICS,
  needsDoctor, requestSummary, type RequestKind,
} from "@/lib/hc/requests";
import { hcBtn, hcCard, hcInput } from "./ui";
import { SAVE_FAILED, useToast } from "./Toast";
import { fmtDate } from "@/app/components/account/ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface HcRequest {
  id: string;
  kind: RequestKind;
  detail: Record<string, unknown>;
  body: string | null;
  status: string;
  reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
}

const PILLARS = [
  { key: "exercise", label: "Hreyfing" }, { key: "nutrition", label: "Næring" },
  { key: "sleep", label: "Svefn" }, { key: "mental", label: "Andleg líðan" },
];

const fmt = (iso: string) => fmtDate(iso, { year: false });

export default function HelpCard({ api, portalUrl }: { api: Api; portalUrl?: string | null }) {
  const [rows, setRows] = useState<HcRequest[] | null>(null);
  const [kind, setKind] = useState<RequestKind | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [way, setWay] = useState<string>("video");
  const [pillar, setPillar] = useState<string>("exercise");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [cancelling, setCancelling] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const r = await api("/api/hc/requests").catch(() => null);
    if (!r?.ok) return;
    const j = (await r.json().catch(() => ({}))) as { requests?: HcRequest[] };
    setTimeout(() => setRows(j.requests ?? []), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const reset = () => { setKind(null); setTopic(null); setBody(""); setPicked([]); setErr(""); };

  const send = async () => {
    if (!kind || busy) return;
    setBusy(true); setErr("");
    const detail: Record<string, unknown> =
      kind === "measurement" ? { measurements: picked }
      : kind === "appointment" ? { way }
      : kind === "program" ? { pillar }
      : {};
    if (topic) detail.topic = topic;
    /* A dropped connection threw past setBusy(false) and left the button
       spinning on "Sendi…" for good. */
    const r = await api("/api/hc/requests", { method: "POST", body: JSON.stringify({ kind, detail, body }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    /* Only the server's Icelandic reasons are shown as they are; a
       database message or a code is not for the participant. */
    if (!r?.ok) { setErr(typeof j.error === "string" && /[áéíóúýþæöð]/i.test(j.error) ? j.error : "Tókst ekki að senda. Reyndu aftur."); return; }
    setRows(j.requests ?? []);
    reset();
    toast.show("Beiðnin er send", { tone: "ok" });
  };

  /* Cancelling had no busy state, no word on failure and threw on a
     dropped connection — a tap that did nothing looked exactly like one
     that worked until the page was opened again. */
  const cancel = async (id: string) => {
    if (cancelling) return;
    setCancelling(id);
    const r = await api("/api/hc/requests", { method: "PATCH", body: JSON.stringify({ id, status: "cancelled" }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setCancelling(null);
    if (!r?.ok) {
      toast.show(typeof j.error === "string" && /[áéíóúýþæöð]/i.test(j.error) ? j.error : SAVE_FAILED, { tone: "bad" });
      if (r?.status === 409) void load();
      return;
    }
    setRows(j.requests ?? []);
    toast.show("Hætt við beiðnina", { tone: "ok" });
  };

  const open = (rows ?? []).filter((r) => r.status === "open" || r.status === "in_progress");
  const past = (rows ?? []).filter((r) => r.status === "done" || r.status === "cancelled");

  return (
    <section className={`${hcCard.base} p-5`}>
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-hc-brand" aria-hidden />
        <h3 className="font-bold text-hc-ink">Hafa samband</h3>
      </div>
      <p className="mt-1 text-sm text-hc-ink-2">
        Við lesum þetta á virkum dögum. Ef eitthvað er bráðatilfelli, hringdu í 112.
      </p>

      {!kind ? (
        <div className="mt-3 grid gap-2">
          {/* Straight to a message, no questions.
              The list below gets a request to the right person faster, but
              somebody who already knows what they want to say should not
              have to answer two questions to say it — and a form that
              insists is a form people stop using. */}
          <button type="button" onClick={() => { setKind("help"); setTopic("other"); }}
            className="flex items-center gap-2 rounded-2xl border border-dashed border-hc-control bg-hc-surface px-4 py-3 text-left text-sm font-semibold text-hc-ink transition hover:border-hc-brand hover:bg-hc-brand-surface">
            <MessageCircle className="h-4 w-4 shrink-0 text-hc-ink-2" aria-hidden />
            Skrifa skilaboð beint
          </button>
          {REQUEST_KINDS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className="rounded-2xl border border-hc-hairline bg-hc-surface px-4 py-3 text-left transition hover:border-hc-brand">
              <span className="flex items-center gap-2 font-semibold text-hc-ink">
                <span className={`h-2 w-2 rounded-full ${REQUEST_IS[k].dot}`} aria-hidden />
                {REQUEST_IS[k].label}
              </span>
              <span className="mt-0.5 block text-sm text-hc-ink-2">{REQUEST_IS[k].hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-2xl border border-hc-hairline p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-hc-ink">{REQUEST_IS[kind].label}</p>
            <button type="button" onClick={reset} aria-label="Hætta við" className="-my-2 grid h-11 w-11 place-items-center rounded-full text-hc-ink-2 hover:bg-hc-sunken-2 hover:text-hc-ink">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* One question, when the kind does not already ask its own. */}
          {TOPICS[kind] && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-hc-ink">{TOPICS[kind]!.q}</p>
              <div className="flex flex-wrap gap-1.5">
                {TOPICS[kind]!.options.map((o) => (
                  <button key={o.key} type="button" aria-pressed={topic === o.key}
                    onClick={() => setTopic(o.key)}
                    className={`min-h-11 rounded-full px-4 text-sm transition ${
                      topic === o.key ? "bg-hc-brand-dark font-semibold text-white"
                                      : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-slate-200"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Routed to a doctor, with the reason said plainly.
              This is the point of separating the medical kind: a coach
              reading a blood test back to somebody is practising medicine.
              The booking is not forced — the message can still be sent —
              but the person is told who actually answers this. */}
          {(() => {
            const why = needsDoctor(kind, topic);
            if (!why) return null;
            return (
              <div className="rounded-xl bg-hc-info-surface p-3 ring-1 ring-hc-info-ink/30">
                <p className="flex items-start gap-2 text-sm font-semibold text-hc-info-ink">
                  <Stethoscope className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {why}
                </p>
                {portalUrl && (
                  <a href={portalUrl} target="_blank" rel="noreferrer"
                    className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800">
                    Bóka tíma hjá lækni <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )}
                <p className="mt-2 text-xs text-sky-900/80">
                  Þú mátt líka senda skilaboðin hér fyrir neðan — við komum þeim áfram.
                </p>
              </div>
            );
          })()}

          {kind === "measurement" && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {MEASUREMENTS.map((m) => {
                const on = picked.includes(m.key);
                return (
                  <button key={m.key} type="button" aria-pressed={on}
                    onClick={() => setPicked(on ? picked.filter((x) => x !== m.key) : [...picked, m.key])}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${on ? "border-emerald-500 bg-hc-ok-surface font-semibold text-hc-ok-ink" : "border-hc-hairline bg-hc-surface hover:border-slate-300"}`}>
                    {m.label}
                    <span className="block text-xs font-normal text-hc-ink-2">{m.hint}</span>
                  </button>
                );
              })}
            </div>
          )}

          {kind === "appointment" && (
            <div className="flex flex-wrap gap-1.5">
              {MEETING_WAYS.map((w) => (
                <button key={w.key} type="button" aria-pressed={way === w.key} onClick={() => setWay(w.key)}
                  className={`min-h-11 rounded-full px-4 text-sm transition ${way === w.key ? "bg-hc-brand-dark font-semibold text-white" : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-slate-200"}`}>
                  {w.label}
                </button>
              ))}
            </div>
          )}

          {kind === "program" && (
            <div className="flex flex-wrap gap-1.5">
              {PILLARS.map((p) => (
                <button key={p.key} type="button" aria-pressed={pillar === p.key} onClick={() => setPillar(p.key)}
                  className={`min-h-11 rounded-full px-4 text-sm transition ${pillar === p.key ? "bg-hc-brand-dark font-semibold text-white" : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-slate-200"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-hc-ink">{REQUEST_IS[kind].prompt}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000}
              className={`${hcInput} mt-1 p-3`}
              placeholder={kind === "injury" ? "T.d. „Verkur í vinstra hné eftir fótbolta á mánudag.“" : ""} />
          </label>

          {err && <p role="alert" className="text-sm text-hc-bad-ink">{err}</p>}
          <button type="button" onClick={() => void send()} disabled={busy || (kind === "measurement" && !picked.length)} className={hcBtn.dark}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            {busy ? "Sendi…" : "Senda"}
          </button>
        </div>
      )}

      {open.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-hc-ink-2">Í vinnslu</p>
          <ul className="mt-1.5 space-y-2">
            {open.map((r) => (
              <li key={r.id} className={`rounded-xl px-3 py-2 text-sm ring-1 ${REQUEST_IS[r.kind].cls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{requestSummary(r.kind, r.detail)}</span>
                  <span className="text-xs">{STATUS_IS[r.status]} · {fmt(r.created_at)}</span>
                </div>
                {r.body && <p className="mt-0.5 opacity-80">{r.body}</p>}
                {r.status === "open" && (
                  <button type="button" onClick={() => void cancel(r.id)} disabled={!!cancelling}
                    className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs underline opacity-80 hover:opacity-100 disabled:opacity-40">
                    {cancelling === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                    Hætta við
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-hc-ink-2">Fyrri erindi ({past.length})</summary>
          <ul className="mt-2 space-y-2">
            {past.map((r) => (
              <li key={r.id} className="rounded-xl bg-hc-sunken px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-hc-ink-2">{requestSummary(r.kind, r.detail)}</span>
                  <span className="text-xs text-hc-ink-2">{STATUS_IS[r.status]} · {fmt(r.created_at)}</span>
                </div>
                {r.body && <p className="mt-0.5 text-hc-ink-2">{r.body}</p>}
                {r.reply && (
                  <p className="mt-1.5 rounded-lg bg-hc-surface p-2 text-hc-ink-2 ring-1 ring-hc-hairline">
                    <span className="block text-xs font-semibold text-hc-ink-2">
                      Svar{r.replied_by ? ` frá ${r.replied_by}` : ""}
                    </span>
                    {r.reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
