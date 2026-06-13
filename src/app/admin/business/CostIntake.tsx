"use client";

// Cost intake — drag-and-drop PDF invoices for costs (new or old).
// Per file you choose the company it's for and the category
// (measurement, blood test, …); the AI reads the vendor / amount /
// date and the invoice lands in accounting_expense_invoices, flowing
// into the company-card Costs section, the Accounting tab and the
// monthly report. Backed by /api/admin/accounting/invoices (month=auto).

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  { key: "", label: "Auto-detect" },
  { key: "measurements", label: "Measurements" },
  { key: "blood_tests", label: "Blood tests" },
  { key: "doctor", label: "Doctor" },
  { key: "saas", label: "SaaS / systems" },
  { key: "other", label: "Other" },
];

const isk = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;

interface QueueItem {
  id: string;
  file: File;
  companyId: string;
  category: string;
  status: "queued" | "uploading" | "done" | "duplicate" | "error";
  info: string;
}

export default function CostIntake() {
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [defaultCompany, setDefaultCompany] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(path, { ...init, headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, []);

  useEffect(() => {
    (async () => {
      const res = await authedFetch(`/api/admin/accounting/companies`);
      if (res.ok) { const j = await res.json(); setCompanies(j.companies || []); }
    })();
  }, [authedFetch]);

  const addFiles = useCallback((files: File[]) => {
    const pdfs = files.filter((f) => f.type === "application/pdf" || /\.(pdf|png|jpe?g)$/i.test(f.name));
    setQueue((q) => [
      ...q,
      ...pdfs.map((file) => ({
        id: `f${idRef.current++}`,
        file,
        companyId: defaultCompany,
        category: defaultCategory,
        status: "queued" as const,
        info: "",
      })),
    ]);
  }, [defaultCompany, defaultCategory]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files || []));
  };

  const update = (id: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const uploadOne = async (it: QueueItem) => {
    update(it.id, { status: "uploading", info: "" });
    try {
      const fd = new FormData();
      fd.append("file", it.file);
      fd.append("month", "auto");
      if (it.category) fd.append("category", it.category);
      if (it.companyId) fd.append("company_id", it.companyId);
      const res = await authedFetch(`/api/admin/accounting/invoices`, { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { update(it.id, { status: "error", info: j.error || `HTTP ${res.status}` }); return; }
      if (j.duplicate) {
        update(it.id, { status: "duplicate", info: `Already uploaded (${j.vendor || ""} #${j.invoice_number || ""})` });
        return;
      }
      const inv = j.invoice;
      const company = inv.company?.name ? ` → ${inv.company.name}` : "";
      update(it.id, { status: "done", info: `${inv.vendor || "vendor?"} · ${isk(inv.amount_isk)} · ${String(inv.month).slice(0, 7)}${company}${inv.ai_confidence ? ` (AI: ${inv.ai_confidence})` : ""}` });
    } catch (e) {
      update(it.id, { status: "error", info: (e as Error).message });
    }
  };

  const uploadAll = async () => {
    setBusy(true);
    const pending = queue.filter((it) => it.status === "queued" || it.status === "error");
    // Three at a time to be quick without hammering the model.
    const workers = Array.from({ length: 3 }, async () => {
      while (true) {
        const next = pending.shift();
        if (!next) break;
        await uploadOne(next);
      }
    });
    await Promise.all(workers);
    setBusy(false);
  };

  const selCls = "text-xs border border-gray-200 rounded-md px-2 py-1 bg-white";
  const remaining = queue.filter((it) => it.status === "queued" || it.status === "error").length;

  return (
    <div className="px-8 pb-10 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Cost</h1>
        <p className="text-sm text-gray-500">
          Drag in PDF cost invoices (new or old). Pick the company and what the cost is for — the AI reads the vendor, amount and date
          and files it into Accounting and the company&apos;s Costs section.
        </p>
      </div>

      {/* Defaults applied to dropped files */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Default for new files</span>
        <label className="flex items-center gap-1.5">Company
          <select className={selCls} value={defaultCompany} onChange={(e) => setDefaultCompany(e.target.value)}>
            <option value="">Auto-detect</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">Category
          <select className={selCls} value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-emerald-400 bg-emerald-50/60" : "border-gray-200 bg-gray-50/60 hover:border-emerald-300"
        }`}
      >
        <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <div className="text-sm font-medium text-gray-700">Drop cost-invoice PDFs here</div>
        <div className="text-xs text-gray-400 mt-0.5">or click to choose files</div>
        <input
          ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg" multiple className="hidden"
          onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
        />
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">
              {queue.filter((q) => q.status === "done").length} filed · {queue.filter((q) => q.status === "duplicate").length} duplicates · {queue.filter((q) => q.status === "error").length} errors · {remaining} to go
            </span>
            <div className="flex gap-2">
              <button onClick={() => setQueue((q) => q.filter((it) => it.status === "queued" || it.status === "error" || it.status === "uploading"))} className="text-[11px] text-gray-400 hover:text-gray-700">clear done</button>
              <button onClick={uploadAll} disabled={busy || remaining === 0} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {busy ? "Uploading…" : `Upload ${remaining}`}
              </button>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
            {queue.map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="flex-1 min-w-0 truncate text-gray-700" title={it.file.name}>{it.file.name}</span>
                {it.status === "queued" || it.status === "error" ? (
                  <>
                    <select className={selCls} value={it.companyId} onChange={(e) => update(it.id, { companyId: e.target.value })}>
                      <option value="">Auto-detect company</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select className={selCls} value={it.category} onChange={(e) => update(it.id, { category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <button onClick={() => uploadOne(it)} className="text-emerald-700 hover:underline">upload</button>
                    <button onClick={() => setQueue((q) => q.filter((x) => x.id !== it.id))} className="text-red-500 hover:text-red-700">×</button>
                  </>
                ) : (
                  <span className={`whitespace-nowrap ${
                    it.status === "done" ? "text-emerald-700" : it.status === "duplicate" ? "text-amber-600" : "text-gray-400"
                  }`}>
                    {it.status === "uploading" ? "reading…" : it.info || it.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
