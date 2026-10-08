// Intruder scan — looks through every account for signs that it was
// created by a scanner, a pentest tool or someone probing for access,
// and for staff rights that appeared without anyone granting them.
//
// Server-only (uses the service-role client). Called hourly by
// /api/cron/intruder-scan and on demand from /admin/security.
// Findings are stored in public.security_findings
// (supabase/migration-security-findings.sql).
//
// What prompted it: an account registered from an *.oastify.com
// address (Burp Suite's out-of-band callback domain) — i.e. somebody
// pointed a web-vulnerability scanner at the signup form.

import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin";
import { sendEmail } from "./email";

export type Severity = "critical" | "high" | "medium";

export interface Finding {
  fingerprint: string;
  rule: string;
  severity: Severity;
  user_id: string | null;
  email: string | null;
  summary: string;
  detail: Record<string, unknown>;
}

// Out-of-band callback domains used by vulnerability scanners. No real
// person has a mailbox on these, so a match is treated as hostile.
export const OAST_DOMAINS = [
  "oastify.com", "burpcollaborator.net", "interact.sh", "interactsh.com",
  "oast.pro", "oast.live", "oast.site", "oast.online", "oast.fun", "oast.me",
  "dnslog.cn", "ceye.io", "canarytokens.com", "requestbin.net", "pipedream.net",
  "webhook.site", "xss.ht", "bxss.me",
];

// Throwaway inboxes. Not proof of an attack, but worth a look.
export const DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "grr.la", "sharklasers.com",
  "10minutemail.com", "tempmail.com", "temp-mail.org", "tmpmail.org", "tempail.com",
  "yopmail.com", "trashmail.com", "getnada.com", "dispostable.com", "maildrop.cc",
  "throwawaymail.com", "mailnesia.com", "fakeinbox.com", "emailondeck.com", "moakt.com",
  "mohmal.com", "mail.tm", "1secmail.com", "minuteinbox.com",
];

const STAFF_ROLES = ["admin", "coach", "doctor", "nurse", "psychologist", "lawyer", "medical_advisor"];

