"use client";

// Booking a consultation.
//
// Writes the date in the app's own stored format ("October 15, 2026",
// English month names) and the time as 24h, because those columns are text
// and the app reads them. What the person sees is Icelandic; what is stored
// is what both surfaces can parse.

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT, useLongDate } from "./../useT";
import { appBrand, appCard } from "./../ui";

interface Opts {
  coaches: { id: string; name: string; role: string | null; specialty: string | null }[];
  types: { key: string; label: string; minutes: number }[];
  slots: string[];
}

/** The next 21 days, excluding days already past. */
function nextDays(n = 21) {
  const out: { iso: string; d: Date }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({ iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, d });
  }
  return out;
}

export default function Book({ onBooked }: { onBooked: () => void }) {
  const api = useApi();
  const t = useT();
  const longDate = useLongDate();
  const [o, setO] = useState<Opts | null>(null);
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [coach, setCoach] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await api("/api/app/booking");
      const j = r.ok ? await r.json().catch(() => null) : null;
      setTimeout(() => { setO(j); if (j?.coaches?.length === 1) setCoach(j.coaches[0].name); }, 0);
    })();
  }, [api]);

  const submit = async () => {
    if (!typeKey || !date || !time) { setMsg({ ok: false, text: t("bk.pickAll") }); return; }
    setBusy(true); setMsg(null);
    const r = await api("/api/app/booking", {
      method: "POST",
      body: JSON.stringify({ typeKey, date, time, coachName: coach }),
    });
    if (r.ok) {
      setMsg({ ok: true, text: t("bk.done") });
      setTypeKey(null); setDate(null); setTime(null);
      onBooked();
    } else {
      const j = await r.json().catch(() => null);
      setMsg({ ok: false, text: j?.error === "past" ? t("bk.past") : j?.error === "duplicate" ? t("bk.duplicate") : t("bk.failed") });
    }
    setBusy(false);
  };

  if (!o) return <div className="h-40 animate-pulse rounded-[14px] bg-white" aria-hidden />;

  const pill = (on: boolean) =>
    `rounded-xl border px-3 py-2 text-xs font-semibold transition ${on ? "" : "hover:bg-black/[0.02]"}`;
  const pillStyle = (on: boolean) => on
    ? { borderColor: appBrand.primary, background: `${appBrand.primary}14`, color: appBrand.primaryDark }
    : { borderColor: appBrand.hairline, color: appBrand.ink2, background: "#fff" };

  return (
    <div className="space-y-3">
      {msg && (
        <p className={`${appCard} border-l-[3px] px-4 py-3 text-sm`} role="status"
          style={{ borderLeftColor: msg.ok ? appBrand.primary : appBrand.error, color: appBrand.ink2 }}>
          {msg.text}
        </p>
      )}

      <section className={`${appCard} p-4`}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("bk.type")}</p>
        <div className="grid grid-cols-2 gap-2">
          {o.types.map((ty) => (
            <button key={ty.key} type="button" onClick={() => setTypeKey(ty.key)}
              className={`${pill(typeKey === ty.key)} text-left`} style={pillStyle(typeKey === ty.key)}>
              {ty.label}
              <span className="block font-normal" style={{ color: appBrand.ink3 }}>{ty.minutes} {t("bk.minutes")}</span>
            </button>
          ))}
        </div>
      </section>

      {o.coaches.length > 1 && (
        <section className={`${appCard} p-4`}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("bk.coach")}</p>
          <div className="flex flex-wrap gap-2">
            {o.coaches.map((c) => (
              <button key={c.id} type="button" onClick={() => setCoach(c.name)}
                className={pill(coach === c.name)} style={pillStyle(coach === c.name)}>{c.name}</button>
            ))}
          </div>
        </section>
      )}

      <section className={`${appCard} p-4`}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("bk.date")}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {nextDays().map(({ iso, d }) => (
            <button key={iso} type="button" onClick={() => setDate(iso)}
              className={`${pill(date === iso)} shrink-0 whitespace-nowrap`} style={pillStyle(date === iso)}>
              {longDate(d)}
            </button>
          ))}
        </div>
      </section>

      <section className={`${appCard} p-4`}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("bk.time")}</p>
        <div className="grid grid-cols-4 gap-2">
          {o.slots.map((s) => (
            <button key={s} type="button" onClick={() => setTime(s)}
              className={pill(time === s)} style={pillStyle(time === s)}>{s}</button>
          ))}
        </div>
      </section>

      <button type="button" onClick={() => void submit()} disabled={busy || !typeKey || !date || !time}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-bold text-white transition disabled:opacity-40"
        style={{ background: appBrand.primary }}>
        <Check className="h-4 w-4" aria-hidden />{busy ? t("bk.booking") : t("bk.confirm")}
      </button>
    </div>
  );
}
