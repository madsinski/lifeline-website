"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { Suspense } from "react";
import MedaliaButton from "../components/MedaliaButton";

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
type Section = "overview" | "profile" | "messages" | "billing" | "assessment" | "education" | "programs" | "app" | "settings";
const navItems: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Health Overview", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { id: "profile", label: "Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { id: "messages", label: "Messages", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { id: "billing", label: "Billing & Plans", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { id: "assessment", label: "Assessment", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { id: "education", label: "Education", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { id: "programs", label: "My Programs", icon: "M3 6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5v1A1.5 1.5 0 0119.5 9h-15A1.5 1.5 0 013 7.5v-1zM3 11.5h4v5H3v-5zm7 0h4v7h-4v-7zm7 0h4v3h-4v-3z" },
  { id: "app", label: "App & Devices", icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { id: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

/* ---------- custom program types ---------- */
interface CustomProgramExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  rest: string;
}
interface CustomProgramDay {
  exercises: CustomProgramExercise[];
}
interface CustomProgram {
  id: string;
  name: string;
  goal: string;
  duration: number;
  days_per_week: number;
  days: Record<number, CustomProgramDay>;
  created_at: string;
}
interface ExerciseRow {
  id: string;
  name: string;
  description: string;
  category: string;
  equipment: string;
  difficulty: string;
  illustration_url: string;
  instructions: string[];
  muscles_targeted: string[];
}

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
  const [sex, setSex] = useState("");
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
  const [programs, setPrograms] = useState<{ category_key: string; program_key: string; started_at: string }[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<{ key: string; name: string; description: string; category_key: string; level: string }[]>([]);
  const [changingProgram, setChangingProgram] = useState<string | null>(null); // category_key being changed

  /* messages */
  const [conversationsCount, setConversationsCount] = useState(0);

  /* assessments / appointments */
  const [appointments, setAppointments] = useState<{ type: string; date: string; time: string; status: string }[]>([]);

  /* loading states */
  const [profileSaving, setProfileSaving] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  /* profile validation */
  const [profileError, setProfileError] = useState("");

  /* notification prefs (local/visual only) */
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  /* has client data (for connected devices) */
  const [hasClientData, setHasClientData] = useState(false);

  /* education */
  const [eduCourses, setEduCourses] = useState<{ id: string; name: string; description: string; cover_image_url: string; difficulty: string; estimated_duration: string; modules: { id: string; title: string; content: string; readingTime: number; quizQuestions: { id: string; question: string; options: string[]; correctIndex: number }[] }[] }[]>([]);
  const [eduSnippets, setEduSnippets] = useState<{ week_range: string; days: { title: string; bullets: string[] }[] }[]>([]);
  const [eduLoading, setEduLoading] = useState(false);
  const [eduOpenCourse, setEduOpenCourse] = useState<string | null>(null);
  const [eduOpenModule, setEduOpenModule] = useState<string | null>(null);
  const [eduSnippetWeek, setEduSnippetWeek] = useState(0);
  const [eduQuizAnswers, setEduQuizAnswers] = useState<Record<string, number>>({});
  const [eduQuizSubmitted, setEduQuizSubmitted] = useState<Record<string, boolean>>({});

  /* program builder */
  const [customPrograms, setCustomPrograms] = useState<CustomProgram[]>([]);
  const [showProgramBuilder, setShowProgramBuilder] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [builderStep, setBuilderStep] = useState(1);
  const [builderName, setBuilderName] = useState("");
  const [builderGoal, setBuilderGoal] = useState("general fitness");
  const [builderDuration, setBuilderDuration] = useState(8);
  const [builderDaysPerWeek, setBuilderDaysPerWeek] = useState(3);
  const [builderDays, setBuilderDays] = useState<Record<number, CustomProgramDay>>({});
  const [builderActiveDay, setBuilderActiveDay] = useState(0);
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseRow[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState("");
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [programSaving, setProgramSaving] = useState(false);
  const [programSaveMsg, setProgramSaveMsg] = useState("");
  const [viewingExercise, setViewingExercise] = useState<ExerciseRow | null>(null);

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
          .select("full_name, phone, address, emergency_contact_name, emergency_contact_phone, date_of_birth, sex")
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
          setSex((clientData as Record<string, unknown>).sex as string || "");
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

      // Load coaching programs from client_programs
      try {
        const { data: programData } = await supabase
          .from("client_programs")
          .select("category_key, program_key, started_at")
          .eq("client_id", currentUser.id);
        if (programData && programData.length > 0) {
          setPrograms(programData);
        }
        // Load available programs
        const { data: allProgs } = await supabase
          .from("programs")
          .select("key, name, description, level, category_id, program_categories!inner(key)")
          .order("name");
        if (allProgs) {
          setAvailablePrograms(allProgs.map((p: any) => ({
            key: p.key, name: p.name, description: p.description || "",
            category_key: p.program_categories?.key || "", level: p.level || "",
          })));
        }
      } catch {}

      // Load appointments
      try {
        const { data: apptData } = await supabase
          .from("appointments")
          .select("type, date, time, status")
          .eq("client_id", currentUser.id)
          .order("date", { ascending: false });
        if (apptData && apptData.length > 0) {
          setAppointments(apptData);
        }
      } catch {}

      // Check if client has any data (for connected devices)
      try {
        const { data: clientCheck } = await supabase
          .from("clients")
          .select("id")
          .eq("id", currentUser.id)
          .single();
        setHasClientData(!!clientCheck);
      } catch {}

      // Load conversations count
      try {
        const { count } = await supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("client_id", currentUser.id);
        setConversationsCount(count || 0);
      } catch {}

      // Load education courses & snippets
      try {
        const { data: courseData } = await supabase
          .from("education_courses")
          .select("*")
          .order("created_at", { ascending: true });
        if (courseData && courseData.length > 0) {
          setEduCourses(courseData.map((row: Record<string, string>) => ({
            id: row.id,
            name: row.name,
            description: row.description || "",
            cover_image_url: row.cover_image_url || "",
            difficulty: row.difficulty || "Beginner",
            estimated_duration: row.estimated_duration || "",
            modules: JSON.parse(row.modules || "[]"),
          })));
        }
        const { data: snippetData } = await supabase
          .from("education_snippets")
          .select("*")
          .order("created_at", { ascending: true });
        if (snippetData && snippetData.length > 0) {
          setEduSnippets(snippetData.map((row: Record<string, string>) => ({
            week_range: row.week_range,
            days: JSON.parse(row.days || "[]"),
          })));
        }
      } catch {}

      // Load custom programs
      try {
        const { data: cpData } = await supabase
          .from("clients")
          .select("custom_programs")
          .eq("id", currentUser.id)
          .single();
        if (cpData?.custom_programs && Array.isArray(cpData.custom_programs)) {
          setCustomPrograms(cpData.custom_programs);
        }
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

  /* ---------- program builder helpers ---------- */
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const categoryColors: Record<string, string> = {
    chest: "#EF4444", back: "#3B82F6", shoulders: "#F59E0B", arms: "#8B5CF6",
    legs: "#0D9488", core: "#06B6D4", cardio: "#EC4899", flexibility: "#14B8A6", "full-body": "#6366F1",
  };
  const goalOptions = ["strength", "endurance", "weight loss", "flexibility", "general fitness"];

  const getSelectedDayIndices = (count: number): number[] => {
    if (count === 3) return [0, 2, 4];
    if (count === 4) return [0, 1, 3, 4];
    if (count === 5) return [0, 1, 2, 3, 4];
    if (count === 6) return [0, 1, 2, 3, 4, 5];
    return [0, 2, 4];
  };

  const loadExerciseLibrary = async () => {
    if (exerciseLibrary.length > 0) return;
    const { data } = await supabase.from("exercises").select("id, name, description, category, equipment, difficulty, illustration_url, instructions, muscles_targeted").order("category").order("name");
    if (data) setExerciseLibrary(data);
  };

  const resetBuilder = () => {
    setBuilderStep(1);
    setBuilderName("");
    setBuilderGoal("general fitness");
    setBuilderDuration(8);
    setBuilderDaysPerWeek(3);
    setBuilderDays({});
    setBuilderActiveDay(0);
    setEditingProgramId(null);
    setShowExercisePicker(false);
    setExerciseSearch("");
    setExerciseCategoryFilter("");
  };

  const openBuilder = (program?: CustomProgram) => {
    resetBuilder();
    if (program) {
      setEditingProgramId(program.id);
      setBuilderName(program.name);
      setBuilderGoal(program.goal);
      setBuilderDuration(program.duration);
      setBuilderDaysPerWeek(program.days_per_week);
      setBuilderDays(program.days);
    }
    setShowProgramBuilder(true);
    loadExerciseLibrary();
  };

  const addExerciseToDay = (dayIndex: number, exercise: ExerciseRow) => {
    setBuilderDays(prev => {
      const day = prev[dayIndex] || { exercises: [] };
      return { ...prev, [dayIndex]: { exercises: [...day.exercises, { exercise_id: exercise.id, exercise_name: exercise.name, sets: 3, reps: "10", rest: "60s" }] } };
    });
    setShowExercisePicker(false);
    setExerciseSearch("");
    setExerciseCategoryFilter("");
  };

  const updateExerciseInDay = (dayIndex: number, exIdx: number, field: string, value: string | number) => {
    setBuilderDays(prev => {
      const day = { ...prev[dayIndex] };
      const exercises = [...day.exercises];
      exercises[exIdx] = { ...exercises[exIdx], [field]: value };
      return { ...prev, [dayIndex]: { exercises } };
    });
  };

  const removeExerciseFromDay = (dayIndex: number, exIdx: number) => {
    setBuilderDays(prev => {
      const day = { ...prev[dayIndex] };
      const exercises = day.exercises.filter((_, i) => i !== exIdx);
      return { ...prev, [dayIndex]: { exercises } };
    });
  };

  const moveExercise = (dayIndex: number, exIdx: number, direction: -1 | 1) => {
    setBuilderDays(prev => {
      const day = { ...prev[dayIndex] };
      const exercises = [...day.exercises];
      const newIdx = exIdx + direction;
      if (newIdx < 0 || newIdx >= exercises.length) return prev;
      [exercises[exIdx], exercises[newIdx]] = [exercises[newIdx], exercises[exIdx]];
      return { ...prev, [dayIndex]: { exercises } };
    });
  };

  const saveCustomProgram = async () => {
    if (!user || !builderName.trim()) return;
    setProgramSaving(true);
    const program: CustomProgram = {
      id: editingProgramId || crypto.randomUUID(),
      name: builderName.trim(),
      goal: builderGoal,
      duration: builderDuration,
      days_per_week: builderDaysPerWeek,
      days: builderDays,
      created_at: editingProgramId ? (customPrograms.find(p => p.id === editingProgramId)?.created_at || new Date().toISOString()) : new Date().toISOString(),
    };
    const updated = editingProgramId ? customPrograms.map(p => p.id === editingProgramId ? program : p) : [...customPrograms, program];
    const { error } = await supabase.from("clients").update({ custom_programs: updated }).eq("id", user.id);
    if (!error) {
      setCustomPrograms(updated);
      setShowProgramBuilder(false);
      resetBuilder();
      setProgramSaveMsg("Program saved successfully");
      setTimeout(() => setProgramSaveMsg(""), 5000);
    }
    setProgramSaving(false);
  };

  const deleteCustomProgram = async (id: string) => {
    if (!user) return;
    const updated = customPrograms.filter(p => p.id !== id);
    await supabase.from("clients").update({ custom_programs: updated }).eq("id", user.id);
    setCustomPrograms(updated);
  };

  const switchProgram = async (categoryKey: string, newProgramKey: string) => {
    if (!user) return;
    await supabase.from("client_programs").upsert({
      client_id: user.id,
      category_key: categoryKey,
      program_key: newProgramKey,
      started_at: new Date().toISOString(),
    }, { onConflict: "client_id,category_key" });
    setPrograms(prev => {
      const existing = prev.filter(p => p.category_key !== categoryKey);
      return [...existing, { category_key: categoryKey, program_key: newProgramKey, started_at: new Date().toISOString() }];
    });
    setChangingProgram(null);
    setProgramSaveMsg("Program updated!");
    setTimeout(() => setProgramSaveMsg(""), 3000);
  };

  const activateCustomProgram = async (cp: CustomProgram) => {
    if (!user) return;
    // Save as the active exercise program with a custom key
    await supabase.from("client_programs").upsert({
      client_id: user.id,
      category_key: "exercise",
      program_key: `custom-${cp.id}`,
      started_at: new Date().toISOString(),
    }, { onConflict: "client_id,category_key" });
    setPrograms(prev => {
      const existing = prev.filter(p => p.category_key !== "exercise");
      return [...existing, { category_key: "exercise", program_key: `custom-${cp.id}`, started_at: new Date().toISOString() }];
    });
    setProgramSaveMsg(`"${cp.name}" is now your active exercise program!`);
    setTimeout(() => setProgramSaveMsg(""), 3000);
  };

  const filteredExercises = exerciseLibrary.filter(ex => {
    if (exerciseCategoryFilter && ex.category !== exerciseCategoryFilter) return false;
    if (exerciseSearch && !ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())) return false;
    return true;
  });

  /* ---------- actions ---------- */
  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileError("");
    if (!profileFirstName.trim()) {
      setProfileError("First name is required.");
      return;
    }
    setProfileSaving(true);
    const fullName = `${profileFirstName.trim()} ${profileLastName.trim()}`.trim();
    await supabase.from("clients").update({
      full_name: fullName,
      phone: phone.trim() || null,
      address: address.trim() || null,
      emergency_contact_name: emergencyName.trim() || null,
      emergency_contact_phone: emergencyPhone.trim() || null,
      date_of_birth: dob || null,
      sex: sex || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    await supabase.auth.updateUser({
      data: { full_name: fullName, phone: phone.trim() },
    });
    setProfileSaving(false);
    setEditingProfile(false);
    setProfileSaveMsg("Profile saved successfully");
    setTimeout(() => setProfileSaveMsg(""), 5000);
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
        <div className="animate-spin w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full" />
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
            <div className="w-12 h-12 rounded-full bg-[#0D9488] text-white text-lg font-bold flex items-center justify-center shrink-0">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 hover:border-red-300 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 -mt-2">
        {/* Mobile: dropdown pinned at top of content area */}
        <div className="lg:hidden sticky top-16 z-20 -mx-4 px-4 py-3 bg-[#ecf0f3]/95 backdrop-blur-sm">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-[#0D9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={navItems.find(n => n.id === activeSection)?.icon || navItems[0].icon} />
              </svg>
            </div>
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value as Section)}
              className="w-full bg-white rounded-2xl shadow-md pl-12 pr-12 py-4 text-sm font-semibold border-2 border-[#0D9488]/30 text-[#1F2937] appearance-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 outline-none transition-all"
            >
              {navItems.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-[#0D9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ---- Left navigation (desktop only) ---- */}
          <aside className="hidden lg:block lg:w-56 shrink-0">
            {/* Desktop: vertical nav */}
            <nav className="hidden lg:flex bg-white rounded-2xl shadow-sm p-2 lg:sticky lg:top-24 flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    activeSection === item.id
                      ? "bg-[#0D9488]/10 text-[#0D9488]"
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
                    <div className="w-14 h-14 rounded-full bg-[#0D9488] text-white text-xl font-bold flex items-center justify-center shrink-0">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link href="/assessment"
                      className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow group">
                      <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 flex items-center justify-center mb-3 group-hover:bg-[#0D9488]/20 transition-colors">
                        <svg className="w-5 h-5 text-[#0D9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <div className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
                        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-[#1F2937] mb-2">Patient Portal</p>
                      <MedaliaButton label="Open Portal" size="sm" />
                    </div>
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
                          className="mt-2 text-sm font-medium text-[#0D9488] hover:underline">
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
                        <Link href="/assessment" className="text-xs text-[#0D9488] hover:underline">Book your first</Link>
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
                    <button onClick={() => setEditingProfile(true)} className="text-sm font-medium text-[#0D9488] hover:underline">
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
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                        <input value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900" />
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900"
                        placeholder="Phone number" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input value={address} onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900"
                        placeholder="Your address" />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact</label>
                        <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900"
                          placeholder="Contact name" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency phone</label>
                        <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} type="tel"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900"
                          placeholder="Contact phone" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
                      <input value={dob} onChange={(e) => setDob(e.target.value)} type="date"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                      <div className="flex gap-2">
                        {[
                          { key: "male", label: "Male" },
                          { key: "female", label: "Female" },
                          { key: "other", label: "Other" },
                          { key: "prefer_not_to_say", label: "Prefer not to say" },
                        ].map((opt) => (
                          <button key={opt.key} type="button" onClick={() => setSex(opt.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              sex === opt.key
                                ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                                : "border-gray-300 text-gray-600 hover:border-gray-400"
                            }`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {profileError && (
                      <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                        {profileError}
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button onClick={handleSaveProfile} disabled={profileSaving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D9488] text-white text-sm font-semibold rounded-lg hover:bg-[#0B7B73] transition-colors disabled:opacity-50">
                        {profileSaving && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                        {profileSaving ? "Saving..." : "Save changes"}
                      </button>
                      <button onClick={() => { setEditingProfile(false); setProfileError(""); }}
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
                      <span className="text-[#6B7280] text-xs uppercase tracking-wider">Sex</span>
                      <p className={`font-medium mt-0.5 ${sex ? "text-[#1F2937]" : "text-[#9CA3AF]"}`}>
                        {sex ? ({ male: "Male", female: "Female", other: "Other", prefer_not_to_say: "Prefer not to say" }[sex] || "Not set") : "Not set"}
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
                    <Link href="/coaching#download"
                      className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-[#0D9488] text-white text-sm font-semibold rounded-xl hover:bg-[#0B7B73] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Download the App
                    </Link>
                  </div>
                ) : (
                  <div className="bg-[#ecf0f3] rounded-xl p-8 text-center">
                    <svg className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm font-medium text-[#1F2937] mb-1">No messages yet</p>
                    <p className="text-xs text-[#6B7280] mb-3">
                      Direct messaging with your coach is available on the Full Access plan.
                    </p>
                    <button onClick={() => setActiveSection("billing")}
                      className="text-sm font-medium text-[#0D9488] hover:underline">
                      View billing & plans
                    </button>
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
                            className="text-sm font-medium text-[#0D9488] hover:underline">
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
                        className="inline-flex items-center justify-center px-5 py-2.5 bg-[#0D9488] text-white text-sm font-semibold rounded-xl hover:bg-[#0B7B73] transition-colors">
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
                          setCancelLoading(true);
                          if (subscription) {
                            await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subscription.id);
                          }
                          setCurrentTier(null);
                          setSubscription(null);
                          setShowCancelConfirm(false);
                          setCancelLoading(false);
                        }} disabled={cancelLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                          {cancelLoading && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                          {cancelLoading ? "Cancelling..." : "Yes, cancel"}
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
                              isCurrent ? "border-[#0D9488] bg-[#0D9488]/5" :
                              isSelected ? "border-blue-400 bg-blue-50" :
                              "border-gray-200 hover:border-[#0D9488]/50"
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
                                  <svg className="w-3.5 h-3.5 text-[#0D9488] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {f}
                                </li>
                              ))}
                            </ul>
                            {isCurrent && (
                              <p className="text-xs font-medium text-[#0D9488] mt-3">Current plan</p>
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
                              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-3">
                                Payment integration coming soon — contact us at{" "}
                                <a href="mailto:hello@lifelinehealth.is" className="font-semibold underline">hello@lifelinehealth.is</a>
                              </div>
                            )}
                            {!isPaid && (
                              <p className="text-xs text-[#6B7280] mb-3">
                                Your plan will be changed immediately.
                              </p>
                            )}
                            {upgradeMsg && (
                              <p className={`text-sm mb-3 ${upgradeMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{upgradeMsg}</p>
                            )}
                            <div className="flex gap-3">
                              <button onClick={handleConfirmPlanChange} disabled={upgradeProcessing || isPaid}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D9488] text-white text-sm font-semibold rounded-lg hover:bg-[#0B7B73] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                {upgradeProcessing && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
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
                        className="text-sm font-medium text-[#0D9488] hover:underline">
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
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0D9488] text-white text-sm font-semibold rounded-lg hover:bg-[#0B7B73] transition-colors shrink-0">
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

                <div className="bg-gradient-to-r from-[#0D9488]/10 to-[#0D9488]/5 rounded-xl p-6 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#1F2937] mb-1">Book your assessment</h3>
                      <p className="text-sm text-[#6B7280]">
                        Visit a Lifeline Health station for body composition measurements and targeted blood work.
                      </p>
                    </div>
                    <Link href="/assessment"
                      className="inline-flex items-center justify-center px-6 py-3 bg-[#0D9488] text-white text-sm font-semibold rounded-xl hover:bg-[#0B7B73] transition-colors shrink-0">
                      Book Assessment
                    </Link>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-[#1F2937] mb-3">Assessment History</h3>
                  {appointments.length > 0 ? (
                    <div className="space-y-3">
                      {appointments.map((appt, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#ecf0f3] rounded-xl px-5 py-4">
                          <div>
                            <p className="text-sm font-medium text-[#1F2937]">{appt.type}</p>
                            <p className="text-xs text-[#6B7280]">
                              {new Date(appt.date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                              {appt.time ? ` at ${appt.time}` : ""}
                            </p>
                          </div>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            appt.status === "completed" ? "bg-green-100 text-green-700" :
                            appt.status === "confirmed" ? "bg-blue-100 text-blue-700" :
                            appt.status === "cancelled" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#ecf0f3] rounded-xl p-8 text-center">
                      <svg className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-sm text-[#6B7280] mb-3">
                        Complete your first assessment to see results here
                      </p>
                      <Link href="/assessment"
                        className="inline-flex items-center justify-center px-5 py-2.5 bg-[#0D9488] text-white text-sm font-semibold rounded-xl hover:bg-[#0B7B73] transition-colors">
                        Book Assessment
                      </Link>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ============ APP & DEVICES ============ */}
            {/* ============ EDUCATION ============ */}
            {activeSection === "education" && (
              <section className="space-y-6">
                {/* Daily Snippet */}
                {eduSnippets.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-[#1F2937]">Daily Snippets</h2>
                        <p className="text-xs text-[#6B7280]">Quick health & fitness insights, 7 days a week</p>
                      </div>
                    </div>

                    {/* Week selector */}
                    <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
                      {eduSnippets.map((sw, wi) => (
                        <button key={wi} onClick={() => setEduSnippetWeek(wi)}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors ${
                            eduSnippetWeek === wi ? "bg-[#0D9488] text-white" : "bg-[#ecf0f3] text-[#6B7280] hover:bg-gray-200"
                          }`}>
                          {sw.week_range}
                        </button>
                      ))}
                    </div>

                    {/* Snippet cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {eduSnippets[eduSnippetWeek]?.days.map((day, di) => (
                        <div key={di} className="border border-gray-100 rounded-xl p-4 hover:border-[#0D9488]/30 transition-colors">
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][di]}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[#1F2937] mb-2">{day.title || "—"}</p>
                          <ul className="space-y-1.5">
                            {day.bullets.filter(Boolean).map((b, bi) => (
                              <li key={bi} className="flex items-start gap-2 text-xs text-[#6B7280] leading-relaxed">
                                <span className="w-1.5 h-1.5 bg-[#0D9488] rounded-full mt-1.5 flex-shrink-0" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Courses */}
                <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[#1F2937]">Courses</h2>
                      <p className="text-xs text-[#6B7280]">{eduCourses.length} course{eduCourses.length !== 1 ? "s" : ""} available</p>
                    </div>
                  </div>

                  {eduCourses.length === 0 ? (
                    <div className="bg-[#ecf0f3] rounded-xl p-10 text-center">
                      <svg className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <p className="text-sm text-[#6B7280]">No courses available yet. Check back soon!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {eduCourses.map((course) => {
                        const isOpen = eduOpenCourse === course.id;
                        const totalTime = course.modules.reduce((s, m) => s + (m.readingTime || 0), 0);
                        const diffColors: Record<string, string> = {
                          Beginner: "bg-green-100 text-green-700",
                          Intermediate: "bg-amber-100 text-amber-700",
                          Advanced: "bg-red-100 text-red-700",
                        };
                        return (
                          <div key={course.id} className="border border-gray-100 rounded-xl overflow-hidden">
                            {/* Course card header */}
                            <button onClick={() => { setEduOpenCourse(isOpen ? null : course.id); setEduOpenModule(null); }}
                              className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors">
                              {course.cover_image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={course.cover_image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-6 h-6 text-[#0D9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                  </svg>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="text-sm font-semibold text-[#1F2937]">{course.name}</h3>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${diffColors[course.difficulty] || "bg-gray-100 text-gray-600"}`}>
                                    {course.difficulty}
                                  </span>
                                </div>
                                <p className="text-xs text-[#6B7280] line-clamp-1">{course.description}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[10px] text-[#9CA3AF]">{course.modules.length} module{course.modules.length !== 1 ? "s" : ""}</span>
                                  <span className="text-[10px] text-[#9CA3AF]">{totalTime} min read</span>
                                  {course.estimated_duration && <span className="text-[10px] text-[#9CA3AF]">{course.estimated_duration}</span>}
                                </div>
                              </div>
                              <svg className={`w-5 h-5 text-[#9CA3AF] transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Expanded course content */}
                            {isOpen && (
                              <div className="border-t border-gray-100">
                                {course.modules.length === 0 ? (
                                  <p className="p-5 text-sm text-[#9CA3AF] text-center">No modules yet.</p>
                                ) : (
                                  <div className="divide-y divide-gray-100">
                                    {course.modules.map((mod, mi) => {
                                      const modOpen = eduOpenModule === mod.id;
                                      return (
                                        <div key={mod.id}>
                                          <button onClick={() => setEduOpenModule(modOpen ? null : mod.id)}
                                            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50/50 transition-colors">
                                            <span className="w-7 h-7 rounded-lg bg-[#ecf0f3] flex items-center justify-center text-xs font-semibold text-[#6B7280] flex-shrink-0">
                                              {mi + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-[#1F2937]">{mod.title}</p>
                                              <p className="text-[10px] text-[#9CA3AF]">{mod.readingTime} min read{mod.quizQuestions?.length > 0 ? ` · ${mod.quizQuestions.length} quiz question${mod.quizQuestions.length !== 1 ? "s" : ""}` : ""}</p>
                                            </div>
                                            <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform flex-shrink-0 ${modOpen ? "rotate-180" : ""}`}
                                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </button>

                                          {modOpen && (
                                            <div className="px-5 pb-5 pt-1 ml-10">
                                              {/* Module content */}
                                              <div className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap mb-4">
                                                {mod.content || "Content coming soon."}
                                              </div>

                                              {/* Quiz */}
                                              {mod.quizQuestions && mod.quizQuestions.length > 0 && (
                                                <div className="mt-4 border border-purple-100 rounded-xl p-4 bg-purple-50/30">
                                                  <p className="text-xs font-semibold text-purple-700 mb-3">Knowledge Check</p>
                                                  <div className="space-y-4">
                                                    {mod.quizQuestions.map((q, qi) => {
                                                      const qKey = `${mod.id}-${q.id}`;
                                                      const answered = eduQuizSubmitted[qKey];
                                                      const selected = eduQuizAnswers[qKey];
                                                      return (
                                                        <div key={q.id} className="space-y-2">
                                                          <p className="text-sm font-medium text-[#1F2937]">{qi + 1}. {q.question}</p>
                                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                            {q.options.map((opt, oi) => {
                                                              let optClass = "bg-white border-gray-200 text-[#374151] hover:border-purple-300";
                                                              if (answered) {
                                                                if (oi === q.correctIndex) optClass = "bg-green-50 border-green-300 text-green-800";
                                                                else if (oi === selected && oi !== q.correctIndex) optClass = "bg-red-50 border-red-300 text-red-700";
                                                                else optClass = "bg-white border-gray-100 text-[#9CA3AF]";
                                                              } else if (selected === oi) {
                                                                optClass = "bg-purple-50 border-purple-400 text-purple-800";
                                                              }
                                                              return (
                                                                <button key={oi}
                                                                  disabled={answered}
                                                                  onClick={() => setEduQuizAnswers(prev => ({ ...prev, [qKey]: oi }))}
                                                                  className={`px-3 py-2 text-xs text-left rounded-lg border transition-colors ${optClass}`}>
                                                                  {opt}
                                                                </button>
                                                              );
                                                            })}
                                                          </div>
                                                          {selected !== undefined && !answered && (
                                                            <button onClick={() => setEduQuizSubmitted(prev => ({ ...prev, [qKey]: true }))}
                                                              className="mt-1 px-4 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                                              Check Answer
                                                            </button>
                                                          )}
                                                          {answered && (
                                                            <p className={`text-xs font-medium ${selected === q.correctIndex ? "text-green-600" : "text-red-600"}`}>
                                                              {selected === q.correctIndex ? "Correct!" : `Incorrect — the answer is "${q.options[q.correctIndex]}"`}
                                                            </p>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Empty state if no content at all */}
                {eduCourses.length === 0 && eduSnippets.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
                    <svg className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <h3 className="text-base font-semibold text-[#1F2937] mb-1">Education content coming soon</h3>
                    <p className="text-sm text-[#6B7280]">Your coach is preparing courses and daily snippets for you.</p>
                  </div>
                )}
              </section>
            )}

            {/* ============ MY PROGRAMS ============ */}
            {activeSection === "programs" && (
              <section className="space-y-6">
                {programSaveMsg && (
                  <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-5 py-3">{programSaveMsg}</div>
                )}

                {/* Assigned programs */}
                <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Assigned Programs</h2>
                  {programs.length > 0 ? (
                    <div className="space-y-3">
                      {programs.map((prog) => {
                        const isCustom = prog.program_key.startsWith("custom-");
                        const customProg = isCustom ? customPrograms.find(cp => `custom-${cp.id}` === prog.program_key) : null;
                        const displayName = customProg ? customProg.name : prog.program_key.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                        const isChanging = changingProgram === prog.category_key;
                        const categoryProgs = availablePrograms.filter(ap => ap.category_key === prog.category_key);
                        return (
                          <div key={`${prog.category_key}-${prog.program_key}`} className="bg-[#ecf0f3] rounded-xl px-5 py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-[#1F2937]">{displayName}</p>
                                <p className="text-xs text-[#6B7280]">
                                  {prog.category_key.charAt(0).toUpperCase() + prog.category_key.slice(1)}
                                  {isCustom && <span className="ml-1 text-[#0D9488] font-medium">· Custom</span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {prog.started_at && (
                                  <span className="text-xs text-[#9CA3AF] hidden sm:inline">
                                    {new Date(prog.started_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                                <button
                                  onClick={() => setChangingProgram(isChanging ? null : prog.category_key)}
                                  className="text-xs font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                                >
                                  {isChanging ? "Cancel" : "Change"}
                                </button>
                              </div>
                            </div>
                            {isChanging && categoryProgs.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                                <p className="text-xs font-medium text-[#6B7280] mb-2">Select a different program:</p>
                                {categoryProgs.filter(ap => ap.key !== prog.program_key).map(ap => (
                                  <button
                                    key={ap.key}
                                    onClick={() => switchProgram(prog.category_key, ap.key)}
                                    className="w-full text-left bg-white rounded-lg px-4 py-3 hover:bg-[#0D9488]/5 border border-gray-200 hover:border-[#0D9488] transition-all"
                                  >
                                    <p className="text-sm font-medium text-[#1F2937]">{ap.name}</p>
                                    {ap.description && <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{ap.description}</p>}
                                    {ap.level && <span className="text-[10px] font-medium text-[#9CA3AF] uppercase">{ap.level}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-[#ecf0f3] rounded-xl p-6 text-center">
                      <p className="text-sm text-[#6B7280]">No programs assigned yet. Create a custom program below!</p>
                    </div>
                  )}
                </div>

                {/* Custom programs */}
                {!showProgramBuilder && (
                  <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-[#1F2937]">My Custom Programs</h2>
                      <button onClick={() => openBuilder()} className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D9488] text-white text-sm font-medium rounded-lg hover:bg-[#0B7B73] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Create Program
                      </button>
                    </div>
                    {customPrograms.length > 0 ? (
                      <div className="space-y-3">
                        {customPrograms.map((cp) => (
                          <div key={cp.id} className="bg-[#ecf0f3] rounded-xl px-5 py-4 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[#1F2937]">{cp.name}</p>
                              <p className="text-xs text-[#6B7280]">{cp.goal.charAt(0).toUpperCase() + cp.goal.slice(1)} &middot; {cp.duration} weeks &middot; {cp.days_per_week} days/week</p>
                              <p className="text-xs text-[#9CA3AF] mt-0.5">Created {new Date(cp.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {programs.some(p => p.program_key === `custom-${cp.id}`) ? (
                                <span className="text-xs font-medium text-[#0D9488] bg-[#0D9488]/10 px-3 py-1 rounded-full">Active</span>
                              ) : (
                                <button onClick={() => activateCustomProgram(cp)} className="text-xs font-medium text-[#3B82F6] hover:text-white hover:bg-[#3B82F6] border border-[#3B82F6] px-3 py-1 rounded-full transition-colors" title="Make active">
                                  Activate
                                </button>
                              )}
                              <button onClick={() => openBuilder(cp)} className="p-2 text-[#6B7280] hover:text-[#0D9488] transition-colors" title="Edit">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => { if (confirm("Delete this program?")) deleteCustomProgram(cp.id); }} className="p-2 text-[#6B7280] hover:text-red-500 transition-colors" title="Delete">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-[#ecf0f3] rounded-xl p-8 text-center">
                        <svg className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="text-sm text-[#6B7280]">Build your own custom workout program</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Program Builder */}
                {showProgramBuilder && (
                  <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-[#1F2937]">{editingProgramId ? "Edit Program" : "Create Program"}</h2>
                      <button onClick={() => { setShowProgramBuilder(false); resetBuilder(); }} className="text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors">Cancel</button>
                    </div>

                    {/* Step indicators */}
                    <div className="flex items-center gap-2 mb-8">
                      {[1, 2, 3].map(s => (
                        <div key={s} className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${builderStep === s ? "bg-[#0D9488] text-white" : builderStep > s ? "bg-[#0D9488]/20 text-[#0D9488]" : "bg-[#ecf0f3] text-[#9CA3AF]"}`}>{s}</div>
                          <span className={`text-sm hidden sm:inline ${builderStep === s ? "text-[#1F2937] font-medium" : "text-[#9CA3AF]"}`}>{s === 1 ? "Basics" : s === 2 ? "Workouts" : "Review"}</span>
                          {s < 3 && <div className={`w-8 h-0.5 ${builderStep > s ? "bg-[#0D9488]" : "bg-[#ecf0f3]"}`} />}
                        </div>
                      ))}
                    </div>

                    {/* Step 1: Basics */}
                    {builderStep === 1 && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">Program Name</label>
                          <input type="text" value={builderName} onChange={e => setBuilderName(e.target.value)} placeholder="e.g., Morning Strength Routine"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">Goal</label>
                          <select value={builderGoal} onChange={e => setBuilderGoal(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none bg-white">
                            {goalOptions.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">Duration</label>
                          <div className="flex gap-2">
                            {[4, 8, 12].map(w => (
                              <button key={w} onClick={() => setBuilderDuration(w)}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${builderDuration === w ? "bg-[#0D9488] text-white" : "bg-[#ecf0f3] text-[#6B7280] hover:bg-gray-200"}`}>
                                {w} weeks
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">Days per Week</label>
                          <div className="flex gap-2">
                            {[3, 4, 5, 6].map(d => (
                              <button key={d} onClick={() => setBuilderDaysPerWeek(d)}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${builderDaysPerWeek === d ? "bg-[#0D9488] text-white" : "bg-[#ecf0f3] text-[#6B7280] hover:bg-gray-200"}`}>
                                {d} days
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button onClick={() => { if (builderName.trim()) setBuilderStep(2); }} disabled={!builderName.trim()}
                            className="px-6 py-2.5 bg-[#0D9488] text-white text-sm font-medium rounded-lg hover:bg-[#0B7B73] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Build Workouts */}
                    {builderStep === 2 && (
                      <div>
                        {/* Day tabs */}
                        <div className="flex gap-2 mb-5 flex-wrap">
                          {getSelectedDayIndices(builderDaysPerWeek).map((dayIdx) => (
                            <button key={dayIdx} onClick={() => { setBuilderActiveDay(dayIdx); setShowExercisePicker(false); }}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${builderActiveDay === dayIdx ? "bg-[#0D9488] text-white" : "bg-[#ecf0f3] text-[#6B7280] hover:bg-gray-200"}`}>
                              {dayLabels[dayIdx]}
                            </button>
                          ))}
                        </div>

                        {/* Current day exercises */}
                        <div className="space-y-3 mb-4">
                          {(builderDays[builderActiveDay]?.exercises || []).map((ex, exIdx) => (
                            <div key={exIdx} className="bg-[#ecf0f3] rounded-xl px-4 py-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  {(() => {
                                    const match = exerciseLibrary.find(e => e.name === ex.exercise_name);
                                    const img = match?.illustration_url;
                                    return img ? (
                                      <button onClick={() => match && setViewingExercise(match)} className="flex-shrink-0">
                                        <img src={img} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200 hover:border-[#0D9488] transition-colors" />
                                      </button>
                                    ) : (
                                      <span className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl bg-gray-100">🏋️</span>
                                    );
                                  })()}
                                  <p className="text-sm font-medium text-[#1F2937]">{ex.exercise_name}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => moveExercise(builderActiveDay, exIdx, -1)} disabled={exIdx === 0} className="p-1 text-[#9CA3AF] hover:text-[#1F2937] disabled:opacity-30">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                  </button>
                                  <button onClick={() => moveExercise(builderActiveDay, exIdx, 1)} disabled={exIdx === (builderDays[builderActiveDay]?.exercises.length || 0) - 1} className="p-1 text-[#9CA3AF] hover:text-[#1F2937] disabled:opacity-30">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                  </button>
                                  <button onClick={() => removeExerciseFromDay(builderActiveDay, exIdx)} className="p-1 text-[#9CA3AF] hover:text-red-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-xs text-[#9CA3AF] mb-0.5">Sets</label>
                                  <input type="number" min={1} max={20} value={ex.sets} onChange={e => updateExerciseInDay(builderActiveDay, exIdx, "sets", parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs text-[#9CA3AF] mb-0.5">Reps</label>
                                  <input type="text" value={ex.reps} onChange={e => updateExerciseInDay(builderActiveDay, exIdx, "reps", e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none" placeholder="8-12" />
                                </div>
                                <div>
                                  <label className="block text-xs text-[#9CA3AF] mb-0.5">Rest</label>
                                  <input type="text" value={ex.rest} onChange={e => updateExerciseInDay(builderActiveDay, exIdx, "rest", e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none" placeholder="60s" />
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!builderDays[builderActiveDay] || builderDays[builderActiveDay].exercises.length === 0) && (
                            <div className="bg-[#ecf0f3] rounded-xl p-6 text-center">
                              <p className="text-sm text-[#9CA3AF]">No exercises added for {dayLabels[builderActiveDay]}</p>
                            </div>
                          )}
                        </div>

                        {/* Add exercise button / picker */}
                        {!showExercisePicker ? (
                          <button onClick={() => setShowExercisePicker(true)}
                            className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-[#6B7280] hover:border-[#0D9488] hover:text-[#0D9488] transition-colors">
                            + Add Exercise
                          </button>
                        ) : (
                          <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="p-3 bg-gray-50 border-b border-gray-200">
                              <input type="text" value={exerciseSearch} onChange={e => setExerciseSearch(e.target.value)} placeholder="Search exercises..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none" autoFocus />
                              <div className="flex gap-1.5 mt-2 flex-wrap">
                                <button onClick={() => setExerciseCategoryFilter("")}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${!exerciseCategoryFilter ? "bg-[#1F2937] text-white" : "bg-[#ecf0f3] text-[#6B7280]"}`}>All</button>
                                {Object.keys(categoryColors).map(cat => (
                                  <button key={cat} onClick={() => setExerciseCategoryFilter(cat)}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                                    style={{ backgroundColor: exerciseCategoryFilter === cat ? categoryColors[cat] : "#ecf0f3", color: exerciseCategoryFilter === cat ? "white" : categoryColors[cat] }}>
                                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                              {filteredExercises.length > 0 ? filteredExercises.map(ex => (
                                <div key={ex.id} className="px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100">
                                  <div className="flex items-start gap-3">
                                    {ex.illustration_url ? (
                                      <button onClick={() => setViewingExercise(ex)} className="flex-shrink-0">
                                        <img src={ex.illustration_url} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200 hover:border-[#0D9488] transition-colors" />
                                      </button>
                                    ) : (
                                      <span className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-3xl border border-gray-200" style={{ backgroundColor: (categoryColors[ex.category] || "#6B7280") + "10" }}>🏋️</span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-[#1F2937]">{ex.name}</p>
                                      <p className="text-xs text-[#9CA3AF] mt-0.5">{ex.category.charAt(0).toUpperCase() + ex.category.slice(1)} · {ex.equipment || "bodyweight"} · {ex.difficulty || "beginner"}</p>
                                      {ex.muscles_targeted && ex.muscles_targeted.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {ex.muscles_targeted.slice(0, 3).map(m => (
                                            <span key={m} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{m}</span>
                                          ))}
                                        </div>
                                      )}
                                      <button onClick={() => addExerciseToDay(builderActiveDay, ex)}
                                        className="mt-2 px-3 py-1 text-xs font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0B7B73] transition-colors">
                                        + Add to workout
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )) : (
                                <p className="px-4 py-6 text-sm text-[#9CA3AF] text-center">No exercises found</p>
                              )}
                            </div>
                            <div className="p-2 border-t border-gray-200 bg-gray-50">
                              <button onClick={() => { setShowExercisePicker(false); setExerciseSearch(""); setExerciseCategoryFilter(""); }}
                                className="w-full py-1.5 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors">Close</button>
                            </div>
                          </div>
                        )}

                        {/* Navigation */}
                        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
                          <button onClick={() => setBuilderStep(1)} className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors">Back</button>
                          <button onClick={() => setBuilderStep(3)} className="px-6 py-2.5 bg-[#0D9488] text-white text-sm font-medium rounded-lg hover:bg-[#0B7B73] transition-colors">Review</button>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Review & Save */}
                    {builderStep === 3 && (
                      <div>
                        <div className="bg-[#ecf0f3] rounded-xl p-5 mb-5">
                          <h3 className="text-base font-semibold text-[#1F2937] mb-1">{builderName}</h3>
                          <p className="text-sm text-[#6B7280]">{builderGoal.charAt(0).toUpperCase() + builderGoal.slice(1)} &middot; {builderDuration} weeks &middot; {builderDaysPerWeek} days/week</p>
                        </div>

                        <div className="space-y-4 mb-6">
                          {getSelectedDayIndices(builderDaysPerWeek).map(dayIdx => (
                            <div key={dayIdx}>
                              <h4 className="text-sm font-semibold text-[#374151] mb-2">{dayLabels[dayIdx]}</h4>
                              {(builderDays[dayIdx]?.exercises || []).length > 0 ? (
                                <div className="space-y-1.5">
                                  {builderDays[dayIdx].exercises.map((ex, i) => (
                                    <div key={i} className="flex items-center justify-between bg-[#ecf0f3] rounded-lg px-4 py-2">
                                      <span className="text-sm text-[#1F2937]">{ex.exercise_name}</span>
                                      <span className="text-xs text-[#6B7280]">{ex.sets} x {ex.reps} &middot; {ex.rest} rest</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-[#9CA3AF] italic">No exercises</p>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between pt-4 border-t border-gray-100">
                          <button onClick={() => setBuilderStep(2)} className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors">Back</button>
                          <button onClick={saveCustomProgram} disabled={programSaving}
                            className="px-6 py-2.5 bg-[#0D9488] text-white text-sm font-medium rounded-lg hover:bg-[#0B7B73] transition-colors disabled:opacity-50 flex items-center gap-2">
                            {programSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {programSaving ? "Saving..." : "Save Program"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Exercise detail modal */}
                {viewingExercise && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingExercise(null)}>
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                      {viewingExercise.illustration_url && (
                        <img src={viewingExercise.illustration_url} alt="" className="w-full h-64 object-cover rounded-t-2xl" />
                      )}
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-[#1F2937] mb-2">{viewingExercise.name}</h3>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="px-3 py-1 text-xs font-medium rounded-full text-white" style={{ backgroundColor: categoryColors[viewingExercise.category] || "#6B7280" }}>{viewingExercise.category}</span>
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{viewingExercise.equipment}</span>
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">{viewingExercise.difficulty}</span>
                        </div>
                        {viewingExercise.description && <p className="text-sm text-[#4B5563] mb-4 leading-relaxed">{viewingExercise.description}</p>}
                        {viewingExercise.muscles_targeted && viewingExercise.muscles_targeted.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-[#6B7280] mb-2">Muscles targeted</p>
                            <div className="flex flex-wrap gap-1.5">
                              {viewingExercise.muscles_targeted.map(m => <span key={m} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{m}</span>)}
                            </div>
                          </div>
                        )}
                        {viewingExercise.instructions && viewingExercise.instructions.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-[#6B7280] mb-2">How to perform</p>
                            <div className="space-y-2">
                              {viewingExercise.instructions.map((step, i) => (
                                <div key={i} className="flex gap-3">
                                  <span className="w-5 h-5 rounded-full bg-[#0D9488] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                  <p className="text-sm text-[#374151] leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-3 pt-3 border-t border-gray-100">
                          <button onClick={() => { addExerciseToDay(builderActiveDay, viewingExercise); setViewingExercise(null); }}
                            className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0B7B73] transition-colors">+ Add to workout</button>
                          <button onClick={() => setViewingExercise(null)}
                            className="px-4 py-2.5 text-sm font-medium text-[#6B7280] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Close</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeSection === "app" && (
              <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-6">App & Devices</h2>

                <div className="mb-6">
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

                {/* Patient Portal */}
                <div className="mb-6 pb-6 border-b border-gray-100">
                  <p className="text-sm text-[#6B7280] mb-3">Patient Portal</p>
                  <MedaliaButton label="Open Patient Portal" size="sm" />
                </div>

                <div>
                  <p className="text-sm text-[#6B7280] mb-2">Current coaching programs</p>
                  {programs.length > 0 ? (
                    <div className="space-y-2">
                      {programs.map((prog) => (
                        <div key={`${prog.category_key}-${prog.program_key}`} className="flex items-center justify-between bg-[#ecf0f3] rounded-xl px-5 py-3">
                          <div>
                            <p className="text-sm font-medium text-[#1F2937]">{prog.program_key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                            <p className="text-xs text-[#6B7280]">{prog.category_key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                          </div>
                          {prog.started_at && (
                            <span className="text-xs text-[#6B7280]">
                              Started {new Date(prog.started_at).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
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
                      className="text-sm font-medium text-[#0D9488] hover:underline">
                      {showPasswordForm ? "Cancel" : "Change"}
                    </button>
                  </div>
                  {showPasswordForm && (
                    <div className="mt-4 max-w-sm space-y-3">
                      <input type="password" placeholder="New password (min 6 characters)" value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900" />
                      {passwordMsg && (
                        <p className={`text-xs ${passwordMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>{passwordMsg}</p>
                      )}
                      <button onClick={handleChangePassword} disabled={newPassword.length < 6}
                        className="px-5 py-2 bg-[#0D9488] text-white text-sm font-semibold rounded-lg hover:bg-[#0B7B73] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Update Password
                      </button>
                    </div>
                  )}
                </div>

                {/* Notifications */}
                <div className="border-b border-gray-100 pb-5 mb-5">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-[#1F2937]">Notification Preferences</p>
                    <p className="text-xs text-[#6B7280]">Email and push notification settings</p>
                  </div>
                  <div className="space-y-3 max-w-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#1F2937]">Email notifications</span>
                      <button onClick={() => setEmailNotifications(!emailNotifications)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${emailNotifications ? "bg-[#0D9488]" : "bg-gray-300"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${emailNotifications ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#1F2937]">Push notifications</span>
                      <button onClick={() => setPushNotifications(!pushNotifications)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${pushNotifications ? "bg-[#0D9488]" : "bg-gray-300"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pushNotifications ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#1F2937]">Marketing emails</span>
                      <button onClick={() => setMarketingEmails(!marketingEmails)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${marketingEmails ? "bg-[#0D9488]" : "bg-gray-300"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${marketingEmails ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Connected Devices */}
                <div className="border-b border-gray-100 pb-5 mb-5">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-[#1F2937]">Connected Devices</p>
                    <p className="text-xs text-[#6B7280]">Devices linked to your account</p>
                  </div>
                  {hasClientData ? (
                    <div className="flex items-center gap-3 bg-[#ecf0f3] rounded-xl px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-[#0D9488]/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#0D9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1F2937]">Lifeline Health App</p>
                        <p className="text-xs text-[#0D9488]">Connected</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#6B7280]">No devices connected yet.</p>
                  )}
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
        <div className="animate-spin w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full" />
      </div>
    }>
      <AccountPageInner />
    </Suspense>
  );
}
