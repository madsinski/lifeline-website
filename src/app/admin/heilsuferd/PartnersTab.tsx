"use client";

// Samstarfsaðilar — the therapists at Vera heilsusetur the workstation can
// contact on a client's behalf (psychologist, nutritionist, physiotherapist).
//
// The workstation only ever sees name, profession and organisation; the
// email lives here and is used server-side when a nurse sends a contact
// request. A partner who leaves is deactivated, not deleted, so past
// contacts still say who they went to.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { adminJson } from "../hc-api";

interface Partner {
  id: string; name: string; profession: "physio" | "psychologist" | "nutritionist";
  organization: string; email: string; phone: string | null; note: string | null; active: boolean;
}

const PROF_IS: Record<Partner["profession"], string> = {
  psychologist: "Sálfræðingur", nutritionist: "Næringarfræðingur", physio: "Sjúkraþjálfari",
};
const blank = { name: "", profession: "psychologist" as Partner["profession"], email: "", phone: "", organization: "Vera heilsusetur", note: "" };
const input = "min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm";

export default function PartnersTab() {
  const [rows, setRows] = useState<Partner[] | null>(null);
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await adminJson<{ partners: Partner[] }>("/api/admin/hc/partners");
    setTimeout(() => { if (r.ok) setRows(r.data.partners); else setMsg({ ok: false, text: r.error ?? "Villa" }); }, 0);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const errText = (e?: string) => e === "mfa_required" ? "Staðfestu með tvíþættri auðkenningu (MFA) og reyndu aftur." : e ?? "Tókst ekki að vista.";

  const save = async () => {
    if (busy) return;
    setBusy("save"); setMsg(null);
    const r = await adminJson<{ partner: Partner }>("/api/admin/hc/partners", {
      method: editing ? "PATCH" : "POST",
      body: JSON.stringify(editing ? { id: editing, ...f } : f),
    });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: errText(r.error) }); return; }
    setMsg({ ok: true, text: editing ? "Breytingar vistaðar." : "Samstarfsaðila bætt við." });
    setF(blank); setEditing(null);
    void load();
  };

  const toggle = async (p: Partner) => {
    if (busy) return;
    setBusy(p.id); setMsg(null);
    const r = await adminJson("/api/admin/hc/partners", { method: "PATCH", body: JSON.stringify({ id: p.id, active: !p.active }) });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: errText(r.error) }); return; }
    void load();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-bold text-slate-900">{editing ? "Breyta samstarfsaðila" : "Nýr samstarfsaðili"}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Hjúkrunarfræðingur getur sent þessum aðila beiðni um samband fyrir hönd skjólstæðings, með samþykki hans. Tölvupósturinn inniheldur aðeins nafn, kennitölu og samskiptaupplýsingar.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="text-xs font-semibold text-slate-600">Nafn</span>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} /></label>
          <label className="text-sm"><span className="text-xs font-semibold text-slate-600">Starfsgrein</span>
            <select value={f.profession} onChange={(e) => setF({ ...f, profession: e.target.value as Partner["profession"] })} className={input}>
              {Object.entries(PROF_IS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="text-sm"><span className="text-xs font-semibold text-slate-600">Netfang</span>
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
          <label className="text-sm"><span className="text-xs font-semibold text-slate-600">Sími (valfrjálst)</span>
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
          <label className="text-sm"><span className="text-xs font-semibold text-slate-600">Vinnustaður</span>
            <input value={f.organization} onChange={(e) => setF({ ...f, organization: e.target.value })} className={input} /></label>
          <label className="text-sm"><span className="text-xs font-semibold text-slate-600">Athugasemd (valfrjálst)</span>
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={input} /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy !== null || !f.name.trim() || !f.email.trim()} onClick={() => void save()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#047857] px-5 font-semibold text-white disabled:opacity-40">
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {editing ? "Vista breytingar" : "Bæta við"}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setF(blank); }} className="min-h-11 rounded-xl px-4 font-semibold text-slate-700">Hætta við</button>
          )}
        </div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm font-semibold ${msg.ok ? "text-emerald-800" : "text-red-800"}`}>{msg.text}</p>}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-bold text-slate-900">Skráðir samstarfsaðilar</h2>
        {!rows ? <div className="mt-3 h-20 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
          : rows.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {rows.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${p.active ? "text-slate-900" : "text-slate-500 line-through"}`}>{p.name}</p>
                    <p className="text-xs text-slate-600">{PROF_IS[p.profession]} · {p.organization} · {p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => { setEditing(p.id); setF({ name: p.name, profession: p.profession, email: p.email, phone: p.phone ?? "", organization: p.organization, note: p.note ?? "" }); }}
                    className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">Breyta</button>
                  <button type="button" disabled={busy !== null} onClick={() => void toggle(p)}
                    className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold disabled:opacity-40">
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : p.active ? "Gera óvirkan" : "Gera virkan"}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate-600">Enginn skráður enn. Bættu við meðferðaraðilum Vera heilsuseturs hér að ofan.</p>}
      </section>
    </div>
  );
}
