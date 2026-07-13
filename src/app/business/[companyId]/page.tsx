"use client";

import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BusinessHeader from "../BusinessHeader";
import { parseRoster, RosterRow } from "@/lib/parse-roster";
import { formatKennitala } from "@/lib/kennitala";
import ScheduleBodyComp, { type EditableEvent } from "./ScheduleBodyComp";
import ScheduleBloodTests from "./ScheduleBloodTests";
import ScheduleLecture, { type EditableLecture } from "./ScheduleLecture";
import DoctorInterviews from "./DoctorInterviews";

interface Company {
  id: string;
  name: string;
  agreement_version: string;
  created_at: string;
  roster_confirmed_at: string | null;
  registration_finalized_at: string | null;
  agreement_signed_at: string | null;
  last_round_completed_at: string | null;
  current_round_id: string | null;
  contact_phone: string | null;
  contact_position: string | null;
  contact_draft_name: string | null;
  contact_draft_email: string | null;
  contact_draft_phone: string | null;
}

interface AssessmentRound {
  id: string;
  round_number: number;
  package: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Member {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  kennitala_last4: string | null;
  invited_at: string | null;
  invite_sent_count: number;
  completed_at: string | null;
  profile_complete: boolean | null;
  biody_activated: boolean | null;
  created_at: string;
}

interface BodyCompEvent {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  room_notes: string | null;
  break_start: string | null;
  break_end: string | null;
  slot_minutes: number;
  slot_capacity: number;
  status: string;
  approval_status: string;
}

interface BloodDay {
  id: string;
  day: string;
  notes: string | null;
}

interface IntroLecture {
  id: string;
  lecture_date: string;
  start_time: string;
  end_time: string;
  mode: "onsite" | "video";
  location: string | null;
  room_notes: string | null;
  approval_status: string;
}

interface Admin {
  user_id: string;
  full_name: string | null;
  email: string | null;
  added_at: string;
  is_primary: boolean;
  phone: string | null;
  position: string | null;
  kennitala_last4: string | null;
}

export default function BusinessDashboardPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params?.companyId;

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<BodyCompEvent[]>([]);
  const [bloodDays, setBloodDays] = useState<BloodDay[]>([]);
  const [signedDocs, setSignedDocs] = useState<{
    id: string;
    signed_at: string;
    signatory_name: string;
    signatory_role: string;
    pdf_storage_path: string | null;
    po_number: string | null;
    total_isk: number | null;
  }[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewerIsStaff, setViewerIsStaff] = useState(false);
  const [rounds, setRounds] = useState<AssessmentRound[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [poEmployeeCount, setPoEmployeeCount] = useState<number | null>(null);
  const [startingRound, setStartingRound] = useState(false);
  const [error, setError] = useState("");
  const [addMode, setAddMode] = useState<"none" | "single" | "import">("none");
  const [introLectures, setIntroLectures] = useState<IntroLecture[]>([]);
  const [showSchedBC, setShowSchedBC] = useState(false);
  const [editBcEvent, setEditBcEvent] = useState<EditableEvent | null>(null);
  const [deletingBcId, setDeletingBcId] = useState<string | null>(null);
  const [showSchedBlood, setShowSchedBlood] = useState(false);
  const [showSchedLecture, setShowSchedLecture] = useState(false);
  const [editLecture, setEditLecture] = useState<EditableLecture | null>(null);
  const [deletingLectureId, setDeletingLectureId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: c }, { data: m }, { data: ev }, { data: bd }, { data: ag }, { data: po }, { data: il }] = await Promise.all([
      supabase.from("companies").select("id, name, agreement_version, created_at, roster_confirmed_at, registration_finalized_at, agreement_signed_at, last_round_completed_at, current_round_id, contact_phone, contact_position, contact_draft_name, contact_draft_email, contact_draft_phone").eq("id", companyId).maybeSingle(),
      supabase.rpc("list_company_members", { p_company_id: companyId }),
      supabase.from("body_comp_events")
        .select("id, event_date, start_time, end_time, location, room_notes, break_start, break_end, slot_minutes, slot_capacity, status, approval_status")
        .eq("company_id", companyId).gte("event_date", today).order("event_date"),
      supabase.from("blood_test_days")
        .select("id, day, notes")
        .eq("company_id", companyId).gte("day", today).order("day"),
      supabase.from("b2b_agreements")
        .select("id, signed_at, signatory_name, signatory_role, pdf_storage_path")
        .eq("company_id", companyId).order("signed_at", { ascending: false }),
      supabase.from("b2b_purchase_orders")
        .select("agreement_id, po_number, total_isk, line_items")
        .eq("company_id", companyId),
      supabase.from("intro_lectures")
        .select("id, lecture_date, start_time, end_time, mode, location, room_notes, approval_status")
        .eq("company_id", companyId).gte("lecture_date", today).order("lecture_date"),
    ]);
    if (!c) {
      setError("Company not found or you don't have access.");
      setLoading(false);
      return;
    }
    setCompany(c as Company);
    setMembers((m || []) as Member[]);
    setEvents((ev || []) as BodyCompEvent[]);
    setBloodDays((bd || []) as BloodDay[]);
    setIntroLectures((il || []) as IntroLecture[]);

    const poMap = new Map<string, { po_number: string; total_isk: number }>();
    for (const row of (po ?? []) as { agreement_id: string; po_number: string; total_isk: number }[]) {
      poMap.set(row.agreement_id, row);
    }
    setSignedDocs(((ag ?? []) as { id: string; signed_at: string; signatory_name: string; signatory_role: string; pdf_storage_path: string | null }[])
      .map((a) => ({
        ...a,
        po_number: poMap.get(a.id)?.po_number ?? null,
        total_isk: poMap.get(a.id)?.total_isk ?? null,
      })));

    // Headcount purchased on the signed purchase order — the target for the
    // step-2 roster counter. Derived from the assessment line item.
    const posWithItems = (po ?? []) as { line_items?: { description: string; qty: number }[] | null }[];
    const firstWithItems = posWithItems.find((p) => Array.isArray(p.line_items) && p.line_items.length > 0);
    setPoEmployeeCount(deriveEmployeeCount(firstWithItems?.line_items ?? null));

    // Fetch assessment rounds
    const { data: roundsData } = await supabase
      .from("assessment_rounds")
      .select("id, round_number, package, status, started_at, completed_at")
      .eq("company_id", companyId)
      .order("round_number", { ascending: false });
    setRounds((roundsData || []) as AssessmentRound[]);

