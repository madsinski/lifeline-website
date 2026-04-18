"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface CompanyRow {
  id: string;
  name: string;
  contact_person_id: string;
  contact_email: string | null;
  created_at: string;
  member_count: number;
  invited_count: number;
  completed_count: number;
  default_tier?: string | null;
}

const TIERS = [
  { value: "", label: "— none —" },
  { value: "free-trial", label: "Free" },
  { value: "self-maintained", label: "Self-maintained" },
  { value: "full-access", label: "Full Access" },
];

function BulkActivateButton({ companyId }: { companyId: string }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (!confirm("Bulk-activate Biody profiles for every un-activated employee in this company?")) return;
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch("/api/admin/biody/bulk-activate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ company_id: companyId }),
    });
    const j = await res.json();
    alert(`Processed ${j.processed ?? 0} · succeeded ${j.succeeded ?? 0} · failed ${j.failed ?? 0}`);
    setBusy(false);
  };
  return (
    <button onClick={click} disabled={busy} className="text-emerald-600 hover:underline disabled:opacity-50">
      {busy ? "Activating…" : "Activate Biody"}
    </button>
  );
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    console.log("[admin/companies] user:", user?.id, user?.email);
    const [rpcRes, tiersRes, staffRes] = await Promise.all([
      supabase.rpc("list_all_companies"),
      supabase.from("companies").select("id, default_tier"),
      supabase.from("staff").select("id, active").eq("id", user?.id ?? "").maybeSingle(),
    ]);
    console.log("[admin/companies] rpc:", rpcRes);
    console.log("[admin/companies] direct companies select:", tiersRes);
    console.log("[admin/companies] staff row:", staffRes);
    if (rpcRes.error) setError(rpcRes.error.message);
    else {
      const tierMap = new Map<string, string | null>((tiersRes.data || []).map((t: { id: string; default_tier: string | null }) => [t.id, t.default_tier]));
      const rows = ((rpcRes.data || []) as CompanyRow[]).map((c) => ({ ...c, default_tier: tierMap.get(c.id) || null }));
      setCompanies(rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const downloadCsv = async (companyId: string, companyName: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`/api/admin/companies/${companyId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { alert("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${companyName.replace(/[^a-z0-9]+/gi, "-")}-roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Companies</h1>
        <Link href="/business/signup" className="text-sm text-blue-600 hover:underline">+ Create a company</Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Update default tier to auto-enrol new employees, or bulk-activate all Biody profiles for a company.
      </p>
      {loading && <div className="text-gray-500">Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && companies.length === 0 && (
        <div className="text-gray-500">No companies yet.</div>
      )}
      {companies.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Roster</th>
                <th className="px-4 py-3">Invited</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Default tier</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/business/${c.id}`} className="hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.contact_email || "—"}</td>
                  <td className="px-4 py-3">{c.member_count}</td>
                  <td className="px-4 py-3">{c.invited_count}</td>
                  <td className="px-4 py-3">{c.completed_count}</td>
                  <td className="px-4 py-3">
                    <select
                      value={c.default_tier || ""}
                      onChange={async (e) => {
                        const tier = e.target.value || null;
                        await supabase.from("companies").update({ default_tier: tier }).eq("id", c.id);
                        setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, default_tier: tier } : x));
                      }}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <BulkActivateButton companyId={c.id} />
                    <button onClick={() => downloadCsv(c.id, c.name)} className="ml-3 text-blue-600 hover:underline">
                      Export CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
