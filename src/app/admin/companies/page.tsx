"use client";

import { useEffect, useState, useCallback, Fragment, useRef, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import BulkBiodyButton from "./BulkBiodyButton";

interface CompanyRow {
  id: string;
  name: string;
  contact_person_id: string;
  contact_email: string | null;
  created_at: string;
  member_count: number;
  invited_count: number;
  completed_count: number;
  roster_confirmed_at: string | null;
  registration_finalized_at: string | null;
  registration_finalized_by?: string | null;
  finalized_by_name?: string | null;
  finalized_by_email?: string | null;
  body_comp_event_count: number;
  blood_test_day_count: number;
  default_tier?: string | null;
  status?: "draft" | "contact_invited" | "active" | "archived" | null;
  contact_draft_email?: string | null;
  contact_draft_name?: string | null;
  parent_company_id?: string | null;
  parent_name?: string | null;
}

interface MemberRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  kennitala_last4: string | null;
  invited_at: string | null;
  invite_sent_count: number;
  completed_at: string | null;
  profile_complete: boolean | null;
  biody_activated: boolean | null;
  created_at: string;
}

const TIERS = [
  { value: "", label: "— none —" },
  { value: "free-trial", label: "Free" },
  { value: "self-maintained", label: "Self-maintained" },
  { value: "premium", label: "Premium" },
];

