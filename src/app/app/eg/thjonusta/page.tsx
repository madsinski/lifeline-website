"use client";

// Þjónusta — everything Lifeline sells, bought here (Mads, 2026-10-16).
//
// The health check as a bundle, and its three parts on their own: the
// measurement, the blood test and the doctor's interview. After payment the
// client gets the product's Medalia code (src/lib/hc/code-pool.ts) and the
// next step: a station slot for the measurement, a doctor-day slot for the
// interview, and for the blood test just where to go. Buying goes through
// the same Checkout as the journey; the rules are on the server
// (/api/hc/checkout, /api/hc/shop, /api/hc/shop/book).

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Droplet, Ruler, Stethoscope, ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";
import JourneyNav, { JourneyHeader } from "@/app/components/hc/JourneyNav";
import { PageHero, accountCard } from "@/app/components/account/ui";
import { hcBtn, hcPage } from "@/app/components/hc/ui";
import Checkout, { CodeBox } from "@/app/components/hc/Checkout";
import SlotBooking from "@/app/components/hc/SlotBooking";
import { formatIsk, type HcOrder, type HcPackage } from "@/lib/hc/types";
import { AFTER_PURCHASE, BUNDLE_EXTRAS, KIND_IS, bundleBreakdown, isStandaloneKind } from "@/lib/hc/shop";

interface ShopOrder {
  id: string; journey_id: string; package_key: string; kind: string; price_isk: number; amount_charged_isk: number;
  status: string; paid_at: string | null; activation_code: string | null; activation_redeemed_at: string | null;
}
interface ShopData {
  packages: HcPackage[];
  orders: ShopOrder[];
  doctor_weekday: number;
  profile_complete: boolean;
  bundle_paid: boolean;
}

const MO_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const fmtDay = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getUTCDate()}. ${MO_IS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const ICON: Record<string, typeof Ruler> = {
  health_check: ClipboardList, measurement: Ruler, blood_test: Droplet, doctor_interview: Stethoscope,
};

async function api(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.headers as Record<string, string> | undefined) } });
}

export default function ThjonustaPage() {
  return <Suspense><Thjonusta /></Suspense>;
}

