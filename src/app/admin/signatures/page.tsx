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
import BackButton from "@/app/components/BackButton";

interface SignatureFields {
  key: string;
  name: string;
  title: string;
  phone: string;       // E.164 ideally, e.g. +354 767 4393
  email: string;
}

const LOGO_URL = "https://lifelinehealth.is/lifeline-logo-rebrand.png";
const MARK_URL = "https://lifelinehealth.is/lifeline-logo-mark.svg";

type DesignKey = "stacked" | "compact" | "card";

const DESIGN_LABELS: Record<DesignKey, string> = {
  stacked: "Stacked",
  compact: "Compact",
  card:    "Card",
};

const DESIGN_BLURBS: Record<DesignKey, string> = {
  stacked: "Full wordmark on top with an emerald accent line under the name. Best for first-impression emails.",
  compact: "Mark on the left, info on the right. Smaller footprint — great for replies and threads.",
  card:    "Logo + contact info inside a soft emerald-tinted card. More designy / pitch-flavored.",
};

// Contact details (phone, email, web) are rendered as plain styled text
// rather than <a> links. Email clients (notably Gmail and Apple Mail)
// force their own underline onto anchors regardless of text-decoration:none,
// so the only reliable way to keep the signature clean is to not use links
// for these — the address is still copy/selectable.
function contact(text: string, color: string, extraStyle = ""): string {
  return `<span style="color:${color};text-decoration:none;${extraStyle}">${escapeHtml(text)}</span>`;
}

// ─── Design 1: Stacked (current) ────────────────────────────────────
// Full wordmark on top, name + title with emerald accent line under,
// contact row below.
function buildStacked(s: SignatureFields): string {
  return [
    `<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1F2937;line-height:1.4;">`,
    `<tr><td style="padding-bottom:10px;">`,
    `<a href="https://lifelinehealth.is" style="text-decoration:none;border-bottom:0;">`,
    `<img src="${LOGO_URL}" alt="Lifeline Health" width="200" style="display:block;border:0;outline:none;width:200px;height:auto;">`,
    `</a></td></tr>`,
    `<tr><td style="padding-bottom:8px;border-bottom:2px solid #10B981;">`,
    `<span style="font-size:15px;font-weight:700;color:#111827;">${escapeHtml(s.name)}</span><br>`,
    `<span style="font-size:12px;color:#6B7280;letter-spacing:0.2px;">${escapeHtml(s.title)}</span>`,
    `</td></tr>`,
    `<tr><td style="padding-top:8px;font-size:12px;color:#4B5563;">`,
    contact(s.phone, "#4B5563"),
    ` &middot; `,
    contact(s.email, "#4B5563"),
    ` &middot; `,
    contact("lifelinehealth.is", "#10B981", "font-weight:600;"),
    `</td></tr>`,
    `</table>`,
  ].join("");
}

// ─── Design 2: Compact ──────────────────────────────────────────────
// Mark on the left (40px square), text on the right with a hairline
// divider between. Tighter typography. Best for reply signatures.
function buildCompact(s: SignatureFields): string {
  return [
    `<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1F2937;line-height:1.35;">`,
    `<tr>`,
    `<td valign="top" style="padding-right:12px;border-right:1px solid #E5E7EB;">`,
    `<a href="https://lifelinehealth.is" style="text-decoration:none;border-bottom:0;">`,
    `<img src="${MARK_URL}" alt="Lifeline Health" width="44" height="44" style="display:block;border:0;outline:none;width:44px;height:44px;">`,
    `</a>`,
    `</td>`,
    `<td valign="top" style="padding-left:12px;">`,
    `<div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(s.name)}</div>`,
    `<div style="font-size:11.5px;color:#6B7280;padding-bottom:4px;">${escapeHtml(s.title)}</div>`,
    `<div style="font-size:11.5px;color:#4B5563;">`,
    contact(s.phone, "#4B5563"),
    ` &middot; `,
    contact(s.email, "#4B5563"),
    `</div>`,
    `<div style="font-size:11.5px;padding-top:1px;">`,
    contact("lifelinehealth.is", "#10B981", "font-weight:600;"),
    `</div>`,
    `</td>`,
    `</tr>`,
    `</table>`,
  ].join("");
}

// ─── Design 3: Card ─────────────────────────────────────────────────
// Logo and info inside a soft emerald-tinted rounded card. Strongest
// brand presence — for outreach / pitch emails.
function buildCard(s: SignatureFields): string {
  return [
    `<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1F2937;line-height:1.4;">`,
    `<tr><td style="background-color:#F0FDF9;border:1px solid #A7F3D0;border-radius:12px;padding:16px 18px;">`,
    // Logo
    `<a href="https://lifelinehealth.is" style="text-decoration:none;border-bottom:0;">`,
    `<img src="${LOGO_URL}" alt="Lifeline Health" width="180" style="display:block;border:0;outline:none;width:180px;height:auto;margin-bottom:12px;">`,
    `</a>`,
    // Name + title
    `<div style="font-size:15px;font-weight:700;color:#064E3B;">${escapeHtml(s.name)}</div>`,
    `<div style="font-size:12px;color:#047857;padding-bottom:10px;">${escapeHtml(s.title)}</div>`,
    // Contact rows
    `<div style="font-size:12px;color:#065F46;line-height:1.7;">`,
    contact(s.phone, "#065F46"),
    ` &middot; `,
    contact(s.email, "#065F46"),
    ` &middot; `,
    contact("lifelinehealth.is", "#10B981", "font-weight:700;"),
    `</div>`,
    `</td></tr>`,
    `</table>`,
  ].join("");
}

const DESIGN_BUILDERS: Record<DesignKey, (s: SignatureFields) => string> = {
  stacked: buildStacked,
  compact: buildCompact,
  card:    buildCard,
};

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
        <BackButton fallback="/admin/settings" label="Back to Settings" className="mb-4 -ml-3" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Email signatures</h1>
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
          Couldn't load signatures: {loadError}. The migration <code className="bg-white px-1.5 py-0.5 rounded border border-amber-200">migration-email-signatures.sql</code> may not have been applied yet.
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 max-w-5xl">
      <BackButton fallback="/admin/settings" label="Back to Settings" className="mb-4 -ml-3" />
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
  const [design, setDesign] = useState<DesignKey>("stacked");
  const html = useMemo(() => DESIGN_BUILDERS[design](sig), [design, sig]);
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

        {/* Live preview with design tabs. Iframe sandboxes the
            signature's inline styles so they can't bleed into the
            admin page. */}
        <div className="p-5 bg-gray-50">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Live preview</div>
            <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-0.5">
              {(Object.keys(DESIGN_LABELS) as DesignKey[]).map((k) => {
                const active = design === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDesign(k)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded ${
                      active ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {DESIGN_LABELS[k]}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mb-2 leading-snug">{DESIGN_BLURBS[design]}</p>
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <iframe
              title={`${sig.name} signature preview`}
              srcDoc={`<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${html}</body></html>`}
              className="w-full"
              style={{ height: 200, border: 0 }}
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
