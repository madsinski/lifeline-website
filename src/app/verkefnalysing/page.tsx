"use client";

// Public, password-gated mirror of the Framkvæmdastjóri recruiting document.
// Shared with candidates — no admin chrome (Navbar/Footer suppress themselves
// for /verkefnalysing) and read-only. The password check is client-side and
// cosmetic, matching the site's other shared-link gates; the document holds
// no sensitive data beyond the proposal itself.

import { useEffect, useState, type FormEvent } from "react";
import { DEFAULTS, JobDescriptionDoc, type DocFields } from "../admin/job-description/JobDescriptionDoc";

const PASSWORD = "lifeline";
const UNLOCK_KEY = "verkefnalysing_unlocked";

export default function PublicJobDescriptionPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [fields, setFields] = useState<DocFields>(DEFAULTS);
  const [docTitle, setDocTitle] = useState("");

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

  // Pull the admin-saved version on mount (the password gate is cosmetic —
  // the data is public via the shared key — so loading the title for the
  // gate is fine). A ?id=<docId> selects a specific proposal so each one
  // has its own shareable link; without it, the default document is shown.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = new URLSearchParams(window.location.search).get("id");
        const url = `/api/job-description?key=${PASSWORD}${id ? `&id=${encodeURIComponent(id)}` : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const j = await res.json();
          if (cancelled) return;
          if (typeof j?.title === "string" && j.title.trim()) setDocTitle(j.title.trim());
          if (j?.fields && Object.keys(j.fields).length > 0) {
            setFields((p) => ({ ...p, ...(j.fields as Partial<DocFields>) }));
          }
        }
      } catch {
        /* keep DEFAULTS */
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
          <h1 className="text-lg font-semibold text-gray-900 mb-1">{docTitle || "Boð frá Lifeline"}</h1>
          <p className="text-sm text-gray-500 mb-5">Sláðu inn aðgangsorð til að skoða skjalið.</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(false);
            }}
            placeholder="Aðgangsorð"
            autoFocus
            className="w-full px-3 py-2.5 text-sm rounded-md border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-center"
          />
          {error && <p className="text-sm text-red-600 mt-2">Rangt aðgangsorð.</p>}
          <button
            type="submit"
            className="mt-4 w-full py-2.5 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
          >
            Opna
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="jd-noprint max-w-3xl mx-auto mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="text-sm font-semibold px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Prenta / Vista sem PDF
        </button>
      </div>
      <JobDescriptionDoc fields={fields} readOnly title={docTitle} />
    </div>
  );
}
