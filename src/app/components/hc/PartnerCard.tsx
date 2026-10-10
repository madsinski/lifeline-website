"use client";

// Ábyrgðarfélagi — one person who sees whether you are showing up.
//
// Not a leaderboard. Ranking somebody against strangers works against the
// autonomy that predicts whether they keep going; one named person they
// chose, and can un-choose, is the same social pull without that cost.
//
// What is shared is deliberately thin: days active out of the last fourteen,
// and nothing else. No action names, no pillars, no report, no measurements.
// The card says so in plain words, because a person deciding whether to let
// someone see their progress should not have to guess what "progress" means.

import { useCallback, useEffect, useState } from "react";
import { useScrollLock } from "@/lib/hc/use-scroll-lock";
import { Handshake, X } from "lucide-react";
import { hcBtn, hcCard, hcKicker } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Data {
  partner: { id: string | null; name: string; days: number | null; of: number } | null;
  me: { days: number; of: number };
  candidates: { id: string; name: string }[];
  watchedBy: string[];
}

/** Fourteen dots, one per day — a fortnight reads at a glance. */
function Fortnight({ days, of, tone }: { days: number; of: number; tone: "me" | "them" }) {
  return (
    <span className="flex gap-1" aria-label={`${days} af ${of} dögum`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full"
          style={{
            background: i < days ? (tone === "me" ? "var(--hc-brand, #10B981)" : "#64748b") : "#e2e8f0",
          }} />
      ))}
    </span>
  );
}

export default function PartnerCard({ api }: { api: Api }) {
  const [d, setD] = useState<Data | null>(null);
  const [picking, setPicking] = useState(false);
  // Inline rather than its own component, so the lock is conditional.
  useScrollLock(picking);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/hc/partner");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setD(j), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const choose = async (partnerId: string | null) => {
    setBusy(true); setErr(null);
    const r = await api("/api/hc/partner", { method: "POST", body: JSON.stringify({ partnerId }) });
    if (r.ok) { setPicking(false); await load(); }
    else setErr("Tókst ekki að vista. Reyndu aftur.");
    setBusy(false);
  };

  if (!d) return <div className={`${hcCard.base} h-32 animate-pulse`} aria-hidden />;

  const none = d.candidates.length === 0;

  return (
    <section className={`${hcCard.base} p-5`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50">
          <Handshake className="h-5 w-5 text-hc-brand-dark" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${hcKicker} text-slate-500`}>Ábyrgðarfélagi</p>

          {d.partner ? (
            <>
              <p className="text-lg font-semibold text-hc-ink">{d.partner.name}</p>
              {d.partner.days !== null && (
                <div className="mt-1 flex items-center gap-2">
                  <Fortnight days={d.partner.days} of={d.partner.of} tone="them" />
                  <span className="text-sm text-hc-ink-2">
                    {d.partner.days} af {d.partner.of} dögum
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="mt-0.5 text-sm text-hc-ink-2">
              {none
                ? "Þú þarft að eiga vin í Lifeline til að velja ábyrgðarfélaga."
                : "Veldu einn úr vinahópnum. Þið sjáið hvort annað mæta — ekkert annað."}
            </p>
          )}

          {/* Your own fortnight, so the card is a mirror and not only a window. */}
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-500">Þú</span>
            <Fortnight days={d.me.days} of={d.me.of} tone="me" />
            <span className="text-sm text-hc-ink-2">{d.me.days} af {d.me.of} dögum</span>
          </div>

          {d.watchedBy.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {d.watchedBy.join(", ")} {d.watchedBy.length === 1 ? "fylgist" : "fylgjast"} með þér.
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            Félaginn sér hvaða daga þú gerðir eitthvað. Hann sér hvorki skýrsluna þína,
            mælingar né hvaða aðgerðir þú valdir.
          </p>

          {err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{err}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {!none && (
              <button type="button" className={hcBtn.secondary} onClick={() => setPicking(true)} disabled={busy}>
                {d.partner ? "Skipta um félaga" : "Velja ábyrgðarfélaga"}
              </button>
            )}
            {d.partner && (
              <button type="button" className={hcBtn.ghost} onClick={() => void choose(null)} disabled={busy}>
                Fjarlægja
              </button>
            )}
          </div>
        </div>
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog" aria-modal="true" aria-label="Velja ábyrgðarfélaga"
          onClick={() => !busy && setPicking(false)}>
          <div className={`${hcCard.base} w-full max-w-sm p-5`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-hc-ink">Velja ábyrgðarfélaga</p>
              <button type="button" onClick={() => setPicking(false)} aria-label="Loka">
                <X className="h-4 w-4 text-slate-400" aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-sm text-hc-ink-2">
              Félaginn sér hvaða daga þú gerðir eitthvað. Þú getur skipt eða fjarlægt hvenær sem er.
            </p>
            <div className="mt-3 space-y-1.5">
              {d.candidates.map((c) => (
                <button key={c.id} type="button" disabled={busy} onClick={() => void choose(c.id)}
                  className="flex w-full items-center justify-between rounded-hc-element border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold text-hc-ink transition hover:bg-slate-50 disabled:opacity-50">
                  {c.name}
                  {d.partner?.id === c.id && <span className="text-xs font-normal text-hc-brand-dark">núverandi</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
