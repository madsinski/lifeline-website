"use client";

import { useMemo, useState } from "react";
import CtaLink from "@/app/components/CtaLink";
import { useI18n } from "@/lib/i18n";
import { resolveContent } from "@/lib/site-content/registry";
import type { Locale, LocaleContent, SiteContentBlob } from "@/lib/site-content/types";

export interface ContactViewProps {
  c?: LocaleContent;
  locale?: Locale;
  /** Published blob loaded on the server (SSR), so no flash of defaults. */
  initialBlob?: SiteContentBlob | null;
}

export default function ContactView(props: ContactViewProps) {
  const { locale: i18nLocale } = useI18n();
  const controlled = props.c !== undefined;

  const blob = props.initialBlob ?? null;

  const locale: Locale = controlled ? props.locale ?? "is" : i18nLocale;
  const c = useMemo(() => (controlled ? props.c! : resolveContent("contact", blob, locale)), [controlled, props.c, blob, locale]);

  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "", company: "" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error || "Could not send your message. Please try again."); return; }
      setSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "", company: "" });
    } catch {
      setError("Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all duration-200 text-[#1F2937] placeholder:text-[#6B7280]/60";

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-24 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1F2937] tracking-tight">{c.hero_title}</h1>
            <p className="mt-6 text-lg text-[#6B7280]">{c.hero_subtitle}</p>
          </div>
        </div>
      </section>

      {/* Form + info */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Form */}
            <div>
              <h2 className="text-2xl font-bold text-[#1F2937] mb-6">{c.form_title}</h2>
              {submitted ? (
                <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-4 success-checkmark">
                    <svg className="w-8 h-8 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">{c.form_success_title}</h3>
                  <p className="text-sm text-[#6B7280] mb-6">{c.form_success_desc}</p>
                  <button onClick={() => setSubmitted(false)} className="text-sm font-medium text-[#10B981] hover:text-[#047857] transition-colors duration-200">{c.form_send_another}</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-[#1F2937] mb-2">{c.form_name_label}</label>
                    <input type="text" id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} placeholder={c.form_name_ph} required />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-[#1F2937] mb-2">{c.form_email_label}</label>
                    <input type="email" id="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} placeholder={c.form_email_ph} required />
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-[#1F2937] mb-2">{c.form_subject_label}</label>
                    <input type="text" id="subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className={inputCls} placeholder={c.form_subject_ph} required />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-[#1F2937] mb-2">{c.form_message_label}</label>
                    <textarea id="message" rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-[#e6ecf4] border-2 border-transparent focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all duration-200 text-[#1F2937] placeholder:text-[#6B7280]/60 resize-none" placeholder={c.form_message_ph} required />
                  </div>
                  <div aria-hidden className="hidden">
                    <label htmlFor="company">Company</label>
                    <input type="text" id="company" tabIndex={-1} autoComplete="off" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
                  <button type="submit" disabled={sending} className="w-full sm:w-auto px-8 py-3.5 bg-[#10B981] text-white font-semibold rounded-full hover:bg-[#047857] transition-all duration-200 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 disabled:opacity-60 disabled:cursor-not-allowed">
                    {sending ? "…" : c.form_submit}
                  </button>
                </form>
              )}
            </div>

            {/* Info */}
            <div>
              <h2 className="text-2xl font-bold text-[#1F2937] mb-6">{c.info_title}</h2>
              <div className="space-y-4">
                <div className="bg-[#f5f7fa] rounded-xl p-5 flex items-start gap-4 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0" style={{ border: "2px solid rgba(59,130,246,0.15)" }}>
                    <svg className="w-6 h-6 text-[#3B82F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1F2937]">{c.info_email_label}</h3>
                    <a href={`mailto:${c.info_email_value}`} className="text-[#6B7280] hover:text-[#3B82F6] transition-colors duration-200">{c.info_email_value}</a>
                  </div>
                </div>

                <div className="bg-[#f5f7fa] rounded-xl p-5 flex items-start gap-4 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center flex-shrink-0" style={{ border: "2px solid rgba(139,92,246,0.15)" }}>
                    <svg className="w-6 h-6 text-[#8B5CF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1F2937]">{c.info_address_label}</h3>
                    <p className="text-[#6B7280] whitespace-pre-line">{c.info_address_value}</p>
                  </div>
                </div>

                <div className="bg-[#f5f7fa] rounded-xl p-5 flex items-start gap-4 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center flex-shrink-0" style={{ border: "2px solid rgba(32,200,88,0.15)" }}>
                    <svg className="w-6 h-6 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1F2937]">{c.info_hours_label}</h3>
                    <p className="text-[#6B7280]">{c.info_hours_value}</p>
                  </div>
                </div>
              </div>

              {/* Sign in for existing clients */}
              <div className="mt-8 bg-[#f5f7fa] rounded-xl p-6 shadow-sm border border-[#10B981]/15">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center flex-shrink-0" style={{ border: "2px solid rgba(32,200,88,0.15)" }}>
                    <svg className="w-6 h-6 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#1F2937] mb-1">{c.account_title}</h3>
                    <p className="text-sm text-[#6B7280] mb-4">{c.account_desc}</p>
                    <CtaLink href={c.account_cta_href || "/account/login"} className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-[#10B981] rounded-full hover:bg-[#047857] transition-all duration-200 shadow-md shadow-green-500/25 w-full sm:w-auto">{c.account_cta}</CtaLink>
                  </div>
                </div>
              </div>

              {/* Map placeholder */}
              <div className="mt-6 bg-gradient-to-br from-[#e6ecf4] to-[#dce3ee] rounded-2xl aspect-[4/3] flex items-center justify-center relative overflow-hidden shadow-sm">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-[20%] left-[30%] w-32 h-0.5 bg-[#6B7280] rotate-12" />
                  <div className="absolute top-[40%] left-[20%] w-48 h-0.5 bg-[#6B7280] -rotate-6" />
                  <div className="absolute top-[60%] left-[40%] w-24 h-0.5 bg-[#6B7280] rotate-45" />
                  <div className="absolute top-[30%] right-[25%] w-36 h-0.5 bg-[#6B7280] rotate-[30deg]" />
                  <div className="absolute bottom-[30%] left-[35%] w-40 h-0.5 bg-[#6B7280] -rotate-12" />
                </div>
                <div className="text-center relative z-10">
                  <div className="w-12 h-12 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-3">
                    <div className="w-8 h-8 rounded-full bg-[#10B981]/40 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-[#10B981] shadow-lg shadow-green-500/50" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[#1F2937]">Lagmula 5, 108 Reykjavik</p>
                  <p className="text-xs text-[#6B7280] mt-1">Lifeline Health</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
