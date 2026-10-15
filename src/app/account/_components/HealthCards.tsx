"use client";

// Cards that belong to the medical service: the latest body-composition
// values (read live from Biody, never stored here), the privacy re-consent
// nudge, the patient-portal card and the required "this is not the
// sjúkraskrá" statement.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Alert, Button, SectionCard, accountInset, fmtDate } from "@/app/components/account/ui";
import PortalLink from "./PortalLink";

interface BodyCompSummary {
  measuredAt: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  body_water_pct: number | null;
  phase_angle: number | null;
  bmr_kcal: number | null;
  waist_to_hip: number | null;
}

const BIODY_CONSENT_KEY = "biody-import-v1";

async function hasBiodyConsent(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("client_consents")
    .select("id, granted")
    .eq("client_id", userId)
    .eq("consent_key", BIODY_CONSENT_KEY)
    .is("revoked_at", null)
    .maybeSingle();
  return !!data && (data as { granted?: boolean }).granted === true;
}

function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  // Hand-formatted decimal comma, like the dates: no reliance on "is" locale data.
  const shown = value === null ? "—" : `${String(Math.round(Number(value) * 100) / 100).replace(".", ",")}${unit ? ` ${unit}` : ""}`;
  return (
    <div className={`${accountInset} px-3 py-2.5`}>
      <dt className="text-xs text-hc-ink-3">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-hc-ink">{shown}</dd>
    </div>
  );
}

/** Latest measurements from Biody, only when the person has switched them on. */
export function BodyCompositionCard({ userId }: { userId: string }) {
  const { t, tv, locale } = useI18n();
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<BodyCompSummary[] | null>(null);

  useEffect(() => {
    let off = false;
    hasBiodyConsent(userId).then((ok) => { if (!off) setHasConsent(ok); });
    return () => { off = true; };
  }, [userId]);

  useEffect(() => {
    if (hasConsent !== true) return;
    let off = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: s } = await supabase.auth.getSession();
        const token = s.session?.access_token;
        if (!token) throw new Error("no_session");
        const res = await fetch("/api/account/biody/measurements", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) throw new Error(j.error || "fetch_failed");
        if (!off) setMeasurements(j.measurements as BodyCompSummary[]);
      } catch (e) {
        if (!off) setError((e as Error).message);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, [hasConsent]);

  // Without consent the re-consent banner (on Aðgangur) handles it.
  if (hasConsent !== true) return null;
  const latest = measurements?.[0];

  return (
    <SectionCard icon={Activity} title={t("acct.p.likamssamsetning", "Líkamssamsetning")}
      description={t("acc.bc.desc", "Nýjustu gildin úr líkamssamsetningarmælingunni (Biody), sótt beint og ekki geymd hér.")}
      action={latest ? <span className="text-xs text-hc-ink-3">{tv("acc.bc.measured", "Mælt {{date}}", { date: fmtDate(latest.measuredAt, {}, locale) })}</span> : undefined}>
      {loading && <p className="text-sm text-hc-ink-3">{t("acct.p.saeki-maelingar", "Sæki mælingar…")}</p>}
      {error && (
        <Alert tone="bad" compact>
          {error === "no_session" ? t("acct.p.thu-tharft-ad-skra-thig", "Þú þarft að skrá þig inn")
            : error === "fetch_failed" ? t("acct.p.tokst-ekki-ad-saekja-maelingar", "Tókst ekki að sækja mælingar")
            : tv("acc.bc.error", "Náði ekki sambandi við Biody: {{err}}", { err: error })}
        </Alert>
      )}
      {!loading && !error && measurements && measurements.length === 0 && (
        <p className="text-sm text-hc-ink-3">{t("acct.p.engar-greindar-maelingar-enn-bokad", "Engar greindar mælingar enn. Bókaðu mælingu til að byrja.")}</p>
      )}
      {latest && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("acct.p.thyngd", "Þyngd")} value={latest.weight_kg} unit="kg" />
          <Stat label={t("acc.bc.fat", "Fituhlutfall")} value={latest.body_fat_pct} unit="%" />
          <Stat label={t("acct.p.vodvamassi", "Vöðvamassi")} value={latest.muscle_mass_kg} unit="kg" />
          <Stat label={t("acc.bc.water", "Vatnshlutfall")} value={latest.body_water_pct} unit="%" />
          <Stat label={t("acc.bc.phase", "Fasahorn")} value={latest.phase_angle} unit="°" />
          <Stat label={t("acc.bc.bmr", "Grunnbrennsla (BMR)")} value={latest.bmr_kcal} unit="kcal" />
          <Stat label={t("acct.p.mittis-og-mjadmahlutfall", "Mittis- og mjaðmahlutfall")} value={latest.waist_to_hip} unit="" />
        </dl>
      )}
    </SectionCard>
  );
}

