"use client";

// „Hreyfing og það sem þarf að varast“ — two answers the training programme
// is built from: how much you move now, and what needs sparing.
//
// This used to be forced on everybody the first time the app opened
// (OnboardingPlayer), on the reasoning that prescribing squats to somebody
// with a knee they never got to mention is the failure to prevent. That
// reasoning holds — but it is about TRAINING, not about opening the app.
// So the question is asked in two places only:
//
//   the guided setup (/app/uppsetning), where it can be skipped, and
//   the moment somebody goes to train without having answered — then it is
//   required, and says why.
//
// Saved through POST /api/hc/training (TrainingStart), the training source
// of truth. Days chosen earlier in the setup are carried in.

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { TrainingStart } from "./OnboardingPlayer";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export default function MovementSafety({ api, onSaved, mode }: {
  api: Api;
  onSaved: () => void | Promise<void>;
  /** "training": shown because a session was about to start. */
  mode: "setup" | "training";
}) {
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [days, setDays] = useState<number[] | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void (async () => {
      /* What /byrja already asked (goal, maybe move and limits), so nothing
         is asked twice; and the days picked in the plan step. */
      const [o, s] = await Promise.all([
        api("/api/hc/onboarding").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        api("/api/hc/setup").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!alive) return;
      setAnswers((o?.answers ?? {}) as Record<string, string>);
      const d = s?.progress?.data?.days;
      setDays(Array.isArray(d) && d.length >= 2 ? d : undefined);
    })();
    return () => { alive = false; };
  }, [api]);

  return (
    <div>
      {mode === "training" && (
        <div className="mb-5 flex items-start gap-3 rounded-hc-element bg-hc-brand-surface p-4 ring-1 ring-hc-brand-dark/20">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-hc-brand-text" aria-hidden />
          <div className="text-sm text-hc-ink-2">
            <p className="font-bold text-hc-ink">Tvær spurningar áður en þú byrjar að æfa</p>
            <p className="mt-1">
              Æfingarnar eru lagaðar að því hvað þú hreyfir þig mikið og hvort eitthvað þurfi að varast, til dæmis
              verk í hné eða baki. Án svaranna gætu æfingarnar reynt á það sem ætti að hlífa, svo við spyrjum einu sinni.
            </p>
          </div>
        </div>
      )}
      {answers === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="Hleð">
          <div className="h-12 rounded-hc-element hc-shimmer" />
          <div className="h-12 rounded-hc-element hc-shimmer" />
        </div>
      ) : (
        <TrainingStart api={api} preview={false} answers={answers} days={days} bare
          submitLabel={mode === "training" ? "Vista og byrja" : "Vista"}
          onSaved={async () => { await onSaved(); }} />
      )}
    </div>
  );
}
