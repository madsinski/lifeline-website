"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Admin-only draft company creator. Fills in the info we'd normally
// collect during the self-serve B2B signup, minus the contact person's
// auth account (that comes later via the claim-token email). Once
// created, the draft appears in /admin/companies and in the Biody
// bulk-create dropdown so patients can be attached to it immediately.

export default function AdminCompanyCreatePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [kennitala, setKennitala] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [tier, setTier] = useState<"" | "standard" | "plus" | "custom">("");
  const [unitPrice, setUnitPrice] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRole, setContactRole] = useState("");

  // Parent municipality (optional). When set, this row becomes a sub-company
  // and billing rolls up to the parent.
  const [parentId, setParentId] = useState("");
  const [parents, setParents] = useState<Array<{ id: string; name: string }>>([]);

  // Billing contact — only used when this is a top-level company.
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingRole, setBillingRole] = useState("");
  const [billingAddress, setBillingAddress] = useState("");

  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      // Only top-level companies can be picked as parents (no grandparents).
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .is("parent_company_id", null)
        .neq("status", "archived")
        .order("name", { ascending: true });
      setParents((data as Array<{ id: string; name: string }>) || []);
    })();
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const ktDigits = kennitala.replace(/\D/g, "");
  const ktProvided = ktDigits.length > 0;
  const ktValid = !ktProvided || ktDigits.length === 10;
  const ktRequired = !parentId; // only top-level companies must provide one

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr("Company name is required."); return; }
    if (ktRequired && ktDigits.length !== 10) { setErr("Kennitala must be 10 digits for a top-level company."); return; }
    if (!ktValid) { setErr("Kennitala must be 10 digits if entered."); return; }
    if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim())) {
      setErr("Invalid contact email."); return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/admin/companies/create-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          kennitala: ktDigits,
          company_address: address.trim() || null,
          company_phone: phone.trim() || null,
          default_tier: tier || null,
          assessment_unit_price: unitPrice ? Math.max(0, parseInt(unitPrice, 10) || 0) : null,
          contact_draft_name: contactName.trim() || null,
          contact_draft_email: contactEmail.trim() || null,
          contact_draft_phone: contactPhone.trim() || null,
          contact_draft_role: contactRole.trim() || null,
          admin_notes: notes.trim() || null,
          parent_company_id: parentId || null,
          billing_contact_name: parentId ? null : (billingName.trim() || null),
          billing_contact_email: parentId ? null : (billingEmail.trim() || null),
          billing_contact_phone: parentId ? null : (billingPhone.trim() || null),
          billing_contact_role: parentId ? null : (billingRole.trim() || null),
          billing_address: parentId ? null : (billingAddress.trim() || null),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { setErr(j?.detail || j?.error || "Creation failed."); return; }
      // No per-company detail route exists yet — send the admin back to
      // the list where they can invite the contact, attach documents
      // and send the TOS/DPA claim.
      router.push("/admin/companies");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <Link href="/admin/companies" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-emerald-700 mb-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to companies
        </Link>
        <h1 className="text-2xl font-semibold text-[#1F2937]">Create company (draft)</h1>
        <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
          Create a company the Lifeline team has worked with, without the company admin having to finish registration right away.
          When you&apos;re ready to bring the admin in, send the invite from the company page — they sign the terms of service and
          data-processing agreement and the company moves from <em>draft</em> to <em>active</em>.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Company</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company name" required>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Kennitala" required={ktRequired}>
              <input
                type="text" inputMode="numeric" maxLength={11}
                value={kennitala} onChange={(e) => setKennitala(e.target.value)}
                placeholder={ktRequired ? "5705692039" : "(inherited from parent)"}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${kennitala && !ktValid ? "border-red-300" : "border-gray-200"}`}
              />
              {kennitala && !ktValid ? (
                <p className="text-[11px] text-red-600 mt-1">10 digits.</p>
              ) : !ktRequired ? (
                <p className="text-[11px] text-gray-500 mt-1">Not required — a division uses the parent company&apos;s kennitala for invoicing.</p>
              ) : null}
            </Field>
            <Field label="Address">
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Company phone">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Service tier</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Default tier">
              <select value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Not set yet</option>
                <option value="standard">Standard</option>
                <option value="plus">Plus</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Price per employee (ISK)">
              <input
                type="number" inputMode="numeric" min={0} step={100}
                value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="e.g. 24900"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums"
              />
              <p className="text-[11px] text-gray-500 mt-1">Used for invoicing. Can be changed later.</p>
            </Field>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Municipality or parent company (optional)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              If this company is a division (e.g. a school under a municipality), pick its parent company.
              Invoices roll up to the parent and the legal signature (terms of service + DPA) applies there.
            </p>
          </div>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">— Top level (standalone / parent) —</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {parentId && (
            <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900">
              Division selected. Invoicing and the signed agreement roll up to the parent company automatically — you don&apos;t need to enter a billing contact here.
            </div>
          )}
        </section>

        {!parentId && (
          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Billing contact</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                The person who handles invoices for the company (and its divisions, if any).
                Used as the email on PayDay invoices. Leave blank if it&apos;s the same as the company admin below.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Billing contact name">
                <input type="text" value={billingName} onChange={(e) => setBillingName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </Field>
              <Field label="Title">
                <input type="text" value={billingRole} onChange={(e) => setBillingRole(e.target.value)}
                  placeholder="e.g. CFO"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </Field>
              <Field label="Email">
                <input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </Field>
              <Field label="Phone">
                <input type="tel" value={billingPhone} onChange={(e) => setBillingPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Billing address">
                  <input type="text" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="If different from the address above"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </Field>
              </div>
            </div>
          </section>
        )}

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Company admin (draft)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Saved until you click <em>Invite company admin</em> on the company page. The admin then gets an invite email
              and signs the terms of service and data-processing agreement.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name">
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Title">
              <input type="text" value={contactRole} onChange={(e) => setContactRole(e.target.value)}
                placeholder="e.g. HR Manager"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Email">
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Phone">
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Notes (internal)</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
            placeholder="Deal history, contacts, special cases, etc."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </section>

        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

        <div className="flex items-center justify-between gap-3">
          <Link href="/admin/companies" className="text-sm text-gray-600 hover:underline">Cancel</Link>
          <button type="submit" disabled={submitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? "Creating…" : "Create draft"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
