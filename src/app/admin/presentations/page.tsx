"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TEMPLATES } from "@/lib/presentations/templates";
import type { PresentationMeta } from "@/lib/presentations/types";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch { return s; }
}

export default function PresentationsList() {
  const router = useRouter();
  const [items, setItems] = useState<PresentationMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/presentations", { headers: await authHeaders() });
      if (res.ok) { const j = await res.json(); setItems(j.presentations ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(templateId: string) {
    setBusy("new");
    try {
      const res = await fetch("/api/admin/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ templateId }),
      });
      const j = await res.json();
      if (res.ok && j.presentation) router.push(`/admin/presentations/${j.presentation.id}`);
    } finally { setBusy(null); setShowNew(false); }
  }

  async function duplicate(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ duplicateOf: id }),
      });
      if (res.ok) await load();
    } finally { setBusy(null); }
  }

  async function togglePublish(p: PresentationMeta) {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/admin/presentations/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ is_published: !p.is_published }),
      });
      if (res.ok) setItems((prev) => prev.map((x) => x.id === p.id ? { ...x, is_published: !p.is_published } : x));
    } finally { setBusy(null); }
  }

  async function remove(p: PresentationMeta) {
    if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    setBusy(p.id);
    try {
      const res = await fetch(`/api/admin/presentations/${p.id}`, { method: "DELETE", headers: await authHeaders() });
      if (res.ok) setItems((prev) => prev.filter((x) => x.id !== p.id));
    } finally { setBusy(null); }
  }

  async function copyLink(slug: string) {
    const url = `${origin}/present/${slug}`;
    try { await navigator.clipboard.writeText(url); setCopied(slug); setTimeout(() => setCopied(null), 1800); } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presentations</h1>
          <p className="text-sm text-gray-500">Build and share slide decks. Published decks are viewable at a public link.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/presentations/collateral" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Fjarlækningar prentefni
          </Link>
          <button onClick={() => setShowNew(true)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            + New presentation
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-500">
          No presentations yet. Create one from a template to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/presentations/${p.id}`} className="truncate font-semibold text-gray-900 hover:text-emerald-700">{p.title}</Link>
                  {p.is_published
                    ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Published</span>
                    : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">Draft</span>}
                </div>
                <div className="mt-0.5 text-xs text-gray-400">Updated {fmtDate(p.updated_at)} · {p.template_version}</div>
                {p.is_published && (
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <code className="truncate rounded bg-gray-50 px-1.5 py-0.5 text-gray-500">/present/{p.slug}</code>
                    <button onClick={() => copyLink(p.slug)} className="font-medium text-emerald-600 hover:underline">{copied === p.slug ? "Copied!" : "Copy link"}</button>
                    <a href={`/present/${p.slug}`} target="_blank" rel="noreferrer" className="font-medium text-gray-500 hover:underline">Open ↗</a>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/presentations/${p.id}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Edit</Link>
                <button disabled={busy === p.id} onClick={() => togglePublish(p)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {p.is_published ? "Unpublish" : "Publish"}
                </button>
                <button disabled={busy === p.id} onClick={() => duplicate(p.id)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Duplicate</button>
                <button disabled={busy === p.id} onClick={() => remove(p)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-semibold text-gray-800">New presentation</h3>
            <p className="mb-4 text-sm text-gray-500">Start from a template — you can change everything after.</p>
            <div className="-mr-2 space-y-2 overflow-y-auto pr-2">
              {TEMPLATES.map((t) => (
                <button key={t.id} disabled={busy === "new"} onClick={() => create(t.id)} className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40 disabled:opacity-50">
                  <div className="font-medium text-gray-800">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
