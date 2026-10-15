"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { saveStraumurPaymentMethod, STRAUMUR_BRAND, STRAUMUR_CARDS_LIVE } from "@/lib/straumur";
import { useI18n } from "@/lib/i18n";
import { CreditCard, Plus, Receipt } from "lucide-react";
import { Alert, Button, SavedNote, SectionCard, accountInset, fmtIsk, fmtNumericDate, friendlyError, useDialog, useFlash } from "./account/ui";

type OwnerType = "client" | "company";

type PaymentMethod = {
  id: string;
  provider: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
  nickname: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  amount_isk: number;
  currency: string;
  description: string;
  status: "pending" | "succeeded" | "refunded" | "failed";
  provider: string;
  provider_reference: string | null;
  paid_at: string | null;
  created_at: string;
  pdf_url: string | null;
  related_type: string | null;
  related_id: string | null;
};

export default function BillingPanel({
  ownerType, ownerId,
}: {
  ownerType: OwnerType;
  ownerId: string;
}) {
  const { t, tv } = useI18n();
  const { confirm } = useDialog();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllPayments, setShowAllPayments] = useState(false);
  /* "Kort skráð ✓" / "Aðalkort uppfært ✓" beside the add button. */
  const [savedMsg, flashSaved, clearSaved] = useFlash(3500);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: pm, error: pmErr }, { data: pay, error: payErr }] = await Promise.all([
      supabase.from("payment_methods")
        .select("id, provider, brand, last4, exp_month, exp_year, is_default, nickname, created_at")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false }),
      supabase.from("payments")
        .select("id, amount_isk, currency, description, status, provider, provider_reference, paid_at, created_at, pdf_url, related_type, related_id")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setLoadError(!!(pmErr || payErr));
    setMethods((pm as PaymentMethod[]) || []);
    setPayments((pay as Payment[]) || []);
    setLoading(false);
  }, [ownerType, ownerId]);

  useEffect(() => { load(); }, [load]);

  const visiblePayments = useMemo(
    () => showAllPayments ? payments : payments.slice(0, 5),
    [payments, showAllPayments],
  );

  async function handleAddCard() {
    if (!STRAUMUR_CARDS_LIVE) return;
    setAdding(true);
    setError(null);
    clearSaved();
    try {
      const res = await saveStraumurPaymentMethod();
      if (!res.ok) { setError(friendlyError(res.error, t("comp.bill.addfailed", "Tókst ekki að skrá kortið."))); return; }
      const isFirst = methods.length === 0;
      const { error: insErr } = await supabase.from("payment_methods").insert({
        owner_type: ownerType,
        owner_id: ownerId,
        provider: "straumur",
        provider_token: res.method.token,
        brand: res.method.brand,
        last4: res.method.last4,
        exp_month: res.method.expMonth,
        exp_year: res.method.expYear,
        is_default: isFirst,
      });
      if (insErr) throw insErr;
      await load();
      flashSaved(t("comp.bill.added", "Kort skráð"));
    } catch (err) {
      setError(friendlyError(err, t("comp.bill.addfailed", "Tókst ekki að skrá kortið.")));
    } finally {
      setAdding(false);
    }
  }

  async function setDefault(id: string) {
    setActionId(id);
    setError(null);
    clearSaved();
    try {
      // Clear the existing default, then set the target.
      const { error: clrErr } = await supabase.from("payment_methods")
        .update({ is_default: false })
        .eq("owner_type", ownerType).eq("owner_id", ownerId).eq("is_default", true);
      if (clrErr) throw clrErr;
      const { data, error: upErr } = await supabase.from("payment_methods")
        .update({ is_default: true })
        .eq("id", id)
        .select("id");
      if (upErr) throw upErr;
      if (!data || data.length === 0) throw new Error("permission denied");
      await load();
      flashSaved(t("comp.bill.primaryset", "Aðalkort uppfært"));
    } catch (err) {
      setError(friendlyError(err, t("comp.bill.primaryfailed", "Tókst ekki að breyta aðalkorti.")));
      void load();
    } finally {
      setActionId(null);
    }
  }

  async function removeMethod(id: string) {
    const ok = await confirm({
      title: t("comp.bill.removeq", "Fjarlægja þetta greiðslukort?"),
      confirmLabel: t("comp.bill.remove", "Fjarlægja"), cancelLabel: t("comp.bill.keep", "Hætta við"), tone: "danger",
    });
    if (!ok) return;
    setActionId(id);
    setError(null);
    clearSaved();
    try {
      const { data, error: delErr } = await supabase.from("payment_methods").delete().eq("id", id).select("id");
      if (delErr) throw delErr;
      if (!data || data.length === 0) throw new Error("permission denied");
      await load();
      flashSaved(t("comp.bill.removed", "Kortið var fjarlægt"));
    } catch (err) {
      setError(friendlyError(err, t("comp.bill.removefailed", "Tókst ekki að fjarlægja kortið.")));
    } finally {
      setActionId(null);
    }
  }

  /* The receipt route authenticates off the Authorization header; without
     it every click came back 401 ("unauthorized") and nothing opened. The
     tab is opened before the await so a popup blocker (Safari) does not
     swallow it, then pointed at the signed URL. */
  async function openReceipt(p: Payment) {
    setActionId(p.id);
    setError(null);
    const win = window.open("", "_blank");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("no_session");
      const res = await fetch("/api/bookings/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId: p.related_id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) {
        const code = String(body?.error || "");
        throw new Error(code === "not_paid" ? t("comp.bill.receipt-notpaid", "Kvittun fæst aðeins fyrir greidda bókun.")
          : code === "forbidden" || code === "unauthorized" ? code
          : t("comp.bill.noreceipt", "Ekki tókst að sækja kvittun"));
      }
      if (win) { win.opener = null; win.location.href = body.url; }
      else window.location.assign(body.url);
      void load();
    } catch (err) {
      win?.close();
      setError(friendlyError(err, t("comp.bill.noreceipt", "Ekki tókst að sækja kvittun")));
    } finally {
      setActionId(null);
    }
  }

  function statusPill(status: Payment["status"]) {
    const map = {
      pending: "bg-hc-warn-surface text-hc-warn-ink ring-amber-200",
      succeeded: "bg-hc-ok-surface text-hc-ok-ink ring-emerald-200",
      refunded: "bg-hc-sunken-2 text-hc-ink-2 ring-slate-200",
      failed: "bg-hc-bad-surface text-hc-bad-ink ring-rose-200",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${map[status]}`}>
        {({ pending: t("comp.bill.pending", "Í bið"), succeeded: "Greitt", refunded: "Endurgreitt", failed: t("comp.bill.failed", "Mistókst") } as Record<string, string>)[status] ?? status}
      </span>
    );
  }

  const providerName = (() => {
    const providers = Array.from(new Set(methods.map((m) => m.provider).filter(Boolean)));
    return providers.length === 1
      ? (providers[0] === "straumur" ? STRAUMUR_BRAND.name : providers[0].replace(/^./, (c) => c.toUpperCase()))
      : STRAUMUR_BRAND.name;
  })();
  const skeleton = (
    <div className="animate-pulse space-y-2" aria-busy="true"><div className="h-12 rounded-hc-element bg-hc-sunken-2" /><div className="h-12 rounded-hc-element bg-hc-sunken" /></div>
  );
  const empty = (text: string) => <p className={`${accountInset} p-5 text-center text-sm text-hc-ink-2`}>{text}</p>;
  const linkBtn = "text-xs font-semibold text-hc-brand-text hover:underline disabled:opacity-50";

  return (
    <div className="space-y-5">
      {/* Payment methods */}
      <SectionCard icon={CreditCard} title={t("comp.bill.cards", "Greiðslukort")}
        description={tv("comp.bill.securewith", "Öruggt hjá {{provider}}. Við geymum aðeins tákn, aldrei kortanúmerið.", { provider: providerName })}
        action={<span className="flex items-center gap-3">
          <SavedNote msg={savedMsg} />
          {/* The add-card call is still a stub that invents a card; hidden
              until it is real (STRAUMUR_CARDS_LIVE in src/lib/straumur.ts). */}
          {STRAUMUR_CARDS_LIVE
            ? <Button size="sm" onClick={handleAddCard} busy={adding} icon={<Plus className="h-4 w-4" aria-hidden />}>{adding ? t("comp.bill.adding", "Skrái kort…") : t("comp.bill.addcard2", "Bæta við korti")}</Button>
            : <span className="text-xs font-semibold text-hc-ink-2">{t("comp.bill.cards-soon", "Kortaskráning opnar fljótlega")}</span>}
        </span>}>
        {error && <Alert tone="bad" compact className="mb-3" onDismiss={() => setError(null)} dismissLabel={t("acct.q.dismiss", "Loka")}>{error}</Alert>}
        {loadError && !loading && <Alert tone="bad" compact className="mb-3">{t("comp.bill.loadfailed", "Tókst ekki að sækja greiðsluupplýsingar. Endurhlaððu síðuna til að reyna aftur.")}</Alert>}
        {loading ? skeleton : methods.length === 0 ? empty(t("comp.bill.nocard", "Ekkert greiðslukort skráð.")) : (
          <ul className="space-y-2">
            {methods.map((m) => (
              <li key={m.id} className={`${accountInset} flex flex-wrap items-center gap-3 p-3`}>
                <span aria-hidden className="flex h-7 w-10 shrink-0 items-center justify-center rounded-md bg-hc-ink text-[10px] font-bold text-white">{m.brand || "KORT"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-hc-ink">
                    {m.brand || t("comp.bill.card", "Kort")} •••• {m.last4 || "0000"}
                    {m.is_default && <span className="ml-2 rounded-full bg-hc-ok-surface px-2 py-0.5 text-[11px] font-semibold text-hc-ok-ink ring-1 ring-emerald-200">{t("comp.bill.primary", "Aðalkort")}</span>}
                  </p>
                  {m.exp_month && m.exp_year && (
                    <p className="text-xs text-hc-ink-3">{tv("comp.bill.expires", "Gildir til {{date}}", { date: `${String(m.exp_month).padStart(2, "0")}/${m.exp_year}` })}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!m.is_default && (
                    <button type="button" onClick={() => setDefault(m.id)} disabled={actionId !== null} className={linkBtn}>
                      {actionId === m.id ? "…" : t("comp.bill.makeprimary", "Gera að aðalkorti")}
                    </button>
                  )}
                  <button type="button" onClick={() => removeMethod(m.id)} disabled={actionId !== null} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">
                    {t("comp.bill.remove", "Fjarlægja")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Payment history */}
      <SectionCard icon={Receipt} title={t("comp.bill.history", "Greiðslusaga")}
        action={!showAllPayments && payments.length > 5 ? <Button size="sm" variant="ghost" onClick={() => setShowAllPayments(true)}>{t("comp.bill.seeall", "Sjá allt")}</Button> : undefined}>
        {loading ? skeleton : payments.length === 0 ? empty(t("comp.bill.empty", "Greiðslur birtast hér eftir fyrstu færslu.")) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hc-hairline text-left text-hc-ink-3">
                  <th scope="col" className="pb-3 font-medium">{t("acct.q.date", "Dagsetning")}</th>
                  <th scope="col" className="pb-3 font-medium">{t("comp.bill.description", "Lýsing")}</th>
                  <th scope="col" className="pb-3 text-right font-medium">{t("comp.bill.amount", "Upphæð")}</th>
                  <th scope="col" className="pb-3 text-right font-medium">{t("comp.bill.status", "Staða")}</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((p) => (
                  <tr key={p.id} className="border-b border-hc-hairline last:border-0">
                    <td className="whitespace-nowrap py-3 text-hc-ink">{fmtNumericDate(p.paid_at || p.created_at)}</td>
                    <td className="py-3 text-hc-ink">
                      {p.description}
                      {p.provider_reference && <div className="font-mono text-[11px] text-hc-ink-3">{p.provider_reference}</div>}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right font-medium text-hc-ink">
                      {p.currency === "ISK" ? fmtIsk(p.amount_isk) : `${p.amount_isk.toLocaleString("is-IS")} ${p.currency}`}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right">
                      {statusPill(p.status)}
                      {p.pdf_url ? (
                        <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" className={`ml-2 ${linkBtn}`}>PDF</a>
                      ) : p.related_type === "body_comp_booking" && p.related_id && p.status !== "pending" && p.amount_isk > 0 ? (
                        <button
                          type="button"
                          onClick={() => void openReceipt(p)}
                          disabled={actionId === p.id}
                          className={`ml-2 ${linkBtn}`}
                        >
                          {actionId === p.id ? "…" : t("comp.bill.receipt", "Sækja kvittun")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
