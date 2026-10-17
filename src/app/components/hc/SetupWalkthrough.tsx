"use client";

// The onboarding, one step at a time.
//
// The checklist card is the right shape for somebody who wants to fix one
// thing: four rows, open the one you need. It is the wrong shape for seeing
// what a new participant actually meets, because a new participant does not
// meet a summary — they meet one question, answer it, and get the next one.
//
// So this is the same four items with the same components, walked rather
// than listed. SETUP_ROWS and CoachStep are imported from the card instead
// of copied, because two versions of "the four things" would drift apart
// within a month and the one on this screen would be the one nobody
// noticed was stale.
//
// Reachable from Stillingar at any time. It is how Mads reviews the flow
// without making an account, and it is also the honest answer for a
// participant who skipped everything at signup and wants to be walked
// through it properly rather than handed a checklist.

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Sheet from "./Sheet";
import CalendarConnect, { type CalendarApi } from "./CalendarConnect";
import Link from "next/link";
import NudgeSettings from "./NudgeSettings";
import PartnerCard from "./PartnerCard";
import { CoachStep, SETUP_ROWS } from "./SetupFlow";
import ProfileForm, { type ProfileFormData } from "./ProfileForm";
import TrackChoice from "./TrackChoice";
import { SAVE_FAILED, useToast } from "./Toast";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
interface Worker { id: string; name: string | null; role: string | null; photo_url?: string | null; bio?: string | null }

/*
 * The whole first run, in order.
 *
 * SETUP_ROWS is the four things that come after the account exists. A new
 * participant meets two things before them — which journey this is, and who
 * they are — so the walkthrough puts those first. Without them this screen
 * showed four fifths of onboarding and called it the onboarding.
 *
 * Both are the real components: TrackChoice in preview, because changing
 * somebody's track from a review screen would be a real change to their
 * journey, and ProfileForm live, because it is their own details and saving
 * them from here is exactly as valid as saving them from the journey page.
 */
const INTRO = [
  { key: "track", title: "Hvar viltu byrja?", why: "Þrjár leiðir inn, eftir því hvað þú ert með í höndunum." },
  // The "why" depends on the track: an app-only journey is never asked for a
  // kennitala, so promising one in the step header would be a lie the form
  // underneath immediately contradicts.
  { key: "profile", title: "Upplýsingar um þig", why: "" },
] as const;

/** What the details step actually asks for, which the track decides. */
function profileWhy(entry?: string | null): string {
  return entry === "app" || entry === "coach"
    ? "Nafnið þitt, og samþykki fyrir því að við vinnum með heilsufarsupplýsingarnar þínar."
    : "Nafn, kennitala, sími og heimilisfang — og samþykki fyrir heilsufarsupplýsingum.";
}

/**
 * Everything the four setup steps need, loaded once.
 *
 * Pulled out of the walkthrough so /app/adgangur can render the same
 * editors without opening it. The alternative was a second copy of the
 * coach picker, the calendar button and the notification switch, which is
 * how two screens that are supposed to do the same thing drift apart.
 */
