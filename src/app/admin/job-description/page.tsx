"use client";

// Admin job-description workspace. Left rail lists every recruiting
// document; the right pane is the editor (JobDescriptionDoc), shared
// with the public /verkefnalysing mirror so the two never drift.
//
// Documents are stored via /api/job-description (multi-doc CRUD). Each
// has a title, optional candidate, and a status that progresses toward
// a signed employment contract (Phase 2).

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/app/components/BackButton";
import { DEFAULTS, JobDescriptionDoc, type DocFields } from "./JobDescriptionDoc";

const DEFAULT_DOC_ID = "framkvaemdastjori";

type SaveState = "idle" | "saving" | "saved" | "error";

interface DocMeta {
  id: string;
  title: string;
  candidate_name: string | null;
  candidate_email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Drög",
  sent: "Sent",
  agreed: "Samþykkt",
  contract_sent: "Samningur sendur",
  signed: "Undirritað",
  archived: "Geymt",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-700",
  agreed: "bg-amber-50 text-amber-700",
  contract_sent: "bg-violet-50 text-violet-700",
  signed: "bg-emerald-50 text-emerald-700",
  archived: "bg-gray-100 text-gray-400",
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export default function JobDescriptionWorkspace() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fields, setFields] = useState<DocFields>(DEFAULTS);
  const [meta, setMeta] = useState<{ title: string; candidate_name: string; candidate_email: string; status: string }>({
    title: "", candidate_name: "", candidate_email: "", status: "draft",
  });
  const [save, setSave] = useState<SaveState>("idle");
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load the document list once.
  const loadList = useCallback(async (selectId?: string) => {
    try {
      const res = await fetch("/api/job-description", { headers: await authHeaders() });
      if (!res.ok) return;
      const j = await res.json();
      const list: DocMeta[] = j.documents ?? [];
      setDocs(list);
      if (!activeId && list.length > 0) {
        setActiveId(selectId ?? list[0].id);
      } else if (selectId) {
        setActiveId(selectId);
      }
    } catch { /* offline — keep what we have */ }
  }, [activeId]);

  useEffect(() => { loadList(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the active document's fields + meta when the selection changes.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      setLoadingDoc(true);
      try {
        const res = await fetch(`/api/job-description?id=${encodeURIComponent(activeId)}`, { headers: await authHeaders() });
        if (res.ok) {
          const j = await res.json();
          const d = j.document;
          if (!cancelled && d) {
            setFields({ ...DEFAULTS, ...(d.fields as Partial<DocFields>) });
            setMeta({
              title: d.title ?? "",
              candidate_name: d.candidate_name ?? "",
              candidate_email: d.candidate_email ?? "",
              status: d.status ?? "draft",
            });
          }
        }
      } catch { /* keep current */ }
      finally { if (!cancelled) setLoadingDoc(false); }
    })();
    return () => { cancelled = true; };
  }, [activeId]);

  const persist = useCallback(async (nextFields: DocFields, nextMeta?: Partial<typeof meta>) => {
    if (!activeId) return;
    setSave("saving");
    try {
      const res = await fetch("/api/job-description", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ id: activeId, fields: nextFields, ...(nextMeta ?? {}) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSave("saved");
      // Refresh the list so title / status changes show in the rail.
      const j = await res.json().catch(() => null);
      if (j?.document) setDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, ...j.document } : d)));
      setTimeout(() => setSave((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch {
      setSave("error");
    }
  }, [activeId]);

  // Debounced field edits.
  const set = (k: keyof DocFields) => (v: string) => {
    setFields((prev) => {
      const next = { ...prev, [k]: v };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(next), 600);
      return next;
    });
  };

  const setMetaField = (k: keyof typeof meta) => (v: string) => {
    setMeta((prev) => {
      const next = { ...prev, [k]: v };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(fields, next), 600);
      return next;
    });
  };

  const createDoc = async () => {
    const title = prompt("Titill á nýrri verkefnalýsingu:", "Ný staða");
    if (title === null) return;
    try {
      const res = await fetch("/api/job-description", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ title: title.trim() || "Ný staða" }),
      });
      if (!res.ok) { alert("Gat ekki búið til skjal."); return; }
      const j = await res.json();
      await loadList(j.document?.id);
      setActiveId(j.document?.id ?? null);
    } catch { alert("Gat ekki búið til skjal."); }
  };

  const deleteDoc = async (id: string) => {
    if (id === DEFAULT_DOC_ID) { alert("Ekki er hægt að eyða sjálfgefna skjalinu."); return; }
    if (!confirm("Eyða þessari verkefnalýsingu? Þetta er óafturkræft.")) return;
    try {
      const res = await fetch(`/api/job-description?id=${encodeURIComponent(id)}`, {
        method: "DELETE", headers: await authHeaders(),
      });
      if (!res.ok) { alert("Gat ekki eytt skjali."); return; }
      setDocs((prev) => prev.filter((d) => d.id !== id));
      if (activeId === id) setActiveId(DEFAULT_DOC_ID);
    } catch { alert("Gat ekki eytt skjali."); }
  };

  // Copy a password-gated online link to this specific proposal — the
  // recommended way to share (no PDF pagination, always up to date).
  const shareLink = async () => {
    if (!activeId) return;
    const url = `${window.location.origin}/verkefnalysing?id=${encodeURIComponent(activeId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Hlekkur afritaður · aðgangsorð: lifeline");
    } catch {
      setShareNote(url);
    }
    setTimeout(() => setShareNote(null), 6000);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Left rail: document list ─────────────────────────── */}
      <aside className="jd-noprint w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-3 pt-3">
          <BackButton fallback="/admin/settings" label="Back to Settings" />
        </div>
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Verkefnalýsingar</h2>
          <button
            type="button"
            onClick={createDoc}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            + Ný
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {docs.length === 0 ? (
            <p className="px-4 py-6 text-xs text-gray-400">Engin skjöl enn.</p>
          ) : (
            docs.map((d) => {
              const active = d.id === activeId;
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveId(d.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                    active ? "bg-emerald-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold truncate ${active ? "text-emerald-700" : "text-gray-900"}`}>
                      {d.title || "Untitled"}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[d.status] ?? STATUS_COLOR.draft}`}>
                      {STATUS_LABEL[d.status] ?? d.status}
                    </span>
                  </div>
                  {d.candidate_name && (
                    <span className="block text-[11px] text-gray-500 mt-0.5 truncate">{d.candidate_name}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right pane: editor ───────────────────────────────── */}
      <main className="flex-1 min-w-0 px-8 py-6">
        {!activeId ? (
          <div className="max-w-3xl mx-auto text-center py-24 text-gray-400 text-sm">
            Veldu skjal til vinstri eða búðu til nýtt.
          </div>
        ) : (
          <>
            <div className="jd-noprint max-w-3xl mx-auto mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <input
                    value={meta.title}
                    onChange={(e) => setMetaField("title")(e.target.value)}
                    placeholder="Titill skjals"
                    className="w-full text-xl font-bold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-emerald-400"
                  />
                  <div className="flex flex-wrap gap-3 mt-2">
                    <input
                      value={meta.candidate_name}
                      onChange={(e) => setMetaField("candidate_name")(e.target.value)}
                      placeholder="Nafn umsækjanda"
                      className="text-sm text-gray-700 bg-gray-100 rounded-md px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                    <input
                      value={meta.candidate_email}
                      onChange={(e) => setMetaField("candidate_email")(e.target.value)}
                      placeholder="Netfang umsækjanda"
                      type="email"
                      className="text-sm text-gray-700 bg-gray-100 rounded-md px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    <strong>Deila hlekk</strong> sendir lykilorðsvarinn vefhlekk (mælt með) · <strong>Forskoða</strong> sýnir útgáfu umsækjanda.
                    {save === "saving" && <span className="text-gray-400"> · Vista…</span>}
                    {save === "saved" && <span className="text-emerald-600 font-medium"> · Vistað</span>}
                    {save === "error" && <span className="text-amber-600 font-medium"> · Vistun mistókst</span>}
                    {loadingDoc && <span className="text-gray-400"> · Hleð…</span>}
                  </p>
                  {shareNote && (
                    <p className="text-xs text-emerald-700 font-medium mt-1 break-all">{shareNote}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {activeId !== DEFAULT_DOC_ID && (
                    <button
                      type="button"
                      onClick={() => deleteDoc(activeId)}
                      className="text-xs font-medium px-3 py-2 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50"
                    >
                      Eyða
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="text-sm font-medium px-4 py-2 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Forskoða
                  </button>
                  <button
                    type="button"
                    onClick={shareLink}
                    className="text-sm font-semibold px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Deila hlekk
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="text-sm font-medium px-4 py-2 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    title="Prentun er varaleið — mælt er með að deila hlekk."
                  >
                    Prenta / PDF
                  </button>
                </div>
              </div>
            </div>

            <JobDescriptionDoc fields={fields} set={set} />

            <ContractPanel
              jobId={activeId}
              candidateName={meta.candidate_name || fields.applicantName}
              candidateEmail={meta.candidate_email}
              onChanged={() => loadList(activeId)}
            />

            {previewOpen && (
              <Modal title="Forskoðun — útgáfa umsækjanda" onClose={() => setPreviewOpen(false)} wide>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <JobDescriptionDoc fields={fields} readOnly embedded />
                </div>
              </Modal>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── Shared modal overlay ──────────────────────────────────────────────
function Modal({
  title, onClose, children, wide,
}: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="jd-noprint fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div
        className={`my-4 w-full ${wide ? "max-w-4xl" : "max-w-2xl"} rounded-xl bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 sticky top-0 bg-white rounded-t-xl">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Phase 2: employment-contract send + status ────────────────────────
