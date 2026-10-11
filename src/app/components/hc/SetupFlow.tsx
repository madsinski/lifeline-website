"use client";

// "Komdu þér af stað" — everything a new participant sets up, in one pass.
//
// ── Why this exists ─────────────────────────────────────────────────────
//
// None of these four things is new. The coach, the calendar, the
// ábyrgðarfélagi and the daily reminder were all built, and all four lived
// in Stillingar — a page you reach by finishing onboarding first and then
// going looking. So the honest description of the old flow is that we asked
// for a kennitala and an address, and left the parts that decide whether
// somebody comes back to be discovered later, or never.
//
// They are gathered here instead, at first run, each with the reason it
// matters next to it.
//
// ── Why the reminder is in this list ────────────────────────────────────
//
// It is the one item with real evidence behind it rather than a designer's
// hunch. In a retrospective cohort of 19,805 users of a public nutrition
// app, people who set a reminder were 4.63 times more likely to complete a
// second food diary — and the same study found that people who skipped the
// tutorial were less adherent. That is observational and cannot show cause,
// but it is a large sample pointing the same way as the controlled work on
// prompts and cues as behaviour-change techniques, so the reminder is
// offered at setup rather than buried in settings.
//
// ── What this is not ───────────────────────────────────────────────────
//
// Not a gate. Only the profile is actually required, and that is enforced
// where it already was. Each row here can be left alone and picked up
// later, and says so. Making a first-run flow mandatory is how you lose the
// people who only wanted to look around.

import { useCallback, useEffect, useState } from "react";
import { Bell, CalendarDays, Check, ChevronDown, PlayCircle, UserRound, Users } from "lucide-react";
import CalendarConnect, { type CalendarApi } from "./CalendarConnect";
import InstallGuide from "./InstallGuide";
import NudgeSettings from "./NudgeSettings";
import PartnerCard from "./PartnerCard";
import SetupWalkthrough from "./SetupWalkthrough";
import type { ProfileFormData } from "./ProfileForm";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export type SetupKey = "coach" | "calendar" | "partner" | "nudge";
type Key = SetupKey;

interface Worker { id: string; name: string | null; role: string | null; photo_url?: string | null; bio?: string | null }

const ROLE_IS: Record<string, string> = {
  nurse: "hjúkrunarfræðingur", doctor: "læknir", coach: "þjálfari",
  psychologist: "sálfræðingur", physio: "sjúkraþjálfari",
};

/** The four things, and why each one is worth a minute now. */
export const SETUP_ROWS: { key: Key; title: string; why: string; icon: typeof Bell }[] = [
  { key: "coach", title: "Þjálfarinn þinn", why: "Sá sem fer yfir áætlunina með þér og svarar skilaboðum.", icon: UserRound },
  { key: "calendar", title: "Tengdu dagatalið þitt", why: "Tímar og myndsímtöl birtast sjálfkrafa í dagatalinu þínu, með hlekk á fundinn.", icon: CalendarDays },
  /* "Ábyrgðarfélagi" is a mouthful that reads like paperwork. "Félagi" is
     the plain word, and the step says what the person actually does. Not
     "samherji", which fits the meaning but is the name of one of Iceland's
     best-known companies, scandal attached. */
  { key: "partner", title: "Veldu félaga", why: "Einn sem sér hvaða daga þú gerðir eitthvað. Ekkert annað.", icon: Users },
  { key: "nudge", title: "Áminning og appið", why: "Lítil ýting á þeim tíma sem þú velur — og Lifeline á heimaskjáinn, sem þarf til að tilkynningar berist í iPhone.", icon: Bell },
];