// One source of truth for the company lifecycle pill. Collapsing all the
// branchy "Drög / Boð sent / Awaiting finalize / Ready / Setup" logic
// into a single component keeps the table row skinny and consistent.
function CompanyStatusPill({ c }: { c: CompanyRow }) {
  let label = "Setup";
  let tone = "bg-gray-100 text-gray-600 border-gray-200";
  let dot = "bg-gray-400";
  let title = "Initial setup.";
  if (c.status === "draft") {
    label = "Drög"; tone = "bg-amber-100 text-amber-800 border-amber-200"; dot = "bg-amber-500";
    title = "Admin-created draft — contact person not yet invited.";
  } else if (c.status === "contact_invited") {
    label = "Boð sent"; tone = "bg-blue-100 text-blue-800 border-blue-200"; dot = "bg-blue-500";
    title = "Invite sent to contact person; awaiting claim + signature.";
  } else if (c.registration_finalized_at) {
    label = "Ready"; tone = "bg-emerald-100 text-emerald-800 border-emerald-200"; dot = "bg-emerald-500";
    const finalizer = c.finalized_by_name || c.finalized_by_email || "a company admin";
    title = `Finalized by ${finalizer} on ${new Date(c.registration_finalized_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  } else if (c.roster_confirmed_at && c.body_comp_event_count > 0 && c.blood_test_day_count > 0) {
    label = "Awaiting finalize"; tone = "bg-amber-100 text-amber-800 border-amber-200"; dot = "bg-amber-500";
    title = "Roster confirmed; waiting for the contact person to finalize.";
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tone}`} title={title}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// Compact roster progress: one cell instead of three columns. Shows the
// three counts + a mini bar coloured to completion ratio.
function RosterProgressCell({ c }: { c: CompanyRow }) {
  const total = Math.max(1, c.member_count);
  const invitedPct = Math.min(100, Math.round((c.invited_count / total) * 100));
  const completedPct = Math.min(100, Math.round((c.completed_count / total) * 100));
  return (
    <div className="min-w-[160px]">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-semibold text-gray-900 tabular-nums">{c.completed_count}</span>
        <span className="text-gray-400 tabular-nums">of {c.member_count}</span>
      </div>
      <div className="relative mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden" title={`${c.member_count} on roster · ${c.invited_count} invited · ${c.completed_count} completed`}>
        <div className="absolute inset-y-0 left-0 bg-blue-400" style={{ width: `${invitedPct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${completedPct}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-gray-400 tabular-nums">{c.invited_count} invited</div>
    </div>
  );
}

// Overflow "more actions" menu. A button that toggles a fixed-position
// popover anchored to the button via getBoundingClientRect. Using a
// fixed overlay sidesteps table-cell clipping issues that ate our
// earlier dropdowns.
function OverflowMenu({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.right - 240, width: 240 });
    }
    setOpen((v) => !v);
  };
  const close = () => setOpen(false);
  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
        title="Fleiri aðgerðir"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="4" cy="10" r="1.75" />
          <circle cx="10" cy="10" r="1.75" />
          <circle cx="16" cy="10" r="1.75" />
        </svg>
      </button>
      {open && rect && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1"
            style={{ top: rect.top, left: Math.max(8, rect.left), width: rect.width }}
          >
            {children(close)}
          </div>
        </>
      )}
    </>
  );
}

// Button for admin-created draft / contact-invited companies: generates
// a single-use claim token + sends the Icelandic invite email.
// Idempotent — clicking on an already-invited company just re-sends.
function InviteContactButton({ companyId, draftEmail, status }: { companyId: string; draftEmail: string | null; status: "draft" | "contact_invited" }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(draftEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function send() {
    setSubmitting(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/companies/${companyId}/invite-contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(email ? { email } : {}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { setMsg({ kind: "err", text: j?.detail || j?.error || "Failed" }); return; }
      setMsg({ kind: "ok", text: `Boð sent á ${j.sent_to}. Rennur út ${new Date(j.expires_at).toLocaleDateString("en-GB")}.` });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setMsg(null); }}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {status === "draft" ? "Senda boð" : "Senda aftur"}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md my-16"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {status === "draft" ? "Senda boð á tengilið" : "Senda boð aftur"}
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-600">
                Tengiliðurinn fær íslenskan boðspóst með hlekk til að klára skráninguna og skrifa undir þjónustuskilmála + DPA. Hlekkurinn er einnota og rennur út eftir 14 daga.
              </p>
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Netfang tengiliðs</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@fyrirtæki.is"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </label>
              {msg && (
                <div className={`text-xs rounded-lg px-3 py-2 ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
                  {msg.text}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} className="text-xs font-medium text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-md hover:bg-gray-50">
                Loka
              </button>
              <button
                onClick={send}
                disabled={submitting || !email}
                className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Sendi…" : "Senda boð"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Historic document upload for a company: ToS / DPA / purchase orders
// / other PDFs that were signed offline before the digital flow.
// Opens a modal with the existing list + upload form.
type CompanyDocument = {
  id: string;
  kind: "tos" | "dpa" | "purchase_order" | "other";
  title: string | null;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  signer_name: string | null;
  signed_at: string | null;
  note: string | null;
  uploaded_at: string;
  signed_url: string | null;
};

function DocumentsButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Upload form state
  const [kind, setKind] = useState<"tos" | "dpa" | "purchase_order" | "other">("tos");
  const [title, setTitle] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/companies/${companyId}/documents`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await res.json();
      if (res.ok && j.ok) setDocs(j.documents || []);
      else setMsg({ kind: "err", text: j?.detail || j?.error || "Gat ekki sótt skjöl." });
    } finally { setLoading(false); }
  };

  const openModal = async () => { setOpen(true); setMsg(null); await load(); };

  const submitUpload = async () => {
    if (!file) { setMsg({ kind: "err", text: "Veldu PDF-skrá." }); return; }
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      if (title) fd.append("title", title);
      if (signerName) fd.append("signer_name", signerName);
      if (signedAt) fd.append("signed_at", signedAt);
      if (note) fd.append("note", note);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/companies/${companyId}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { setMsg({ kind: "err", text: j?.detail || j?.error || "Upphleðsla mistókst." }); return; }
      setMsg({ kind: "ok", text: "Skjali hlaðið upp." });
      setFile(null); setTitle(""); setSignerName(""); setSignedAt(""); setNote("");
      await load();
    } finally { setUploading(false); }
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm("Eyða þessu skjali?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`/api/admin/companies/${companyId}/documents/${docId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) { setMsg({ kind: "err", text: j?.detail || j?.error || "Eyðing mistókst." }); return; }
    await load();
  };

  const kindLabels: Record<CompanyDocument["kind"], string> = {
    tos: "Þjónustuskilmálar",
    dpa: "Vinnslusamningur",
    purchase_order: "Þjónustusamningur",
    other: "Annað",
  };
  const kindPill = (k: CompanyDocument["kind"]) => {
    const color = k === "tos" ? "bg-blue-50 text-blue-700 border-blue-100"
      : k === "dpa" ? "bg-violet-50 text-violet-700 border-violet-100"
      : k === "purchase_order" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-gray-50 text-gray-700 border-gray-200";
    return <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${color}`}>{kindLabels[k]}</span>;
  };
  const prettySize = (n: number | null) => n == null ? "—" : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        title="Hlaða upp / skoða skjöl fyrir þetta fyrirtæki"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Skjöl
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Skjöl fyrirtækis</h3>
                <p className="text-xs text-gray-500 mt-0.5">Þjónustuskilmálar, vinnslusamningar og verðsamningar sem voru undirritaðir utan kerfisins (t.d. á prentformi).</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Upload form */}
              <section className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/40">
                <div className="text-sm font-semibold text-gray-900">Hlaða upp nýju skjali</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Tegund *</span>
                    <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="tos">Þjónustuskilmálar (ToS)</option>
                      <option value="dpa">Vinnslusamningur (DPA)</option>
                      <option value="purchase_order">Þjónustusamningur / verðsamningur</option>
                      <option value="other">Annað</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Heiti (valfrjálst)</span>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="t.d. Þjónustusamningur 2026–2027"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Nafn undirritanda</span>
                    <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Undirritunardagur</span>
                    <input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Athugasemd</span>
                    <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Samningatímabil, sérmál, o.s.frv."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-xs font-medium text-gray-700 mb-1">PDF-skrá *</span>
                    <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="w-full text-sm" />
                    <p className="text-[11px] text-gray-500 mt-1">Hámark 25 MB. Leyfilegt: PDF, PNG, JPEG.</p>
                  </label>
                </div>
                {msg && (
                  <div className={`text-xs ${msg.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</div>
                )}
                <div className="flex justify-end">
                  <button onClick={submitUpload} disabled={uploading || !file}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50">
                    {uploading ? "Hleð upp…" : "Hlaða upp"}
                  </button>
                </div>
              </section>

              {/* Existing docs */}
              <section>
                <div className="text-sm font-semibold text-gray-900 mb-2">Núverandi skjöl</div>
                {loading ? (
                  <div className="text-xs text-gray-500 py-4 text-center">Sæki…</div>
                ) : docs.length === 0 ? (
                  <div className="text-xs text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg">Engin skjöl eru skráð enn.</div>
                ) : (
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                    {docs.map((d) => (
                      <li key={d.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">{kindPill(d.kind)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{d.title || d.filename}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {d.filename} · {prettySize(d.size_bytes)} · hlaðið upp {new Date(d.uploaded_at).toLocaleDateString("en-GB")}
                          </div>
                          {(d.signer_name || d.signed_at) && (
                            <div className="text-[11px] text-gray-600 mt-0.5">
                              Undirritað {d.signer_name ? `af ${d.signer_name}` : ""}{d.signer_name && d.signed_at ? " · " : ""}{d.signed_at || ""}
                            </div>
                          )}
                          {d.note && <div className="text-[11px] text-gray-500 mt-0.5 whitespace-pre-wrap">{d.note}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {d.signed_url && (
                            <a href={d.signed_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-medium text-blue-700 hover:underline">
                              Opna
                            </a>
                          )}
                          <button onClick={() => deleteDoc(d.id)}
                            className="text-xs font-medium text-red-600 hover:underline">
                            Eyða
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Loka</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// One-click consolidated invoice for a parent (municipality-style)
// company. Aggregates all active subs into one PayDay invoice, billed
// to the parent's billing_contact_email.
type ConsolidatedRow = {
  id: string;
  name: string;
  isParent: boolean;
  quantity: number;
  unitPrice: number;
  defaultQty: number; // for display / "reset"
};

function ConsolidatedInvoiceButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<ConsolidatedRow[]>([]);
  const [notes, setNotes] = useState("");
  const [pastInvoices, setPastInvoices] = useState<{ number: string | null; quantity: number; amount_total: number; status: string; issued_at: string }[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    setNotes("");

    // Parent row
    const { data: parent } = await supabase
      .from("companies")
      .select("id, name, assessment_unit_price")
      .eq("id", companyId)
      .maybeSingle();

    // Sub-divisions (active only)
    const { data: subs } = await supabase
      .from("companies")
      .select("id, name, assessment_unit_price")
      .eq("parent_company_id", companyId)
      .neq("status", "archived")
      .order("name", { ascending: true });

    const parentFallbackPrice = (parent as { assessment_unit_price?: number | null } | null)?.assessment_unit_price || 49900;

    const all = [
      parent ? { ...(parent as { id: string; name: string; assessment_unit_price?: number | null }), isParent: true } : null,
      ...((subs || []) as Array<{ id: string; name: string; assessment_unit_price?: number | null }>).map((s) => ({ ...s, isParent: false })),
    ].filter(Boolean) as Array<{ id: string; name: string; assessment_unit_price?: number | null; isParent: boolean }>;

    // Count employees per company (company_members, falling back to clients)
    const rowsOut: ConsolidatedRow[] = await Promise.all(
      all.map(async (c) => {
        const { count } = await supabase
          .from("company_members")
          .select("id", { count: "exact", head: true })
          .eq("company_id", c.id);
        let qty = count || 0;
        if (qty === 0) {
          const { count: cc } = await supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("company_id", c.id);
          if ((cc || 0) > 0) qty = cc || 0;
        }
        return {
          id: c.id,
          name: c.name,
          isParent: c.isParent,
          quantity: qty,
          defaultQty: qty,
          unitPrice: c.assessment_unit_price || parentFallbackPrice,
        };
      }),
    );
    setRows(rowsOut);

    // Past consolidated invoices on the parent
    const { data: past } = await supabase
      .from("company_invoices")
      .select("payday_invoice_number, quantity, amount_total, status, issued_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5);
    setPastInvoices(
      (past || []).map((i: { payday_invoice_number: string | null; quantity: number; amount_total: number; status: string; issued_at: string }) => ({
        number: i.payday_invoice_number,
        quantity: i.quantity,
        amount_total: i.amount_total,
        status: i.status,
        issued_at: i.issued_at,
      })),
    );

    setLoading(false);
  };

  const updateRow = (id: string, patch: Partial<ConsolidatedRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const send = async () => {
    setSending(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const active = rows.filter((r) => r.quantity > 0);
    const parentRow = rows.find((r) => r.isParent);
    const res = await fetch(`/api/admin/companies/${companyId}/consolidated-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({
        send_email: true,
        create_claim: true,
        notes: notes.trim() || undefined,
        include_parent: !!parentRow && parentRow.quantity > 0,
        subs: active.map((r) => ({ company_id: r.id, quantity: r.quantity, unit_price: r.unitPrice })),
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSending(false);
    setOpen(false);
    if (!res.ok || !j?.ok) {
      const base = j?.detail || j?.error || "Mistókst.";
      let rawMsg = "";
      if (j?.raw) {
        try {
          const r = typeof j.raw === "string" ? j.raw : JSON.stringify(j.raw);
          rawMsg = r.length > 600 ? r.slice(0, 600) + "…" : r;
        } catch { /* ignore */ }
      }
      setToast({ type: "error", text: rawMsg ? `${base}\n\n${rawMsg}` : base });
    } else {
      setToast({
        type: "success",
        text: `Reikningur ${j.invoice_number || j.invoice_id}\n${(j.amount_total ?? 0).toLocaleString("is-IS")} ISK á ${j.lines?.length || 0} línur.`,
      });
    }
  };

  const total = rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  const activeLines = rows.filter((r) => r.quantity > 0).length;

  return (
    <>
      <button
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-colors"
        title="Einn reikningur fyrir móðurfyrirtæki + allar undireiningar"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10M7 11h10M7 15h4M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
        Samheildarreikningur
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-[640px] max-w-[calc(100vw-2rem)] my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 truncate">Samheildarreikningur · {companyName}</h3>
              <p className="text-sm text-gray-500 mt-0.5">Einn PayDay-reikningur · VSK-frjáls (heilbrigðisþjónusta) · 14 daga eindagi</p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-400">Hleð…</div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                {/* Past invoices */}
                {pastInvoices.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fyrri reikningar</p>
                    {pastInvoices.map((inv, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-700 truncate">
                          {inv.number ? `#${inv.number}` : "—"} · {inv.quantity} stk · {inv.amount_total.toLocaleString("is-IS")} ISK
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : inv.status === "sent" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {inv.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Per-sub editable rows */}
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-[1fr_90px_130px_110px] items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <div>Fyrirtæki / deild</div>
                    <div className="text-right">Fjöldi</div>
                    <div className="text-right">Einingaverð</div>
                    <div className="text-right">Samtals</div>
                  </div>
                  {rows.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">Engar deildir fundust.</div>
                  ) : (
                    rows.map((r) => {
                      const rowTotal = r.quantity * r.unitPrice;
                      return (
                        <div
                          key={r.id}
                          className={`grid grid-cols-[1fr_90px_130px_110px] items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 ${r.quantity === 0 ? "opacity-60" : ""}`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {r.isParent && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded">Móðurf.</span>
                              )}
                              <span className="text-sm text-gray-900 truncate">{r.name}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">Sjálfgefið: {r.defaultQty}</div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={r.quantity}
                            onChange={(e) => updateRow(r.id, { quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-2 focus:ring-emerald-300 outline-none"
                          />
                          <input
                            type="number"
                            min={0}
                            value={r.unitPrice}
                            onChange={(e) => updateRow(r.id, { unitPrice: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-2 focus:ring-emerald-300 outline-none"
                          />
                          <div className="text-sm text-gray-700 text-right font-medium tabular-nums">
                            {rowTotal.toLocaleString("is-IS")}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Note */}
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Athugasemd (valfrjáls)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Birtist á reikningnum"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-300 outline-none box-border"
                  />
                </div>

                {/* Total */}
                <div className="bg-emerald-50 rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600">{activeLines} {activeLines === 1 ? "lína" : "línur"} á reikningi</p>
                    <p className="text-xs text-gray-500">VSK-frjáls · heilbrigðisþjónusta</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 shrink-0">{total.toLocaleString("is-IS")} <span className="text-sm font-medium text-gray-500">ISK</span></p>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Hætta við
              </button>
              <button
                onClick={send}
                disabled={sending || loading || activeLines === 0 || total <= 0}
                className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {sending ? "Sendi…" : "Senda reikning"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result toast */}
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setToast(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b border-gray-100 ${toast.type === "success" ? "bg-emerald-50" : "bg-red-50"}`}>
              <h3 className={`text-lg font-semibold ${toast.type === "success" ? "text-emerald-800" : "text-red-800"}`}>
                {toast.type === "success" ? "Reikningur sendur" : "Mistókst"}
              </h3>
            </div>
            <div className="px-6 py-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words font-sans">{toast.text}</pre>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setToast(null)} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                Loka
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GenerateInvoiceButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [employeeCount, setEmployeeCount] = useState(0);
  const [unitPrice, setUnitPrice] = useState(49900);
  const [notes, setNotes] = useState("");

  // Past invoices
  const [pastInvoices, setPastInvoices] = useState<{ number: string | null; quantity: number; amount_total: number; status: string; issued_at: string }[]>([]);

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    setNotes("");
    // Fetch employee count, pricing, and past invoices
    const [{ count }, { data: po }, { data: invoices }] = await Promise.all([
      supabase.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("b2b_purchase_orders").select("line_items").eq("company_id", companyId).eq("status", "signed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("company_invoices").select("payday_invoice_number, quantity, amount_total, status, issued_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(5),
    ]);
    setEmployeeCount(count || 0);
    if (po?.line_items && Array.isArray(po.line_items) && po.line_items.length > 0) {
      setUnitPrice((po.line_items[0] as { unit_price_isk?: number }).unit_price_isk || 49900);
    }
    setPastInvoices((invoices || []).map((i: any) => ({ number: i.payday_invoice_number, quantity: i.quantity, amount_total: i.amount_total, status: i.status, issued_at: i.issued_at })));
    setLoading(false);
  };

  const send = async () => {
    setSending(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/admin/companies/${companyId}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ unit_price: unitPrice, quantity: employeeCount, notes: notes.trim() || undefined }),
    });
    const j = await res.json();
    setSending(false);
    setOpen(false);
    if (!res.ok) setToast({ type: "error", text: `Failed: ${j.detail || j.error || "unknown"}\n\nPayDay response:\n${JSON.stringify(j.raw || "none", null, 2)}` });
    else setToast({ type: "success", text: `Invoice created${j.payday_invoice_number ? ` · #${j.payday_invoice_number}` : ""}\n\n${j.quantity} employees × ${j.unit_price.toLocaleString()} ISK = ${j.amount_total.toLocaleString()} ISK\nVAT exempt (health services) · Eindagi: 14 days` });
  };

  const total = employeeCount * unitPrice;

  return (
    <>
      <button onClick={openDialog} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">Invoice</button>

      {/* Invoice dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 truncate">Invoice for {companyName}</h3>
              <p className="text-sm text-gray-500 mt-0.5">PayDay · VAT exempt · 14-day eindagi</p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading…</div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                {/* Past invoices */}
                {pastInvoices.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Previous invoices</p>
                    {pastInvoices.map((inv, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-700 truncate">
                          {inv.number ? `#${inv.number}` : "—"} · {inv.quantity} emp · {inv.amount_total.toLocaleString()} ISK
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : inv.status === "sent" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {inv.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Editable fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Employees</label>
                    <input
                      type="number" min={1} value={employeeCount}
                      onChange={(e) => setEmployeeCount(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-300 outline-none box-border"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Unit price (ISK)</label>
                    <input
                      type="number" min={0} value={unitPrice}
                      onChange={(e) => setUnitPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-300 outline-none box-border"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Note (optional)</label>
                  <input
                    type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Appears on the invoice line item"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-300 outline-none box-border"
                  />
                </div>

                {/* Total */}
                <div className="bg-emerald-50 rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600">{employeeCount} × {unitPrice.toLocaleString()} ISK</p>
                    <p className="text-xs text-gray-500">VAT exempt · health services</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 shrink-0">{total.toLocaleString()} <span className="text-sm font-medium text-gray-500">ISK</span></p>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={send} disabled={sending || loading || employeeCount <= 0} className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {sending ? "Sending…" : pastInvoices.length > 0 ? "Send new invoice" : "Send invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result toast */}
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setToast(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`px-5 py-3 rounded-t-xl text-sm font-semibold ${toast.type === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
              {toast.type === "error" ? "Error" : "Invoice sent"}
            </div>
            <pre className="px-5 py-4 text-sm text-gray-800 whitespace-pre-wrap break-words select-all font-mono leading-relaxed">
              {toast.text}
            </pre>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setToast(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EnsureGroupButton({ companyId }: { companyId: string }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch("/api/admin/biody/ensure-group", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ company_id: companyId }),
    });
    const j = await res.json();
    if (j.ok && j.biody_group_id) alert(`Biody group ready: id ${j.biody_group_id}`);
    else alert(`Failed: ${j.error || JSON.stringify(j)}`);
    setBusy(false);
  };
  return (
    <button onClick={click} disabled={busy} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors">
      {busy ? "Creating…" : "Biody group"}
    </button>
  );
}

function BulkActivateButton({ companyId }: { companyId: string }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (!confirm("Create all employees of this company as patients in Biody? Skips anyone already created.")) return;
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch("/api/admin/biody/bulk-activate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ company_id: companyId }),
    });
    const j = await res.json();
    const failures = (j.results || []).filter((r: { ok: boolean }) => !r.ok);
    const summary = `Processed ${j.processed ?? 0} · created ${j.succeeded ?? 0} · failed ${j.failed ?? 0}`;
    if (failures.length) {
      const detail = failures.map((r: { client_id: string; error?: string }) => `• ${r.client_id}: ${r.error}`).join("\n");
      alert(`${summary}\n\nErrors:\n${detail}`);
    } else {
      alert(summary);
    }
    setBusy(false);
  };
  return (
    <button onClick={click} disabled={busy} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
      {busy ? "Creating…" : "Create all in Biody"}
    </button>
  );
}

function DeleteCompanyButton({ company, onDone }: { company: CompanyRow; onDone: () => void }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <button onClick={() => setShowModal(true)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
        Delete
      </button>
      {showModal && (
        <DeleteConfirmModal
          title={`Delete ${company.name}`}
          description={`This will permanently delete the company "${company.name}" and all ${company.member_count} roster entries. Employee Lifeline accounts will be preserved but unlinked from this company.`}
          onCancel={() => setShowModal(false)}
          onConfirm={async () => {
            const { data: s } = await supabase.auth.getSession();
            const t = s.session?.access_token;
            const res = await fetch(`/api/admin/companies/${company.id}`, {
              method: "DELETE",
              headers: t ? { Authorization: `Bearer ${t}` } : {},
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || "Delete failed");
            setShowModal(false);
            onDone();
          }}
        />
      )}
    </>
  );
}

function MemberStatus({ m }: { m: MemberRow }) {
  if (!m.invited_at && !m.completed_at) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Draft</span>;
  }
  if (m.invited_at && !m.completed_at) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Invited{m.invite_sent_count > 1 ? ` (${m.invite_sent_count}×)` : ""}</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Completed</span>;
}

function DataDot({ m }: { m: MemberRow }) {
  if (!m.completed_at) return <span className="text-gray-300">—</span>;
  if (m.profile_complete && m.biody_activated) {
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500" />Ready</span>;
  }
  if (m.profile_complete) {
    return <span className="inline-flex items-center gap-1 text-xs text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-500" />Needs activation</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs text-red-700"><span className="w-2 h-2 rounded-full bg-red-500" />Incomplete</span>;
}

function EmployeeRows({ companyId }: { companyId: string }) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("list_company_members", { p_company_id: companyId });
      if (error) setErr(error.message);
      else setMembers((data || []) as MemberRow[]);
    })();
  }, [companyId]);

  if (err) return <tr><td colSpan={8} className="px-4 py-3 text-red-600 text-xs">{err}</td></tr>;
  if (!members) return <tr><td colSpan={8} className="px-4 py-3 text-gray-500 text-xs">Loading employees…</td></tr>;
  if (members.length === 0) return <tr><td colSpan={8} className="px-4 py-3 text-gray-500 text-xs italic">No employees on roster.</td></tr>;

  return (
    <>
      {members.map((m) => (
        <tr key={m.id} className="border-t border-gray-50 bg-gray-50/60">
          <td className="pl-12 pr-4 py-2 text-sm font-medium">{m.full_name}</td>
          <td className="px-4 py-2 text-sm text-gray-700">{m.email}</td>
          <td className="px-4 py-2 text-xs text-gray-500 font-mono">•••••{m.kennitala_last4 || ""}</td>
          <td className="px-4 py-2 text-sm text-gray-700">{m.phone || "—"}</td>
          <td className="px-4 py-2"><MemberStatus m={m} /></td>
          <td className="px-4 py-2"><DataDot m={m} /></td>
          <td className="px-4 py-2 text-xs text-gray-500">
            {m.completed_at
              ? `Done ${new Date(m.completed_at).toLocaleDateString()}`
              : m.invited_at
                ? `Invited ${new Date(m.invited_at).toLocaleDateString()}`
                : `Added ${new Date(m.created_at).toLocaleDateString()}`}
          </td>
          <td className="px-4 py-2"></td>
        </tr>
      ))}
    </>
  );
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [rpcRes, tiersRes] = await Promise.all([
      supabase.rpc("list_all_companies"),
      supabase.from("companies").select("id, name, default_tier, status, contact_draft_email, contact_draft_name, parent_company_id"),
    ]);
    if (rpcRes.error) setError(rpcRes.error.message);
    else {
      type ExtraRow = { id: string; name: string; default_tier: string | null; status: CompanyRow["status"]; contact_draft_email: string | null; contact_draft_name: string | null; parent_company_id: string | null };
      const extraMap = new Map<string, ExtraRow>((tiersRes.data || []).map((t: ExtraRow) => [t.id, t]));
      const rows = ((rpcRes.data || []) as CompanyRow[]).map((c) => {
        const extra = extraMap.get(c.id);
        const parentId = extra?.parent_company_id || null;
        const parentName = parentId ? (extraMap.get(parentId)?.name || null) : null;
        return {
          ...c,
          default_tier: extra?.default_tier || null,
          status: extra?.status || "active",
          contact_draft_email: extra?.contact_draft_email || null,
          contact_draft_name: extra?.contact_draft_name || null,
          parent_company_id: parentId,
          parent_name: parentName,
        };
      });
      // Tree order: parents first (sorted by name), each followed immediately
      // by its children (sorted by name). Orphans (parent_id pointing at a
      // non-existent company) fall through to the bottom alphabetically.
      const parents = rows.filter((r) => !r.parent_company_id).sort((a, b) => a.name.localeCompare(b.name));
      const childrenByParent = new Map<string, CompanyRow[]>();
      for (const r of rows) {
        if (r.parent_company_id) {
          const arr = childrenByParent.get(r.parent_company_id) || [];
          arr.push(r);
          childrenByParent.set(r.parent_company_id, arr);
        }
      }
      for (const arr of childrenByParent.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
      const ordered: CompanyRow[] = [];
      for (const p of parents) {
        ordered.push(p);
        const kids = childrenByParent.get(p.id) || [];
        ordered.push(...kids);
      }
      // Orphan children (parent missing): append to the end
      const seen = new Set(ordered.map((r) => r.id));
      for (const r of rows) if (!seen.has(r.id)) ordered.push(r);
      setCompanies(ordered);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadCsv = async (companyId: string, companyName: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`/api/admin/companies/${companyId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { alert("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${companyName.replace(/[^a-z0-9]+/gi, "-")}-roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary counts for the table header
  const parentCount = companies.filter((c) => !c.parent_company_id).length;
  const subCount = companies.filter((c) => !!c.parent_company_id).length;
  const draftCount = companies.filter((c) => c.status === "draft" || c.status === "contact_invited").length;
  const readyCount = companies.filter((c) => c.registration_finalized_at).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Click a company to expand its roster. Parent rows show their sub-divisions nested beneath.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/companies/create" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 hover:opacity-95 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Admin stofna fyrirtæki
          </Link>
          <Link href="/business/signup" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
            Self-serve signup
          </Link>
        </div>
      </div>

      {/* Summary chips */}
      {!loading && companies.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            {parentCount} {parentCount === 1 ? "parent" : "parents"}
          </span>
          {subCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              {subCount} sub-{subCount === 1 ? "division" : "divisions"}
            </span>
          )}
          {draftCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {draftCount} awaiting onboard
            </span>
          )}
          {readyCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {readyCount} ready
            </span>
          )}
        </div>
      )}

      {loading && <div className="text-gray-500">Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && companies.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-gray-500">
          No companies yet.
        </div>
      )}
      {companies.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/70 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const isSub = !!c.parent_company_id;
                const isParentWithSubs = !isSub && companies.some((o) => o.parent_company_id === c.id);
                return (
                <Fragment key={c.id}>
                  <tr className={`border-t border-gray-100 hover:bg-gray-50/60 transition-colors ${isSub ? "bg-slate-50/40" : "bg-white"}`}>
                    {/* Company */}
                    <td className="px-5 py-3 align-top">
                      <div className={`flex items-start gap-2 ${isSub ? "pl-6" : ""}`}>
                        {isSub && (
                          <span className="text-slate-300 select-none mt-0.5" aria-hidden>└</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => toggleExpand(c.id)}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:underline text-left"
                            title="Show employees"
                          >
                            <svg
                              className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${expanded.has(c.id) ? "rotate-90" : ""}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="truncate">{c.name}</span>
                          </button>
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <CompanyStatusPill c={c} />
                            {isSub && c.parent_name && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                                title={`Reikningur gengur upp á ${c.parent_name}`}
                              >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                </svg>
                                Bílag til {c.parent_name}
                              </span>
                            )}
                            {isParentWithSubs && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200" title="Has sub-divisions">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                                Parent
                              </span>
                            )}
                          </div>
                          {c.registration_finalized_at && (
                            <div className="text-[11px] text-gray-400 mt-1">
                              Ready · {c.finalized_by_name || c.finalized_by_email || "—"} · {new Date(c.registration_finalized_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3 align-top">
                      <div className="text-[13px] text-gray-700 truncate max-w-[220px]" title={c.contact_email || ""}>
                        {c.contact_email || <span className="text-gray-300">—</span>}
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3 align-top">
                      <RosterProgressCell c={c} />
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-3 align-top">
                      <select
                        value={c.default_tier || ""}
                        onChange={async (e) => {
                          const tier = e.target.value || null;
                          await supabase.from("companies").update({ default_tier: tier }).eq("id", c.id);
                          setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, default_tier: tier } : x));
                        }}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white hover:border-gray-300 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none"
                      >
                        {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 align-top text-[12px] text-gray-500 whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/business/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                          title="Open company dashboard"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open
                        </Link>
                        <GenerateInvoiceButton companyId={c.id} companyName={c.name} />
                        <OverflowMenu>
                          {(close) => (
                            <div className="flex flex-col items-stretch gap-1.5 px-2 py-2">
                              {(c.status === "draft" || c.status === "contact_invited") && (
                                <InviteContactButton companyId={c.id} draftEmail={c.contact_draft_email || null} status={c.status} />
                              )}
                              {isParentWithSubs && (
                                <ConsolidatedInvoiceButton companyId={c.id} companyName={c.name} />
                              )}
                              <DocumentsButton companyId={c.id} />
                              <div className="border-t border-gray-100 my-0.5" />
                              <BulkBiodyButton
                                companyId={c.id}
                                companyName={c.name}
                                parentName={c.parent_company_id ? c.parent_name || null : null}
                                hasChildren={isParentWithSubs}
                              />
                              <EnsureGroupButton companyId={c.id} />
                              <BulkActivateButton companyId={c.id} />
                              <div className="border-t border-gray-100 my-0.5" />
                              <button
                                onClick={() => { downloadCsv(c.id, c.name); close(); }}
                                className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                                </svg>
                                Export CSV
                              </button>
                              <div className="border-t border-gray-100 my-0.5" />
                              <DeleteCompanyButton company={c} onDone={load} />
                            </div>
                          )}
                        </OverflowMenu>
                      </div>
                    </td>
                  </tr>
                  {expanded.has(c.id) && <EmployeeRows companyId={c.id} />}
                </Fragment>
              );})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

