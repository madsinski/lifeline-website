"use client";

// Per-document card with EN / IS language toggle. Most legal docs were
// drafted in Icelandic (the regulator + counsel both work in IS); a
// few — public Privacy / Terms — were drafted in English. Counsel
// asked for both versions to be one click apart.
//
// Translations that don't exist yet are shown as a clear placeholder
// pointing the lawyer back at the source-language version, so we
// never silently fall back and risk somebody signing off on the wrong
// text. Adding an IS or EN translation is a one-line change in
// drafts/page.tsx — just supply the second string.
//
// Admin Edit field: the workflow is that the lawyer downloads the
// .txt, redlines it in his own environment (Word etc.), emails it
// back, and an admin pastes the revised text into the Edit field
// here. Saving inserts a row in legal_document_drafts; from then on
// page.tsx renders that draft instead of the source-code text. The
// click-through hash continues to use the source-code text until
// somebody (Mads/Claude) ports the approved draft back into source.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CopyButton from "./CopyButton";
import DocReviewPanel from "./DocReviewPanel";
import { supabase } from "@/lib/supabase";

export type DocLanguage = "is" | "en";

export interface DocCardDraftMeta {
  proposed_version: string;
  edited_by_email: string;
  edited_by_name: string | null;
  created_at: string;
  source_note: string | null;
  text_hash: string;
}

export interface DocCardProps {
  id: string;
  title: string;
  version: string;
  filenameBase: string;            // "privacy-policy-v1.4" — language suffix added at download time
  description: string;
  sourceLanguage: DocLanguage;     // language the doc was originally drafted in
  text: { is: string | null; en: string | null };
  // Per-language metadata about the latest admin-pasted draft, if any.
  // null means "no draft pasted, source-code text is what's shown".
  drafts?: { is: DocCardDraftMeta | null; en: DocCardDraftMeta | null };
}

const LANG_LABEL: Record<DocLanguage, string> = { is: "Íslenska", en: "English" };

function suggestNextVersion(current: string): string {
  // "v1.1" → "v1.2" · "v1.10" → "v1.11" · falls back to current+"-rev"
  const m = current.match(/^v(\d+)\.(\d+)/);
  if (!m) return `${current}-rev`;
  return `v${m[1]}.${parseInt(m[2], 10) + 1}`;
}

