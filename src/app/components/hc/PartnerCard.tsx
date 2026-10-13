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
import Sheet from "./Sheet";
import { Handshake } from "lucide-react";
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

export default function PartnerCard({ api, bare = false, pick = false }: {
  api: Api;
  /*
   * Drop the card's own shell.
   *
   * Inside the onboarding walkthrough this sat as a bordered, padded card
   * within a bordered, padded step — a card in a card, with the icon and
   * kicker repeating a heading the step had already given. Bare mode keeps
   * the content and lets the surrounding surface own the frame.
   */
  bare?: boolean;
  /*
   * Onboarding wants the choosing, not the scoreboard.
   *
   * The card's job on the settings page is to show how the two of you are
   * doing — your streak, theirs, who else is watching. During setup none of
   * that exists yet and showing it means a step full of zeroes about a
   * relationship that has not started. `pick` keeps the part that is a
   * decision: choose somebody, or invite them.
   */
  pick?: boolean;
}) {
  const [d, setD] = useState<Data | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

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

  if (!d) return <div className={`${bare ? "rounded-2xl" : hcCard.base} h-32 hc-shimmer`} aria-hidden />;

  const none = d.candidates.length === 0;

  /*
   * Ask somebody who is not here yet.
   *
   * The candidate list is accepted friendships only, so a new participant
   * saw an empty list and no way to fill it. The answer is deliberately the
   * same whether or not the address belongs to a member: who uses a health
   * service is information about that person, and a form that replies
   * "already a member" is a membership oracle anybody could query.
   */
  const invite = async () => {
    const v = email.trim();
    if (!v) return;
    setBusy(true); setErr(null);
    const r = await api("/api/hc/partner", { method: "POST", body: JSON.stringify({ invite_email: v }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setErr(j.error === "bad-email" ? "Þetta netfang virkar ekki."
        : j.error === "self" ? "Það er netfangið þitt."
        : "Tókst ekki að senda boðið.");
      return;
    }
    setEmail(""); setSent(true);
  };

  return (
    <section className={bare ? "" : `${hcCard.base} p-5`}>
      <div className={`flex items-start ${bare ? "" : "gap-3"}`}>
        {!bare && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hc-ok-surface">
            <Handshake className="h-5 w-5 text-hc-brand-text" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {/* The step above already says "Ábyrgðarfélagi"; saying it twice
              is how the nesting looked like a mistake. */}
          {!bare && <p className={`${hcKicker} text-hc-ink-2`}>Félagi</p>}

          {d.partner ? (
            <>
              <p className="text-lg font-semibold text-hc-ink">{d.partner.name}</p>
              {!pick && d.partner.days !== null && (
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
                ? "Bjóddu einhverjum sem þú þekkir — hann sér bara hvaða daga þú gerðir eitthvað."
                : "Veldu einn. Hann sér hvaða daga þú gerðir eitthvað — ekkert annað."}
            </p>
          )}

          {/* Your own fortnight, so the card is a mirror and not only a
              window — but not while choosing, when it is fourteen zeroes
              about a relationship that has not started. */}
          {!pick && (
            <div className="mt-3 flex items-center gap-2 border-t border-hc-hairline pt-3">
              <span className="text-xs font-semibold text-hc-ink-2">Þú</span>
              <Fortnight days={d.me.days} of={d.me.of} tone="me" />
              <span className="text-sm text-hc-ink-2">{d.me.days} af {d.me.of} dögum</span>
            </div>
          )}

          {!pick && d.watchedBy.length > 0 && (
            <p className="mt-2 text-xs text-hc-ink-2">
              {d.watchedBy.join(", ")} {d.watchedBy.length === 1 ? "fylgist" : "fylgjast"} með þér.
            </p>
          )}

          {/* Simpler, and the same promise: one number, nothing else. */}
          <p className="mt-2 text-xs text-hc-ink-2">
            Hann sér ekki skýrsluna þína, mælingar eða hvað þú valdir að gera.
          </p>

          {err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{err}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {!none && (
              <button type="button" className={hcBtn.secondary} onClick={() => setPicking(true)} disabled={busy}>
                {d.partner ? "Skipta um félaga" : "Velja félaga"}
              </button>
            )}
            {d.partner && (
              <button type="button" className={hcBtn.ghost} onClick={() => void choose(null)} disabled={busy}>
                Fjarlægja
              </button>
            )}
          </div>

          {/* Inviting by email, which is the only way the list ever fills.
              No search over members and no directory: that would disclose
              who is a Lifeline customer, which is not ours to tell. */}
          <div className="mt-3 border-t border-hc-hairline pt-3">
            {sent ? (
              <p className="text-sm text-hc-ink-2" role="status">
                Boðið er sent. Þú sérð hann í listanum þegar hann hefur samþykkt.{" "}
                <button type="button" onClick={() => setSent(false)} className="font-semibold text-hc-brand-text hover:underline">
                  Bjóða öðrum
                </button>
              </p>
            ) : (
              <>
                <label className="block text-xs font-semibold text-hc-ink-2" htmlFor="partner-email">
                  {none ? "Bjóddu einhverjum sem þú þekkir" : "Eða bjóddu einhverjum nýjum"}
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <input id="partner-email" type="email" inputMode="email" autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="nafn@netfang.is"
                    className="min-w-0 flex-1 rounded-hc-element border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-hc-brand/30" />
                  <button type="button" onClick={() => void invite()} disabled={busy || !email.trim()}
                    className={`${hcBtn.secondary} disabled:opacity-40`}>
                    Senda boð
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {picking && (
        <Sheet title="Velja félaga" onClose={() => !busy && setPicking(false)} max="max-w-sm">
          <div className="p-4 pt-0">
            <p className="text-sm text-hc-ink-2">
              Hann sér hvaða daga þú gerðir eitthvað. Þú getur skipt eða fjarlægt hvenær sem er.
            </p>
            <div className="mt-3 space-y-1.5">
              {d.candidates.map((c) => (
                <button key={c.id} type="button" disabled={busy} onClick={() => void choose(c.id)}
                  className="flex w-full items-center justify-between rounded-hc-element border border-hc-hairline px-3 py-2.5 text-left text-sm font-semibold text-hc-ink transition hover:bg-hc-sunken disabled:opacity-50">
                  {c.name}
                  {d.partner?.id === c.id && <span className="text-xs font-normal text-hc-brand-text">núverandi</span>}
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      )}
    </section>
  );
}
