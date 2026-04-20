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

interface CompanyRow {
  id: string;
  name: string;
  contact_person_id: string;
  agreement_signed_at: string | null;
  kennitala_last4?: string | null;
}

// Default package pricing — staff/contact person can edit before signing.
const DEFAULT_LINE_ITEMS: PurchaseOrderLineItem[] = [
  { description: "Heilsumat starfsmanns (Foundational Health Assessment)", qty: 1, unit_price_isk: 49900, total_isk: 49900 },
];

function fmtIsk(n: number): string {
  return n.toLocaleString("is-IS") + " kr";
}

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

  // Purchase order state
  const [lineItems, setLineItems] = useState<PurchaseOrderLineItem[]>(DEFAULT_LINE_ITEMS);
  const [billingCadence, setBillingCadence] = useState<string>("one_time");
  const [startsAt, setStartsAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState<string>("");
  const [vatRate, setVatRate] = useState<number>(0); // heilbrigðisþjónusta er vsk-frjáls

  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);

  const docRef = useRef<HTMLDivElement>(null);

  const subtotal = useMemo(
    () => lineItems.reduce((s, li) => s + (li.qty * li.unit_price_isk), 0),
    [lineItems],
  );
  const vat = Math.round(subtotal * (vatRate / 100));
  const total = subtotal + vat;

  const loadCompany = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error: e } = await supabase
      .from("companies")
      .select("id, name, contact_person_id, agreement_signed_at")
      .eq("id", companyId)
      .maybeSingle();
    if (e || !data) {
      setError("Fyrirtæki fannst ekki eða þú hefur ekki aðgang.");
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

  const updateLineItem = (idx: number, patch: Partial<PurchaseOrderLineItem>) => {
    setLineItems((prev) => prev.map((li, i) => {
      if (i !== idx) return li;
      const next = { ...li, ...patch };
      next.total_isk = next.qty * next.unit_price_isk;
      return next;
    }));
  };

  const addLine = () => setLineItems((p) => [...p, { description: "", qty: 1, unit_price_isk: 0, total_isk: 0 }]);
  const removeLine = (idx: number) => setLineItems((p) => p.filter((_, i) => i !== idx));

  const sign = async () => {
    setError("");
    if (!company) return;
    if (!signatoryName.trim() || !signatoryRole.trim() || !signatoryEmail.trim()) {
      setError("Fylltu inn nafn, starfsheiti og netfang.");
      return;
    }
    if (!agreeChecked) {
      setError("Þú verður að staðfesta að þú hafir heimild til að binda félagið.");
      return;
    }
    if (lineItems.some((li) => !li.description.trim() || li.qty <= 0 || li.unit_price_isk < 0)) {
      setError("Öll pöntunaratriði verða að hafa lýsingu, jákvæðan fjölda og verð.");
      return;
    }

    setSigning(true);
    try {
      // Load jspdf + html2canvas dynamically so this page doesn't pay their
      // weight on first paint.
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      if (!docRef.current) {
        setError("Skjal ekki tilbúið.");
        setSigning(false);
        return;
      }

      const canvas = await html2canvas(docRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 36;
      const contentWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      // Paginate — slice the tall image across A4 pages.
      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      const pdfBase64 = pdf.output("datauristring").split(",")[1];

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/business/companies/${companyId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          signatory_name: signatoryName.trim(),
          signatory_role: signatoryRole.trim(),
          signatory_email: signatoryEmail.trim().toLowerCase(),
          terms_hash: "", // server re-computes authoritatively
          line_items: lineItems,
          subtotal_isk: subtotal,
          vat_isk: vat,
          total_isk: total,
          billing_cadence: billingCadence,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
          pdf_base64: pdfBase64,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(`Villa: ${j.detail || j.error || "unknown"}`);
        setSigning(false);
        return;
      }
      setDone(true);
    } catch (e) {
      setError(`Villa: ${(e as Error).message}`);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto py-16 text-center text-gray-500">Hleð…</div>;
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Samningur undirritaður</h1>
        <p className="text-gray-600 mb-6">Afrit hefur verið sent á netfang undirritanda og á Lifeline teymið.</p>
        <button
          onClick={() => router.push(`/business/${companyId}`)}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-semibold"
        >
          Til baka í fyrirtækisgátt
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
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Þjónustusamningur og innkaupapöntun</h1>
        <p className="text-sm text-gray-500 mt-1">
          Yfirfarðu samninginn og fylltu út innkaupapöntun. Undirritun er rafræn og bindandi.
        </p>
      </header>

      {/* Purchase order editor */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Innkaupapöntun</h2>

        <div className="space-y-2">
          {lineItems.map((li, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-6 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                placeholder="Lýsing (t.d. Heilsumat starfsmanns)"
                value={li.description}
                onChange={(e) => updateLineItem(idx, { description: e.target.value })}
              />
              <input
                type="number" min={1}
                className="col-span-1 px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                value={li.qty}
                onChange={(e) => updateLineItem(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
              />
              <input
                type="number" min={0}
                className="col-span-3 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                placeholder="Einingaverð (kr)"
                value={li.unit_price_isk}
                onChange={(e) => updateLineItem(idx, { unit_price_isk: Math.max(0, parseInt(e.target.value) || 0) })}
              />
              <div className="col-span-1 text-right text-sm text-gray-700">{fmtIsk(li.total_isk)}</div>
              <button onClick={() => removeLine(idx)} className="col-span-1 text-red-500 text-xs hover:underline disabled:opacity-30" disabled={lineItems.length <= 1}>
                Eyða
              </button>
            </div>
          ))}
          <button onClick={addLine} className="text-sm font-medium text-emerald-600 hover:underline">+ Bæta við pöntunaratriði</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          <label className="text-xs text-gray-500">Greiðslufyrirkomulag
            <select value={billingCadence} onChange={(e) => setBillingCadence(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
              <option value="one_time">Eingreiðsla</option>
              <option value="monthly">Mánaðarlega</option>
              <option value="quarterly">Ársfjórðungslega</option>
              <option value="yearly">Árlega</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">Gildir frá
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
          <label className="text-xs text-gray-500">Gildir til
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
          <label className="text-xs text-gray-500">Vsk. %
            <input type="number" min={0} max={24} value={vatRate} onChange={(e) => setVatRate(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
            <span className="text-[10px] text-gray-400">Heilbrigðisþjónusta er vsk-frjáls (lög nr. 50/1988)</span>
          </label>
        </div>

        <div className="flex justify-end gap-6 pt-2 border-t border-gray-100 text-sm">
          <div>Samtals án vsk.: <strong>{fmtIsk(subtotal)}</strong></div>
          <div>Vsk.: <strong>{fmtIsk(vat)}</strong></div>
          <div className="text-base">Heildar: <strong className="text-emerald-700">{fmtIsk(total)}</strong></div>
        </div>
      </section>

      {/* Full document preview — hashed by server + rendered to PDF */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Samningur og skilmálar</h2>
          <span className="text-xs text-gray-400">Þetta er nákvæmlega það sem verður undirritað.</span>
        </div>
        <div ref={docRef} className="bg-white p-6 max-h-[500px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-gray-900 border border-gray-100 rounded-md font-serif">
{renderThjonustusamningur(agreementParams)}

— — —

{renderThjonustuskilmalar()}

— — —

{renderPurchaseOrder(poParams)}

— — —

Undirritun: {signatoryName || "________________"}
Starfsheiti: {signatoryRole || "________________"}
Netfang: {signatoryEmail || "________________"}
Dagsetning: {new Date().toLocaleDateString("is-IS")}
        </div>
      </section>

      {/* Signatory + authority */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Undirritandi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-gray-500">Fullt nafn
            <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" placeholder="Jón Jónsson" />
          </label>
          <label className="text-xs text-gray-500">Starfsheiti / staða
            <input value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" placeholder="Framkvæmdastjóri" />
          </label>
          <label className="text-xs text-gray-500">Netfang
            <input type="email" value={signatoryEmail} onChange={(e) => setSignatoryEmail(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" placeholder="jon@example.is" />
          </label>
        </div>
        <label className="flex items-start gap-2 pt-2">
          <input type="checkbox" checked={agreeChecked} onChange={(e) => setAgreeChecked(e.target.checked)} className="mt-1" />
          <span className="text-sm text-gray-700">
            Ég, <strong>{signatoryName || "[nafn]"}</strong>, staðfesti að ég hef heimild til að binda <strong>{company.name}</strong>
            {companyKennitala ? <> (kt. {companyKennitala})</> : null} og samþykki framangreindan þjónustusamning, þjónustuskilmála og innkaupapöntun.
            Ég staðfesti jafnframt að IP-tala og vafraauðkenni verða skráð sem hluti af undirritun.
          </span>
        </label>
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">{error}</div>}

      <div className="flex gap-3 justify-end">
        <button onClick={() => router.push(`/business/${companyId}`)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50">
          Hætta við
        </button>
        <button
          onClick={sign}
          disabled={signing || !agreeChecked}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-semibold text-sm disabled:opacity-60 flex items-center gap-2"
        >
          {signing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {signing ? "Undirrita…" : "Undirrita og staðfesta pöntun"}
        </button>
      </div>
    </div>
  );
}