/**
 * Biody-activated accounts without a consent row yet (backfill for the
 * consent system shipped 2026-04-30). It sits directly above the switch it
 * asks about, so its button scrolls there rather than switching tabs.
 */
export function BiodyReconsentBanner({ userId, targetId }: { userId: string; targetId: string }) {
  const { t } = useI18n();
  const [needsConsent, setNeedsConsent] = useState(false);
  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await supabase
        .from("client_consents")
        .select("id")
        .eq("client_id", userId)
        .eq("consent_key", BIODY_CONSENT_KEY)
        .is("revoked_at", null)
        .maybeSingle();
      if (!off) setNeedsConsent(!data);
    })();
    return () => { off = true; };
  }, [userId]);

  if (!needsConsent) return null;
  return (
    <Alert tone="warn" title={t("acct.p.stadfestu-val-um-personuvernd", "Staðfestu val um persónuvernd")}
      actions={<Button size="sm" variant="secondary" onClick={() => {
        const el = document.getElementById(targetId);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
        el?.querySelector<HTMLElement>("[role=switch]")?.focus({ preventScroll: true });
      }}>{t("acct.p.opna-personuverndarstillingar", "Opna persónuverndarstillingar")}</Button>}>
      {t("acc.reconsent.body", "Ný stilling: hvort mælingarnar þínar úr líkamssamsetningarmælingunni (Biody) birtist hér svo þú getir fylgst með þeim. Sjálfgefið birtast þær ekki. Sjúkraskráin þín í sjúklingagáttinni breytist ekki hvort sem er.")}
    </Alert>
  );
}

/** The record lives in the patient portal (Medalia), not here. */
export function PortalCard() {
  const { t } = useI18n();
  return (
    <SectionCard icon={ShieldCheck} title={t("acct.p.sjuklingagatt", "Sjúklingagátt")}
      description={t("acc.portal.desc", "Niðurstöður, skýrsla læknis og örugg samskipti við heilbrigðisstarfsfólk eru í sjúklingagáttinni, sem Medalia rekur fyrir Lifeline.")}
      action={<PortalLink size="md" />} />
  );
}

/**
 * The regulatory statement, kept verbatim: this page is not the medical
 * record, which is held in Medalia under Act no. 55/2009.
 */
export function WellnessFramingNote() {
  const { t } = useI18n();
  return (
    <p className="px-1 text-xs leading-relaxed text-hc-ink-3">
      {t("acct.p.wellness-framing",
         "Þetta er yfirlit yfir bókanir og aðgang, ekki sjúkraskrá. Sjúkraskráin þín er varðveitt í Medalia samkvæmt lögum nr. 55/2009. Klínískum spurningum er svarað í gegnum sjúklingagáttina eða í tíma hjá lækni.")}{" "}
      <Link href="/privacy" className="underline underline-offset-2 hover:text-hc-ink">{t("acct.p.personuvernd", "Persónuvernd")}</Link>
    </p>
  );
}
