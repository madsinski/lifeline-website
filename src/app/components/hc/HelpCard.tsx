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
import { Check, Loader2, MessageCircle, X } from "lucide-react";
import {
  MEASUREMENTS, MEETING_WAYS, REQUEST_IS, REQUEST_KINDS, STATUS_IS,
  requestSummary, type RequestKind,
} from "@/lib/hc/requests";
import { hcBtn, hcCard } from "./ui";

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

const fmt = (iso: string) => new Date(iso).toLocaleDateString("is-IS", { day: "numeric", month: "long" });

export default function HelpCard({ api }: { api: Api }) {
  const [rows, setRows] = useState<HcRequest[] | null>(null);
  const [kind, setKind] = useState<RequestKind | null>(null);
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [way, setWay] = useState<string>("video");
  const [pillar, setPillar] = useState<string>("exercise");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await api("/api/hc/requests");
    if (!r.ok) return;
    const j = (await r.json().catch(() => ({}))) as { requests?: HcRequest[] };
    setTimeout(() => setRows(j.requests ?? []), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const reset = () => { setKind(null); setBody(""); setPicked([]); setErr(""); };

  const send = async () => {
    if (!kind) return;
    setBusy(true); setErr("");
    const detail: Record<string, unknown> =
      kind === "measurement" ? { measurements: picked }
      : kind === "appointment" ? { way }
      : kind === "program" ? { pillar }
      : {};
    const r = await api("/api/hc/requests", { method: "POST", body: JSON.stringify({ kind, detail, body }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Tókst ekki að senda."); return; }
    setRows(j.requests ?? []);
    reset();
  };

  const cancel = async (id: string) => {
    const r = await api("/api/hc/requests", { method: "PATCH", body: JSON.stringify({ id, status: "cancelled" }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setRows(j.requests ?? []);
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
        Þjálfarinn þinn les þetta á virkum dögum. Ef eitthvað er bráðatilfelli, hringdu í 112.
      </p>

      {!kind ? (
        <div className="mt-3 grid gap-2">
          {REQUEST_KINDS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-hc-brand">
              <span className="flex items-center gap-2 font-semibold text-hc-ink">
                <span className={`h-2 w-2 rounded-full ${REQUEST_IS[k].dot}`} aria-hidden />
                {REQUEST_IS[k].label}
              </span>
              <span className="mt-0.5 block text-sm text-hc-ink-2">{REQUEST_IS[k].hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-hc-ink">{REQUEST_IS[kind].label}</p>
            <button type="button" onClick={reset} aria-label="Hætta við" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {kind === "measurement" && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {MEASUREMENTS.map((m) => {
                const on = picked.includes(m.key);
                return (
                  <button key={m.key} type="button" aria-pressed={on}
                    onClick={() => setPicked(on ? picked.filter((x) => x !== m.key) : [...picked, m.key])}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${on ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-900" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    {m.label}
                    <span className="block text-xs font-normal text-slate-500">{m.hint}</span>
                  </button>
                );
              })}
            </div>
          )}

          {kind === "appointment" && (
            <div className="flex flex-wrap gap-1.5">
              {MEETING_WAYS.map((w) => (
                <button key={w.key} type="button" aria-pressed={way === w.key} onClick={() => setWay(w.key)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${way === w.key ? "bg-hc-ink font-semibold text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  {w.label}
                </button>
              ))}
            </div>
          )}

          {kind === "program" && (
            <div className="flex flex-wrap gap-1.5">
              {PILLARS.map((p) => (
                <button key={p.key} type="button" aria-pressed={pillar === p.key} onClick={() => setPillar(p.key)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${pillar === p.key ? "bg-hc-ink font-semibold text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-hc-ink">{REQUEST_IS[kind].prompt}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-hc-brand focus:outline-none"
              placeholder={kind === "injury" ? "T.d. „Verkur í vinstra hné eftir fótbolta á mánudag.“" : ""} />
          </label>

          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          <button type="button" onClick={() => void send()} disabled={busy || (kind === "measurement" && !picked.length)} className={hcBtn.dark}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            {busy ? "Sendi…" : "Senda"}
          </button>
        </div>
      )}

      {open.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Í vinnslu</p>
          <ul className="mt-1.5 space-y-2">
            {open.map((r) => (
              <li key={r.id} className={`rounded-xl px-3 py-2 text-sm ring-1 ${REQUEST_IS[r.kind].cls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{requestSummary(r.kind, r.detail)}</span>
                  <span className="text-xs">{STATUS_IS[r.status]} · {fmt(r.created_at)}</span>
                </div>
                {r.body && <p className="mt-0.5 opacity-80">{r.body}</p>}
                {r.status === "open" && (
                  <button type="button" onClick={() => void cancel(r.id)} className="mt-1 text-xs underline opacity-70 hover:opacity-100">
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
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Fyrri erindi ({past.length})</summary>
          <ul className="mt-2 space-y-2">
            {past.map((r) => (
              <li key={r.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{requestSummary(r.kind, r.detail)}</span>
                  <span className="text-xs text-slate-500">{STATUS_IS[r.status]} · {fmt(r.created_at)}</span>
                </div>
                {r.body && <p className="mt-0.5 text-slate-600">{r.body}</p>}
                {r.reply && (
                  <p className="mt-1.5 rounded-lg bg-white p-2 text-slate-800 ring-1 ring-slate-200">
                    <span className="block text-xs font-semibold text-slate-500">
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
