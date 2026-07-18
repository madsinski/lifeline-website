"use client";

// Admin-only panel to mint / copy / revoke no-login review links for
// external counsel. A link opens /legal-review/<token>, where the
// holder can view, redline and approve every legal document without a
// Lifeline account. Treat a link like a password.
//
// Only rendered for role='admin'. The API enforces the same gate.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ReviewLink {
  id: string;
  token: string;
  label: string | null;
  active: boolean;
  expires_at: string | null;
  created_by_email: string | null;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReviewLinkManager() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  const [links, setLinks] = useState<ReviewLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const t = await token();
      if (!t) return;
      const res = await fetch("/api/admin/legal/review-links", { headers: { Authorization: `Bearer ${t}` } });
      const j = await res.json().catch(() => ({}));
      if (j.ok) {
        setLinks((j.links || []) as ReviewLink[]);
        setMigrationMissing(!!j.migration_missing);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Resolve admin status, then load links only for admins.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { if (!cancelled) setChecked(true); return; }
      const { data } = await supabase.from("staff").select("role, active").eq("email", user.email).maybeSingle();
      const admin = !!data?.active && data.role === "admin";
      if (cancelled) return;
      setIsAdmin(admin);
      setChecked(true);
      if (admin) loadLinks();
    })();
    return () => { cancelled = true; };
  }, [loadLinks]);

  const urlFor = (l: ReviewLink) => `${origin}/legal-review/${l.token}`;

  const generate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const t = await token();
      if (!t) throw new Error("Not signed in");
      const res = await fetch("/api/admin/legal/review-links", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ label: label.trim() || undefined, expires_in_days: Number(expiryDays) || 0 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Could not create link");
      setLabel("");
      setMsg({ type: "ok", text: "Link created — copy it below." });
      await loadLinks();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const t = await token();
      if (!t) throw new Error("Not signed in");
      const res = await fetch("/api/admin/legal/review-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Could not revoke");
      await loadLinks();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (l: ReviewLink) => {
    try {
      await navigator.clipboard.writeText(urlFor(l));
      setCopiedId(l.id);
      setTimeout(() => setCopiedId((c) => (c === l.id ? null : c)), 1500);
    } catch { /* clipboard blocked — the input is selectable as a fallback */ }
  };

  if (!checked || !isAdmin) return null;

  const activeLinks = links.filter((l) => l.active);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-[#1F2937]">Lawyer review links (no login)</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
            Generate a unique link external counsel can open without a Lifeline account to view, redline
            and approve every document here. The lawyer identifies themselves by name + email; each edit
            and approval is recorded with that identity plus IP, timestamp and a sha256 of the exact text.
            <span className="font-medium text-gray-600"> Treat a link like a password</span> — anyone
            with it can act. Revoke when the review is done.
          </p>
        </div>
      </div>

      {migrationMissing && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          The <code className="font-mono">legal_review_links</code> table isn&apos;t there yet. Run{" "}
          <code className="font-mono">supabase/migration-legal-review-links.sql</code> in the Supabase SQL editor, then reload.
        </div>
      )}

      {/* Generate */}
      <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
        <label className="text-xs font-medium text-gray-700">
          Label (optional)
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Ragnar @ Fosslögmenn — July review"
            className="mt-1 block w-72 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
          />
        </label>
        <label className="text-xs font-medium text-gray-700">
          Expires in (days, 0 = never)
          <input
            type="number"
            min={0}
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            className="mt-1 block w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
          />
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {busy ? "Working…" : "Generate link"}
        </button>
        {msg && <span className={`text-xs ${msg.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
      </div>

      {/* Existing links */}
      {loading ? (
        <p className="text-xs text-gray-400">Loading links…</p>
      ) : activeLinks.length === 0 ? (
        <p className="text-xs text-gray-400">No active links. Generate one above to share with counsel.</p>
      ) : (
        <div className="space-y-2">
          {activeLinks.map((l) => {
            const expired = l.expires_at && new Date(l.expires_at) < new Date();
            return (
              <div key={l.id} className="border border-gray-200 rounded-lg p-3 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-medium text-gray-700">
                    {l.label || <span className="text-gray-400 italic">Untitled link</span>}
                    {expired && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">expired</span>}
                  </div>
                  <div className="text-gray-400">
                    created {fmt(l.created_at)} · {l.expires_at ? `expires ${fmt(l.expires_at)}` : "no expiry"} · last used {fmt(l.last_used_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={urlFor(l)}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded font-mono text-[11px] text-gray-700 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => copy(l)}
                    className="px-3 py-1.5 font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors whitespace-nowrap"
                  >
                    {copiedId === l.id ? "Copied!" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(l.id)}
                    disabled={busy}
                    className="px-3 py-1.5 font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
