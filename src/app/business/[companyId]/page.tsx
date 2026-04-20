"use client";

import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BusinessHeader from "../BusinessHeader";
import { parseRoster, RosterRow } from "@/lib/parse-roster";
import { formatKennitala } from "@/lib/kennitala";
import ScheduleBodyComp from "./ScheduleBodyComp";
import ScheduleBloodTests from "./ScheduleBloodTests";
import BillingPanel from "@/app/components/BillingPanel";

interface Company {
  id: string;
  name: string;
  agreement_version: string;
  created_at: string;
  roster_confirmed_at: string | null;
  registration_finalized_at: string | null;
  agreement_signed_at: string | null;
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
  slot_minutes: number;
  slot_capacity: number;
  status: string;
}

interface BloodDay {
  id: string;
  day: string;
  notes: string | null;
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
  const [error, setError] = useState("");
  const [addMode, setAddMode] = useState<"none" | "single" | "import">("none");
  const [showSchedBC, setShowSchedBC] = useState(false);
  const [showSchedBlood, setShowSchedBlood] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: c }, { data: m }, { data: ev }, { data: bd }, { data: ag }, { data: po }] = await Promise.all([
      supabase.from("companies").select("id, name, agreement_version, created_at, roster_confirmed_at, registration_finalized_at, agreement_signed_at").eq("id", companyId).maybeSingle(),
      supabase.rpc("list_company_members", { p_company_id: companyId }),
      supabase.from("body_comp_events")
        .select("id, event_date, start_time, end_time, location, room_notes, slot_minutes, slot_capacity, status")
        .eq("company_id", companyId).gte("event_date", today).order("event_date"),
      supabase.from("blood_test_days")
        .select("id, day, notes")
        .eq("company_id", companyId).gte("day", today).order("day"),
      supabase.from("b2b_agreements")
        .select("id, signed_at, signatory_name, signatory_role, pdf_storage_path")
        .eq("company_id", companyId).order("signed_at", { ascending: false }),
      supabase.from("b2b_purchase_orders")
        .select("agreement_id, po_number, total_isk")
        .eq("company_id", companyId),
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

    setLoading(false);
  }, [companyId]);

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
    });
  }, [loadData, router]);

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
  const agreementSigned = !!company.agreement_signed_at;
  const rosterDone = rosterConfirmed;
  const stepsDone = [rosterDone, hasEvents, hasBloodDays, agreementSigned].filter(Boolean).length;
  const allStepsDone = rosterDone && hasEvents && hasBloodDays && agreementSigned;
  const nextStep = !rosterDone ? 1 : !hasEvents ? 2 : !hasBloodDays ? 3 : !agreementSigned ? 4 : 0;

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <BusinessHeader
        currentCompanyId={company.id}
        crumbs={[
          { label: "Business", href: "/business" },
          { label: company.name },
        ]}
      />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {/* Hero */}
        <section className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {finalized
                ? "Management mode — your registration is complete."
                : stepsDone === 4
                  ? "All four steps done. Finalize below to notify the Lifeline admin team."
                  : `${stepsDone} of 4 setup steps complete${nextStep ? ` — next: step ${nextStep}.` : "."}`}
            </p>
          </div>
          <button onClick={exportCsv} className="btn-ghost">Export CSV</button>
        </section>

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
                  You can still manage the roster, body-composition day, and blood-test days below at any time.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Progress bar (hidden after finalize) */}
        {!finalized && (
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
              style={{ width: `${(stepsDone / 4) * 100}%` }}
            />
          </div>
        )}

        {/* STEP 1 — Register employees */}
        <StepCard
          n={1}
          done={rosterDone}
          active={nextStep === 1}
          title="Register your employees"
          subtitle={
            members.length === 0
              ? "Add every employee by name, kennitala, email and phone. They each get an email invite to set up their Lifeline account."
              : `${members.length} on roster · ${totalInvited} invited · ${totalCompleted} completed`
          }
        >
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

        {/* STEP 2 — Body comp day */}
        <StepCard
          n={2}
          done={hasEvents}
          active={nextStep === 2}
          locked={!rosterDone && !hasEvents}
          title="Schedule the body-composition day"
          subtitle={
            hasEvents
              ? events.map((e) =>
                  `${new Date(e.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${e.start_time.slice(0,5)}–${e.end_time.slice(0,5)}`,
                ).join(" · ")
              : "Our Lifeline nurse travels to your office with the measurement scanner. Pick a day and time window. Each employee then books a 5-minute slot (2 people per slot)."
          }
        >
          {hasEvents && (
            <div className="mb-4 space-y-2">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">
                  <div>
                    <div className="font-semibold">
                      {new Date(e.event_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    </div>
                    <div className="text-xs text-gray-600">
                      {e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}
                      {e.location && ` · ${e.location}`}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Scheduled</span>
                </div>
              ))}
            </div>
          )}

          {!hasEvents && (
            <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-900">
              <div className="font-semibold mb-1">You&apos;ll need to provide on the day:</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>A private room at your office</li>
                <li>A computer with two screens</li>
                <li>A quiet environment — each 5-minute measurement is private</li>
              </ul>
            </div>
          )}

          <button onClick={() => setShowSchedBC(true)} className="btn-step-primary">
            {hasEvents ? "Schedule another day" : "Schedule visit"}
          </button>
        </StepCard>

        {/* STEP 3 — Blood-test days */}
        <StepCard
          n={3}
          done={hasBloodDays}
          active={nextStep === 3}
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

        {/* Billing card — PayDay invoices specific to this company's programme */}
        <BillingCard companyId={companyId!} />

        {/* Payment methods + payment history — reusable panel (ad-hoc charges) */}
        <BillingPanel ownerType="company" ownerId={companyId!} />

        {/* Signed agreements — always visible once at least one exists,
            including after finalize. Contact person can download anytime. */}
        {signedDocs.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-[#1F2937]">Undirritaðir samningar</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Afrit af öllum rafrænt undirrituðum þjónustusamningum og innkaupapöntunum.
                </p>
              </div>
            </div>
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white">
              {signedDocs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {d.po_number || "(pöntun)"} · {d.signatory_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {d.signatory_role} · {new Date(d.signed_at).toLocaleString("is-IS", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {d.total_isk != null && <> · <strong>{d.total_isk.toLocaleString("is-IS")} kr</strong></>}
                    </div>
                  </div>
                  <button
                    onClick={() => downloadSignedPdf(d.id, d.pdf_storage_path)}
                    disabled={downloadingId === d.id || !d.pdf_storage_path}
                    title={!d.pdf_storage_path ? "PDF vantar" : "Hlaða niður PDF"}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 disabled:opacity-40 whitespace-nowrap"
                  >
                    {downloadingId === d.id ? "…" : d.pdf_storage_path ? "Hlaða niður PDF" : "Vantar"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Insights card */}
        <InsightsCard companyId={companyId!} />

        {/* STEP 4 — Sign service agreement + purchase order (only after steps 1–3) */}
        {!finalized && rosterDone && hasEvents && hasBloodDays && (
          <StepCard
            n={4}
            done={agreementSigned}
            active={nextStep === 4}
            title={agreementSigned ? "Þjónustusamningur undirritaður" : "Undirrita þjónustusamning og pöntun"}
            subtitle={
              agreementSigned
                ? `Undirritað ${new Date(company.agreement_signed_at!).toLocaleDateString("is-IS", { day: "numeric", month: "short", year: "numeric" })} — afrit í fyrirtækisgátt og á tölvupósti.`
                : "Yfirfarðu þjónustusamninginn, bættu við pöntunaratriðum og undirritaðu rafrænt."
            }
          >
            {!agreementSigned ? (
              <button
                onClick={() => router.push(`/business/${companyId}/sign`)}
                className="btn-step-primary"
              >
                Halda áfram að undirritun →
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  Samningurinn er geymdur á öruggan hátt. Þú getur hlaðið niður afriti hér að neðan.
                </div>
                {signedDocs.length > 0 && (
                  <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg bg-white">
                    {signedDocs.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {d.po_number || "(pöntun)"} · {d.signatory_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {d.signatory_role} · {new Date(d.signed_at).toLocaleString("is-IS", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            {d.total_isk != null && <> · <strong>{d.total_isk.toLocaleString("is-IS")} kr</strong></>}
                          </div>
                        </div>
                        <button
                          onClick={() => downloadSignedPdf(d.id, d.pdf_storage_path)}
                          disabled={downloadingId === d.id || !d.pdf_storage_path}
                          title={!d.pdf_storage_path ? "PDF vantar" : "Hlaða niður PDF"}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 disabled:opacity-40 whitespace-nowrap"
                        >
                          {downloadingId === d.id ? "…" : d.pdf_storage_path ? "Hlaða niður PDF" : "Vantar"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </StepCard>
        )}

        {/* Finalize CTA — shown when all 4 steps done but not yet finalized */}
        {allStepsDone && !finalized && (
          <section className="rounded-2xl p-6 text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #3B82F6, #10B981)" }}>
            <h2 className="text-xl font-semibold">Ready to finalize?</h2>
            <p className="text-sm opacity-95 mt-1 max-w-xl">
              All four setup steps are done. Click finalize to notify the Lifeline admin team — they&apos;ll take over from here.
              You can still edit the roster, event, and test days afterwards.
            </p>
            <button onClick={finalizeRegistration} className="mt-4 inline-block px-5 py-2.5 rounded-lg bg-white text-blue-700 font-semibold text-sm hover:bg-gray-50">
              Finalize registration
            </button>
          </section>
        )}

        <AdminsSection companyId={companyId!} companyName={company.name} viewerIsStaff={viewerIsStaff} />
      </main>

      {showSchedBC && (
        <ScheduleBodyComp
          companyId={companyId!}
          onClose={() => setShowSchedBC(false)}
          onCreated={() => { setShowSchedBC(false); loadData(); }}
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

function AdminsSection({ companyId, companyName, viewerIsStaff }: { companyId: string; companyName: string; viewerIsStaff: boolean }) {
  interface Admin { user_id: string; full_name: string | null; email: string | null; added_at: string; is_primary: boolean }
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_company_admins", { p_company_id: companyId });
    if (error) setError(error.message);
    else {
      setAdmins((data || []) as Admin[]);
      // Auto-expand if there's already a co-admin (so it's visible)
      if ((data || []).some((a: Admin) => !a.is_primary)) setExpanded(true);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/business/companies/${companyId}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ email }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error || "Failed to add admin");
    else { setEmail(""); load(); }
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
    load();
  };

  const promote = async (userId: string, email: string | null) => {
    if (!confirm(`Make ${email || userId} the primary contact person? You will be demoted to a co-admin.`)) return;
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/business/companies/${companyId}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ user_id: userId }),
    });
    const j = await res.json();
    if (!res.ok) alert(`Failed: ${j.error || "promote_failed"}`);
    load();
  };

  const primary = admins.find((a) => a.is_primary);
  const coAdmins = admins.filter((a) => !a.is_primary);
  const initials = (name: string | null | undefined): string => {
    const n = (name || "").trim();
    if (!n) return "?";
    const parts = n.split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join("");
  };

  return (
    <section className="bg-white/60 rounded-2xl p-6 border border-dashed border-gray-300">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-start justify-between w-full text-left gap-4"
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-700">Company admins</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Optional</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Only needed if you want a colleague to help you manage this company. Skip this if you&apos;ll run it on your own.
            {coAdmins.length > 0 && <span className="text-gray-700 font-medium"> · {coAdmins.length} co-admin{coAdmins.length === 1 ? "" : "s"}</span>}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 mt-1 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Primary contact — always visible, not gated by expand */}
      {primary && (
        <div className="mt-4 rounded-xl p-4 text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, #3B82F6, #10B981)" }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg shrink-0">
              {initials(primary.full_name || primary.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold tracking-wider uppercase opacity-90">
                Primary contact person
              </div>
              <div className="font-semibold text-lg leading-tight truncate">
                {primary.full_name || primary.email || "Primary admin"}
              </div>
              {primary.full_name && primary.email && (
                <div className="text-xs opacity-90 truncate">{primary.email}</div>
              )}
            </div>
            {viewerIsStaff && primary.email && (
              <button
                onClick={() => setShowMessageModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email contact
              </button>
            )}
          </div>
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

      {expanded && (
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Add a co-admin
            </label>
            <form onSubmit={addAdmin} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.is"
                required
                className="input flex-1"
              />
              <button type="submit" disabled={loading} className="btn-primary text-sm">
                {loading ? "Inviting…" : "Invite co-admin"}
              </button>
            </form>
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}

          {coAdmins.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Co-admins
              </div>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg bg-white">
                {coAdmins.map((a) => (
                  <div key={a.user_id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-semibold flex items-center justify-center shrink-0 text-sm">
                        {initials(a.full_name || a.email)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{a.full_name || a.email || "(unknown)"}</div>
                        {a.full_name && a.email && <div className="text-xs text-gray-500 truncate">{a.email}</div>}
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
      )}
    </section>
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("list_company_invoices", { p_company_id: companyId });
      setInvoices((data || []) as Invoice[]);
      setLoading(false);
    })();
  }, [companyId]);

  const statusColor = (s: string) =>
    s === "paid" ? "bg-emerald-100 text-emerald-700"
    : s === "sent" ? "bg-blue-100 text-blue-700"
    : s === "overdue" ? "bg-red-100 text-red-700"
    : s === "cancelled" ? "bg-gray-100 text-gray-500"
    : "bg-amber-100 text-amber-700";

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-semibold">Billing</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Your company is invoiced once the full assessment + doctor interviews are complete. Billing is handled through PayDay.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-sm text-gray-600">
          No invoices yet. Lifeline will generate one after the doctor interviews are complete.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">
                    {inv.payday_invoice_number || `Invoice ${inv.id.slice(0, 8)}`}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(inv.status)}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {inv.quantity} × {Math.round(inv.amount_net / inv.quantity).toLocaleString()} ISK ·
                  VAT {inv.vat_rate}% ·
                  <strong className="ml-1 text-gray-700">{inv.amount_total.toLocaleString()} ISK incl. VAT</strong>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {inv.issued_at && <>Issued {new Date(inv.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>}
                  {inv.due_at && <> · Due {new Date(inv.due_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>}
                </div>
              </div>
              {inv.pdf_url && (
                <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline shrink-0">
                  PDF ↗
                </a>
              )}
            </div>
          ))}
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
            All clinical data lives in Medalia for the individuals themselves. Here you see the anonymised programme metrics Lifeline collects for you. Numbers below 5 are hidden to protect privacy.
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
        <div className="space-y-6">
          {/* Participation */}
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-2">Participation</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Invited" value={String(data.participation.invited)} />
              <Stat label="Completed" value={String(data.participation.completed)} />
              <Stat label="Completion rate" value={`${Math.round((data.participation.rate || 0) * 100)}%`} accent="emerald" />
            </div>
          </div>
          {/* Journey funnel */}
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-2">Journey</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Biody activated" value={String(data.journey.biody_activated)} />
              <Stat label="Body-comp booked" value={String(data.journey.body_comp_booked)} />
              <Stat label="Blood test booked" value={String(data.journey.blood_test_booked)} />
              <Stat label="Doctor booked" value={String(data.journey.doctor_booked)} />
            </div>
          </div>
          {/* Wellbeing */}
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-2">Self-reported wellbeing (WHO-5)</h3>
            {data.wellbeing.masked ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-600">
                Not enough responses yet ({data.wellbeing.n}/{data.min_n}). Results will appear once at least {data.min_n} employees have completed a wellbeing check-in.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat label="Responses" value={String(data.wellbeing.n)} />
                <Stat label="Average score" value={`${data.wellbeing.who5_percent ?? "—"}%`} accent="emerald" />
                <Stat label="Benchmark" value={data.wellbeing.who5_percent != null && data.wellbeing.who5_percent < 52 ? "Low — follow up" : data.wellbeing.who5_percent != null && data.wellbeing.who5_percent < 72 ? "Average" : "Good"} />
              </div>
            )}
          </div>
          {/* Satisfaction */}
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-2">Service satisfaction</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SatisfactionCell label="Body-comp scan" cell={data.satisfaction.body_comp} minN={data.min_n} />
              <SatisfactionCell label="Doctor consultation" cell={data.satisfaction.doctor} minN={data.min_n} />
              <SatisfactionCell label="Overall" cell={data.satisfaction.overall} minN={data.min_n} />
            </div>
          </div>
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

function SatisfactionCell({
  label, cell, minN,
}: {
  label: string;
  cell: { n: number; nps?: number; helpful_avg?: number; masked?: boolean };
  minN: number;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      {cell.masked ? (
        <div className="text-sm text-gray-500 mt-2">{cell.n}/{minN} — hidden until {minN}</div>
      ) : (
        <>
          <div className="text-2xl font-bold mt-1 text-gray-900">{cell.nps ?? "—"}</div>
          <div className="text-xs text-gray-500">NPS · helpful {cell.helpful_avg ?? "—"}/5 · n={cell.n}</div>
        </>
      )}
    </div>
  );
}