export function useSetupData(api: Api) {
  const [calOpen, setCalOpen] = useState(false);
  const [coaches, setCoaches] = useState<Worker[] | null>(null);
  const [myCoach, setMyCoach] = useState<Worker | null>(null);
  const [calConnected, setCalConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [iosNeedsInstall] = useState(() => {
    if (typeof window === "undefined") return false;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    return ios && !standalone;
  });

  const load = useCallback(async () => {
    const [coach, cal] = await Promise.all([
      api("/api/hc/coach").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/google").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setTimeout(() => {
      setMyCoach(coach?.coach ?? null);
      setCoaches(coach?.coaches ?? []);
      setCalConnected(!!cal?.connected);
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const calendarApi: CalendarApi = {
    call: api,
    googleStatusUrl: "/api/hc/google",
    startGoogle: async () => {
      const r = await api("/api/hc/google/start", { method: "POST", body: "{}" }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok && j.url) { window.location.href = j.url; return; }
      // Was silent: the button did nothing at all when Google was not set up.
      toast.show(r ? "Ekki tókst að tengjast Google. Reyndu aftur eða notaðu dagatalsslóðina." : "Engin tenging. Athugaðu netið og reyndu aftur.", { tone: "bad" });
    },
    icsTokenUrl: "/api/hc/calendar-token",
    subscriptionName: "Lifeline heilsuferð",
  };

  const pickCoach = async (id: string) => {
    if (busy) return;
    setBusy(true);
    const r = await api("/api/hc/coach", { method: "POST", body: JSON.stringify({ coach_id: id }) }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { toast.show(SAVE_FAILED, { tone: "bad" }); return; }
    toast.show("Þjálfarinn er valinn", { tone: "ok" });
    await load();
  };

  return { calOpen, setCalOpen, coaches, myCoach, calConnected, busy,
           iosNeedsInstall, load, calendarApi, pickCoach };
}

export type SetupData = ReturnType<typeof useSetupData>;

export default function SetupWalkthrough({ api, onClose, data, reload, entry }: {
  api: Api;
  onClose: () => void;
  /** For the profile step; omitted where the caller has no journey loaded. */
  data?: ProfileFormData;
  reload?: () => Promise<void>;
  /** Which product this is, so the coach step can be left out where there is none. */
  entry?: string | null;
}) {
  const [i, setI] = useState(0);
  const d = useSetupData(api);
  const { calOpen, setCalOpen, calendarApi, load } = d;

  /*
   * Warm what the last step needs while you are still on the first.
   * Fired on an idle callback so it never competes with the step somebody
   * is actually looking at; the result is thrown away, the point being
   * that the browser has it by the time the step mounts.
   */
  useEffect(() => {
    const warm = () => { void api("/api/hc/nudges").catch(() => {}); };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 2500 });
    else setTimeout(warm, 1200);
  }, [api]);

  /* Intro steps only where the caller can supply what they need. */
  const intro = data && reload ? INTRO : INTRO.filter((x) => x.key === "track");
  /* The coach step only when there is a choice to make (SetupFlow's rule). */
  const coachChoice = d.coaches !== null
    && [...(d.myCoach ? [d.myCoach] : []), ...d.coaches.filter((c) => c.id !== d.myCoach?.id)].length > 1;
  const four = SETUP_ROWS.filter((r) => r.key !== "coach" || (entry !== "app" && coachChoice));
  const steps: { key: string; title: string; why: string }[] = [
    ...intro.map((x) => (x.key === "profile" ? { ...x, why: profileWhy(entry) } : x)),
    ...four,
  ];
  const last = i === steps.length;
  const row = steps[i];

  return (
    <Sheet title="Uppsetning, skref fyrir skref" onClose={onClose} max="max-w-md" scrollResetKey={i}>
      <div className="p-4">
        {/* Where you are. Dots rather than "3/4", because the point of
            walking it is that the next thing is one thing. */}
        <div className="mb-4 flex items-center gap-1.5" aria-hidden>
          {steps.map((r, n) => (
            <span key={r.key}
              className={`h-1.5 flex-1 rounded-full ${n < i ? "bg-hc-brand" : n === i ? "bg-hc-brand/60" : "bg-slate-200"}`} />
          ))}
          <span className={`h-1.5 w-6 rounded-full ${last ? "bg-hc-brand" : "bg-slate-200"}`} />
        </div>

        {last ? (
          <div className="py-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-hc-brand text-white">
              <Check className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-3 text-xl font-bold text-hc-ink">Það er allt</h3>
            <p className="mx-auto mt-1 max-w-xs text-sm text-hc-ink-2">
              Þetta er það sem nýr þátttakandi fer í gegnum. Þú getur alltaf breytt hverju sem er í stillingum.
            </p>
            {/* A way back from the end.
                The last screen offered only "Loka", so anybody who wanted
                one more look at a step had to shut the whole thing and
                start again from step one. */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={onClose}
                className="rounded-full bg-hc-brand-dark px-5 py-2.5 text-sm font-semibold text-white">
                Loka
              </button>
              <button type="button" onClick={() => setI(steps.length - 1)}
                className="inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-sm font-semibold text-hc-ink-2 hover:text-hc-ink-2">
                <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-hc-brand">
              Skref {i + 1} af {steps.length}
            </p>
            <h3 className="mt-0.5 text-xl font-bold text-hc-ink">{row.title}</h3>
            <p className="mt-1 text-sm text-hc-ink-2">{row.why}</p>

            <div className="mt-4">
              <SetupStepBody rowKey={row.key} d={d} api={api} data={data} reload={reload} entry={entry} />
            </div>
          </>
        )}

        {!last && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-hc-hairline pt-4">
            <button type="button" disabled={i === 0} onClick={() => setI((n) => Math.max(0, n - 1))}
              className="inline-flex items-center gap-1 text-sm font-semibold text-hc-ink-2 disabled:opacity-40">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
            </button>
            {/* "Sleppa" and "Næsta" do the same thing on purpose. Nothing
                here is required, and a flow that pretends otherwise is how
                you lose the people who only wanted a look. The wording just
                tells the truth about what the button means. */}
            <button type="button" onClick={() => setI((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-full bg-hc-brand-dark px-4 py-2 text-sm font-semibold text-white">
              Næsta <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      <CalendarConnect api={calendarApi} open={calOpen}
        onClose={() => { setCalOpen(false); void load(); }}
        intro="Tímar hjá Lifeline birtast í dagatalinu þínu og myndsímtöl fá hlekk á fundinn." />
    </Sheet>
  );
}

/**
 * The editor for one setup step.
 *
 * The walkthrough shows these one at a time; /app/adgangur shows all of
 * them at once. Same component either way — the difference between a flow
 * and a settings page is the frame around it, not the controls.
 */
export function SetupStepBody({ rowKey, d, api, data, reload, entry }: {
  rowKey: string;
  d: SetupData;
  api: Api;
  data?: ProfileFormData;
  reload?: () => Promise<void>;
  entry?: string | null;
}) {
  const { myCoach, coaches, busy, pickCoach, calConnected, setCalOpen, iosNeedsInstall } = d;
  const row = { key: rowKey };
  return (
    <>
            {row.key === "track" && (
              <TrackChoice api={api} preview bare onDone={() => {}} />
            )}
            {row.key === "profile" && data && reload && (
              <ProfileForm data={data} reload={reload} api={api}
                track={entry === "app" || entry === "coach" ? "app" : "care"} />
            )}
            {row.key === "coach" && (
              <CoachStep myCoach={myCoach} coaches={coaches} busy={busy} onPick={pickCoach} />
            )}
            {row.key === "calendar" && (
              <div>
                <p className="mb-2 text-sm text-hc-ink-2">
                  {calConnected
                    ? "Dagatalið er tengt. Tímar og myndsímtöl birtast þar sjálfkrafa."
                    : "Tengdu Google-dagatalið þitt. Myndsímtöl fá hlekk á fundinn og staðsetning fylgir bókuðum tímum."}
                </p>
                <button type="button" onClick={() => setCalOpen(true)}
                  className="rounded-full bg-hc-brand-dark px-4 py-2 text-sm font-semibold text-white">
                  {calConnected ? "Skoða dagatalstengingu" : "Tengja dagatal"}
                </button>
              </div>
            )}
            {row.key === "partner" && <PartnerCard api={api} bare pick />}
            {row.key === "nudge" && (
              <div className="space-y-3">
                {/* Install first on iPhone, because there the order is not a
                    preference. Safari exposes the Notification and Push APIs
                    only to an installed app — in a tab they do not exist, so
                    permission cannot even be asked for, and a subscription
                    made in the tab would not serve the installed app anyway.
                    Offering the reminder first therefore sent iPhone users at
                    a switch that could not work, and told them why only after
                    they had tried it.

                    Android and desktop take notifications in the browser and
                    carry them into the installed app, so there the reminder
                    comes first and the install is the follow-up. */}
                {/* The install guide itself lives in one place, the guided
                    setup's „Appið á heimaskjáinn“ step (and under
                    Stillingar); here it is a link the person can follow. */}
                {iosNeedsInstall ? (
                  <div className="rounded-2xl bg-hc-sunken p-3">
                    <p className="text-xs text-hc-ink-2">
                      Á iPhone berast tilkynningar aðeins þegar Lifeline er á heimaskjánum. Áminning í tölvupósti virkar strax.{" "}
                      <Link href="/app/uppsetning?skref=app" className="font-semibold underline">Sjá hvernig appið fer á heimaskjáinn</Link>
                    </p>
                    <div className="mt-2"><NudgeSettings api={api} /></div>
                  </div>
                ) : (
                  <NudgeSettings api={api} />
                )}
              </div>
            )}
    </>
  );
}
