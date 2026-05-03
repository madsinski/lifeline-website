"use client";

// Quarterly staff access review (Sprint 2.4 / GDPR Art. 32, Lög 90/2018).
//
// Persónuvernd-friendly workflow: list all active staff with their last
// review date, walk through each, decide keep / adjust / change role /
// deactivate, and capture the decision (with before/after permission
// snapshots) in staff_access_reviews.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStaffGuard } from "@/lib/useStaffGuard";

type StaffRole = "coach" | "doctor" | "nurse" | "psychologist" | "admin";

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  permissions: string[] | null;
  created_at: string;
}

interface ReviewRow {
  id: string;
  reviewed_staff_id: string;
  reviewer_id: string;
  decision: "keep" | "adjust_permissions" | "change_role" | "deactivate";
  notes: string | null;
  before_role: string | null;
  after_role: string | null;
  before_permissions: string[] | null;
  after_permissions: string[] | null;
  reviewed_at: string;
}

const REVIEW_CADENCE_DAYS = 90;
const ROLE_OPTIONS: StaffRole[] = ["coach", "doctor", "nurse", "psychologist", "admin"];
const PERMISSION_OPTIONS = [
  "manage_clients",
  "manage_programs",
  "manage_team",
  "manage_companies",
  "manage_content",
  "manage_scheduling",
  "send_messages",
  "view_legal",
  "view_analytics",
];

