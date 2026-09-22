"use client";

// Stéttarfélög — union reimbursement module.
// Per union: rules document (PDF/DOCX) → AI-extracted rules draft → human
// review → save; signed cooperation agreement on file; the contact person
// who receives members' reimbursement applications. Only unions with
// status "approved" AND a signed, unexpired agreement are offered at
// checkout (/account/heilsuferd).

import { useCallback, useEffect, useState } from "react";
import { useStaffGuard } from "@/lib/useStaffGuard";
import { adminApi, adminJson } from "../hc-api";
import { UNION_CATEGORIES, computeReimbursement, type UnionCategoryRule, type UnionRules } from "@/lib/hc/reimbursement";

interface Doc { id: string; kind: "rules" | "agreement" | "other"; title: string | null; file_name: string | null; signed_at: string | null; valid_until: string | null; created_at: string }
interface Union {
  id: string; code: string; name: string; kennitala: string | null; region: string | null; website: string | null;
  contact_name: string | null; contact_role: string | null; contact_email: string | null; contact_phone: string | null;
  settlement: "reimbursement" | "direct"; cooperation_status: "none" | "negotiating" | "approved" | "paused";
  rules: UnionRules; rules_summary: string | null; rules_verified_at: string | null; notes: string | null;
  documents: Doc[]; has_rules_doc: boolean; signed_agreement: Doc | null; listed_at_checkout: boolean; orders: number;
}

const STATUS: Record<Union["cooperation_status"], { label: string; cls: string }> = {
  none: { label: "Ekkert samstarf", cls: "bg-slate-100 text-slate-600" },
  negotiating: { label: "Í viðræðum", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Samþykkt", cls: "bg-emerald-100 text-emerald-800" },
  paused: { label: "Í bið", cls: "bg-red-100 text-red-700" },
};

export default function UnionsPage() {
  const { authorized, loading } = useStaffGuard();
  const [unions, setUnions] = useState<Union[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await adminJson<{ unions: Union[] }>("/api/admin/hc/unions");
    if (r.ok) setUnions(r.data.unions); else setErr(r.error || "");
  }, []);
  useEffect(() => {
    if (!authorized) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [authorized, load]);

  const create = async () => {
    if (!newName.trim()) return;
    const r = await adminJson<{ union: Union }>("/api/admin/hc/unions", { method: "POST", body: JSON.stringify({ name: newName }) });
    if (!r.ok) { setErr(r.error || ""); return; }
    setNewName("");
    await load();
    setSelected(r.data.union.id);
  };

  if (loading) return <div className="p-8 text-slate-500">Hleð…</div>;
  if (!authorized) return <div className="p-8 text-slate-500">Aðgangur ekki leyfður.</div>;
  const current = unions.find((u) => u.id === selected) ?? null;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Stéttarfélög</h1>
          <p className="text-sm text-slate-500">Reglur um endurgreiðslu, undirritaðir samningar og móttakendur umsókna. {unions.filter((u) => u.listed_at_checkout).length} af {unions.length} í boði í greiðsluferli.</p>
        </div>
        <div className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nafn nýs félags" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={create} className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-white">Bæta við</button>
        </div>
      </div>
      {err && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-2">
          {unions.map((u) => (
            <button key={u.id} onClick={() => setSelected(u.id)}
              className={`w-full rounded-xl border bg-white p-4 text-left transition ${selected === u.id ? "border-[#10B981] ring-2 ring-[#10B981]/20" : "border-slate-200 hover:border-slate-300"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-800">{u.name}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[u.cooperation_status].cls}`}>{STATUS[u.cooperation_status].label}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <Flag ok={u.has_rules_doc} label="Reglur" />
                <Flag ok={!!u.signed_agreement} label="Samningur" />
                <Flag ok={!!u.contact_email} label="Móttakandi" />
                <Flag ok={u.listed_at_checkout} label="Í greiðsluferli" />
                {u.orders > 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{u.orders} pantanir</span>}
              </div>
            </button>
          ))}
        </div>
        {current ? <UnionEditor key={current.id} union={current} onChanged={load} onDeleted={() => { setSelected(null); void load(); }} /> : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">Veldu félag til að skoða reglur, samninga og tengilið.</div>
        )}
      </div>
    </div>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`rounded px-1.5 py-0.5 ${ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"}`}>{ok ? "✓" : "○"} {label}</span>;
}

