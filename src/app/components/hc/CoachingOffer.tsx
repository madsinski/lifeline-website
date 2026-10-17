"use client";

// What the Þjálfun tab shows on the app tier alone.
//
// "Lifeline appið" has nobody on the other end; "Lifeline þjálfun" adds a
// nurse/health coach, in Vestmannaeyjar only for now. So instead of an empty
// thread this says what coaching is, what it costs, and whether it can be
// bought where the person lives — and, if not yet, why (no address yet, or
// an address elsewhere). The purchase itself is /app/askrift, once Lifeline
// has approved the request sent from here or there (CoachingRequest.tsx).

import { useState } from "react";
import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { hcBtn, hcCard, hcKicker } from "./ui";
import { fmtIsk } from "@/app/components/account/ui/dates";
import { NO_REQUEST, NOT_IN_REGION_COPY, SERVICE_DAY_COPY, type CoachingRequestView } from "@/lib/hc/coaching-config";
import CoachingRequestPanel from "./CoachingRequest";
import * as cache from "@/lib/hc/client-cache";

export interface CoachingOfferData {
  available: boolean;
  eligible: boolean;
  reason: "no_address" | "outside_region" | null;
  price_isk: number;
  name: string;
  includes: string[] | null;
  service_weekday: number;
  /** Approved by Lifeline before payment (src/lib/hc/coaching-requests.ts). */
  request?: CoachingRequestView;
}

export default function CoachingOffer({ offer }: { offer: CoachingOfferData }) {
  const [request, setRequest] = useState<CoachingRequestView>(offer.request ?? NO_REQUEST);
  return (
    <section className={`${hcCard.base} p-5 sm:p-6`} aria-labelledby="coaching-offer-title">
      {/* The tab is „Þjálfun“; the product is „Lifeline þjálfun“. Said in so
          many words, so nobody thinks the tab itself is something to buy. */}
      <p className={`${hcKicker} text-hc-brand-text`}>Áskrift með heilsuþjálfa</p>
      <h2 id="coaching-offer-title" className="mt-1 text-xl font-bold text-hc-ink">{offer.name}</h2>
      <p className="mt-1 text-sm text-hc-ink-2">
        Hér undir Þjálfun birtast samtöl og tímar við heilsuþjálfa. Þau fylgja áskriftinni {offer.name}:
        allt appið, auk hjúkrunarfræðings sem heilsuþjálfa. Appið sem þú ert með núna er sjálfsafgreiðsla.
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
          /* Same states as /app/askrift: ask first, pay once approved. */
          <CoachingRequestPanel request={request}
            onChange={(v) => { setRequest(v); cache.invalidate("/api/hc/coach", "/api/hc/subscribe"); }}
            payAction={<Link href="/app/askrift?pakki=thjalfun" className={hcBtn.cta}>Velja {offer.name}</Link>} />
        ) : offer.reason === "no_address" ? (
          <>
            {/* Straight to the one field that decides it, not to Stillingar. */}
            <p className="mb-3 flex gap-2 text-sm text-hc-ink-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />
              Í boði í Vestmannaeyjum. Með heimilisfanginu þínu sjáum við hvort þjálfunin nær til þín.
            </p>
            <Link href="/app/uppsetning?skref=heimilisfang" className={hcBtn.primary}>Skrá heimilisfang</Link>
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
