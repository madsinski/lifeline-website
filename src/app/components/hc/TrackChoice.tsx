"use client";

// "Hvað ertu að leita að?" — which journey this is going to be.
//
// Until now there was one answer: the health check. Pay, get measured, give
// blood, read the report, talk to a nurse, receive a plan. Somebody who
// wanted the coaching and not the workup reached the package step and
// stopped, holding an app whose surfaces all wanted a report they were
// never going to have.
//
// Three honest answers, and they map onto things that already exist rather
// than onto things we wish existed:
//
//   • a report already in hand  → upload it, skip the tests (own_report_at)
//   • the full health check     → the journey as it has always been
//   • coaching only             → entry = 'coach', four steps, own plan
//
// Shown while the choice is still free — before anything is paid for. After
// that the money has decided, and a card offering to change it would be
// lying.
//
// Choosing coaching is not a dead end. Adding the check later is a track
// change rather than a new journey, so habits, streaks and plan history
// survive it, and the card says so.

import { useState } from "react";
import { ClipboardCheck, FileHeart, Sparkles } from "lucide-react";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export default function TrackChoice({ api, onDone, onUpload }: {
  api: Api;
  onDone: () => Promise<void> | void;
  /** Opens the report uploader, for somebody who already has one. */
  onUpload?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const choose = async (track: "coach" | "check") => {
    setBusy(track);
    await api("/api/hc/journey", {
      method: "POST",
      body: JSON.stringify({ action: "choose_track", track }),
    }).catch(() => null);
    setBusy(null);
    await onDone();
  };

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-hc-brand">Hvar viltu byrja?</p>
      <h2 className="mt-0.5 text-xl font-bold text-slate-900">Þetta er þín ferð</h2>
      <p className="mt-1.5 text-sm text-slate-600">
        Þú getur breytt þessu síðar. Ekkert af því sem þú gerir í appinu fer forgörðum ef þú skiptir.
      </p>

      <div className="mt-4 space-y-2">
        {/* The full check first: it is what most people come for and what
            the rest of the journey is built around. */}
        <button type="button" disabled={!!busy} onClick={() => void choose("check")}
          className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 p-3.5 text-left transition hover:border-hc-brand disabled:opacity-50">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand">
            <ClipboardCheck className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900">Heilsufarsskoðun og áætlun</span>
            <span className="block text-sm leading-snug text-slate-600">
              Mælingar, blóðprufa og skýrsla, svo viðtal og áætlun byggð á niðurstöðunum.
            </span>
          </span>
        </button>

        {onUpload && (
          <button type="button" disabled={!!busy} onClick={onUpload}
            className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 p-3.5 text-left transition hover:border-hc-brand disabled:opacity-50">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand">
              <FileHeart className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900">Ég er með skýrslu þegar</span>
              <span className="block text-sm leading-snug text-slate-600">
                Grunnheilsa-skýrsla úr sjúklingagáttinni. Settu hana inn og við sleppum mælingunum.
              </span>
            </span>
          </button>
        )}

        <button type="button" disabled={!!busy} onClick={() => void choose("coach")}
          className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 p-3.5 text-left transition hover:border-hc-brand disabled:opacity-50">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900">Bara þjálfunin, engin skoðun</span>
            <span className="block text-sm leading-snug text-slate-600">
              Æfingar, næring, svefn og dagleg venjur. Engar mælingar og engin blóðprufa.
              {/* No health claim: this says what it contains, not what it
                  will do to anybody's risk. */}
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
