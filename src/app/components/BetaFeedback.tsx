"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const feedbackTypes = [
  { id: "bug", label: "Bug", color: "bg-red-100 text-red-700 border-red-200", activeColor: "bg-red-600 text-white border-red-600" },
  { id: "feature", label: "Feature", color: "bg-blue-100 text-blue-700 border-blue-200", activeColor: "bg-blue-600 text-white border-blue-600" },
  { id: "general", label: "General", color: "bg-gray-100 text-gray-700 border-gray-200", activeColor: "bg-gray-700 text-white border-gray-700" },
] as const;

export default function BetaFeedback() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "feature" | "general">("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const reset = useCallback(() => {
    setType("general");
    setMessage("");
    setSubmitted(false);
  }, []);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from("beta_feedback").insert({
        user_email: email,
        page_url: pathname,
        feedback_type: type,
        message: message.trim(),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 2000);
    } catch {
      // silently fail for beta widget
    }
    setSubmitting(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setOpen(!open); if (submitted) reset(); }}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg transition-all duration-200 ${
          open
            ? "bg-gray-700 text-white hover:bg-gray-800"
            : "bg-[#0D9488] text-white hover:bg-[#0B7B73] hover:shadow-xl"
        }`}
      >
        {open ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        <span className="text-sm font-medium">{open ? "Close" : "Feedback"}</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[calc(100vw-3rem)] sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {submitted ? (
            /* Success state */
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#0D9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#1F2937]">Thanks for your feedback!</p>
              <p className="text-xs text-[#6B7280] mt-1">We&apos;ll review it shortly.</p>
            </div>
          ) : (
            /* Form */
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#1F2937]">Send Feedback</h3>
                <span className="text-[10px] text-[#9CA3AF] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">BETA</span>
              </div>

              {/* Type selector */}
              <div className="flex gap-2 mb-3">
                {feedbackTypes.map((ft) => (
                  <button
                    key={ft.id}
                    onClick={() => setType(ft.id)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      type === ft.id ? ft.activeColor : ft.color
                    }`}
                  >
                    {ft.label}
                  </button>
                ))}
              </div>

              {/* Message */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === "bug" ? "What went wrong? What did you expect?"
                  : type === "feature" ? "What would you like to see?"
                  : "Any thoughts or suggestions..."
                }
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-[#1F2937] placeholder-gray-400 focus:ring-2 focus:ring-[#0D9488] outline-none resize-none"
                autoFocus
              />

              {/* Context info */}
              <p className="text-[10px] text-[#9CA3AF] mt-2 mb-3 truncate">
                Page: {pathname}{email ? ` · ${email}` : ""}
              </p>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || submitting}
                className="w-full py-2.5 bg-[#0D9488] text-white text-sm font-semibold rounded-xl hover:bg-[#0B7B73] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Submit Feedback"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
