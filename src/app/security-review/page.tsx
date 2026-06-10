"use client";

// Public, password-gated mirror of the security documents (posture
// statement + technical brief), for sending to external security
// reviewers — same setup as /verkefnalysing: no admin chrome, the
// password check is client-side and matches the site's other
// shared-link gates. The documents are the branded HTML renderings
// (docs/security-review/), embedded via iframe srcDoc; each carries
// its own print stylesheet and Print/Export-PDF button.

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  SECURITY_POSTURE_HTML,
  TECHNICAL_BRIEF_HTML,
} from "@/lib/security-review-html";

const PASSWORD = "lifeline";
const UNLOCK_KEY = "security_review_unlocked";

export default function SecurityReviewPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [doc, setDoc] = useState<"posture" | "brief">("posture");
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (sessionStorage.getItem(UNLOCK_KEY) === "1" && !cancelled) setUnlocked(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pw === PASSWORD) {
      setUnlocked(true);
      try {
        sessionStorage.setItem(UNLOCK_KEY, "1");
      } catch {
        /* ignore */
      }
    } else {
      setError(true);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lifeline-logo-rebrand.svg" alt="Lifeline" className="h-7 w-auto mx-auto mb-6" />
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Security review documents</h1>
          <p className="text-sm text-gray-500 mb-5">Enter the access password to view the documents.</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(false);
            }}
            placeholder="Password"
            autoFocus
            className="w-full px-3 py-2.5 text-sm rounded-md border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-center"
          />
          {error && <p className="text-sm text-red-600 mt-2">Wrong password.</p>}
          <button
            type="submit"
            className="mt-4 w-full py-2.5 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
          >
            Open
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="max-w-5xl w-full mx-auto px-4 pt-6 pb-3 flex items-center gap-2 flex-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lifeline-logo-rebrand.svg" alt="Lifeline" className="h-6 w-auto mr-2" />
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
          {(
            [
              { key: "posture", label: "Security & Privacy Posture (v1.7)" },
              { key: "brief", label: "Technical Security Brief (v1.2)" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setDoc(t.key)}
              className={
                "px-4 py-2 text-sm font-semibold transition-colors " +
                (doc === t.key
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => frameRef.current?.contentWindow?.print()}
          className="ml-auto text-sm font-semibold px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Print / Save as PDF
        </button>
      </div>
      <div className="max-w-5xl w-full mx-auto px-4 pb-8 flex-1">
        <iframe
          ref={frameRef}
          title={doc === "posture" ? "Security & Privacy Posture Statement" : "Technical Security Brief"}
          srcDoc={doc === "posture" ? SECURITY_POSTURE_HTML : TECHNICAL_BRIEF_HTML}
          className="w-full h-[calc(100vh-110px)] bg-white rounded-xl border border-gray-200 shadow-sm"
        />
      </div>
    </div>
  );
}
