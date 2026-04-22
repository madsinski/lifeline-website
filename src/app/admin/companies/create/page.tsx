"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const ktDigits = kennitala.replace(/\D/g, "");
  const ktValid = ktDigits.length === 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr("Nafn fyrirtækis vantar."); return; }
    if (!ktValid) { setErr("Kennitala verður að vera 10 tölustafir."); return; }
    if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim())) {
      setErr("Ógilt netfang tengiliðs."); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/companies/create-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { setErr(j?.detail || j?.error || "Stofnun mistókst."); return; }
      router.push(`/admin/companies/${j.company.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <div className="text-xs text-gray-500 mb-1">
          <Link href="/admin/companies" className="hover:underline">Fyrirtæki</Link> · Stofna drög
        </div>
        <h1 className="text-2xl font-semibold text-[#1F2937]">Stofna fyrirtæki (drög)</h1>
        <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
          Stofnar fyrirtæki sem Lifeline-teymið hefur unnið með áður, án þess að tengiliður þurfi strax að klára skráninguna.
          Þegar þið eruð tilbúin að fá tengiliðinn formlega inn, sendið þið boðspóst af fyrirtækisíðunni — þar skrifar tengiliðurinn undir
          þjónustuskilmála og gagnavinnslusamning og fyrirtækið fer úr <em>drögum</em> í <em>virkt</em>.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Fyrirtæki</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nafn fyrirtækis" required>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Kennitala" required>
              <input
                type="text" inputMode="numeric" maxLength={11}
                value={kennitala} onChange={(e) => setKennitala(e.target.value)}
                placeholder="5705692039"
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${kennitala && !ktValid ? "border-red-300" : "border-gray-200"}`}
                required
              />
              {kennitala && !ktValid && <p className="text-[11px] text-red-600 mt-1">10 tölustafir.</p>}
            </Field>
            <Field label="Heimilisfang">
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Símanúmer fyrirtækis">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Þjónustustig</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Sjálfvalið stig">
              <select value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Ekki valið enn</option>
                <option value="standard">Standard</option>
                <option value="plus">Plus</option>
                <option value="custom">Sérsamið</option>
              </select>
            </Field>
            <Field label="Verð á starfsmann (ISK)">
              <input
                type="number" inputMode="numeric" min={0} step={100}
                value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="t.d. 24900"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums"
              />
              <p className="text-[11px] text-gray-500 mt-1">Notað við reikningagerð. Er hægt að breyta síðar.</p>
            </Field>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Tengiliður (drög)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Upplýsingar eru geymdar þar til þið smellið á <em>Senda boð</em> á fyrirtækisíðunni. Þá fær tengiliðurinn boðspóst
              og skrifar undir þjónustuskilmála og gagnavinnslusamning.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fullt nafn tengiliðs">
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Starfsheiti">
              <input type="text" value={contactRole} onChange={(e) => setContactRole(e.target.value)}
                placeholder="t.d. Mannauðsstjóri"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Netfang">
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Sími">
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Athugasemdir (innanhúss)</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
            placeholder="Samningasaga, tengingar, sérmál o.s.frv."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </section>

        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

        <div className="flex items-center justify-between gap-3">
          <Link href="/admin/companies" className="text-sm text-gray-600 hover:underline">Hætta við</Link>
          <button type="submit" disabled={submitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50">
            {submitting ? "Stofnar…" : "Stofna drög"}
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
