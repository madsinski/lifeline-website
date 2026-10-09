"use client";

// The accountability partner, on Í dag — one line, not a card.
//
// The full control lives on Aðgangur, where choosing and removing belongs.
// What belongs on the daily page is only the thing that does the work:
// whether the other person showed up this fortnight, beside whether you did.
// That is the whole mechanism — somebody you chose is looking.
//
// It stays one line on purpose. Í dag is a checklist people open to tick
// things off; a social feature that takes a third of the screen there
// competes with the actions rather than supporting them.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Data {
  partner: { name: string; days: number | null; of: number } | null;
  me: { days: number; of: number };
}

function Dots({ days, of, tone }: { days: number; of: number; tone: string }) {
  return (
    <span className="flex gap-[3px]" aria-label={`${days} af ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full"
          style={{ background: i < days ? tone : "#e2e8f0" }} />
      ))}
    </span>
  );
}

export default function PartnerStrip({ api }: { api: Api }) {
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/hc/partner");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setD(j), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  // No partner chosen: one quiet line offering it, not a sales pitch.
  if (!d) return null;
  if (!d.partner) {
    return (
      <Link href="/account/heilsuferd/adgangur"
        className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-slate-100 transition hover:ring-slate-200">
        <Handshake className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="text-hc-ink-2">Veldu ábyrgðarfélaga — einhvern sem sér hvort þú mætir.</span>
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-100">
      <span className="flex items-center gap-2">
        <Handshake className="h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ábyrgðarfélagi</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-sm font-semibold text-hc-ink">{d.partner.name}</span>
        {d.partner.days !== null && <Dots days={d.partner.days} of={d.partner.of} tone="#64748b" />}
      </span>
      <span className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Þú</span>
        <Dots days={d.me.days} of={d.me.of} tone="#10B981" />
      </span>
    </div>
  );
}