export default function AccessReviewPage() {
  const guard = useStaffGuard({ role: "admin" });
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { decision: ReviewRow["decision"]; notes: string; afterRole: StaffRole; afterPermissions: string[] }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, reviewRes] = await Promise.all([
        supabase
          .from("staff")
          .select("id, name, email, role, active, permissions, created_at")
          .order("active", { ascending: false })
          .order("name"),
        supabase
          .from("staff_access_reviews")
          .select("*")
          .order("reviewed_at", { ascending: false }),
      ]);
      if (staffRes.data) setStaff(staffRes.data as StaffRow[]);
      if (reviewRes.data) setReviews(reviewRes.data as ReviewRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (guard.authorized) load();
  }, [guard.authorized, load]);

  // Last review per staff
  const lastReviewByStaff = useMemo(() => {
    const map: Record<string, ReviewRow> = {};
    for (const r of reviews) {
      if (!map[r.reviewed_staff_id]) map[r.reviewed_staff_id] = r;
    }
    return map;
  }, [reviews]);

  const isOverdue = (s: StaffRow) => {
    if (!s.active) return false;
    const last = lastReviewByStaff[s.id];
    const ref = last ? new Date(last.reviewed_at) : new Date(s.created_at);
    const ageDays = (Date.now() - ref.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= REVIEW_CADENCE_DAYS;
  };

  const beginReview = (s: StaffRow) => {
    setOpenId(s.id);
    setDraft((d) => ({
      ...d,
      [s.id]: {
        decision: "keep",
        notes: "",
        afterRole: s.role,
        afterPermissions: s.permissions || [],
      },
    }));
  };

  const submitReview = async (s: StaffRow) => {
    const d = draft[s.id];
    if (!d) return;
    setBusyId(s.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const beforeRole = s.role;
      const beforePerms = s.permissions || [];

      // 1. Apply staff changes if needed.
      if (d.decision === "deactivate" && s.active) {
        const { error } = await supabase.from("staff").update({ active: false }).eq("id", s.id);
        if (error) throw error;
      } else if (d.decision === "change_role" && d.afterRole !== s.role) {
        const { error } = await supabase.from("staff").update({ role: d.afterRole }).eq("id", s.id);
        if (error) throw error;
      } else if (d.decision === "adjust_permissions") {
        const { error } = await supabase.from("staff").update({ permissions: d.afterPermissions }).eq("id", s.id);
        if (error) throw error;
      }

      // 2. Record the review.
      const { error: revErr } = await supabase.from("staff_access_reviews").insert({
        reviewed_staff_id: s.id,
        reviewer_id: user.id,
        decision: d.decision,
        notes: d.notes.trim() || null,
        before_role: beforeRole,
        after_role: d.decision === "change_role" ? d.afterRole : beforeRole,
        before_permissions: beforePerms,
        after_permissions: d.decision === "adjust_permissions" ? d.afterPermissions : beforePerms,
      });
      if (revErr) throw revErr;

      setOpenId(null);
      await load();
    } catch (e) {
      alert("Review save failed: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const togglePermission = (sid: string, p: string) => {
    setDraft((d) => {
      const cur = d[sid];
      if (!cur) return d;
      const has = cur.afterPermissions.includes(p);
      return {
        ...d,
        [sid]: {
          ...cur,
          afterPermissions: has
            ? cur.afterPermissions.filter((x) => x !== p)
            : [...cur.afterPermissions, p],
        },
      };
    });
  };

  if (guard.loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  if (!guard.authorized) return <div className="p-8 text-center text-red-600 text-sm">Admin access required.</div>;

  const overdueCount = staff.filter(isOverdue).length;
  const activeStaff = staff.filter((s) => s.active);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Staff access review</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quarterly check that the right people have the right access (GDPR Art. 32 / Lög 90/2018).
            Review cadence: every {REVIEW_CADENCE_DAYS} days per staff member.
          </p>
        </div>
        <a
          href="https://github.com/madsinski/lifeline-website/blob/main/supabase/runbooks/sprint1-2-followup.md#7-schedule-the-first-quarterly-staff-access-review"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
        >
          What is this? ↗
        </a>
      </div>

      {/* Why-we-do-this explainer */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 leading-relaxed">
        <p className="font-medium mb-1">What this page is for</p>
        <p>
          Once every 90 days you should look at every staff member and confirm
          they still need the access they have. People change roles, projects
          end, contractors leave — without a review, access creeps and stale
          accounts become an attack surface. Each decision you make is recorded
          to <code>staff_access_reviews</code> so Persónuvernd can see we
          actually do this.
        </p>
        {overdueCount > 0 && (
          <p className="mt-2 text-amber-700 font-medium">
            {overdueCount} staff member{overdueCount === 1 ? "" : "s"} overdue for review.
          </p>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Staff</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Permissions</th>
                <th className="text-left px-4 py-3 font-medium">Last reviewed</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeStaff.map((s) => {
                const last = lastReviewByStaff[s.id];
                const overdue = isOverdue(s);
                const expanded = openId === s.id;
                const d = draft[s.id];
                return (
                  <Fragment key={s.id}>
                    <tr className={`hover:bg-gray-50/50 ${expanded ? "bg-emerald-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-500">{s.email}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-700">{s.role}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {(s.permissions || []).length > 0
                          ? (s.permissions || []).join(", ")
                          : <span className="text-gray-300">none</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {last ? (
                          <div className={overdue ? "text-amber-700" : "text-gray-600"}>
                            {new Date(last.reviewed_at).toLocaleDateString("en-GB")}
                            <div className="text-gray-400 capitalize">→ {last.decision.replace("_", " ")}</div>
                          </div>
                        ) : (
                          <span className={overdue ? "text-amber-700" : "text-gray-400"}>Never</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!expanded ? (
                          <button
                            onClick={() => beginReview(s)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              overdue
                                ? "bg-amber-500 text-white hover:bg-amber-600"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            }`}
                          >
                            {overdue ? "Review now" : "Review"}
                          </button>
                        ) : (
                          <button
                            onClick={() => setOpenId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded && d && (
                      <tr key={`${s.id}-form`} className="bg-emerald-50/20">
                        <td colSpan={5} className="px-4 py-5">
                          <div className="space-y-4 max-w-3xl">
                            <div>
                              <p className="text-xs uppercase font-medium text-gray-500 tracking-wide mb-2">Decision</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {(["keep", "adjust_permissions", "change_role", "deactivate"] as ReviewRow["decision"][]).map((opt) => (
                                  <label
                                    key={opt}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                                      d.decision === opt
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`decision-${s.id}`}
                                      checked={d.decision === opt}
                                      onChange={() => setDraft({ ...draft, [s.id]: { ...d, decision: opt } })}
                                      className="accent-emerald-600"
                                    />
                                    <span className="capitalize">{opt.replace("_", " ")}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {d.decision === "change_role" && (
                              <div>
                                <p className="text-xs uppercase font-medium text-gray-500 tracking-wide mb-2">New role</p>
                                <select
                                  value={d.afterRole}
                                  onChange={(e) => setDraft({ ...draft, [s.id]: { ...d, afterRole: e.target.value as StaffRole } })}
                                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                                >
                                  {ROLE_OPTIONS.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {d.decision === "adjust_permissions" && (
                              <div>
                                <p className="text-xs uppercase font-medium text-gray-500 tracking-wide mb-2">Permissions</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {PERMISSION_OPTIONS.map((p) => (
                                    <label key={p} className="flex items-center gap-2 text-xs text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={d.afterPermissions.includes(p)}
                                        onChange={() => togglePermission(s.id, p)}
                                        className="accent-emerald-600"
                                      />
                                      <span>{p}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <p className="text-xs uppercase font-medium text-gray-500 tracking-wide mb-2">Notes (optional)</p>
                              <textarea
                                value={d.notes}
                                onChange={(e) => setDraft({ ...draft, [s.id]: { ...d, notes: e.target.value } })}
                                placeholder="Any context for the review record"
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y"
                              />
                            </div>

                            <button
                              onClick={() => submitReview(s)}
                              disabled={busyId === s.id}
                              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busyId === s.id ? "Saving…" : "Save review"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
