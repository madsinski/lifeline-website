"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const sidebarLinks = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
      </svg>
    ),
  },
  {
    href: "/admin/coach",
    label: "Coach",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/clients",
    label: "Clients",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    badgeType: "clients" as const,
  },
  {
    href: "/admin/programs",
    label: "Programs (CMS)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: "/admin/education",
    label: "Education",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/admin/team",
    label: "Team",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/messages",
    label: "Messages",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    badge: true,
  },
  {
    href: "/admin/calendar",
    label: "Calendar",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
  const isAdmin = userRole === "admin" || userPermissions.includes("manage_team");

  // Load coaching view preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin_coaching_view");
      if (saved === "true") setCoachingView(true);
    } catch {}
  }, []);

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
    };
    loadCounts();
    const interval = setInterval(loadCounts, 15000);
    return () => clearInterval(interval);
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
        // Non-admin users default to coaching view
        const hasManageTeam = (data.permissions as string[])?.includes("manage_team");
        if (data.role !== "admin" && !hasManageTeam) {
          setCoachingView(true);
        }
      }
    } catch {}
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
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

  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-gray-100">{children}</div>;
  }

  if (session === null || !session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c858]" />
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
              Lifeline <span className="text-[#20c858]">{coachingView ? "Coach" : "Admin"}</span>
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
          <div className="w-8 h-8 rounded-full bg-[#20c858] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
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
            ? sidebarLinks.filter((l) => ["/admin/coach", "/admin/clients", "/admin/programs", "/admin/education", "/admin/messages", "/admin/calendar"].includes(l.href))
            : sidebarLinks
          ).filter((link) => {
            // Permission-based filtering
            if (link.href === "/admin/team" && !isAdmin) return false;
            if (link.href === "/admin/analytics" && !userPermissions.includes("view_analytics") && !isAdmin) return false;
            if (link.href === "/admin/messages" && !userPermissions.includes("send_messages") && !isAdmin) return false;
            if (link.href === "/admin/programs" && !userPermissions.includes("manage_programs") && !isAdmin) return false;
            return true;
          }).map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            const badgeType = (link as any).badgeType as string | undefined;
            const isMessageBadge = 'badge' in link && (link as any).badge;
            const badgeCount = badgeType === "clients" ? newClientsCount : isMessageBadge ? unreadCount : 0;
            const hasBadge = badgeCount > 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#20c858]/15 text-[#20c858]"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
                title={sidebarCollapsed ? link.label : undefined}
              >
                {link.icon}
                {!sidebarCollapsed && (
                  <span className="flex items-center gap-2">
                    {link.label}
                    {hasBadge && (
                      <span className="bg-[#20c858] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {badgeCount}
                      </span>
                    )}
                  </span>
                )}
                {sidebarCollapsed && hasBadge && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#20c858] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Coaching view toggle — admin only */}
        {isAdmin && <div className={`px-2 pb-2 mt-auto ${sidebarCollapsed ? "flex justify-center" : ""}`}>
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
            } ${coachingView ? "bg-[#20c858]/15 text-[#20c858]" : "text-gray-400 hover:bg-gray-700 hover:text-white"}`}
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
              <span className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${coachingView ? "bg-[#20c858]" : "bg-gray-600"}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${coachingView ? "translate-x-5" : "translate-x-0"}`} />
              </span>
            )}
          </button>
        </div>}

        {/* Sign out */}
        <div className="px-2 pb-4">
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
        </div>
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
                      <Link href={crumb.href} className="hover:text-[#20c858] transition-colors">
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Notification bell */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50" title="Notifications">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#20c858] rounded-full" />
            </button>
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
