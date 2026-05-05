"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import DoctorsTeam from "@/app/components/DoctorsTeam";

export default function CompanyWelcomePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("clients_decrypted")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.full_name) setFirstName(profile.full_name.split(" ")[0]);

      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .maybeSingle();
      if (company?.name) setCompanyName(company.name);
    })();
  }, [companyId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Hero greeting */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t("b2b.contact_welcome.badge", "Account created")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {firstName
              ? t("b2b.contact_welcome.title_name", "Welcome, {{name}}.").replace("{{name}}", firstName)
              : t("b2b.contact_welcome.title", "Welcome to Lifeline Health.")}
          </h1>
          {companyName && (
            <p className="text-lg text-gray-500">
              {t("b2b.contact_welcome.company_line", "We're excited to partner with {{company}} on employee health.").replace("{{company}}", companyName)}
            </p>
          )}
        </div>

        {/* Healthcare team */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">{t("b2b.contact_welcome.care", "With care,")}</p>
            <p className="text-base text-gray-800 leading-relaxed">
              {t("b2b.contact_welcome.note", "Læknarnir á bak við Lifeline — allir með starfsleyfi frá Embætti landlæknis.")}
            </p>
          </div>
          <DoctorsTeam compact />
        </div>

        {/* What's next */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t("b2b.contact_welcome.next_heading", "What happens next")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "👥", title: t("b2b.contact_welcome.step1_title", "Add employees"), body: t("b2b.contact_welcome.step1_body", "Upload your roster or invite team members by email.") },
              { icon: "📅", title: t("b2b.contact_welcome.step2_title", "Schedule assessments"), body: t("b2b.contact_welcome.step2_body", "Pick dates for measurements (blood pressure + body composition) and blood tests.") },
              { icon: "✍️", title: t("b2b.contact_welcome.step3_title", "Sign & invoice"), body: t("b2b.contact_welcome.step3_body", "Review the service agreement, sign, and we'll handle billing.") },
            ].map((step, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="text-2xl">{step.icon}</div>
                <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => router.push(`/business/${companyId}`)}
            className="px-8 py-3 bg-[#10B981] text-white font-semibold rounded-xl hover:bg-[#047857] transition-colors text-base"
          >
            {t("b2b.contact_welcome.cta", "Go to company dashboard")}
          </button>
        </div>
      </div>
    </div>
  );
}
