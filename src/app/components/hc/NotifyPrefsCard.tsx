"use client";

// "Tilkynningar frá Lifeline" — how the participant hears from staff:
// messages from the nurse/coach and requests such as leave to put the
// report in. Separate from the daily reminders (NudgeSettings), which are
// opt-in. The in-app notifications and red dots always show; these switches
// are the channels outside the app.

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, Mail, MessageSquare } from "lucide-react";
import { hcBtn } from "./ui";
import { useToast } from "./Toast";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
interface Prefs { push: boolean; sms: boolean; email: boolean }

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Register this device for push. Returns an Icelandic reason on failure. */
async function enableDevicePush(api: Api): Promise<string | null> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "Tilkynningar eru ekki uppsettar á þjóninum.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return /iP(hone|ad|od)/.test(navigator.userAgent)
      ? "Á iPhone þarf Lifeline að vera á heimaskjánum til að fá tilkynningar."
      : "Þessi vafri styður ekki tilkynningar.";
  }
  if (Notification.permission === "denied") return "Tilkynningar eru bannaðar fyrir þessa síðu í vafranum. Leyfðu þær í stillingum vafrans og prófaðu aftur.";
  const perm = await Notification.requestPermission().catch(() => "denied" as NotificationPermission);
  if (perm !== "granted") return "Tilkynningar eru ekki leyfðar á þessu tæki.";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const r = await api("/api/hc/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) });
    return r.ok ? null : "Tókst ekki að skrá tækið.";
  } catch (e) {
    return /incognito|private/i.test(String((e as Error)?.message ?? e))
      ? "Tilkynningar virka ekki í huliðsglugga."
      : "Tækið náðist ekki að skrá.";
  }
}

export default function NotifyPrefsCard({ api }: { api: Api }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [devices, setDevices] = useState(0);
  const [hasPhone, setHasPhone] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const r = await api("/api/hc/notify-prefs").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      if (!j) { setFailed(true); return; }
      setPrefs(j.prefs); setDevices(j.devices ?? 0); setHasPhone(!!j.has_phone); setFailed(false);
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const save = async (k: keyof Prefs) => {
    if (!prefs || busy) return;
    const next = { ...prefs, [k]: !prefs[k] };
    setBusy(k); setPrefs(next);
    const r = await api("/api/hc/notify-prefs", { method: "POST", body: JSON.stringify({ [k]: next[k] }) }).catch(() => null);
    setBusy(null);
    if (!r?.ok) { setPrefs(prefs); toast.show("Vistaðist ekki. Reyndu aftur.", { tone: "bad" }); return; }
    toast.show(next[k] ? "Kveikt" : "Slökkt", { tone: "ok" });
    if (k === "push" && next.push && devices === 0) void enable();
  };

  const enable = async () => {
    if (busy) return;
    setBusy("device");
    const err = await enableDevicePush(api);
    setBusy(null);
    if (err) { toast.show(err, { tone: "bad" }); return; }
    toast.show("Tilkynningar virka á þessu tæki", { tone: "ok" });
    void load();
  };

  if (failed) {
    return (
      <p role="alert" className="text-sm font-semibold text-hc-bad-ink">
        Ekki tókst að sækja stillingarnar. <button type="button" onClick={() => { setFailed(false); void load(); }} className="underline">Reyna aftur</button>
      </p>
    );
  }
  if (!prefs) return <div className="h-24 rounded-hc-element hc-shimmer" aria-busy="true" aria-label="Hleð" />;

  const row = (k: keyof Prefs, Icon: typeof Bell, title: string, hint: string) => (
    <li key={k} className="flex min-h-11 items-center gap-3 py-2">
      <Icon className="h-5 w-5 shrink-0 text-hc-ink-2" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-hc-ink">{title}</span>
        <span className="block text-xs text-hc-ink-2">{hint}</span>
      </span>
      <button type="button" role="switch" aria-checked={prefs[k]} aria-label={title} disabled={busy !== null}
        onClick={() => void save(k)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${prefs[k] ? "bg-hc-brand-dark" : "bg-hc-border"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${prefs[k] ? "left-6" : "left-1"}`} />
        {busy === k && <Loader2 className="absolute -right-6 top-1.5 h-4 w-4 animate-spin text-hc-ink-3" aria-hidden />}
      </button>
    </li>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-hc-ink-2">
        Hér velur þú hvernig við látum þig vita af skilaboðum og beiðnum frá hjúkrunarfræðingi eða þjálfara. Tilkynningar í appinu birtast alltaf.
      </p>
      <ul className="divide-y divide-hc-hairline">
        {row("push", Bell, "Ýtitilkynningar", devices ? `Virkar á ${devices} ${devices === 1 ? "tæki" : "tækjum"}` : "Ekki virkt á neinu tæki enn")}
        {row("sms", MessageSquare, "SMS", hasPhone ? "Í símanúmerið sem er skráð á þig" : "Ekkert símanúmer skráð — bættu því við hér að ofan")}
        {row("email", Mail, "Tölvupóstur", "Í netfangið sem þú skráir þig inn með")}
      </ul>
      {prefs.push && (
        <button type="button" disabled={busy !== null} onClick={() => void enable()} className={hcBtn.secondary}>
          {busy === "device" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {devices ? "Virkja líka á þessu tæki" : "Virkja ýtitilkynningar á þessu tæki"}
        </button>
      )}
    </div>
  );
}