function Thjonusta() {
  const router = useRouter();
  const [data, setData] = useState<ShopData | null>(null);
  const [failed, setFailed] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/hc/shop").catch(() => null);
    if (r?.status === 401) { router.replace(`/account/login?next=${encodeURIComponent("/app/eg/thjonusta")}`); return; }
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => { if (j) { setData(j); setFailed(false); } else setFailed(true); }, 0);
  }, [router]);

  useEffect(() => {
    void (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { router.replace(`/account/login?next=${encodeURIComponent("/app/eg/thjonusta")}`); return; }
      await load();
    })();
  }, [load, router]);

  const bundle = data?.packages.find((p) => p.kind === "health_check") ?? null;
  const singles = (data?.packages ?? []).filter((p) => isStandaloneKind(p.kind));
  const prices = Object.fromEntries(singles.map((p) => [p.kind, p.price_isk]));
  const { parts, separateTotal } = bundleBreakdown(prices);
  const myOrders = (data?.orders ?? []).filter((o) => isStandaloneKind(o.kind));

  const onPaid = (o: HcOrder) => {
    setBuying(null);
    /* The new order (code + next step) is the first thing under "Pantanir". */
    setTimeout(() => document.getElementById(`order-${o.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  };

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        <JourneyHeader />
        <div className="sm:mb-4"><JourneyNav active="me" /></div>

        <PageHero kicker="Ég" title="Þjónusta"
          body="Heilsufarsskoðunin í heild, eða mæling, blóðprufa og læknisviðtal hvert fyrir sig. Eftir greiðslu færðu virkjunarkóða fyrir sjúklingagáttina og næsta skref." />

        {failed ? (
          <p role="alert" className="rounded-hc-card bg-hc-bad-surface px-4 py-3 text-sm text-hc-bad-ink">
            Náði ekki í þjónustuna.{" "}
            <button type="button" onClick={() => { setFailed(false); void load(); }} className="font-semibold underline">Reyna aftur</button>
          </p>
        ) : !data ? (
          <div className="h-80 rounded-hc-card hc-shimmer" aria-busy="true" aria-label="Hleð" />
        ) : (
          <>
            {!data.profile_complete && (
              <p className="rounded-hc-card bg-hc-warn-surface px-4 py-3 text-sm text-hc-warn-ink">
                Til að kaupa þarf nafn, kennitölu, síma og heimilisfang, því kóðinn er virkjaður í sjúklingagáttinni á þína kennitölu.{" "}
                <Link href="/app?ferd=1" className="font-semibold underline">Fylla út upplýsingar</Link>
              </p>
            )}

            {myOrders.length > 0 && (
              <section aria-labelledby="shop-orders" className="space-y-3">
                <h2 id="shop-orders" className="px-1 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Pantanirnar þínar</h2>
                {myOrders.map((o) => <OrderCard key={o.id} order={o} reload={load} />)}
              </section>
            )}

            {bundle && (
              <section aria-labelledby="shop-bundle" className={`${accountCard} p-5 sm:p-6`}>
                <div className="flex flex-wrap items-start gap-3">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-hc-element bg-hc-brand-surface text-hc-brand-text">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-hc-brand-text">Pakkinn</p>
                    <h2 id="shop-bundle" className="text-lg font-bold text-hc-ink">{bundle.name}</h2>
                    {bundle.tagline && <p className="text-sm text-hc-ink-3">{bundle.tagline}</p>}
                  </div>
                  <p className="w-full pl-14 text-xl font-bold text-hc-ink tabular-nums sm:w-auto sm:pl-0">{formatIsk(bundle.price_isk)}</p>
                </div>
                {bundle.description && <p className="mt-3 text-sm leading-relaxed text-hc-ink-2">{bundle.description}</p>}

                {/* What the bundle is worth, said plainly. */}
                <div className="mt-4 rounded-hc-element bg-hc-sunken p-4 text-sm">
                  <p className="font-semibold text-hc-ink">Ef keypt sér: {formatIsk(separateTotal)} + skýrsla, áætlunarsamtal og áætlun</p>
                  <ul className="mt-2 space-y-1">
                    {parts.map((x) => (
                      <li key={x.kind} className="flex justify-between gap-3 text-hc-ink-2">
                        <span>{x.label}</span><span className="tabular-nums">{formatIsk(x.price)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 font-semibold text-hc-ink">Aðeins í pakkanum</p>
                  <ul className="mt-1 space-y-1">
                    {BUNDLE_EXTRAS.map((x) => (
                      <li key={x} className="flex gap-2 text-hc-ink-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />{x}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4">
                  {data.bundle_paid ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-hc-ok-surface px-3 py-1.5 font-semibold text-hc-ok-ink">Greitt</span>
                      <Link href="/app?ferd=1" className={hcBtn.cta}>Opna heilsuferðina</Link>
                    </div>
                  ) : buying === bundle.key ? (
                    <Checkout packages={[bundle]} profileComplete={data.profile_complete}
                      reload={load} onPaid={() => { setBuying(null); router.push("/app?ferd=1"); }} />
                  ) : (
                    <button type="button" onClick={() => setBuying(bundle.key)} className={hcBtn.cta}>
                      Kaupa heilsufarsskoðun
                    </button>
                  )}
                </div>
              </section>
            )}

            <section aria-labelledby="shop-singles" className="space-y-3">
              <h2 id="shop-singles" className="px-1 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Stakir hlutar</h2>
              {singles.map((p) => {
                const Icon = ICON[p.kind] ?? Ruler;
                return (
                  <div key={p.key} className={`${accountCard} p-5`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-hc-element bg-hc-brand-surface text-hc-brand-text">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-hc-ink">{p.name}</h3>
                        {p.tagline && <p className="text-sm text-hc-ink-3">{p.tagline}</p>}
                      </div>
                      <p className="font-bold text-hc-ink tabular-nums">{formatIsk(p.price_isk)}</p>
                    </div>
                    {p.description && <p className="mt-2 text-sm leading-relaxed text-hc-ink-2">{p.description}</p>}
                    <p className="mt-2 text-sm text-hc-ink-2"><span className="font-semibold text-hc-ink">Eftir kaup: </span>{AFTER_PURCHASE[p.kind]}</p>
                    <div className="mt-3">
                      {buying === p.key ? (
                        <Checkout packages={[p]} profileComplete={data.profile_complete} reload={load} onPaid={onPaid} />
                      ) : (
                        <button type="button" onClick={() => setBuying(p.key)} className={hcBtn.cta}>
                          Kaupa {KIND_IS[p.kind]?.toLowerCase() ?? p.name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

          </>
        )}
      </div>
    </div>
  );
}

/** One bought product: its code, and what to do next. */
function OrderCard({ order, reload }: { order: ShopOrder; reload: () => Promise<void> }) {
  return (
    <div id={`order-${order.id}`} className={`${accountCard} scroll-mt-24 space-y-3 p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold text-hc-ink">{KIND_IS[order.kind] ?? order.package_key}</h3>
        <span className="text-xs text-hc-ink-3">Greitt {fmtDay(order.paid_at)}</span>
      </div>
      {order.activation_code ? (
        <div>
          <p className="text-sm text-hc-ink-2">Virkjunarkóði fyrir sjúklingagáttina (Medalia):</p>
          <CodeBox code={order.activation_code} />
        </div>
      ) : (
        <p className="rounded-xl bg-hc-info-surface px-3 py-2 text-sm text-hc-info-ink">
          Virkjunarkóðinn er á leiðinni. Hann berst þér í tölvupósti innan eins virks dags og birtist hér.
        </p>
      )}
      {order.kind === "measurement" && <SlotBooking orderId={order.id} kind="measurement" onChange={() => void reload()} />}
      {order.kind === "doctor_interview" && <SlotBooking orderId={order.id} kind="doctor" onChange={() => void reload()} />}
      {order.kind === "blood_test" && (
        <p className="rounded-xl bg-hc-sunken px-3 py-2 text-sm text-hc-ink-2">
          Blóðprufan er pöntuð í sjúklingagáttinni þegar þú hefur virkjað kóðann. Mættu fastandi á rannsóknarstofu.
          Fastandi merkir ekkert nema vatn í 10–12 klukkustundir á undan.
        </p>
      )}
    </div>
  );
}
