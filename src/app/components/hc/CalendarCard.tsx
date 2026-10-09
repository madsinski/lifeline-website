"use client";

// Put the week in the calendar people already use.
//
// Two paths, because the two platforms genuinely differ and pretending
// otherwise would mean promising something that does not happen:
//
//  · Google, connected over OAuth, is a push. We write to a calendar we
//    create in their account and reconcile it on every change, so a moved
//    session lands in seconds. That is what "instant" means here.
//
//  · A subscription feed (.ics / webcal) is a pull, and the refresh interval
//    belongs to the client, not to us. Apple Calendar checks on its own
//    schedule — often enough to be useful, and the person can set it to
//    five minutes — while Google's external-feed refresh is measured in
//    hours and sometimes a day. So the feed is how Apple and Outlook work,
//    and Google users are better served connecting.
//
// Instant on Apple would mean CalDAV with the person's Apple ID credentials
// or an app-specific password, held by us and used to write into a calendar
// we do not own. Not worth it for a weekly training plan.

import { useEffect, useState } from "react";
import { Calendar, Check, Copy, RefreshCw } from "lucide-react";
import { hcCard } from "./ui";

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  calendarName: string;
}

/** Hand-formatted: the Vercel runtime has no Icelandic locale data. */
const MO = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const when = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getDate()}. ${MO[d.getMonth()]} kl. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function CalendarCard({ api }: {
  api: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [g, setG] = useState<GoogleStatus | null>(null);
  const [feed, setFeed] = useState<{ https: string; webcal: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await api("/api/hc/google").catch(() => null);
      if (r?.ok) setG(await r.json());
    })();
  }, [api]);

  const makeFeed = async (rotate = false) => {
    setBusy("feed");
    const r = await api("/api/hc/calendar-token", { method: "POST", body: JSON.stringify({ rotate }) }).catch(() => null);
    if (r?.ok) setFeed(await r.json());
    setBusy(null);
  };

  const connect = async () => {
    setBusy("google");
    const r = await api("/api/hc/google", { method: "POST", body: JSON.stringify({ returnTo: "/account/heilsuferd/aaetlun?tab=exercise" }) }).catch(() => null);
    const j = r?.ok ? await r.json() : null;
    setBusy(null);
    if (j?.url) window.location.href = j.url as string;
  };

  const patch = async (body: Record<string, unknown>, tag: string) => {
    setBusy(tag);
    const r = await api("/api/hc/google", { method: "PATCH", body: JSON.stringify(body) }).catch(() => null);
    if (r?.ok) {
      const j = await r.json();
      setG((prev) => (prev ? { ...prev, ...j } : prev));
    }
    setBusy(null);
  };

  return (
    <section className={`${hcCard.base} overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
        <Calendar className="h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
        <p className="font-semibold text-hc-ink">Í dagatalið mitt</p>
      </div>

      {/* Google: a real push, when it is set up. */}
      {g?.configured && (
        <div className="border-t border-slate-100 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">Google dagatal</p>
              <p className="text-sm text-slate-500">
                {g.connected
                  ? <>Tengt{g.email ? <> við {g.email}</> : null}. Uppfærist um leið og vikan breytist.</>
                  : "Tengdu og þá færist vikan yfir sjálfkrafa — og uppfærist um leið og þú breytir henni."}
              </p>
            </div>
            {g.connected ? (
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => void patch({ sync: true }, "sync")} disabled={busy === "sync"}
                  className="inline-flex items-center gap-1.5 rounded-hc-element px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50">
                  <RefreshCw className={`h-3.5 w-3.5 ${busy === "sync" ? "animate-spin" : ""}`} aria-hidden />
                  Uppfæra núna
                </button>
                <button type="button" onClick={() => void patch({ enabled: !g.enabled }, "toggle")} disabled={busy === "toggle"}
                  className="shrink-0 rounded-hc-element px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50">
                  {g.enabled ? "Gera hlé" : "Halda áfram"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => void connect()} disabled={busy === "google"}
                className="shrink-0 rounded-hc-element bg-hc-brand px-4 py-1.5 text-sm font-bold text-white transition hover:bg-hc-brand-dark disabled:opacity-50">
                Tengja
              </button>
            )}
          </div>
          {g.connected && g.lastSyncAt && (
            <p className="mt-1.5 text-xs text-slate-400">Síðast uppfært {when(g.lastSyncAt)}</p>
          )}
          {g.lastError && (
            <p className="mt-1.5 text-xs text-amber-700">Síðasta tilraun gekk ekki. Við reynum aftur við næstu breytingu.</p>
          )}
        </div>
      )}

      {/* The feed: Apple, Outlook, anything that takes a subscription. */}
      <div className="border-t border-slate-100 px-4 py-3.5 sm:px-5">
        <p className="text-sm font-semibold text-slate-800">Apple dagatal, Outlook og önnur</p>
        <p className="text-sm text-slate-500">
          Áskrift að dagatali. Þú bætir hlekknum við einu sinni og dagatalið sækir breytingar sjálft eftir það.
        </p>
        {!feed ? (
          <button type="button" onClick={() => void makeFeed()} disabled={busy === "feed"}
            className="mt-2.5 rounded-hc-element px-3 py-1.5 text-sm font-semibold text-hc-brand-dark ring-1 ring-hc-brand/30 transition hover:bg-hc-brand/5 disabled:opacity-50">
            Fá hlekk
          </button>
        ) : (
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-hc-element bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">{feed.https}</code>
              <button type="button"
                onClick={() => { void navigator.clipboard?.writeText(feed.https).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); }}
                aria-label="Afrita hlekk"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-hc-element text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50">
                {copied ? <Check className="h-4 w-4 text-hc-brand-dark" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={feed.webcal}
                className="rounded-hc-element bg-hc-brand px-4 py-1.5 text-sm font-bold text-white transition hover:bg-hc-brand-dark">
                Opna í dagatali
              </a>
              <button type="button" onClick={() => void makeFeed(true)} disabled={busy === "feed"}
                className="rounded-hc-element px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50">
                Búa til nýjan hlekk
              </button>
            </div>
            {/* The link is the credential, so say so plainly rather than
                leaving somebody to paste it into a shared calendar. */}
            <p className="text-xs text-slate-400">
              Hlekkurinn er lykillinn — hver sem hefur hann sér dagatalið. Búðu til nýjan ef hann fer á flakk.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
