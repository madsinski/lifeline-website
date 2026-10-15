"use client";

// Heilsufarsskoðun's supporting cards: Lyfja walk-in days (B2B) and the
// packages for booking another assessment.

import { Check, MapPin, PackagePlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ButtonLink, SectionCard, accountInset, fmtDate, fmtIsk } from "@/app/components/account/ui";
import { PACKAGE_KEYS, packageView } from "./packages";
import type { DayRow } from "./types";

/** Lyfja walk-in measurement days — read-only, no booking needed. */
export function MeasurementDaysCard({ days }: { days: DayRow[] }) {
  const { t, locale } = useI18n();
  if (days.length === 0) return null;
  const note = days.find((d) => d.notes)?.notes;
  return (
    <SectionCard icon={MapPin} title={t("acc.lyfja.title", "Mæling í Lyfju, Smáratorgi")}
      description={t("acc.lyfja.desc", "Komdu einhvern daganna hér fyrir neðan á meðan hjúkrunarmóttakan er opin (08:00–16:00). Engin tímabókun nauðsynleg; hafðu skilríki meðferðis.")}>
      <ul className="flex flex-wrap gap-2">
        {days.map((d) => (
          <li key={d.day} className="rounded-full bg-hc-brand-surface px-3 py-1.5 text-sm font-medium text-hc-brand-text ring-1 ring-emerald-200">
            {fmtDate(d.day, { weekday: true, year: false }, locale)}
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-xs text-hc-ink-3">{note}</p>}
    </SectionCard>
  );
}

/** "Bóka aðra skoðun" — the three packages and nothing else. */
export function PackagesCard({ companyName }: { companyName: string | null }) {
  const { t, locale } = useI18n();
  return (
    <SectionCard icon={PackagePlus}
      title={companyName ? t("acc.pkg.title-b2b", "Bóka aukaskoðun") : t("acc.pkg.title", "Bóka aðra skoðun")}
      description={companyName
        ? t("acc.pkg.desc-b2b", "Vinnuveitandinn greiðir grunnskoðunina þína. Það sem er hér fyrir neðan er valfrjálst og greitt af þér, til dæmis endurmat á milli umferða.")
        : t("acc.pkg.desc", "Byrjaðu á grunnskoðun og komdu svo í endurmat eða sjálfsmat til að fylgjast með breytingum.")}>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {PACKAGE_KEYS.map((k) => {
          const p = packageView(k, locale);
          return (
            <li key={k} className={`${accountInset} flex flex-col p-4`}>
              <h3 className="font-bold text-hc-ink">{p.name}</h3>
              <p className="mt-1 text-lg font-bold text-hc-ink">
                {p.priceIsk === 0 ? t("acc.pkg.free", "Ókeypis") : fmtIsk(p.priceIsk)}
                {p.priceIsk > 0 && <span className="ml-1 text-xs font-medium text-hc-ink-3">{t("acc.pkg.once", "eitt skipti")}</span>}
              </p>
              {p.desc && <p className="mt-1 text-sm text-hc-ink-2">{p.desc}</p>}
              <ul className="mt-3 flex-1 space-y-1">
                {p.includes.map((x) => (
                  <li key={x} className="flex items-start gap-2 text-sm text-hc-ink-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />{x}
                  </li>
                ))}
              </ul>
              <ButtonLink href="/account/book" size="sm" variant="secondary" className="mt-4 self-start">
                {p.priceIsk === 0 ? t("acc.pkg.start", "Byrja") : t("acct.p.boka-skodun", "Bóka skoðun")}
              </ButtonLink>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-hc-ink-2">
        {t("acc.pkg.contact", "Spurningar eða sérþarfir?")}{" "}
        <a href="mailto:contact@lifelinehealth.is" className="font-semibold text-hc-brand-text hover:underline">contact@lifelinehealth.is</a>
      </p>
    </SectionCard>
  );
}
