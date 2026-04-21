"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Segment = "marketing" | "research" | "both" | "all";

interface OutreachClient {
  id: string;
  full_name: string | null;
  email: string;
  research_opt_out: boolean;
  marketing_opt_out: boolean;
  company_id: string | null;
  company_name: string | null;
  created_at: string;
}

interface CompanyRow {
  id: string;
  name: string;
}

const segmentInfo: Record<Segment, { label: string; desc: string; color: string }> = {
  marketing: {
    label: "Marketing eligible",
    desc: "Clients who have NOT opted out of marketing emails.",
    color: "emerald",
  },
  research: {
    label: "Research eligible",
    desc: "Clients who have NOT opted out of research use of their anonymised data.",
    color: "blue",
  },
  both: {
    label: "Marketing + Research",
    desc: "Clients eligible for both marketing and research use.",
    color: "purple",
  },
  all: {
    label: "All clients",
    desc: "Every client, regardless of consent. For reference / compliance audit.",
    color: "gray",
  },
};

export default function OutreachPage() {
  const [segment, setSegment] = useState<Segment>("marketing");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<OutreachClient[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCount, setCopiedCount] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendSubject, setSendSubject] = useState("");
  const [senderName, setSenderName] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; skipped_opted_out: number; skipped_no_email: number; failures: Array<{ email: string; error: string }> } | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [clientsRes, companiesRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, email, research_opt_out, marketing_opt_out, company_id, created_at")
        .not("email", "is", null)
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
    ]);
    const companyList = (companiesRes.data || []) as CompanyRow[];
    const companyMap = new Map(companyList.map((c) => [c.id, c.name]));
    const rows = ((clientsRes.data || []) as Array<Omit<OutreachClient, "company_name">>).map((c) => ({
      ...c,
      company_name: c.company_id ? companyMap.get(c.company_id) || null : null,
    }));
    setClients(rows);
    setCompanies(companyList);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (segment === "marketing" && c.marketing_opt_out) return false;
      if (segment === "research" && c.research_opt_out) return false;
      if (segment === "both" && (c.marketing_opt_out || c.research_opt_out)) return false;
      if (companyFilter !== "all") {
        if (companyFilter === "none" && c.company_id) return false;
        if (companyFilter !== "none" && c.company_id !== companyFilter) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        if (!c.email.toLowerCase().includes(q) && !(c.full_name || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [clients, segment, companyFilter, query]);

  const copyEmails = async () => {
    const emails = filtered.map((c) => c.email).join(", ");
    try {
      await navigator.clipboard.writeText(emails);
      setCopiedCount(filtered.length);
      setTimeout(() => setCopiedCount(null), 2500);
    } catch {
      alert("Clipboard copy failed — use export CSV.");
    }
  };

  const exportCsv = () => {
    const header = ["name", "email", "company", "marketing_opt_out", "research_opt_out", "created_at"];
    const rows = filtered.map((c) => [
      csv(c.full_name || ""),
      csv(c.email),
      csv(c.company_name || ""),
      c.marketing_opt_out ? "yes" : "no",
      c.research_opt_out ? "yes" : "no",
      c.created_at,
    ].join(","));
    const blob = new Blob(["\ufeff" + [header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-${segment}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    const marketing = clients.filter((c) => !c.marketing_opt_out).length;
    const research = clients.filter((c) => !c.research_opt_out).length;
    const both = clients.filter((c) => !c.marketing_opt_out && !c.research_opt_out).length;
    return { marketing, research, both, all: clients.length };
  }, [clients]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredEligible = filtered.filter((c) => !c.marketing_opt_out);
  const allSelected = allFilteredEligible.length > 0 && allFilteredEligible.every((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const c of allFilteredEligible) next.delete(c.id);
        return next;
      }
      const next = new Set(prev);
      for (const c of allFilteredEligible) next.add(c.id);
      return next;
    });
  };

  const openSendModal = () => {
    if (!selectedIds.size) return;
    setSendResult(null);
    setShowSendModal(true);
  };

  const sendB2bIntro = async () => {
    if (!selectedIds.size) return;
    setSending(true);
    setSendResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch("/api/admin/outreach/send-b2b-intro", {
        method: "POST",
        headers,
        body: JSON.stringify({
          recipient_ids: Array.from(selectedIds),
          subject: sendSubject.trim() || undefined,
          sender_name: senderName.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(`Send failed: ${j.detail || j.error || "unknown"}`);
      } else {
        setSendResult(j);
      }
    } catch (e) {
      alert(`Send error: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Outreach</h1>
        <p className="text-sm text-gray-600 mt-1">
          Pick a segment based on client consent. Filter by company, search by name or email,
          then copy the list or export CSV.
        </p>
      </header>

      {/* Segment selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(segmentInfo) as Segment[]).map((s) => {
          const active = segment === s;
          const count = totals[s];
          const info = segmentInfo[s];
          return (
            <button
              key={s}
              onClick={() => setSegment(s)}
              className={`text-left rounded-xl border-2 p-4 transition-colors ${
                active
                  ? `border-${info.color}-500 bg-${info.color}-50`
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
              style={active ? { borderColor: colorMap[info.color], background: `${colorMap[info.color]}15` } : {}}
            >
              <div className="text-xs font-semibold tracking-wider uppercase text-gray-500 mb-1">
                {info.label}
              </div>
              <div className="text-3xl font-semibold text-gray-900">{count}</div>
              <div className="text-xs text-gray-500 mt-2">{info.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
        />
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All clients</option>
          <option value="none">Not in a company (direct signups)</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button onClick={copyEmails} disabled={!filtered.length} className="btn-action">
          {copiedCount !== null ? `Copied ${copiedCount}!` : `Copy ${filtered.length} emails`}
        </button>
        <button onClick={exportCsv} disabled={!filtered.length} className="btn-action">
          Export CSV
        </button>
        <button
          onClick={openSendModal}
          disabled={!selectedIds.size}
          className="btn-action"
          title={selectedIds.size ? `Send B2B intro to ${selectedIds.size} selected` : "Select clients first"}
        >
          Send B2B intro ({selectedIds.size})
        </button>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-gray-500">
            No clients match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      title={allSelected ? "Deselect all (visible, marketing-eligible)" : "Select all (visible, marketing-eligible)"}
                    />
                  </th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Consent</th>
                  <th className="px-4 py-3">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const marketingBlocked = c.marketing_opt_out;
                  return (
                  <tr key={c.id} className={`border-t border-gray-100 hover:bg-gray-50 ${selectedIds.has(c.id) ? "bg-emerald-50/40" : ""}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => !marketingBlocked && toggleOne(c.id)}
                        disabled={marketingBlocked}
                        title={marketingBlocked ? "Client has opted out of marketing" : "Select"}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{c.full_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">{c.email}</td>
                    <td className="px-4 py-3 text-gray-700">{c.company_name || "—"}</td>
                    <td className="px-4 py-3 space-x-1">
                      {!c.marketing_opt_out && <Badge color="emerald">Marketing</Badge>}
                      {!c.research_opt_out && <Badge color="blue">Research</Badge>}
                      {c.marketing_opt_out && c.research_opt_out && <Badge color="gray">Opted out</Badge>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send B2B intro modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !sending && setShowSendModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Send B2B intro</h2>
              <button onClick={() => !sending && setShowSendModal(false)} className="text-gray-400 hover:text-gray-600" disabled={sending}>✕</button>
            </div>
            {sendResult ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 text-sm">
                  Sent to <strong>{sendResult.sent}</strong> recipient{sendResult.sent === 1 ? "" : "s"}.
                </div>
                {(sendResult.skipped_opted_out > 0 || sendResult.skipped_no_email > 0) && (
                  <div className="text-xs text-gray-500">
                    Skipped: {sendResult.skipped_opted_out} opted out of marketing, {sendResult.skipped_no_email} missing email.
                  </div>
                )}
                {sendResult.failures.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-xs">
                    <p className="font-medium mb-1">{sendResult.failures.length} failed:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {sendResult.failures.slice(0, 10).map((f, i) => (
                        <li key={i}><span className="font-mono">{f.email}</span> — {f.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={() => { setShowSendModal(false); setSelectedIds(new Set()); }}
                  className="w-full py-2.5 rounded-lg bg-gray-900 text-white font-medium"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Sending the Lifeline for Business introduction (with a signup-funnel link) to <strong>{selectedIds.size}</strong> selected client{selectedIds.size === 1 ? "" : "s"}.
                  Recipients who have opted out of marketing are automatically skipped server-side.
                </p>
                <label className="block text-xs text-gray-500">Custom subject (optional — leave blank for default)
                  <input
                    type="text"
                    value={sendSubject}
                    onChange={(e) => setSendSubject(e.target.value)}
                    placeholder="Lifeline for [first name]'s workplace — 2-minute intro"
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                  />
                </label>
                <label className="block text-xs text-gray-500">Signed by (optional)
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. Mads — defaults to 'The Lifeline team'"
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                  />
                </label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                  Email body is the standard B2B intro with a link to <code>/business/signup?ref=outreach</code> and a secondary link to <code>/business</code>. Clients click through to start the onboarding funnel.
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowSendModal(false)} disabled={sending} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={sendB2bIntro} disabled={sending} className="btn-action px-5 py-2">
                    {sending ? "Sending…" : `Send to ${selectedIds.size}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .btn-action {
          padding: 0.5rem 0.875rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          background: linear-gradient(135deg, #3b82f6, #10b981);
          color: white;
          transition: opacity .15s;
        }
        .btn-action:disabled { opacity: .4; cursor: not-allowed; }
        .btn-action:hover:not(:disabled) { opacity: .9; }
      `}</style>
    </div>
  );
}

const colorMap: Record<string, string> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  gray: "#6b7280",
};

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-800",
    blue: "bg-blue-100 text-blue-800",
    gray: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

function csv(v: string): string {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
