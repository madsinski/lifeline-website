"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  renderThjonustuskilmalar,
  renderThjonustusamningur,
  renderPurchaseOrder,
  type PurchaseOrderLineItem,
} from "@/lib/agreement-templates";
import { buildAssessmentPricing, assessmentUnitPriceIsk, FOLLOWUP_DOCTOR_PRICE_ISK } from "@/lib/b2b-pricing";

interface CompanyRow {
  id: string;
  name: string;
  contact_person_id: string;
  agreement_signed_at: string | null;
  kennitala_last4?: string | null;
}

function fmtIsk(n: number): string {
  return n.toLocaleString("is-IS") + " kr";
}

// What the Foundational Health package includes — mirrors the public
// /business "Packages" card so the contact person sees the full value of
// what they are buying before they sign.
const PACKAGE_INCLUDES = [
  "On-site measurements (5 min) — blood pressure, body composition",
  "Targeted blood panel",
  "Full health questionnaire",
  "Doctor-reviewed personal report",
  "1:1 doctor consultation + action plan",
] as const;

// Icelandic alphabet: Á Ð É Í Ó Ú Ý Þ Æ Ö — render in standard UTF-8, the
// browser and html2canvas handle it via the active web font.

export default function SignAgreementPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params?.companyId;

  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [companyKennitala, setCompanyKennitala] = useState<string>(""); // formatted
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Signatory fields
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryRole, setSignatoryRole] = useState("");
  const [signatoryEmail, setSignatoryEmail] = useState("");
  const [agreeChecked, setAgreeChecked] = useState(false);

  // Purchase order — line items are auto-computed from headcount + rounds.
  const [headcount, setHeadcount] = useState<number>(1);
  const [rounds, setRounds] = useState<1 | 2>(1);
  const [includeFollowup, setIncludeFollowup] = useState<boolean>(false);
  const [lineItems, setLineItems] = useState<PurchaseOrderLineItem[]>([]);
  const [billingCadence, setBillingCadence] = useState<string>("one_time");
  const todayIso = new Date().toISOString().slice(0, 10);
  const oneYearFromToday = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const [startsAt, setStartsAt] = useState<string>(todayIso);
  const [endsAt, setEndsAt] = useState<string>(oneYearFromToday);
  const didEditEndsAtRef = useRef(false);
  const [vatRate, setVatRate] = useState<number>(0); // heilbrigðisþjónusta er vsk-frjáls

  // When the contact person changes the start date, roll the end date forward
  // by 12 months — unless they've explicitly edited it themselves.
  useEffect(() => {
    if (didEditEndsAtRef.current) return;
    if (!startsAt) return;
    const d = new Date(startsAt);
    if (isNaN(d.getTime())) return;
    d.setFullYear(d.getFullYear() + 1);
    setEndsAt(d.toISOString().slice(0, 10));
  }, [startsAt]);

  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);

  // Discount code (afsláttarkóði) — validated against discount_codes via RPC.
  const [discountInput, setDiscountInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discountKind, setDiscountKind] = useState<"percent" | "fixed" | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountStatus, setDiscountStatus] = useState<"idle" | "checking" | "applied" | "error">("idle");
  const [discountError, setDiscountError] = useState("");

  const subtotal = useMemo(
    () => lineItems.reduce((s, li) => s + (li.qty * li.unit_price_isk), 0),
    [lineItems],
  );
  const discountIsk = useMemo(() => {
    if (!appliedCode || !discountKind) return 0;
    const raw = discountKind === "percent"
      ? Math.round(subtotal * (discountValue / 100))
      : Math.round(discountValue);
    return Math.min(raw, subtotal); // never below zero
  }, [appliedCode, discountKind, discountValue, subtotal]);
  const discountedSubtotal = Math.max(0, subtotal - discountIsk);
  const vat = Math.round(discountedSubtotal * (vatRate / 100));
  const total = discountedSubtotal + vat;

  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) return;
    setDiscountStatus("checking");
    setDiscountError("");
    const { data, error: e } = await supabase.rpc("validate_discount_code", { p_code: code });
    const row = Array.isArray(data) ? data[0] : data;
    if (e || !row || !row.valid) {
      setAppliedCode(null);
      setDiscountKind(null);
      setDiscountStatus("error");
      const reason = row?.error;
      setDiscountError(
        reason === "expired" ? "This code has expired."
        : reason === "exhausted" ? "This code has been fully used."
        : reason === "inactive" ? "This code is inactive."
        : "Code not found.",
      );
      return;
    }
    setAppliedCode(code.toUpperCase());
    setDiscountKind(row.kind);
    setDiscountValue(Number(row.value));
    setDiscountStatus("applied");
  };

  const clearDiscount = () => {
    setAppliedCode(null);
    setDiscountKind(null);
    setDiscountValue(0);
    setDiscountInput("");
    setDiscountStatus("idle");
    setDiscountError("");
  };

  const loadCompany = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error: e } = await supabase
      .from("companies")
      .select("id, name, contact_person_id, agreement_signed_at")
      .eq("id", companyId)
      .maybeSingle();
    if (e || !data) {
      setError("Company not found, or you don't have access.");
      setLoading(false);
      return;
    }
    setCompany(data as CompanyRow);

    // Get kennitala via list_company_members is overkill — use a direct select
    // via the RPC exposed elsewhere. For now, accept that the server-side
    // render re-fetches it; display a masked placeholder on this page.
    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email || "";
    if (!signatoryEmail) setSignatoryEmail(email);
    const metaName = (userRes.user?.user_metadata?.full_name as string) || "";
    if (metaName && !signatoryName) setSignatoryName(metaName);

    setLoading(false);
  }, [companyId, signatoryEmail, signatoryName]);

  useEffect(() => { loadCompany(); }, [loadCompany]);

  // Fetch the company's formatted kennitala via the dedicated API route.
  useEffect(() => {
    (async () => {
      if (!companyId) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/business/companies/${companyId}/kennitala`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const j = await res.json();
        if (j?.kennitala) setCompanyKennitala(j.kennitala);
      }
    })();
  }, [companyId]);

  // Pre-fill headcount from the roster if employees were already added.
  // In the normal flow the roster is empty at signing time (signing is
  // step 1), so this just seeds a sensible default the contact adjusts.
  const didSeedHeadcountRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (!companyId || didSeedHeadcountRef.current) return;
      const { data, error: e } = await supabase.rpc("list_company_members", { p_company_id: companyId });
      if (e || !Array.isArray(data)) return;
      if (data.length > 0) { setHeadcount(data.length); didSeedHeadcountRef.current = true; }
    })();
  }, [companyId]);

  // Auto-compute the PO line items from headcount + rounds + follow-up.
  useEffect(() => {
    const { lineItems: items } = buildAssessmentPricing({
      employeeCount: Math.max(1, headcount),
      rounds,
      includeFollowup,
    });
    setLineItems(items);
  }, [headcount, rounds, includeFollowup]);

  const perEmployeeUnit = assessmentUnitPriceIsk(Math.max(1, headcount), rounds);
  const assessmentTotal = Math.max(1, headcount) * rounds * perEmployeeUnit;
  const followupTotal = includeFollowup ? Math.max(1, headcount) * FOLLOWUP_DOCTOR_PRICE_ISK : 0;

  const sign = async () => {
    setError("");
    if (!company) return;
    if (!signatoryName.trim() || !signatoryRole.trim() || !signatoryEmail.trim()) {
      setError("Enter your name, job title and email.");
      return;
    }
    if (!agreeChecked) {
      setError("You must confirm that you are authorized to bind the company.");
      return;
    }
    if (lineItems.some((li) => !li.description.trim() || li.qty <= 0 || li.unit_price_isk < 0)) {
      setError("Every order line must have a description, a positive quantity and a price.");
      return;
    }

    setSigning(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/business/companies/${companyId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          signatory_name: signatoryName.trim(),
          signatory_role: signatoryRole.trim(),
          signatory_email: signatoryEmail.trim().toLowerCase(),
          line_items: lineItems,
          subtotal_isk: subtotal,
          vat_isk: vat,
          total_isk: total,
          discount_code: appliedCode,
          discount_isk: discountIsk,
          billing_cadence: billingCadence,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
        }),
      });
      let j: { ok?: boolean; error?: string; detail?: string } = {};
      const raw = await res.text();
      try { j = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }
      if (!res.ok) {
        const detail = j.detail || j.error || (raw.startsWith("Request ") ? raw : `HTTP ${res.status}`);
        setError(`Error: ${detail}`);
        setSigning(false);
        return;
      }
      setDone(true);
    } catch (e) {
      setError(`Error: ${(e as Error).message}`);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto py-16 text-center text-gray-500">Loading…</div>;
  }
  if (error && !company) {
    return <div className="max-w-3xl mx-auto py-16 text-center text-red-600">{error}</div>;
  }
  if (!company) return null;

  if (done || company.agreement_signed_at) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Agreement signed</h1>
        <p className="text-gray-600 mb-6">A copy has been emailed to the signatory and to the Lifeline team.</p>
        <button
          onClick={() => router.push(`/business/${companyId}`)}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-semibold"
        >
          Back to company portal
        </button>
      </div>
    );
  }

  const agreementParams = { companyName: company.name, companyKennitala: companyKennitala || "____-____" };
  const poParams = {
    companyName: company.name,
    companyKennitala: companyKennitala || "____-____",
    poNumber: "(úthlutað við undirritun)",
    lineItems,
    subtotalIsk: subtotal,
    vatIsk: vat,
    totalIsk: total,
    billingCadence,
    startsAt: startsAt || null,
    endsAt: endsAt || null,
    discountCode: appliedCode,
    discountIsk,
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Service agreement &amp; purchase order</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review the agreement and complete your order. Signing is electronic and binding.
        </p>
      </header>

      {/* Package — the Foundational Health programme, priced from headcount + term */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 to-emerald-500" />
        <div className="p-5 sm:p-6 space-y-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1">Your package</div>
            <h2 className="text-xl font-bold text-gray-900">Foundational Health</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              The full programme — the fastest way to give every employee a clear, medical-grade picture of their health.
            </p>
          </div>

          {/* What every employee gets */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">What every employee gets</div>
            <ul className="space-y-2">
              {PACKAGE_INCLUDES.map((x) => (
                <li key={x} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {x}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-3">Doctor consultation in person or as a secure video meeting.</p>
          </div>

          {/* Term — 1-year vs 2-year */}
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">Choose your term</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {([
                { yrs: 1 as const, title: "1-year plan", blurb: "One full health assessment per employee." },
                { yrs: 2 as const, title: "2-year plan", blurb: "Two annual assessments per employee — track progress at a lower price per assessment." },
              ]).map((opt) => {
                const selected = rounds === opt.yrs;
                const unit = assessmentUnitPriceIsk(Math.max(1, headcount), opt.yrs);
                return (
                  <button
                    key={opt.yrs}
                    type="button"
                    onClick={() => setRounds(opt.yrs)}
                    aria-pressed={selected}
                    className={`text-left rounded-xl border-2 p-4 transition ${selected ? "border-emerald-500 bg-emerald-50/50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900">{opt.title}</span>
                      {selected && (
                        <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{opt.blurb}</div>
                    <div className="text-sm font-semibold text-emerald-700 mt-2">
                      {fmtIsk(unit)} <span className="font-normal text-gray-500">/ assessment / employee</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Headcount */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm text-gray-700">
                Number of employees
                <input
                  type="number" min={1}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                  value={headcount}
                  onChange={(e) => setHeadcount(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <span className="text-[11px] text-gray-400">{headcount <= 14 ? "0–14 price band" : "15+ price band"}</span>
              </label>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Enter your expected headcount — this is just for the estimate. You&apos;re only billed for the employees we actually process,
                so if some don&apos;t show up for their assessment, the final invoice is adjusted down accordingly.
              </span>
            </div>
          </div>

          {/* Add-ons */}
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">Add-ons</div>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-gray-300">
                <input
                  type="checkbox"
                  checked={includeFollowup}
                  onChange={(e) => setIncludeFollowup(e.target.checked)}
                  className="mt-1 rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">3-month doctor phone call</div>
                  <div className="text-xs text-gray-600">A 15-minute follow-up call with the doctor three months after the assessment.</div>
                </div>
                <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">{fmtIsk(FOLLOWUP_DOCTOR_PRICE_ISK)} <span className="font-normal text-gray-400">/ employee</span></div>
              </label>

              <div className="flex items-start gap-3 rounded-xl border border-dashed border-gray-200 p-3 opacity-80">
                <input type="checkbox" disabled className="mt-1 rounded border-gray-300" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm flex items-center gap-2 flex-wrap">
                    Coaching app subscription
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Coming soon</span>
                  </div>
                  <div className="text-xs text-gray-600">Daily actions built on each report, a real health coach, community and education — offered as a company perk. Available soon.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Order summary */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="text-gray-700">
                Foundational Health — {Math.max(1, headcount)} employee{headcount === 1 ? "" : "s"} × {rounds} assessment{rounds === 1 ? "" : "s"}
                <span className="text-gray-400"> · {rounds === 1 ? "1-year plan" : "2-year plan"}</span>
              </div>
              <div className="text-gray-900 font-medium whitespace-nowrap">{fmtIsk(assessmentTotal)}</div>
            </div>
            {includeFollowup && (
              <div className="flex items-start justify-between gap-3">
                <div className="text-gray-700">3-month doctor phone call — {Math.max(1, headcount)} employee{headcount === 1 ? "" : "s"}</div>
                <div className="text-gray-900 font-medium whitespace-nowrap">{fmtIsk(followupTotal)}</div>
              </div>
            )}
          </div>

          {/* Billing details */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <label className="text-xs text-gray-500">Billing
              <select value={billingCadence} onChange={(e) => setBillingCadence(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Annually</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">Starts
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
            </label>
            <label className="text-xs text-gray-500">Ends
              <input
                type="date"
                value={endsAt}
                onChange={(e) => { didEditEndsAtRef.current = true; setEndsAt(e.target.value); }}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
              />
              <span className="text-[10px] text-gray-400">Default: 12 months from start</span>
            </label>
            <label className="text-xs text-gray-500">VAT %
              <input type="number" min={0} max={24} value={vatRate} onChange={(e) => setVatRate(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <span className="text-[10px] text-gray-400">Healthcare services are VAT-exempt (Act no. 50/1988)</span>
            </label>
          </div>

          {/* Discount code */}
          <div className="pt-2 border-t border-gray-100">
            <label className="text-xs text-gray-500">Discount code</label>
            {appliedCode ? (
              <div className="mt-1 flex items-center gap-3 text-sm">
                <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold">{appliedCode}</span>
                <span className="text-gray-600">−{fmtIsk(discountIsk)}</span>
                <button type="button" onClick={clearDiscount} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ) : (
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="Enter code"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 uppercase"
                />
                <button
                  type="button"
                  onClick={applyDiscount}
                  disabled={discountStatus === "checking" || !discountInput.trim()}
                  className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 disabled:opacity-40"
                >
                  {discountStatus === "checking" ? "…" : "Apply"}
                </button>
              </div>
            )}
            {discountError && <p className="text-xs text-red-600 mt-1">{discountError}</p>}
          </div>

          {/* Totals */}
          <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 pt-2 border-t border-gray-100 text-sm">
            <div>Subtotal (excl. VAT): <strong>{fmtIsk(subtotal)}</strong></div>
            {discountIsk > 0 && <div>Discount: <strong>−{fmtIsk(discountIsk)}</strong></div>}
            <div>VAT: <strong>{fmtIsk(vat)}</strong></div>
            <div className="text-base">Total: <strong className="text-emerald-700">{fmtIsk(total)}</strong></div>
          </div>
        </div>
      </section>

      {/* Full document preview — hashed by server + rendered to PDF */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Agreement &amp; terms</h2>
          <span className="text-xs text-gray-400">The binding contract is in Icelandic — this is exactly what will be signed.</span>
        </div>
        <div className="bg-white p-6 text-[12px] leading-relaxed text-gray-900 border border-gray-100 rounded-md">
          <div className="whitespace-pre-wrap font-serif text-[12px] leading-relaxed text-gray-900">{renderThjonustusamningur(agreementParams)}</div>
          <div className="my-4 text-center text-gray-400">— — —</div>
          <div className="whitespace-pre-wrap font-serif text-[12px] leading-relaxed text-gray-900">{renderThjonustuskilmalar()}</div>
          <div className="my-4 text-center text-gray-400">— — —</div>
          <div className="whitespace-pre-wrap font-serif text-[12px] leading-relaxed text-gray-900">{renderPurchaseOrder(poParams)}</div>

          {/* Signing block — stands out from the body with a card + dividers */}
          <div className="mt-8 pt-5 border-t-2 border-gray-300">
            <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-semibold mb-3">Rafræn undirritun</div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-[12.5px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Undirritun</div>
                <div className="font-semibold text-gray-900 border-b border-gray-300 pb-1 min-h-[22px]">
                  {signatoryName || <span className="text-gray-300">________________</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Starfsheiti</div>
                <div className="font-semibold text-gray-900 border-b border-gray-300 pb-1 min-h-[22px]">
                  {signatoryRole || <span className="text-gray-300">________________</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Netfang</div>
                <div className="font-medium text-gray-900 border-b border-gray-300 pb-1 min-h-[22px] break-all">
                  {signatoryEmail || <span className="text-gray-300">________________</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Dagsetning</div>
                <div className="font-medium text-gray-900 border-b border-gray-300 pb-1 min-h-[22px]">
                  {new Date().toLocaleDateString("is-IS", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
            </div>
            <p className="text-[10.5px] text-gray-500 mt-3 leading-relaxed">
              Rafræn undirritun þessi er skráð með tímastimpli, IP-tölu og vafraauðkenni undirritanda í þjónustukerfi Lifeline Health.
              Undirritunin er bindandi og jafngild rituðu undirritun, sbr. lög nr. 28/2001 um rafrænar undirskriftir.
            </p>
          </div>
        </div>
      </section>

      {/* Signatory + authority */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Signatory</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-gray-500">Full name
            <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" placeholder="Jón Jónsson" />
          </label>
          <label className="text-xs text-gray-500">Job title / role
            <input value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" placeholder="Managing director" />
          </label>
          <label className="text-xs text-gray-500">Email
            <input type="email" value={signatoryEmail} onChange={(e) => setSignatoryEmail(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" placeholder="jon@example.is" />
          </label>
        </div>
        <label className="flex items-start gap-2 pt-2">
          <input type="checkbox" checked={agreeChecked} onChange={(e) => setAgreeChecked(e.target.checked)} className="mt-1" />
          <span className="text-sm text-gray-700">
            I, <strong>{signatoryName || "[name]"}</strong>, confirm that I am authorized to bind <strong>{company.name}</strong>
            {companyKennitala ? <> (reg. no. {companyKennitala})</> : null} and I accept the service agreement, service terms and purchase order above.
            I also acknowledge that my IP address and browser fingerprint will be recorded as part of the signature.
          </span>
        </label>
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">{error}</div>}

      <div className="flex gap-3 justify-end">
        <button onClick={() => router.push(`/business/${companyId}`)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={sign}
          disabled={signing || !agreeChecked}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-semibold text-sm disabled:opacity-60 flex items-center gap-2"
        >
          {signing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {signing ? "Signing…" : "Sign & confirm order"}
        </button>
      </div>
    </div>
  );
}
