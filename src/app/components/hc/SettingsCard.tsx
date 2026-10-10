"use client";

// Sign-in with a PIN on this device, and the calendar feed / Google calendar
// for the participant's appointments. Shown on the journey page and on
// "Aðgangur" (/account/heilsuferd/adgangur).

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PinPad from "./PinPad";
import CalendarConnect, { CalendarStatus, type CalendarApi } from "./CalendarConnect";

async function api(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), /* FormData must set its own Content-Type: the boundary is part of
           it, and naming the type without one leaves the body
           unparseable. Avatar upload failed silently on exactly this. */
        ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData)
          ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) } });
}

// Customer calendar: Google push sync (instant) or .ics subscription.
const CUSTOMER_CALENDAR: CalendarApi = {
  call: api,
  googleStatusUrl: "/api/hc/google",
  startGoogle: async () => {
    const r = await api("/api/hc/google/start", { method: "POST", body: "{}" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.url) window.location.href = j.url;
    else alert(j.error || "Tókst ekki að tengja við Google.");
  },
  icsTokenUrl: "/api/hc/calendar-token",
  subscriptionName: "Lifeline heilsuferð",
};

export default function SettingsCard() {
  const [pinStep, setPinStep] = useState<"idle" | "first" | "confirm" | "done">("idle");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [pinEnabled, setPinEnabled] = useState<boolean | null>(null);
  // Opens by itself when coming back from Google (?google=…) or a ?cal=1 link.
  const [calOpen, setCalOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.has("google") || q.get("cal") === "1";
  });
  const [calKey, setCalKey] = useState(0);

  useEffect(() => {
    fetch("/api/account/pin").then((r) => r.json()).then((j) => setPinEnabled(!!j.enabled)).catch(() => setPinEnabled(false));
  }, []);

  const onPin = async (v: string) => {
    if (pinStep === "first") { setFirst(v); setPin(""); setPinStep("confirm"); return; }
    if (v !== first) { setPinErr("PIN-númerin stemma ekki. Reyndu aftur."); setPin(""); setFirst(""); setPinStep("first"); return; }
    const r = await api("/api/account/pin", { method: "POST", body: JSON.stringify({ pin: v }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setPinErr(j.error || "Tókst ekki."); setPin(""); setFirst(""); setPinStep("first"); return; }
    setPinStep("done"); setPinEnabled(true); setPin("");
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="font-semibold text-[#0F172A]">Stillingar</p>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-sm font-medium text-slate-800">Innskráning með PIN</p>
        <p className="text-xs text-slate-500">Fjögurra stafa PIN á þessu tæki í stað lykilorðs.</p>
        {pinStep === "idle" && (
          <button onClick={() => { setPinStep("first"); setPinErr(""); }} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">
            {pinEnabled ? "Breyta PIN" : "Setja upp PIN"}
          </button>
        )}
        {(pinStep === "first" || pinStep === "confirm") && (
          <div className="mt-3">
            <p className="mb-3 text-center text-sm text-slate-700">{pinStep === "first" ? "Veldu PIN" : "Sláðu PIN inn aftur"}</p>
            <PinPad value={pin} onChange={setPin} onComplete={onPin} error={!!pinErr} />
            {pinErr && <p className="mt-2 text-center text-xs text-red-600">{pinErr}</p>}
            <button onClick={() => { setPinStep("idle"); setPin(""); }} className="mt-3 block w-full text-center text-xs text-slate-500">Hætta við</button>
          </div>
        )}
        {pinStep === "done" && <p className="mt-2 text-xs text-emerald-700">PIN er virkt á þessu tæki.</p>}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-sm font-medium text-slate-800">Dagatal</p>
        <p className="text-xs text-slate-500">Blóðprufa, mælingar og viðtöl.</p>
        <div className="mt-1"><CalendarStatus key={calKey} api={CUSTOMER_CALENDAR} onOpen={() => setCalOpen(true)} /></div>
        <CalendarConnect
          api={CUSTOMER_CALENDAR}
          open={calOpen}
          onClose={() => { setCalOpen(false); setCalKey((k) => k + 1); }}
          intro="Blóðprufa, mælingar og viðtöl birtast í dagatalinu þínu með áminningu og uppfærast sjálfkrafa ef tími breytist."
        />
      </div>
    </div>
  );
}
