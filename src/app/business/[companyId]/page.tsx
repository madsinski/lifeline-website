"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BusinessHeader from "../BusinessHeader";
import OnboardingChecklist from "./OnboardingChecklist";
import { parseRoster, RosterRow } from "@/lib/parse-roster";
import { formatKennitala } from "@/lib/kennitala";

interface Company {
  id: string;
  name: string;
  agreement_version: string;
  created_at: string;
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

export default function BusinessDashboardPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params?.companyId;

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showSingle, setShowSingle] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("companies").select("id, name, agreement_version, created_at").eq("id", companyId).maybeSingle(),
      supabase.rpc("list_company_members", { p_company_id: companyId }),
    ]);
    if (!c) {
      setError("Company not found or you don't have access.");
      setLoading(false);
      return;
    }
    setCompany(c as Company);
    setMembers((m || []) as Member[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/business/signup");
        return;
      }
      loadData();
    });
  }, [loadData, router]);

  const totalInvited = members.filter((m) => m.invited_at).length;
  const totalCompleted = members.filter((m) => m.completed_at).length;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <BusinessHeader
        currentCompanyId={company.id}
        crumbs={[
          { label: "Business", href: "/business" },
          { label: company.name },
        ]}
      />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <section className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-sm text-gray-600">Employee onboarding dashboard</p>
          </div>
          <button
            onClick={async () => {
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
              a.download = `${company.name.replace(/[^a-z0-9]+/gi, "-")}-roster.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn-ghost"
          >
            Export CSV
          </button>
        </section>

        <OnboardingChecklist
          companyId={companyId!}
          memberCount={members.length}
          completedCount={totalCompleted}
        />

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="Roster" value={members.length} />
          <Stat label="Invited" value={totalInvited} />
          <Stat label="Completed" value={totalCompleted} />
        </section>

        <section id="add-employees-section" className="bg-white rounded-2xl p-6 shadow-sm scroll-mt-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Add employees</h2>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => { setShowSingle(true); setShowImport(false); }}>
                + One by one
              </button>
              <button className="btn-ghost" onClick={() => { setShowImport(true); setShowSingle(false); }}>
                Upload / paste CSV
              </button>
            </div>
          </div>

          {showSingle && (
            <SingleRowForm
              companyId={companyId!}
              onDone={() => { setShowSingle(false); loadData(); }}
            />
          )}
          {showImport && (
            <ImportForm
              companyId={companyId!}
              onDone={() => { setShowImport(false); loadData(); }}
            />
          )}
          {!showSingle && !showImport && (
            <p className="text-sm text-gray-600">
              Choose <strong>One by one</strong> for a single employee, or <strong>Upload / paste CSV</strong>{" "}
              to add many at once. Columns: <code>name, kennitala, email, phone</code>.
            </p>
          )}
        </section>

        <AdminsSection companyId={companyId!} />

        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Employees ({members.length})</h2>
            <div className="flex gap-2">
              <RemindStaleButton
                memberIds={members
                  .filter((m) => !m.completed_at && !!m.invited_at && Date.now() - new Date(m.invited_at).getTime() > 3 * 86_400_000)
                  .map((m) => m.id)}
                onDone={loadData}
              />
              <SendAllInvitesButton
                memberIds={members
                  .filter((m) => !m.completed_at && !m.invited_at)
                  .map((m) => m.id)}
                onDone={loadData}
              />
            </div>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500">No employees yet. Add some above.</p>
          ) : (
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
          )}
        </section>
      </main>

      <style jsx global>{`
        .input { width:100%; padding:0.5rem 0.75rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; }
        .input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
        .btn-primary { background:linear-gradient(135deg,#3b82f6,#10b981); color:white; padding:0.6rem 1rem; border-radius:0.6rem; font-weight:600; }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
        .btn-ghost { padding:0.5rem 0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; font-size:0.875rem; background:white; }
        .btn-ghost:hover { background:#f9fafb; }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function AdminsSection({ companyId }: { companyId: string }) {
  interface Admin { user_id: string; email: string | null; added_at: string; is_primary: boolean }
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_company_admins", { p_company_id: companyId });
    if (error) setError(error.message);
    else setAdmins((data || []) as Admin[]);
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

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-1">Company admins</h2>
      <p className="text-sm text-gray-500 mb-4">
        Co-admins can manage the roster and send invites. The primary admin is the original contact person.
      </p>

      <form onSubmit={addAdmin} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="co-admin@example.is"
          required
          className="input flex-1"
        />
        <button type="submit" disabled={loading} className="btn-primary text-sm">
          {loading ? "Inviting…" : "Invite co-admin"}
        </button>
      </form>
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
        {admins.length === 0 && <div className="p-3 text-sm text-gray-500">Loading…</div>}
        {admins.map((a) => (
          <div key={a.user_id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <span className="font-medium">{a.email || "(unknown)"}</span>
              {a.is_primary && <span className="ml-2 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Primary</span>}
            </div>
            {!a.is_primary && (
              <div className="flex items-center gap-3">
                <button onClick={() => promote(a.user_id, a.email)} className="text-sm text-blue-600 hover:underline">Make primary</button>
                <button onClick={() => removeAdmin(a.user_id)} className="text-sm text-red-600 hover:underline">Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
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

  return (
    <tr className="border-b border-gray-100">
      <td className="py-3 pr-4 font-medium">{member.full_name}</td>
      <td className="py-3 pr-4 text-gray-700">{member.email}</td>
      <td className="py-3 pr-4 text-gray-500">•••••{member.kennitala_last4 || ""}</td>
      <td className="py-3 pr-4 text-gray-700">{member.phone || "—"}</td>
      <td className="py-3 pr-4">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
      </td>
      <td className="py-3 pr-4">
        <DataStatus
          completed={!!member.completed_at}
          profileComplete={member.profile_complete ?? false}
          biodyActivated={member.biody_activated ?? false}
        />
      </td>
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

function DataStatus({
  completed, profileComplete, biodyActivated,
}: { completed: boolean; profileComplete: boolean; biodyActivated: boolean }) {
  if (!completed) {
    return <span className="inline-flex items-center gap-1 text-xs text-gray-400">—</span>;
  }
  if (profileComplete && biodyActivated) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        Ready
      </span>
    );
  }
  if (profileComplete && !biodyActivated) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700" title="Profile saved but Biody patient not yet created — use Activate Biody">
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        Needs activation
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700" title="Missing fields: sex, height, weight, or activity">
      <span className="w-2 h-2 rounded-full bg-red-500"></span>
      Incomplete
    </span>
  );
}

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
        // Clean success — close the panel
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
    // Prefix the UTF-8 BOM so Excel opens Icelandic characters correctly.
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
          rows={8}
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
