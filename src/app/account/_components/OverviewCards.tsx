"use client";

// Yfirlit's own cards: who you are (slim welcome), the one thing to do next,
// and the way into the app.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Hourglass, ShieldCheck, Smartphone } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { COACHING_DEFAULTS_EN, COACHING_DEFAULTS_IS } from "@/lib/site-content/coaching";
import AvatarPicker from "@/app/components/AvatarPicker";
import { Button, ButtonLink, SectionCard, fmtMonthYear } from "@/app/components/account/ui";
import { hcKicker } from "@/app/components/hc/ui";
import PortalLink from "./PortalLink";
import type { Journey } from "./journey";
import { nextStepOf } from "./journey";

const TIER_SLOT: Record<string, 1 | 2 | 3> = { "free-trial": 1, "self-maintained": 2, premium: 3 };

/** The subscription tier by its name on /coaching (no stale prices here). */
export function tierName(tier: string | null | undefined, locale: string): string | null {
  if (!tier || !TIER_SLOT[tier]) return null;
  const c = locale === "en" ? COACHING_DEFAULTS_EN : COACHING_DEFAULTS_IS;
  return String(c[`plan${TIER_SLOT[tier]}_name`] ?? tier);
}

export function WelcomeHero({ user, firstName, avatarUrl, companyName, tier, onAvatar }: {
  user: User;
  firstName: string;
  avatarUrl: string | null;
  companyName: string | null;
  tier: string | null;
  onAvatar: (url: string) => void;
}) {
  const { t, tv, locale } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tierLabel = tier && tier !== "free-trial" ? tierName(tier, locale) : null;
  const since = user.created_at ? fmtMonthYear(user.created_at, locale) : "";

  return (
    <header className="relative overflow-hidden rounded-hc-hero bg-gradient-to-br from-hc-hero-from to-hc-hero-to p-6 text-white shadow-hc-raised sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-300/15 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <AvatarPicker
          currentUrl={avatarUrl}
          initial={(firstName || user.email || "U").charAt(0).toUpperCase()}
          uploading={uploading}
          error={error}
          gradient="from-emerald-400 to-teal-600"
          onError={(msg) => { setError(msg); setUploading(false); }}
          onPicked={async (blob) => {
            setUploading(true);
            setError(null);
            try {
              const filePath = `${user.id}/avatar.jpg`;
              const { error: upErr } = await supabase.storage.from("avatars").upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });
              if (upErr) throw upErr;
              const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
              const publicUrl = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : "";
              if (!publicUrl) throw new Error(t("acc.avatar.nourl", "Ekki tókst að sækja slóð myndarinnar."));
              const { error: dbErr } = await supabase.from("clients_decrypted").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
              if (dbErr) throw dbErr;
              onAvatar(publicUrl);
            } catch (e) {
              setError((e as Error).message || t("acc.avatar.failed", "Ekki tókst að hlaða upp mynd."));
            } finally {
              setUploading(false);
            }
          }}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            {firstName ? tv("acct.p.hi-name", "Hæ, {{name}}", { name: firstName }) : t("acct.nav.mypages", "Mínar síður")}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-emerald-50/90">
            {companyName && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 ring-1 ring-white/20">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                <span className="font-medium">{companyName}</span>
              </span>
            )}
            {!companyName && tierLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 ring-1 ring-white/20">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                <span className="font-medium">{tierLabel}</span>
              </span>
            )}
            {since && <span>{tv("acct.p.member-since", "Aðgangur frá {{date}}", { date: since })}</span>}
          </p>
        </div>
      </div>
    </header>
  );
}

/**
 * "Næsta skref": the first open step of the person's own journey — the same
 * steps Heilsufarsskoðun lists — so the two pages cannot disagree. Replaces
 * the marketing "how it works" block that stood here.
 */
export function NextStepCard({ journey, hasBooking, sectionHref }: {
  journey: Journey;
  /** false: nothing booked yet (B2C) — the step is "book". */
  hasBooking: boolean;
  sectionHref: string;
}) {
  const { t } = useI18n();
  const step = nextStepOf(journey);

  if (!step) {
    return (
      <SectionCard icon={CheckCircle2} title={t("acc.next.alldone", "Heilsufarsskoðuninni er lokið")}
        description={t("acc.next.alldone-desc", "Næst er að gera áætlunina að daglegum venjum í appinu og koma aftur í endurmat eftir nokkra mánuði.")}>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/app">{t("acct.p.opna-appid", "Opna appið")}</ButtonLink>
          <ButtonLink href={sectionHref} scroll={false} replace variant="secondary">{t("acc.next.see-steps", "Sjá skrefin")}</ButtonLink>
        </div>
      </SectionCard>
    );
  }

  const waiting = !step.active;
  return (
    <section aria-labelledby="next-step-title" className="rounded-hc-card bg-hc-surface p-5 shadow-hc-raised ring-1 ring-slate-200 sm:p-6">
      <p className={`${hcKicker} flex items-center gap-1.5 ${waiting ? "text-hc-ink-3" : "text-hc-focus"}`}>
        {waiting ? <Hourglass className="h-3.5 w-3.5" aria-hidden /> : <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
        {waiting ? t("acc.next.waiting", "Næst á dagskrá") : t("acct.p.naesta-skref", "Næsta skref")}
      </p>
      <h2 id="next-step-title" className="mt-1.5 text-xl font-bold text-hc-ink">{step.title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-hc-ink-2">{step.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {step.cta && (step.cta.href
          ? <ButtonLink href={step.cta.href}>{step.cta.label}</ButtonLink>
          : <Button onClick={step.cta.onClick} busy={step.cta.busy}>{step.cta.label}</Button>)}
        {!step.cta && step.portal && <PortalLink size="md" />}
        <Link href={sectionHref} scroll={false} replace className="inline-flex min-h-10 items-center gap-1 px-1 text-sm font-semibold text-hc-brand-text underline-offset-2 hover:underline">
          {hasBooking ? t("acc.next.all-steps", "Öll skref skoðunarinnar") : t("acc.next.packages", "Skoða pakkana")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/** The app, prominently: it is where the day-to-day happens. */
export function AppCard({ sectionHref }: { sectionHref: string }) {
  const { t } = useI18n();
  return (
    <SectionCard icon={Smartphone} title={t("acct.p.lifeline-appid", "Lifeline appið")}
      description={t("acc.app.card-desc", "Daglegar aðgerðir, æfingar, næring, svefn og andleg líðan, með áætlun sem er þín. Appið keyrir í vafranum, engin uppsetning úr verslun.")}>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/app">{t("acct.p.opna-appid", "Opna appið")}</ButtonLink>
        <ButtonLink href={sectionHref} scroll={false} replace variant="secondary">{t("acct.p.sja-hvad-fylgir", "Sjá hvað fylgir")}</ButtonLink>
      </div>
    </SectionCard>
  );
}
