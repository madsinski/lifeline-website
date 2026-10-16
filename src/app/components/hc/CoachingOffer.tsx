"use client";

// What the Þjálfun tab shows on the app tier alone.
//
// "Lifeline appið" has nobody on the other end; "Lifeline þjálfun" adds a
// nurse/health coach, in Vestmannaeyjar only for now. So instead of an empty
// thread this says what coaching is, what it costs, and whether it can be
// bought where the person lives — and, if not yet, why (no address yet, or
// an address elsewhere). The purchase itself is the subscription panel.

import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { hcBtn, hcCard, hcKicker } from "./ui";
import { fmtIsk } from "@/app/components/account/ui/dates";
import { NOT_IN_REGION_COPY, SERVICE_DAY_COPY } from "@/lib/hc/coaching-config";

export interface CoachingOfferData {
  available: boolean;
  eligible: boolean;
  reason: "no_address" | "outside_region" | null;
  price_isk: number;
  name: string;
  includes: string[] | null;
  service_weekday: number;
}

export default function CoachingOffer({ offer }: { offer: CoachingOfferData }) {
  return (
    <section className={`${hcCard.base} p-5 sm:p-6`}>
      <p className={hcKicker}>Með heilsuþjálfa</p>
      <h2 className="mt-1 text-xl font-bold text-hc-ink">{offer.name}</h2>
      <p className="mt-1 text-sm text-hc-ink-2">
        Appið sem þú ert með er sjálfsafgreiðsla. Með þjálfun færðu líka hjúkrunarfræðing sem heilsuþjálfa.
      </p>
      <p className="mt-3 text-2xl font-bold text-hc-ink">
        {fmtIsk(offer.price_isk)} <span className="text-sm font-semibold text-hc-ink-2">á mánuði</span>
      </p>
      {offer.includes?.length ? (
        <ul className="mt-3 space-y-2">
          {offer.includes.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-hc-ink">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden /> {x}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-sm text-hc-ink-2">{SERVICE_DAY_COPY}</p>

      <div className="mt-5">
        {offer.available ? (
          <Link href="/app/adgangur#askrift" className={hcBtn.cta}>Skrá mig í þjálfun</Link>
        ) : offer.reason === "no_address" ? (
          <>
            <p className="mb-3 flex gap-2 text-sm text-hc-ink-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Þjálfun er í boði í Vestmannaeyjum. Skráðu heimilisfangið þitt svo við sjáum hvort hún nær til þín.
            </p>
            <Link href="/app/adgangur" className={hcBtn.secondary}>Skrá heimilisfang</Link>
          </>
        ) : (
          <p className="flex gap-2 text-sm font-semibold text-hc-ink-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {NOT_IN_REGION_COPY}
          </p>
        )}
      </div>
    </section>
  );
}
