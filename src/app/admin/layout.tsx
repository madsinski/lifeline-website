"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Heroicons v2 outline style, stroke 1.5 for a finer professional line.
// All icons share a single emerald-neutral monochrome palette via currentColor.
const sidebarLinks = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/admin/coach",
    label: "Coach",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    href: "/admin/clients",
    label: "Clients",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    badgeType: "clients" as const,
  },
  {
    href: "/admin/conversations",
    label: "Conversations",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    badge: true,
    badgeType: "feedback" as const,
  },
  {
    href: "/admin/scheduling",
    label: "Scheduling",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
    badgeType: "refund-requests" as const,
  },
  {
    href: "/admin/content",
    label: "Content",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    href: "/admin/business",
    label: "Business",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    href: "/admin/communication",
    label: "Communication",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: "/admin/legal",
    label: "Legal",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: "/admin/access-review",
    label: "Access review",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    badge: true,
    badgeType: "access-review" as const,
  },
  {
    href: "/admin/data-requests",
    label: "Privacy requests",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
    badge: true,
    badgeType: "data-requests" as const,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let path = "";
  for (const seg of segments) {
    path += "/" + seg;
    const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
    crumbs.push({ label, href: path });
  }
  return crumbs;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<boolean | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [coachingView, setCoachingView] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("coach");
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [unresolvedFeedbackCount, setUnresolvedFeedbackCount] = useState(0);
  const [pendingRefundRequestsCount, setPendingRefundRequestsCount] = useState(0);
  const [openDsrCount, setOpenDsrCount] = useState(0);
  const [overdueAccessReviewCount, setOverdueAccessReviewCount] = useState(0);
  const isAdmin = userRole === "admin" || userPermissions.includes("manage_team");

  // Coaching-view preference is resolved inside loadStaffProfile once
  // the role is known — we used to read it here on mount, which made
  // the toggle "stick" for users whose role had changed (e.g. coach
  // promoted back to admin still saw the coach sidebar).

  // Load unread message count and new clients count
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const { count: msgCount, error: msgErr } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("read", false)
          .neq("sender_role", "coach");
        if (!msgErr && msgCount !== null) setUnreadCount(msgCount);
      } catch {}
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count: clientCount, error: clientErr } = await supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .gte("created_at", sevenDaysAgo);
        if (!clientErr && clientCount !== null) setNewClientsCount(clientCount);
      } catch {}
      try {
        const { count: fbCount, error: fbErr } = await supabase
          .from("beta_feedback")
          .select("*", { count: "exact", head: true })
          .eq("resolved", false);
        if (!fbErr && fbCount !== null) setUnresolvedFeedbackCount(fbCount);
      } catch {}
      try {
        const { count: rrCount, error: rrErr } = await supabase
          .from("refund_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        if (!rrErr && rrCount !== null) setPendingRefundRequestsCount(rrCount);
      } catch {}
      try {
        const { count: dsrCount, error: dsrErr } = await supabase
          .from("dsr_requests")
          .select("*", { count: "exact", head: true })
          .in("status", ["received", "in_progress"]);
        if (!dsrErr && dsrCount !== null) setOpenDsrCount(dsrCount);
      } catch {}
      // Overdue access reviews: active staff whose most recent review is
      // older than 90 days (or who have never been reviewed and were
      // created more than 90 days ago).
      try {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data: activeStaff } = await supabase
          .from("staff")
          .select("id, created_at")
          .eq("active", true);
        if (activeStaff && activeStaff.length > 0) {
          const ids = activeStaff.map((s) => s.id);
          const { data: reviews } = await supabase
            .from("staff_access_reviews")
            .select("reviewed_staff_id, reviewed_at")
            .in("reviewed_staff_id", ids)
            .order("reviewed_at", { ascending: false });
          const lastReviewed: Record<string, string> = {};
          for (const r of reviews || []) {
            if (!lastReviewed[r.reviewed_staff_id]) lastReviewed[r.reviewed_staff_id] = r.reviewed_at;
          }
          const overdue = activeStaff.filter((s) => {
            const ref = lastReviewed[s.id] || s.created_at;
            return ref < ninetyDaysAgo;
          }).length;
          setOverdueAccessReviewCount(overdue);
        }
      } catch {}
    };
    loadCounts();
    const interval = setInterval(loadCounts, 30000);

    // Real-time subscription for instant unread count updates
    const channel = supabase
      .channel("layout-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: Record<string, unknown>) => {
        const msg = payload.new as { sender_role?: string; read?: boolean } | undefined;
        if (msg && msg.sender_role === "client" && !msg.read) {
          setUnreadCount((prev) => prev + 1);
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStaffProfile = async (email: string) => {
    try {
      const { data } = await supabase
        .from("staff")
        .select("role, permissions")
        .eq("email", email)
        .eq("active", true)
        .maybeSingle();
      if (data) {
        setUserRole(data.role || "coach");
        setUserPermissions((data.permissions as string[]) || []);
        // Resolve the coaching-view preference:
        //   - Non-admins (no manage_team) are locked into coaching view
        //     and any stale localStorage value is cleared.
        //   - Admins respect their saved preference (default: admin view).
        const hasManageTeam = (data.permissions as string[])?.includes("manage_team");
        const adminLevel = data.role === "admin" || hasManageTeam;
        if (!adminLevel) {
          setCoachingView(true);
          try { localStorage.removeItem("admin_coaching_view"); } catch {}
        } else {
          try {
            const saved = localStorage.getItem("admin_coaching_view");
            setCoachingView(saved === "true");
          } catch {
            setCoachingView(false);
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    // Server-verify with getUser() so tokens revoked in other tabs
    // (signOut in tab A, this is tab B) don't leave the admin UI
    // falsely rendered. Only fall through to getSession() once the
    // server has confirmed the user is still active.
    (async () => {
      const { data: { user: verifiedUser } } = await supabase.auth.getUser();
      if (!verifiedUser) {
        setSession(false);
        if (pathname !== "/admin/login") router.push("/admin/login");
        return;
      }
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s) {
        setSession(true);
        setUserEmail(s.user?.email ?? null);
        if (s.user?.email) loadStaffProfile(s.user.email);

        // MFA gate. Admins handle patient data — require a TOTP-verified
        // session (AAL2). If enrolled but not verified this session, send
        // to the MFA challenge; if not enrolled yet, send to the enroll
        // page. /admin/mfa and /admin/login are exempt so we don't loop.
        try {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const totpFactors = factorsData?.totp || [];
          const hasFactor = totpFactors.some((f) => f.status === "verified");
          const needsMfa = pathname !== "/admin/mfa" && pathname !== "/admin/login";
          if (needsMfa) {
            if (!hasFactor) {
              router.replace("/admin/mfa?mode=enroll");
              return;
            }
            if (aalData?.currentLevel !== "aal2") {
              router.replace("/admin/mfa?mode=challenge");
              return;
            }
          }
        } catch {
          // MFA endpoints missing or network blip — fall through to the
          // rest of the layout so we never hard-lock out a legit admin.
        }

        // Staff e-signature gate: if this user has any outstanding
        // required agreement (NDA / þagnarskylda / acceptable use /
        // data-protection briefing) they land on /admin/onboard until
        // all of them are signed at the current version. /admin/login
        // and /admin/onboard itself are exempt so we don't loop.
        if (pathname !== "/admin/onboard" && pathname !== "/admin/login" && pathname !== "/admin/mfa") {
          try {
            const token = s.access_token;
            const res = await fetch("/api/admin/staff/me/agreements", {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const j = await res.json().catch(() => ({}));
            if (res.ok && j?.ok && Array.isArray(j.pending) && j.pending.length > 0) {
              router.replace("/admin/onboard");
            }
          } catch {
            // Gate is best-effort — don't block the page on network blips.
          }
        }
      } else {
        setSession(false);
        if (pathname !== "/admin/login") router.push("/admin/login");
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        setSession(true);
        setUserEmail(s.user?.email ?? null);
        if (s.user?.email) loadStaffProfile(s.user.email);
      } else {
        setSession(false);
        if (pathname !== "/admin/login") {
          router.push("/admin/login");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  // Idle-session timeout. Admins can see patient data, so if the tab
  // is left open and unattended we force a re-auth. Any mouse move /
  // key press / click resets the clock; 30 minutes of silence signs
  // out. Login + MFA pages are exempt so we don't kick people during
  // enrollment.
  useEffect(() => {
    if (pathname === "/admin/login" || pathname === "/admin/mfa") return;
    const IDLE_MS = 30 * 60 * 1000; // 30 minutes
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
        router.replace("/admin/login?reason=idle");
      }, IDLE_MS);
    };
    const events: (keyof DocumentEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    for (const ev of events) document.addEventListener(ev, reset, { passive: true });
    reset();
    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of events) document.removeEventListener(ev, reset);
    };
  }, [pathname, router]);

  if (pathname === "/admin/login" || pathname === "/admin/mfa") {
    return <div className="min-h-screen bg-gray-100">{children}</div>;
  }

  if (session === null || !session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B981]" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const breadcrumbs = getBreadcrumbs(pathname);
  const initials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : "AD";

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? "w-16" : "w-64"
        } bg-[#1F2937] text-white flex flex-col transition-all duration-200 flex-shrink-0`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
          {!sidebarCollapsed && (
            <span className="text-lg font-bold tracking-tight">
              Lifeline <span className="text-[#10B981]">{coachingView ? "Coach" : "Admin"}</span>
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded hover:bg-gray-700 transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className={`px-4 py-3 border-b border-gray-700 flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{userEmail ?? "Admin"}</p>
              <p className="text-xs text-gray-400">{isAdmin ? (coachingView ? "Health Coach" : "Administrator") : userRole.charAt(0).toUpperCase() + userRole.slice(1)}</p>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {(coachingView
            ? sidebarLinks.filter((l) => ["/admin/coach", "/admin/clients", "/admin/conversations", "/admin/scheduling", "/admin/content"].includes(l.href))
            : sidebarLinks
          ).filter((link) => {
            // Permission-based filtering for admin-only sections
            if (link.href === "/admin/settings" && !isAdmin) return false;
            if (link.href === "/admin/business" && !isAdmin) return false;
            if (link.href === "/admin/communication" && !isAdmin) return false;
            if (link.href === "/admin/data-requests" && !isAdmin) return false;
            if (link.href === "/admin/access-review" && !isAdmin) return false;
            if (link.href === "/admin/analytics" && !userPermissions.includes("view_analytics") && !isAdmin) return false;
            if (link.href === "/admin/content" && !userPermissions.includes("manage_programs") && !isAdmin) return false;
            return true;
          }).map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            const badgeType = (link as any).badgeType as string | undefined;
            const isMessageBadge = 'badge' in link && (link as any).badge;
            const badgeCount = badgeType === "clients" ? newClientsCount : badgeType === "feedback" ? unresolvedFeedbackCount : badgeType === "refund-requests" ? pendingRefundRequestsCount : badgeType === "data-requests" ? openDsrCount : badgeType === "access-review" ? overdueAccessReviewCount : isMessageBadge ? unreadCount : 0;
            const hasBadge = badgeCount > 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/10 text-white ring-1 ring-white/10 shadow-[inset_3px_0_0_0_#10B981]"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
                title={sidebarCollapsed ? link.label : undefined}
              >
                {link.icon}
                {!sidebarCollapsed && (
                  <span className="flex items-center gap-2">
                    {link.label}
                    {hasBadge && (
                      <span className="bg-[#10B981] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {badgeCount}
                      </span>
                    )}
                  </span>
                )}
                {sidebarCollapsed && hasBadge && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#10B981] rounded-full" />
                )}
              </Link>
            );
          })}
          {/* Divider */}
          <div className={`my-2 mx-3 border-t border-gray-700`} />

          {/* Coaching view toggle — admin only */}
          {isAdmin && (
            <button
              onClick={() => {
                const next = !coachingView;
                setCoachingView(next);
                try { localStorage.setItem("admin_coaching_view", String(next)); } catch {}
                if (next && pathname === "/admin") {
                  router.push("/admin/coach");
                } else if (!next && pathname === "/admin/coach") {
                  router.push("/admin");
                }
              }}
              className={`flex items-center w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              } ${coachingView ? "bg-[#10B981]/15 text-[#10B981]" : "text-gray-400 hover:bg-gray-700 hover:text-white"}`}
              title={sidebarCollapsed ? (coachingView ? "Switch to Admin view" : "Switch to Coaching view") : undefined}
            >
              {!sidebarCollapsed ? (
                <span>{coachingView ? "Coaching view" : "Admin view"}</span>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              )}
              {!sidebarCollapsed && (
                <span className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${coachingView ? "bg-[#10B981]" : "bg-gray-600"}`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${coachingView ? "translate-x-5" : "translate-x-0"}`} />
                </span>
              )}
            </button>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-[#1F2937]">
              {sidebarLinks.find(
                (l) =>
                  l.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(l.href)
              )?.label || "Admin"}
            </h1>
            {/* Breadcrumbs */}
            {breadcrumbs.length > 1 && (
              <div className="hidden md:flex items-center gap-1 text-sm text-gray-400 ml-2">
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.href} className="flex items-center gap-1">
                    {i > 0 && <span>/</span>}
                    {i === breadcrumbs.length - 1 ? (
                      <span className="text-gray-600 font-medium">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="hover:text-[#10B981] transition-colors">
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Notification bell with count */}
            <Link href="/admin/messages" className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50" title={unreadCount > 0 ? `${unreadCount} unread messages` : "No new notifications"}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-[#1F2937] transition-colors"
            >
              View Site
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
