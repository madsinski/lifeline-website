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
import { ClipboardCheck, FileHeart, Lightbulb, UserRound } from "lucide-react";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export default function TrackChoice({ api, onDone, onUpload, preview = false, bare = false }: {
  api: Api;
  onDone: () => Promise<void> | void;
  /** Opens the report uploader, for somebody who already has one. */
  onUpload?: () => void;
  /*
   * Show it without letting it act.
   *
   * This card only appears before anything is paid for, which means anyone
   * reviewing the product cannot see it — they have a plan already. The
   * walkthrough shows it in preview so the whole first run can be read in
   * one place, and the buttons do nothing because changing somebody's track
   * from a review screen would be a real change to their journey.
   */
  preview?: boolean;
  /*
   * Drop the card and the heading.
   *
   * Inside the walkthrough this was a bordered card within a bordered step,
   * under a step header that had already said "Hvar viltu byrja?" — the
   * question asked twice, the second time in smaller type. Bare mode leaves
   * the three answers, which is the part the step is for.
   */
  bare?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const choose = async (track: "coach" | "app" | "check") => {
    if (preview) return;
    setBusy(track);
    await api("/api/hc/journey", {
      method: "POST",
      body: JSON.stringify({ action: "choose_track", track }),
    }).catch(() => null);
    setBusy(null);
    await onDone();
  };

  return (
    <section className={bare ? "" : "rounded-3xl bg-hc-surface p-5 shadow-sm ring-1 ring-hc-hairline sm:p-6"}>
      {!bare && (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-hc-brand">Hvar viltu byrja?</p>
          <h2 className="mt-0.5 text-xl font-bold text-hc-ink">Þetta er þín ferð</h2>
        </>
      )}
      <p className={`text-sm text-hc-ink-2 ${bare ? "" : "mt-1.5"}`}>
        Þú getur breytt þessu síðar. Ekkert af því sem þú gerir í appinu fer forgörðum ef þú skiptir.
      </p>
      {preview && (
        <p className="mt-2 rounded-xl bg-hc-sunken-2 px-3 py-2 text-xs text-hc-ink-2">
          Þetta er fyrsta spurningin sem nýr þátttakandi fær. Hnapparnir hér eru óvirkir.
        </p>
      )}

      {/* Said as things about yourself, not as product categories.
          "Heilsufarsskoðun og áætlun" / "Ég er með skýrslu þegar" /
          "Bara þjálfunin" asked people to work out which box they were in.
          A sentence in the first person is a statement you either recognise
          or you do not, and the three here are the three situations somebody
          arriving actually arrives in: I have a report, I have none and want
          to get on with it myself, or I want the whole thing with a coach. */}
      <div className="mt-4 space-y-2">
        {([
          {
            key: "report" as const,
            icon: FileHeart,
            title: "Ég er með heilsufarsskýrslu frá Lifeline",
            body: "Ég vil setja hana inn hér og byggja áætlunina á henni.",
            foot: "Mælingar og blóðprufa eru þá þegar frágengnar.",
          },
          {
            key: "app" as const,
            icon: Lightbulb,
            title: "Ég vil nota appið sjálf(ur)",
            body: "Æfingar, næring, svefn og daglegar venjur — ég set prógrammið upp og stilli það sjálf(ur).",
            foot: "Engin kennitala, engar mælingar og enginn þjálfari.",
          },
          {
            key: "coach" as const,
            icon: UserRound,
            title: "Ég vil heilsuþjálfun",
            body: "Sama app, og heilsuþjálfari sem fer yfir áætlunina með mér og svarar skilaboðum.",
            foot: "Engar mælingar og engin blóðprufa — þjálfun, ekki skoðun.",
          },
          {
            key: "check" as const,
            icon: ClipboardCheck,
            title: "Ég vil heilsufarsskoðun",
            body: "Mælingar, blóðprufa og skýrsla, svo viðtal við hjúkrunarfræðing og áætlun byggð á niðurstöðunum.",
            foot: "Skoðunin sjálf fer fram í sjúklingagáttinni (Medalia).",
          },
        ]).map((o) => {
          const Icon = o.icon;
          const act = o.key === "report"
            ? onUpload
            : () => void choose(o.key);
          /* Hidden only where it could not work. In preview every option
             shows, because the point of a review screen is to see all of
             them — and nothing there does anything anyway. */
          if (o.key === "report" && !onUpload && !preview) return null;
          return (
            <button key={o.key} type="button" disabled={!!busy || preview} onClick={act}
              className="flex w-full items-start gap-3 rounded-2xl border border-hc-hairline bg-hc-surface p-3.5 text-left transition hover:border-hc-brand disabled:opacity-60">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug text-hc-ink">{o.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-hc-ink-2">{o.body}</span>
                {/* What it commits you to, in the smallest type on the card.
                    On the app option that is "no kennitala", which is true
                    and is the difference the audit turned up; on the check it
                    is where the thing actually happens. */}
                <span className="mt-1 block text-xs text-hc-ink-3">{o.foot}</span>
              </span>
            </button>
          );
        })}
      </div>

    </section>
  );
}
