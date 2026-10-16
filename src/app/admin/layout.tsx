"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { tenantForHost, isAdminRouteAllowed } from "@/lib/tenant";
import { fetchMyStaffProfile, type MyStaffProfile } from "@/lib/useStaffGuard";
import { useScrollLock } from "@/lib/hc/use-scroll-lock";
import { DialogProvider, Alert } from "@/app/components/account/ui";
import { ToastProvider } from "@/app/components/hc/Toast";
import Badge from "@/app/components/hc/Badge";
import {
  NAV_GROUPS, navItemForPath, canSeeItem, canOpenPath, homeFor, isAdminLevel, isSystemRoute,
  breadcrumbsFor, ROLE_LABELS, type BadgeKey, type NavGroup,
} from "./components/admin-nav";

// The navigation + access map lives in components/admin-nav.tsx: one table
// drives both the grouped sidebar and the route guard below, so a role can
// open by URL exactly what its sidebar shows.

const FOCUS_DARK = "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F2937]";

function Spinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div role="status" aria-label={label} className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B981]" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<boolean | null>(null);
  const [staff, setStaff] = useState<MyStaffProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [coachingView, setCoachingView] = useState(false);
  const [denied, setDenied] = useState<{ label: string; at: string } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [unresolvedFeedbackCount, setUnresolvedFeedbackCount] = useState(0);
  const [pendingRefundRequestsCount, setPendingRefundRequestsCount] = useState(0);
  const [openDsrCount, setOpenDsrCount] = useState(0);
  const [overdueAccessReviewCount, setOverdueAccessReviewCount] = useState(0);
  const [openErrorsCount, setOpenErrorsCount] = useState(0);
  const [openSecurityCount, setOpenSecurityCount] = useState(0);
  const [openAiFeedbackCount, setOpenAiFeedbackCount] = useState(0);
  const [newSurveyResponsesCount, setNewSurveyResponsesCount] = useState(0);
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const [newCompaniesCount, setNewCompaniesCount] = useState(0);
  const [untaggedActionsCount, setUntaggedActionsCount] = useState(0);
  const [openWearableIssuesCount, setOpenWearableIssuesCount] = useState(0);
  const [newActionFeedbackCount, setNewActionFeedbackCount] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const role = staff?.role ?? null;
  const permissions: readonly string[] = staff?.permissions ?? [];
  const isAdmin = isAdminLevel(role, permissions);
  const isReadOnlyView = role === "medical_advisor";

  // --- Tenant (multi-host) -------------------------------------------------
  // The same app is served on the Lifeline hosts and a Fjarlækningar host. On
  // the Fjarlækningar host the admin is restricted to a subset of modules and
  // rebranded (see src/lib/tenant.ts). tenantForHost returns a stable singleton,
  // so this is a referentially-stable value safe to use in effect deps. The
  // branded sidebar only renders client-side (the server path shows the spinner
  // while `session` is null), so reading the host in render risks no mismatch.
  const tenant = tenantForHost(typeof window !== "undefined" ? window.location.hostname : null);

  // Redirect away from modules this tenant doesn't expose. Fires only on real
  // module routes (or the bare dashboard) once authed — login/mfa/onboard and
  // other system routes are never modules, so auth flows are untouched.
  useEffect(() => {
    if (!session || !tenant.adminNav) return;
    const isModule = pathname !== "/admin" && !isSystemRoute(pathname) && navItemForPath(pathname) !== null;
    if (!isModule && pathname !== "/admin") return;
    if (!isAdminRouteAllowed(tenant, pathname)) router.replace(tenant.adminHome);
  }, [session, tenant, pathname, router]);

  // Role guard. The same map that filters the sidebar decides whether this
  // route may render at all, so a typed or bookmarked URL is held to the
  // sidebar. While a redirect is pending the page is not rendered (see the
  // spinner below), so a disallowed page never mounts or fetches.
  const routeAllowed = !!staff && canOpenPath(pathname, staff.role, staff.permissions);
  useEffect(() => {
    if (!session || !staff || canOpenPath(pathname, staff.role, staff.permissions)) return;
    const home = homeFor(staff.role);
    const label = navItemForPath(pathname)?.label;
    const t = setTimeout(() => {
      setDenied({ label: label ?? "þessari síðu", at: home });
      router.replace(home);
    }, 0);
    return () => clearTimeout(t);
  }, [session, staff, pathname, router]);

  // Per-tab "last visit" timestamps stored in localStorage. Used as
  // the lower bound for the "new since you last looked" badges so they
  // clear when the user opens the page and only re-grow as new
  // activity arrives. Falls back to a 7-day floor so the count never
  // includes ancient items if the tab has never been visited.
  const cutoffFor = useCallback((key: string): string => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (typeof window === "undefined") return sevenDaysAgo;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return sevenDaysAgo;
      return stored > sevenDaysAgo ? stored : sevenDaysAgo;
    } catch { return sevenDaysAgo; }
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const { count: msgCount, error: msgErr } = await supabase
        .from("messages_decrypted")
        .select("*", { count: "exact", head: true })
        .eq("read", false)
        .neq("sender_role", "coach");
      if (!msgErr && msgCount !== null) setUnreadCount(msgCount);
    } catch {}
    try {
      const { count: clientCount, error: clientErr } = await supabase
        .from("clients_decrypted")
        .select("*", { count: "exact", head: true })
        .gte("created_at", cutoffFor("last_seen_clients"));
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
    // Open (unresolved) error events. Counted across the whole table —
    // RLS is admin-only so the query returns 0 for non-admins.
    try {
      const { count: errCount, error: errErr } = await supabase
        .from("app_errors")
        .select("*", { count: "exact", head: true })
        .is("resolved_at", null);
      if (!errErr && errCount !== null) setOpenErrorsCount(errCount);
    } catch {}
    // Open intruder-scan findings. RLS is admin-only, same as app_errors.
    try {
      const { count: secCount, error: secErr } = await supabase
        .from("security_findings")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      if (!secErr && secCount !== null) setOpenSecurityCount(secCount);
    } catch {}
    // Open AI recommendation feedback ("doesn't feel right" reports
    // from the app). Counts open + reviewed (i.e. anything not yet
    // applied or dismissed) so escalated patterns stay visible until
    // the prompt/filter is actually tuned.
    try {
      const { count: aifbCount, error: aifbErr } = await supabase
        .from("ai_recommendation_feedback")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "reviewed"]);
      if (!aifbErr && aifbCount !== null) setOpenAiFeedbackCount(aifbCount);
    } catch {}
    // New survey responses since the user last visited /admin/surveys.
    try {
      const { count: respCount, error: respErr } = await supabase
        .from("feedback_assignments")
        .select("*", { count: "exact", head: true })
        .gte("completed_at", cutoffFor("last_seen_surveys"));
      if (!respErr && respCount !== null) setNewSurveyResponsesCount(respCount);
    } catch {}
    // New body-comp + blood-test bookings since last visit to /admin/bookings.
    try {
      const cutoff = cutoffFor("last_seen_bookings");
      const [{ count: bcCount }, { count: btCount }] = await Promise.all([
        supabase.from("body_comp_bookings").select("*", { count: "exact", head: true }).gte("created_at", cutoff),
        supabase.from("blood_test_bookings").select("*", { count: "exact", head: true }).gte("created_at", cutoff),
      ]);
      setNewBookingsCount((bcCount || 0) + (btCount || 0));
    } catch {}
    // New company signups since last visit to /admin/business.
    try {
      const { count: coCount, error: coErr } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .gte("created_at", cutoffFor("last_seen_business"));
      if (!coErr && coCount !== null) setNewCompaniesCount(coCount);
    } catch {}
    // Untagged action library rows — drives /admin/programs/audit
    // attention. Persistent (not last-visit-based): the count only
    // drops when staff actually tag rows. Surfaces under Content
    // since /admin/programs/audit lives under that section.
    try {
      const { count: untaggedCount, error: untaggedErr } = await supabase
        .from("program_actions")
        .select("*", { count: "exact", head: true })
        .is("audited_at", null);
      if (!untaggedErr && untaggedCount !== null) setUntaggedActionsCount(untaggedCount);
    } catch {}
    // Open wearable-setup troubleshooting reports submitted from the
    // in-app "Stuck?" form. Counts open + in_progress so triage stays
    // visible until staff resolve or dismiss the row.
    try {
      const { count: wiCount, error: wiErr } = await supabase
        .from("wearable_setup_issues")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);
      if (!wiErr && wiCount !== null) setOpenWearableIssuesCount(wiCount);
    } catch {}
    // Action-feedback inbox: count "Not for me" dismissals submitted
    // since the staff member last opened the page. Falls back to a
    // 7-day floor (handled inside cutoffFor) so a stale tab doesn't
    // show ancient items.
    try {
      const { count: afCount, error: afErr } = await supabase
        .from("client_action_dismissals")
        .select("*", { count: "exact", head: true })
        .gte("dismissed_at", cutoffFor("last_seen_action_feedback"));
      if (!afErr && afCount !== null) setNewActionFeedbackCount(afCount);
    } catch {}
    // Overdue access reviews: active staff whose most recent review is
    // older than 90 days (or never reviewed and created more than 90 days ago).
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
  }, [cutoffFor]);

  // Stamp last_seen for the tracked tabs whenever the user lands on
  // them, so the count clears immediately and only re-grows as new
  // activity arrives. Maps prefix → localStorage key.
  useEffect(() => {
    const lastSeenMap: Record<string, string> = {
      "/admin/clients": "last_seen_clients",
      "/admin/bookings": "last_seen_bookings",
      "/admin/surveys": "last_seen_surveys",
      "/admin/business": "last_seen_business",
      "/admin/companies": "last_seen_business",
      "/admin/action-feedback": "last_seen_action_feedback",
    };
    let touched = false;
    for (const [prefix, key] of Object.entries(lastSeenMap)) {
      if (pathname.startsWith(prefix)) {
        try { localStorage.setItem(key, new Date().toISOString()); touched = true; } catch {}
      }
    }
    if (!touched) return;
    const t = setTimeout(() => void loadCounts(), 0);
    return () => clearTimeout(t);
  }, [pathname, loadCounts]);

  useEffect(() => {
    const first = setTimeout(() => void loadCounts(), 0);
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
      clearTimeout(first);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadCounts]);

  useEffect(() => {
    let cancelled = false;
    // Server-verify with getUser() so tokens revoked in other tabs
    // (signOut in tab A, this is tab B) don't leave the admin UI
    // falsely rendered. Only fall through to getSession() once the
    // server has confirmed the user is still active.
    (async () => {
      const { data: { user: verifiedUser } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!verifiedUser) {
        setSession(false);
        if (pathname !== "/admin/login") router.push("/admin/login");
        return;
      }
      const { data: { session: s } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!s) {
        setSession(false);
        if (pathname !== "/admin/login") router.push("/admin/login");
        return;
      }
      // NOTE: setSession(true) is deliberately deferred until after the
      // MFA gate below. Granting render here flashes the full admin UI
      // for the redirect round-trip to /admin/mfa.
      setUserEmail(s.user?.email ?? null);

      // Role + permissions from the get_my_staff_profile() RPC — a raw
      // `select from staff` returns a null role for invited admins whose
      // staff.id differs from their auth id.
      let profile: MyStaffProfile | null;
      try {
        profile = await fetchMyStaffProfile(s.user?.email);
      } catch {
        // Could not check at all (network / RPC down). Fail closed: no
        // shell, a retry message instead.
        if (!cancelled) setProfileError(true);
        return;
      }
      if (cancelled) return;
      // SECURITY: an authenticated user with no active staff row is signed
      // out and bounced, never shown an empty shell with defaults.
      if (!profile) {
        if (pathname !== "/admin/login" && pathname !== "/admin/mfa") {
          try { await supabase.auth.signOut(); } catch {}
          router.replace("/admin/login?reason=not_staff");
        }
        return;
      }
      setProfileError(false);
      setStaff(profile);
      // Coaching view is an admin-only preview of the coach's sidebar;
      // everybody else always sees their own role's sidebar.
      if (isAdminLevel(profile.role, profile.permissions)) {
        try { setCoachingView(localStorage.getItem("admin_coaching_view") === "true"); } catch { setCoachingView(false); }
      } else {
        setCoachingView(false);
        try { localStorage.removeItem("admin_coaching_view"); } catch {}
      }

      // Admins get the coming-soon bypass cookie so they can browse the
      // public marketing site without the splash. The gate is cosmetic
      // (see src/proxy.ts) — this reuses its existing `site_preview`
      // bypass. 30-day cookie; refreshed on every admin page load.
      if (profile.role === "admin") {
        document.cookie = `site_preview=lifelinepreview2026; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      }

      // MFA gate. Admins/clinicians/coaches handle patient data — they
      // need a TOTP-verified session (AAL2). External counsel (lawyer)
      // only ever sees /admin/legal/*, which contains zero patient data,
      // so MFA is skipped for that role. Medical advisor still requires it.
      //
      // FAILS CLOSED: if the assurance level or factor list cannot be read
      // (error result or a throw), the person goes to /admin/mfa rather
      // than into the shell. A network blip costs a challenge; it never
      // grants an AAL1 session the admin UI.
      if (profile.role !== "lawyer" && pathname !== "/admin/mfa" && pathname !== "/admin/login") {
        try {
          const [aal, factors] = await Promise.all([
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
            supabase.auth.mfa.listFactors(),
          ]);
          if (cancelled) return;
          if (aal.error || factors.error || !aal.data) {
            router.replace("/admin/mfa?mode=challenge");
            return;
          }
          const hasFactor = (factors.data?.totp || []).some((f) => f.status === "verified");
          if (!hasFactor) {
            router.replace("/admin/mfa?mode=enroll");
            return;
          }
          if (aal.data.currentLevel !== "aal2") {
            router.replace("/admin/mfa?mode=challenge");
            return;
          }
        } catch {
          if (!cancelled) router.replace("/admin/mfa?mode=challenge");
          return;
        }
      }

      // Only now — after the AAL2/MFA gate has decided no redirect is
      // needed — is the admin shell allowed to render.
      setSession(true);

      // Staff e-signature gate: outstanding required agreements (NDA /
      // þagnarskylda / acceptable use / data-protection briefing) send the
      // person to /admin/onboard until signed. Lawyer and medical advisor
      // are covered by their engagement letters and skip it.
      if (profile.role !== "lawyer" && profile.role !== "medical_advisor" && pathname !== "/admin/onboard" && pathname !== "/admin/login" && pathname !== "/admin/mfa") {
        try {
          const res = await fetch("/api/admin/staff/me/agreements", {
            headers: s.access_token ? { Authorization: `Bearer ${s.access_token}` } : {},
          });
          const j = await res.json().catch(() => ({}));
          if (!cancelled && res.ok && j?.ok && Array.isArray(j.pending) && j.pending.length > 0) {
            router.replace("/admin/onboard");
          }
        } catch {
          // Gate is best-effort — don't block the page on network blips.
        }
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        // Deliberately NOT setSession(true) here: SIGNED_IN fires before
        // the AAL2/MFA gate above has run. This handler only keeps the
        // profile fresh (a role change takes effect without a reload).
        setUserEmail(s.user?.email ?? null);
        fetchMyStaffProfile(s.user?.email).then((p) => { if (p && !cancelled) setStaff(p); }).catch(() => {});
      } else {
        setSession(false);
        if (pathname !== "/admin/login") {
          router.push("/admin/login");
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Mobile drawer: Escape closes, Tab stays inside, focus goes back to the
  // hamburger. The page behind does not scroll.
  useScrollLock(drawerOpen);
  useEffect(() => {
    if (!drawerOpen) return;
    const panel = drawerRef.current;
    const opener = hamburgerRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setDrawerOpen(false); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || !panel?.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !panel?.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [drawerOpen]);

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

  if (profileError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md">
          <Alert tone="bad" title="Tókst ekki að staðfesta aðganginn þinn">
            Ekki náðist samband við netþjóninn til að sækja hlutverkið þitt. Athugaðu nettenginguna og{" "}
            <button type="button" className="font-semibold underline" onClick={() => window.location.reload()}>reyndu aftur</button>.
          </Alert>
        </div>
      </div>
    );
  }

  if (!session || !staff) return <Spinner label="Hleð stjórnborði" />;
  // A disallowed route: the redirect above is on its way; never mount the page.
  if (!routeAllowed) return <Spinner label="Færi þig á yfirlitið" />;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const badgeCount = (key?: BadgeKey): number => {
    switch (key) {
      case "clients": return newClientsCount;
      case "feedback": return unresolvedFeedbackCount;
      // Bookings combines refund-requests + new bookings of any kind in the
      // last 7 days, since both land on the same page.
      case "refund-requests": return pendingRefundRequestsCount + newBookingsCount;
      case "data-requests": return openDsrCount;
      case "access-review": return overdueAccessReviewCount;
      case "errors": return openErrorsCount;
      case "security": return openSecurityCount;
      case "ai-feedback": return openAiFeedbackCount;
      // New completed responses since the last visit; pending approval is an
      // editorial signal shown inside the surveys hub itself.
      case "surveys": return newSurveyResponsesCount;
      case "business": return newCompaniesCount;
      case "audit": return untaggedActionsCount;
      case "wearable-issues": return openWearableIssuesCount;
      case "action-feedback": return newActionFeedbackCount;
      default: return 0;
    }
  };

  // The sidebar shows the person's own role; an admin with "Þjálfarasýn" on
  // previews the coach's sidebar (the route guard still uses the real role).
  const navRole = isAdmin && coachingView ? "coach" : role;
  const navPerms = isAdmin && coachingView ? [] : permissions;
  const groups: NavGroup[] = NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((i) =>
        canSeeItem(i, navRole, navPerms) && (!tenant.adminNav || tenant.adminNav.includes(i.href))),
    }))
    .filter((g) => g.items.length > 0);
  const activeHref = navItemForPath(pathname)?.href ?? null;
  const breadcrumbs = breadcrumbsFor(pathname);
  const initials = userEmail ? userEmail.substring(0, 2).toUpperCase() : "AD";
  const roleLabel = isAdmin && coachingView ? "Þjálfarasýn" : (role ? ROLE_LABELS[role] ?? role : "");
  const showDenied = denied && pathname === denied.at;

  const onNavigate = () => { setDrawerOpen(false); setDenied(null); };

  // One nav, rendered in the desktop sidebar and in the phone drawer.
  const renderNav = (collapsed: boolean, idPrefix: string) => (
    <nav aria-label="Aðalvalmynd" className="flex-1 overflow-y-auto py-3 px-2">
      {groups.map((g) => {
        const containsActive = g.items.some((i) => i.href === activeHref);
        const open = !g.collapsible || devOpen || containsActive;
        const listId = `${idPrefix}-group-${g.id}`;
        return (
          <div key={g.id} className="mb-3">
            {g.collapsible ? (
              <button
                type="button"
                onClick={() => setDevOpen((v) => !v)}
                aria-expanded={open}
                aria-controls={listId}
                aria-label={collapsed ? g.label : undefined}
                title={collapsed ? g.label : undefined}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-white ${FOCUS_DARK} ${collapsed ? "justify-center" : "justify-between"}`}
              >
                {!collapsed && <span>{g.label}</span>}
                <svg className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : collapsed ? (
              <div className="mx-3 mb-1 border-t border-gray-700" aria-hidden="true" />
            ) : (
              <p id={`${listId}-label`} className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{g.label}</p>
            )}
            {open && (
              <ul id={listId} aria-labelledby={!g.collapsible && !collapsed ? `${listId}-label` : undefined} className="space-y-0.5">
                {g.items.map((link) => {
                  const isActive = link.href === activeHref;
                  const count = badgeCount(link.badge);
                  const hasBadge = count > 0;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={onNavigate}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={collapsed || hasBadge ? (hasBadge ? `${link.label} (${count})` : link.label) : undefined}
                        title={collapsed ? link.label : undefined}
                        className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${FOCUS_DARK} ${
                          collapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-white/10 text-white ring-1 ring-white/10 shadow-[inset_3px_0_0_0_#10B981]"
                            : "text-gray-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {link.icon}
                        {!collapsed && (
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className="truncate">{link.label}</span>
                            {hasBadge && <Badge tone="count">{count > 99 ? "99+" : count}</Badge>}
                          </span>
                        )}
                        {collapsed && hasBadge && (
                          <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-[#10B981]" aria-hidden="true" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      <div className="my-2 mx-3 border-t border-gray-700" aria-hidden="true" />

      {/* Coaching view — an admin-only preview of the coach's sidebar. */}
      {isAdmin && (
        <button
          type="button"
          role="switch"
          aria-checked={coachingView}
          aria-label={collapsed ? "Þjálfarasýn" : undefined}
          onClick={() => {
            const next = !coachingView;
            setCoachingView(next);
            try { localStorage.setItem("admin_coaching_view", String(next)); } catch {}
            if (next && pathname === "/admin") router.push("/admin/coach");
            else if (!next && pathname === "/admin/coach") router.push("/admin");
          }}
          className={`flex items-center w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${FOCUS_DARK} ${
            collapsed ? "justify-center" : "justify-between"
          } ${coachingView ? "bg-[#10B981]/15 text-[#34D399]" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
          title={collapsed ? "Þjálfarasýn" : undefined}
        >
          {!collapsed ? (
            <span>Þjálfarasýn</span>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          )}
          {!collapsed && (
            <span aria-hidden="true" className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${coachingView ? "bg-hc-brand-dark" : "bg-gray-600"}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${coachingView ? "translate-x-5" : "translate-x-0"}`} />
            </span>
          )}
        </button>
      )}

      <button
        type="button"
        onClick={handleSignOut}
        aria-label={collapsed ? "Skrá út" : undefined}
        title={collapsed ? "Skrá út" : undefined}
        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors ${FOCUS_DARK} ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        {!collapsed && <span>Skrá út</span>}
      </button>
    </nav>
  );

  const brand = (collapsed: boolean) => !collapsed && (
    <span className="text-lg font-bold tracking-tight">
      {tenant.id === "fjarlaekningar" ? (
        <span style={{ color: tenant.accent }}>Fjarlækningar</span>
      ) : (
        <>Lifeline <span className="text-[#10B981]">{coachingView ? "Coach" : "Admin"}</span></>
      )}
    </span>
  );

  const userBlock = (collapsed: boolean) => (
    <div className={`px-4 py-3 border-b border-gray-700 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: tenant.accent }} aria-hidden="true">
        {initials}
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{userEmail ?? ""}</p>
          <p className="text-xs text-gray-300">{roleLabel}</p>
        </div>
      )}
    </div>
  );

  return (
    <ToastProvider dockOffset="env(safe-area-inset-bottom, 0px)">
      <DialogProvider>
        <div className="min-h-screen flex bg-gray-100">
          <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-hc-ink focus:shadow-lg">
            Fara í efni
          </a>

          {/* Sidebar (md and up) */}
          <aside
            className={`${sidebarCollapsed ? "w-16" : "w-64"} hidden md:flex bg-[#1F2937] text-white flex-col transition-all duration-200 flex-shrink-0 sticky top-0 h-screen`}
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
              {brand(sidebarCollapsed)}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${FOCUS_DARK}`}
                aria-label={sidebarCollapsed ? "Stækka valmynd" : "Minnka valmynd"}
                aria-expanded={!sidebarCollapsed}
                aria-controls="admin-sidebar-nav"
                title={sidebarCollapsed ? "Stækka valmynd" : "Minnka valmynd"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  {sidebarCollapsed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  )}
                </svg>
              </button>
            </div>
            {userBlock(sidebarCollapsed)}
            <div id="admin-sidebar-nav" className="flex min-h-0 flex-1 flex-col">
              {renderNav(sidebarCollapsed, "side")}
            </div>
          </aside>

          {/* Drawer (below md) */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
              <div
                ref={drawerRef}
                id="admin-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Valmynd"
                className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#1F2937] text-white shadow-xl pb-[env(safe-area-inset-bottom)]"
              >
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
                  {brand(false)}
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className={`p-2 rounded hover:bg-gray-700 ${FOCUS_DARK}`}
                    aria-label="Loka valmynd"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {userBlock(false)}
                {renderNav(false, "drawer")}
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between gap-2 px-3 sm:px-6 flex-shrink-0">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  ref={hamburgerRef}
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="md:hidden -ml-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand"
                  aria-label="Opna valmynd"
                  aria-expanded={drawerOpen}
                  aria-controls="admin-drawer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {/* Breadcrumbs only — the page itself owns the single h1. */}
                <nav aria-label="Brauðmolar" className="min-w-0">
                  <ol className="flex min-w-0 items-center gap-1 text-sm text-gray-500">
                    {breadcrumbs.map((crumb, i) => {
                      const last = i === breadcrumbs.length - 1;
                      return (
                        <li key={`${crumb.label}-${i}`} className={`flex min-w-0 items-center gap-1 ${last ? "" : "hidden sm:flex"}`}>
                          {i > 0 && <span aria-hidden="true" className="text-gray-300">/</span>}
                          {last ? (
                            <span aria-current="page" className="truncate font-semibold text-[#1F2937]">{crumb.label}</span>
                          ) : crumb.href ? (
                            <Link href={crumb.href} className="truncate hover:text-hc-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand rounded">
                              {crumb.label}
                            </Link>
                          ) : (
                            <span className="truncate">{crumb.label}</span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                {canOpenPath("/admin/conversations", role, permissions) && (
                  <Link
                    href="/admin/conversations?tab=messages"
                    className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand"
                    aria-label={unreadCount > 0 ? `Skilaboð: ${unreadCount} ólesin` : "Skilaboð: engin ólesin"}
                    title={unreadCount > 0 ? `${unreadCount} ólesin skilaboð` : "Engin ólesin skilaboð"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                )}
                <Link href="/" className="hidden sm:inline text-sm text-gray-600 hover:text-[#1F2937] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand rounded">
                  Opna vefinn
                </Link>
              </div>
            </header>

            {/* Read-only banner for medical_advisor */}
            {isReadOnlyView && !pathname.startsWith("/admin/surveys") && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 text-xs text-amber-900 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth={2} />
                </svg>
                <span>
                  <strong>Lesaðgangur.</strong> Breytingar eru óvirkar. Þú getur aðeins breytt efni í <Link href="/admin/surveys" className="underline font-medium">Könnunum</Link>.
                </span>
              </div>
            )}

            {/* Page content. The .readonly-locked class is picked up by
                globals.css to disable every form-write affordance for
                medical_advisor outside /admin/surveys — defense in depth
                on top of the API-level isStaff() role check. */}
            <main
              id="admin-main"
              tabIndex={-1}
              className={`flex-1 overflow-y-auto p-4 sm:p-6 focus:outline-none ${
                isReadOnlyView && !pathname.startsWith("/admin/surveys") ? "readonly-locked" : ""
              }`}
            >
              {showDenied && (
                <div className="mb-4">
                  <Alert tone="warn" onDismiss={() => setDenied(null)} dismissLabel="Loka">
                    Þú hefur ekki aðgang að {denied.label === "þessari síðu" ? "þessari síðu" : <>„{denied.label}“</>}. Þér var vísað hingað.
                  </Alert>
                </div>
              )}
              {children}
            </main>
          </div>
        </div>
      </DialogProvider>
    </ToastProvider>
  );
}
