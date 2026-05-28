"use client";

// Admin editor for the Framkvæmdastjóri recruiting document. Fields persist
// to Supabase via /api/job-description so the public read-only mirror
// (/verkefnalysing) shows the same content. The document body lives in
// JobDescriptionDoc, shared with the public page so the two never drift.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULTS, JobDescriptionDoc, type DocFields } from "./JobDescriptionDoc";

// Shared view key (also the /verkefnalysing password) — lets the GET read
// the row without a round-trip through the auth header.
const VIEW_KEY = "lifeline";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function JobDescriptionPage() {
  const [fields, setFields] = useState<DocFields>(DEFAULTS);
  const [save, setSave] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load the stored document after mount. Merged over DEFAULTS so any field
  // not yet saved keeps its built-in default. setState runs in an async
  // callback (not synchronously in the effect body).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/job-description?key=${VIEW_KEY}`);
        if (res.ok) {
          const j = await res.json();
          if (!cancelled && j?.fields && typeof j.fields === "object") {
            setFields((p) => ({ ...p, ...(j.fields as Partial<DocFields>) }));
          }
        }
      } catch {
        /* offline / table missing — keep DEFAULTS */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: DocFields) => {
    setSave("saving");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/job-description", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ fields: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSave("saved");
      setTimeout(() => setSave((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch {
      setSave("error");
    }
  }, []);

  // Functional update so rapid edits compose correctly; debounce the save.
  const set = (k: keyof DocFields) => (v: string) => {
    setFields((prev) => {
      const next = { ...prev, [k]: v };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(next), 600);
      return next;
    });
  };

  const resetDraft = () => {
    if (confirm("Endurstilla skjalið í sjálfgefin gildi? Breytingar tapast.")) {
      setFields(DEFAULTS);
      persist(DEFAULTS);
    }
  };

  return (
    <div className="px-8 py-6">
      {/* Toolbar — not part of the printed document */}
      <div className="jd-noprint max-w-3xl mx-auto mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Verkefnalýsing — Framkvæmdastjóri</h1>
          <p className="text-sm text-gray-500">
            Reitir með brotalínu eru ritstýranlegir. Breytingar vistast á netþjón og birtast á
            almenningssíðunni <code className="text-[12px] bg-gray-100 px-1 py-0.5 rounded">/verkefnalysing</code> (aðgangsorð).
            {save === "saving" && <span className="text-gray-400"> · Vista…</span>}
            {save === "saved" && <span className="text-emerald-600 font-medium"> · Vistað</span>}
            {save === "error" && <span className="text-amber-600 font-medium"> · Vistun mistókst</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={resetDraft}
            className="text-xs font-medium px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            Endurstilla
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="text-sm font-semibold px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Prenta / Vista sem PDF
          </button>
        </div>
      </div>

      <JobDescriptionDoc fields={fields} set={set} />
    </div>
  );
}
