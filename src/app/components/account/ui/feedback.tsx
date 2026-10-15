"use client";

// Save feedback for the account pages — one pattern everywhere:
//
//   • busy:    the button shows a spinner and is disabled (Button busy=…)
//   • success: "Vistað ✓" right next to the button for ~3 s (SavedNote +
//              useFlash); when the control that was pressed goes away (a
//              modal closes, a form collapses) the note sits where the
//              person is looking instead, or a toast says it
//   • failure: the reason, in Icelandic, next to the button (Alert tone
//              "bad"), via friendlyError() so a raw PostgREST / network
//              message never reaches the page on its own.

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

/** A message that clears itself after `ms`. */
export function useFlash(ms = 3000): [string, (msg: string) => void, () => void] {
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setMsg("");
  }, []);
  const flash = useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(m);
    timer.current = setTimeout(() => { setMsg(""); timer.current = null; }, ms);
  }, [ms]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [msg, flash, clear];
}

/** The inline "Vistað ✓" beside a save button. Always mounted so screen
 *  readers announce it; empty when there is nothing to say. */
export function SavedNote({ msg, className = "" }: { msg: string; className?: string }) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 text-sm font-semibold text-hc-ok-ink ${className}`}>
      {msg && <><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />{msg}</>}
    </span>
  );
}

/**
 * An error, as something a person can act on, in Icelandic. Known causes
 * (no network, an expired session, a refused write, a weak password) get
 * their own sentence; anything else gets `fallback` with the technical
 * detail after it, so support can still see what happened.
 */
export function friendlyError(err: unknown, fallback = "Tókst ekki að vista. Reyndu aftur."): string {
  const raw = typeof err === "string" ? err
    : err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message ?? "")
    : "";
  const m = raw.toLowerCase();
  if (!raw) return fallback;
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request failed") || m.includes("load failed"))
    return "Engin tenging við netþjóninn. Athugaðu nettenginguna og reyndu aftur.";
  if (m.includes("jwt") || m.includes("unauthorized") || m.includes("not authenticated") || m.includes("invalid session") || m.includes("no_session") || m.includes("auth session missing"))
    return "Innskráningin er útrunnin. Skráðu þig inn aftur og reyndu svo aftur.";
  if (m.includes("row-level security") || m.includes("permission denied") || m.includes("forbidden"))
    return "Þú hefur ekki heimild til að gera þetta. Hafðu samband á contact@lifelinehealth.is ef það á ekki við.";
  if (m.includes("should be different from the old password") || m.includes("same_password"))
    return "Nýja lykilorðið má ekki vera það sama og það gamla.";
  if (m.includes("password should be at least") || m.includes("weak_password") || m.includes("password is known to be weak"))
    return "Lykilorðið er of veikt. Notaðu að minnsta kosti 12 stafi og forðastu algeng lykilorð.";
  if (m.includes("reauthentication") || m.includes("requires recent login"))
    return "Af öryggisástæðum þarftu að skrá þig inn aftur áður en þú breytir lykilorðinu.";
  if (m.includes("rate limit") || m.includes("too many requests"))
    return "Of margar tilraunir í röð. Bíddu aðeins og reyndu svo aftur.";
  if (m.includes("duplicate key") || m.includes("23505"))
    return "Þetta er þegar skráð.";
  return `${fallback} (${raw})`;
}
