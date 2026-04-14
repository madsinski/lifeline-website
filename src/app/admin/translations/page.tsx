"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Translation {
  id: string;
  key: string;
  section: string;
  context: string | null;
  en: string;
  is_text: string | null;
  approved: boolean;
  approved_by: string | null;
  updated_at: string;
}

const sections = [
  { key: "all", label: "All" },
  { key: "navbar", label: "Navbar" },
  { key: "home", label: "Home" },
  { key: "assessment", label: "Assessment" },
  { key: "coaching", label: "Coaching" },
  { key: "pricing", label: "Pricing" },
  { key: "contact", label: "Contact" },
  { key: "footer", label: "Footer" },
  { key: "common", label: "Common" },
];

export default function TranslationsPage() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("all");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadTranslations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("translations")
        .select("*")
        .order("section", { ascending: true })
        .order("key", { ascending: true });
      if (error) {
        setStatusMsg({ type: "error", text: `Failed to load: ${error.message}` });
      } else {
        setTranslations((data as Translation[]) || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTranslations(); }, [loadTranslations]);

  const filtered = translations.filter((t) => {
    if (activeSection !== "all" && t.section !== activeSection) return false;
    if (filter === "pending" && t.approved) return false;
    if (filter === "approved" && !t.approved) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.key.toLowerCase().includes(s) || t.en.toLowerCase().includes(s) || (t.is_text || "").toLowerCase().includes(s);
    }
    return true;
  });

  const handleSave = async (id: string, isText: string) => {
    setSaving(id);
    const { error } = await supabase.from("translations").update({
      is_text: isText,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      setStatusMsg({ type: "error", text: `Save failed: ${error.message}` });
    } else {
      setTranslations(prev => prev.map(t => t.id === id ? { ...t, is_text: isText, updated_at: new Date().toISOString() } : t));
      setEditingId(null);
    }
    setSaving(null);
  };

  const handleApprove = async (id: string, approve: boolean) => {
    setSaving(id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("translations").update({
      approved: approve,
      approved_by: approve ? (user?.email || null) : null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) {
      setTranslations(prev => prev.map(t => t.id === id ? { ...t, approved: approve, approved_by: approve ? (user?.email || null) : null } : t));
    }
    setSaving(null);
  };

  const handleApproveAll = async () => {
    if (!confirm(`Approve all ${filtered.filter(t => !t.approved && t.is_text).length} pending translations in this view?`)) return;
    setSaving("all");
    const { data: { user } } = await supabase.auth.getUser();
    const ids = filtered.filter(t => !t.approved && t.is_text).map(t => t.id);
    for (const id of ids) {
      await supabase.from("translations").update({
        approved: true,
        approved_by: user?.email || null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
    }
    setTranslations(prev => prev.map(t => ids.includes(t.id) ? { ...t, approved: true, approved_by: user?.email || null } : t));
    setSaving(null);
    setStatusMsg({ type: "success", text: `${ids.length} translations approved.` });
  };

  const totalCount = translations.length;
  const approvedCount = translations.filter(t => t.approved).length;
  const pendingCount = translations.filter(t => !t.approved && t.is_text).length;
  const missingCount = translations.filter(t => !t.is_text).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Translations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and approve Icelandic translations for the website
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium">{approvedCount} approved</span>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-medium">{pendingCount} pending</span>
          {missingCount > 0 && <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-full font-medium">{missingCount} missing</span>}
          <span className="text-gray-400">{totalCount} total</span>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {sections.map((s) => {
          const count = s.key === "all" ? translations.length : translations.filter(t => t.section === s.key).length;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeSection === s.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s.label} <span className="text-gray-400 ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search keys or text..."
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-emerald-300 outline-none text-gray-900"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | "pending" | "approved")}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none text-gray-900"
        >
          <option value="all">All status</option>
          <option value="pending">Pending review</option>
          <option value="approved">Approved</option>
        </select>
        <button onClick={loadTranslations} disabled={loading}
          className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
          Refresh
        </button>
        {filtered.filter(t => !t.approved && t.is_text).length > 0 && (
          <button onClick={handleApproveAll} disabled={saving === "all"}
            className="px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {saving === "all" ? "Approving..." : `Approve all visible (${filtered.filter(t => !t.approved && t.is_text).length})`}
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} shown</span>
      </div>

      {statusMsg && (
        <div className={`rounded-lg p-3 text-sm ${statusMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {statusMsg.text}
          <button onClick={() => setStatusMsg(null)} className="ml-2 text-xs underline">dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading translations...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} className={`bg-white rounded-xl border p-4 transition-colors ${
              t.approved ? "border-emerald-200/60" : t.is_text ? "border-amber-200/60" : "border-red-200/60"
            }`}>
              {/* Header: key + context + status */}
              <div className="flex items-center gap-2 mb-3">
                <code className="text-[11px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{t.key}</code>
                {t.context && <span className="text-[10px] text-gray-400">{t.context}</span>}
                <div className="flex-1" />
                {t.approved ? (
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Approved{t.approved_by ? ` by ${t.approved_by.split("@")[0]}` : ""}
                  </span>
                ) : t.is_text ? (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pending review</span>
                ) : (
                  <span className="text-[10px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Missing translation</span>
                )}
              </div>

              {/* Side by side: EN | IS */}
              <div className="grid grid-cols-2 gap-4">
                {/* English (read-only) */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">English</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{t.en}</p>
                </div>
                {/* Icelandic (editable) */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Íslenska</p>
                  {editingId === t.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={Math.max(2, Math.ceil((t.en.length || 50) / 60))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none text-gray-900 resize-y"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleSave(t.id, editText)} disabled={saving === t.id}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
                          {saving === t.id ? "..." : "Save"}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => { setEditingId(t.id); setEditText(t.is_text || ""); }}
                      className="text-sm text-gray-800 leading-relaxed cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors min-h-[2em]"
                    >
                      {t.is_text || <span className="text-gray-300 italic">Click to add translation...</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {editingId !== t.id && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => { setEditingId(t.id); setEditText(t.is_text || ""); }}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700">
                    Edit
                  </button>
                  {t.is_text && !t.approved && (
                    <button onClick={() => handleApprove(t.id, true)} disabled={saving === t.id}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
                      Approve
                    </button>
                  )}
                  {t.approved && (
                    <button onClick={() => handleApprove(t.id, false)} disabled={saving === t.id}
                      className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50">
                      Unapprove
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">No translations found.</div>
          )}
        </div>
      )}
    </div>
  );
}
