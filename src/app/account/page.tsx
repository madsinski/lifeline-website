"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { Suspense } from "react";

/* ---------- tier data (mirrors pricing page) ---------- */
const tiers = [
  {
    id: "free-trial",
    name: "Free Plan",
    price: "0",
    period: "forever",
    badgeColor: "bg-amber-100 text-amber-700",
    features: ["Basic health tracking", "Daily action plans", "Community access"],
  },
  {
    id: "self-maintained",
    name: "Self-maintained",
    price: "9.900",
    period: "per month",
    badgeColor: "bg-blue-100 text-blue-700",
    features: ["Everything in Free", "Personalized programs", "Progress analytics", "Priority support"],
  },
  {
    id: "full-access",
    name: "Full Access",
    price: "29.900",
    period: "per month",
    badgeColor: "bg-green-100 text-green-700",
    features: ["Everything in Self-maintained", "1-on-1 coaching", "Custom meal plans", "Monthly assessments"],
  },
];

/* ---------- types ---------- */
interface SubscriptionRow {
  id: string;
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

/* ---------- nav sections ---------- */
type Section = "overview" | "profile" | "messages" | "billing" | "assessment" | "app" | "settings";
const navItems: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Health Overview", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { id: "profile", label: "Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { id: "messages", label: "Messages", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { id: "billing", label: "Billing & Plans", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { id: "assessment", label: "Assessment", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { id: "app", label: "App & Devices", icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { id: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

/* ============================================================
   ACCOUNT PAGE (inner component that uses useSearchParams)
   ============================================================ */
function AccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("overview");

  /* profile fields */
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [dob, setDob] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState("");

  /* subscription state */
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  /* plan change confirmation */
  const [pendingTier, setPendingTier] = useState<string | null>(null);
  const [showPlanConfirm, setShowPlanConfirm] = useState(false);
  const [upgradeProcessing, setUpgradeProcessing] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState("");

  /* upgrade flow from pricing page */
  const upgradeParam = searchParams.get("upgrade");

  /* password */
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  /* delete account */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  /* payments */
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [showAllPayments, setShowAllPayments] = useState(false);

  /* coaching programs */
  const [programs, setPrograms] = useState<string[]>([]);

  /* messages */
  const [conversationsCount, setConversationsCount] = useState(0);

  /* ---------- auth check + load data ---------- */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/account/login");
        setLoading(false);
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);

      // Load profile from clients table
      try {
        const { data: clientData } = await supabase
          .from("clients")
          .select("full_name, phone, address, emergency_contact_name, emergency_contact_phone, date_of_birth")
          .eq("id", currentUser.id)
          .single();
        if (clientData) {
          const nameParts = (clientData.full_name || "").split(" ");
          setProfileFirstName(nameParts[0] || "");
          setProfileLastName(nameParts.slice(1).join(" ") || "");
          setPhone(clientData.phone || "");
          setAddress(clientData.address || "");
          setEmergencyName(clientData.emergency_contact_name || "");
          setEmergencyPhone(clientData.emergency_contact_phone || "");
          setDob(clientData.date_of_birth || "");
        } else {
          const metaName = currentUser.user_metadata?.full_name || "";
          const parts = metaName.split(" ");
          setProfileFirstName(parts[0] || "");
          setProfileLastName(parts.slice(1).join(" ") || "");
          setPhone(currentUser.phone || currentUser.user_metadata?.phone || "");
        }
      } catch {
        const metaName = currentUser.user_metadata?.full_name || "";
        const parts = metaName.split(" ");
        setProfileFirstName(parts[0] || "");
        setProfileLastName(parts.slice(1).join(" ") || "");
        setPhone(currentUser.phone || currentUser.user_metadata?.phone || "");
      }

      // Load subscription
      try {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("id, tier, status, trial_ends_at, current_period_start, current_period_end")
          .eq("client_id", currentUser.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        if (subData && subData.length > 0) {
          setSubscription(subData[0]);
          setCurrentTier(subData[0].tier);
        }
      } catch {
        setCurrentTier(null);
      }

      // Load payments
      try {
        const { data: paymentData } = await supabase
          .from("payments")
          .select("id, amount, description, status, created_at")
          .eq("client_id", currentUser.id)
          .order("created_at", { ascending: false });
        if (paymentData && paymentData.length > 0) {
          setPayments(paymentData);
        }
      } catch {}

      // Load coaching programs
      try {
        const { data: programData } = await supabase
          .from("coaching_programs")
          .select("name")
          .eq("client_id", currentUser.id)
          .eq("active", true);
        if (programData && programData.length > 0) {
          setPrograms(programData.map((p: { name: string }) => p.name));
        }
      } catch {}

      // Load conversations count
      try {
        const { count } = await supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("client_id", currentUser.id);
        setConversationsCount(count || 0);
      } catch {}

      setLoading(false);
    });

    // If coming from pricing page with upgrade param, go to billing
    if (upgradeParam) {
      setActiveSection("billing");
      setPendingTier(upgradeParam);
      setShowPlanConfirm(true);
    }

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/account/login");
      else setUser(session.user);
    });

    return () => authSub.unsubscribe();
  }, [router, upgradeParam]);

  /* ---------- actions ---------- */
  const handleSaveProfile = async () => {
    if (!user) return;
    const fullName = `${profileFirstName.trim()} ${profileLastName.trim()}`.trim();
    await supabase.from("clients").update({
      full_name: fullName,
      phone: phone.trim() || null,
      address: address.trim() || null,
      emergency_contact_name: emergencyName.trim() || null,
      emergency_contact_phone: emergencyPhone.trim() || null,
      date_of_birth: dob || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    await supabase.auth.updateUser({
      data: { full_name: fullName, phone: phone.trim() },
    });
    setEditingProfile(false);
    setProfileSaveMsg("Profile saved successfully");
    setTimeout(() => setProfileSaveMsg(""), 3000);
  };

  const handleConfirmPlanChange = async () => {
    if (!user || !pendingTier) return;
    setUpgradeProcessing(true);
    setUpgradeMsg("");

    try {
      // For paid plans, this is where Rapyd payment would be triggered
      const selectedTier = tiers.find(t => t.id === pendingTier);
      const isPaid = selectedTier && selectedTier.price !== "0";

      if (isPaid) {
        // TODO: Integrate Rapyd payment here
        // For now, we proceed with plan change and log that payment is pending
        console.log(`[Payment] Would charge ${selectedTier.price} ISK for ${selectedTier.name}`);
      }

      // Cancel existing subscription
      if (subscription) {
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("id", subscription.id);
      }

      // Ensure client row exists
      const { data: clientExists } = await supabase.from("clients").select("id").eq("id", user.id).single();
      if (!clientExists) {
        await supabase.from("clients").insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
          created_at: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error: insertErr } = await supabase
        .from("subscriptions")
        .insert({
          client_id: user.id,
          tier: pendingTier,
          status: "active",
          current_period_start: now,
          current_period_end: periodEnd,
        });

      if (insertErr) {
        setUpgradeMsg(`Error: ${insertErr.message}`);
      } else {
        setCurrentTier(pendingTier);
        setUpgradeMsg("Plan updated successfully!");
        setShowPlanConfirm(false);
        setShowChangePlan(false);
        setPendingTier(null);
        // Reload subscription
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("id, tier, status, trial_ends_at, current_period_start, current_period_end")
          .eq("client_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        if (subData && subData.length > 0) {
          setSubscription(subData[0]);
        }
      }
    } catch (err) {
      setUpgradeMsg(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    setUpgradeProcessing(false);
  };

  const handleChangePassword = async () => {
    setPasswordMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg(error.message);
    } else {
      setPasswordMsg("Password updated successfully.");
      setNewPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordMsg("");
      }, 2000);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || !user) {
        setDeleteError("Not authenticated.");
        setDeleteLoading(false);
        return;
      }
      const response = await fetch(
        "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/delete-user",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: user.id }),
        },
      );
      let result: Record<string, unknown>;
      try { result = await response.json(); } catch { result = {}; }
      if (!response.ok) {
        setDeleteError((result.error as string) || (result.message as string) || "Failed to delete account.");
        setDeleteLoading(false);
        return;
      }
      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ecf0f3]">
        <div className="animate-spin w-8 h-8 border-4 border-[#20c858] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const activeTier = tiers.find((t) => t.id === currentTier) ?? null;
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "long" })
    : "N/A";
  const visiblePayments = showAllPayments ? payments : payments.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#ecf0f3]">
      {/* ---- page header ---- */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#20c858] text-white text-lg font-bold flex items-center justify-center shrink-0">
              {(profileFirstName || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">
                {profileFirstName ? `${profileFirstName} ${profileLastName}`.trim() : "My Account"}
              </h1>
              <p className="text-sm text-[#6B7280]">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-red-200 text-red-600 text-sm font-semibold rounded-full hover:bg-red-50 hover:border-red-300 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 -mt-2">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ---- Left navigation ---- */}
          <aside className="lg:w-56 shrink-0">
            <nav className="bg-white rounded-2xl shadow-sm p-2 lg:sticky lg:top-24 grid grid-cols-2 lg:grid-cols-1 lg:flex lg:flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    activeSection === item.id
                      ? "bg-[#20c858]/10 text-[#20c858]"
                      : "text-[#6B7280] hover:text-[#1F2937] hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* ---- Main content ---- */}
          <main className="flex-1 space-y-6">
            {/* ============ HEALTH OVERVIEW ============ */}
            {activeSection === "overview" && (
              <>
                {/* Welcome card */}
                <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#20c858] text-white text-xl font-bold flex items-center justify-center shrink-0">
                      {(profileFirstName || user.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#1F2937]">
                        Welcome back, {profileFirstName || "there"}
                      </h2>
                      <p className="text-sm text-[#6B7280]">Member since {memberSince}</p>
                    </div>
                  </div>
                </section>

                {/* Quick actions */}
                <section>
                  <h3 className="text-sm font-medium text-[#6B7280] mb-3 px-1">Quick actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Link href="/assessment"
                      className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow group">
                      <div className="w-10 h-10 rounded-xl bg-[#20c858]/10 flex items-center justify-center mb-3 group-hover:bg-[#20c858]/20 transition-colors">
                        <svg className="w-5 h-5 text-[#20c858]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-[#1F2937]">Book Assessment</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">Schedule a health check</p>
                    </Link>
                    <button onClick={() => setActiveSection("billing")}
                      className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow group text-left">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-[#1F2937]">View Plans</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">Manage your subscription</p>
                    </button>
                    <Link href="/coaching#download"
                      className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow group">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-[#1F2937]">Download App</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">Get the Lifeline app</p>
                    </Link>
                  </div>
                </section>

                {/* Your plan + Assessment status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <section className="bg-white rounded-2xl shadow-sm p-6">
                    <h3 className="text-sm font-medium text-[#6B7280] mb-3">Your plan</h3>
                    {activeTier ? (
                      <div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${activeTier.badgeColor}`}>
                          {activeTier.name}
                        </span>
                        {subscription?.current_period_end && currentTier !== "free-trial" && (
                          <p className="text-xs text-[#6B7280] mt-2">
                            Next billing:{" "}
                            <span className="font-medium text-[#1F2937]">
                              {new Date(subscription.current_period_end).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                            </span>
                          </p>
                        )}
                        {currentTier === "free-trial" && (
                          <p className="text-xs text-[#6B7280] mt-2">Free forever</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-[#6B7280]">No active plan</p>
                        <button onClick={() => setActiveSection("billing")}
                          className="mt-2 text-sm font-medium text-[#20c858] hover:underline">
                          Choose a plan
                        </button>
                      </div>
                    )}
                  </section>

                  <section className="bg-white rounded-2xl shadow-sm p-6">
                    <h3 className="text-sm font-medium text-[#6B7280] mb-3">Assessment status</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#ecf0f3] flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1F2937]">No assessments yet</p>
                        <Link href="/assessment" className="text-xs text-[#20c858] hover:underline">Book your first</Link>
                      </div>
                    </div>
                  </section>
                </div>
              </>
            )}

            {/* ============ PROFILE ============ */}
            {activeSection === "profile" && (
              <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <h2 className="text-lg font-semibold text-[#1F2937]">Personal Information</h2>
                  {!editingProfile && (
                    <button onClick={() => setEditingProfile(true)} className="text-sm font-medium text-[#20c858] hover:underline">
                      Edit
                    </button>
                  )}
                </div>

                {editingProfile ? (
                  <div className="space-y-4 max-w-lg">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                        <input value={profileFirstName} onChange={(e) => setProfileFirstName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                        <input value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input value={user.email || ""} disabled
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900"
                        placeholder="Phone number" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input value={address} onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900"
                        placeholder="Your address" />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact</label>
                        <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900"
                          placeholder="Contact name" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency phone</label>
                        <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} type="tel"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900"
                          placeholder="Contact phone" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
                      <input value={dob} onChange={(e) => setDob(e.target.value)} type="date"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={handleSaveProfile}
                        className="px-5 py-2.5 bg-[#20c858] text-white text-sm font-semibold rounded-lg hover:bg-[#1ab34d] transition-colors">
                        Save changes
                      </button>
                      <button onClick={() => setEditingProfile(false)}
                        className="px-5 py-2.5 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors">
                        Cancel
                      </button>
                    </div>
                    {profileSaveMsg && (
                      <div className="mt-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
                        {profileSaveMsg}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[#6B7280] text-xs uppercase tracking-wider">Name</span>
                      <p className={`font-medium mt-0.5 ${profileFirstName ? "text-[#1F2937]" : "text-[#9CA3AF]"}`}>
                        {profileFirstName || profileLastName ? `${profileFirstName} ${profileLastName}`.trim() : "Not set"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#6B7280] text-xs uppercase tracking-wider">Email</span>
                      <p className="text-[#1F2937] font-medium mt-0.5">{user.email}</p>
                    </div>
                    <div>
                      <span className="text-[#6B7280] text-xs uppercase tracking-wider">Phone</span>
                      <p className={`font-medium mt-0.5 ${phone ? "text-[#1F2937]" : "text-[#9CA3AF]"}`}>{phone || "Not set"}</p>
                    </div>
                    <div>
                      <span className="text-[#6B7280] text-xs uppercase tracking-wider">Address</span>
                      <p className={`font-medium mt-0.5 ${address ? "text-[#1F2937]" : "text-[#9CA3AF]"}`}>{address || "Not set"}</p>
                    </div>
                    <div>
                      <span className="text-[#6B7280] text-xs uppercase tracking-wider">Emergency contact</span>
                      <p className={`font-medium mt-0.5 ${emergencyName ? "text-[#1F2937]" : "text-[#9CA3AF]"}`}>
                        {emergencyName ? `${emergencyName}${emergencyPhone ? ` (${emergencyPhone})` : ""}` : "Not set"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#6B7280] text-xs uppercase tracking-wider">Date of birth</span>
                      <p className={`font-medium mt-0.5 ${dob ? "text-[#1F2937]" : "text-[#9CA3AF]"}`}>
                        {dob ? new Date(dob).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }) : "Not set"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#6B7280] text-xs uppercase tracking-wider">Member since</span>
                      <p className="text-[#1F2937] font-medium mt-0.5">{memberSince}</p>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ============ MESSAGES ============ */}
            {activeSection === "messages" && (
              <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-6">Messages</h2>
                {conversationsCount > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[#6B7280]">
                      You have <span className="font-semibold text-[#1F2937]">{conversationsCount}</span> conversation{conversationsCount !== 1 ? "s" : ""}.
                    </p>
                    <p className="text-sm text-[#6B7280]">
                      Open the Lifeline app to view and reply to your messages.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#ecf0f3] rounded-xl p-8 text-center">
                    <svg className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm font-medium text-[#1F2937] mb-1">No messages yet</p>
                    <p className="text-xs text-[#6B7280]">
                      Direct messaging with your coach is available on the Full Access plan.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* ============ BILLING & PLANS ============ */}
            {activeSection === "billing" && (
              <>
                {/* Current Plan */}
                <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Current Plan</h2>

                  {activeTier ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${activeTier.badgeColor}`}>
                            {activeTier.name}
                          </span>
                          <span className="text-sm text-[#6B7280]">
                            {activeTier.price === "0" ? "Free" : `${activeTier.price} ISK / ${activeTier.period}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => setShowChangePlan(!showChangePlan)}
                            className="text-sm font-medium text-[#20c858] hover:underline">
                            {showChangePlan ? "Hide plans" : "Change plan"}
                          </button>
                          {currentTier !== "free-trial" && (
                            <button onClick={() => setShowCancelConfirm(true)}
                              className="text-sm text-red-500 hover:underline">
                              Cancel subscription
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Next billing date */}
                      {subscription?.current_period_end && currentTier !== "free-trial" && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 mb-4">
                          Next billing date:{" "}
                          <span className="font-semibold">
                            {new Date(subscription.current_period_end).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-[#ecf0f3] rounded-xl p-6 text-center">
                      <p className="text-sm text-[#6B7280] mb-3">You don&apos;t have an active subscription.</p>
                      <button onClick={() => setShowChangePlan(true)}
                        className="inline-flex items-center justify-center px-5 py-2.5 bg-[#20c858] text-white text-sm font-semibold rounded-full hover:bg-[#1ab34d] transition-colors">
                        Choose a plan
                      </button>
                    </div>
                  )}

                  {/* Cancel confirmation */}
                  {showCancelConfirm && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-4">
                      <p className="text-sm text-red-700 mb-3">
                        Are you sure? You&apos;ll keep access until the end of your current billing period.
                      </p>
                      <div className="flex gap-3">
                        <button onClick={async () => {
                          if (subscription) {
                            await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subscription.id);
                          }
                          setCurrentTier(null);
                          setSubscription(null);
                          setShowCancelConfirm(false);
                        }}
                          className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
                          Yes, cancel
                        </button>
                        <button onClick={() => setShowCancelConfirm(false)}
                          className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors">
                          Keep my plan
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Plan picker */}
                  {showChangePlan && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      {tiers.map((tier) => {
                        const isCurrent = tier.id === currentTier;
                        const isSelected = tier.id === pendingTier;
                        return (
                          <button key={tier.id}
                            onClick={() => {
                              if (!isCurrent) {
                                setPendingTier(tier.id);
                                setShowPlanConfirm(true);
                              }
                            }}
                            className={`rounded-xl border-2 p-5 text-left transition-all ${
                              isCurrent ? "border-[#20c858] bg-[#20c858]/5" :
                              isSelected ? "border-blue-400 bg-blue-50" :
                              "border-gray-200 hover:border-[#20c858]/50"
                            }`}>
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-2 ${tier.badgeColor}`}>
                              {tier.name}
                            </span>
                            <p className="text-xl font-bold text-[#1F2937]">
                              {tier.price === "0" ? "Free" : `${tier.price} ISK`}
                            </p>
                            <p className="text-xs text-[#6B7280] mb-3">{tier.period}</p>
                            <ul className="space-y-1">
                              {tier.features.map((f) => (
                                <li key={f} className="text-xs text-[#6B7280] flex items-start gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-[#20c858] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {f}
                                </li>
                              ))}
                            </ul>
                            {isCurrent && (
                              <p className="text-xs font-medium text-[#20c858] mt-3">Current plan</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Confirm plan change modal */}
                  {showPlanConfirm && pendingTier && pendingTier !== currentTier && (
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-5 py-5">
                      <h3 className="text-sm font-semibold text-[#1F2937] mb-2">Confirm plan change</h3>
                      {(() => {
                        const target = tiers.find(t => t.id === pendingTier);
                        if (!target) return null;
                        const isPaid = target.price !== "0";
                        return (
                          <>
                            <p className="text-sm text-[#6B7280] mb-1">
                              You are switching to <span className="font-semibold text-[#1F2937]">{target.name}</span>
                              {isPaid ? ` at ${target.price} ISK / ${target.period}.` : " (free)."}
                            </p>
                            {isPaid && (
                              <p className="text-xs text-[#6B7280] mb-3">
                                Payment will be processed via our secure payment provider. Your new billing cycle starts today.
                              </p>
                            )}
                            {upgradeMsg && (
                              <p className={`text-sm mb-3 ${upgradeMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{upgradeMsg}</p>
                            )}
                            <div className="flex gap-3">
                              <button onClick={handleConfirmPlanChange} disabled={upgradeProcessing}
                                className="px-5 py-2.5 bg-[#20c858] text-white text-sm font-semibold rounded-lg hover:bg-[#1ab34d] transition-colors disabled:opacity-50">
                                {upgradeProcessing ? "Processing..." : isPaid ? "Confirm & Pay" : "Confirm change"}
                              </button>
                              <button onClick={() => { setShowPlanConfirm(false); setPendingTier(null); setUpgradeMsg(""); }}
                                className="px-5 py-2.5 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors">
                                Cancel
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </section>

                {/* Payment History */}
                <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[#1F2937]">Payment History</h2>
                    {!showAllPayments && payments.length > 5 && (
                      <button onClick={() => setShowAllPayments(true)}
                        className="text-sm font-medium text-[#20c858] hover:underline">
                        View all
                      </button>
                    )}
                  </div>

                  {payments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[#6B7280] border-b border-gray-100">
                            <th className="pb-3 font-medium">Date</th>
                            <th className="pb-3 font-medium">Description</th>
                            <th className="pb-3 font-medium text-right">Amount</th>
                            <th className="pb-3 font-medium text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visiblePayments.map((p) => (
                            <tr key={p.id} className="border-b border-gray-50 last:border-0">
                              <td className="py-3 text-[#1F2937]">{new Date(p.created_at).toLocaleDateString("en-GB")}</td>
                              <td className="py-3 text-[#6B7280]">{p.description}</td>
                              <td className="py-3 text-[#1F2937] font-medium text-right">{p.amount.toLocaleString()} ISK</td>
                              <td className="py-3 text-right">
                                <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">{p.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-[#ecf0f3] rounded-xl p-8 text-center">
                      <svg className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                      </svg>
                      <p className="text-sm text-[#6B7280]">Your payment history will appear here after your first transaction</p>
                    </div>
                  )}
                </section>

                {/* Payment Method */}
                <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Payment Method</h2>
                  <div className="bg-[#ecf0f3] rounded-xl p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                          <svg className="w-6 h-6 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1F2937]">No payment method on file</p>
                          <p className="text-xs text-[#6B7280]">Add a card or payment method to enable paid plans</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // TODO: Integrate Rapyd payment method collection
                          alert("Payment method setup will be available soon via our secure payment provider.");
                        }}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#20c858] text-white text-sm font-semibold rounded-lg hover:bg-[#1ab34d] transition-colors shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add payment method
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ============ ASSESSMENT ============ */}
            {activeSection === "assessment" && (
              <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-6">Health Assessment</h2>

                <div className="bg-gradient-to-r from-[#20c858]/10 to-[#20c858]/5 rounded-xl p-6 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#1F2937] mb-1">Book your assessment</h3>
                      <p className="text-sm text-[#6B7280]">
                        Visit a Lifeline Health station for body composition measurements and targeted blood work.
                      </p>
                    </div>
                    <Link href="/assessment"
                      className="inline-flex items-center justify-center px-6 py-3 bg-[#20c858] text-white text-sm font-semibold rounded-full hover:bg-[#1ab34d] transition-colors shrink-0">
                      Book Assessment
                    </Link>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-[#1F2937] mb-3">Assessment History</h3>
                  <div className="bg-[#ecf0f3] rounded-xl p-8 text-center">
                    <svg className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm text-[#6B7280] mb-3">
                      Complete your first assessment to see results here
                    </p>
                    <Link href="/assessment"
                      className="inline-flex items-center justify-center px-5 py-2.5 bg-[#20c858] text-white text-sm font-semibold rounded-full hover:bg-[#1ab34d] transition-colors">
                      Book Assessment
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {/* ============ APP & DEVICES ============ */}
            {activeSection === "app" && (
              <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-6">App & Devices</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-[#6B7280] mb-3">Download the Lifeline app</p>
                    <div className="flex gap-3">
                      <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1F2937] text-white text-sm font-medium rounded-lg hover:bg-[#374151] transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.49C5.56 7.99 7.12 7.04 8.82 7.02C10.11 7 11.33 7.89 12.12 7.89C12.91 7.89 14.38 6.82 15.92 7C16.55 7.03 18.33 7.27 19.44 8.93C19.35 8.99 17.22 10.24 17.25 12.78C17.28 15.83 19.98 16.87 20 16.88C19.98 16.93 19.56 18.39 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                        </svg>
                        App Store
                      </a>
                      <a href="https://play.google.com" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1F2937] text-white text-sm font-medium rounded-lg hover:bg-[#374151] transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.61 3 21.09 3 20.5ZM16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12ZM20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.53 12.9 20.18 13.18L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81ZM6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z" />
                        </svg>
                        Google Play
                      </a>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-[#6B7280] mb-3">Scan to download</p>
                    <div className="w-28 h-28 bg-[#ecf0f3] rounded-xl flex items-center justify-center">
                      <span className="text-xs text-[#6B7280]">QR Code</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <p className="text-sm text-[#6B7280] mb-2">Current coaching programs</p>
                  {programs.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {programs.map((prog) => (
                        <span key={prog} className="px-3 py-1 bg-[#20c858]/10 text-[#20c858] text-xs font-medium rounded-full">
                          {prog}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#ecf0f3] rounded-xl p-8 text-center">
                      <svg className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                      <p className="text-sm text-[#6B7280]">Programs will appear once you start coaching</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ============ SETTINGS ============ */}
            {activeSection === "settings" && (
              <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-6">Account Settings</h2>

                {/* Password */}
                <div className="border-b border-gray-100 pb-5 mb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1F2937]">Password</p>
                      <p className="text-xs text-[#6B7280]">Update your account password</p>
                    </div>
                    <button onClick={() => setShowPasswordForm(!showPasswordForm)}
                      className="text-sm font-medium text-[#20c858] hover:underline">
                      {showPasswordForm ? "Cancel" : "Change"}
                    </button>
                  </div>
                  {showPasswordForm && (
                    <div className="mt-4 max-w-sm space-y-3">
                      <input type="password" placeholder="New password (min 6 characters)" value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900" />
                      {passwordMsg && (
                        <p className={`text-xs ${passwordMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>{passwordMsg}</p>
                      )}
                      <button onClick={handleChangePassword} disabled={newPassword.length < 6}
                        className="px-5 py-2 bg-[#20c858] text-white text-sm font-semibold rounded-lg hover:bg-[#1ab34d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Update Password
                      </button>
                    </div>
                  )}
                </div>

                {/* Notifications */}
                <div className="border-b border-gray-100 pb-5 mb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1F2937]">Notification Preferences</p>
                      <p className="text-xs text-[#6B7280]">Email and push notification settings</p>
                    </div>
                    <span className="text-sm text-[#6B7280]">Coming soon</span>
                  </div>
                </div>

                {/* Connected Devices */}
                <div className="border-b border-gray-100 pb-5 mb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1F2937]">Connected Devices</p>
                      <p className="text-xs text-[#6B7280]">Manage devices linked to your account</p>
                    </div>
                    <span className="text-sm text-[#6B7280]">Coming soon</span>
                  </div>
                </div>

                {/* Delete Account */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-600">Delete Account</p>
                      <p className="text-xs text-[#6B7280]">Permanently remove your account and all data</p>
                    </div>
                    <button onClick={() => setShowDeleteConfirm(true)}
                      className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors">
                      Delete
                    </button>
                  </div>
                  {showDeleteConfirm && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
                      <p className="text-sm text-red-700 mb-3">
                        This will permanently delete your account and all data. This cannot be undone.
                      </p>
                      <p className="text-sm text-red-700 mb-2">
                        Type <span className="font-bold">DELETE</span> to confirm:
                      </p>
                      <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Type DELETE"
                        className="w-full max-w-[200px] px-3 py-2 border border-red-300 rounded-lg text-sm mb-3 outline-none focus:ring-2 focus:ring-red-400 text-gray-900" />
                      {deleteError && <p className="text-sm text-red-600 mb-2">{deleteError}</p>}
                      <div className="flex gap-3">
                        <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                          className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {deleteLoading ? "Deleting..." : "Yes, delete my account"}
                        </button>
                        <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeleteError(""); }}
                          className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/* Wrap with Suspense for useSearchParams */
export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#ecf0f3]">
        <div className="animate-spin w-8 h-8 border-4 border-[#20c858] border-t-transparent rounded-full" />
      </div>
    }>
      <AccountPageInner />
    </Suspense>
  );
}
