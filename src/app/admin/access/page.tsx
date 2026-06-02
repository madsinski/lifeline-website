"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Kind = "user" | "company" | "group";

interface Grant {
  id: string;
  kind: Kind;
  user_id: string | null;
  company_id: string | null;
  group_tag: string | null;
  label: string | null;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface TokenRow {
  id: string;
  label: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface GroupMember {
  user_id: string;
  group_tag: string;
  added_at: string;
}

interface CompanyOpt { id: string; name: string }

export default function AccessAdminPage() {
  const [tab, setTab] = useState<"grants" | "tokens" | "groups">("grants");

  return (
    <div>
      <div className="px-8 pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Site access</h1>
        <p className="text-sm text-gray-500 mb-4">
          Control who bypasses the coming-soon gate — individual users, whole companies, named
          groups, or one-off shareable links.
        </p>
        <div className="flex gap-1 border-b border-gray-200">
          {(["grants", "tokens", "groups"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t ? "border-emerald-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t === "grants" ? "Grants" : t === "tokens" ? "Invite tokens" : "Groups"}
            </button>
          ))}
        </div>
      </div>
      {tab === "grants" && <GrantsTab />}
      {tab === "tokens" && <TokensTab />}
      {tab === "groups" && <GroupsTab />}
    </div>
  );
}

// ─── GRANTS ─────────────────────────────────────────────────────

function GrantsTab() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);