// Injection probes: script/HTML, template expressions, path traversal,
// SQL fragments, header injection.
const PAYLOAD_RE =
  /<\s*(script|img|svg|iframe)\b|javascript:|\bon(error|load|click)\s*=|\$\{|\{\{|\.\.\/|\bunion\s+select\b|'\s*(or|and)\s+['\d]|'\s*--|;\s*(drop|select|insert)\b|%0[ad]|[\r\n]|\bsleep\(\d|\bwaitfor\s+delay\b/i;

const SIGNUP_BURST_THRESHOLD = 8;
const NEW_STAFF_WINDOW_MS = 72 * 60 * 60 * 1000;
// Far enough out to be permanent; lifted again with ban_duration "none".
export const BAN_DURATION = "876000h";

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

function inList(domain: string, list: string[]): boolean {
  return list.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function isOastEmail(email: string): boolean {
  return inList(domainOf(email), OAST_DOMAINS);
}

/** A long digit-and-letter label like hbwi6wtwulbt7tl8dcsk7rfshjn9by — generated, not chosen. */
function looksMachineGenerated(email: string): boolean {
  const labels = domainOf(email).split(".").slice(0, -1);
  return labels.some((l) => l.length >= 20 && /^[a-z0-9]+$/.test(l) && (l.match(/\d/g) || []).length >= 3);
}

function hasPayload(value: unknown): boolean {
  if (typeof value === "string") return PAYLOAD_RE.test(value);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasPayload);
  return false;
}

async function listAllAuthUsers(): Promise<User[]> {
  const PER_PAGE = 200;
  const all: User[] = [];
  for (let page = 1; page < 500; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`listUsers: ${error.message}`);
    all.push(...(data?.users || []));
    if (!data?.users?.length || data.users.length < PER_PAGE) break;
  }
  return all;
}

function accountSnapshot(u: User): Record<string, unknown> {
  return {
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at || null,
    email_confirmed_at: u.email_confirmed_at || null,
    invited_at: u.invited_at || null,
    providers: u.app_metadata?.providers || null,
    user_metadata: u.user_metadata || null,
  };
}

/** Pure detection pass — no writes. */
export async function detectIntruders(): Promise<{ findings: Finding[]; staffEmails: Set<string>; scanned: number }> {
  const users = await listAllAuthUsers();

  const { data: staffRows, error: staffErr } = await supabaseAdmin
    .from("staff")
    .select("id, email, name, role, active, created_at");
  if (staffErr) throw new Error(`staff: ${staffErr.message}`);
  const staff = (staffRows || []) as { id: string; email: string; name: string | null; role: string; active: boolean; created_at: string | null }[];
  const staffEmails = new Set(staff.map((s) => (s.email || "").toLowerCase()));

  // Names live encrypted in clients; the decrypted view is the only way to read them.
  const { data: clientRows } = await supabaseAdmin.from("clients_decrypted").select("id, full_name");
  const nameById = new Map<string, string>();
  for (const c of (clientRows || []) as { id: string; full_name: string | null }[]) {
    if (c.full_name) nameById.set(c.id, c.full_name);
  }

  const findings: Finding[] = [];
  const add = (rule: string, severity: Severity, u: User | null, key: string, summary: string, extra: Record<string, unknown> = {}) => {
    findings.push({
      fingerprint: `${rule}:${key}`,
      rule,
      severity,
      user_id: u?.id || null,
      email: u?.email || null,
      summary,
      detail: { ...(u ? accountSnapshot(u) : {}), ...extra },
    });
  };

  for (const u of users) {
    const email = (u.email || "").toLowerCase();
    if (!email) continue;
    const isStaffAccount = staffEmails.has(email);

    if (isOastEmail(email)) {
      add("oast_email", "critical", u, u.id,
        `Registered from ${domainOf(email)}, a vulnerability-scanner callback domain. Somebody ran a scanner against signup.`);
    } else if (inList(domainOf(email), DISPOSABLE_DOMAINS)) {
      add("disposable_email", "medium", u, u.id, `Registered with a throwaway inbox (${domainOf(email)}).`);
    } else if (looksMachineGenerated(email)) {
      add("generated_domain", "medium", u, u.id, `Email domain looks machine-generated (${domainOf(email)}).`);
    }

    const name = nameById.get(u.id);
    if (hasPayload(email) || hasPayload(u.user_metadata) || hasPayload(name)) {
      add("injection_payload", "high", u, u.id,
        "Email, name or signup metadata contains an injection probe (script, template, SQL or path-traversal fragment).",
        { full_name: name || null });
    }

    // Signup lets the caller set user_metadata, and handle_new_user()
    // treats metadata.role as "this is a staff invite". Claiming a staff
    // role there without a staff row is an attempt at privilege escalation.
    const claimedRole = typeof u.user_metadata?.role === "string" ? (u.user_metadata.role as string) : null;
    if (claimedRole && STAFF_ROLES.includes(claimedRole) && !isStaffAccount) {
      add("staff_role_claim", "high", u, u.id,
        `Account claims the staff role “${claimedRole}” in its signup metadata but is not in the staff table.`);
    }
  }

  // New staff rows — the tripwire for someone granting themselves access.
  const now = Date.now();
  for (const s of staff) {
    if (!s.created_at || now - new Date(s.created_at).getTime() > NEW_STAFF_WINDOW_MS) continue;
    const u = users.find((x) => (x.email || "").toLowerCase() === (s.email || "").toLowerCase()) || null;
    findings.push({
      fingerprint: `new_staff:${s.id}`,
      rule: "new_staff",
      severity: "high",
      user_id: u?.id || null,
      email: s.email,
      summary: `New staff account: ${s.name || s.email} (${s.role}${s.active ? "" : ", inactive"}). Dismiss if you added this person.`,
      detail: { staff_id: s.id, role: s.role, active: s.active, staff_created_at: s.created_at, ...(u ? accountSnapshot(u) : {}) },
    });
  }

  // Signup bursts in the last 24h. Invited users (B2B bulk invites) don't count.
  const buckets = new Map<string, User[]>();
  for (const u of users) {
    if (u.invited_at || !u.created_at) continue;
    if (now - new Date(u.created_at).getTime() > 24 * 60 * 60 * 1000) continue;
    const hour = u.created_at.slice(0, 13);
    buckets.set(hour, [...(buckets.get(hour) || []), u]);
  }
  for (const [hour, list] of buckets) {
    if (list.length < SIGNUP_BURST_THRESHOLD) continue;
    findings.push({
      fingerprint: `signup_burst:${hour}`,
      rule: "signup_burst",
      severity: "medium",
      user_id: null,
      email: null,
      summary: `${list.length} self-signups within one hour (${hour}:00 UTC).`,
      detail: { hour, emails: list.map((u) => u.email).slice(0, 50) },
    });
  }

  return { findings, staffEmails, scanned: users.length };
}

export interface ScanResult {
  scanned: number;
  findings: number;
  new: number;
  banned: string[];
  alerted: boolean;
}

/** Detect, store, contain the unambiguous ones, and email about anything new. */
export async function runIntruderScan(): Promise<ScanResult> {
  const { findings, staffEmails, scanned } = await detectIntruders();

  const { data: existing, error: exErr } = await supabaseAdmin
    .from("security_findings")
    .select("fingerprint");
  if (exErr) throw new Error(`security_findings: ${exErr.message} — has supabase/migration-security-findings.sql been run?`);
  const known = new Set((existing || []).map((r: { fingerprint: string }) => r.fingerprint));

  const fresh = findings.filter((f) => !known.has(f.fingerprint));
  const seenAgain = findings.filter((f) => known.has(f.fingerprint)).map((f) => f.fingerprint);
  const nowIso = new Date().toISOString();

  // Scanner-domain accounts are never real people: block sign-in right
  // away. Reversible (Unban on /admin/security); never applied to staff.
  const banned: string[] = [];
  const actionByFingerprint = new Map<string, string>();
  for (const f of fresh) {
    if (f.rule !== "oast_email" || !f.user_id || !f.email || staffEmails.has(f.email.toLowerCase())) continue;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(f.user_id, { ban_duration: BAN_DURATION });
    if (!error) {
      banned.push(f.email);
      actionByFingerprint.set(f.fingerprint, "banned");
    }
  }

  if (fresh.length > 0) {
    const { error } = await supabaseAdmin.from("security_findings").insert(
      fresh.map((f) => ({ ...f, action_taken: actionByFingerprint.get(f.fingerprint) || null, alerted_at: nowIso })),
    );
    if (error) throw new Error(`security_findings insert: ${error.message}`);
  }
  if (seenAgain.length > 0) {
    await supabaseAdmin.from("security_findings").update({ last_seen_at: nowIso }).in("fingerprint", seenAgain);
  }

  let alerted = false;
  if (fresh.length > 0) {
    const sent = await sendEmail({
      to: process.env.SECURITY_ALERT_EMAIL || process.env.DPO_EMAIL || "contact@lifelinehealth.is",
      subject: `[Security] ${fresh.length} new finding${fresh.length === 1 ? "" : "s"}${banned.length ? ` · ${banned.length} account${banned.length === 1 ? "" : "s"} blocked` : ""}`,
      html: alertHtml(fresh, actionByFingerprint),
    });
    alerted = sent.ok;
  }

  return { scanned, findings: findings.length, new: fresh.length, banned, alerted };
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };

function alertHtml(fresh: Finding[], actions: Map<string, string>): string {
  const rows = [...fresh]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 40)
    .map((f) => {
      const color = f.severity === "critical" ? "#7f1d1d" : f.severity === "high" ? "#b91c1c" : "#92400e";
      const bg = f.severity === "critical" ? "#fecaca" : f.severity === "high" ? "#fee2e2" : "#fef3c7";
      const action = actions.get(f.fingerprint);
      return `<tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top;">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;background:${bg};color:${color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${f.severity}</span>
        </td>
        <td style="padding:8px 0;font-size:13px;color:#111827;vertical-align:top;">
          <div style="font-weight:600;">${escapeHtml(f.email || f.rule)}</div>
          <div style="color:#374151;margin-top:2px;">${escapeHtml(f.summary)}</div>
          ${action ? `<div style="color:#065f46;font-size:12px;margin-top:2px;">Sign-in blocked automatically.</div>` : ""}
        </td>
      </tr>`;
    })
    .join("");
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;">
      <h2 style="margin:0 0 8px 0;color:#0f172a;">Intruder scan</h2>
      <p style="margin:0 0 18px 0;color:#475569;font-size:14px;line-height:1.55;">
        The hourly account scan found <strong>${fresh.length}</strong> new item${fresh.length === 1 ? "" : "s"} to look at.
      </p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;"><tbody>${rows}</tbody></table>
      <p style="margin:18px 0 0;">
        <a href="https://www.lifelinehealth.is/admin/security"
           style="display:inline-block;padding:10px 18px;background:#10B981;color:white;text-decoration:none;border-radius:6px;font-weight:600;">
          Review in admin
        </a>
      </p>
      <p style="margin-top:18px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">
        You only get this email when something new turns up. Each finding is reported once.
      </p>
    </div>`;
}

function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
