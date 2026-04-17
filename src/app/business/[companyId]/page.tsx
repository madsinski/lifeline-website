"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LifelineLogo from "@/app/components/LifelineLogo";
import { parseRoster, RosterRow, generatePassword } from "@/lib/parse-roster";
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
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/70 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <LifelineLogo className="w-8 h-8" />
          <span className="font-semibold">Lifeline Health</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{company.name}</span>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </header>

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

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="Roster" value={members.length} />
          <Stat label="Invited" value={totalInvited} />
          <Stat label="Completed" value={totalCompleted} />
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm">
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

        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Employees ({members.length})</h2>
            <SendAllInvitesButton
              memberIds={members
                .filter((m) => !m.completed_at && !m.invited_at)
                .map((m) => m.id)}
              onDone={loadData}
            />
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
    await supabase.from("company_members").delete().eq("id", member.id);
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
      const password = generatePassword();
      const { data: enc, error: encErr } = await supabase.rpc("enc_kennitala", { p_text: parsed.kennitala });
      if (encErr) throw new Error(encErr.message);
      const { data: inserted, error: insErr } = await supabase
        .from("company_members")
        .insert({
          company_id: companyId,
          full_name: parsed.full_name,
          email: parsed.email.toLowerCase(),
          phone: parsed.phone || null,
          kennitala_encrypted: enc,
          invite_password_hash: "pending", // placeholder; replaced by set_member_invite_password below
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      // Hash password server-side
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      await fetch("/api/business/members/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ member_id: inserted!.id, password }),
      });
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="file" accept=".csv,.tsv,.txt" onChange={onFile} className="text-sm" />
        <span className="text-sm text-gray-500 self-center">or paste below:</span>
      </div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={onParse}
        rows={8}
        placeholder={"Name,Kennitala,Email,Phone\nJón Jónsson,1234567890,jon@example.is,7674393"}
        className="input font-mono text-xs"
      />
      <div className="flex gap-2">
        <button onClick={onParse} className="btn-ghost" type="button">Preview</button>
        <button onClick={save} disabled={!validRows.length || saving} className="btn-primary" type="button">
          {saving ? "Adding…" : `Add ${validRows.length} employee${validRows.length === 1 ? "" : "s"}`}
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