interface ContractRow {
  id: string;
  status: string;
  candidate_name: string;
  signed_at: string | null;
  created_at: string;
  pdf_storage_path: string | null;
}

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  sent: "Sendur — bíður undirritunar",
  signed: "Undirritað",
  void: "Felldur úr gildi",
};
const CONTRACT_STATUS_COLOR: Record<string, string> = {
  sent: "bg-blue-50 text-blue-700",
  signed: "bg-emerald-50 text-emerald-700",
  void: "bg-gray-100 text-gray-400",
};

function ContractPanel({
  jobId, candidateName, candidateEmail, onChanged,
}: {
  jobId: string; candidateName: string; candidateEmail: string; onChanged: () => void;
}) {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/employment-contract?job_description_id=${encodeURIComponent(jobId)}`, { headers: await authHeaders() });
      if (res.ok) { const j = await res.json(); setContracts(j.contracts ?? []); }
    } catch { /* keep current */ }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const errMap: Record<string, string> = {
    candidate_email_required: "Skráðu netfang umsækjanda fyrst.",
    candidate_name_required: "Skráðu nafn umsækjanda fyrst.",
    mfa_required: "Tveggja þátta auðkenning þarf til að senda samning.",
    already_signed: "Samningurinn er þegar undirritaður.",
    not_resendable: "Aðeins er hægt að endursenda samning sem bíður undirritunar.",
  };

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote((n) => (n === m ? null : n)), 2500); };

  const preview = async () => {
    setPreviewLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/employment-contract?preview_job_id=${encodeURIComponent(jobId)}`, { headers: await authHeaders() });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(errMap[j.error] ?? "Gat ekki forskoðað samning."); return; }
      setPreviewText(j.preview?.contract_text ?? "");
    } catch {
      setErr("Gat ekki forskoðað samning.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const send = async () => {
    if (!candidateEmail.trim()) { setErr("Skráðu netfang umsækjanda að ofan fyrst."); return; }
    if (!confirm(`Senda ráðningarsamning á ${candidateEmail}? Samningurinn byggir á samþykktu dálkunum í samantekt kjara.`)) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch("/api/employment-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ job_description_id: jobId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(errMap[j.error] ?? "Tókst ekki að senda samning."); return; }
      await load();
      onChanged();
      flash("Samningur sendur.");
    } catch {
      setErr("Tókst ekki að senda samning.");
    } finally {
      setSending(false);
    }
  };

  const patch = async (id: string, action: "resend" | "void") => {
    if (action === "void" && !confirm("Fella þennan samning úr gildi? Hlekkurinn hættir að virka.")) return;
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/employment-contract", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ id, action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(errMap[j.error] ?? "Aðgerð mistókst."); return; }
      await load();
      onChanged();
      flash(action === "resend" ? "Tölvupóstur endursendur." : "Samningur felldur úr gildi.");
    } catch {
      setErr("Aðgerð mistókst.");
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (id: string) => {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/employment-contract?id=${encodeURIComponent(id)}`, { headers: await authHeaders() });
      const j = await res.json().catch(() => ({}));
      const token = j.contract?.token;
      if (!token) { setErr("Fann ekki hlekk."); return; }
      const url = `${window.location.origin}/radningarsamningur/${token}`;
      await navigator.clipboard.writeText(url);
      flash("Undirritunarhlekkur afritaður.");
    } catch {
      setErr("Gat ekki afritað hlekk.");
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/employment-contract?id=${encodeURIComponent(id)}`, { headers: await authHeaders() });
      if (!res.ok) return;
      const j = await res.json();
      if (j.pdf_url) window.open(j.pdf_url, "_blank", "noopener");
    } catch { /* ignore */ }
    finally { setBusyId(null); }
  };

  const actionBtn = "shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40";

  return (
    <div className="jd-noprint max-w-3xl mx-auto mt-6 bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h3 className="text-sm font-bold text-gray-900">Ráðningarsamningur</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={preview}
            disabled={previewLoading}
            className="text-sm font-medium px-4 py-2 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {previewLoading ? "Hleð…" : "Forskoða samning"}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="text-sm font-semibold px-4 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {sending ? "Sendi…" : "Senda til undirritunar"}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Byggir á samþykktu dálkunum í „Samantekt kjara“ og umsækjanda{candidateName ? ` (${candidateName})` : ""}.
        Sendur á <code className="bg-gray-100 px-1 py-0.5 rounded">{candidateEmail || "— vantar netfang —"}</code>.
      </p>
      {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
      {note && <p className="text-emerald-600 text-sm mb-3">{note}</p>}

      {contracts.length === 0 ? (
        <p className="text-xs text-gray-400">Enginn samningur sendur enn.</p>
      ) : (
        <ul className="space-y-2">
          {contracts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 rounded-md px-3 py-2">
              <div className="min-w-0">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONTRACT_STATUS_COLOR[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                </span>
                <span className="block text-[11px] text-gray-500 mt-1">
                  {c.signed_at
                    ? `Undirritað ${new Date(c.signed_at).toLocaleString("is-IS")}`
                    : `Sendur ${new Date(c.created_at).toLocaleString("is-IS")}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {c.status === "sent" && (
                  <>
                    <button type="button" disabled={busyId === c.id} onClick={() => copyLink(c.id)} className={actionBtn}>Afrita hlekk</button>
                    <button type="button" disabled={busyId === c.id} onClick={() => patch(c.id, "resend")} className={actionBtn}>Endursenda</button>
                    <button type="button" disabled={busyId === c.id} onClick={() => patch(c.id, "void")} className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40">Ógilda</button>
                  </>
                )}
                {c.pdf_storage_path && (
                  <button type="button" disabled={busyId === c.id} onClick={() => downloadPdf(c.id)} className={actionBtn}>Sækja PDF</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {previewText !== null && (
        <Modal title="Forskoðun ráðningarsamnings" onClose={() => setPreviewText(null)}>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
            Drög — lögfræðitexti merktur <code>[LÖGFRÆÐITEXTI]</code> er enn til útfyllingar.
          </p>
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-gray-800">{previewText}</pre>
        </Modal>
      )}
    </div>
  );
}
