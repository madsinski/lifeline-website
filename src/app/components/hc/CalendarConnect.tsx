"use client";

import { createPortal } from "react-dom";

// Calendar setup — same flow as the Fjarlækningar HSU min-síða
// (CalendarSetup): pick Google / Apple / Outlook / other. Google is a direct
// push sync (appointments land within seconds of any change); the others
// subscribe to a personal .ics link. Used by the customer's heilsuferð and by
// the nurse workstation — the caller supplies how to talk to its own API.

import { useCallback, useEffect, useState } from "react";
import { Alert, ConfirmDialog, Modal } from "@/app/components/account/ui";
import { ArrowLeft, Calendar, Check, CheckCircle2, Copy, ExternalLink, Link2, Mail, RefreshCw } from "lucide-react";
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
  <svg viewBox="0 0 24 24" className="h-6 w-6 text-hc-ink" aria-hidden><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9A4.9 4.9 0 0 0 3.7 9.5c-1.8 3-.5 7.6 1.2 10.1.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8 2.2-1.2 3-2.4c.9-1.4 1.3-2.8 1.3-2.8s-2.3-.9-2.3-3.5zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" /></svg>
);

/** Every ?google= code the OAuth callback (api/google/callback) and the
 *  start routes send back, in Icelandic. Unknown codes fall back to "error". */
export const GOOGLE_RETURN_TEXT: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connected: { tone: "ok", text: "Google-dagatalið er tengt. Tímarnir þínir birtast þar innan skamms." },
  cancelled: { tone: "warn", text: "Hætt var við tenginguna hjá Google. Ekkert var tengt." },
  norefresh: { tone: "warn", text: "Google veitti ekki varanlegan aðgang. Fjarlægðu Lifeline úr aðgangsstillingum Google-reikningsins og reyndu aftur." },
  error: { tone: "warn", text: "Tenging við Google mistókst. Reyndu aftur eftir smástund." },
  state: { tone: "warn", text: "Tengingin rann út á tíma. Reyndu aftur." },
  nocode: { tone: "warn", text: "Google skilaði ekki staðfestingu. Reyndu aftur." },
  notfound: { tone: "warn", text: "Aðgangurinn fannst ekki eða er óvirkur. Skráðu þig inn aftur og reyndu svo aftur." },
  unavailable: { tone: "warn", text: "Bein tenging við Google er ekki komin í gagnið enn. Notaðu „Annað“ og bættu hlekknum við í Google-dagatali á meðan." },
};
export const googleReturnText = (code: string) => GOOGLE_RETURN_TEXT[code] ?? GOOGLE_RETURN_TEXT.error;

