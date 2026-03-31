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
    name: "Free Trial",
    price: "0",
    period: "14 days",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    id: "self-maintained",
    name: "Self-maintained",
    price: "9.900",
    period: "per month",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    id: "full-access",
    name: "Full Access",
    price: "29.900",
    period: "per month",
    badgeColor: "bg-green-100 text-green-700",
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

/* ---------- helper: days between ---------- */
function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/* ============================================================
   ACCOUNT PAGE (inner component that uses useSearchParams)
   ============================================================ */
function AccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /* profile fields */
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);

  /* subscription state (loaded from Supabase) */
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  /* upgrade flow from pricing page */
  const upgradeParam = searchParams.get("upgrade");
  const [showUpgradeFlow, setShowUpgradeFlow] = useState(!!upgradeParam);
  const [upgradeTarget, setUpgradeTarget] = useState<string | null>(upgradeParam);
  const [upgradeProcessing, setUpgradeProcessing] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState("");

  /* password */
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  /* delete account */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  /* payments (loaded from Supabase) */
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [showAllPayments, setShowAllPayments] = useState(false);

  /* coaching programs (loaded from Supabase) */
  const [programs, setPrograms] = useState<string[]>([]);

  /* ---------- auth check + load real data ---------- */
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
          .select("full_name, phone, address, emergency_contact_name, emergency_contact_phone")
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
        } else {
          // Fallback to auth metadata
          const metaName = currentUser.user_metadata?.full_name || "";
          const parts = metaName.split(" ");
          setProfileFirstName(parts[0] || "");
          setProfileLastName(parts.slice(1).join(" ") || "");
          setPhone(currentUser.phone || currentUser.user_metadata?.phone || "");
        }
      } catch {
        // Clients table may not exist, fall back to auth metadata
        const metaName = currentUser.user_metadata?.full_name || "";
        const parts = metaName.split(" ");
        setProfileFirstName(parts[0] || "");
        setProfileLastName(parts.slice(1).join(" ") || "");
        setPhone(currentUser.phone || currentUser.user_metadata?.phone || "");
      }

      // Load subscription from Supabase
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
        } else {
          setCurrentTier(null);
          setSubscription(null);
        }
      } catch {
        // Subscription table may not exist yet
        setCurrentTier(null);
      }

      // Load payments from Supabase
      try {
        const { data: paymentData } = await supabase
          .from("payments")
          .select("id, amount, description, status, created_at")
          .eq("client_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (paymentData && paymentData.length > 0) {
          setPayments(paymentData);
        }
      } catch {
        // Payments table may not exist yet
      }

      // Load coaching programs from Supabase
      try {
        const { data: programData } = await supabase
          .from("coaching_programs")
          .select("name")
          .eq("client_id", currentUser.id)
          .eq("active", true);

        if (programData && programData.length > 0) {
          setPrograms(programData.map((p: { name: string }) => p.name));
        }
      } catch {
        // Programs table may not exist yet
      }

      setLoading(false);
    });

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/account/login");
      else setUser(session.user);
    });

    return () => authSub.unsubscribe();
  }, [router]);

  /* ---------- actions ---------- */
  const handleSaveProfile = async () => {
    if (!user) return;
    const fullName = `${profileFirstName.trim()} ${profileLastName.trim()}`.trim();
    // Update clients table
    await supabase.from("clients").update({
      full_name: fullName,
      phone: phone.trim() || null,
      address: address.trim() || null,
      emergency_contact_name: emergencyName.trim() || null,
      emergency_contact_phone: emergencyPhone.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    // Also update auth metadata for consistency
    await supabase.auth.updateUser({
      data: { full_name: fullName, phone: phone.trim() },
    });
    setEditingProfile(false);
  };

  const handleChangePassword = async () => {
    setPasswordMsg("");
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
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
        setDeleteError("Not authenticated. Please sign in again.");
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

      const result = await response.json();

      if (!response.ok) {
        setDeleteError(result.error || "Failed to delete account.");
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

  /* ---------- loading / redirect ---------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ecf0f3]">
        <div className="animate-spin w-8 h-8 border-4 border-[#20c858] border-t-transparent rounded-full" />
      </div>
    );
  }

  /* ---------- upgrade handler ---------- */
  const handleUpgrade = async (targetTier: string) => {
    if (!user) return;
    setUpgradeProcessing(true);
    setUpgradeMsg("");

    try {
      // Cancel existing subscription if any
      if (subscription) {
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("id", subscription.id);
      }

      // Ensure client row exists (might be missing if account was created before the fix)
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
          tier: targetTier,
          status: "active",
          current_period_start: now,
          current_period_end: periodEnd,
          trial_ends_at: targetTier === "free-trial"
            ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
            : null,
        });

      if (insertErr) {
        setUpgradeMsg(`Error: ${insertErr.message}`);
      } else {
        setCurrentTier(targetTier);
        setUpgradeMsg("Subscription updated successfully!");
        setShowUpgradeFlow(false);
        setUpgradeTarget(null);
        // Reload subscription data
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

  if (!user) return null;

  const activeTier = tiers.find((t) => t.id === currentTier) ?? null;
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
      })
    : "N/A";
  const visiblePayments = showAllPayments
    ? payments
    : payments.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#ecf0f3]">
      {/* ---- page header ---- */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              My Account
            </h1>
            <p className="mt-1 text-[#6B7280]">
              Manage your subscription, profile, and settings
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-[#6B7280] hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 space-y-8 -mt-2">
        {/* ============ 1. PROFILE ============ */}
        <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1F2937]">Profile</h2>
            {!editingProfile && (
              <button
                onClick={() => setEditingProfile(true)}
                className="text-sm font-medium text-[#20c858] hover:underline"
              >
                Edit profile
              </button>
            )}
          </div>

          {editingProfile ? (
            <div className="space-y-4 max-w-md">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First name
                  </label>
                  <input
                    value={profileFirstName}
                    onChange={(e) => setProfileFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none transition-all text-gray-900"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last name
                  </label>
                  <input
                    value={profileLastName}
                    onChange={(e) => setProfileLastName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none transition-all text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  value={user.email || ""}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none transition-all text-gray-900"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none transition-all text-gray-900"
                  placeholder="Your address"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Emergency contact
                  </label>
                  <input
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none transition-all text-gray-900"
                    placeholder="Contact name"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Emergency phone
                  </label>
                  <input
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    type="tel"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none transition-all text-gray-900"
                    placeholder="Contact phone"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  className="px-5 py-2 bg-[#20c858] text-white text-sm font-semibold rounded-lg hover:bg-[#1ab34d] transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="px-5 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-[#6B7280] w-40">Name</span>
                <span className={`font-medium ${profileFirstName ? "text-[#1F2937]" : "text-[#6B7280]"}`}>
                  {profileFirstName || profileLastName ? `${profileFirstName} ${profileLastName}`.trim() : "Not set"}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#6B7280] w-40">Email</span>
                <span className="text-[#1F2937] font-medium">
                  {user.email}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#6B7280] w-40">Phone</span>
                <span className={`font-medium ${phone ? "text-[#1F2937]" : "text-[#6B7280]"}`}>
                  {phone || "Not set"}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#6B7280] w-40">Address</span>
                <span className={`font-medium ${address ? "text-[#1F2937]" : "text-[#6B7280]"}`}>
                  {address || "Not set"}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#6B7280] w-40">Emergency contact</span>
                <span className={`font-medium ${emergencyName ? "text-[#1F2937]" : "text-[#6B7280]"}`}>
                  {emergencyName ? `${emergencyName}${emergencyPhone ? ` (${emergencyPhone})` : ""}` : "Not set"}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#6B7280] w-40">Member since</span>
                <span className="text-[#1F2937] font-medium">
                  {memberSince}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ============ UPGRADE FLOW (from pricing page) ============ */}
        {showUpgradeFlow && (
          <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 ring-2 ring-[#20c858]">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
              Choose your plan
            </h2>
            {upgradeMsg && (
              <p className={`text-sm mb-3 ${upgradeMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{upgradeMsg}</p>
            )}
            <div className="space-y-3 mb-4">
              {tiers.map((tier) => {
                const isSelected = upgradeTarget === tier.id;
                const isCurrent = currentTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setUpgradeTarget(tier.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected ? "border-[#20c858] bg-[#20c858]/5" : isCurrent ? "border-gray-300 bg-gray-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${tier.badgeColor}`}>{tier.name}</span>
                        {isCurrent && <span className="text-xs text-gray-400 ml-2">Current plan</span>}
                      </div>
                      <span className="text-sm font-semibold text-[#1F2937]">
                        {tier.price === "0" ? "Free" : `${tier.price} ISK / ${tier.period}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {upgradeTarget && upgradeTarget !== currentTier && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleUpgrade(upgradeTarget)}
                  disabled={upgradeProcessing}
                  className="px-5 py-2 bg-[#20c858] text-white text-sm font-semibold rounded-lg hover:bg-[#1ab34d] transition-colors disabled:opacity-50"
                >
                  {upgradeProcessing ? "Processing..." : `Confirm change`}
                </button>
                <button
                  onClick={() => { setShowUpgradeFlow(false); setUpgradeTarget(null); }}
                  className="px-5 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>
        )}

        {/* ============ 2. CURRENT PLAN ============ */}
        <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
            Current Plan
          </h2>

          {activeTier ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${activeTier.badgeColor}`}
                  >
                    {activeTier.name}
                  </span>
                  <span className="text-sm text-[#6B7280]">
                    {activeTier.price === "0"
                      ? "Free"
                      : `${activeTier.price} ISK / ${activeTier.period}`}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowChangePlan(!showChangePlan)}
                    className="text-sm font-medium text-[#20c858] hover:underline"
                  >
                    {showChangePlan ? "Hide plans" : "Change Plan"}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>

              {/* trial countdown */}
              {currentTier === "free-trial" && subscription?.trial_ends_at && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-4">
                  Your free trial ends on{" "}
                  <span className="font-semibold">
                    {new Date(subscription.trial_ends_at).toLocaleDateString("en-GB")}
                  </span>{" "}
                  ({daysUntil(subscription.trial_ends_at)} days remaining). Upgrade to keep access.
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#ecf0f3] rounded-xl p-6 text-center">
              <p className="text-sm text-[#6B7280] mb-3">
                You don&apos;t have an active subscription.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-[#20c858] text-white text-sm font-semibold rounded-full hover:bg-[#1ab34d] transition-colors"
              >
                View Plans
              </Link>
            </div>
          )}

          {/* cancel confirmation */}
          {showCancelConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-4">
              <p className="text-sm text-red-700 mb-3">
                Are you sure you want to cancel? You will keep access until the
                end of your current billing period.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (subscription) {
                      await supabase
                        .from("subscriptions")
                        .update({ status: "cancelled" })
                        .eq("id", subscription.id);
                    }
                    setCurrentTier(null);
                    setSubscription(null);
                    setShowCancelConfirm(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, cancel
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
                >
                  Keep my plan
                </button>
              </div>
            </div>
          )}

          {/* inline plan picker */}
          {showChangePlan && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              {tiers.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => handleUpgrade(tier.id)}
                  className={`rounded-xl border-2 p-5 text-left transition-all ${
                    tier.id === currentTier
                      ? "border-[#20c858] bg-[#20c858]/5"
                      : "border-gray-200 hover:border-[#20c858]/50"
                  }`}
                >
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-2 ${tier.badgeColor}`}
                  >
                    {tier.name}
                  </span>
                  <p className="text-xl font-bold text-[#1F2937]">
                    {tier.price === "0" ? "Free" : `${tier.price} ISK`}
                  </p>
                  <p className="text-xs text-[#6B7280]">{tier.period}</p>
                  {tier.id === currentTier && (
                    <p className="text-xs font-medium text-[#20c858] mt-2">
                      Current plan
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ============ 3. HEALTH ASSESSMENT ============ */}
        <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
            Health Assessment
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-[#6B7280]">Current package</p>
              <p className="text-sm font-medium text-[#1F2937]">
                Foundational Health
              </p>
            </div>
            <button
              onClick={() => {
                /* Medalia widget would open here */
              }}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-[#20c858] text-white text-sm font-semibold rounded-full hover:bg-[#1ab34d] transition-colors"
            >
              Book Assessment
            </button>
          </div>

          <div>
            <h3 className="text-sm font-medium text-[#1F2937] mb-3">
              Assessment History
            </h3>
            <div className="bg-[#ecf0f3] rounded-xl p-6 text-center">
              <p className="text-sm text-[#6B7280]">
                Your assessment history will appear here once you complete your
                first visit.
              </p>
            </div>
          </div>
        </section>

        {/* ============ 4. APP ACCESS ============ */}
        <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
            App Access
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* download links */}
            <div>
              <p className="text-sm text-[#6B7280] mb-3">
                Download the Lifeline app
              </p>
              <div className="flex gap-3">
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1F2937] text-white text-sm font-medium rounded-lg hover:bg-[#374151] transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.49C5.56 7.99 7.12 7.04 8.82 7.02C10.11 7 11.33 7.89 12.12 7.89C12.91 7.89 14.38 6.82 15.92 7C16.55 7.03 18.33 7.27 19.44 8.93C19.35 8.99 17.22 10.24 17.25 12.78C17.28 15.83 19.98 16.87 20 16.88C19.98 16.93 19.56 18.39 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                  </svg>
                  App Store
                </a>
                <a
                  href="https://play.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1F2937] text-white text-sm font-medium rounded-lg hover:bg-[#374151] transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.61 3 21.09 3 20.5ZM16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12ZM20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.53 12.9 20.18 13.18L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81ZM6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z" />
                  </svg>
                  Google Play
                </a>
              </div>
            </div>

            {/* QR placeholder */}
            <div>
              <p className="text-sm text-[#6B7280] mb-3">Scan to download</p>
              <div className="w-28 h-28 bg-[#ecf0f3] rounded-xl flex items-center justify-center">
                <span className="text-xs text-[#6B7280]">QR Code</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-sm text-[#6B7280] mb-2">
              Current coaching programs
            </p>
            {programs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {programs.map((prog) => (
                  <span
                    key={prog}
                    className="px-3 py-1 bg-[#20c858]/10 text-[#20c858] text-xs font-medium rounded-full"
                  >
                    {prog}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7280]">
                No active coaching programs. Programs will appear here once assigned by your coach.
              </p>
            )}
          </div>
        </section>

        {/* ============ 5. PAYMENT HISTORY ============ */}
        <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1F2937]">
              Payment History
            </h2>
            {!showAllPayments && payments.length > 3 && (
              <button
                onClick={() => setShowAllPayments(true)}
                className="text-sm font-medium text-[#20c858] hover:underline"
              >
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
                  {visiblePayments.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="py-3 text-[#1F2937]">
                        {new Date(p.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="py-3 text-[#6B7280]">{p.description}</td>
                      <td className="py-3 text-[#1F2937] font-medium text-right">
                        {p.amount.toLocaleString()} ISK
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-[#ecf0f3] rounded-xl p-6 text-center">
              <p className="text-sm text-[#6B7280]">
                No payment history yet. Payments will appear here once you make a purchase.
              </p>
            </div>
          )}
        </section>

        {/* ============ 6. ACCOUNT SETTINGS ============ */}
        <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-6">
            Account Settings
          </h2>

          {/* change password */}
          <div className="border-b border-gray-100 pb-5 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1F2937]">Password</p>
                <p className="text-xs text-[#6B7280]">
                  Update your account password
                </p>
              </div>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="text-sm font-medium text-[#20c858] hover:underline"
              >
                {showPasswordForm ? "Cancel" : "Change"}
              </button>
            </div>
            {showPasswordForm && (
              <div className="mt-4 max-w-sm space-y-3">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none transition-all text-gray-900"
                />
                {passwordMsg && (
                  <p
                    className={`text-xs ${passwordMsg.includes("success") ? "text-green-600" : "text-red-600"}`}
                  >
                    {passwordMsg}
                  </p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={newPassword.length < 6}
                  className="px-5 py-2 bg-[#20c858] text-white text-sm font-semibold rounded-lg hover:bg-[#1ab34d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Password
                </button>
              </div>
            )}
          </div>

          {/* notification preferences */}
          <div className="border-b border-gray-100 pb-5 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1F2937]">
                  Notification Preferences
                </p>
                <p className="text-xs text-[#6B7280]">
                  Email and push notification settings
                </p>
              </div>
              <Link
                href="/account"
                className="text-sm font-medium text-[#20c858] hover:underline"
              >
                Manage
              </Link>
            </div>
          </div>

          {/* connected devices */}
          <div className="border-b border-gray-100 pb-5 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1F2937]">
                  Connected Devices
                </p>
                <p className="text-xs text-[#6B7280]">
                  Manage devices linked to your account
                </p>
              </div>
              <Link
                href="/account"
                className="text-sm font-medium text-[#20c858] hover:underline"
              >
                View
              </Link>
            </div>
          </div>

          {/* delete account */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">
                  Delete Account
                </p>
                <p className="text-xs text-[#6B7280]">
                  Permanently remove your account and all data
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
            {showDeleteConfirm && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
                <p className="text-sm text-red-700 mb-3">
                  Are you sure? This will permanently delete your account and all
                  data. This action cannot be undone.
                </p>
                <p className="text-sm text-red-700 mb-2">
                  Type <span className="font-bold">DELETE</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full max-w-[200px] px-3 py-2 border border-red-300 rounded-lg text-sm mb-3 outline-none focus:ring-2 focus:ring-red-400 text-gray-900"
                />
                {deleteError && (
                  <p className="text-sm text-red-600 mb-2">{deleteError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteLoading ? "Deleting..." : "Yes, delete my account"}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                      setDeleteError("");
                    }}
                    className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
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
