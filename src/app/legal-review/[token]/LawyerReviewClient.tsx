"use client";

// The no-login review surface for external counsel. Rendered only when
// the server has already validated the token. The lawyer identifies
// themselves once (name + email, kept in localStorage for convenience);
// every redline save and every approval is POSTed to a token-gated API
// that re-validates the token and records the asserted identity + IP +
// timestamp + sha256 of the exact text.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CopyButton from "@/app/admin/legal/drafts/CopyButton";
import { LOCATION_BADGE } from "@/app/admin/legal/drafts/locationBadge";
import type { LocationGroup, ResolvedDoc, DocLanguage } from "@/lib/legal-doc-registry";

export interface SignoffRow {
  id: string;
  document_key: string;
  document_version: string;
  status: "pending" | "under_review" | "approved" | "changes_requested" | "rejected";
  comments: string | null;
  reviewer_name: string;
  reviewer_email: string | null;
  reviewer_via: string | null;
  signed_at: string | null;
  created_at: string;
}

type Status = SignoffRow["status"];
type Action = "comment" | "approve" | "request_changes" | "reject";

const LANG_LABEL: Record<DocLanguage, string> = { is: "Íslenska", en: "English" };

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-gray-100 text-gray-700",
  under_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  changes_requested: "bg-orange-100 text-orange-800",
  rejected: "bg-red-100 text-red-800",
};
const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending review",
  under_review: "Under review",
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};
const ACTION_LABELS: Record<Action, string> = {
  comment: "Add comment",
  approve: "Approve & sign",
  request_changes: "Request changes",
  reject: "Reject",
};
const ACTION_STYLES: Record<Action, string> = {
  comment: "bg-gray-700 text-white hover:bg-gray-800",
  approve: "bg-emerald-600 text-white hover:bg-emerald-700",
  request_changes: "bg-orange-500 text-white hover:bg-orange-600",
  reject: "bg-red-600 text-white hover:bg-red-700",
};

interface Identity { name: string; email: string; }

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function suggestNextVersion(current: string): string {
  const m = current.match(/^v?(\d+)\.(\d+)/);
  if (!m) return `${current}-rev`;
  return `v${m[1]}.${parseInt(m[2], 10) + 1}`;
}

