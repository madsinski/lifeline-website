"use client";

/*
 * The coach's own settings, as a page rather than a header menu.
 *
 * Everything here already existed — PIN, calendar connection, sign-out —
 * but only as items in a dropdown behind the avatar, which is where things
 * go to be forgotten. A coach setting up for the first time had no page
 * that said "here is what you can configure"; they had to open a menu and
 * recognise the right line.
 *
 * The notification toggle is new, and is here because the workstation
 * gained a chime and a pulsing badge: a coach sitting next to a colleague,
 * or in a room with a client, needs to be able to turn the sound off
 * without turning the signal off. Stored per device in localStorage, which
 * is correct for a sound preference — the same person at home and in the
 * clinic may want different answers, and it is not a fact about them worth
 * keeping on a server.
 */

import { useEffect, useState } from "react";
import { Bell, BellOff, Calendar, KeyRound, LogOut, Check, Monitor, Moon, Sun } from "lucide-react";
import { hcBtn } from "./ui";
import { SOUND_KEY, soundOn } from "@/lib/hc/chime";

export default function WsSettings({ me, mode, onPin, onCalendar, onLogout }: {
  me: { name: string; email: string; organization: string; role: string; has_pin: boolean };
  mode: "worker" | "staff";
  onPin: () => void;
  onCalendar: () => void;
  onLogout: () => void;
}) {
  const [sound, setSound] = useState(true);
  /* "kerfið" follows the operating system, which is what most people
     actually want — their phone already switches at dusk. The two explicit
     choices exist for the cases it gets wrong: a bright clinic room, or a
     shared workstation whose OS nobody is going to change. */
  const [scheme, setScheme] = useState<"system" | "light" | "dark">("system");
  /* Read after mount: localStorage does not exist while rendering on the
     server, and a value read during render would be a hydration mismatch. */
  useEffect(() => {
    setTimeout(() => {
      setSound(soundOn());
      try {
        const v = window.localStorage.getItem("ll-scheme");
        setScheme(v === "dark" || v === "light" ? v : "system");
      } catch { /* private mode */ }
    }, 0);
  }, []);

  /* The choice is state; applying it to <html> is an effect.
     Writing document.documentElement.dataset straight from the handler is a
     mutation of something outside the component, which the React compiler
     rejects — and keying it to the state means the attribute and the button
     can never disagree. */
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    if (!applied) return;
    try {
      if (scheme === "system") {
        window.localStorage.removeItem("ll-scheme");
        delete document.documentElement.dataset.scheme;
      } else {
        window.localStorage.setItem("ll-scheme", scheme);
        document.documentElement.dataset.scheme = scheme;
      }
    } catch { /* private mode */ }
  }, [scheme, applied]);

  const pickScheme = (v: "system" | "light" | "dark") => { setApplied(true); setScheme(v); };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { window.localStorage.setItem(SOUND_KEY, next ? "on" : "off"); } catch { /* private mode */ }
  };

  const roleIs = me.role === "doctor" ? "Læknir" : me.role === "admin" ? "Stjórnandi" : "Hjúkrunarfræðingur";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 shadow-hc-card">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Þú</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {([["Nafn", me.name], ["Netfang", me.email],
             ["Starfsstöð", me.organization || "—"], ["Hlutverk", roleIs]] as const).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-hc-ink-2">{k}</dt>
              <dd className="truncate text-sm font-semibold text-hc-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {/* Said rather than left to be discovered: a coach who wants their
            name changed should know who changes it. */}
        <p className="mt-3 text-xs text-hc-ink-2">
          Hafðu samband við stjórnanda til að breyta nafni, netfangi eða hlutverki.
        </p>
      </section>

      <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 shadow-hc-card">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Tilkynningar</h2>
        <button type="button" onClick={toggleSound}
          className="flex w-full items-center gap-3 rounded-xl border border-hc-hairline p-3 text-left transition hover:bg-hc-sunken">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            sound ? "bg-hc-brand-surface text-hc-brand-text" : "bg-hc-sunken-2 text-hc-ink-3"}`}>
            {sound ? <Bell className="h-4 w-4" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-hc-ink">Hljóð við ný skilaboð</span>
            <span className="block text-xs text-hc-ink-2">
              {sound ? "Stutt hljóð þegar skilaboð eða beiðni berst." : "Slökkt — rauði punkturinn blikkar áfram."}
            </span>
          </span>
          {/* A switch, not a checkbox: this is on/off, not a choice in a
              list, and the state should read at a glance from across a desk. */}
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${sound ? "bg-hc-brand" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-hc-surface shadow transition-all ${sound ? "left-[1.375rem]" : "left-0.5"}`} />
          </span>
        </button>
      </section>

      <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 shadow-hc-card">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Útlit</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {([["system", "Kerfið", Monitor], ["light", "Ljóst", Sun], ["dark", "Dökkt", Moon]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => pickScheme(k)} aria-pressed={scheme === k}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                scheme === k ? "border-hc-brand bg-hc-brand-surface text-hc-brand-text"
                             : "border-hc-hairline text-hc-ink-2 hover:bg-hc-sunken"}`}>
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-hc-ink-3">Gildir á þessu tæki.</p>
      </section>

      <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 shadow-hc-card">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Aðgangur og dagatal</h2>
        <div className="space-y-2">
          <Row icon={<Calendar className="h-4 w-4" aria-hidden />} title="Dagatal"
            detail="Tengdu Google dagatal eða sæktu áskriftarslóð svo bókanir birtist hjá þér."
            cta="Tengja" onClick={onCalendar} />
          {mode === "worker" && (
            <Row icon={<KeyRound className="h-4 w-4" aria-hidden />} title="PIN á þessu tæki"
              detail={me.has_pin
                ? "PIN er virkt. Þú getur skipt um það hvenær sem er."
                : "Settu PIN til að komast hraðar inn á þessu tæki."}
              cta={me.has_pin ? "Breyta" : "Setja"} onClick={onPin} done={me.has_pin} />
          )}
        </div>
      </section>

      {mode === "worker" && (
        <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 shadow-hc-card">
          <button type="button" onClick={onLogout}
            className={`${hcBtn.secondary} w-full justify-center text-hc-bad-ink ring-hc-bad-ink/30 hover:bg-hc-bad-surface`}>
            <LogOut className="h-4 w-4" aria-hidden /> Útskrá
          </button>
        </section>
      )}
    </div>
  );
}

function Row({ icon, title, detail, cta, onClick, done }: {
  icon: React.ReactNode; title: string; detail: string; cta: string; onClick: () => void; done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-hc-hairline p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hc-sunken-2 text-hc-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-hc-ink">
          {title}
          {done && <Check className="h-3.5 w-3.5 text-hc-brand-text" aria-hidden />}
        </span>
        <span className="block text-xs text-hc-ink-2">{detail}</span>
      </span>
      <button type="button" onClick={onClick}
        className="shrink-0 rounded-full border border-hc-brand/40 bg-hc-surface px-3 py-1.5 text-xs font-semibold text-hc-brand-text transition hover:bg-hc-brand-surface">
        {cta}
      </button>
    </div>
  );
}
