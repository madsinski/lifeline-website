"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { saveStraumurPaymentMethod, STRAUMUR_BRAND } from "@/lib/straumur";

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
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllPayments, setShowAllPayments] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: pm }, { data: pay }] = await Promise.all([
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
    setAdding(true);
    setError(null);
    const res = await saveStraumurPaymentMethod();
    if (!res.ok) { setError(res.error); setAdding(false); return; }
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
    setAdding(false);
    if (insErr) { setError(insErr.message); return; }
    load();
  }

  async function setDefault(id: string) {
    setActionId(id);
    // Clear existing default, then set the target
    await supabase.from("payment_methods")
      .update({ is_default: false })
      .eq("owner_type", ownerType).eq("owner_id", ownerId).eq("is_default", true);
    const { error: upErr } = await supabase.from("payment_methods")
      .update({ is_default: true })
      .eq("id", id);
    setActionId(null);
    if (upErr) { setError(upErr.message); return; }
    load();
  }

  async function removeMethod(id: string) {
    if (!confirm("Remove this payment method?")) return;
    setActionId(id);
    const { error: delErr } = await supabase.from("payment_methods").delete().eq("id", id);
    setActionId(null);
    if (delErr) { setError(delErr.message); return; }
    load();
  }

  function statusPill(status: Payment["status"]) {
    const map = {
      pending: "bg-amber-50 text-amber-700 border-amber-100",
      succeeded: "bg-emerald-50 text-emerald-700 border-emerald-100",
      refunded: "bg-gray-50 text-gray-600 border-gray-200",
      failed: "bg-red-50 text-red-700 border-red-100",
    };
    return (
      <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${map[status]}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment methods */}
      <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1F2937]">Payment methods</h2>
            <p className="text-sm text-[#6B7280] mt-1">
              {(() => {
                const providers = Array.from(new Set(methods.map((m) => m.provider).filter(Boolean)));
                const name = providers.length === 1
                  ? (providers[0] === "straumur" ? STRAUMUR_BRAND.name : providers[0].replace(/^./, (c) => c.toUpperCase()))
                  : STRAUMUR_BRAND.name;
                return `Secured by ${name}. We store a token — never the card number.`;
              })()}
            </p>
          </div>
          <button
            onClick={handleAddCard}
            disabled={adding}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95 disabled:opacity-60 shadow-sm"
          >
            {adding && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {adding ? "Saving…" : "+ Add card"}
          </button>
        </div>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : methods.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center text-sm text-gray-600">
            No payment methods on file yet. Add a card to pay for services.
          </div>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-gray-100 bg-[#f8fafc]">
                <div className="w-10 h-7 rounded-md bg-gradient-to-br from-[#0F172A] to-[#334155] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {m.brand || "CARD"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {m.brand || "Card"} •••• {m.last4 || "0000"}
                    {m.is_default && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">Default</span>}
                  </div>
                  {m.exp_month && m.exp_year && (
                    <div className="text-xs text-gray-500">Expires {String(m.exp_month).padStart(2, "0")}/{m.exp_year}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!m.is_default && (
                    <button onClick={() => setDefault(m.id)} disabled={actionId === m.id} className="text-xs font-medium text-[#10B981] hover:underline disabled:opacity-50">
                      Set default
                    </button>
                  )}
                  <button onClick={() => removeMethod(m.id)} disabled={actionId === m.id} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment history */}
      <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1F2937]">Payment history</h2>
          {!showAllPayments && payments.length > 5 && (
            <button onClick={() => setShowAllPayments(true)} className="text-sm font-medium text-[#10B981] hover:underline">
              View all
            </button>
          )}
        </div>
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center text-sm text-gray-600">
            Your payment history will appear here after your first transaction.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6B7280] border-b border-gray-100">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 text-[#1F2937] whitespace-nowrap">
                      {new Date(p.paid_at || p.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="py-3 text-[#1F2937]">
                      {p.description}
                      {p.provider_reference && <div className="text-[10px] text-gray-400 font-mono">{p.provider_reference}</div>}
                    </td>
                    <td className="py-3 text-[#1F2937] font-medium text-right whitespace-nowrap">
                      {p.amount_isk.toLocaleString("is-IS")} {p.currency}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {statusPill(p.status)}
                      {p.pdf_url ? (
                        <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-[#10B981] hover:underline">PDF</a>
                      ) : p.related_type === "body_comp_booking" && p.related_id && p.status !== "pending" && p.amount_isk > 0 ? (
                        <button
                          type="button"
                          onClick={async () => {
                            setActionId(p.id);
                            try {
                              const res = await fetch("/api/bookings/receipt", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ bookingId: p.related_id }),
                              });
                              const body = await res.json().catch(() => ({}));
                              if (!res.ok || !body?.url) { setError(body?.error || "Receipt failed"); return; }
                              window.open(body.url, "_blank", "noopener,noreferrer");
                              load();
                            } finally {
                              setActionId(null);
                            }
                          }}
                          disabled={actionId === p.id}
                          className="ml-2 text-xs text-[#10B981] hover:underline disabled:opacity-60"
                        >
                          {actionId === p.id ? "…" : "Get receipt"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
