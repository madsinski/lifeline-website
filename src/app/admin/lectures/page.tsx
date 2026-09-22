"use client";

// Fræðsla — CMS for the welcome lecture and the short lecture series shown in
// the customer's heilsuferð. Each lecture is a video (YouTube/Vimeo link or
// uploaded mp4), a slide presentation, or an article (simple markdown).

import { useCallback, useEffect, useState } from "react";
import { useStaffGuard } from "@/lib/useStaffGuard";
import { adminApi, adminJson } from "../hc-api";
import type { HcLecture, LectureSlide } from "@/lib/hc/types";

type Row = HcLecture & { completions: number };
const EMPTY: Partial<Row> = { title: "", subtitle: "", kind: "article", video_url: "", slides: [], article_md: "", duration_min: 5, pillar: "general", is_welcome: false, sort: 100, published: false };
const PILLARS: Record<string, string> = { general: "Almennt", sleep: "Svefn", exercise: "Hreyfing", nutrition: "Næring", mental: "Andleg líðan" };
const KINDS: Record<string, string> = { video: "Myndband", slides: "Glærur", article: "Grein" };

export default function LecturesAdmin() {
  const { authorized, loading } = useStaffGuard();
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await adminJson<{ lectures: Row[] }>("/api/admin/hc/lectures");
    if (r.ok) setRows(r.data.lectures);
  }, []);
  useEffect(() => {
    if (!authorized) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [authorized, load]);

  const save = async () => {
    if (!edit) return;
    setBusy(true); setMsg(null);
    const r = await adminJson<{ lecture: Row }>("/api/admin/hc/lectures", { method: "POST", body: JSON.stringify(edit) });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error || "Villa" }); return; }
    setEdit(r.data.lecture);
    setMsg({ ok: true, text: "Vistað." });
    await load();
  };
  const remove = async () => {
    if (!edit?.id || !confirm("Eyða fyrirlestri?")) return;
    await adminApi(`/api/admin/hc/lectures?id=${edit.id}`, { method: "DELETE" });
    setEdit(null);
    await load();
  };
  const upload = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.set("file", file);
    const r = await adminApi("/api/admin/hc/lectures/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ ok: false, text: j.error || "Upphleðsla mistókst." }); return null; }
    return j.url as string;
  };

  if (loading) return <div className="p-8 text-slate-500">Hleð…</div>;
  if (!authorized) return <div className="p-8 text-slate-500">Aðgangur ekki leyfður.</div>;

  const slides: LectureSlide[] = edit?.slides ?? [];
  const setSlides = (s: LectureSlide[]) => setEdit({ ...edit!, slides: s });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Fræðsla</h1>
          <p className="text-sm text-slate-500">Móttökufyrirlestur og fyrirlestraröð í heilsuferð viðskiptavina.</p>
        </div>
        <button onClick={() => { setEdit({ ...EMPTY }); setMsg(null); }} className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-white">Nýr fyrirlestur</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <ul className="space-y-2">
          {rows.map((l) => (
            <li key={l.id}>
              <button onClick={() => { setEdit(l); setMsg(null); }}
                className={`w-full rounded-xl border bg-white p-3 text-left ${edit?.id === l.id ? "border-[#10B981]" : "border-slate-200"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{l.sort}</span>
                  <span className="flex-1 truncate font-semibold text-slate-800">{l.title}</span>
                  {l.is_welcome && <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800">MÓTTAKA</span>}
                </div>
                <p className="text-xs text-slate-500">{KINDS[l.kind]} · {PILLARS[l.pillar ?? "general"]} · {l.published ? "Birt" : "Drög"} · {l.completions} lokið</p>
              </button>
            </li>
          ))}
        </ul>

        {edit ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2"><span className="text-slate-600">Titill</span>
                <input value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm sm:col-span-2"><span className="text-slate-600">Undirtitill</span>
                <input value={edit.subtitle ?? ""} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm"><span className="text-slate-600">Tegund</span>
                <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as HcLecture["kind"] })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
              <label className="text-sm"><span className="text-slate-600">Stoð</span>
                <select value={edit.pillar ?? "general"} onChange={(e) => setEdit({ ...edit, pillar: e.target.value as HcLecture["pillar"] })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  {Object.entries(PILLARS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
              <label className="text-sm"><span className="text-slate-600">Lengd (mín.)</span>
                <input type="number" value={edit.duration_min ?? ""} onChange={(e) => setEdit({ ...edit, duration_min: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm"><span className="text-slate-600">Röð</span>
                <input type="number" value={edit.sort ?? 0} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            </div>

            {edit.kind === "video" && (
              <div className="space-y-2">
                <label className="block text-sm"><span className="text-slate-600">Slóð á myndband (YouTube, Vimeo eða mp4)</span>
                  <input value={edit.video_url ?? ""} onChange={(e) => setEdit({ ...edit, video_url: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
                <label className="block text-xs text-slate-500">…eða hlaða upp mp4:
                  <input type="file" accept="video/mp4,video/webm" className="ml-2" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const u = await upload(f); if (u) setEdit({ ...edit, video_url: u }); } }} /></label>
              </div>
            )}

            {edit.kind === "slides" && (
              <div className="space-y-3">
                {slides.map((s, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                      <input value={s.title} onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Fyrirsögn glæru" className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold" />
                      <button disabled={i === 0} onClick={() => { const c = [...slides]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; setSlides(c); }} className="text-slate-400 disabled:opacity-30" aria-label="Upp">↑</button>
                      <button disabled={i === slides.length - 1} onClick={() => { const c = [...slides]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; setSlides(c); }} className="text-slate-400 disabled:opacity-30" aria-label="Niður">↓</button>
                      <button onClick={() => setSlides(slides.filter((_, j) => j !== i))} className="text-red-500" aria-label="Eyða glæru">×</button>
                    </div>
                    <textarea value={s.body} onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} rows={3} placeholder="Texti" className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      {s.image_url ? <span className="truncate">Mynd: {s.image_url.split("/").pop()}</span> : <span>Engin mynd</span>}
                      <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const u = await upload(f); if (u) setSlides(slides.map((x, j) => (j === i ? { ...x, image_url: u } : x))); } }} />
                    </div>
                  </div>
                ))}
                <button onClick={() => setSlides([...slides, { title: "", body: "" }])} className="text-sm font-semibold text-emerald-700">+ Bæta við glæru</button>
              </div>
            )}

            <label className="block text-sm">
              <span className="text-slate-600">{edit.kind === "article" ? "Grein" : "Texti undir (valfrjálst)"} · ## fyrirsögn, - listi, **feitt**</span>
              <textarea value={edit.article_md ?? ""} onChange={(e) => setEdit({ ...edit, article_md: e.target.value })} rows={edit.kind === "article" ? 14 : 5} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
            </label>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} /> Birt</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!edit.is_welcome} onChange={(e) => setEdit({ ...edit, is_welcome: e.target.checked })} /> Móttökufyrirlestur (skref 3 í heilsuferð)</label>
            </div>
            {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
            <div className="flex items-center gap-3">
              <button onClick={save} disabled={busy} className="rounded-lg bg-[#10B981] px-5 py-2.5 font-semibold text-white disabled:opacity-50">Vista</button>
              {edit.slug && edit.published && <a href={`/account/heilsuferd/fraedsla/${edit.slug}`} target="_blank" rel="noreferrer" className="text-sm text-slate-600 underline">Skoða</a>}
              <span className="flex-1" />
              {edit.id && <button onClick={remove} className="text-sm text-red-600">Eyða</button>}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">Veldu fyrirlestur eða búðu til nýjan.</div>
        )}
      </div>
    </div>
  );
}
