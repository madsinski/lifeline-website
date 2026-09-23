"use client";

// "Tillaga út frá niðurstöðum" — the results, traffic-lit, and a proposed plan.
//
// The traffic lights come from Lifeline's reference bands on the server; the
// model only proposes which actions to put in front of this client. The nurse
// picks a preset (Létt / Kjarni / Allt), adjusts the ticks, drops it into the
// plan and then drags the actions around as usual.

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
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

  const run = async () => {
    setBusy(true); setMsg("");
    const r = await api(`/api/vinnustod/journeys/${journeyId}/analyze`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Tillagan mistókst."); return; }
    setFlagged(j.flagged ?? []);
    setProposal(j.proposal);
    preset("core", j.proposal);
  };

  const preset = (key: (typeof PRESETS)[number]["key"], p: Proposal | null = proposal) => {
    if (!p) return;
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

      {flagged && flagged.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {flagged.map((f) => (
            <li key={f.slug} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${SIGNAL_RING[f.signal]}`}>
              <span className={`h-2 w-2 rounded-full ${SIGNAL_DOT[f.signal]}`} aria-hidden />
              {f.title} {String(f.value).replace(".", ",")}{f.unit ? ` ${f.unit}` : ""}
            </li>
          ))}
        </ul>
      )}

      {proposal && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl bg-white p-3">
            <p className="font-semibold text-slate-900">{proposal.headline}</p>
            <p className="mt-0.5 text-sm text-slate-600">{proposal.summary}</p>
            {proposal.focus.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {proposal.focus.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: PILLAR_META[f.pillar].color }} aria-hidden />
                    <span><span className="font-semibold text-slate-800">{PILLAR_META[f.pillar].label}:</span> <span className="text-slate-600">{f.why}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Umfang</span>
            {PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => preset(p.key)} title={p.hint}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {p.label}
              </button>
            ))}
            <span className="text-xs text-slate-500">{chosen.length} valin</span>
          </div>

          <ul className="space-y-1.5">
            {proposal.actions.map((a, i) => {
              const meta = PILLAR_META[a.pillar];
              return (
                <li key={i} className="flex items-start gap-2 rounded-xl bg-white p-2.5">
                  <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked({ ...picked, [i]: e.target.checked })}
                    aria-label={`Taka með: ${a.title}`} className="mt-1 h-4 w-4 accent-emerald-600" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold text-slate-900">{a.title}</span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: meta.soft, color: meta.color }}>{meta.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{TIER_IS[a.tier]}</span>
                      {a.frequency && <span className="text-xs text-slate-500">{a.frequency}</span>}
                      {!a.module_key && <span className="text-[11px] text-slate-400">ný aðgerð</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-600">{a.detail}</span>
                    {a.why && <span className="mt-0.5 block text-xs italic text-slate-500">{a.why}</span>}
                  </span>
                </li>
              );
            })}
          </ul>

          <button type="button" disabled={!chosen.length}
            onClick={() => onApply(chosen, proposal.headline, proposal.summary)}
            className="inline-flex min-h-10 items-center rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-40">
            Setja {chosen.length} aðgerðir í áætlunina
          </button>
          <p className="text-xs text-slate-500">
            Þú getur dregið aðgerðir til, breytt þeim og bætt við úr safninu eftir að tillagan er sett inn.
          </p>
        </div>
      )}
    </section>
  );
}
