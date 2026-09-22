"use client";

// Aðgerðaáætlanir — the library behind every action plan: scenario
// templates (most common cases), action modules per pillar, exercise
// templates and nutrition templates. Plus the list of clients whose plan is
// due or in progress. Nurses pick from this library in /vinnustod.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useStaffGuard } from "@/lib/useStaffGuard";
import AdminTabs from "../../components/AdminTabs";
import { adminApi, adminJson } from "../../hc-api";
import {
  PILLARS, PILLAR_META,
  type ExercisePhase, type ExerciseTemplate, type NutritionTemplate, type Pillar, type PlanModule, type PlanTemplate,
} from "@/lib/hc/types";
import { STAGE_LABELS } from "@/lib/hc/stages";
import ExerciseSessionsEditor from "../../../components/hc/ExerciseSessionsEditor";

const TABS = [
  { key: "clients", label: "Skjólstæðingar" },
  { key: "templates", label: "Sniðmát" },
  { key: "modules", label: "Aðgerðir" },
  { key: "exercise", label: "Æfingaplön" },
  { key: "nutrition", label: "Næring" },
];

export default function PlansAdmin() {
  const { authorized, loading } = useStaffGuard();
  const [tab, setTab] = useState("clients");
  if (loading) return <div className="p-8 text-slate-500">Hleð…</div>;
  if (!authorized) return <div className="p-8 text-slate-500">Aðgangur ekki leyfður.</div>;
  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/admin/coach" className="text-sm text-slate-500 hover:text-slate-800">← Coach</Link>
        <h1 className="mt-1 text-2xl font-bold text-[#0F172A]">Aðgerðaáætlanir</h1>
        <p className="text-sm text-slate-500">Tilbúin sniðmát fyrir algengustu tilvikin. Hjúkrunarfræðingar draga aðgerðir inn og út og bæta við athugasemdum.</p>
      </div>
      <AdminTabs tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-6">
        {tab === "clients" && <Clients />}
        {tab === "templates" && <Templates />}
        {tab === "modules" && <Modules />}
        {tab === "exercise" && <Exercise />}
        {tab === "nutrition" && <Nutrition />}
      </div>
    </div>
  );
}

