"use client";

import { useState } from "react";

// B2B proposal request form. Posts to /api/business/inquiries. Extracted from
// the business landing page so the CMS-driven BusinessView can render it inside
// the (reorderable) inquiry band. Behaviour is unchanged.
export default function InquiryForm() {
  const [companyName, setCompanyName] = useState("");
  const [kennitala, setKennitala] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [location, setLocation] = useState("");
  const [interest, setInterest] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const toggleInterest = (k: string) =>
    setInterest((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/business/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          kennitala,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          employee_count: employeeCount ? Number(employeeCount) : null,
          location,
          interest: Array.from(interest),
          message,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Could not submit. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Could not submit. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-8 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#10B981] to-[#3B82F6]" />
        <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#0F172A]">Thanks — we&apos;ve got it.</h3>
        <p className="text-sm text-[#475569] mt-2 leading-relaxed">
          A Lifeline team member will reach out within 2 working days at <span className="font-semibold text-[#0F172A]">{contactEmail}</span>. Watch your inbox — and check spam just in case.
        </p>
      </div>
    );
  }

  const interests = [
    { key: "foundational", label: "Foundational health assessment" },
    { key: "coaching", label: "Lifeline Health Coaching app" },
  ];

  return (
    <form onSubmit={submit} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm space-y-5">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] to-[#10B981]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-gray-700 mb-1">Company name <span className="text-red-500">*</span></span>
          <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="Your company" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Kennitala (optional)</span>
          <input type="text" value={kennitala} onChange={(e) => setKennitala(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="6 digits-4 digits" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Approx. employees</span>
          <input type="number" min={1} value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="e.g. 45" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Your name <span className="text-red-500">*</span></span>
          <input type="text" required value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Work email <span className="text-red-500">*</span></span>
          <input type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="you@company.is" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></span>
          <input type="tel" required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Location (office / city)</span>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="e.g. Reykjavík" />
        </label>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">What are you interested in?</span>
        <div className="flex flex-wrap gap-2">
          {interests.map((i) => {
            const selected = interest.has(i.key);
            return (
              <button key={i.key} type="button" onClick={() => toggleInterest(i.key)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"}`}>
                {i.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Anything we should know? (optional)</span>
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="Timing, priorities, questions — anything helpful for the proposal." />
      </label>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <button type="submit" disabled={status === "submitting"} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981] text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:opacity-95 disabled:opacity-60">
        {status === "submitting" ? "Sending…" : "Send inquiry"}
        {status !== "submitting" && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        )}
      </button>
      <p className="text-xs text-[#64748B] text-center">
        By submitting you agree to be contacted by Lifeline Health about your inquiry. We never share your details with third parties.
      </p>
    </form>
  );
}
