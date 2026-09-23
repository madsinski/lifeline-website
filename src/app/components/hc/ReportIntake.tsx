"use client";

// Step 1 of the nurse's day: drop the report in.
//
// The file is read, the person on it is found (or created), and the
// workspace opens with the values already recorded. The document itself is
// never stored — only the values, after the nurse has looked at them.

import { useRef, useState } from "react";
import { FileUp, Loader2, UserPlus, Check } from "lucide-react";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Identity { name: string | null; kennitala: string | null; kennitala_last4: string | null }
interface Match { client_id: string; full_name: string | null; email: string | null; kennitala_last4: string | null; journey_id: string | null; confident: boolean }
interface Value { slug: string | null; code: string; label: string; value: number; unit: string; confidence: "high" | "medium" | "low"; converted_from?: string }

export default function ReportIntake({ api, onOpen }: {
  api: Api;
  /** Open the client's workspace once the report has landed. */
  onOpen: (journeyId: string) => void;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<{ identity: Identity; report: { date_iso: string | null }; values: Value[]; warnings: string[]; matches: Match[] } | null>(null);
  const [take, setTake] = useState<Record<number, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", kennitala: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const read = async (files: FileList | File[]) => {
    setBusy(true); setMsg(""); setResult(null);
    const fd = new FormData();
    for (const f of Array.from(files).slice(0, 8)) fd.append("files", f);
    const r = await api("/api/vinnustod/intake", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Lesturinn mistókst."); return; }
    setResult(j);
    setTake(Object.fromEntries((j.values as Value[]).map((v, i) => [i, v.confidence !== "low"])));
    setForm({
      full_name: j.identity?.name ?? "",
      email: "",
      phone: "",
      kennitala: j.identity?.kennitala ?? "",
    });
    setCreating(!j.matches?.length);
  };

  const commit = async (clientId: string | null) => {
    if (!result) return;
    setBusy(true); setMsg("");
    const values = result.values.filter((_, i) => take[i]).map((v) => ({
      marker: v.slug ?? `x:${v.code}`, value: v.value, unit: v.unit, note: v.slug ? null : v.label,
    }));
    const r = await api("/api/vinnustod/intake/commit", {
      method: "POST",
      body: JSON.stringify({
        client_id: clientId,
        create: clientId ? undefined : form,
        values,
        measured_at: result.report?.date_iso ?? null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Tókst ekki að opna skjólstæðing."); return; }
    setResult(null);
    onOpen(j.journey_id);
  };

  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) void read(e.dataTransfer.files); }}
      className={`rounded-3xl border-2 border-dashed p-5 transition ${over ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white"}`}
    >
      {!result && (
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900">{busy ? "Les skýrsluna…" : "Dragðu heilsufarsskýrslu hingað"}</p>
            <p className="text-sm text-slate-500">
              PDF frá Medalia, blóðprufusvar eða myndir af þeim. Við finnum skjólstæðinginn — eða stofnum hann — og opnum vinnusvæðið hans.
            </p>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) void read(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            Velja skrá
          </button>
        </div>
      )}

      {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-slate-900">
              {result.identity.name || "Nafn fannst ekki í skýrslunni"}
              {result.identity.kennitala_last4 && <span className="ml-2 font-normal text-slate-500">···{result.identity.kennitala_last4}</span>}
            </p>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {result.values.length} gildi{result.report?.date_iso ? ` · ${result.report.date_iso}` : ""}
            </span>
            <span className="flex-1" />
            <button type="button" onClick={() => setResult(null)} className="text-sm font-semibold text-slate-500 hover:underline">Hætta við</button>
          </div>

          {/* Who is this? */}
          {result.matches.length > 0 && !creating && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Er þetta sami skjólstæðingur?</p>
              <ul className="space-y-1.5">
                {result.matches.map((m) => (
                  <li key={m.client_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-900">
                        {m.full_name}
                        {m.confident && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">kennitala stemmir</span>}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {[m.email, m.kennitala_last4 ? `···${m.kennitala_last4}` : null, m.journey_id ? "á heilsuferð í gangi" : "engin heilsuferð"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <button type="button" onClick={() => commit(m.client_id)} disabled={busy}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#10B981] px-3 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
                      <Check className="h-4 w-4" /> Já, opna
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setCreating(true)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:underline">
                <UserPlus className="h-4 w-4" /> Enginn þeirra — stofna nýjan
              </button>
            </div>
          )}

          {creating && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Nýr skjólstæðingur</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-slate-600">Nafn</span>
                  <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Netfang</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="nafn@daemi.is" className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Kennitala</span>
                  <input value={form.kennitala} onChange={(e) => setForm({ ...form, kennitala: e.target.value })}
                    inputMode="numeric" className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Sími</span>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    inputMode="tel" className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-500">Skjólstæðingurinn fær boð í tölvupósti og kemst þá inn á aðganginn sinn.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => commit(null)} disabled={busy || !form.full_name.trim() || !form.email.trim()}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-40">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Stofna og opna vinnusvæði
                </button>
                {result.matches.length > 0 && (
                  <button type="button" onClick={() => setCreating(false)} className="text-sm font-semibold text-slate-600 hover:underline">Til baka í leitarniðurstöður</button>
                )}
              </div>
            </div>
          )}

          {/* The values we are about to keep */}
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Gildi úr skýrslunni</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {result.values.map((v, i) => (
                <li key={`${v.code}-${i}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm ring-1 ring-slate-100">
                  <input type="checkbox" checked={!!take[i]} onChange={(e) => setTake({ ...take, [i]: e.target.checked })}
                    aria-label={`Vista ${v.label}`} className="h-4 w-4 accent-emerald-600" />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{v.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {String(v.value).replace(".", ",")}{v.unit ? ` ${v.unit}` : ""}
                  </span>
                  {v.confidence !== "high" && <span className="shrink-0 text-[11px] text-amber-700">?</span>}
                </li>
              ))}
            </ul>
            {result.warnings.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
