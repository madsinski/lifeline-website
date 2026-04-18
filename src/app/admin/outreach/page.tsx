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
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Consent</th>
                  <th className="px-4 py-3">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
