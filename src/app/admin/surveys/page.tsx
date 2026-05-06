"use client";

// Surveys hub. Lists every client-feedback survey with its current
// status and quick links into the editor / results. Visible to admin
// and medical_advisor; admin can edit, medical_advisor reviews +
// approves.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  type FeedbackSurvey,
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
} from "@/lib/feedback-survey-types";

interface SendClient {
  id: string;
  email: string | null;
  full_name: string | null;
  company_id: string | null;
}
interface SendCompany {
  id: string;
  name: string;
  employee_count: number;
}
interface SendResultRow {
  client_id: string;
  email: string | null;
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

export default function SurveysHubPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<FeedbackSurvey[]>([]);
  const [counts, setCounts] = useState<Record<string, { sent: number; completed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newError, setNewError] = useState<string | null>(null);

  // Send-survey modal state
  const [sendSurvey, setSendSurvey] = useState<FeedbackSurvey | null>(null);
  const [sendTab, setSendTab] = useState<"clients" | "companies">("clients");
  const [sendClients, setSendClients] = useState<SendClient[]>([]);
  const [sendCompanies, setSendCompanies] = useState<SendCompany[]>([]);
  const [sendClientsLoaded, setSendClientsLoaded] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [clientSearch, setClientSearch] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSummary, setSendSummary] = useState<{ sent: number; skipped: number; failed: number; results: SendResultRow[] } | null>(null);
  const [sending, setSending] = useState(false);

  const cloneSurvey = async (sourceId: string) => {
    if (!confirm("Clone this survey into a new draft (next version)? You'll edit the new copy without affecting the current version.")) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${sourceId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Clone failed");
      router.push(`/admin/surveys/${j.new_id}`);
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  };

  // Duplicate into a brand-new survey under a different key. Useful for
  // building a new survey that starts from an existing one as a template
  // rather than versioning the same key.
  const duplicateSurvey = async (source: FeedbackSurvey) => {
    const defaultKey = `${source.key}-copy`;
    const newKeyRaw = prompt(
      "New key (slug) for the duplicate. Leave blank to cancel.",
      defaultKey,
    );
    if (newKeyRaw === null) return;
    const newKeyClean = newKeyRaw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!newKeyClean) { alert("Key required."); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${source.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_key: newKeyClean, new_version: 1 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Duplicate failed");
      router.push(`/admin/surveys/${j.new_id}`);
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  };

  const openSend = async (s: FeedbackSurvey) => {
    if (s.status !== "approved") {
      alert("Only approved surveys can be sent. Get medical-advisor approval first.");
      return;
    }
    setSendSurvey(s);
    setSendTab("clients");
    setClientSearch("");
    setSelectedClientIds(new Set());
    setSelectedCompanyIds(new Set());
    setSendError(null);
    setSendSummary(null);

    if (sendClientsLoaded) return;
    // Lazy-load clients + companies the first time the modal is opened.
    try {
      const [clientsRes, companiesRes] = await Promise.all([
        supabase
          .from("clients_decrypted")
          .select("id, email, full_name, company_id")
          .order("full_name", { ascending: true })
          .limit(2000),
        supabase
          .from("companies")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);
      const cs = (clientsRes.data || []) as SendClient[];
      const co = ((companiesRes.data || []) as { id: string; name: string }[]).map((c) => ({
        id: c.id,
        name: c.name,
        employee_count: cs.filter((cl) => cl.company_id === c.id && cl.email).length,
      }));
      setSendClients(cs);
      setSendCompanies(co);
      setSendClientsLoaded(true);
    } catch (e) {
      setSendError(`Could not load recipients: ${(e as Error).message}`);
    }
  };

  const closeSend = () => {
    setSendSurvey(null);
    setSendError(null);
    setSendSummary(null);
  };

  const toggleClient = (id: string) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCompany = (id: string) => {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Total recipient count (deduped: clients in selected companies are counted once
  // even if also explicitly selected).
  const recipientPreview = (() => {
    const ids = new Set<string>();
    for (const id of selectedClientIds) ids.add(id);
    for (const c of sendClients) {
      if (c.company_id && selectedCompanyIds.has(c.company_id) && c.email) ids.add(c.id);
    }
    return ids.size;
  })();

  const submitSend = async () => {
    if (!sendSurvey) return;
    if (selectedClientIds.size === 0 && selectedCompanyIds.size === 0) {
      setSendError("Pick at least one client or company.");
      return;
    }
    if (!confirm(`Send "${sendSurvey.title_is}" to ~${recipientPreview} recipient${recipientPreview === 1 ? "" : "s"} now?`)) return;
    setSending(true);
    setSendError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${sendSurvey.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          client_ids: Array.from(selectedClientIds),
          company_ids: Array.from(selectedCompanyIds),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok && !j.summary) throw new Error(j.error || "Send failed");
      setSendSummary({
        sent: j.summary?.sent ?? 0,
        skipped: j.summary?.skipped ?? 0,
        failed: j.summary?.failed ?? 0,
        results: (j.results || []) as SendResultRow[],
      });
      // Refresh count tally so the row's "0/N svör" updates without a full reload.
      setCounts((prev) => {
        if (!sendSurvey) return prev;
        const cur = prev[sendSurvey.id] || { sent: 0, completed: 0 };
        return { ...prev, [sendSurvey.id]: { sent: cur.sent + (j.summary?.sent ?? 0), completed: cur.completed } };
      });
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const createNewSurvey = async () => {
    setNewError(null);
    const key = newKey.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const title = newTitle.trim();
    if (!key) { setNewError("Slug-style key required (e.g. follow-up-3m)."); return; }
    if (!title) { setNewError("Title required."); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, title_is: title }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Create failed");
      router.push(`/admin/surveys/${j.new_id}`);
    } catch (e) {
      setNewError((e as Error).message);
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: staffRow } = await supabase
            .from("staff")
            .select("role")
            .eq("email", user.email)
            .maybeSingle();
          if (!cancelled) setRole((staffRow?.role as string) || null);
        }

        const { data: surveyRows } = await supabase
          .from("feedback_surveys")
          .select("*")
          .order("status", { ascending: true })
          .order("updated_at", { ascending: false });
        if (cancelled) return;
        const list = (surveyRows || []) as FeedbackSurvey[];
        setSurveys(list);

        if (list.length > 0) {
          const ids = list.map((s) => s.id);
          const { data: assignments } = await supabase
            .from("feedback_assignments")
            .select("survey_id, completed_at")
            .in("survey_id", ids);
          const tally: Record<string, { sent: number; completed: number }> = {};
          for (const a of (assignments || []) as { survey_id: string; completed_at: string | null }[]) {
            const t = tally[a.survey_id] || { sent: 0, completed: 0 };
            t.sent += 1;
            if (a.completed_at) t.completed += 1;
            tally[a.survey_id] = t;
          }
          if (!cancelled) setCounts(tally);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isAdmin = role === "admin";
  const isMedicalAdvisor = role === "medical_advisor";
  const canEdit = isAdmin;

  return (
    <div className="px-8 pt-6 pb-12 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Surveys</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed">
            Client surveys initiated by admin after each assessment. The medical advisor approves
            the question structure before any survey can be sent. Once approved, admin sends the
            survey to specific clients via email; results are aggregated here.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => { setNewOpen(true); setNewError(null); setNewKey(""); setNewTitle(""); }}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + New survey
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : surveys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          No surveys yet. Run the migration{" "}
          <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">migration-feedback-surveys.sql</code> to
          seed the default post-assessment survey.
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map((s) => {
            const c = counts[s.id] || { sent: 0, completed: 0 };
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-[#1F2937] truncate">
                        {s.title_is}
                      </h3>
                      <span className="text-xs font-mono text-gray-400">
                        {s.key} v{s.version}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE_CLASS[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {s.estimated_minutes} mín · {c.completed}/{c.sent} svör
                      {s.approved_at && (
                        <>
                          {" · "}
                          approved by {s.approved_by_name || "—"}{" "}
                          {new Date(s.approved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/surveys/${s.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {canEdit ? "Edit" : "Review"}
                    </Link>
                    <Link
                      href={`/admin/surveys/${s.id}/preview`}
                      className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      Preview &amp; test
                    </Link>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => duplicateSurvey(s)}
                        className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                      >
                        Duplicate
                      </button>
                    )}
                    {canEdit && s.status === "approved" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openSend(s)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        Send to clients
                      </button>
                    )}
                    {canEdit && (s.status === "approved" || s.status === "archived") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => cloneSurvey(s.id)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        Clone &amp; edit
                      </button>
                    )}
                    <Link
                      href={`/admin/surveys/${s.id}/results`}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        s.status === "approved"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                          : "text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                      title={s.status === "approved" ? "View aggregated results + CSV export" : "Results page (will show 0 responses until the survey is approved + sent)"}
                    >
                      Results &amp; export
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isMedicalAdvisor && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-900">
          <strong>Velkomin/n.</strong> Open any survey above to review the question structure. Use
          the action buttons at the bottom of the editor to <em>approve</em> or <em>request changes</em>.
          Once approved, results land at the <em>Results &amp; export</em> link on each survey card.
        </div>
      )}

      {newOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setNewOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <header className="px-5 py-4 border-b border-gray-100">
              <h4 className="text-base font-semibold text-[#1F2937]">New survey</h4>
              <p className="text-xs text-gray-500 mt-1">
                Creates an empty draft. You&apos;ll add questions on the next screen, then submit it for medical-advisor approval.
              </p>
            </header>
            <div className="px-5 py-4 space-y-3">
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Key (slug)</span>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. follow-up-3m"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono text-gray-900"
                />
                <span className="block text-[11px] text-gray-400 mt-1">Lowercase letters, numbers, dashes. Becomes part of the URL and CSV filename.</span>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Title (íslenska)</span>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Þjónustukönnun – 3 mánaða eftirfylgd"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                />
              </label>
              {newError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {newError}
                </div>
              )}
            </div>
            <footer className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createNewSurvey}
                disabled={busy}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create draft"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Send-survey modal */}
      {sendSurvey && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !sending) closeSend(); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <header className="px-5 py-4 border-b border-gray-100">
              <h4 className="text-base font-semibold text-[#1F2937]">
                Send &ldquo;{sendSurvey.title_is}&rdquo;
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Each recipient gets a unique link valid for 30 days. Clients with an active outstanding invite for this survey are skipped automatically.
              </p>
            </header>

            {sendSummary ? (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
                    <div className="text-2xl font-bold text-emerald-700">{sendSummary.sent}</div>
                    <div className="text-[11px] uppercase tracking-wide text-emerald-700/80">Sent</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                    <div className="text-2xl font-bold text-amber-700">{sendSummary.skipped}</div>
                    <div className="text-[11px] uppercase tracking-wide text-amber-700/80">Skipped</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                    <div className="text-2xl font-bold text-red-700">{sendSummary.failed}</div>
                    <div className="text-[11px] uppercase tracking-wide text-red-700/80">Failed</div>
                  </div>
                </div>
                {sendSummary.results.some((r) => r.status !== "sent") && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                      Skipped / failed
                    </div>
                    <ul className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
                      {sendSummary.results.filter((r) => r.status !== "sent").map((r) => (
                        <li key={r.client_id} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                          <span className="truncate text-gray-700">{r.email || r.client_id}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            r.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {r.reason || r.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="border-b border-gray-100 px-5 pt-2 flex gap-1">
                  {([
                    { key: "clients", label: "Specific clients" },
                    { key: "companies", label: "Whole companies" },
                  ] as const).map((tab) => {
                    const active = sendTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSendTab(tab.key)}
                        className={`px-3 py-2 text-xs font-semibold transition-colors relative ${
                          active ? "text-emerald-700" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {tab.label}
                        {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-emerald-600" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {!sendClientsLoaded ? (
                    <div className="text-sm text-gray-400">Loading recipients…</div>
                  ) : sendTab === "clients" ? (
                    <div>
                      <input
                        type="search"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        className="w-full px-3 py-2 mb-3 border border-gray-200 rounded-lg text-sm text-gray-900"
                      />
                      <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg max-h-80 overflow-y-auto">
                        {sendClients
                          .filter((c) => {
                            if (!c.email) return false;
                            const q = clientSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              (c.full_name || "").toLowerCase().includes(q) ||
                              (c.email || "").toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 250)
                          .map((c) => {
                            const checked = selectedClientIds.has(c.id);
                            return (
                              <li key={c.id}>
                                <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleClient(c.id)}
                                    className="w-4 h-4"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm text-gray-900 truncate">{c.full_name || "—"}</div>
                                    <div className="text-[11px] text-gray-500 truncate">{c.email}</div>
                                  </div>
                                </label>
                              </li>
                            );
                          })}
                      </ul>
                      <p className="text-[11px] text-gray-400 mt-2">
                        Showing first 250 matches. Refine the search if you don&apos;t see who you&apos;re looking for.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg max-h-96 overflow-y-auto">
                      {sendCompanies.length === 0 && (
                        <li className="px-3 py-4 text-sm text-gray-400 text-center">No companies yet.</li>
                      )}
                      {sendCompanies.map((co) => {
                        const checked = selectedCompanyIds.has(co.id);
                        return (
                          <li key={co.id}>
                            <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCompany(co.id)}
                                className="w-4 h-4"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-gray-900 truncate">{co.name}</div>
                                <div className="text-[11px] text-gray-500">
                                  {co.employee_count} employee{co.employee_count === 1 ? "" : "s"} with email
                                </div>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {sendError && (
                  <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {sendError}
                  </div>
                )}

                <footer className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs text-gray-500">
                    {selectedClientIds.size} client{selectedClientIds.size === 1 ? "" : "s"}
                    {" · "}
                    {selectedCompanyIds.size} compan{selectedCompanyIds.size === 1 ? "y" : "ies"}
                    {" · "}
                    <strong className="text-gray-700">≈ {recipientPreview} total recipient{recipientPreview === 1 ? "" : "s"}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeSend}
                      disabled={sending}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitSend}
                      disabled={sending || (selectedClientIds.size === 0 && selectedCompanyIds.size === 0)}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {sending ? "Sending…" : `Send invites${recipientPreview > 0 ? ` (${recipientPreview})` : ""}`}
                    </button>
                  </div>
                </footer>
              </>
            )}

            {sendSummary && (
              <footer className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setSendSummary(null); setSelectedClientIds(new Set()); setSelectedCompanyIds(new Set()); }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Send another batch
                </button>
                <button
                  type="button"
                  onClick={closeSend}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Done
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