const ago = (iso: string | null) => {
  if (!iso) return "aldrei";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "rétt í þessu";
  if (s < 3600) return `fyrir ${Math.round(s / 60)} mín.`;
  // Written out: a browser without Icelandic locale data falls back to English.
  const MONTHS = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} kl. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
        <p className="text-xs text-hc-ink-2">
          <span className="font-semibold text-hc-ok-ink">● Google tengt</span>{g.email ? ` · ${g.email}` : ""}
          {g.lastError ? <span className="block text-hc-bad-ink">{g.lastError}</span> : <span className="block text-hc-ink-3">Samstillt {ago(g.lastSyncAt)}</span>}
        </p>
      ) : (
        <p className="text-xs text-hc-ink-2">Tímar birtast sjálfkrafa í dagatalinu þínu.</p>
      )}
      <button type="button" onClick={onOpen} className="mt-2 rounded-lg border border-hc-control px-3 py-1.5 text-xs font-semibold text-hc-ink-2 hover:bg-hc-sunken">
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
  // Scroll lock, Escape, focus trap and focus return come from Modal, which
  // is only mounted while open (the old useScrollLock() here once locked on
  // mount and froze every page that merely rendered this).
  const [choice, setChoice] = useState<Choice | null>(null);
  const [g, setG] = useState<GoogleStatus | null>(null);
  const [ics, setIcs] = useState<{ https: string; webcal: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  /* Failures are said inline, in red: this dialog also opens on the
     workstation, which has no toast mounted. */
  const [msgBad, setMsgBad] = useState(false);
  const [statusFailed, setStatusFailed] = useState(false);
  const [icsFailed, setIcsFailed] = useState(false);
  const [icsAttempt, setIcsAttempt] = useState(0);
  const [askDisconnect, setAskDisconnect] = useState(false);
  // Back from Google: ?google=connected|<error>
  const [googleReturn, setGoogleReturn] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("google")));

  const loadStatus = useCallback(async () => {
    const r = await api.call(api.googleStatusUrl).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    // The Google button waits on this; when it never came the button stayed
    // greyed out with no word as to why.
    if (j) { setG(j); setStatusFailed(false); } else setStatusFailed(true);
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
      const r = await api.call(api.icsTokenUrl, { method: "POST", body: "{}" }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      // Was "Augnablik…" for good when this failed.
      if (j?.https) { setIcs(j); setIcsFailed(false); } else setIcsFailed(true);
    }, 0);
    return () => clearTimeout(t);
  }, [open, choice, ics, api, icsAttempt]);

  if (!open) return null;

  const close = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("google"); url.searchParams.delete("cal");
    window.history.replaceState(null, "", url);
    setChoice(null); setMsg(""); setMsgBad(false); setGoogleReturn(null);
    onClose();
  };
  const copy = async () => {
    if (!ics) return;
    try { await navigator.clipboard.writeText(ics.https); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setMsgBad(true); setMsg("Ekki tókst að afrita. Veldu hlekkinn og afritaðu hann."); }
  };
  const act = async (init: RequestInit, done: string) => {
    if (busy) return;
    setBusy(true); setMsg("");
    const r = await api.call(api.googleStatusUrl, init).catch(() => null);
    setBusy(false);
    setMsgBad(!r?.ok);
    setMsg(r?.ok ? done : "Tókst ekki. Reyndu aftur.");
    await loadStatus();
  };
  const icsWait = icsFailed ? (
    <p className="mt-3 text-sm text-hc-bad-ink" role="alert">
      Ekki tókst að sækja dagatalshlekkinn.{" "}
      <button type="button" onClick={() => { setIcsFailed(false); setIcsAttempt((n) => n + 1); }} className="font-semibold underline">Reyna aftur</button>
    </p>
  ) : <p className="mt-3 text-sm text-hc-ink-2">Augnablik…</p>;
  const outlookUrl = ics ? `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(ics.https)}&name=${encodeURIComponent(api.subscriptionName)}` : "";

  const tiles: { key: Choice; icon: React.ReactNode; label: string; hint: string }[] = [
    { key: "google", icon: <GoogleMark />, label: "Google", hint: "Samstillist strax" },
    { key: "apple", icon: <AppleMark />, label: "Apple / iPhone", hint: "Áskrift að dagatali" },
    { key: "outlook", icon: <Mail className="h-6 w-6 text-[#0a64c9]" />, label: "Outlook", hint: "Áskrift að dagatali" },
    { key: "other", icon: <Calendar className="h-6 w-6 text-hc-ink-2" />, label: "Annað", hint: "Persónulegur .ics-hlekkur" },
  ];

  const linkRow = (
    <div className="mt-3 flex items-center gap-2">
      <button type="button" onClick={() => void copy()} disabled={!ics} className="inline-flex items-center gap-1.5 rounded-xl border border-hc-control bg-hc-surface px-3 py-2 text-sm font-semibold text-hc-ink-2 hover:bg-hc-sunken disabled:opacity-50">
        {copied ? <Check className="h-4 w-4 text-hc-brand-text" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Afritað" : "Afrita hlekk"}
      </button>
      <span className="text-xs text-hc-ink-2">Hlekkurinn er persónulegur. Ekki deila honum.</span>
    </div>
  );

  /*
   * Out to the body.
   *
   * This was a plain fixed overlay, and a fixed element inside a
   * transformed or filtered ancestor is positioned against that ancestor
   * rather than the viewport. Sheet animates itself with
   * transform: translateY(), so opening this from inside a sheet — which
   * is exactly what the onboarding walkthrough does — measured the
   * dialog against the sheet panel and clipped its top off screen.
   *
   * A portal to the body has no ancestor to be trapped by. Same fix as
   * Sheet's own, for the same reason.
   */
  const host = typeof document === "undefined" ? null : document.body;
  if (!host) return null;

  const returned = googleReturn ? googleReturnText(googleReturn) : null;

  return createPortal(
    <Modal onClose={close} closeLabel="Loka"
      title={<><span className="block text-[11px] font-semibold uppercase tracking-wider text-hc-brand-text">Dagatal</span>Tímarnir í dagatalið þitt</>}>
      <div>
        {!choice && (
          <>
            <p className="text-sm text-hc-ink-2">{intro}</p>
            {g?.connected && (
              <div className="mt-3 rounded-2xl bg-hc-ok-surface px-4 py-3 text-sm text-hc-ok-ink">
                <b>Google er tengt</b>{g.email ? ` (${g.email})` : ""}. <button type="button" onClick={() => setChoice("google")} className="font-semibold underline">Stillingar</button>
              </div>
            )}
            <div className="mt-4 text-sm font-semibold text-hc-ink-2">Hvaða dagatal notar þú?</div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {tiles.map((c) => (
                <button key={c.key} type="button" onClick={() => setChoice(c.key)}
                  className="flex flex-col items-start gap-2 rounded-2xl border border-hc-hairline bg-hc-surface p-3.5 text-left transition hover:border-hc-brand hover:bg-hc-brand-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand-dark">
                  {c.icon}
                  <span><span className="block text-sm font-bold text-hc-ink">{c.label}</span><span className="block text-xs text-hc-ink-2">{c.hint}</span></span>
                </button>
              ))}
            </div>
          </>
        )}

        {choice && (
          <div>
            <button type="button" onClick={() => { setChoice(null); setMsg(""); setMsgBad(false); }} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-hc-ink-2 hover:text-hc-ink">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Til baka
            </button>

            {choice === "google" && (
              <>
                <h3 className="flex items-center gap-2 text-base font-bold"><GoogleMark /> Google-dagatal</h3>
                {returned && <Alert tone={returned.tone} compact className="mt-3">{returned.text}</Alert>}
                {g?.connected ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl bg-hc-ok-surface p-4 text-hc-ok-ink">
                      <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" aria-hidden /> Tengt{g.email ? ` · ${g.email}` : ""}</div>
                      <p className="mt-1 text-sm">Tímarnir fara í dagatalið „{g.calendarName}“ um leið og þeir eru bókaðir eða breytast.</p>
                      <p className="mt-1 text-xs text-hc-ok-ink">Síðast samstillt {ago(g.lastSyncAt)}{g.enabled ? "" : " · í bið"}</p>
                    </div>
                    {g.lastError && <p className="rounded-xl bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{g.lastError}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => act({ method: "PATCH", body: JSON.stringify({ sync: true }) }, "Samstillt.")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-hc-brand-dark px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                        <RefreshCw className="h-4 w-4" aria-hidden /> Samstilla núna
                      </button>
                      <button type="button" disabled={busy} onClick={() => act({ method: "PATCH", body: JSON.stringify({ enabled: !g.enabled }) }, g.enabled ? "Samstilling í bið." : "Samstilling virk.")}
                        className="rounded-xl border border-hc-control px-3 py-2 text-sm font-semibold text-hc-ink-2">
                        {g.enabled ? "Gera hlé" : "Halda áfram"}
                      </button>
                      <button type="button" disabled={busy} onClick={() => setAskDisconnect(true)}
                        className="rounded-xl px-3 py-2 text-sm font-semibold text-hc-bad-ink hover:bg-hc-bad-surface">
                        Aftengja
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-hc-ink-2">Við búum til sérstakt dagatal í Google-reikningnum þínum og setjum tímana þar inn. Breytingar birtast strax. Við sjáum ekkert annað í dagatalinu þínu.</p>
                    {statusFailed && !g && (
                      <p className="mt-3 text-sm text-hc-bad-ink" role="alert">
                        Ekki tókst að sækja stöðuna hjá Google.{" "}
                        <button type="button" onClick={() => void loadStatus()} className="font-semibold underline">Reyna aftur</button>
                      </p>
                    )}
                    {g && !g.configured ? (
                      <p className="mt-3 rounded-xl bg-hc-warn-surface px-3 py-2 text-sm text-hc-warn-ink">Bein tenging við Google er væntanleg. Notaðu „Annað“ og bættu hlekknum við í Google-dagatali á meðan.</p>
                    ) : (
                      <button type="button" onClick={() => { setBusy(true); void api.startGoogle().finally(() => setBusy(false)); }} disabled={busy || !g}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-hc-brand-dark px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 sm:w-auto">
                        <Link2 className="h-4 w-4" aria-hidden /> {returned && returned.tone !== "ok" ? "Reyna aftur" : "Tengja við Google"}
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {choice === "apple" && (
              <>
                <h3 className="flex items-center gap-2 text-base font-bold"><AppleMark /> Apple-dagatal</h3>
                <p className="mt-1 text-sm text-hc-ink-2">Ýttu á hnappinn á iPhone eða Mac og veldu „Gerast áskrifandi“. Tímarnir uppfærast sjálfkrafa.</p>
                {!ics ? icsWait : (
                  <>
                    <a href={ics.webcal} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-hc-brand-dark px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 sm:w-auto">Bæta við Apple-dagatal</a>
                    <div className="mt-4 hidden items-center gap-4 rounded-2xl bg-hc-sunken p-3 sm:flex">
                      <Qr value={ics.webcal} />
                      <p className="text-xs text-hc-ink-2">Á tölvu? Skannaðu kóðann með myndavélinni á iPhone.</p>
                    </div>
                    {linkRow}
                  </>
                )}
              </>
            )}

            {choice === "outlook" && (
              <>
                <h3 className="flex items-center gap-2 text-base font-bold"><Mail className="h-6 w-6 text-[#0a64c9]" /> Outlook</h3>
                <p className="mt-1 text-sm text-hc-ink-2">Opnar Outlook á vefnum og bætir dagatalinu við. Það birtist líka í Outlook-appinu.</p>
                {!ics ? icsWait : (
                  <>
                    <a href={outlookUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a64c9] px-4 py-3 text-sm font-semibold text-white hover:brightness-95 sm:w-auto">
                      <ExternalLink className="h-4 w-4" aria-hidden /> Bæta við Outlook
                    </a>
                    {linkRow}
                  </>
                )}
              </>
            )}

            {choice === "other" && (
              <>
                <h3 className="flex items-center gap-2 text-base font-bold"><Calendar className="h-6 w-6 text-hc-ink-2" /> Annað dagatal</h3>
                <p className="mt-1 text-sm text-hc-ink-2">Bættu þessari slóð við sem áskrift í dagatalinu þínu — valkosturinn heitir „Gerast áskrifandi að dagatali“ og „Subscribe from URL“ í enskum viðmótum.</p>
                {!ics ? icsWait : (
                  <>
                    <code className="mt-3 block break-all rounded-xl bg-hc-sunken px-3 py-2 text-[11px] text-hc-ink-2">{ics.https}</code>
                    {linkRow}
                  </>
                )}
              </>
            )}

            {msg && <p className={`mt-3 text-sm ${msgBad ? "text-hc-bad-ink" : "text-hc-ok-ink"}`} role={msgBad ? "alert" : "status"}>{msg}</p>}
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={close} className="inline-flex items-center gap-1.5 rounded-xl bg-hc-brand-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
                Lokið <Check className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </div>
      {askDisconnect && (
        <ConfirmDialog title="Aftengja Google?" tone="danger" confirmLabel="Aftengja"
          body="Dagatalinu sem Lifeline bjó til í Google-reikningnum þínum verður eytt. Þú getur tengt aftur hvenær sem er."
          onResult={(ok) => { setAskDisconnect(false); if (ok) void act({ method: "DELETE" }, "Aftengt."); }} />
      )}
    </Modal>,
    host,
  );
}