export default function LawyerReviewClient({
  token,
  linkLabel,
  groups,
  signoffs,
}: {
  token: string;
  linkLabel: string | null;
  groups: LocationGroup[];
  signoffs: Record<string, SignoffRow[]>;
}) {
  const [identity, setIdentity] = useState<Identity>({ name: "", email: "" });
  const [savedIdentity, setSavedIdentity] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    // Hydrate identity from localStorage after mount. Deferred to a
    // microtask so setState isn't called synchronously in the effect
    // body (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      try {
        const name = localStorage.getItem("llr_name") || "";
        const email = localStorage.getItem("llr_email") || "";
        setNameInput(name);
        setEmailInput(email);
        if (name && email) {
          setIdentity({ name, email });
          setSavedIdentity(true);
        }
      } catch { /* ignore */ }
    });
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim());
  const canSaveIdentity = nameInput.trim().length > 1 && emailValid;

  const saveIdentity = () => {
    const next = { name: nameInput.trim(), email: emailInput.trim() };
    setIdentity(next);
    setSavedIdentity(true);
    try {
      localStorage.setItem("llr_name", next.name);
      localStorage.setItem("llr_email", next.email);
    } catch { /* ignore */ }
  };

  const totalDocs = groups.reduce((n, g) => n + g.docs.length, 0);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lifeline-logo-rebrand.svg" alt="Lifeline" className="h-7 w-auto" />
            <div>
              <h1 className="text-base font-bold text-[#1F2937]">Legal document review</h1>
              <p className="text-xs text-gray-500">{linkLabel || "External counsel review"} · {totalDocs} documents</p>
            </div>
          </div>
          {savedIdentity && (
            <div className="text-xs text-gray-500 text-right">
              Signed in as <span className="font-medium text-gray-700">{identity.name}</span>
              <button
                onClick={() => setSavedIdentity(false)}
                className="ml-2 underline underline-offset-2 hover:text-gray-700"
              >
                change
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-6">
        {/* Identity gate */}
        {!savedIdentity && (
          <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1F2937]">Identify yourself to edit or approve</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              You can read every document without this. To save a redline or record an approval we need
              your name and email — they are stored with each action (plus IP + timestamp) as a record of
              who reviewed what.
            </p>
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <label className="text-xs font-medium text-gray-700">
                Full name
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Ragnar Jónsson"
                  className="mt-1 block w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                />
              </label>
              <label className="text-xs font-medium text-gray-700">
                Email
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@lawfirm.is"
                  className="mt-1 block w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                />
              </label>
              <button
                onClick={saveIdentity}
                disabled={!canSaveIdentity}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Location index */}
        <nav className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Documents by location</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
            {groups.map((g) => (
              <li key={g.location}>
                <a href={`#g-${g.location}`} className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2">
                  {g.title}
                </a>
                <span className="text-gray-400 ml-1.5">({g.docs.length})</span>
              </li>
            ))}
          </ul>
        </nav>

        {groups.map((group) => (
          <section key={group.location} id={`g-${group.location}`} className="space-y-4 scroll-mt-4">
            <div className="flex items-start gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold mt-0.5 ${LOCATION_BADGE[group.location].className}`}>
                {LOCATION_BADGE[group.location].label}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[#1F2937]">{group.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{group.blurb}</p>
              </div>
            </div>
            {group.docs.map((doc) => (
              <LawyerDocCard
                key={doc.id}
                token={token}
                doc={doc}
                identity={savedIdentity ? identity : null}
                signoffs={signoffs[doc.id] || []}
              />
            ))}
          </section>
        ))}

        <footer className="text-center text-xs text-gray-400 py-8">
          Lifeline Health ehf. · This review link is confidential. Please don&apos;t forward it.
        </footer>
      </div>
    </main>
  );
}

function LawyerDocCard({
  token,
  doc,
  identity,
  signoffs,
}: {
  token: string;
  doc: ResolvedDoc;
  identity: Identity | null;
  signoffs: SignoffRow[];
}) {
  const router = useRouter();
  const [lang, setLang] = useState<DocLanguage>(doc.sourceLanguage);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [editorVersion, setEditorVersion] = useState("");
  const [editorNote, setEditorNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const sourceText = doc.text[lang];
  const otherLang: DocLanguage = lang === "is" ? "en" : "is";
  const hasTranslation = sourceText !== null;
  const draftMeta = doc.drafts?.[lang] ?? null;

  const placeholder = `[${lang === "en" ? "English" : "Icelandic"} translation not yet drafted]
This document is maintained in ${LANG_LABEL[doc.sourceLanguage]} only. Toggle to ${LANG_LABEL[doc.sourceLanguage]} to read the source version.`;
  const displayText = hasTranslation ? (sourceText as string) : placeholder;
  const dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(displayText);
  const downloadName = `${doc.filenameBase}-${lang}.txt`;

  // The signoff status tracks the source-language document + its version.
  const docVersion = draftMeta?.proposed_version || doc.version;
  const relevant = useMemo(
    () => signoffs.filter((s) => s.document_version === docVersion),
    [signoffs, docVersion],
  );
  const latest = relevant[0] || null;
  const latestStatus: Status = latest?.status || "pending";

  const openEditor = () => {
    setEditorText(displayText);
    setEditorVersion(suggestNextVersion(draftMeta?.proposed_version || doc.version.split(" ")[0]));
    setEditorNote("");
    setSaveMsg(null);
    setEditorOpen(true);
  };

  const saveDraft = async () => {
    if (!identity) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/legal-review/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: identity.name,
          email: identity.email,
          document_key: doc.id,
          language: lang,
          proposed_version: editorVersion.trim(),
          text: editorText,
          source_note: editorNote.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Save failed");
      setSaveMsg({ type: "ok", text: "Saved. Refreshing…" });
      router.refresh();
      setTimeout(() => setEditorOpen(false), 500);
    } catch (e) {
      setSaveMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async (action: Action) => {
    if (!identity) return;
    if (action === "comment" && !comments.trim()) {
      setReviewMsg({ type: "err", text: "Add a comment before submitting." });
      return;
    }
    setBusy(true);
    setReviewMsg(null);
    try {
      const res = await fetch("/api/legal-review/signoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: identity.name,
          email: identity.email,
          action,
          document_key: doc.id,
          document_version: docVersion,
          document_title: doc.title,
          document_text: (doc.text[doc.sourceLanguage] as string) ?? displayText,
          comments,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Submission failed");
      setComments("");
      setReviewMsg({ type: "ok", text: action === "approve" ? "Approved — certificate recorded." : "Saved." });
      router.refresh();
    } catch (e) {
      setReviewMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id={doc.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <header className="border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-[#1F2937]">
            {doc.title} <span className="text-xs font-normal text-gray-400 ml-1">{doc.version}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">{doc.description}</p>
          {doc.approval && (
            <p className="text-xs mt-1.5 max-w-2xl">
              <span className="font-semibold text-gray-600">Approval required:</span>{" "}
              <span className="text-gray-500">{doc.approval}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            {(["is", "en"] as DocLanguage[]).map((l) => {
              const active = l === lang;
              const missing = doc.text[l] === null;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 transition-colors ${active ? "bg-[#1F2937] text-white" : missing ? "bg-white text-gray-400 hover:text-gray-600" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                  title={missing ? `${LANG_LABEL[l]} translation pending` : LANG_LABEL[l]}
                >
                  {LANG_LABEL[l]}{missing && <span className="ml-1 text-[10px] align-top">·</span>}
                </button>
              );
            })}
          </div>
          <CopyButton text={displayText} />
          <a
            href={dataUrl}
            download={downloadName}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Download .txt
          </a>
          <button
            type="button"
            onClick={openEditor}
            disabled={!identity}
            title={identity ? `Paste a revised ${LANG_LABEL[lang]} version` : "Identify yourself above first"}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Edit ({LANG_LABEL[lang]})
          </button>
        </div>
      </header>

      {!hasTranslation && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
          {LANG_LABEL[lang]} translation has not been drafted yet. Read the {LANG_LABEL[otherLang]} source by switching language.
        </div>
      )}

      {draftMeta && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-800">
          <span className="font-semibold">Draft {draftMeta.proposed_version}</span>{" "}
          shown — by {draftMeta.edited_by_name || draftMeta.edited_by_email}
          {draftMeta.edited_via === "link" ? " (via review link)" : ""}
          {" · "}{fmt(draftMeta.created_at)}
          {draftMeta.source_note && <> · <em>{draftMeta.source_note}</em></>}.
        </div>
      )}

      <pre className="px-5 py-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50/30 max-h-[420px] overflow-y-auto">
        {displayText}
      </pre>

      {/* Review / approval panel */}
      <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/40">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[latestStatus]}`}>
              {STATUS_LABELS[latestStatus]}
            </span>
            {latest && (
              <span className="text-xs text-gray-400">by {latest.reviewer_name} · {fmt(latest.created_at)}</span>
            )}
          </div>
          {relevant.length > 0 && (
            <button onClick={() => setHistoryOpen((o) => !o)} className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">
              {historyOpen ? "Hide" : `History (${relevant.length})`}
            </button>
          )}
        </div>

        {historyOpen && relevant.length > 0 && (
          <div className="space-y-2 border border-gray-200 rounded-lg bg-white p-3">
            {relevant.slice(0, 20).map((s) => (
              <div key={s.id} className="text-xs border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[s.status]}`}>{STATUS_LABELS[s.status]}</span>
                  <span className="text-gray-500">{s.reviewer_name}</span>
                  <span className="text-gray-400">{fmt(s.created_at)}</span>
                </div>
                {s.comments && <div className="text-gray-700 whitespace-pre-wrap">{s.comments}</div>}
              </div>
            ))}
          </div>
        )}

        {identity ? (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Comments (optional unless commenting only)"
              rows={3}
              maxLength={8000}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y bg-white"
            />
            <div className="flex flex-wrap items-center gap-2">
              {(["comment", "approve", "request_changes", "reject"] as Action[]).map((a) => (
                <button
                  key={a}
                  onClick={() => submitReview(a)}
                  disabled={busy}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${ACTION_STYLES[a]}`}
                >
                  {ACTION_LABELS[a]}
                </button>
              ))}
              {reviewMsg && <span className={`text-xs ${reviewMsg.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>{reviewMsg.text}</span>}
            </div>
            <p className="text-[11px] text-gray-400">
              Approving records your name, email, IP, timestamp and a sha256 of the exact text above, and generates a signed PDF certificate.
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">Identify yourself at the top of the page to comment or approve.</p>
        )}
      </div>

      {/* Editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditorOpen(false); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <header className="px-5 py-4 border-b border-gray-100">
              <h4 className="text-base font-semibold text-[#1F2937]">
                Edit — {doc.title} <span className="text-sm font-normal text-gray-400 ml-1">({LANG_LABEL[lang]})</span>
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Paste your revised text. Saving stores a new draft attributed to you — the card immediately shows your version. Lifeline ports approved drafts back into the source copy.
              </p>
            </header>
            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs font-medium text-gray-700 block">
                  Proposed version
                  <input type="text" value={editorVersion} onChange={(e) => setEditorVersion(e.target.value)} placeholder="v1.2" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono text-gray-900" />
                </label>
                <label className="text-xs font-medium text-gray-700 block">
                  Note (optional)
                  <input type="text" value={editorNote} onChange={(e) => setEditorNote(e.target.value)} placeholder="e.g. tightened §5 on Sameind" maxLength={500} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </label>
              </div>
              <textarea value={editorText} onChange={(e) => setEditorText(e.target.value)} rows={20} spellCheck={false} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono text-gray-900 resize-y" />
              {saveMsg && <div className={`text-xs ${saveMsg.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>{saveMsg.text}</div>}
            </div>
            <footer className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditorOpen(false)} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button type="button" onClick={saveDraft} disabled={saving || editorText.length < 20 || !editorVersion.trim()} className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "Saving…" : "Save draft"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
