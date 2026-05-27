"use client";

// Internal email-signature builder. Renders one card per founder/staff
// member with editable fields, a live HTML preview, and two copy
// actions: "Copy HTML" (source) and "Copy formatted" (rich clipboard
// payload that Gmail picks up directly when pasted into the signature
// editor).
//
// Edits persist to localStorage — no DB schema, no API surface. Reset
// per-card via the "Reset" button.

import { useEffect, useMemo, useState } from "react";

interface SignatureFields {
  key: string;
  name: string;
  title: string;
  phone: string;       // E.164 ideally, e.g. +354 767 4393
  email: string;
}

const DEFAULTS: SignatureFields[] = [
  {
    key: "mads",
    name: "Mads Christian Aanesen",
    title: "Medical doctor · Co-founder, Lifeline Health ehf.",
    phone: "+354 767 4393",
    email: "mads@lifelinehealth.is",
  },
  {
    key: "victor",
    name: "Victor Guðmundsson",
    title: "Medical doctor · Founder & CEO, Lifeline Health ehf.",
    phone: "+354 ",
    email: "victor@lifelinehealth.is",
  },
  {
    key: "vignir",
    name: "Vignir Sigurðsson",
    title: "Chief Medical Advisor · Pediatrician · Ass. Prof. HA, Lifeline Health ehf.",
    phone: "+354 ",
    email: "vignir@lifelinehealth.is",
  },
  {
    key: "elvar",
    name: "Elvar",
    title: "Lifeline Health ehf.",
    phone: "+354 ",
    email: "elvar@lifelinehealth.is",
  },
];

const STORAGE_KEY = "admin.signatures.v1";
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
  const [sigs, setSigs] = useState<SignatureFields[]>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate edits from localStorage on mount. Avoids the SSR mismatch
  // by gating render on `hydrated`.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SignatureFields[];
        // Merge: start from DEFAULTS so new people added later show up,
        // overlay any saved edits by key.
        const merged = DEFAULTS.map((d) => {
          const stored = parsed.find((p) => p.key === d.key);
          return stored ? { ...d, ...stored } : d;
        });
        setSigs(merged);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist on every change. Cheap, debounce not needed.
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sigs)); } catch {}
  }, [sigs, hydrated]);

  const updateField = (key: string, field: keyof SignatureFields, value: string) => {
    setSigs((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  };

  const reset = (key: string) => {
    const fresh = DEFAULTS.find((d) => d.key === key);
    if (!fresh) return;
    setSigs((prev) => prev.map((s) => (s.key === key ? fresh : s)));
  };

  return (
    <div className="px-8 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Email signatures</h1>
        <p className="text-sm text-gray-500">
          Edit the details, copy the formatted signature, and paste it into Gmail Workspace → Settings → Signature. "Copy formatted"
          puts a rich HTML payload on your clipboard so Gmail preserves the logo and styling on paste.
        </p>
      </div>

      <div className="space-y-6">
        {sigs.map((s) => (
          <SignatureCard
            key={s.key}
            sig={s}
            onChange={(field, value) => updateField(s.key, field, value)}
            onReset={() => reset(s.key)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────

function SignatureCard({
  sig,
  onChange,
  onReset,
}: {
  sig: SignatureFields;
  onChange: (field: keyof SignatureFields, value: string) => void;
  onReset: () => void;
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
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x lg:divide-gray-100">
        {/* Edit fields */}
        <div className="p-5 space-y-3">
          <Field label="Name" value={sig.name} onChange={(v) => onChange("name", v)} placeholder="Full name" />
          <Field label="Title / role" value={sig.title} onChange={(v) => onChange("title", v)} placeholder="e.g. Medical doctor · Co-founder, Lifeline Health ehf." />
          <Field label="Phone" value={sig.phone} onChange={(v) => onChange("phone", v)} placeholder="+354 000 0000" />
          <Field label="Email" value={sig.email} onChange={(v) => onChange("email", v)} placeholder="name@lifelinehealth.is" />

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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
      />
    </label>
  );
}
