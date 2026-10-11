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
import { Bell, CalendarDays, Check, ChevronDown, UserRound, Users } from "lucide-react";
import CalendarConnect, { type CalendarApi } from "./CalendarConnect";
import NudgeSettings from "./NudgeSettings";
import PartnerCard from "./PartnerCard";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

type Key = "coach" | "calendar" | "partner" | "nudge";

interface Worker { id: string; name: string | null; role: string | null; photo_url?: string | null; bio?: string | null }

const ROLE_IS: Record<string, string> = {
  nurse: "hjúkrunarfræðingur", doctor: "læknir", coach: "þjálfari",
  psychologist: "sálfræðingur", physio: "sjúkraþjálfari",
};

/** The four things, and why each one is worth a minute now. */
const ROWS: { key: Key; title: string; why: string; icon: typeof Bell }[] = [
  { key: "coach", title: "Þjálfarinn þinn", why: "Sá sem fer yfir áætlunina með þér og svarar skilaboðum.", icon: UserRound },
  { key: "calendar", title: "Dagatalið", why: "Tímar og myndsímtöl birtast sjálfkrafa í dagatalinu þínu, með hlekk á fundinn.", icon: CalendarDays },
  { key: "partner", title: "Ábyrgðarfélagi", why: "Einn sem þú velur sér hvað þú ert búinn að gera — ekkert annað.", icon: Users },
  { key: "nudge", title: "Dagleg áminning", why: "Lítil ýting á þeim tíma sem þú velur. Það sem helst skilur á milli þeirra sem halda áfram.", icon: Bell },
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
    const [coach, cal, partner, nudge] = await Promise.all([
      api("/api/hc/coach").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/google").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/partner").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/nudges").then((r) => (r.ok ? r.json() : null)).catch(() => null),
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

  const count = ROWS.filter((r) => done[r.key]).length;
  const all = count === ROWS.length;
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
        <p className="text-sm font-semibold tabular-nums text-slate-500">{count}/{ROWS.length}</p>
      </div>
      <p className="mt-1.5 text-sm text-slate-600">
        {settings
          ? (all
            ? "Þú getur breytt hverju sem er hér — þjálfara, dagatali, ábyrgðarfélaga og áminningum."
            : "Opnaðu það sem þú vilt setja upp. Ekkert af þessu er skylda.")
          : "Ekkert af þessu er skylda og þú getur komið að því síðar í stillingum. Það er einfaldlega best að gera það núna."}
      </p>

      <ul className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200">
        {ROWS.map((row) => {
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
                  {row.key === "partner" && <PartnerCard api={api} />}
                  {row.key === "nudge" && <NudgeSettings api={api} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>

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
function CoachStep({ myCoach, coaches, busy, onPick }: {
  myCoach: Worker | null;
  coaches: Worker[] | null;
  busy: boolean;
  onPick: (id: string) => void;
}) {
  if (coaches === null) return <p className="text-sm text-slate-500">Hleð…</p>;

  const others = coaches.filter((c) => c.id !== myCoach?.id);

  if (myCoach) {
    return (
      <div>
        <div className="flex items-center gap-3">
          {myCoach.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={myCoach.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-hc-brand/10 text-hc-brand" aria-hidden>
              <UserRound className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-semibold leading-tight text-slate-900">{myCoach.name ?? "Þjálfari"}</p>
            <p className="text-xs text-slate-500">
              {myCoach.role ? (ROLE_IS[myCoach.role] ?? myCoach.role) : "Þjálfari þinn"}
            </p>
          </div>
        </div>
        {myCoach.bio && <p className="mt-2 text-sm text-slate-600">{myCoach.bio}</p>}
        {others.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500">Velja annan</summary>
            <ul className="mt-2 space-y-1.5">
              {others.map((c) => (
                <li key={c.id}>
                  <button type="button" disabled={busy} onClick={() => onPick(c.id)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 transition hover:border-hc-brand disabled:opacity-50">
                    {c.name ?? "Þjálfari"}
                    {c.role && <span className="font-normal text-slate-500"> · {ROLE_IS[c.role] ?? c.role}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }

  if (others.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Þjálfari er úthlutaður þegar áætlunin þín er gerð. Þú þarft ekki að gera neitt hér.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">Veldu þann sem þú vilt fylgja þér.</p>
      <ul className="space-y-1.5">
        {others.map((c) => (
          <li key={c.id}>
            <button type="button" disabled={busy} onClick={() => onPick(c.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:border-hc-brand disabled:opacity-50">
              {c.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-hc-brand/10 text-hc-brand" aria-hidden>
                  <UserRound className="h-4 w-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight text-slate-900">{c.name ?? "Þjálfari"}</span>
                {c.role && <span className="block text-xs text-slate-500">{ROLE_IS[c.role] ?? c.role}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
