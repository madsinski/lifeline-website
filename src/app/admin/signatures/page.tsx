"use client";

// Internal email-signature builder. Renders one card per founder/staff
// member with editable fields, a live HTML preview, and two copy
// actions: "Copy HTML" (source) and "Copy formatted" (rich clipboard
// payload that Gmail picks up directly when pasted into the signature
// editor).
//
// Edits persist to the Supabase email_signatures table via
// /api/admin/signatures (PUT) so every staff member sees the same
// values regardless of browser/device. Auto-saves on blur (and on
// debounce) without a manual Save button.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface SignatureFields {
  key: string;
  name: string;
  title: string;
  phone: string;       // E.164 ideally, e.g. +354 767 4393
  email: string;
}

const LOGO_URL = "https://lifelinehealth.is/lifeline-logo-rebrand.png";

// Single source of truth for the rendered HTML. Inline styles only so
// it survives a Gmail signature-editor paste.
function buildSignatureHtml(s: SignatureFields): string {
  const telHref = s.phone.replace(/\s+/g, "");
  return [
    `<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1F2937;line-height:1.4;">`,
    `<tr><td style="padding-bottom:10px;">`,
    `<a href="https://lifelinehealth.is" style="text-decoration:none;">`,
    `<img src="${LOGO_URL}" alt="Lifeline Health" width="200" style="display:block;border:0;outline:none;width:200px;height:auto;">`,
    `</a></td></tr>`,
    `<tr><td style="padding-bottom:8px;border-bottom:2px solid #10B981;">`,
    `<span style="font-size:15px;font-weight:700;color:#111827;">${escapeHtml(s.name)}</span><br>`,
    `<span style="font-size:12px;color:#6B7280;letter-spacing:0.2px;">${escapeHtml(s.title)}</span>`,
    `</td></tr>`,
    `<tr><td style="padding-top:8px;font-size:12px;color:#4B5563;">`,
    `<a href="tel:${telHref}" style="color:#4B5563;text-decoration:none;">${escapeHtml(s.phone)}</a>`,
    ` &middot; `,
    `<a href="mailto:${s.email}" style="color:#4B5563;text-decoration:none;">${escapeHtml(s.email)}</a>`,
    ` &middot; `,
    `<a href="https://lifelinehealth.is" style="color:#10B981;text-decoration:none;font-weight:600;">lifelinehealth.is</a>`,
    `</td></tr>`,
    `</table>`,
  ].join("");
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default function SignaturesPage() {
  const [sigs, setSigs] = useState<SignatureFields[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Per-key save state for the small "saved / saving / error" indicator.
  const [saveState, setSaveState] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  // Debounce timers per key so rapid typing only fires one PUT.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const authHeader = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  // Initial load from /api/admin/signatures.
  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeader();
        const res = await fetch("/api/admin/signatures", { headers });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        const j = await res.json();
        setSigs((j.signatures || []) as SignatureFields[]);
      } catch (e) {
        setLoadError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authHeader]);

  const persist = useCallback(async (next: SignatureFields) => {
    setSaveState((prev) => ({ ...prev, [next.key]: "saving" }));
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      const res = await fetch("/api/admin/signatures", {
        method: "PUT",
        headers,
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      setSaveState((prev) => ({ ...prev, [next.key]: "saved" }));
      setTimeout(() => {
        setSaveState((prev) => (prev[next.key] === "saved" ? { ...prev, [next.key]: "idle" } : prev));
      }, 1600);
    } catch {
      setSaveState((prev) => ({ ...prev, [next.key]: "error" }));
    }
  }, [authHeader]);

  const updateField = (key: string, field: keyof SignatureFields, value: string) => {
    setSigs((prev) => {
      const next = prev.map((s) => (s.key === key ? { ...s, [field]: value } : s));
      const updated = next.find((s) => s.key === key);
      if (updated) {
        // Debounced auto-save: cancel pending PUT, schedule a new one.
        clearTimeout(saveTimers.current[key]);
        saveTimers.current[key] = setTimeout(() => persist(updated), 600);
      }
      return next;
    });
  };

  const saveNow = (key: string) => {
    clearTimeout(saveTimers.current[key]);
    const cur = sigs.find((s) => s.key === key);
    if (cur) persist(cur);
  };

  if (loading) {
    return <div className="px-8 py-6 text-sm text-gray-500">Loading signatures…</div>;
  }
  if (loadError) {
    return (
      <div className="px-8 py-6 max-w-2xl">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Email signatures</h1>
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
          Couldn't load signatures: {loadError}. The migration <code className="bg-white px-1.5 py-0.5 rounded border border-amber-200">migration-email-signatures.sql</code> may not have been applied yet.
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Email signatures</h1>
        <p className="text-sm text-gray-500">
          Edit the details — changes save automatically to a shared table so every founder sees the same values.
          Use "Copy formatted (for Gmail)" then paste into Gmail Workspace → Settings → Signature.
        </p>
      </div>

      <div className="space-y-6">
        {sigs.map((s) => (
          <SignatureCard
            key={s.key}
            sig={s}
            saveState={saveState[s.key] ?? "idle"}
            onChange={(field, value) => updateField(s.key, field, value)}
            onBlur={() => saveNow(s.key)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────

function SignatureCard({
  sig,
  saveState,
  onChange,
  onBlur,
}: {
  sig: SignatureFields;
  saveState: "idle" | "saving" | "saved" | "error";
  onChange: (field: keyof SignatureFields, value: string) => void;
  onBlur: () => void;
}) {
  const html = useMemo(() => buildSignatureHtml(sig), [sig]);
  const [copiedType, setCopiedType] = useState<"html" | "formatted" | null>(null);

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopiedType("html");
      setTimeout(() => setCopiedType(null), 1800);
    } catch {}
  };

  // Rich-clipboard copy. Writes both text/html (what Gmail consumes)
  // and a text/plain fallback. Falls back to writeText if the clipboard
  // API doesn't support write() (older browsers, Safari < 13.4).
  const copyFormatted = async () => {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        const plain = `${sig.name}\n${sig.title}\n${sig.phone} · ${sig.email} · lifelinehealth.is`;
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      setCopiedType("formatted");
      setTimeout(() => setCopiedType(null), 1800);
    } catch {}
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">{sig.name || "(unnamed)"}</div>
        <div className="text-[11px] text-gray-400 min-h-[14px]">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && <span className="text-emerald-600">Saved</span>}
          {saveState === "error" && <span className="text-amber-600">Save failed</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x lg:divide-gray-100">
        {/* Edit fields */}
        <div className="p-5 space-y-3">
          <Field label="Name" value={sig.name} onChange={(v) => onChange("name", v)} onBlur={onBlur} placeholder="Full name" />
          <Field label="Title / role" value={sig.title} onChange={(v) => onChange("title", v)} onBlur={onBlur} placeholder="e.g. Medical doctor · Co-founder, Lifeline Health ehf." />
          <Field label="Phone" value={sig.phone} onChange={(v) => onChange("phone", v)} onBlur={onBlur} placeholder="+354 000 0000" />
          <Field label="Email" value={sig.email} onChange={(v) => onChange("email", v)} onBlur={onBlur} placeholder="name@lifelinehealth.is" />

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={copyFormatted}
              className="text-xs font-semibold px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {copiedType === "formatted" ? "Copied — paste in Gmail" : "Copy formatted (for Gmail)"}
            </button>
            <button
              type="button"
              onClick={copyHtml}
              className="text-xs font-medium px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            >
              {copiedType === "html" ? "Copied HTML" : "Copy HTML source"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 pt-1 leading-snug">
            Tip: "Copy formatted" pastes directly into Gmail's signature editor with the logo and styling. "Copy HTML source" gives you the raw markup for backup or sharing.
          </p>
        </div>

        {/* Live preview — sandboxed in an iframe so styles never bleed
            into the admin page. */}
        <div className="p-5 bg-gray-50">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">Live preview</div>
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <iframe
              title={`${sig.name} signature preview`}
              srcDoc={`<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${html}</body></html>`}
              className="w-full"
              style={{ height: 170, border: 0 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
      />
    </label>
  );
}
