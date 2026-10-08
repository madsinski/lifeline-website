"use client";

// Intruder watch — findings from the hourly account scan
// (src/lib/intruder-scan.ts). Admin-only. Everything goes through
// /api/admin/security/findings.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStaffGuard } from "@/lib/useStaffGuard";

interface SecurityFinding {
  id: string;
  rule: string;
  severity: "critical" | "high" | "medium";
  user_id: string | null;
  email: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
  status: "open" | "dismissed" | "resolved";
  action_taken: string | null;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_by_email: string | null;
}

const SEVERITY_STYLES: Record<SecurityFinding["severity"], string> = {
  critical: "bg-red-200 text-red-900",
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
};

const RULE_LABELS: Record<string, string> = {
  oast_email: "Scanner signup",
  disposable_email: "Throwaway inbox",
  generated_domain: "Generated domain",
  injection_payload: "Injection probe",
  staff_role_claim: "Claims staff role",
  new_staff: "New staff account",
  signup_burst: "Signup burst",
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SecurityPage() {
  const guard = useStaffGuard({ role: "admin" });
  const [rows, setRows] = useState<SecurityFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const call = useCallback(async (init?: { body: Record<string, unknown> }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/security/findings", {
      method: init ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: init ? JSON.stringify(init.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await call();
      setRows(json.findings as SecurityFinding[]);
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    if (guard.authorized) load();
  }, [guard.authorized, load]);

  const scanNow = async () => {
    setBusy("scan");
    setMessage(null);
    try {
      const r = await call({ body: { action: "scan" } });
      setMessage({
        type: "ok",
        text: `Checked ${r.scanned} accounts — ${r.new} new finding${r.new === 1 ? "" : "s"}${r.banned?.length ? `, blocked ${r.banned.join(", ")}` : ""}.`,
      });
      await load();
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const act = async (f: SecurityFinding, action: "dismiss" | "reopen" | "ban" | "unban" | "delete") => {
    if (action === "delete" && !confirm(`Delete the account ${f.email} and everything it owns? This cannot be undone.`)) return;
    setBusy(f.id);
    setMessage(null);
    try {
      await call({ body: { id: f.id, action } });
      await load();
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(() => ({
    open: rows.filter((r) => r.status === "open").length,
    closed: rows.filter((r) => r.status !== "open").length,
    all: rows.length,
  }), [rows]);

  const visible = useMemo(() => {
    if (statusFilter === "open") return rows.filter((r) => r.status === "open");
    if (statusFilter === "closed") return rows.filter((r) => r.status !== "open");
    return rows;
  }, [rows, statusFilter]);

  if (guard.loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  if (!guard.authorized) return <div className="p-8 text-center text-red-600 text-sm">Admin access required.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">Intruder watch</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          Every hour all accounts are checked for scanner-generated signups, injection probes,
          accounts that claim staff rights, new staff accounts and signup bursts. Accounts on
          scanner domains are blocked from signing in automatically; deleting is your call.
          New findings are emailed once.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {([
            { key: "open", label: `Open (${counts.open})` },
            { key: "closed", label: `Closed (${counts.closed})` },
            { key: "all", label: `All (${counts.all})` },
          ] as const).map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === s.key ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={scanNow}
          disabled={busy === "scan"}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === "scan" ? "Scanning…" : "Scan now"}
        </button>
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${
            message.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
          {statusFilter === "open" ? "Nothing open. The last scan found no new signs of an intruder." : "No findings here."}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((f) => {
            const rowBusy = busy === f.id;
            const banned = f.action_taken === "banned";
            const deleted = f.action_taken === "deleted";
            return (
              <li key={f.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${SEVERITY_STYLES[f.severity]}`}>
                    {f.severity}
                  </span>
                  <div className="flex-1 min-w-[240px]">
                    <div className="text-sm font-semibold text-[#1F2937] break-all">
                      {f.email || RULE_LABELS[f.rule] || f.rule}
                    </div>
                    <div className="text-sm text-gray-700 mt-0.5">{f.summary}</div>
                    <div className="text-xs text-gray-500 mt-1.5 flex gap-x-3 gap-y-1 flex-wrap">
                      <span>{RULE_LABELS[f.rule] || f.rule}</span>
                      <span>Found {formatWhen(f.first_seen_at)}</span>
                      {f.user_id && <span>Last sign-in: {formatWhen(f.detail?.last_sign_in_at as string | null)}</span>}
                      {banned && <span className="text-emerald-700 font-medium">Sign-in blocked</span>}
                      {deleted && <span className="text-emerald-700 font-medium">Account deleted</span>}
                      {f.status !== "open" && (
                        <span>
                          {f.status === "dismissed" ? "Dismissed" : "Resolved"} {formatWhen(f.resolved_at)}
                          {f.resolved_by_email ? ` by ${f.resolved_by_email}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setOpenId(openId === f.id ? null : f.id)}
                      aria-expanded={openId === f.id}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100"
                    >
                      {openId === f.id ? "Hide details" : "Details"}
                    </button>
                    {f.status === "open" && f.user_id && !deleted && (
                      <>
                        <button
                          onClick={() => act(f, banned ? "unban" : "ban")}
                          disabled={rowBusy}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          {banned ? "Unblock" : "Block sign-in"}
                        </button>
                        <button
                          onClick={() => act(f, "delete")}
                          disabled={rowBusy}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Delete account
                        </button>
                      </>
                    )}
                    {f.status === "open" ? (
                      <button
                        onClick={() => act(f, "dismiss")}
                        disabled={rowBusy}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    ) : !deleted && (
                      <button
                        onClick={() => act(f, "reopen")}
                        disabled={rowBusy}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
                {openId === f.id && (
                  <pre className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify({ user_id: f.user_id, ...f.detail }, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