export default function SetupFlow({ api, place = "onboarding" }: {
  api: Api;
  /*
   * Where it is standing, which changes only what it calls itself.
   *
   * In settings "Komdu þér af stað" is wrong for somebody who got started
   * months ago, and "þú getur komið að því síðar í stillingum" is
   * self-referential when you are already there. The rows are identical
   * either way — this is the one place the four things can be reviewed
   * after onboarding, and a second, different-looking version of them
   * would be worse than one that renames its header.
   */
  place?: "onboarding" | "settings";
}) {
  const [open, setOpen] = useState<Key | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [done, setDone] = useState<Record<Key, boolean>>({ coach: false, calendar: false, partner: false, nudge: false });
  const [coaches, setCoaches] = useState<Worker[] | null>(null);
  const [myCoach, setMyCoach] = useState<Worker | null>(null);
  const [busy, setBusy] = useState(false);
  const [walk, setWalk] = useState(false);
  /*
   * iPhone, and not on the home screen yet.
   *
   * Read once on mount. Installing happens in another context — the user
   * leaves, adds it, and comes back through the icon — so this does not
   * need to be live, and a value that flips under somebody's finger would
   * be worse than one that is a minute old.
   */
  const [iosNeedsInstall] = useState(() => {
    if (typeof window === "undefined") return false;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    return ios && !standalone;
  });
  /*
   * The participant's own details, for the walkthrough's profile step.
   *
   * /api/hc/profile already returns exactly the shape ProfileForm wants —
   * email, name, phone, address, kennitala_last4, complete — plus the
   * consent flag, which that endpoint keeps separately.
   */
  const [profile, setProfile] = useState<ProfileFormData | null>(null);
  /** Which product this journey is, so the rows can drop what does not apply. */
  const [entry, setEntry] = useState<string | null>(null);

  const calendarApi: CalendarApi = {
    call: api,
    googleStatusUrl: "/api/hc/google",
    startGoogle: async () => {
      const r = await api("/api/hc/google/start", { method: "POST", body: "{}" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) window.location.href = j.url;
    },
    icsTokenUrl: "/api/hc/calendar-token",
    subscriptionName: "Lifeline heilsuferð",
  };

  /*
   * What is already set up.
   *
   * Four reads, and every one of them is allowed to fail quietly: this is a
   * checklist, and a checklist that explodes because the calendar service is
   * down is worse than one that shows an item as not-yet-done.
   */
  const load = useCallback(async () => {
    const [coach, cal, partner, nudge, prof] = await Promise.all([
      api("/api/hc/coach").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/google").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/partner").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/nudges").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    /*
     * Out of the effect's own tick.
     *
     * Four awaited reads resolve inside the effect that started them, and
     * setting state there synchronously is what the react-hooks rule warns
     * about. PartnerCard right next door already does this for the same
     * reason.
     */
    setTimeout(() => {
      setMyCoach(coach?.coach ?? null);
      setCoaches(coach?.coaches ?? []);
      setEntry(typeof prof?.entry === "string" ? prof.entry : null);
      setProfile(prof?.profile
        ? { profile: { ...prof.profile, health_consent: !!prof.health_consent } }
        : null);
      setDone({
        coach: !!coach?.coach,
        calendar: !!cal?.connected,
        partner: !!partner?.partner?.id || !!partner?.partner?.name,
        nudge: (nudge?.prefs?.channels?.length ?? 0) > 0,
      });
    }, 0);
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const pickCoach = async (id: string) => {
    setBusy(true);
    await api("/api/hc/coach", { method: "POST", body: JSON.stringify({ coach_id: id }) }).catch(() => null);
    setBusy(false);
    await load();
  };

  /*
   * No coach row for somebody using the app on their own.
   *
   * "Þjálfarinn þinn" on the app-alone track is a step that can never
   * complete, about a person who is not part of what they chose. Where the
   * track is unknown the row stays, which is the old behaviour.
   */
  const rows = entry === "app" ? SETUP_ROWS.filter((r) => r.key !== "coach") : SETUP_ROWS;
  const count = rows.filter((r) => done[r.key]).length;
  const all = count === rows.length;
  const settings = place === "settings";

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-hc-brand">
            {settings ? "Uppsetningin þín" : "Komdu þér af stað"}
          </p>
          <h3 className="mt-0.5 text-xl font-bold text-slate-900">
            {settings
              ? (all ? "Allt er uppsett" : "Fjögur atriði, ein mínúta hvert")
              : "Fjögur atriði, ein mínúta hvert"}
          </h3>
        </div>
        <p className="text-sm font-semibold tabular-nums text-slate-500">{count}/{rows.length}</p>
      </div>
      <p className="mt-1.5 text-sm text-slate-600">
        {settings
          ? (all
            ? "Þú getur breytt hverju sem er hér — þjálfara, dagatali, ábyrgðarfélaga og áminningum."
            : "Opnaðu það sem þú vilt setja upp. Ekkert af þessu er skylda.")
          : "Ekkert af þessu er skylda og þú getur komið að því síðar í stillingum. Það er einfaldlega best að gera það núna."}
      </p>

      {/* The way to actually walk it.
          The card is right for fixing one thing; it is the wrong shape for
          seeing what a new participant meets, because they do not meet a
          summary — they meet one question at a time. */}
      <button type="button" onClick={() => setWalk(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
        <PlayCircle className="h-4 w-4 text-hc-brand" aria-hidden />
        {settings ? "Skoða skref fyrir skref" : "Leiða mig í gegnum það"}
      </button>

      <ul className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200">
        {rows.map((row) => {
          const Icon = row.icon;
          const on = open === row.key;
          const ok = done[row.key];
          return (
            <li key={row.key} className="border-b border-slate-100 last:border-b-0">
              <button type="button" onClick={() => setOpen(on ? null : row.key)} aria-expanded={on}
                className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-slate-50">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ok ? "bg-hc-brand text-white" : "bg-slate-100 text-slate-500"}`}>
                  {ok ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight text-slate-900">{row.title}</span>
                  <span className="block text-xs leading-snug text-slate-500">{row.why}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${on ? "rotate-180" : ""}`} aria-hidden />
              </button>

              {on && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                  {row.key === "coach" && (
                    <CoachStep myCoach={myCoach} coaches={coaches} busy={busy} onPick={pickCoach} />
                  )}
                  {row.key === "calendar" && (
                    <div>
                      <p className="mb-2 text-sm text-slate-600">
                        {done.calendar
                          ? "Dagatalið er tengt. Tímar og myndsímtöl birtast þar sjálfkrafa."
                          : "Tengdu Google-dagatalið þitt. Myndsímtöl fá hlekk á fundinn og staðsetning fylgir bókuðum tímum."}
                      </p>
                      <button type="button" onClick={() => setCalOpen(true)}
                        className="rounded-full bg-hc-ink px-4 py-2 text-sm font-semibold text-white">
                        {done.calendar ? "Skoða dagatalstengingu" : "Tengja dagatal"}
                      </button>
                    </div>
                  )}
                  {row.key === "partner" && <PartnerCard api={api} bare />}
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
                      {iosNeedsInstall ? (
                        <>
                          <InstallGuide bare defaultOpen />
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-600">
                              Þegar Lifeline er á heimaskjánum opnarðu appið þaðan og velur áminningu hér.
                            </p>
                            <div className="mt-2 opacity-60"><NudgeSettings api={api} /></div>
                          </div>
                        </>
                      ) : (
                        <>
                          <NudgeSettings api={api} />
                          <InstallGuide bare />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {walk && (
        <SetupWalkthrough api={api} onClose={() => { setWalk(false); void load(); }}
          data={profile ?? undefined} reload={load} entry={entry} />
      )}

      <CalendarConnect api={calendarApi} open={calOpen}
        onClose={() => { setCalOpen(false); void load(); }}
        intro="Tímar hjá Lifeline birtast í dagatalinu þínu og myndsímtöl fá hlekk á fundinn." />
    </section>
  );
}

/**
 * Choosing a coach, or being introduced to one.
 *
 * With one sensible option this is not a choice, and dressing it as one
 * ("velurðu Mads?") wastes a tap and makes the service look thinner than it
 * is. So: a coach already assigned is introduced; several are offered; none
 * says plainly that one is on the way. The role is shown because that is
 * what currently distinguishes the entries, both of which are the same
 * person wearing two hats.
 */
/**
 * Choosing a coach.
 *
 * This used to introduce whoever had been assigned and hide the others
 * behind a "velja annan" disclosure, on the reasoning that one option is not
 * a choice. Mads wants the list, which is the right call for onboarding: the
 * step asks you to pick, so it should show what there is to pick from, and
 * an assignment made before you were asked is not a decision you took.
 *
 * The current one is marked rather than hidden, so changing your mind is the
 * same gesture as choosing in the first place.
 */
export function CoachStep({ myCoach, coaches, busy, onPick }: {
  myCoach: Worker | null;
  coaches: Worker[] | null;
  busy: boolean;
  onPick: (id: string) => void;
}) {
  /* Which bio is open. One at a time, so the list stays a list. */
  const [bioOpen, setBioOpen] = useState<string | null>(null);
  if (coaches === null) {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-16 rounded-xl hc-shimmer" />
        <div className="h-16 rounded-xl hc-shimmer" />
      </div>
    );
  }

  /* Whoever is assigned belongs in the list, at the top. The API returns
     them separately from the others. */
  const all = [...(myCoach ? [myCoach] : []), ...coaches.filter((c) => c.id !== myCoach?.id)];

  if (all.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Þjálfari er úthlutaður þegar áætlunin þín er gerð. Þú þarft ekki að gera neitt hér.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">
        {all.length === 1
          ? "Þessi fer yfir áætlunina með þér."
          : "Veldu þann sem þú vilt að fylgi þér."}
      </p>
      <ul className="space-y-1.5">
        {all.map((c) => {
          const on = c.id === myCoach?.id;
          const openBio = bioOpen === c.id;
          return (
            <li key={c.id}
              className={`overflow-hidden rounded-xl border transition ${
                on ? "border-hc-brand bg-hc-brand/5" : "border-slate-200 bg-white"}`}>
              {/* A row, not a button wrapping a button.
                  The card used to be one big <button aria-pressed>, and a
                  bio toggle inside it would have been a button inside a
                  button — invalid, and the browser picks which one your tap
                  meant. Selecting and reading are two targets now. */}
              <div className="flex items-center gap-3 p-2.5">
                <button type="button" disabled={busy} onClick={() => onPick(c.id)}
                  aria-pressed={on}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50">
                  {c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand" aria-hidden>
                      <UserRound className="h-5 w-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-tight text-slate-900">{c.name ?? "Þjálfari"}</span>
                    {c.role && <span className="block text-xs text-slate-500">{ROLE_IS[c.role] ?? c.role}</span>}
                  </span>
                </button>
                {on && (
                  <span className="shrink-0 rounded-full bg-hc-brand px-2 py-0.5 text-[10px] font-bold text-white">valinn</span>
                )}
                {c.bio && (
                  <button type="button" onClick={() => setBioOpen(openBio ? null : c.id)}
                    aria-expanded={openBio}
                    aria-label={`Um ${c.name ?? "þjálfarann"}`}
                    className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <ChevronDown className={`h-4 w-4 transition ${openBio ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                )}
              </div>

              {openBio && c.bio && (
                <div className="border-t border-slate-100 bg-white/70 px-3 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Um þjálfarann</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{c.bio}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