export default function DocCard(p: DocCardProps) {
  const router = useRouter();
  const [lang, setLang] = useState<DocLanguage>(p.sourceLanguage);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [editorVersion, setEditorVersion] = useState("");
  const [editorNote, setEditorNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Resolve admin status client-side. We can't pass it from the server
  // page (it's the same component for everyone). The Edit button is
  // gated by this; the API enforces the same check server-side anyway.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = await supabase
        .from("staff")
        .select("role, active")
        .eq("email", user.email)
        .maybeSingle();
      if (!cancelled && data?.active && data.role === "admin") setIsAdmin(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const sourceText = p.text[lang];
  const otherLang: DocLanguage = lang === "is" ? "en" : "is";
  const hasTranslation = sourceText !== null;
  const draftMeta = p.drafts?.[lang] ?? null;

  const placeholder = `[${lang === "en" ? "English" : "Icelandic"} translation not yet drafted]
This document is currently maintained in ${LANG_LABEL[p.sourceLanguage]} only. Toggle to ${LANG_LABEL[p.sourceLanguage]} above to read the source version, or request a translation from the editor of src/lib/*-content.ts.`;

  const displayText = hasTranslation ? (sourceText as string) : placeholder;
  const dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(displayText);
  const downloadName = `${p.filenameBase}-${lang}.txt`;

  const openEditor = () => {
    setEditorText(displayText);
    const baseVersion = draftMeta?.proposed_version || p.version.split(" ")[0];
    setEditorVersion(suggestNextVersion(baseVersion));
    setEditorNote("");
    setSaveMsg(null);
    setEditorOpen(true);
  };

  const saveDraft = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/admin/legal/documents/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          document_key: p.id,
          language: lang,
          proposed_version: editorVersion.trim(),
          text: editorText,
          source_note: editorNote.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Save failed");
      setSaveMsg({ type: "ok", text: "Saved. Refreshing card…" });
      // Server component re-renders with the new draft applied.
      router.refresh();
      setTimeout(() => setEditorOpen(false), 400);
    } catch (e) {
      setSaveMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <header className="border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-[#1F2937]">
            {p.title} <span className="text-xs font-normal text-gray-400 ml-1">{p.version}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">{p.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Language toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            {(["is", "en"] as DocLanguage[]).map((l) => {
              const active = l === lang;
              const missing = p.text[l] === null;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 transition-colors ${
                    active
                      ? "bg-[#1F2937] text-white"
                      : missing
                      ? "bg-white text-gray-400 hover:text-gray-600"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title={missing ? `${LANG_LABEL[l]} translation pending` : LANG_LABEL[l]}
                >
                  {LANG_LABEL[l]}
                  {missing && <span className="ml-1 text-[10px] align-top">·</span>}
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
          {isAdmin && (
            <button
              type="button"
              onClick={openEditor}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              title={`Paste a revised ${LANG_LABEL[lang]} version of this document`}
            >
              Edit ({LANG_LABEL[lang]})
            </button>
          )}
        </div>
      </header>

      {!hasTranslation && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
          {LANG_LABEL[lang]} translation has not been drafted yet. Read the {LANG_LABEL[otherLang]} source above by switching language.
        </div>
      )}

      {draftMeta && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-800">
          <span className="font-semibold">Draft {draftMeta.proposed_version}</span>{" "}
          shown — pasted by {draftMeta.edited_by_name || draftMeta.edited_by_email}
          {" · "}
          {new Date(draftMeta.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {draftMeta.source_note && <> · <em>{draftMeta.source_note}</em></>}
          . The click-through acceptance hash still uses the source-code text until this draft is ported into <code className="font-mono">src/lib/*-content.ts</code>.
        </div>
      )}

      <pre className="px-5 py-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50/30 max-h-[420px] overflow-y-auto">
        {displayText}
      </pre>

      {/* Review panel always points at the currently-displayed text
          for the source language — so when an admin pastes a draft,
          counsel reviews the new draft, not the stale source code. */}
      <DocReviewPanel
        documentKey={p.id}
        documentVersion={draftMeta?.proposed_version || p.version}
        documentTitle={p.title}
        documentText={(p.text[p.sourceLanguage] as string) ?? displayText}
      />

      {/* Inline editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditorOpen(false); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <header className="px-5 py-4 border-b border-gray-100">
              <h4 className="text-base font-semibold text-[#1F2937]">
                Edit — {p.title} <span className="text-sm font-normal text-gray-400 ml-1">({LANG_LABEL[lang]})</span>
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Paste the revised text the lawyer sent back. Saving inserts a new row in <code className="font-mono">legal_document_drafts</code> — the card immediately shows your version. Once approved, port back into <code className="font-mono">src/lib/*-content.ts</code> so click-through acceptance hashes pick it up.
              </p>
            </header>
            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs font-medium text-gray-700 block">
                  Proposed version
                  <input
                    type="text"
                    value={editorVersion}
                    onChange={(e) => setEditorVersion(e.target.value)}
                    placeholder="v1.2"
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono text-gray-900"
                  />
                </label>
                <label className="text-xs font-medium text-gray-700 block">
                  Source note (optional)
                  <input
                    type="text"
                    value={editorNote}
                    onChange={(e) => setEditorNote(e.target.value)}
                    placeholder="e.g. Ragnar's redlines, 4 May 2026"
                    maxLength={500}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                  />
                </label>
              </div>
              <textarea
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                rows={20}
                spellCheck={false}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono text-gray-900 resize-y"
              />
              {saveMsg && (
                <div className={`text-xs ${saveMsg.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>
                  {saveMsg.text}
                </div>
              )}
            </div>
            <footer className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving || editorText.length < 20 || !editorVersion.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save draft"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
