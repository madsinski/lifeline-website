"use client";

// Stofan — when you are next seen, and when you were last.
//
// ClinicInfoScreen in the app is mostly static copy plus an email-to-book
// CTA. The part worth having on a phone is the person's own appointments,
// which is what this shows.
//
// Only "booked" rows count as upcoming. The table also holds completed and
// cancelled ones, and treating those as ahead is exactly the bug that put
// two past April appointments on the home screen.

import { useEffect, useState } from "react";
import { Building2, CalendarClock, History, Video } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT, useShortDateTime } from "./../useT";
import type { StringKey } from "./../strings";
import { appBrand, appCard, appHeaderBar, greenHeader, darkHeader } from "./../ui";

interface Appt {
  id: string; kind: string; rawType: string; at: string; status: string | null;
  where: string | null; address: string | null; who: string | null;
  packageName: string | null; videoUrl: string | null; future: boolean;
}
interface Payload {
  upcoming: Appt[]; past: Appt[];
  bookings: { id: string; at: string; location: string | null; status: string | null; packageName: string | null }[];
}

export default function Clinic() {
  const api = useApi();
  const t = useT();
  const at = useShortDateTime();
  const [d, setD] = useState<Payload | null | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      const r = await api("/api/app/clinic");
      const j = r.ok ? await r.json().catch(() => null) : null;
      setTimeout(() => setD(j), 0);
    })();
  }, [api]);

  const row = (a: Appt, muted = false) => (
    <div key={a.id} className={`${appCard} px-4 py-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: muted ? appBrand.ink2 : appBrand.ink1 }}>
          {t(`clinic.${a.kind}` as StringKey)}
        </span>
        {a.status && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{
              background: a.status === "cancelled" ? `${appBrand.error}14` : `${appBrand.primary}14`,
              color: a.status === "cancelled" ? appBrand.error : appBrand.primaryDark,
            }}>
            {t(`clinic.status.${a.status}` as StringKey)}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs" style={{ color: appBrand.ink2 }}>
        {at(a.at)}
        {a.where ? ` · ${a.where}` : a.who ? ` · ${a.who}` : ""}
      </p>
      {a.address && <p className="text-[11px]" style={{ color: appBrand.ink3 }}>{a.address}</p>}
      {a.videoUrl && a.future && (
        <a href={a.videoUrl} target="_blank" rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-white"
          style={{ background: appBrand.primary }}>
          <Video className="h-3.5 w-3.5" aria-hidden />{t("clinic.join")}
        </a>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: appBrand.ink1 }}>{t("nav.clinic")}</h1>

      {d === undefined && <div className="h-32 animate-pulse rounded-[14px] bg-white" aria-hidden />}

      {d && (
        <>
          <section>
            <div className={appHeaderBar} style={greenHeader}>
              <CalendarClock className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1 text-[15px] font-bold">{t("clinic.upcoming")}</span>
            </div>
            <div className="mt-2 space-y-2">
              {d.upcoming.length === 0 ? (
                <div className={`${appCard} p-4`}>
                  <p className="text-sm" style={{ color: appBrand.ink2 }}>{t("clinic.none")}</p>
                  <a href="/account/book"
                    className="mt-3 inline-flex min-h-10 items-center rounded-full px-4 font-semibold text-white"
                    style={{ background: appBrand.primary }}>
                    {t("clinic.book")}
                  </a>
                </div>
              ) : d.upcoming.map((a) => row(a))}
            </div>
          </section>

          {d.bookings.length > 0 && (
            <section>
              <div className={appHeaderBar} style={greenHeader}>
                <Building2 className="h-[18px] w-[18px]" aria-hidden />
                <span className="flex-1 text-[15px] font-bold">{t("clinic.bodycomp")}</span>
              </div>
              <div className={`${appCard} mt-2 divide-y divide-slate-100`}>
                {d.bookings.map((b) => (
                  <div key={b.id} className="flex items-baseline justify-between px-4 py-2.5">
                    <span className="text-xs" style={{ color: appBrand.ink2 }}>
                      {at(b.at)}{b.location ? ` · ${b.location}` : ""}
                    </span>
                    {b.status && (
                      <span className="text-[10px] font-bold uppercase" style={{ color: appBrand.ink3 }}>{b.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className={appHeaderBar} style={darkHeader}>
              <History className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1 text-[15px] font-bold">{t("clinic.past")}</span>
            </div>
            <div className="mt-2 space-y-2">
              {d.past.length === 0
                ? <p className={`${appCard} p-4 text-sm`} style={{ color: appBrand.ink2 }}>{t("clinic.noPast")}</p>
                : d.past.map((a) => row(a, true))}
            </div>
          </section>
        </>
      )}

      {d === null && <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("home.failed")}</p>}
    </div>
  );
}
