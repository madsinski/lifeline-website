"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Staff onboarding — e-signature of required legal documents.
// Staff members who have any outstanding agreements land here. They
// can't enter the main admin until they've ticked every required doc
// at its current version. Each signature generates a PDF certificate
// emailed to them and persisted for admin audit.

type PendingDoc = {
  key: string;
  version: string;
  title: string;
  text: string;
  text_hash: string;
};

type SignedDoc = {
  key: string;
  version: string;
  title: string;
  accepted_at: string;
  up_to_date: boolean;
  pdf_storage_path: string | null;
};

export default function StaffOnboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDoc[]>([]);
  const [signed, setSigned] = useState<SignedDoc[]>([]);

  // Per-doc UI state
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<Record<string, number>>({}); // key → timestamp when the textarea was scrolled to bottom
  const [accepted, setAccepted] = useState<Record<string, boolean>>({}); // checkbox state
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/admin/staff/me/agreements", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(j?.detail || j?.error || "Could not load your agreements.");
        return;
      }
      setRole(j.role);
      setName(j.name);
      setPending(j.pending || []);
      setSigned(j.signed || []);
      setActiveKey((j.pending || [])[0]?.key || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = useMemo(() => pending.find((d) => d.key === activeKey) || null, [pending, activeKey]);

  const signedPct = useMemo(() => {
    const total = pending.length + signed.filter((s) => s.up_to_date).length;
    if (total === 0) return 100;
    const done = signed.filter((s) => s.up_to_date).length;
    return Math.round((done / total) * 100);
  }, [pending.length, signed]);

  const sign = async (doc: PendingDoc) => {
    const typed = (signatures[doc.key] || "").trim();
    if (!typed) { alert("Please type your full name to sign."); return; }
    if (!accepted[doc.key]) { alert("Please tick the acceptance box first."); return; }
    setSubmitting(doc.key);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/admin/staff/me/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ document_key: doc.key, typed_signature: typed }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(j?.detail || j?.error || "Signature failed.");
        return;
      }
      setSuccessMsg(`${doc.title} signed. A PDF copy has been emailed to you.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      await load();
    } finally {
      setSubmitting(null);
    }
  };

  const allDone = !loading && pending.length === 0;

  const downloadText = (key: string, title: string, version: string, text: string) => {
    const filename = `${key}-${version}.txt`;
    const header = `${title}\nLifeline Health ehf.\nÚtgáfa ${version}\n\n`;
    const blob = new Blob([header + text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-1">Staff onboarding</div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {allDone ? "You're all set" : "Sign your staff agreements"}
          </h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            {allDone
              ? "Every required legal document is signed and up-to-date. You can return to the admin dashboard any time."
              : "Before you can enter the admin dashboard, please review and sign each document below. A signed PDF of each is emailed to you and kept in your staff record."}
          </p>
          {(name || role) && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-gray-600">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-200">
                {name || "—"}
              </span>
              {role && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 capitalize">
                  {role}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {!loading && (pending.length > 0 || signed.length > 0) && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-medium text-gray-600 mb-1.5">
              <span>{signed.filter((s) => s.up_to_date).length} of {pending.length + signed.filter((s) => s.up_to_date).length} signed</span>
              <span>{signedPct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
                style={{ width: `${signedPct}%` }}
              />
            </div>
          </div>
        )}

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{err}</div>
        )}
        {successMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 mb-4">{successMsg}</div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-8 text-center text-gray-500">Loading…</div>
        ) : (
          <div className="grid md:grid-cols-[260px_1fr] gap-6">
            {/* Sidebar: list of docs */}
            <aside className="space-y-2">
              {[...pending, ...signed.filter((s) => s.up_to_date && !pending.some((p) => p.key === s.key))].map((d) => {
                const sig = signed.find((s) => s.key === d.key && s.up_to_date);
                const isPending = !sig;
                return (
                  <button
                    key={d.key}
                    onClick={() => isPending && setActiveKey(d.key)}
                    disabled={!isPending}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      activeKey === d.key && isPending
                        ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200"
                        : isPending
                          ? "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          : "bg-gray-50 border-gray-100 opacity-80 cursor-default"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${sig ? "bg-emerald-500" : "bg-gray-200"}`}>
                        {sig ? (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 leading-tight">{d.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {sig ? `Signed ${new Date(sig.accepted_at).toLocaleDateString("en-GB")}` : "Needs signature"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {allDone && (
                <Link
                  href="/admin"
                  className="block mt-4 px-3 py-2 text-sm font-semibold text-center rounded-lg bg-gray-900 text-white hover:bg-black"
                >
                  Go to admin →
                </Link>
              )}
            </aside>

            {/* Main: active doc */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              {allDone ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-gray-900">Everything signed</h2>
                  <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
                    Your legal onboarding is complete. You'll only land on this page again if we publish a new version of one of the documents.
                  </p>
                  <Link
                    href="/admin"
                    className="inline-block mt-5 px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 text-white hover:opacity-95"
                  >
                    Continue to admin
                  </Link>
                </div>
              ) : active ? (
                <>
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{active.title}</h2>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{active.key} · {active.version} · SHA-256 {active.text_hash.slice(0, 16)}…</p>
                    </div>
                    <button
                      onClick={() => downloadText(active.key, active.title, active.version, active.text)}
                      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                      title="Download plain-text copy (for legal review)"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      .txt
                    </button>
                  </div>

                  <textarea
                    readOnly
                    value={active.text}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
                        if (!readAt[active.key]) setReadAt((m) => ({ ...m, [active.key]: Date.now() }));
                      }
                    }}
                    className="w-full h-[380px] px-4 py-3 border border-gray-200 rounded-lg text-[12.5px] leading-relaxed font-mono text-gray-800 bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                  />
                  {!readAt[active.key] && (
                    <p className="text-[11px] text-amber-700 mt-1">Scroll to the end of the document to enable the signature form.</p>
                  )}

                  <div className="mt-5 space-y-3">
                    <label className={`flex items-start gap-2 ${readAt[active.key] ? "" : "opacity-50 pointer-events-none"}`}>
                      <input
                        type="checkbox"
                        checked={!!accepted[active.key]}
                        onChange={(e) => setAccepted((m) => ({ ...m, [active.key]: e.target.checked }))}
                        className="mt-0.5 w-4 h-4 accent-emerald-600"
                      />
                      <span className="text-sm text-gray-700">
                        Ég staðfesti að ég hef lesið, skilið og samþykkt <strong>{active.title}</strong> útgáfu <code className="text-[11px]">{active.version}</code>.
                      </span>
                    </label>

                    <div className={readAt[active.key] ? "" : "opacity-50 pointer-events-none"}>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Typed signature (full name)</label>
                      <input
                        type="text"
                        value={signatures[active.key] || ""}
                        onChange={(e) => setSignatures((m) => ({ ...m, [active.key]: e.target.value }))}
                        placeholder={name || "Your full name"}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        disabled={!readAt[active.key] || !accepted[active.key] || !(signatures[active.key] || "").trim() || submitting === active.key}
                        onClick={() => sign(active)}
                        className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {submitting === active.key ? "Signing…" : "Sign & continue"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-gray-500 text-sm">No document selected.</div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
