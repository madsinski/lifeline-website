"use client";

// Calendar setup — same flow as the Fjarlækningar HSU min-síða
// (CalendarSetup): pick Google / Apple / Outlook / other. Google is a direct
// push sync (appointments land within seconds of any change); the others
// subscribe to a personal .ics link. Used by the customer's heilsuferð and by
// the nurse workstation — the caller supplies how to talk to its own API.

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Calendar, Check, CheckCircle2, Copy, ExternalLink, Link2, Mail, RefreshCw, X } from "lucide-react";
import qrcode from "qrcode-generator";

type Choice = "google" | "apple" | "outlook" | "other";

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  calendarName: string;
}

export interface CalendarApi {
  /** fetch with this surface's credentials */
  call: (url: string, init?: RequestInit) => Promise<Response>;
  googleStatusUrl: string;
  /** Navigate to Google consent (Bearer surfaces must POST first to get a URL). */
  startGoogle: () => Promise<void>;
  /** POST → { https, webcal } */
  icsTokenUrl: string;
  subscriptionName: string;
}

function Qr({ value, size = 120 }: { value: string; size?: number }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="QR-kóði">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill="#0b1220" />
    </svg>
  );
}

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10C7.2 7.8 9.4 6 12 6z" /></svg>
);
const AppleMark = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden><path fill="#111827" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9A4.9 4.9 0 0 0 3.7 9.5c-1.8 3-.5 7.6 1.2 10.1.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8 2.2-1.2 3-2.4c.9-1.4 1.3-2.8 1.3-2.8s-2.3-.9-2.3-3.5zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" /></svg>
);

const GOOGLE_RETURN_TEXT: Record<string, string> = {
  cancelled: "Hætt var við hjá Google.",
  norefresh: "Google skilaði ekki varanlegum aðgangi. Reyndu aftur.",
  error: "Tenging mistókst. Reyndu aftur.",
  state: "Tengingin rann út á tíma. Reyndu aftur.",
  nocode: "Tenging mistókst. Reyndu aftur.",
  notfound: "Aðgangur fannst ekki.",
};

const ago = (iso: string | null) => {
  if (!iso) return "aldrei";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "rétt í þessu";
  if (s < 3600) return `fyrir ${Math.round(s / 60)} mín.`;
  return new Date(iso).toLocaleString("is-IS", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** Compact status line + button that opens the setup. */
export function CalendarStatus({ api, onOpen }: { api: CalendarApi; onOpen: () => void }) {
  const [g, setG] = useState<GoogleStatus | null>(null);
  useEffect(() => {
    let alive = true;
    api.call(api.googleStatusUrl).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive) setG(j); }).catch(() => {});
    return () => { alive = false; };
  }, [api]);
  return (
    <div>
      {g?.connected ? (
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-emerald-700">● Google tengt</span>{g.email ? ` · ${g.email}` : ""}
          {g.lastError ? <span className="block text-red-600">{g.lastError}</span> : <span className="block text-slate-400">Samstillt {ago(g.lastSyncAt)}</span>}
        </p>
      ) : (
        <p className="text-xs text-slate-500">Tímar birtast sjálfkrafa í dagatalinu þínu.</p>
      )}
      <button onClick={onOpen} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        {g?.connected ? "Stillingar dagatals" : "Tengja dagatal"}
      </button>
    </div>
  );
}

