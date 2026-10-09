"use client";

// Samfélag — where you stand, what you have earned, what is on.
//
// CommunityScreen and its six tabs are the app's largest surface (8,522
// lines across eleven screens). This is its read-only core: Lífstig and
// rank, badges, upcoming events, and the shared feed. Joining an event,
// friend requests and peer messages are writes and are not here yet — the
// screen says so rather than showing buttons that do nothing.

import { useEffect, useState } from "react";
import { Award, CalendarDays, Trophy, Users } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT, useShortDateTime } from "./../useT";
import { appBrand, appCard, appHeaderBar, greenHeader, darkHeader } from "./../ui";
import { BADGE, feedLine } from "./../badges";
import { useI18n } from "@/lib/i18n";

interface Payload {
  me: { points: number; rank: number | null };
  leaderboard: { rank: number; name: string; points: number; isMe: boolean }[];
  badges: { key: string; title: string; description: string | null; icon: string | null; colour: string | null; at: string }[];
  events: { id: string; name: string; type: string | null; colour: string | null; date: string; time: string | null; location: string | null; cost: string | number | null; reward: string | number | null; joined: boolean }[];
  feed: { id: string; who: string; isMe: boolean; action: string; points: number; at: string }[];
}

export default function Community() {
  const api = useApi();
  const t = useT();
  const at = useShortDateTime();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "is";
  const [d, setD] = useState<Payload | null | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      const r = await api("/api/app/community");
      const j = r.ok ? await r.json().catch(() => null) : null;
      setTimeout(() => setD(j), 0);
    })();
  }, [api]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: appBrand.ink1 }}>{t("nav.community")}</h1>

      {d === undefined && <div className="h-32 animate-pulse rounded-[14px] bg-white" aria-hidden />}

      {d && (
        <>
          {/* Where you stand. */}
          <div className={`${appCard} flex items-center gap-4 p-4`}>
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
              style={{ background: `${appBrand.primary}14`, border: `2px solid ${appBrand.primary}` }}>
              <Trophy className="h-6 w-6" style={{ color: appBrand.primaryDark }} aria-hidden />
            </span>
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>
                {t("social.points")}
              </span>
              <span className="text-2xl font-bold tabular-nums" style={{ color: appBrand.ink1 }}>{d.me.points}</span>
              <span className="ml-2 text-xs" style={{ color: appBrand.ink2 }}>
                {d.me.rank ? `${d.me.rank}. ${t("social.rank")}` : t("social.unranked")}
              </span>
            </span>
          </div>

          {/* Events. */}
          <section>
            <div className={appHeaderBar} style={greenHeader}>
              <CalendarDays className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1 text-[15px] font-bold">{t("social.events")}</span>
            </div>
            <div className="mt-2 space-y-2">
              {d.events.length === 0
                ? <p className={`${appCard} p-4 text-sm`} style={{ color: appBrand.ink2 }}>{t("social.noEvents")}</p>
                : d.events.map((e) => (
                  <div key={e.id} className={`${appCard} flex items-start gap-3 px-4 py-3`}>
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: e.colour || appBrand.primary }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold" style={{ color: appBrand.ink1 }}>{e.name}</span>
                      <span className="block truncate text-xs" style={{ color: appBrand.ink2 }}>
                        {e.date}{e.time ? ` ${String(e.time).slice(0, 5)}` : ""}{e.location ? ` · ${e.location}` : ""}
                      </span>
                    </span>
                    {e.joined && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: `${appBrand.primary}14`, color: appBrand.primaryDark }}>
                        {t("social.joined")}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </section>

          {/* Badges. */}
          <section>
            <div className={appHeaderBar} style={greenHeader}>
              <Award className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1 text-[15px] font-bold">{t("social.badges")}</span>
              {d.badges.length > 0 && <span className="text-xs font-semibold opacity-90">{d.badges.length}</span>}
            </div>
            <div className="mt-2">
              {d.badges.length === 0 ? (
                <p className={`${appCard} p-4 text-sm`} style={{ color: appBrand.ink2 }}>{t("social.noBadges")}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {d.badges.map((b) => (
                    <div key={b.key} className={`${appCard} p-3`}>
                      {/* icon is an icon NAME ("trophy"), not an emoji —
                          every badge in the table uses that one value.
                          Rendering it raw printed the word, so the badge's
                          own colour carries the distinction instead. */}
                      <Award className="h-5 w-5" style={{ color: b.colour || appBrand.accent }} aria-hidden />
                      <p className="text-xs font-bold" style={{ color: b.colour || appBrand.ink1 }}>
                        {BADGE[b.key]?.[lang] ?? b.title}
                      </p>
                      {b.description && (
                        <p className="text-[11px] leading-snug" style={{ color: appBrand.ink2 }}>{b.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Leaderboard. */}
          <section>
            <div className={appHeaderBar} style={greenHeader}>
              <Users className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1 text-[15px] font-bold">{t("social.leaderboard")}</span>
            </div>
            <div className={`${appCard} mt-2 divide-y divide-slate-100`}>
              {d.leaderboard.map((l) => (
                <div key={`${l.rank}-${l.name}`} className="flex items-baseline gap-3 px-4 py-2"
                  style={l.isMe ? { background: `${appBrand.primary}0d` } : undefined}>
                  <span className="w-5 shrink-0 text-xs font-bold tabular-nums" style={{ color: appBrand.ink3 }}>
                    {l.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold"
                    style={{ color: l.isMe ? appBrand.primaryDark : appBrand.ink1 }}>
                    {l.isMe ? t("social.you") : l.name}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: appBrand.ink1 }}>
                    {l.points}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* The feed. */}
          <section>
            <div className={appHeaderBar} style={darkHeader}>
              <Users className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1 text-[15px] font-bold">{t("social.feed")}</span>
            </div>
            <div className="mt-2">
              {d.feed.length === 0 ? (
                <p className={`${appCard} p-4 text-sm`} style={{ color: appBrand.ink2 }}>{t("social.noFeed")}</p>
              ) : (
                <div className={`${appCard} divide-y divide-slate-100`}>
                  {d.feed.map((f) => (
                    <div key={f.id} className="flex items-baseline gap-2 px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-semibold"
                          style={{ color: f.isMe ? appBrand.primaryDark : appBrand.ink1 }}>
                          {f.isMe ? t("social.you") : f.who}
                        </span>
                        <span className="text-sm" style={{ color: appBrand.ink2 }}> {feedLine(f.action, lang)}</span>
                      </span>
                      {f.points > 0 && (
                        <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: appBrand.primaryDark }}>
                          +{f.points}
                        </span>
                      )}
                      <span className="shrink-0 text-[10px]" style={{ color: appBrand.ink3 }}>{at(f.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {d === null && <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("home.failed")}</p>}
    </div>
  );
}