function UnionEditor({ union, onChanged, onDeleted }: { union: Union; onChanged: () => void; onDeleted: () => void }) {
  const [f, setF] = useState({
    name: union.name, kennitala: union.kennitala ?? "", region: union.region ?? "", website: union.website ?? "",
    contact_name: union.contact_name ?? "", contact_role: union.contact_role ?? "", contact_email: union.contact_email ?? "", contact_phone: union.contact_phone ?? "",
    rules_summary: union.rules_summary ?? "", notes: union.notes ?? "", settlement: union.settlement,
  });
  const [rules, setRules] = useState<UnionRules>(union.rules ?? {});
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testPrice, setTestPrice] = useState(49900);

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true); setMsg(null);
    const r = await adminJson("/api/admin/hc/unions/" + union.id, { method: "PUT", body: JSON.stringify({ ...f, rules, ...extra }) });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Vistað." } : { ok: false, text: r.error || "Villa" });
    if (r.ok) onChanged();
  };

  const setStatus = async (s: Union["cooperation_status"]) => {
    setBusy(true); setMsg(null);
    const r = await adminJson("/api/admin/hc/unions/" + union.id, { method: "PUT", body: JSON.stringify({ cooperation_status: s }) });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: `Staða: ${STATUS[s].label}` } : { ok: false, text: r.error || "Villa" });
    if (r.ok) onChanged();
  };

  const extract = async (docId: string) => {
    setBusy(true); setMsg({ ok: true, text: "Les reglurnar úr skjalinu… (getur tekið allt að mínútu)" });
    const r = await adminJson<{ draft: UnionRules; extraction: { summary: string; confidence: string; health_check: { source_quote: string | null } } }>(
      `/api/admin/hc/unions/${union.id}/extract`, { method: "POST", body: JSON.stringify({ document_id: docId }) });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error || "Villa" }); return; }
    setRules(r.data.draft);
    if (!f.rules_summary) setF((x) => ({ ...x, rules_summary: r.data.extraction.summary }));
    setDraftNote(`Drög úr skjali (öryggi: ${r.data.extraction.confidence}). ${r.data.extraction.health_check?.source_quote ? `Heimild: „${r.data.extraction.health_check.source_quote}“` : ""} Yfirfarðu og vistaðu.`);
    setMsg(null);
  };

  const setRule = (cat: string, key: keyof UnionCategoryRule, v: string) => {
    const cur = rules.categories?.[cat] ?? {};
    const val = key === "notes" ? v || null : v === "" ? null : Number(v);
    setRules({ ...rules, categories: { ...(rules.categories ?? {}), [cat]: { ...cur, [key]: val } } });
  };
  const removeCat = (cat: string) => {
    const c = { ...(rules.categories ?? {}) };
    delete c[cat];
    setRules({ ...rules, categories: c });
  };

  const del = async () => {
    if (!confirm(`Eyða ${union.name}?`)) return;
    const r = await adminJson("/api/admin/hc/unions/" + union.id, { method: "DELETE" });
    if (r.ok) onDeleted(); else setMsg({ ok: false, text: r.error || "Villa" });
  };

  const input = (k: keyof typeof f, label: string, type = "text") => (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-xl font-bold">{union.name}</h2>
          {(["negotiating", "approved", "paused", "none"] as const).map((s) => (
            <button key={s} disabled={busy || union.cooperation_status === s} onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${union.cooperation_status === s ? STATUS[s].cls : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {STATUS[s].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {union.listed_at_checkout
            ? "Félagið birtist viðskiptavinum í greiðsluferli."
            : "Birtist ekki í greiðsluferli fyrr en staðan er „Samþykkt“ og undirritaður samningur er skráður."}
        </p>
        {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      </div>

      <Section title="Skjöl" hint="Reglur sjóðsins og undirritaður samstarfssamningur.">
        <DocList union={union} onChanged={onChanged} onExtract={extract} busy={busy} />
      </Section>

      <Section title="Reglur um endurgreiðslu" hint="Notað til að reikna endurgreiðslu í greiðsluferli. Tómt = ekki endurgreitt.">
        {draftNote && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{draftNote}</p>}
        <div className="space-y-3">
          {UNION_CATEGORIES.map((c) => {
            const r = rules.categories?.[c.key];
            return (
              <div key={c.key} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{c.label}</p>
                  {r ? <button onClick={() => removeCat(c.key)} className="text-xs text-red-600">Fjarlægja</button>
                    : <button onClick={() => setRule(c.key, "percent", "")} className="text-xs font-semibold text-emerald-700">+ Bæta við reglu</button>}
                </div>
                {r && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-5">
                    {([["percent", "%"], ["max_isk", "Hámark kr."], ["fixed_isk", "Fastur styrkur kr."], ["period_months", "Á x mán. fresti"], ["min_membership_months", "Lágm. aðild mán."]] as [keyof UnionCategoryRule, string][]).map(([k, l]) => (
                      <label key={k} className="text-xs text-slate-600">{l}
                        <input type="number" value={(r[k] as number | null | undefined) ?? ""} onChange={(e) => setRule(c.key, k, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      </label>
                    ))}
                    <label className="text-xs text-slate-600 sm:col-span-5">Skilyrði
                      <input value={r.notes ?? ""} onChange={(e) => setRule(c.key, "notes", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    </label>
                    <p className="text-xs text-slate-500 sm:col-span-5">
                      Prófun: verð <input type="number" value={testPrice} onChange={(e) => setTestPrice(Number(e.target.value) || 0)} className="mx-1 w-24 rounded border border-slate-200 px-1" /> kr. →
                      endurgreiðsla <strong>{computeReimbursement(rules, c.key, testPrice).amountIsk.toLocaleString("is-IS")} kr.</strong>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          <label className="block text-sm"><span className="text-slate-600">Greiðslumáti</span>
            <select value={f.settlement} onChange={(e) => setF({ ...f, settlement: e.target.value as Union["settlement"] })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
              <option value="reimbursement">Endurgreiðsla: félagi greiðir og sækir um með PDF</option>
              <option value="direct">Beingreiðsla: styrkur dreginn frá og félagið rukkað (krefst samnings)</option>
            </select>
          </label>
          <label className="block text-sm"><span className="text-slate-600">Samantekt fyrir viðskiptavini</span>
            <textarea value={f.rules_summary} onChange={(e) => setF({ ...f, rules_summary: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm"><span className="text-slate-600">Hvernig sótt er um (birtist ekki viðskiptavini)</span>
            <textarea value={rules.application_notes ?? ""} onChange={(e) => setRules({ ...rules, application_notes: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>
      </Section>

      <Section title="Móttakandi umsókna" hint="Umsóknir félagsmanna (PDF) eru sendar á þetta netfang, með afriti á félagsmanninn.">
        <div className="grid gap-3 sm:grid-cols-2">
          {input("contact_name", "Nafn")}
          {input("contact_role", "Starfsheiti")}
          {input("contact_email", "Netfang", "email")}
          {input("contact_phone", "Sími")}
        </div>
      </Section>

      <Section title="Félagið" hint="">
        <div className="grid gap-3 sm:grid-cols-2">
          {input("name", "Nafn")}
          {input("kennitala", "Kennitala")}
          {input("region", "Svæði")}
          {input("website", "Vefur / reglur")}
        </div>
        <label className="mt-3 block text-sm"><span className="text-slate-600">Innri athugasemdir</span>
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </Section>

      <div className="flex items-center gap-3">
        <button onClick={() => save()} disabled={busy} className="rounded-lg bg-[#10B981] px-5 py-2.5 font-semibold text-white disabled:opacity-50">Vista</button>
        <span className="flex-1" />
        <button onClick={del} className="text-sm text-red-600">Eyða félagi</button>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold text-[#0F172A]">{title}</h3>
      {hint && <p className="mb-3 text-xs text-slate-500">{hint}</p>}
      {children}
    </section>
  );
}

function DocList({ union, onChanged, onExtract, busy }: { union: Union; onChanged: () => void; onExtract: (id: string) => void; busy: boolean }) {
  const [kind, setKind] = useState<"rules" | "agreement" | "other">("rules");
  const [file, setFile] = useState<File | null>(null);
  const [signedAt, setSignedAt] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const upload = async () => {
    if (!file) return;
    if (kind === "agreement" && !signedAt) { setErr("Skráðu undirritunardag samningsins."); return; }
    setUploading(true); setErr("");
    const fd = new FormData();
    fd.set("file", file); fd.set("kind", kind);
    if (signedAt) fd.set("signed_at", signedAt);
    if (validUntil) fd.set("valid_until", validUntil);
    if (signedBy) fd.set("signed_by_union", signedBy);
    const r = await adminApi(`/api/admin/hc/unions/${union.id}/documents`, { method: "POST", body: fd });
    setUploading(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Upphleðsla mistókst."); return; }
    setFile(null); setSignedAt(""); setValidUntil(""); setSignedBy("");
    onChanged();
  };
  const open = async (id: string) => {
    const r = await adminJson<{ url: string | null }>(`/api/admin/hc/unions/${union.id}/documents?doc=${id}`);
    if (r.data.url) window.open(r.data.url, "_blank");
  };
  const remove = async (id: string) => {
    if (!confirm("Eyða skjali?")) return;
    await adminApi(`/api/admin/hc/unions/${union.id}/documents?doc=${id}`, { method: "DELETE" });
    onChanged();
  };
  const KIND: Record<Doc["kind"], string> = { rules: "Reglur", agreement: "Samningur", other: "Annað" };

  return (
    <div>
      <ul className="space-y-2">
        {union.documents.length === 0 && <li className="text-sm text-slate-400">Engin skjöl.</li>}
        {union.documents.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${d.kind === "agreement" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{KIND[d.kind]}</span>
            <button onClick={() => open(d.id)} className="flex-1 truncate text-left font-medium text-slate-800 hover:underline">{d.title || d.file_name}</button>
            {d.kind === "agreement" && <span className="text-xs text-slate-500">{d.signed_at ? `Undirritaður ${d.signed_at}` : "Óundirritaður"}{d.valid_until ? ` · gildir til ${d.valid_until}` : ""}</span>}
            {d.kind === "rules" && <button disabled={busy} onClick={() => onExtract(d.id)} className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">Lesa reglur með gervigreind</button>}
            <button onClick={() => remove(d.id)} className="text-xs text-red-600">Eyða</button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 sm:grid-cols-[140px_1fr]">
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
          <option value="rules">Reglur (PDF/DOCX)</option>
          <option value="agreement">Undirritaður samningur</option>
          <option value="other">Annað</option>
        </select>
        <input type="file" accept=".pdf,.docx,.txt,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        {kind === "agreement" && (
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
            <label className="text-xs text-slate-600">Undirritaður<input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" /></label>
            <label className="text-xs text-slate-600">Gildir til (valfrjálst)<input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" /></label>
            <label className="text-xs text-slate-600">Undirritað af hálfu félags<input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" /></label>
          </div>
        )}
        {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
        <button onClick={upload} disabled={!file || uploading} className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 sm:col-span-2">{uploading ? "Hleð upp…" : "Hlaða upp"}</button>
      </div>
    </div>
  );
}