export default function CalendarConnect({ api, open, onClose, intro }: {
  api: CalendarApi;
  open: boolean;
  onClose: () => void;
  intro: string;
}) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [g, setG] = useState<GoogleStatus | null>(null);
  const [ics, setIcs] = useState<{ https: string; webcal: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Back from Google: ?google=connected|<error>
  const [googleReturn] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("google")));

  const loadStatus = useCallback(async () => {
    const r = await api.call(api.googleStatusUrl);
    if (r.ok) setG(await r.json());
  }, [api]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (googleReturn) setChoice("google");
      void loadStatus();
    }, 0);
    return () => clearTimeout(t);
  }, [open, googleReturn, loadStatus]);

  useEffect(() => {
    if (!open || !choice || choice === "google" || ics) return;
    const t = setTimeout(async () => {
      const r = await api.call(api.icsTokenUrl, { method: "POST", body: "{}" });
      if (r.ok) setIcs(await r.json());
    }, 0);
    return () => clearTimeout(t);
  }, [open, choice, ics, api]);

  if (!open) return null;

  const close = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("google"); url.searchParams.delete("cal");
    window.history.replaceState(null, "", url);
    setChoice(null); setMsg("");
    onClose();
  };
  const copy = async () => {
    if (!ics) return;
    try { await navigator.clipboard.writeText(ics.https); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* nothing */ }
  };
  const act = async (init: RequestInit, done: string) => {
    setBusy(true); setMsg("");
    const r = await api.call(api.googleStatusUrl, init);
    setBusy(false);
    setMsg(r.ok ? done : "Tókst ekki.");
    await loadStatus();
  };
  const outlookUrl = ics ? `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(ics.https)}&name=${encodeURIComponent(api.subscriptionName)}` : "";

  const tiles: { key: Choice; icon: React.ReactNode; label: string; hint: string }[] = [
    { key: "google", icon: <GoogleMark />, label: "Google", hint: "Samstillist strax" },
    { key: "apple", icon: <AppleMark />, label: "Apple / iPhone", hint: "Áskrift að dagatali" },
    { key: "outlook", icon: <Mail className="h-6 w-6 text-[#0a64c9]" />, label: "Outlook", hint: "Áskrift að dagatali" },
    { key: "other", icon: <Calendar className="h-6 w-6 text-slate-600" />, label: "Annað", hint: "Persónulegur .ics-hlekkur" },
  ];

  const linkRow = (
    <div className="mt-3 flex items-center gap-2">
      <button onClick={() => void copy()} disabled={!ics} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? "Afritað" : "Afrita hlekk"}
      </button>
      <span className="text-[11px] text-slate-500">Hlekkurinn er persónulegur. Ekki deila honum.</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cal-title" onClick={close}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Dagatal</div>
            <h2 id="cal-title" className="mt-0.5 text-xl font-bold text-slate-900">Tímarnir í dagatalið þitt</h2>
          </div>
          <button onClick={close} aria-label="Loka" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        {!choice && (
          <>
            <p className="mt-2 text-sm text-slate-600">{intro}</p>
            {g?.connected && (
              <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <b>Google er tengt</b>{g.email ? ` (${g.email})` : ""}. <button onClick={() => setChoice("google")} className="font-semibold underline">Stillingar</button>
              </div>
            )}
            <div className="mt-4 text-sm font-semibold text-slate-800">Hvaða dagatal notar þú?</div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {tiles.map((c) => (
                <button key={c.key} type="button" onClick={() => setChoice(c.key)}
                  className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/30">
                  {c.icon}
                  <span><span className="block text-sm font-bold text-slate-900">{c.label}</span><span className="block text-[11px] text-slate-500">{c.hint}</span></span>
                </button>
              ))}
            </div>
          </>
        )}

        {choice && (
          <div className="mt-3">
            <button onClick={() => { setChoice(null); setMsg(""); }} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-3.5 w-3.5" /> Til baka
            </button>

            {choice === "google" && (
              <>
                <h3 className="flex items-center gap-2 text-base font-bold"><GoogleMark /> Google-dagatal</h3>
                {g?.connected ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900">
                      <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Tengt{g.email ? ` · ${g.email}` : ""}</div>
                      <p className="mt-1 text-sm">Tímarnir fara í dagatalið „{g.calendarName}“ um leið og þeir eru bókaðir eða breytast.</p>
                      <p className="mt-1 text-xs text-emerald-800">Síðast samstillt {ago(g.lastSyncAt)}{g.enabled ? "" : " · í bið"}</p>
                    </div>
                    {g.lastError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{g.lastError}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button disabled={busy} onClick={() => act({ method: "PATCH", body: JSON.stringify({ sync: true }) }, "Samstillt.")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        <RefreshCw className="h-4 w-4" /> Samstilla núna
                      </button>
                      <button disabled={busy} onClick={() => act({ method: "PATCH", body: JSON.stringify({ enabled: !g.enabled }) }, g.enabled ? "Samstilling í bið." : "Samstilling virk.")}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                        {g.enabled ? "Gera hlé" : "Halda áfram"}
                      </button>
                      <button disabled={busy} onClick={() => { if (confirm("Aftengja Google? Dagatalinu sem við bjuggum til verður eytt.")) void act({ method: "DELETE" }, "Aftengt."); }}
                        className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600">
                        Aftengja
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-slate-600">Við búum til sérstakt dagatal í Google-reikningnum þínum og setjum tímana þar inn. Breytingar birtast strax. Við sjáum ekkert annað í dagatalinu þínu.</p>
                    {googleReturn && googleReturn !== "connected" && (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{GOOGLE_RETURN_TEXT[googleReturn] ?? "Tenging mistókst."}</p>
                    )}
                    {g && !g.configured ? (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Bein tenging við Google er væntanleg. Notaðu „Annað“ og bættu hlekknum við í Google-dagatali á meðan.</p>
                    ) : (
                      <button onClick={() => { setBusy(true); void api.startGoogle().finally(() => setBusy(false)); }} disabled={busy || !g}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto">
                        <Link2 className="h-4 w-4" /> Tengja við Google
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {choice === "apple" && (
              <>
                <h3 className="flex items-center gap-2 text-base font-bold"><AppleMark /> Apple-dagatal</h3>
                <p className="mt-1 text-sm text-slate-600">Ýttu á hnappinn á iPhone eða Mac og veldu „Gerast áskrifandi“. Tímarnir uppfærast sjálfkrafa.</p>
                {!ics ? <p className="mt-3 text-sm text-slate-500">Augnablik…</p> : (
                  <>
                    <a href={ics.webcal} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 sm:w-auto">Bæta við Apple-dagatal</a>
                    <div className="mt-4 hidden items-center gap-4 rounded-2xl bg-slate-50 p-3 sm:flex">
                      <Qr value={ics.webcal} />
                      <p className="text-xs text-slate-600">Á tölvu? Skannaðu kóðann með myndavélinni á iPhone.</p>
                    </div>
                    {linkRow}
                  </>
                )}
              </>
            )}

            {choice === "outlook" && (
              <>
                <h3 className="flex items-center gap-2 text-base font-bold"><Mail className="h-6 w-6 text-[#0a64c9]" /> Outlook</h3>
                <p className="mt-1 text-sm text-slate-600">Opnar Outlook á vefnum og bætir dagatalinu við. Það birtist líka í Outlook-appinu.</p>
                {!ics ? <p className="mt-3 text-sm text-slate-500">Augnablik…</p> : (
                  <>
                    <a href={outlookUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a64c9] px-4 py-3 text-sm font-semibold text-white hover:brightness-95 sm:w-auto">
                      <ExternalLink className="h-4 w-4" /> Bæta við Outlook
                    </a>
                    {linkRow}
                  </>
                )}
              </>
            )}

            {choice === "other" && (
              <>
                <h3 className="flex items-center gap-2 text-base font-bold"><Calendar className="h-6 w-6 text-slate-600" /> Annað dagatal</h3>
                <p className="mt-1 text-sm text-slate-600">Bættu þessum hlekk við sem áskrift („Subscribe from URL“) í dagatalinu þínu.</p>
                {!ics ? <p className="mt-3 text-sm text-slate-500">Augnablik…</p> : (
                  <>
                    <code className="mt-3 block break-all rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-700">{ics.https}</code>
                    {linkRow}
                  </>
                )}
              </>
            )}

            {msg && <p className="mt-3 text-sm text-slate-600" role="status">{msg}</p>}
            <div className="mt-5 flex justify-end">
              <button onClick={close} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                Lokið <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