function useRows<T>(kind: string) {
  const [rows, setRows] = useState<T[]>([]);
  const load = useCallback(async () => {
    const r = await adminJson<{ rows: T[] }>(`/api/admin/hc/library/${kind}`);
    if (r.ok) setRows(r.data.rows);
  }, [kind]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);
  const save = async (row: Partial<T>) => {
    const r = await adminJson(`/api/admin/hc/library/${kind}`, { method: "POST", body: JSON.stringify(row) });
    if (r.ok) await load();
    return r;
  };
  const remove = async (key: string) => {
    if (!confirm("Taka úr notkun?")) return;
    await adminApi(`/api/admin/hc/library/${kind}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    await load();
  };
  return { rows, save, remove };
}

// ── Clients ────────────────────────────────────────────────────────────────

function Clients() {
  const [rows, setRows] = useState<{ id: string; client_name: string | null; stage: string; updated_at: string }[]>([]);
  useEffect(() => {
    adminJson<{ journeys: typeof rows }>("/api/admin/hc/overview").then((r) => {
      if (r.ok) setRows(r.data.journeys.filter((j) => ["interview", "plan", "action"].includes(j.stage)));
    });
  }, []);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Nafn</th><th className="px-4 py-2">Staða</th><th className="px-4 py-2">Uppfært</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Enginn bíður áætlunar.</td></tr>}
          {rows.map((j) => (
            <tr key={j.id} className="border-t border-slate-100">
              <td className="px-4 py-2 font-medium">{j.client_name || "—"}</td>
              <td className="px-4 py-2">{STAGE_LABELS[j.stage] ?? j.stage}</td>
              <td className="px-4 py-2 text-slate-500">{new Date(j.updated_at).toLocaleDateString("is-IS")}</td>
              <td className="px-4 py-2 text-right"><Link href={`/admin/coach/plans/${j.id}`} className="font-semibold text-emerald-700 hover:underline">Opna áætlun →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Modules ────────────────────────────────────────────────────────────────

function Modules() {
  const { rows, save, remove } = useRows<PlanModule>("modules");
  const [edit, setEdit] = useState<Partial<PlanModule> | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="grid gap-4 md:grid-cols-2">
        {PILLARS.map((p) => (
          <div key={p} className="rounded-2xl border bg-white p-4" style={{ borderColor: PILLAR_META[p].ring }}>
            <h3 className="mb-2 font-bold" style={{ color: PILLAR_META[p].color }}>{PILLAR_META[p].label}</h3>
            <ul className="space-y-1">
              {rows.filter((m) => m.pillar === p).map((m) => (
                <li key={m.key} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 ${m.active ? "" : "opacity-40"}`}>
                  <button onClick={() => setEdit(m)} className="flex-1 text-left"><span className="font-medium">{m.title}</span> <span className="text-slate-400">{m.frequency}</span></button>
                </li>
              ))}
            </ul>
            <button onClick={() => setEdit({ pillar: p, active: true, tags: [] })} className="mt-2 text-xs font-semibold text-slate-500">+ Ný aðgerð</button>
          </div>
        ))}
      </div>
      {edit && (
        <div className="h-fit space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <select value={edit.pillar} onChange={(e) => setEdit({ ...edit, pillar: e.target.value as Pillar })} className="w-full rounded-lg border border-slate-300 px-2 py-2">
            {PILLARS.map((p) => <option key={p} value={p}>{PILLAR_META[p].label}</option>)}
          </select>
          <input value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Heiti" className="w-full rounded-lg border border-slate-300 px-2 py-2 font-semibold" />
          <input value={edit.summary ?? ""} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} placeholder="Stutt lýsing (birtist á yfirliti)" className="w-full rounded-lg border border-slate-300 px-2 py-2" />
          <textarea value={edit.details ?? ""} onChange={(e) => setEdit({ ...edit, details: e.target.value })} rows={4} placeholder="Nánari útskýring (í fellilista)" className="w-full rounded-lg border border-slate-300 px-2 py-2" />
          <input value={edit.frequency ?? ""} onChange={(e) => setEdit({ ...edit, frequency: e.target.value })} placeholder="Tíðni, t.d. Daglega" className="w-full rounded-lg border border-slate-300 px-2 py-2" />
          <input value={(edit.tags ?? []).join(", ")} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="Merki, t.d. streita, svefnvandi" className="w-full rounded-lg border border-slate-300 px-2 py-2" />
          <div className="flex items-center gap-2">
            <button onClick={async () => { const r = await save({ ...edit, name: edit.title } as Partial<PlanModule>); setMsg(r.ok ? "Vistað" : r.error || "Villa"); }} className="rounded-lg bg-[#10B981] px-4 py-2 font-semibold text-white">Vista</button>
            {edit.key && <button onClick={() => { void remove(edit.key!); setEdit(null); }} className="text-red-600">Taka úr notkun</button>}
            <span className="text-xs text-slate-500">{msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scenario templates ─────────────────────────────────────────────────────

function Templates() {
  const { rows, save, remove } = useRows<PlanTemplate>("templates");
  const mods = useRows<PlanModule>("modules").rows;
  const ex = useRows<ExerciseTemplate>("exercise").rows;
  const nu = useRows<NutritionTemplate>("nutrition").rows;
  const [edit, setEdit] = useState<Partial<PlanTemplate> | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((t) => (
          <button key={t.key} onClick={() => setEdit(t)} className={`rounded-2xl border bg-white p-4 text-left ${t.active ? "" : "opacity-40"} ${edit?.key === t.key ? "border-[#10B981]" : "border-slate-200"}`}>
            <p className="font-bold">{t.name}</p>
            <p className="text-xs text-slate-500">{t.scenario}</p>
            <p className="mt-2 text-xs text-slate-600">{t.module_keys.length} aðgerðir · {ex.find((e) => e.key === t.exercise_template_key)?.name ?? "engin æfingaáætlun"} · {nu.find((n) => n.key === t.nutrition_template_key)?.name ?? "engin næring"}</p>
          </button>
        ))}
        <button onClick={() => setEdit({ module_keys: [], focus_pillars: [], active: true })} className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">+ Nýtt sniðmát</button>
      </div>
      {edit && (
        <div className="h-fit space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Heiti sniðmáts" className="w-full rounded-lg border border-slate-300 px-2 py-2 font-semibold" />
          <input value={edit.scenario ?? ""} onChange={(e) => setEdit({ ...edit, scenario: e.target.value })} placeholder="Hvenær á það við?" className="w-full rounded-lg border border-slate-300 px-2 py-2" />
          <textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={2} placeholder="Lýsing" className="w-full rounded-lg border border-slate-300 px-2 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <select value={edit.exercise_template_key ?? ""} onChange={(e) => setEdit({ ...edit, exercise_template_key: e.target.value || null })} className="rounded-lg border border-slate-300 px-2 py-2">
              <option value="">Engin æfingaáætlun</option>{ex.filter((e) => e.active).map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}
            </select>
            <select value={edit.nutrition_template_key ?? ""} onChange={(e) => setEdit({ ...edit, nutrition_template_key: e.target.value || null })} className="rounded-lg border border-slate-300 px-2 py-2">
              <option value="">Engin næring</option>{nu.filter((n) => n.active).map((n) => <option key={n.key} value={n.key}>{n.name}</option>)}
            </select>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-100 p-2">
            {PILLARS.map((p) => (
              <div key={p}>
                <p className="text-xs font-bold" style={{ color: PILLAR_META[p].color }}>{PILLAR_META[p].label}</p>
                {mods.filter((m) => m.pillar === p && m.active).map((m) => (
                  <label key={m.key} className="flex items-center gap-2 py-0.5">
                    <input type="checkbox" checked={(edit.module_keys ?? []).includes(m.key)}
                      onChange={(e) => setEdit({ ...edit, module_keys: e.target.checked ? [...(edit.module_keys ?? []), m.key] : (edit.module_keys ?? []).filter((k) => k !== m.key) })} />
                    {m.title}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async () => { const r = await save(edit); setMsg(r.ok ? "Vistað" : r.error || "Villa"); }} className="rounded-lg bg-[#10B981] px-4 py-2 font-semibold text-white">Vista</button>
            {edit.key && <button onClick={() => { void remove(edit.key!); setEdit(null); }} className="text-red-600">Taka úr notkun</button>}
            <span className="text-xs text-slate-500">{msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Exercise templates ─────────────────────────────────────────────────────

const LEVELS = { beginner: "Byrjandi", intermediate: "Miðlungs", advanced: "Lengra komin" } as const;

function Exercise() {
  const { rows, save, remove } = useRows<ExerciseTemplate>("exercise");
  const [edit, setEdit] = useState<Partial<ExerciseTemplate> | null>(null);
  const [msg, setMsg] = useState("");
  const sessions = edit?.sessions ?? [];
  const setSessions = (s: ExerciseTemplate["sessions"]) => setEdit({ ...edit!, sessions: s });
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        {rows.map((e) => (
          <button key={e.key} onClick={() => setEdit(e)} className={`w-full rounded-xl border bg-white p-3 text-left ${e.active ? "" : "opacity-40"} ${edit?.key === e.key ? "border-[#10B981]" : "border-slate-200"}`}>
            <p className="font-semibold">{e.name}</p>
            <p className="text-xs text-slate-500">{LEVELS[e.level]} · {e.days_per_week} dagar · {e.goal}</p>
          </button>
        ))}
        <button onClick={() => setEdit({ level: "beginner", days_per_week: 3, sessions: [], active: true })} className="w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500">+ Nýtt æfingaplan</button>
      </div>
      {edit && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-4">
            <input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Heiti" className="rounded-lg border border-slate-300 px-2 py-2 font-semibold sm:col-span-2" />
            <select value={edit.level} onChange={(e) => setEdit({ ...edit, level: e.target.value as ExerciseTemplate["level"] })} className="rounded-lg border border-slate-300 px-2 py-2">
              {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" value={edit.session_minutes ?? ""} onChange={(e) => setEdit({ ...edit, session_minutes: Number(e.target.value) || null })} placeholder="Mín. á æfingu" className="rounded-lg border border-slate-300 px-2 py-2" />
            <input value={edit.goal ?? ""} onChange={(e) => setEdit({ ...edit, goal: e.target.value })} placeholder="Markmið" className="rounded-lg border border-slate-300 px-2 py-2 sm:col-span-4" />
            <textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={2} placeholder="Lýsing" className="rounded-lg border border-slate-300 px-2 py-2 sm:col-span-4" />
          </div>
          <ExerciseSessionsEditor api={adminApi} sessions={sessions} onChange={setSessions} />
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">Af hverju þetta virkar (ein regla á línu)
              <textarea value={(edit.principles ?? []).join("\n")} rows={5}
                onChange={(e) => setEdit({ ...edit, principles: e.target.value.split("\n") })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal" />
            </label>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Stigvaxandi álag á 12 vikum</p>
              {(edit.progression?.length ? edit.progression : [{ weeks: "", title: "", text: "" }]).map((ph, i, arr) => {
                const setPh = (patch: Partial<ExercisePhase>) => setEdit({ ...edit, progression: arr.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} className="grid grid-cols-[80px_1fr_auto] gap-1.5">
                    <input value={ph.weeks} onChange={(e) => setPh({ weeks: e.target.value })} placeholder="Vika 1–4" aria-label="Vikur" className="rounded border border-slate-200 px-2 py-1" />
                    <input value={ph.title} onChange={(e) => setPh({ title: e.target.value })} placeholder="Heiti tímabils" aria-label="Heiti tímabils" className="rounded border border-slate-200 px-2 py-1 font-semibold" />
                    <button type="button" onClick={() => setEdit({ ...edit, progression: arr.filter((_, j) => j !== i) })} className="px-1 text-slate-400" aria-label="Eyða tímabili">×</button>
                    <textarea value={ph.text} onChange={(e) => setPh({ text: e.target.value })} rows={2} placeholder="Hvað breytist?" aria-label="Lýsing tímabils" className="col-span-3 rounded border border-slate-200 px-2 py-1" />
                  </div>
                );
              })}
              <button type="button" onClick={() => setEdit({ ...edit, progression: [...(edit.progression ?? []), { weeks: "", title: "", text: "" }] })} className="text-xs font-semibold text-orange-700">+ Tímabil</button>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            <button onClick={async () => { const r = await save({ ...edit, days_per_week: sessions.length || edit.days_per_week }); setMsg(r.ok ? "Vistað" : r.error || "Villa"); }} className="rounded-lg bg-[#10B981] px-4 py-2 font-semibold text-white">Vista</button>
            {edit.key && <button onClick={() => { void remove(edit.key!); setEdit(null); }} className="text-red-600">Taka úr notkun</button>}
            <span className="text-xs text-slate-500">{msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Nutrition templates ────────────────────────────────────────────────────

function Nutrition() {
  const { rows, save, remove } = useRows<NutritionTemplate>("nutrition");
  const [edit, setEdit] = useState<Partial<NutritionTemplate> | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        {rows.map((n) => (
          <button key={n.key} onClick={() => setEdit(n)} className={`w-full rounded-xl border bg-white p-3 text-left ${n.active ? "" : "opacity-40"} ${edit?.key === n.key ? "border-[#10B981]" : "border-slate-200"}`}>
            <p className="font-semibold">{n.name}</p><p className="text-xs text-slate-500">{n.goal}</p>
          </button>
        ))}
        <button onClick={() => setEdit({ principles: [], day_example: [], active: true })} className="w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500">+ Nýtt sniðmát</button>
      </div>
      {edit && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Heiti" className="w-full rounded-lg border border-slate-300 px-2 py-2 font-semibold" />
          <input value={edit.goal ?? ""} onChange={(e) => setEdit({ ...edit, goal: e.target.value })} placeholder="Markmið" className="w-full rounded-lg border border-slate-300 px-2 py-2" />
          <textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={2} placeholder="Lýsing" className="w-full rounded-lg border border-slate-300 px-2 py-2" />
          <label className="block text-xs text-slate-600">Meginreglur (ein lína á reglu)
            <textarea value={(edit.principles ?? []).join("\n")} onChange={(e) => setEdit({ ...edit, principles: e.target.value.split("\n") })} rows={5} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          </label>
          <label className="block text-xs text-slate-600">Dæmi um dag (máltíð: dæmi, ein lína á máltíð)
            <textarea
              value={(edit.day_example ?? []).map((d) => `${d.meal}: ${d.example}`).join("\n")}
              onChange={(e) => setEdit({ ...edit, day_example: e.target.value.split("\n").map((l) => { const i = l.indexOf(":"); return i < 0 ? { meal: l, example: "" } : { meal: l.slice(0, i).trim(), example: l.slice(i + 1).trim() }; }) })}
              rows={5} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          </label>
          <div className="flex items-center gap-2">
            <button onClick={async () => { const r = await save({ ...edit, principles: (edit.principles ?? []).map((p) => p.trim()).filter(Boolean) }); setMsg(r.ok ? "Vistað" : r.error || "Villa"); }} className="rounded-lg bg-[#10B981] px-4 py-2 font-semibold text-white">Vista</button>
            {edit.key && <button onClick={() => { void remove(edit.key!); setEdit(null); }} className="text-red-600">Taka úr notkun</button>}
            <span className="text-xs text-slate-500">{msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