    setLoading(false);
  }, [companyId]);

  const loadAdmins = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase.rpc("list_company_admins", { p_company_id: companyId });
    setAdmins((data || []) as Admin[]);
  }, [companyId]);

  const deleteBcEvent = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Remove this measurement day?")) return;
    setDeletingBcId(id);
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token;
      const res = await fetch(`/api/business/events/${id}`, {
        method: "DELETE",
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Could not remove: ${j.error || res.status}`);
        return;
      }
      await loadData();
    } finally {
      setDeletingBcId(null);
    }
  };

  const deleteLecture = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Remove this lecture time?")) return;
    setDeletingLectureId(id);
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token;
      const res = await fetch(`/api/business/intro-lectures/${id}`, {
        method: "DELETE",
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Could not remove: ${j.error || res.status}`);
        return;
      }
      await loadData();
    } finally {
      setDeletingLectureId(null);
    }
  };

  const startNewRound = async (pkg: string) => {
    setStartingRound(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      const res = await fetch(`/api/business/companies/${companyId}/start-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ package: pkg }),
      });
      const j = await res.json();
      if (!res.ok) { alert(`Failed: ${j.error || "unknown"}`); return; }
      loadData();
    } catch { alert("Failed to start round"); }
    setStartingRound(false);
  };

  const downloadSignedPdf = async (agreementId: string, storagePath: string | null) => {
    if (!storagePath) {
      alert("PDF fannst ekki. Hafðu samband við Lifeline teymið.");
      return;
    }
    setDownloadingId(agreementId);
    try {
      const { data, error: sErr } = await supabase.storage
        .from("b2b-signed-documents")
        .createSignedUrl(storagePath, 300);
      if (sErr || !data?.signedUrl) {
        alert(`Gat ekki búið til niðurhalstengil: ${sErr?.message || "óþekkt villa"}`);
        return;
      }
      window.open(data.signedUrl, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/business/signup");
        return;
      }
      const { data: staffRow } = await supabase
        .from("staff").select("id, active").eq("id", data.user.id).maybeSingle();
      setViewerIsStaff(!!staffRow && staffRow.active === true);
      loadData();
      loadAdmins();
    });
  }, [loadData, loadAdmins, router]);

  const exportCsv = async () => {
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/admin/companies/${companyId}/export`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!res.ok) { alert("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(company?.name || "company").replace(/[^a-z0-9]+/gi, "-")}-roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }
  if (error || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        {error || "Company not found"}
      </div>
    );
  }

  const totalInvited = members.filter((m) => m.invited_at).length;
  const totalCompleted = members.filter((m) => m.completed_at).length;
  const staleIds = members
    .filter((m) => !m.completed_at && !!m.invited_at && Date.now() - new Date(m.invited_at).getTime() > 3 * 86_400_000)
    .map((m) => m.id);
  const uninvitedIds = members.filter((m) => !m.completed_at && !m.invited_at).map((m) => m.id);

  const rosterConfirmed = !!company.roster_confirmed_at;
  const finalized = !!company.registration_finalized_at;
  const hasEvents = events.length > 0;
  const hasBloodDays = bloodDays.length > 0;
  const hasIntroLecture = introLectures.length > 0;
  const hasCoAdmin = admins.some((a) => !a.is_primary);
  const agreementSigned = !!company.agreement_signed_at;
  const rosterDone = rosterConfirmed;
  // Step order: sign the service agreement + purchase order FIRST, so the
  // platform-agreement gate is satisfied before any employee invites go out
  // (otherwise the invite API rejects the batch with "agreement_not_signed").
  // Then roster, the introduction lecture, the measurement day, and blood days.
  // Step 2 (co-admin) is OPTIONAL: it ticks green when a co-admin is invited but
  // never blocks finalize, so it's excluded from allStepsDone and skipped by
  // nextStep. It still counts toward the 6-step progress display.
  const stepsDone = [agreementSigned, hasCoAdmin, rosterDone, hasIntroLecture, hasEvents, hasBloodDays].filter(Boolean).length;
  const allStepsDone = agreementSigned && rosterDone && hasIntroLecture && hasEvents && hasBloodDays;
  const nextStep = !agreementSigned ? 1 : !rosterDone ? 3 : !hasIntroLecture ? 4 : !hasEvents ? 5 : !hasBloodDays ? 6 : 0;

  const confirmRoster = async () => {
    if (members.length === 0) {
      alert("Add at least one employee before marking the roster complete.");
      return;
    }
    if (!confirm(`Mark the roster as complete? You've added ${members.length} employee${members.length === 1 ? "" : "s"}. You can still add or remove employees after this.`)) return;
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/business/companies/${companyId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ action: "confirm_roster" }),
    });
    if (!res.ok) { alert("Failed to confirm roster"); return; }
    loadData();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finalizeRegistration = async () => {
    if (!confirm(`Finalize registration for ${company.name}? Lifeline will be notified and you'll move into normal management mode. You can still edit the roster, event, and test days afterwards.`)) return;
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/business/companies/${companyId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ action: "finalize" }),
    });
    const j = await res.json();
    if (!res.ok) { alert(`Failed: ${j.error || "finalize_failed"}`); return; }
    loadData();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#ecf0f3]">
      <BusinessHeader
        currentCompanyId={company.id}
        crumbs={[
          { label: "Business", href: "/business" },
          { label: company.name },
        ]}
      />

      {/* Hero header — mirrors the personal account page's identity band. */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-10 sm:py-14">
        <div className="max-w-6xl mx-auto px-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white text-lg font-bold flex items-center justify-center shrink-0">
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1F2937] truncate">{company.name}</h1>
            <p className="text-sm text-[#6B7280]">
              {finalized ? "Management mode — your registration is complete." : "Company account management"}
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-6 pb-10 flex gap-8">
        {/* Side nav — matches the personal account page's menu language. */}
        <nav className="hidden lg:block w-56 shrink-0 sticky top-24 self-start bg-white rounded-2xl shadow-sm p-2">
          <div className="px-4 pt-2 pb-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-gray-400">
            Jump to
          </div>
          {[
            {
              id: "setup",
              label: "Setup",
              iconPath: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z",
            },
            {
              id: "billing",
              label: "Billing & Invoices",
              iconPath: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
            },
            {
              id: "insights",
              label: "Insights",
              iconPath: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-[#6B7280] hover:text-[#1F2937] hover:bg-gray-50 transition-all text-left whitespace-nowrap"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
        {/* Header card — company identity + the contact person (primary admin),
            with phone + position. Replaces the bare company-name hero. */}
        <CompanyHeaderCard
          companyId={companyId!}
          companyName={company.name}
          primary={
            admins.find((a) => a.is_primary)
            // No claimed primary admin yet — fall back to the manually
            // registered contact (contact_draft_*) so the person still
            // shows in the header card.
            || ((company.contact_draft_name || company.contact_draft_email)
              ? {
                  user_id: "draft-contact",
                  full_name: company.contact_draft_name,
                  email: company.contact_draft_email,
                  added_at: company.created_at,
                  is_primary: true,
                  phone: company.contact_draft_phone,
                  position: null,
                  kennitala_last4: null,
                }
              : null)
          }
          admins={admins}
          onReload={loadAdmins}
          contactPhone={company.contact_phone || company.contact_draft_phone}
          contactPosition={company.contact_position}
          viewerIsStaff={viewerIsStaff}
        />

        {/* Finalized banner */}
        {finalized && (
          <section className="rounded-2xl p-6 shadow-sm text-white"
            style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Registration complete</h2>
                <p className="text-sm opacity-95 mt-1 max-w-xl">
                  The Lifeline admin team has been notified — your job is done for now.
                  You can still manage the roster, measurement day, and blood-test days below at any time.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* What's next — employee journey overview, shown once the
            company has finalized registration. */}
        {finalized && (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">What happens next</h2>
            <p className="text-sm text-gray-600 mt-1">
              Here&apos;s the journey your team goes through from here. The Lifeline team drives
              every step — you can sit back and watch your people get healthier.
            </p>
            <ol className="mt-6 space-y-5">
              {[
                { t: "Employees get their invite", d: "Each employee receives an invite email and self-onboards to their own Lifeline account." },
                { t: "Health questionnaire", d: "The Lifeline team sends an SMS/email invite to the health questionnaire, which employees answer in the secure patient portal." },
                { t: "Measurement & blood-test days", d: "On the scheduled days, employees complete their on-site body-composition measurement and blood test." },
                { t: "Full report delivered", d: "Each employee receives their complete health report from the Lifeline team." },
                { t: "Book the doctor interview", d: "Employees get an SMS/email to book their doctor interview appointment in the patient portal." },
                { t: "3-month follow-up", d: "After three months, employees get an SMS/email to book a doctor follow-up interview in the patient portal." },
                { t: "Download the coaching app", d: "Employees download the Lifeline Health Coaching app and start their journey as part of the Lifeline community — a tool to manage their health changes." },
                { t: "Healthier, happier team", d: "You, as the company contact, get to enjoy the benefit of healthier and happier employees — the whole goal of Lifeline's service." },
                { t: "Next check-in", d: "Book another check-in after 6–12 months to keep the momentum going." },
              ].map((step, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    {i < 8 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-semibold text-gray-900">{step.t}</p>
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Doctor interviews — propose day(s) + mode; employees self-book
            the 30-min slots in the patient portal after Lifeline approves. */}
        {finalized && <DoctorInterviews companyId={companyId!} />}

        {/* Progress bar + step status (hidden after finalize). The status
            line lives here rather than in the header card so it sits with
            the bar it describes. */}
        {!finalized && (
          <div className="space-y-1.5">
            <p className="text-sm text-gray-600">
              {stepsDone === 6
                ? "All steps done. Finalize below to notify the Lifeline admin team."
                : `${stepsDone} of 6 setup steps complete${nextStep ? ` — next: step ${nextStep}.` : ` — the rest is optional, you can finalize below.`}`}
            </p>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                style={{ width: `${(stepsDone / 6) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div id="setup" className="scroll-mt-24" />
        {/* STEP 1 — Sign service agreement + purchase order. This MUST be
            first: the invite API refuses to send until the platform
            agreement is signed, so signing before the roster step avoids
            the "agreement_not_signed" dead-end testers hit. */}
        {!finalized && (
          <StepCard
            n={1}
            done={agreementSigned}
            active={nextStep === 1}
            title={agreementSigned ? "Service agreement signed" : "Choose your package & sign the service agreement"}
            subtitle={
              agreementSigned
                ? `Signed ${new Date(company.agreement_signed_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} — a copy is in your company portal and was emailed to you.`
                : "Review the package and everything it includes, choose a 1-year or 2-year term, then sign electronically. This must be done before you can invite employees."
            }
          >
            {!agreementSigned ? (
              <button
                onClick={() => router.push(`/business/${companyId}/sign`)}
                className="btn-step-primary"
              >
                Choose package & continue to signing →
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  Your agreement is stored securely. You can download a copy below.
                </div>
                {signedDocs.length > 0 && (
                  <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg bg-white">
                    {signedDocs.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {d.po_number || "(order)"} · {d.signatory_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {d.signatory_role} · {new Date(d.signed_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            {d.total_isk != null && <> · <strong>{d.total_isk.toLocaleString("is-IS")} kr</strong></>}
                          </div>
                        </div>
                        <button
                          onClick={() => downloadSignedPdf(d.id, d.pdf_storage_path)}
                          disabled={downloadingId === d.id || !d.pdf_storage_path}
                          title={!d.pdf_storage_path ? "PDF missing" : "Download PDF"}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 disabled:opacity-40 whitespace-nowrap"
                        >
                          {downloadingId === d.id ? "…" : d.pdf_storage_path ? "Download PDF" : "Missing"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </StepCard>
        )}

        {/* STEP 2 — Add a co-admin (optional; ticks green once one is invited,
            but never blocks finalize). Also available via the header dropdown. */}
        <StepCard
          n={2}
          done={hasCoAdmin}
          active={false}
          locked={!agreementSigned && !hasCoAdmin}
          title="Add a co-admin"
          subtitle={
            hasCoAdmin
              ? `${admins.filter((a) => !a.is_primary).length} co-admin${admins.filter((a) => !a.is_primary).length === 1 ? "" : "s"} invited · optional — add more or manage them anytime.`
              : "Optional — invite a colleague to help manage this company (register employees, schedule the days). You can also do this anytime from the Co-admins button at the top."
          }
        >
          <CoAdminManager companyId={companyId!} admins={admins} onReload={loadAdmins} />
        </StepCard>

        {/* STEP 3 — Register employees */}
        <StepCard
          n={3}
          done={rosterDone}
          active={nextStep === 3}
          locked={!agreementSigned && !rosterDone}
          title="Register your employees"
          subtitle={
            members.length === 0
              ? "Add every employee by name, kennitala, email and phone. They each get an email invite to set up their Lifeline account."
              : `${members.length} on roster · ${totalInvited} invited · ${totalCompleted} completed`
          }
        >
          {/* Roster counter — tracks employees added against the headcount
              purchased on the signed purchase order. */}
          {poEmployeeCount != null && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-sm font-semibold text-gray-900">
                  {members.length} of {poEmployeeCount} employee{poEmployeeCount === 1 ? "" : "s"} added
                </div>
                <div className={`text-xs font-medium ${members.length >= poEmployeeCount ? "text-emerald-600" : "text-gray-500"}`}>
                  {members.length < poEmployeeCount
                    ? `${poEmployeeCount - members.length} to go`
                    : members.length === poEmployeeCount
                      ? "All set ✓"
                      : `${members.length - poEmployeeCount} over`}
                </div>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, Math.round((members.length / poEmployeeCount) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {members.length < poEmployeeCount
                  ? `Your purchase order covers ${poEmployeeCount} employees — add the rest so everyone gets invited.`
                  : members.length === poEmployeeCount
                    ? "You've added everyone covered by your purchase order."
                    : `You've added more than the ${poEmployeeCount} on your purchase order — that's fine, you're only billed for employees we actually process.`}
              </p>
            </div>
          )}

          {/* Add controls */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setAddMode(addMode === "single" ? "none" : "single")}
              className={`btn-step ${addMode === "single" ? "btn-step-active" : ""}`}
            >
              + Add one by one
            </button>
            <button
              onClick={() => setAddMode(addMode === "import" ? "none" : "import")}
              className={`btn-step ${addMode === "import" ? "btn-step-active" : ""}`}
            >
              Upload / paste CSV
            </button>
            {members.length > 0 && (
              <button onClick={exportCsv} className="btn-step ml-auto">Export CSV</button>
            )}
          </div>

          {addMode === "single" && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <SingleRowForm companyId={companyId!} onDone={() => { setAddMode("none"); loadData(); }} />
            </div>
          )}
          {addMode === "import" && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <ImportForm companyId={companyId!} onDone={() => { setAddMode("none"); loadData(); }} />
            </div>
          )}

          {/* Roster table */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-sm text-gray-900">
                Roster {members.length > 0 && <span className="text-gray-500 font-normal">({members.length})</span>}
              </h3>
              {(uninvitedIds.length > 0 || staleIds.length > 0) && (
                <div className="flex gap-2">
                  {staleIds.length > 0 && <RemindStaleButton memberIds={staleIds} onDone={loadData} />}
                  {uninvitedIds.length > 0 && <SendAllInvitesButton memberIds={uninvitedIds} onDone={loadData} />}
                </div>
              )}
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">No employees yet. Add one above to get started.</p>
            ) : (
              <>
                {!rosterConfirmed && (
                  <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm text-blue-900">
                      <div className="font-semibold">Done adding employees?</div>
                      <div className="text-xs mt-0.5">Mark the roster complete when you&apos;re finished. You can still add or remove people afterwards.</div>
                    </div>
                    <button onClick={confirmRoster} className="btn-step-primary">Mark roster complete</button>
                  </div>
                )}
                {rosterConfirmed && (
                  <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3 flex items-center justify-between gap-2 flex-wrap text-sm">
                    <div className="text-emerald-800">
                      <strong>Roster confirmed</strong> on {new Date(company.roster_confirmed_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Kennitala</th>
                        <th className="py-2 pr-4">Phone</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Data</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <MemberRow key={m.id} member={m} onChange={loadData} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </StepCard>

        {/* STEP 4 — Introduction lecture (Lifeline-approved) */}
        <StepCard
          n={4}
          done={hasIntroLecture}
          active={nextStep === 4}
          locked={!rosterDone && !hasIntroLecture}
          title="Schedule the introduction lecture"
          subtitle={
            hasIntroLecture
              ? introLectures.map((l) =>
                  `${new Date(l.lecture_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${l.start_time.slice(0,5)}–${l.end_time.slice(0,5)} · ${l.mode === "onsite" ? "On-site" : "Video"}`,
                ).join(" · ")
              : "A 30-minute kick-off lecture for your team — on-site or by video. You can hold it the same day as the measurement day (e.g. the lecture at 09:00, measurements from 10:00). Lifeline reviews and approves the time."
          }
        >
          {hasIntroLecture && (
            <div className="mb-4 space-y-2">
              {introLectures.map((l) => {
                const editable = viewerIsStaff || l.approval_status === "requested";
                return (
                <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">
                  <div>
                    <div className="font-semibold">
                      {new Date(l.lecture_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    </div>
                    <div className="text-xs text-gray-600">
                      {l.start_time.slice(0, 5)}–{l.end_time.slice(0, 5)} · {l.mode === "onsite" ? "On-site" : "Video / phone"}
                      {l.mode === "onsite" && l.location ? ` · ${l.location}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.approval_status === "approved" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Approved</span>
                    ) : l.approval_status === "rejected" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Rejected — pick another time</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Awaiting Lifeline approval</span>
                    )}
                    {editable && (
                      <>
                        <button
                          onClick={() => setEditLecture({
                            id: l.id, lecture_date: l.lecture_date, start_time: l.start_time,
                            mode: l.mode, location: l.location, room_notes: l.room_notes,
                          })}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteLecture(l.id)}
                          disabled={deletingLectureId === l.id}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingLectureId === l.id ? "…" : "Remove"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          <button onClick={() => setShowSchedLecture(true)} className="btn-step-primary">
            {hasIntroLecture ? "Propose another time" : "Schedule lecture"}
          </button>
        </StepCard>

        {/* STEP 5 — Measurement day */}
        <StepCard
          n={5}
          done={hasEvents}
          active={nextStep === 5}
          locked={!hasIntroLecture && !hasEvents}
          title="Schedule the measurement day"
          subtitle={
            hasEvents
              ? events.map((e) =>
                  `${new Date(e.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${e.start_time.slice(0,5)}–${e.end_time.slice(0,5)}`,
                ).join(" · ")
              : "A Lifeline staff member travels to your office with the measurement scanner. Pick a day and time window. Each employee then books a 5-minute slot (2 people per slot)."
          }
        >
          {hasEvents && (
            <div className="mb-4 space-y-2">
              {events.map((e) => {
                const editable = viewerIsStaff || e.approval_status === "requested";
                return (
                <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">
                  <div>
                    <div className="font-semibold">
                      {new Date(e.event_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    </div>
                    <div className="text-xs text-gray-600">
                      {e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}
                      {e.break_start && e.break_end && ` · lunch ${e.break_start.slice(0, 5)}–${e.break_end.slice(0, 5)}`}
                      {e.location && ` · ${e.location}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.approval_status === "approved" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Approved</span>
                    ) : e.approval_status === "rejected" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Rejected — pick another day</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Awaiting Lifeline approval</span>
                    )}
                    {editable && (
                      <>
                        <button
                          onClick={() => setEditBcEvent({
                            id: e.id, event_date: e.event_date, start_time: e.start_time, end_time: e.end_time,
                            location: e.location, room_notes: e.room_notes, break_start: e.break_start, break_end: e.break_end,
                          })}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteBcEvent(e.id)}
                          disabled={deletingBcId === e.id}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingBcId === e.id ? "…" : "Remove"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {!hasEvents && (
            <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-900">
              <div className="font-semibold mb-1">You&apos;ll need to provide on the day:</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>A private room at your office</li>
                <li>One computer screen</li>
                <li>A quiet environment — each 5-minute measurement is private</li>
              </ul>
            </div>
          )}

          <button onClick={() => setShowSchedBC(true)} className="btn-step-primary">
            {hasEvents ? "Schedule another day" : "Schedule visit"}
          </button>
        </StepCard>

        {/* STEP 6 — Blood-test days (no Lifeline approval needed) */}
        <StepCard
          n={6}
          done={hasBloodDays}
          active={nextStep === 6}
          locked={!hasEvents && !hasBloodDays}
          title="Pick blood-test days"
          subtitle={
            hasBloodDays
              ? bloodDays.map((d) => new Date(d.day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })).join(" · ")
              : "Employees walk in at any Sameind station. Pick the days your employees are allowed to leave work to go in."
          }
        >
          {hasBloodDays && (
            <div className="mb-4 flex flex-wrap gap-2">
              {bloodDays.map((d) => (
                <span key={d.id} className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  {new Date(d.day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                </span>
              ))}
            </div>
          )}
          <button onClick={() => setShowSchedBlood(true)} className="btn-step-primary">
            {hasBloodDays ? "Add more days" : "Pick days"}
          </button>
        </StepCard>

        {/* Finalize CTA — shown when all required steps done but not yet finalized */}
        {allStepsDone && !finalized && (
          <section className="rounded-2xl p-6 text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #3B82F6, #10B981)" }}>
            <h2 className="text-xl font-semibold">Ready to finalize?</h2>
            <p className="text-sm opacity-95 mt-1 max-w-xl">
              All required setup steps are done. Click finalize to notify the Lifeline admin team — they&apos;ll take over from here.
              You can still edit the roster, event, and test days afterwards.
            </p>
            <button onClick={finalizeRegistration} className="mt-4 inline-block px-5 py-2.5 rounded-lg bg-white text-blue-700 font-semibold text-sm hover:bg-gray-50">
              Finalize registration
            </button>
          </section>
        )}

        {/* Renewal card — shown when company has completed at least one round */}
        {finalized && (
          <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">
                  {rounds.length > 1 ? "Start another health round" : "Time for a check-in?"}
                </h3>
                <p className="text-sm text-gray-600 mt-1 max-w-xl">
                  {company.last_round_completed_at
                    ? `Last round completed ${new Date(company.last_round_completed_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}. A follow-up measures progress and refreshes every action plan.`
                    : "Schedule a follow-up round to track changes and update health plans."}
                </p>

                {/* Round history */}
                {rounds.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assessment history</p>
                    {rounds.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-700">Round {r.round_number} · {r.package}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          r.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                          r.status === "active" || r.status === "scheduling" ? "bg-blue-50 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{r.status}</span>
                        {r.completed_at && <span className="text-xs text-gray-400">{new Date(r.completed_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-5 flex-wrap">
                  <button
                    onClick={() => startNewRound("checkin")}
                    disabled={startingRound}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-emerald-500 to-teal-500 hover:opacity-90 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {startingRound ? "Starting…" : "Start check-in round"}
                  </button>
                  <button
                    onClick={() => startNewRound("foundational")}
                    disabled={startingRound}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Full foundational round
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <div id="billing" className="scroll-mt-24" />
        {/* Billing card — PayDay invoices specific to this company's programme */}
        <BillingCard companyId={companyId!} />

        {/* Payment methods removed — companies are invoiced via PayDay, not billed via card */}

        <div id="insights" className="scroll-mt-24" />
        <InsightsCard companyId={companyId!} />
        </div>{/* end content */}
      </main>

      {(showSchedBC || editBcEvent) && (
        <ScheduleBodyComp
          companyId={companyId!}
          employeeCount={poEmployeeCount || members.length}
          editEvent={editBcEvent}
          onClose={() => { setShowSchedBC(false); setEditBcEvent(null); }}
          onCreated={() => { setShowSchedBC(false); setEditBcEvent(null); loadData(); }}
        />
      )}
      {showSchedBlood && (
        <ScheduleBloodTests
          companyId={companyId!}
          existing={bloodDays}
          onClose={() => setShowSchedBlood(false)}
          onCreated={() => { setShowSchedBlood(false); loadData(); }}
        />
      )}
      {(showSchedLecture || editLecture) && (
        <ScheduleLecture
          companyId={companyId!}
          editLecture={editLecture}
          onClose={() => { setShowSchedLecture(false); setEditLecture(null); }}
          onCreated={() => { setShowSchedLecture(false); setEditLecture(null); loadData(); }}
        />
      )}

      <style jsx global>{`
        .input { width:100%; padding:0.5rem 0.75rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; }
        .input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
        .btn-primary { background:linear-gradient(135deg,#3b82f6,#10b981); color:white; padding:0.6rem 1rem; border-radius:0.6rem; font-weight:600; }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
        .btn-ghost { padding:0.5rem 0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; font-size:0.875rem; background:white; color:#374151; }
        .btn-ghost:hover { background:#f9fafb; }
        .btn-step { padding:0.5rem 0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; font-size:0.875rem; font-weight:500; background:white; color:#374151; }
        .btn-step:hover { background:#f9fafb; border-color:#d1d5db; }
        .btn-step-active { background:#eff6ff; border-color:#60a5fa; color:#1e40af; }
        .btn-step-primary { padding:0.625rem 1rem; border-radius:0.625rem; font-size:0.875rem; font-weight:600; color:white; background:linear-gradient(135deg,#3b82f6,#10b981); }
        .btn-step-primary:hover { opacity:0.92; }
      `}</style>
    </div>
  );
}

// ── Step card shell ─────────────────────────────────────────────────────────

function StepCard({
  n, done, active, locked = false, title, subtitle, children,
}: {
  n: number;
  done: boolean;
  active: boolean;
  locked?: boolean;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const ring = done
    ? "ring-1 ring-emerald-200"
    : active
      ? "ring-2 ring-blue-300"
      : "ring-1 ring-gray-100";
  const numBg = done
    ? "bg-emerald-100 text-emerald-700"
    : active
      ? "bg-blue-600 text-white"
      : locked
        ? "bg-gray-100 text-gray-400"
        : "bg-gray-100 text-gray-500";
  return (
    <section className={`bg-white rounded-2xl shadow-sm ${ring}`}>
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${numBg}`}>
            {done ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
              </svg>
            ) : n}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-lg font-semibold ${locked ? "text-gray-400" : "text-gray-900"}`}>
              {title}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="sm:pl-14">
          {children}
        </div>
      </div>
    </section>
  );
}

// ── Sub-components (unchanged from previous version) ────────────────────────

function SingleRowForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const [row, setRow] = useState({ full_name: "", kennitala: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const parsed = parseRoster(
        `${row.full_name},${row.kennitala},${row.email},${row.phone}`
      )[0];
      if (parsed.errors.length) throw new Error(parsed.errors.join("; "));

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/business/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          company_id: companyId,
          rows: [{
            full_name: parsed.full_name,
            email: parsed.email.toLowerCase(),
            phone: parsed.phone || null,
            kennitala: parsed.kennitala,
          }],
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || j.error || "Failed to add employee");
      const firstResult = (j.results || [])[0];
      if (firstResult?.error) throw new Error(firstResult.error);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <input className="input" placeholder="Name" value={row.full_name} onChange={(e) => setRow({ ...row, full_name: e.target.value })} required />
      <input className="input" placeholder="Kennitala (10 digits)" value={row.kennitala} onChange={(e) => setRow({ ...row, kennitala: e.target.value })} required />
      <input className="input" placeholder="Email" value={row.email} onChange={(e) => setRow({ ...row, email: e.target.value })} required type="email" />
      <input className="input" placeholder="Phone (7 digits)" value={row.phone} onChange={(e) => setRow({ ...row, phone: e.target.value })} />
      {error && <div className="col-span-full text-red-600 text-sm">{error}</div>}
      <div className="col-span-full flex gap-2">
        <button className="btn-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Add employee"}</button>
        <button type="button" className="btn-ghost" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}

function ImportForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ inserted: number; failed: number; results: Array<{ email: string; error?: string }> } | null>(null);

  const onParse = () => {
    setRows(parseRoster(raw));
    setError("");
    setResult(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setRaw(text);
    setRows(parseRoster(text));
    setResult(null);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const save = async () => {
    if (!validRows.length) return;
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/business/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          company_id: companyId,
          rows: validRows.map((r) => ({
            full_name: r.full_name,
            email: r.email.toLowerCase(),
            phone: r.phone || null,
            kennitala: r.kennitala,
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Bulk insert failed");
      setResult(j);
      if ((j.failed ?? 0) === 0) {
        onDone();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const downloadTemplate = () => {
    const rows = [
      "name,kennitala,email,phone",
      "Jón Jónsson,1406221680,jon@example.is,7674393",
      "Guðrún Þórðardóttir,2904913129,gudrun@example.is,8905234",
      "Einar Ægir Björnsson,0301904599,einar@example.is,7712345",
    ];
    const csv = "\ufeff" + rows.join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lifeline-roster-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm text-blue-900 mb-1">Required columns (in any order)</h3>
            <p className="text-xs text-blue-800 mb-2">
              <code className="bg-white px-1.5 py-0.5 rounded">name</code>,{" "}
              <code className="bg-white px-1.5 py-0.5 rounded">kennitala</code>,{" "}
              <code className="bg-white px-1.5 py-0.5 rounded">email</code>,{" "}
              <code className="bg-white px-1.5 py-0.5 rounded">phone</code>{" "}
              — kennitala 10 digits, phone 7 digits.
            </p>
            <button type="button" onClick={downloadTemplate} className="text-xs text-blue-700 hover:underline">
              ↓ Download example CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 hover:border-blue-400 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <span className="font-semibold text-sm">Option 1 — Upload file</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">CSV, TSV, or plain text export from Excel/Google Sheets.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={onFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost w-full"
          >
            Choose file
          </button>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 hover:border-blue-400 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="font-semibold text-sm">Option 2 — Paste rows</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">Select rows in Excel/Sheets and paste directly below.</p>
          <button
            type="button"
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                if (t) { setRaw(t); setRows(parseRoster(t)); setResult(null); }
              } catch {
                alert("Could not access clipboard — paste manually in the text field below.");
              }
            }}
            className="btn-ghost w-full"
          >
            Paste from clipboard
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Or type / paste text here (auto-validates as you type):</label>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setRows(parseRoster(e.target.value));
            setResult(null);
          }}
          rows={6}
          placeholder={"name,kennitala,email,phone\nJón Jónsson,1406221680,jon@example.is,7674393"}
          className="input font-mono text-xs"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={!validRows.length || saving} className="btn-primary" type="button">
          {saving
            ? "Adding…"
            : validRows.length === 0
              ? "Paste or upload a roster first"
              : `Add ${validRows.length} employee${validRows.length === 1 ? "" : "s"}`}
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {rows.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {rows.map((r, i) => {
            const serverResult = result?.results.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
            return (
              <div key={i} className="px-3 py-2 text-sm flex items-center justify-between">
                <div>
                  <span className="font-medium">{r.full_name || "(no name)"}</span>{" "}
                  <span className="text-gray-500">— {r.email || "(no email)"}</span>
                  {r.kennitala && <span className="text-gray-400 ml-2 font-mono">{formatKennitala(r.kennitala)}</span>}
                </div>
                {serverResult?.error ? (
                  <span className="text-red-600 text-xs">Failed: {serverResult.error}</span>
                ) : serverResult ? (
                  <span className="text-emerald-600 text-xs">Added ✓</span>
                ) : r.errors.length ? (
                  <span className="text-red-600 text-xs">{r.errors.join(", ")}</span>
                ) : (
                  <span className="text-emerald-600 text-xs">OK</span>
                )}
              </div>
            );
          })}
          <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600">
            {result
              ? `${result.inserted} added, ${result.failed} failed`
              : `${validRows.length} valid, ${invalidRows.length} invalid`}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, onChange }: { member: Member; onChange: () => void }) {
  const [sending, setSending] = useState(false);
  const status = member.completed_at
    ? { label: "Completed", color: "bg-emerald-100 text-emerald-700" }
    : member.invited_at
    ? { label: `Invited${member.invite_sent_count > 1 ? ` (${member.invite_sent_count}×)` : ""}`, color: "bg-blue-100 text-blue-700" }
    : { label: "Draft", color: "bg-gray-100 text-gray-700" };

  const sendInvite = async () => {
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/business/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ member_id: member.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Failed to send invite");
      }
      onChange();
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${member.full_name} from the roster?`)) return;
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    await fetch(`/api/business/members/${member.id}`, {
      method: "DELETE",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    onChange();
  };

  const dataDot = (() => {
    if (!member.completed_at) return <span className="text-gray-300 text-xs">—</span>;
    if (member.profile_complete && member.biody_activated) {
      return <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500" />Ready</span>;
    }
    if (member.profile_complete) {
      return <span className="inline-flex items-center gap-1 text-xs text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-500" />Needs activation</span>;
    }
    return <span className="inline-flex items-center gap-1 text-xs text-red-700"><span className="w-2 h-2 rounded-full bg-red-500" />Incomplete</span>;
  })();

  return (
    <tr className="border-b border-gray-100">
      <td className="py-3 pr-4 font-medium">{member.full_name}</td>
      <td className="py-3 pr-4 text-gray-700">{member.email}</td>
      <td className="py-3 pr-4 text-gray-500">•••••{member.kennitala_last4 || ""}</td>
      <td className="py-3 pr-4 text-gray-700">{member.phone || "—"}</td>
      <td className="py-3 pr-4">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
      </td>
      <td className="py-3 pr-4">{dataDot}</td>
      <td className="py-3 text-right whitespace-nowrap">
        {!member.completed_at && (
          <button onClick={sendInvite} disabled={sending} className="text-sm text-blue-600 hover:underline mr-3">
            {sending ? "Sending…" : member.invited_at ? "Resend" : "Send invite"}
          </button>
        )}
        <button onClick={remove} className="text-sm text-red-600 hover:underline">Remove</button>
      </td>
    </tr>
  );
}

function SendAllInvitesButton({ memberIds, onDone }: { memberIds: string[]; onDone: () => void }) {
  const [sending, setSending] = useState(false);
  if (!memberIds.length) return null;
  const onClick = async () => {
    if (!confirm(`Send invites to ${memberIds.length} uninvited employee${memberIds.length === 1 ? "" : "s"}?`)) return;
    setSending(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      const res = await fetch("/api/business/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ member_ids: memberIds }),
      });
      const j = await res.json();
      alert(`Sent ${j.sent ?? 0} · Failed ${j.failed ?? 0}`);
      onDone();
    } finally {
      setSending(false);
    }
  };
  return (
    <button onClick={onClick} disabled={sending} className="btn-primary text-sm">
      {sending ? "Sending…" : `Send all ${memberIds.length} invites`}
    </button>
  );
}

function RemindStaleButton({ memberIds, onDone }: { memberIds: string[]; onDone: () => void }) {
  const [sending, setSending] = useState(false);
  if (!memberIds.length) return null;
  const onClick = async () => {
    if (!confirm(`Resend invite to ${memberIds.length} employee${memberIds.length === 1 ? "" : "s"} who haven't completed registration in 3+ days? A new password will be generated for each.`)) return;
    setSending(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      const res = await fetch("/api/business/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ member_ids: memberIds }),
      });
      const j = await res.json();
      alert(`Reminded ${j.sent ?? 0} · Failed ${j.failed ?? 0}`);
      onDone();
    } finally {
      setSending(false);
    }
  };
  return (
    <button onClick={onClick} disabled={sending} className="btn-ghost text-sm">
      {sending ? "Reminding…" : `Remind ${memberIds.length} stale`}
    </button>
  );
}

// Employee headcount purchased on the signed purchase order, derived from the
// assessment line item (description like "Heilsumat starfsmanns — 20 starfsmenn
// [× 2 skipti]"). Used as the target for the step-2 roster counter.
function deriveEmployeeCount(
  lineItems: { description: string; qty: number }[] | null | undefined,
): number | null {
  if (!lineItems || lineItems.length === 0) return null;
  const assessment = lineItems[0]; // buildAssessmentPricing always puts it first
  const m = /(\d+)\s*starfsm/i.exec(assessment.description || "");
  if (m) return parseInt(m[1], 10);
  // Fallback: qty ÷ rounds (rounds inferred from a "2 skipti" / "× 2" marker).
  const rounds = /(×\s*2|2\s*skipti)/i.test(assessment.description || "") ? 2 : 1;
  return assessment.qty > 0 ? Math.round(assessment.qty / rounds) : null;
}

// Two-letter initials for an avatar fallback.
function initials(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("");
}

// A single person card — avatar + name/role/email/phone. Used for both the
// primary contact (emerald gradient avatar) and onboarded co-admins (gray
// avatar), so they read as a consistent set when shown side by side.
function ContactPersonCard({
  name, email, phone, position, label, primary,
}: {
  name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  label: string;
  primary: boolean;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0 ${
          primary
            ? "bg-gradient-to-br from-blue-500 to-emerald-500 text-white"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        {initials(name || email)}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
        <div className="font-semibold text-gray-900 leading-tight truncate">
          {name || email || (primary ? "Company admin" : "Co-admin")}
          {position && <span className="font-normal text-gray-500"> · {position}</span>}
        </div>
        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          {/* Show email only when it isn't already the title (i.e. a name exists) */}
          {name && email && <span className="truncate">{email}</span>}
          {phone && (
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {phone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Page header card — company identity + the contact person (the primary admin),
// with their position and phone. Replaces the plain company-name hero.
function CompanyHeaderCard({
  companyId, companyName, primary, admins, onReload, contactPhone, contactPosition, viewerIsStaff,
}: {
  companyId: string;
  companyName: string;
  primary: Admin | null;
  admins: Admin[];
  onReload: () => void;
  contactPhone: string | null;
  contactPosition: string | null;
  viewerIsStaff: boolean;
}) {
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showCoAdmins, setShowCoAdmins] = useState(false);
  const coAdminCount = admins.filter((a) => !a.is_primary).length;
  // Onboarded co-admins (completed setup → have a name) surface next to the
  // contact person. Pending invites stay in the Co-admins dropdown only.
  const onboardedCoAdmins = admins.filter((a) => !a.is_primary && a.full_name);
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 to-emerald-500" />
      <div className="p-6 flex flex-col sm:flex-row sm:items-start gap-5">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Company admins</div>

          {(primary || onboardedCoAdmins.length > 0) && (
            <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-x-8 gap-y-4">
              {primary && (
                <ContactPersonCard
                  name={primary.full_name}
                  email={primary.email}
                  phone={contactPhone}
                  position={contactPosition}
                  label="Company admin"
                  primary
                />
              )}
              {onboardedCoAdmins.map((a) => (
                <ContactPersonCard
                  key={a.user_id}
                  name={a.full_name}
                  email={a.email}
                  phone={a.phone}
                  position={a.position}
                  label="Co-admin"
                  primary={false}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {viewerIsStaff && primary?.email && (
            <button onClick={() => setShowMessageModal(true)} className="btn-ghost inline-flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email contact
            </button>
          )}
          <button
            onClick={() => setShowCoAdmins((v) => !v)}
            aria-expanded={showCoAdmins}
            className="btn-ghost inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            Co-admins{coAdminCount > 0 ? ` (${coAdminCount})` : ""}
            <svg className={`w-3.5 h-3.5 transition-transform ${showCoAdmins ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {showCoAdmins && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Company admins</div>
          <CoAdminManager companyId={companyId} admins={admins} onReload={onReload} />
        </div>
      )}

      {showMessageModal && primary && (
        <MessageContactModal
          companyId={companyId}
          companyName={companyName}
          recipientName={primary.full_name || primary.email || "the contact person"}
          recipientEmail={primary.email || ""}
          onClose={() => setShowMessageModal(false)}
        />
      )}
    </section>
  );
}

// Co-admin management — invite / promote / remove colleagues who help run this
// company. Reused in two places: the early onboarding prompt and the header
// card dropdown. Reads from the lifted `admins` list and asks the parent to
// reload after a mutation.
function CoAdminManager({ companyId, admins, onReload }: { companyId: string; admins: Admin[]; onReload: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [invited, setInvited] = useState<{ email: string; emailSent: boolean } | null>(null);
  const coAdmins = admins.filter((a) => !a.is_primary);

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInvited(null);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/business/companies/${companyId}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ email }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error || "Failed to invite co-admin");
    else { setInvited({ email: email.trim(), emailSent: j.email_sent !== false }); setEmail(""); onReload(); }
    setLoading(false);
  };

  const removeAdmin = async (userId: string) => {
    if (!confirm("Remove this co-admin?")) return;
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    await fetch(`/api/business/companies/${companyId}/admins?user_id=${userId}`, {
      method: "DELETE",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    onReload();
  };

  const promote = async (userId: string, addr: string | null) => {
    if (!confirm(`Make ${addr || userId} the primary contact person? You will be demoted to a co-admin.`)) return;
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/business/companies/${companyId}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ user_id: userId }),
    });
    const j = await res.json();
    if (!res.ok) alert(`Failed: ${j.error || "promote_failed"}`);
    onReload();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={addAdmin} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.is"
          required
          className="input flex-1"
        />
        <button type="submit" disabled={loading} className="btn-primary text-sm whitespace-nowrap">
          {loading ? "Inviting…" : "Invite co-admin"}
        </button>
      </form>
      <p className="text-xs text-gray-500">
        They&apos;ll get a one-click link to set their password and their own details — name, role, phone and kennitala — just like you did at signup.
      </p>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {invited && (invited.emailSent ? (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          Invite sent to <strong>{invited.email}</strong>. They&apos;ll get an email with a one-click link to log in and help manage this company.
        </div>
      ) : (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Added <strong>{invited.email}</strong> as a co-admin, but the invite email couldn&apos;t be sent. Ask them to sign in at the company login (they can use &ldquo;Forgot your password?&rdquo; to set one).
        </div>
      ))}

      {coAdmins.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Co-admins</div>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg bg-white">
            {coAdmins.map((a) => (
              <div key={a.user_id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-semibold flex items-center justify-center shrink-0 text-sm">
                    {initials(a.full_name || a.email)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {a.full_name || a.email || "(unknown)"}
                      {a.position && <span className="font-normal text-gray-500"> · {a.position}</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {a.full_name && a.email && <span className="truncate">{a.email}</span>}
                      {a.phone && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          {a.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => promote(a.user_id, a.email)} className="text-sm text-blue-600 hover:underline">Make primary</button>
                  <button onClick={() => removeAdmin(a.user_id)} className="text-sm text-red-600 hover:underline">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageContactModal({
  companyId, companyName, recipientName, recipientEmail, onClose,
}: {
  companyId: string;
  companyName: string;
  recipientName: string;
  recipientEmail: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(`About your company registration — ${companyName}`);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { setError("Write a message first."); return; }
    setSending(true);
    setError("");
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/admin/companies/${companyId}/message-contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ subject, message }),
    });
    const j = await res.json();
    setSending(false);
    if (!res.ok) { setError(j.detail || j.error || "Failed to send"); return; }
    setSent(true);
    setTimeout(() => onClose(), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">Email the contact person</h2>
          <p className="text-sm text-gray-600 mt-1 truncate">To: <strong>{recipientName}</strong> &lt;{recipientEmail}&gt;</p>
        </div>
        <form onSubmit={send} className="p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Subject</span>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required className="input mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={8} className="input mt-1" placeholder="Write your message here…" />
          </label>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {sent && <div className="text-emerald-600 text-sm">Sent ✓</div>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={sending || sent} className="btn-primary">{sent ? "Sent" : sending ? "Sending…" : "Send email"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


function BillingCard({ companyId }: { companyId: string }) {
  interface Invoice {
    id: string;
    payday_invoice_number: string | null;
    status: string;
    currency: string;
    amount_net: number;
    amount_total: number;
    vat_rate: number;
    quantity: number;
    issued_at: string | null;
    due_at: string | null;
    paid_at: string | null;
    pdf_url: string | null;
    created_at: string;
  }
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("list_company_invoices", { p_company_id: companyId });
      if (error) { setLoadError(true); setLoading(false); return; }
      setInvoices((data || []) as Invoice[]);
      setLoading(false);
    })();
  }, [companyId]);

  // "sent" past its due date is effectively overdue, even if nothing flipped the DB status.
  const effectiveStatus = (inv: Invoice) =>
    inv.status === "sent" && inv.due_at && new Date(inv.due_at) < new Date() ? "overdue" : inv.status;

  const statusLabel: Record<string, string> = {
    draft: "Draft", sent: "Sent", paid: "Paid",
    overdue: "Overdue", cancelled: "Cancelled",
  };

  const statusColor = (s: string) =>
    s === "paid" ? "bg-emerald-100 text-emerald-700"
    : s === "sent" ? "bg-blue-100 text-blue-700"
    : s === "overdue" ? "bg-red-100 text-red-700"
    : s === "cancelled" ? "bg-gray-100 text-gray-500"
    : "bg-amber-100 text-amber-700";

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-semibold">Invoices</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            The company is invoiced once health assessments and doctor consultations are completed.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : loadError ? (
        <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">
          Could not load invoices. Please try again later or contact Lifeline.
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-sm text-gray-600">
          No invoices yet. Lifeline issues an invoice once the doctor consultations are completed.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {invoices.map((inv) => {
            const s = effectiveStatus(inv);
            const unit = inv.quantity > 0 ? Math.round(inv.amount_net / inv.quantity) : inv.amount_net;
            return (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">
                      {inv.payday_invoice_number || `Invoice ${inv.id.slice(0, 8)}`}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(s)}`}>
                      {statusLabel[s] || s}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {inv.quantity} × {unit.toLocaleString("is-IS")} kr ·
                    {inv.vat_rate === 0 ? " VAT-exempt" : ` VAT ${inv.vat_rate}%`} ·
                    <strong className="ml-1 text-gray-700">{inv.amount_total.toLocaleString("is-IS")} kr</strong>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {inv.issued_at && <>Issued {fmtDate(inv.issued_at)}</>}
                    {inv.due_at && <> · Due {fmtDate(inv.due_at)}</>}
                    {inv.paid_at && <> · Paid {fmtDate(inv.paid_at)}</>}
                  </div>
                </div>
                {inv.pdf_url && (
                  <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 hover:underline shrink-0">
                    PDF ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
type InsightsPayload = {
  min_n: number;
  participation: { invited: number; completed: number; rate: number };
  journey: { biody_activated: number; body_comp_booked: number; blood_test_booked: number; doctor_booked: number };
  wellbeing: { n: number; who5_percent: number | null; masked?: boolean };
  satisfaction: {
    body_comp: { n: number; nps?: number; helpful_avg?: number; masked?: boolean };
    doctor: { n: number; nps?: number; helpful_avg?: number; masked?: boolean };
    overall: { n: number; nps?: number; helpful_avg?: number; masked?: boolean };
  };
};

function InsightsCard({ companyId }: { companyId: string }) {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: d, error: err } = await supabase.rpc("get_company_insights", { p_company_id: companyId });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setData(d as InsightsPayload);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1F2937]">Employee insights</h2>
          <p className="text-sm text-[#6B7280] mt-1 max-w-xl">
            All clinical data lives in Medalia for the individuals themselves. Here you see how many of your employees have been invited and have completed their assessment.
          </p>
        </div>
        <button onClick={load} className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50">
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : data ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="Invited" value={String(data.participation.invited)} />
          <Stat label="Completed" value={String(data.participation.completed)} />
          <Stat label="Completion rate" value={`${Math.round((data.participation.rate || 0) * 100)}%`} accent="emerald" />
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "blue" }) {
  const accentCls = accent === "emerald" ? "text-emerald-700" : accent === "blue" ? "text-blue-700" : "text-gray-900";
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accentCls}`}>{value}</div>
    </div>
  );
}

