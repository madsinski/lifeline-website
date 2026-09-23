"use client";

// "Tillaga út frá niðurstöðum" — the results, traffic-lit, and a proposed plan.
//
// The traffic lights come from Lifeline's reference bands on the server; the
// model only proposes which actions to put in front of this client. The nurse
// picks a preset (Létt / Kjarni / Allt), adjusts the ticks, drops it into the
// plan and then drags the actions around as usual.

import { useState } from "react";
import { ArrowRight, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { PILLAR_META, type Pillar } from "@/lib/hc/types";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

type Signal = "green" | "yellow" | "red";
interface Flagged { slug: string; title: string; value: number; unit: string | null; band: string | null; signal: Signal }
export interface ProposedAction {
  module_key: string | null;
  title: string;
  pillar: Pillar;
  frequency: string;
  detail: string;
  tier: "core" | "standard" | "extra";
  why: string;
}
interface Proposal {
  headline: string;
  summary: string;
  focus: { pillar: Pillar; why: string }[];
  actions: ProposedAction[];
}

const SIGNAL_DOT: Record<Signal, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" };
const SIGNAL_RING: Record<Signal, string> = {
  green: "ring-emerald-200 bg-emerald-50 text-emerald-900",
  yellow: "ring-amber-200 bg-amber-50 text-amber-900",
  red: "ring-red-200 bg-red-50 text-red-900",
};
const TIER_IS: Record<ProposedAction["tier"], string> = { core: "Kjarni", standard: "Ráðlagt", extra: "Aukalega" };
const PRESETS = [
  { key: "light", label: "Létt", hint: "Aðeins kjarninn", tiers: ["core"] },
  { key: "core", label: "Kjarni", hint: "Ráðlögð áætlun", tiers: ["core", "standard"] },
  { key: "full", label: "Allt", hint: "Allar tillögur", tiers: ["core", "standard", "extra"] },
] as const;

/** Which actions a preset ticks. Pure, so the panel can seed its own state
 *  from a proposal that was made before the component existed. */
function tierPick(p: Proposal, tiers: readonly string[]): Record<number, boolean> {
  const out: Record<number, boolean> = {};
  p.actions.forEach((a, i) => { out[i] = tiers.includes(a.tier); });
  return out;
}

export default function AiProposalPanel({ api, journeyId, ready, onApply }: {
  api: Api;
  journeyId: string;
  /** A proposal made earlier — importing a report starts one in the
   *  background, so by the time the nurse gets here it is usually waiting. */
  ready?: { proposal: Proposal; flagged: Flagged[]; at: string } | null;
  /** Hand the chosen actions to the builder, which turns them into plan items. */
  onApply: (actions: ProposedAction[], headline: string, summary: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [flagged, setFlagged] = useState<Flagged[] | null>(ready?.flagged ?? null);
  const [proposal, setProposal] = useState<Proposal | null>(ready?.proposal ?? null);
  const [picked, setPicked] = useState<Record<number, boolean>>(() =>
    ready?.proposal ? tierPick(ready.proposal, ["core", "standard"]) : {});
  const [scope, setScope] = useState<(typeof PRESETS)[number]["key"]>("core");
  // Which action's reasoning is open. One at a time: the detail is reference,
  // not something to read down a list of nine.
  const [why, setWhy] = useState<number | null>(null);

  const run = async () => {
    setBusy(true); setMsg("");
    const r = await api(`/api/vinnustod/journeys/${journeyId}/analyze`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Tillagan mistókst."); return; }
    setFlagged(j.flagged ?? []);
    setProposal(j.proposal);
    setScope("core");
    preset("core", j.proposal);
  };

  const preset = (key: (typeof PRESETS)[number]["key"], p: Proposal | null = proposal) => {
    if (!p) return;
    setScope(key);
    const tiers = PRESETS.find((x) => x.key === key)!.tiers as readonly string[];
    setPicked(Object.fromEntries(p.actions.map((a, i) => [i, tiers.includes(a.tier)])));
  };

  const chosen = proposal ? proposal.actions.filter((_, i) => picked[i]) : [];

  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-5 w-5 text-emerald-700" />
        <h3 className="font-bold text-[#0F172A]">Tillaga út frá niðurstöðum</h3>
        <span className="flex-1" />
        <button type="button" onClick={run} disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Les niðurstöður…" : proposal ? "Greina aftur" : "Greina niðurstöður"}
        </button>
      </div>
      {!proposal && (
        <p className="mt-1 text-xs text-slate-600">
          Mæligildin eru borin saman við viðmið Lifeline og tillaga að aðgerðum gerð út frá þeim. Þú velur svo hvað fer í áætlunina.
        </p>
      )}
      {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}

      {/* Reference, not a task: the values are why the proposal says what it
          says, and they are already on the report above. Folded away. */}
      {flagged && flagged.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-600">Gildin sem liggja að baki ({flagged.length})</summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {flagged.map((f) => (
              <li key={f.slug} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ring-1 ${SIGNAL_RING[f.signal]}`}>
                <span className={`h-2 w-2 rounded-full ${SIGNAL_DOT[f.signal]}`} aria-hidden />
                {f.title} {String(f.value).replace(".", ",")}{f.unit ? ` ${f.unit}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {proposal && (
        <div className="mt-3 space-y-3">
          {/* 1 ── the scope. The first real decision, so it comes first and
                  says what it means rather than needing a hover. */}
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">1. Veldu umfang</p>
            <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
              {PRESETS.map((pr) => (
                <button key={pr.key} type="button" onClick={() => preset(pr.key)}
                  aria-pressed={scope === pr.key}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                    scope === pr.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                  {pr.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">{PRESETS.find((x) => x.key === scope)?.hint}</p>
          </div>

          {/* 2 ── the actions. One line each; the reasoning opens on demand. */}
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              2. Hakaðu við það sem fer í áætlunina
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">{chosen.length} af {proposal.actions.length} valin</span>
            </p>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
              {proposal.actions.map((a, i) => {
                const meta = PILLAR_META[a.pillar];
                const open = why === i;
                return (
                  <li key={i}>
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked({ ...picked, [i]: e.target.checked })}
                        aria-label={`Taka með: ${a.title}`} className="h-4 w-4 shrink-0 accent-emerald-600" />
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden title={meta.label} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{a.title}</span>
                        <span className="block truncate text-xs text-slate-500">{a.frequency || meta.label}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{TIER_IS[a.tier]}</span>
                      <button type="button" onClick={() => setWhy(open ? null : i)} aria-expanded={open}
                        aria-label={`Af hverju: ${a.title}`}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {open && (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2">
                        <p className="text-sm text-slate-700">{a.detail}</p>
                        {a.why && <p className="mt-1 text-xs italic text-slate-500">{a.why}</p>}
                        {!a.module_key && <p className="mt-1 text-[11px] text-slate-400">Ný aðgerð — ekki úr aðgerðasafninu.</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 3 ── the only green button on the panel. */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!chosen.length}
              onClick={() => onApply(chosen, proposal.headline, proposal.summary)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-40">
              3. Setja {chosen.length} aðgerðir í áætlunina <ArrowRight className="h-4 w-4" />
            </button>
            {/* The prose the model wrote: useful once, not worth a screen. */}
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-slate-600">Forsendur tillögunnar</summary>
              <div className="mt-1.5 max-w-prose rounded-xl bg-white p-3">
                <p className="font-semibold text-slate-900">{proposal.headline}</p>
                <p className="mt-0.5 text-sm text-slate-600">{proposal.summary}</p>
                {proposal.focus.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {proposal.focus.map((f, k) => (
                      <li key={k} className="flex gap-2 text-sm">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: PILLAR_META[f.pillar].color }} aria-hidden />
                        <span><span className="font-semibold text-slate-800">{PILLAR_META[f.pillar].label}:</span> <span className="text-slate-600">{f.why}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </div>
          <p className="text-xs text-slate-500">
            Þú getur dregið aðgerðir til, breytt þeim og bætt við úr safninu eftir að tillagan er sett inn.
          </p>
        </div>
      )}
    </section>
  );
}