  // form state
  const [kind, setKind] = useState<Kind>("user");
  const [emailInput, setEmailInput] = useState("");
  const [resolvedUser, setResolvedUser] = useState<{ id: string; email: string; full_name: string | null } | null>(null);
  const [lookupErr, setLookupErr] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [groupTag, setGroupTag] = useState("");
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: gs }, { data: cs }] = await Promise.all([
      supabase.from("access_grants")
        .select("id, kind, user_id, company_id, group_tag, label, active, expires_at, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
    ]);
    setGrants((gs as Grant[]) || []);
    setCompanies((cs as CompanyOpt[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const lookupEmail = async () => {
    setLookupErr("");
    setResolvedUser(null);
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/admin/access/lookup-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) { setLookupErr("No account with that email."); return; }
    setResolvedUser(await res.json());
  };

  const create = async () => {
    setError("");
    const row: Partial<Grant> = {
      kind,
      label: label.trim() || null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };
    if (kind === "user") {
      if (!resolvedUser) { setError("Look up a user first."); return; }
      row.user_id = resolvedUser.id;
    } else if (kind === "company") {
      if (!companyId) { setError("Pick a company."); return; }
      row.company_id = companyId;
    } else {
      const tag = groupTag.trim();
      if (!tag) { setError("Type a group tag (e.g. 'investors')."); return; }
      row.group_tag = tag;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: e } = await supabase.from("access_grants").insert({ ...row, created_by: user?.id ?? null });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setEmailInput(""); setResolvedUser(null); setCompanyId(""); setGroupTag(""); setLabel(""); setExpiresAt("");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this grant?")) return;
    await supabase.from("access_grants").update({ active: false }).eq("id", id);
    load();
  };

  const renderTarget = (g: Grant) => {
    if (g.kind === "user") return `User ${g.user_id?.slice(0, 8)}…`;
    if (g.kind === "company") {
      const c = companies.find((x) => x.id === g.company_id);
      return c ? `${c.name}` : `Company ${g.company_id?.slice(0, 8)}…`;
    }
    return `Group: ${g.group_tag}`;
  };

  return (
    <div className="px-8 py-6 space-y-8 max-w-4xl">
      {/* Create form */}
      <form onSubmit={(e) => { e.preventDefault(); create(); }}
        className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Add grant</h2>
        <div className="flex gap-2">
          {(["user", "company", "group"] as const).map((k) => (
            <button type="button" key={k} onClick={() => setKind(k)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                kind === k ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"
              }`}>
              {k === "user" ? "Single user" : k === "company" ? "Whole company" : "Group tag"}
            </button>
          ))}
        </div>

        {kind === "user" && (
          <div>
            <div className="flex gap-2">
              <input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="user@example.com"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <button type="button" onClick={lookupEmail}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100">Look up</button>
            </div>
            {resolvedUser && (
              <div className="mt-2 text-sm text-emerald-700">
                ✓ {resolvedUser.full_name || resolvedUser.email} ({resolvedUser.email})
              </div>
            )}
            {lookupErr && <p className="text-xs text-red-600 mt-1">{lookupErr}</p>}
          </div>
        )}

        {kind === "company" && (
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
            <option value="">— pick company —</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {kind === "group" && (
          <input value={groupTag} onChange={(e) => setGroupTag(e.target.value)} placeholder="e.g. investors, clinical-advisors"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-gray-500">Label (optional)
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Why this grant exists"
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
          <label className="text-xs text-gray-500">Expires (blank = never)
            <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {saving ? "Saving…" : "Add grant"}
        </button>
      </form>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? <p className="p-6 text-gray-400 text-sm">Loading…</p>
        : grants.length === 0 ? <p className="p-6 text-gray-400 text-sm">No grants yet.</p>
        : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <tr><th className="py-2 px-4">Kind</th><th className="py-2 px-4">Target</th><th className="py-2 px-4">Label</th><th className="py-2 px-4">Expires</th><th className="py-2 px-4">Status</th><th className="py-2 px-4"></th></tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 px-4 capitalize">{g.kind}</td>
                  <td className="py-2 px-4">{renderTarget(g)}</td>
                  <td className="py-2 px-4 text-gray-500">{g.label || "—"}</td>
                  <td className="py-2 px-4 text-gray-500">{g.expires_at ? new Date(g.expires_at).toLocaleString("en-GB") : "—"}</td>
                  <td className="py-2 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${g.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {g.active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-right">
                    {g.active && <button onClick={() => revoke(g.id)} className="text-xs font-medium text-red-600 hover:underline">Revoke</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── TOKENS ─────────────────────────────────────────────────────

function TokensTab() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("access_invite_tokens")
      .select("id, label, expires_at, max_uses, used_count, active, created_at, last_used_at")
      .order("created_at", { ascending: false });
    setTokens((data as TokenRow[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const mint = async () => {
    setError("");
    setNewUrl(null);
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/admin/access/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        label: label.trim(),
        max_uses: maxUses ? Number(maxUses) : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || "Failed"); return; }
    const j = await res.json();
    setNewUrl(j.url);
    setLabel(""); setMaxUses(""); setExpiresAt("");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this token? Anyone already using it will be kicked out.")) return;
    await supabase.from("access_invite_tokens").update({ active: false }).eq("id", id);
    load();
  };

  const copy = async () => {
    if (!newUrl) return;
    try { await navigator.clipboard.writeText(newUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  return (
    <div className="px-8 py-6 space-y-8 max-w-4xl">
      <form onSubmit={(e) => { e.preventDefault(); mint(); }}
        className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Mint a new invite link</h2>
        <p className="text-xs text-gray-500">
          The full URL is shown <strong>once</strong> after minting. Copy it before leaving the page —
          only the SHA-256 hash is stored, so it can&apos;t be recovered later.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-gray-500">Label
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Investor — Acme Capital"
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
          <label className="text-xs text-gray-500">Max uses (blank = ∞)
            <input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
          <label className="text-xs text-gray-500">Expires (blank = never)
            <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {saving ? "Minting…" : "Mint link"}
        </button>

        {newUrl && (
          <div className="mt-2 p-4 rounded-lg bg-emerald-50 border border-emerald-100 space-y-2">
            <p className="text-xs font-semibold text-emerald-800">Copy now — this URL will not be shown again.</p>
            <div className="flex gap-2">
              <input readOnly value={newUrl}
                className="flex-1 px-3 py-2 border border-emerald-200 rounded-lg text-xs font-mono text-gray-800 bg-white" />
              <button type="button" onClick={copy}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? <p className="p-6 text-gray-400 text-sm">Loading…</p>
        : tokens.length === 0 ? <p className="p-6 text-gray-400 text-sm">No invite tokens yet.</p>
        : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <tr><th className="py-2 px-4">Label</th><th className="py-2 px-4">Used</th><th className="py-2 px-4">Expires</th><th className="py-2 px-4">Last used</th><th className="py-2 px-4">Status</th><th className="py-2 px-4"></th></tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 px-4">{t.label || <span className="text-gray-400">(no label)</span>}</td>
                  <td className="py-2 px-4">{t.used_count}{t.max_uses != null ? ` / ${t.max_uses}` : ""}</td>
                  <td className="py-2 px-4 text-gray-500">{t.expires_at ? new Date(t.expires_at).toLocaleString("en-GB") : "—"}</td>
                  <td className="py-2 px-4 text-gray-500">{t.last_used_at ? new Date(t.last_used_at).toLocaleString("en-GB") : "—"}</td>
                  <td className="py-2 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {t.active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-right">
                    {t.active && <button onClick={() => revoke(t.id)} className="text-xs font-medium text-red-600 hover:underline">Revoke</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── GROUPS ─────────────────────────────────────────────────────

function GroupsTab() {
  const [tag, setTag] = useState("investors");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data, error: e } = await supabase.from("user_access_groups")
      .select("user_id, group_tag, added_at").eq("group_tag", tag).order("added_at", { ascending: false });
    if (e) setError(e.message);
    else setMembers((data as GroupMember[]) || []);
  }, [tag]);
  useEffect(() => { load(); }, [load]);

  const addByEmail = async () => {
    setError("");
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/admin/access/lookup-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) { setSaving(false); setError("No account with that email."); return; }
    const u = await res.json();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: e } = await supabase.from("user_access_groups").insert({
      user_id: u.id, group_tag: tag, added_by: user?.id ?? null,
    });
    setSaving(false);
    if (e && !e.message.includes("duplicate")) { setError(e.message); return; }
    setEmailInput("");
    load();
  };

  const remove = async (userId: string) => {
    if (!confirm(`Remove user from group "${tag}"?`)) return;
    await supabase.from("user_access_groups").delete().eq("user_id", userId).eq("group_tag", tag);
    load();
  };

  return (
    <div className="px-8 py-6 space-y-6 max-w-4xl">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Manage group membership</h2>
        <p className="text-xs text-gray-500">
          Anyone added here gets site access whenever a Grant exists for the matching tag.
        </p>
        <label className="block text-xs text-gray-500">Group tag
          <input value={tag} onChange={(e) => setTag(e.target.value.trim())}
            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
        </label>
        <div className="flex gap-2">
          <input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="user@example.com"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          <button type="button" onClick={addByEmail} disabled={saving || !tag}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? "Adding…" : "Add to group"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {members.length === 0 ? <p className="p-6 text-gray-400 text-sm">No members in <code>{tag}</code> yet.</p>
        : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <tr><th className="py-2 px-4">User</th><th className="py-2 px-4">Added</th><th className="py-2 px-4"></th></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 px-4 font-mono text-xs text-gray-700">{m.user_id}</td>
                  <td className="py-2 px-4 text-gray-500">{new Date(m.added_at).toLocaleString("en-GB")}</td>
                  <td className="py-2 px-4 text-right">
                    <button onClick={() => remove(m.user_id)} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
