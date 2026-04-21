"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const TEMPLATES = [
  { key: "b2b-intro", label: "B2B Intro (outreach)" },
  { key: "invite", label: "Employee Invite" },
  { key: "welcome", label: "Employee Welcome" },
  { key: "event-scheduled", label: "Measurement Day Scheduled" },
  { key: "blood-test-days", label: "Blood Test Days" },
  { key: "event-reminder", label: "Event Reminder" },
  { key: "finalize-staff", label: "Finalize (staff)" },
  { key: "finalize-contact", label: "Finalize (contact)" },
  { key: "invoice-contact", label: "Invoice Receipt" },
  { key: "renewal", label: "Renewal / Check-in" },
];

export default function EmailPreviewPage() {
  const [selected, setSelected] = useState("b2b-intro");
  const [html, setHtml] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);

  const loadPreview = async (template: string) => {
    setSelected(template);
    setLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      const res = await fetch(`/api/admin/email-preview?template=${template}`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      const j = await res.json();
      setHtml(j.html || "");
      setSubject(j.subject || "");
    } catch {
      setHtml("<p>Failed to load preview</p>");
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Email Preview</h1>
      <p className="text-sm text-gray-500 mb-6">Preview all email templates with sample data</p>

      <div className="flex gap-6">
        {/* Template selector */}
        <div className="w-56 shrink-0 space-y-1">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => loadPreview(t.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selected === t.key
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Preview pane */}
        <div className="flex-1 min-w-0">
          {subject && (
            <div className="mb-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">Subject:</span>
              <span className="text-sm text-gray-900">{subject}</span>
            </div>
          )}
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : html ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-100">
              <iframe
                srcDoc={html}
                title="Email preview"
                className="w-full bg-white"
                style={{ minHeight: 800, border: "none" }}
              />
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">
              Select a template to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
