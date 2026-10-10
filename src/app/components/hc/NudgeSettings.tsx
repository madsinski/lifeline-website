"use client";

// Opt-in reminders for the participant ("Áminningar"): which channels (a
// notification on this device, email, SMS), what time, and how often. Nothing
// is sent until they switch something on. Sent by /api/cron/hc-nudges.

import { useEffect, useState } from "react";
import { Bell, BellOff, ChevronDown } from "lucide-react";
import { hcBtn } from "./ui";

type Channel = "push" | "email" | "sms";
type Mode = "daily" | "behind" | "weekly";
interface Prefs { channels: Channel[]; hour: number; mode: Mode; paused_until: string | null }
type Api = (url: string, init?: RequestInit) => Promise<Response>;

const HOURS = [7, 8, 12, 17, 20, 21];
const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "daily", label: "Á hverjum degi", hint: "Hvað er á dagskrá í dag" },
  { key: "behind", label: "Bara ef ég dett út", hint: "Ef ekkert hefur verið merkt í tvo daga" },
  { key: "weekly", label: "Vikulega", hint: "Samantekt vikunnar á sunnudegi" },
];

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function NudgeSettings({ api }: { api: Api }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [avail, setAvail] = useState({ push: false, email: false, sms: false });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [dates] = useState(() => ({
    today: new Date().toISOString().slice(0, 10),
    inWeek: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
  }));
  const [env] = useState(() => {
    if (typeof window === "undefined") return { pushable: false, ios: false, standalone: false };
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    return { pushable: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window, ios, standalone: !!standalone };
  });

  useEffect(() => {
    (async () => {
      const r = await api("/api/hc/nudges");
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setPrefs(j.prefs); setAvail(j.available); }
    })();
  }, [api]);

  const save = async (next: Prefs) => {
    const prev = prefs;
    setPrefs(next); setBusy(true); setMsg("");
    const r = await api("/api/hc/nudges", { method: "POST", body: JSON.stringify(next) });
    setBusy(false);
    if (!r.ok) { setPrefs(prev); setMsg("Tókst ekki að vista."); return false; }
    return true;
  };

  /** Ask this device for permission and register it. */
  const enablePush = async (): Promise<boolean> => {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key || !env.pushable) { setMsg("Þessi vafri styður ekki tilkynningar."); return false; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setMsg("Tilkynningar eru ekki leyfðar. Þú getur leyft þær í stillingum vafrans."); return false; }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const r = await api("/api/hc/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) });
    if (!r.ok) { setMsg("Tókst ekki að skrá tækið."); return false; }
    return true;
  };

  const toggle = async (c: Channel) => {
    if (!prefs) return;
    const on = prefs.channels.includes(c);
    if (!on && c === "push") {
      setBusy(true);
      const ok = await enablePush().catch(() => false);
      setBusy(false);
      if (!ok) return;
    }
    const channels = on ? prefs.channels.filter((x) => x !== c) : [...prefs.channels, c];
    if (await save({ ...prefs, channels })) setMsg(on ? "Slökkt." : c === "push" ? "Tilkynningar virka á þessu tæki." : "Kveikt.");
  };

  if (!prefs) return null;
  const active = prefs.channels.length > 0;
  const paused = !!prefs.paused_until && prefs.paused_until >= dates.today;
  const inWeek = dates.inWeek;

  return (
    <section className="rounded-hc-card bg-hc-surface shadow-hc-card ring-1 ring-slate-200 print:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active && !paused ? "bg-hc-brand-surface text-hc-brand-dark" : "bg-slate-100 text-slate-500"}`}>
          {active && !paused ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-hc-ink">Áminningar</span>
          <span className="block truncate text-sm text-hc-ink-2">
            {!active ? "Slökkt — kveiktu ef þú vilt smá áminningu" : paused ? `Í hléi til ${prefs.paused_until}` : `${MODES.find((m) => m.key === prefs.mode)?.label} kl. ${String(prefs.hour).padStart(2, "0")}:00`}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4">
          <div>
            <p className="text-sm font-semibold text-hc-ink">Hvernig?</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {([
                ["push", "Tilkynning í símanum", avail.push && env.pushable],
                ["email", "Tölvupóstur", avail.email],
                ["sms", "SMS", avail.sms],
              ] as const).map(([c, label, can]) => {
                const on = prefs.channels.includes(c);
                return (
                  <button key={c} type="button" disabled={busy || (!can && !on)} onClick={() => void toggle(c)} aria-pressed={on}
                    className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${on ? "bg-hc-brand text-white" : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-hc-brand-surface"} disabled:cursor-not-allowed disabled:opacity-50`}>
                    {label}
                    <span className={`block text-xs font-normal ${on ? "text-white/85" : "text-slate-500"}`}>
                      {on ? "Kveikt" : !can ? (c === "sms" ? "Ekki í boði enn" : c === "push" ? "Ekki stutt í þessum vafra" : "Ekki í boði") : "Slökkt"}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Push is no longer only the reminder, so the section cannot
                go on implying that it is. The event ones ignore the hour
                and the mode below, which is worth saying before somebody
                sets a time and wonders why a message arrived at another. */}
            {prefs.channels.includes("push") && (
              <p className="mt-2 text-xs text-slate-500">
                Tilkynningar í símann koma líka þegar þjálfarinn sendir þér skilaboð og þegar félagi ýtir við þér — um leið og það gerist, óháð tímanum hér fyrir neðan.
              </p>
            )}
            {env.ios && !env.standalone && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Á iPhone koma tilkynningar aðeins þegar Lifeline er á heimaskjánum: ýttu á Deila og svo „Bæta á heimaskjá“, opnaðu þaðan og kveiktu hér.
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-hc-ink">Hversu oft?</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => (
                <button key={m.key} type="button" disabled={busy} onClick={() => void save({ ...prefs, mode: m.key })} aria-pressed={prefs.mode === m.key}
                  className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${prefs.mode === m.key ? "bg-hc-ink text-white" : "bg-slate-50 text-slate-700 ring-1 ring-slate-200"}`}>
                  {m.label}
                  <span className={`block text-xs font-normal ${prefs.mode === m.key ? "text-white/80" : "text-slate-500"}`}>{m.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-hc-ink">Klukkan
              <select value={prefs.hour} disabled={busy} onChange={(e) => void save({ ...prefs, hour: Number(e.target.value) })}
                className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal">
                {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
              </select>
            </label>
            <span className="flex-1" />
            {active && (paused
              ? <button type="button" disabled={busy} onClick={() => void save({ ...prefs, paused_until: null })} className={`${hcBtn.secondary} min-h-9`}>Halda áfram</button>
              : <button type="button" disabled={busy} onClick={() => void save({ ...prefs, paused_until: inWeek })} className={`${hcBtn.ghost} min-h-9`}>Hlé í viku</button>)}
          </div>
          {msg && <p role="status" className="text-sm text-hc-ink-2">{msg}</p>}
        </div>
      )}
    </section>
  );
}
