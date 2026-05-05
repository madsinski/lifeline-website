"use client";

// "Senda könnun" button on the client detail page.
// Opens a modal listing every approved survey, lets admin pick one,
// then POSTs to /api/admin/surveys/[id]/assign which creates the
// assignment row + emails the client a one-shot completion link.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FeedbackSurvey } from "@/lib/feedback-survey-types";

interface Props {
  clientId: string;
  clientEmail: string;
}

export default function SendSurveyButton({ clientId, clientEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [surveys, setSurveys] = useState<FeedbackSurvey[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [recentSent, setRecentSent] = useState<{ id: string; sent_at: string; completed_at: string | null; survey_id: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: surveyRows } = await supabase
          .from("feedback_surveys")
          .select("*")
          .eq("status", "approved")
          .order("updated_at", { ascending: false });
        if (!cancelled) {
          const approved = ((surveyRows || []) as FeedbackSurvey[]);
          setSurveys(approved);
          if (approved.length === 1) setChosenId(approved[0].id);
        }
        const { data: recent } = await supabase
          .from("feedback_assignments")
          .select("id, survey_id, sent_at, completed_at")
          .eq("client_id", clientId)
          .order("sent_at", { ascending: false })
          .limit(5);
        if (!cancelled) setRecentSent((recent as typeof recentSent) || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, clientId]);

  const send = async () => {
    if (!chosenId) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${chosenId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ client_id: clientId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Send failed");
      setMsg({ type: "ok", text: `Sent to ${j.sent_to}. Link expires ${new Date(j.expires_at).toLocaleDateString("en-GB")}.` });
      // Refresh recent list so the new send shows up.
      const { data: recent } = await supabase
        .from("feedback_assignments")
        .select("id, survey_id, sent_at, completed_at")
        .eq("client_id", clientId)
        .order("sent_at", { ascending: false })
        .limit(5);
      setRecentSent((recent as typeof recentSent) || []);
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setMsg(null); setChosenId(null); }}
        className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
        title="Senda þjónustukönnun á þennan viðskiptavin"
      >
        Senda könnun
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <header className="px-5 py-4 border-b border-gray-100">
              <h4 className="text-base font-semibold text-[#1F2937]">Send a survey</h4>
              <p className="text-xs text-gray-500 mt-1">
                Recipient: <span className="font-medium text-gray-700">{clientEmail}</span>. The link in the email is single-use and expires in 30 days.
              </p>
            </header>
            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-gray-400">Loading approved surveys…</p>
              ) : surveys.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No approved surveys yet. Go to <a href="/admin/surveys" className="underline text-emerald-700">/admin/surveys</a> and submit one for medical-advisor approval first.
                </p>
              ) : (
                <div className="space-y-2">
                  {surveys.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                        chosenId === s.id ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="survey"
                        checked={chosenId === s.id}
                        onChange={() => setChosenId(s.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.title_is}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {s.key} v{s.version} · {s.estimated_minutes} mín
                          {s.approved_at && (
                            <> · approved {new Date(s.approved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
                          )}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {recentSent.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent sends to this client</p>
                  <ul className="space-y-1">
                    {recentSent.map((r) => (
                      <li key={r.id} className="text-xs text-gray-600">
                        {new Date(r.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        {r.completed_at ? <span className="text-emerald-700">completed {new Date(r.completed_at).toLocaleDateString("en-GB")}</span> : <span className="text-gray-400">pending</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {msg && (
                <div className={`px-3 py-2 rounded-lg text-sm ${msg.type === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {msg.text}
                </div>
              )}
            </div>
            <footer className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={send}
                disabled={busy || !chosenId || surveys.length === 0}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Sending…" : "Send invite email"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
