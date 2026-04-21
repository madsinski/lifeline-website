"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { Suspense } from "react";
import MedaliaButton from "../components/MedaliaButton";
import BillingPanel from "../components/BillingPanel";
import SlotPicker from "./welcome/SlotPicker";
import { SAMEIND_STATIONS, fullAddress } from "@/lib/sameind-locations";
import { googleCalendarUrl, downloadIcs, type CalendarEvent } from "@/lib/calendar-export";
import WellbeingSurveyModal from "./surveys/WellbeingSurveyModal";
import SatisfactionSurveyModal from "./surveys/SatisfactionSurveyModal";
import AvatarPicker from "../components/AvatarPicker";
import { PACKAGES as ASSESSMENT_PACKAGES, formatPackagePrice } from "@/lib/assessment-packages";
import { createStraumurCharge } from "@/lib/straumur";

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
    id: "premium",
    name: "Premium",
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

/* ---------- nav sections ---------- */
type Section = "overview" | "profile" | "messages" | "assessment" | "education" | "programs" | "settings" | "upgrade" | "billing";
const navItems: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-4 0h4" },
  { id: "upgrade", label: "Lifeline app", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { id: "assessment", label: "Book services", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { id: "billing", label: "Billing", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
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
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [bodyCompStatus, setBodyCompStatus] = useState<"none" | "booked" | "completed">("none");
  const [bodyCompPackage, setBodyCompPackage] = useState<"foundational" | "checkin" | "self-checkin" | null>(null);
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<{ id: string; package: string | null; scheduled_at: string | null } | null>(null);
  const [checkinDoctorAddonPaidAt, setCheckinDoctorAddonPaidAt] = useState<string | null>(null);
  const [payingCheckinDoctor, setPayingCheckinDoctor] = useState(false);
  const [bodyCompBookingAt, setBodyCompBookingAt] = useState<string | null>(null);
  const [lastBodyCompAt, setLastBodyCompAt] = useState<string | null>(null);
  const [biodyActivated, setBiodyActivated] = useState(false);
  /* upcoming-events data for the Home timeline */
  const [companyEvent, setCompanyEvent] = useState<{ id: string; event_date: string; start_time: string; end_time: string; location: string | null; room_notes: string | null; slot_minutes: number; slot_capacity: number; company_id: string } | null>(null);
  const [mySlotAt, setMySlotAt] = useState<string | null>(null);
  const [upcomingBloodDays, setUpcomingBloodDays] = useState<Array<{ day: string; notes: string | null }>>([]);
  const [myBloodTestBooking, setMyBloodTestBooking] = useState<{ day: string; note: string | null } | null>(null);
  const [bcPickerOpen, setBcPickerOpen] = useState(false);
  const [btPickerOpen, setBtPickerOpen] = useState(false);
  const [myDoctorSlot, setMyDoctorSlot] = useState<{ id: string; slot_at: string; duration_minutes: number; mode: "video" | "phone" | "in_person"; location: string | null; meeting_link: string | null; doctor_name: string | null; notes: string | null; booking_note: string | null } | null>(null);
  const [upcomingDoctorSlots, setUpcomingDoctorSlots] = useState<Array<{ id: string; slot_at: string; duration_minutes: number; mode: "video" | "phone" | "in_person"; location: string | null; meeting_link: string | null; doctor_name: string | null; notes: string | null }>>([]);
  const [drPickerOpen, setDrPickerOpen] = useState(false);
  const [videoPortalConfirmedAt, setVideoPortalConfirmedAt] = useState<string | null>(null);
  const [videoConfirmBusy, setVideoConfirmBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [biodyEditOpen, setBiodyEditOpen] = useState(false);
  const [lastWellbeingAt, setLastWellbeingAt] = useState<string | null>(null);
  const [satisfactionDone, setSatisfactionDone] = useState<Record<"body_comp" | "doctor" | "overall", boolean>>({ body_comp: false, doctor: false, overall: false });
  const [wellbeingOpen, setWellbeingOpen] = useState(false);
  const [satisfactionOpen, setSatisfactionOpen] = useState<null | "body_comp" | "doctor" | "overall">(null);
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

  /* beta feedback widget toggle */
  const [feedbackHidden, setFeedbackHidden] = useState(false);
  const [hasPreviewCookie, setHasPreviewCookie] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setFeedbackHidden(localStorage.getItem("ll-hide-feedback") === "1");
    } catch {}
    if (typeof document !== "undefined") {
      setHasPreviewCookie(document.cookie.includes("site_preview=lifelinepreview2026"));
    }
  }, []);
  const toggleFeedbackHidden = () => {
    const next = !feedbackHidden;
    setFeedbackHidden(next);
    try {
      localStorage.setItem("ll-hide-feedback", next ? "1" : "0");
    } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ll-feedback-visibility", { detail: { hidden: next } }));
    }
  };


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
          .select("full_name, phone, address, emergency_contact_name, emergency_contact_phone, date_of_birth, sex, company_id, last_body_comp_at, biody_patient_id, video_consultation_portal_confirmed_at, avatar_url, checkin_doctor_addon_paid_at")
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
          const cData = clientData as Record<string, unknown>;
          const companyId = cData.company_id as string | null;
          setLastBodyCompAt((cData.last_body_comp_at as string | null) || null);
          setBiodyActivated(!!cData.biody_patient_id);
          setVideoPortalConfirmedAt((cData.video_consultation_portal_confirmed_at as string | null) || null);
          setAvatarUrl((cData.avatar_url as string | null) || null);
          setCheckinDoctorAddonPaidAt((cData.checkin_doctor_addon_paid_at as string | null) || null);
          if (companyId) {
            setCompanyId(companyId);
            const { data: c } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
            if (c?.name) setCompanyName(c.name);
            const today = new Date().toISOString().slice(0, 10);
            // Upcoming B2B body-comp event + my slot
            const { data: ev } = await supabase
              .from("body_comp_events")
              .select("id, event_date, start_time, end_time, location, room_notes, slot_minutes, slot_capacity, company_id")
              .eq("company_id", companyId)
              .eq("status", "scheduled")
              .gte("event_date", today)
              .order("event_date")
              .limit(1)
              .maybeSingle();
            if (ev) setCompanyEvent(ev);
            const { data: myB } = await supabase
              .from("body_comp_event_bookings")
              .select("slot_at, event_id")
              .eq("client_id", currentUser.id)
              .order("slot_at")
              .limit(1)
              .maybeSingle();
            if (myB) setMySlotAt(myB.slot_at);
            const { data: bd } = await supabase
              .from("blood_test_days")
              .select("day, notes")
              .eq("company_id", companyId)
              .gte("day", today)
              .order("day");
            setUpcomingBloodDays((bd || []) as Array<{ day: string; notes: string | null }>);
            // My blood-test day booking
            const { data: mbt } = await supabase
              .from("blood_test_bookings")
              .select("day, note")
              .eq("client_id", currentUser.id)
              .maybeSingle();
            if (mbt) setMyBloodTestBooking(mbt);
          }
          // Doctor consultation — my active booking + upcoming available slots
          const { data: myDr } = await supabase
            .from("doctor_slots")
            .select("id, slot_at, duration_minutes, mode, location, meeting_link, doctor_name, notes, booking_note")
            .eq("client_id", currentUser.id)
            .is("completed_at", null)
            .maybeSingle();
          if (myDr) setMyDoctorSlot(myDr as typeof myDr);
          const nowIso = new Date().toISOString();
          const { data: drSlots } = await supabase
            .from("doctor_slots")
            .select("id, slot_at, duration_minutes, mode, location, meeting_link, doctor_name, notes")
            .is("client_id", null)
            .eq("mode", "in_person")
            .gt("slot_at", nowIso)
            .order("slot_at")
            .limit(50);
          setUpcomingDoctorSlots((drSlots || []) as typeof upcomingDoctorSlots);
          // Latest wellbeing survey (to decide whether to nudge)
          const { data: wb } = await supabase
            .from("client_wellbeing_surveys")
            .select("created_at")
            .eq("client_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          setLastWellbeingAt(wb?.created_at || null);
          // Satisfaction surveys already filled
          const { data: sats } = await supabase
            .from("client_satisfaction_surveys")
            .select("context")
            .eq("client_id", currentUser.id);
          if (sats && sats.length) {
            const done = { body_comp: false, doctor: false, overall: false } as Record<"body_comp" | "doctor" | "overall", boolean>;
            for (const r of sats as Array<{ context: "body_comp" | "doctor" | "overall" }>) done[r.context] = true;
            setSatisfactionDone(done);
          }
          // Body comp booking status (solo / clinic booking path).
          // Ignore rows that haven't been paid yet — those are abandoned
          // wizard drafts and shouldn't make the dashboard think the user
          // is mid-journey. Legacy rows predate the payment columns and
          // are allowed through via the `amount_isk is null` branch.
          const { data: booking } = await supabase
            .from("body_comp_bookings")
            .select("id, scheduled_at, status, amount_isk, payment_status, package, created_at")
            .eq("client_id", currentUser.id)
            .in("status", ["requested", "confirmed", "completed"])
            .or("amount_isk.is.null,payment_status.eq.paid")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (booking) {
            if (booking.status === "completed") setBodyCompStatus("completed");
            else {
              setBodyCompStatus("booked");
              setBodyCompBookingAt(booking.scheduled_at || null);
            }
            setCurrentBookingId(((booking as Record<string, unknown>).id as string) || null);
            const pkg = (booking as Record<string, unknown>).package as string | null;
            if (pkg === "foundational" || pkg === "checkin" || pkg === "self-checkin") {
              setBodyCompPackage(pkg);
            } else {
              // Fallback — older rows predate the `package` column. Infer
              // from amount_isk so the journey shows the right flow.
              const amt = (booking as Record<string, unknown>).amount_isk as number | null | undefined;
              if (amt === 0) setBodyCompPackage("self-checkin");
              else if (amt === 19900) setBodyCompPackage("checkin");
              else if (amt === 49900) setBodyCompPackage("foundational");
            }
          } else if (cData.last_body_comp_at) {
            setBodyCompStatus("completed");
          }

          // Also pick up any pending (unpaid) booking the user started but
          // didn't finish. Used to show a 'Resume booking' card instead of
          // the 'Ready to take the first step?' hero.
          const { data: pending } = await supabase
            .from("body_comp_bookings")
            .select("id, scheduled_at, package, created_at")
            .eq("client_id", currentUser.id)
            .eq("status", "requested")
            .eq("payment_status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (pending) {
            setPendingBooking({
              id: pending.id as string,
              package: ((pending as Record<string, unknown>).package as string | null) ?? null,
              scheduled_at: ((pending as Record<string, unknown>).scheduled_at as string | null) ?? null,
            });
          }
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

    // If coming from pricing page with upgrade param, go to Billing where
    // plan management now lives.
    if (upgradeParam) {
      setActiveSection("billing");
      setPendingTier(upgradeParam);
      setShowPlanConfirm(true);
      setShowChangePlan(true);
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
    legs: "#10B981", core: "#06B6D4", cardio: "#EC4899", flexibility: "#14B8A6", "full-body": "#6366F1",
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
        <div className="animate-spin w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const activeTier = tiers.find((t) => t.id === currentTier) ?? null;
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "long" })
    : "N/A";

  return (
    <div className="min-h-screen bg-[#ecf0f3]">
      {/* ---- page header ---- */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#10B981] text-white text-lg font-bold flex items-center justify-center shrink-0">
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
        {/* Mobile: dropdown pinned at top of content area */}
        <div className="lg:hidden sticky top-16 z-20 -mx-4 px-4 py-3 bg-[#ecf0f3]/95 backdrop-blur-sm">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={navItems.find(n => n.id === activeSection)?.icon || navItems[0].icon} />
              </svg>
            </div>
            <select
              value={activeSection}
              onChange={(e) => { setActiveSection(e.target.value as Section); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="w-full bg-white rounded-2xl shadow-md pl-12 pr-12 py-4 text-sm font-semibold border-2 border-[#10B981]/30 text-[#1F2937] appearance-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
            >
              {navItems.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  onClick={() => { setActiveSection(item.id); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    activeSection === item.id
                      ? "bg-[#10B981]/10 text-[#10B981]"
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
                {/* Welcome hero */}
                <section className="relative overflow-hidden rounded-2xl shadow-sm bg-white">
                  <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${companyId ? "from-[#3B82F6] to-[#10B981]" : "from-[#10B981] to-[#0D9488]"}`} />
                  <div className="p-6 sm:p-8">
                    <div className="flex items-start gap-4 min-w-0">
                      <AvatarPicker
                        currentUrl={avatarUrl}
                        initial={(profileFirstName || user.email || "U").charAt(0).toUpperCase()}
                        uploading={avatarUploading}
                        error={avatarError}
                        gradient={companyId ? "from-[#3B82F6] to-[#10B981]" : "from-[#10B981] to-[#0D9488]"}
                        onError={(msg) => { setAvatarError(msg); setAvatarUploading(false); }}
                        onPicked={async (blob) => {
                          setAvatarUploading(true);
                          setAvatarError(null);
                          try {
                            const filePath = `${user.id}/avatar.jpg`;
                            const { error: upErr } = await supabase.storage
                              .from("avatars")
                              .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });
                            if (upErr) throw upErr;
                            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
                            const publicUrl = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : "";
                            if (!publicUrl) throw new Error("Could not resolve the uploaded image URL.");
                            const { error: dbErr } = await supabase
                              .from("clients")
                              .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
                              .eq("id", user.id);
                            if (dbErr) throw dbErr;
                            setAvatarUrl(publicUrl);
                          } catch (e) {
                            setAvatarError((e as Error).message || "Upload failed.");
                          } finally {
                            setAvatarUploading(false);
                          }
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <h1 className="text-2xl sm:text-3xl font-bold text-[#1F2937] leading-tight">
                          Welcome back, {profileFirstName || "there"}
                        </h1>
                        {companyName ? (
                          <p className="text-sm text-[#6B7280] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-blue-100 bg-blue-50 text-blue-700">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              <span className="text-xs font-medium">Company account</span>
                            </span>
                            <span className="text-sm font-semibold text-[#1F2937]">{companyName}</span>
                            <span className="text-[#9CA3AF]">·</span>
                            <span>Member since {memberSince}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-[#6B7280] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {activeTier && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span className="text-xs font-medium">{activeTier.name}</span>
                              </span>
                            )}
                            <span>Member since {memberSince}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* B2C: pending (unpaid) booking → show a 'Resume booking' card */}
                {!companyId && bodyCompStatus === "none" && pendingBooking && (
                  <ResumeBookingHero
                    pkg={pendingBooking.package}
                    scheduledAt={pendingBooking.scheduled_at}
                    bookingId={pendingBooking.id}
                    onCancel={async () => {
                      if (!confirm("Cancel your incomplete booking and start over?")) return;
                      await supabase.from("body_comp_bookings").update({ status: "cancelled" }).eq("id", pendingBooking.id);
                      setPendingBooking(null);
                    }}
                  />
                )}

                {/* B2C: no booking at all → Get-started hero */}
                {!companyId && bodyCompStatus === "none" && !pendingBooking && (
                  <GetStartedHero />
                )}

                {/* Self Check-in has its own abbreviated journey — only the
                    patient-portal questionnaire remains. Short-circuit before
                    the full JourneyTimeline. */}
                {!companyId && bodyCompPackage === "self-checkin" && bodyCompStatus !== "none" && (
                  <SelfCheckinJourney
                    completed={bodyCompStatus === "completed"}
                    onChangePackage={async () => {
                      if (!currentBookingId) { router.push("/account/book"); return; }
                      if (!confirm("Cancel your Self Check-in and choose a different package?")) return;
                      await supabase.from("body_comp_bookings").update({ status: "cancelled" }).eq("id", currentBookingId);
                      router.push("/account/book");
                    }}
                  />
                )}

                {/* Check-in has its own 4-step journey: booked → Biody profile
                    → measurement → optional doctor add-on. */}
                {!companyId && bodyCompPackage === "checkin" && bodyCompStatus !== "none" && (
                  <CheckinJourney
                    biodyActivated={biodyActivated}
                    bodyCompBookingAt={bodyCompBookingAt}
                    completed={bodyCompStatus === "completed"}
                    hasDoctorBooking={!!myDoctorSlot || !!videoPortalConfirmedAt}
                    onGoToBiody={() => setBiodyEditOpen(true)}
                    onChangePackage={async () => {
                      if (!currentBookingId) { router.push("/account/book"); return; }
                      if (!confirm("Cancel your Check-in and choose a different package? Refunds for paid packages are handled manually — contact contact@lifelinehealth.is if you've already paid.")) return;
                      await supabase.from("body_comp_bookings").update({ status: "cancelled" }).eq("id", currentBookingId);
                      router.push("/account/book");
                    }}
                    doctorAddonPaid={!!checkinDoctorAddonPaidAt}
                    payingDoctorAddon={payingCheckinDoctor}
                    hasAvailableInPersonSlots={upcomingDoctorSlots.length > 0}
                    onPickInPersonDoctorSlot={() => setDrPickerOpen(true)}
                    onConfirmVideoPortal={async () => {
                      if (!confirm("Have you booked a video meeting with your Lifeline doctor in the patient portal?")) return;
                      setVideoConfirmBusy(true);
                      const { error } = await supabase.rpc("confirm_video_consultation_portal");
                      if (!error) setVideoPortalConfirmedAt(new Date().toISOString());
                      setVideoConfirmBusy(false);
                    }}
                    videoConfirmBusy={videoConfirmBusy}
                    onPayDoctorAddon={async () => {
                      if (!user) return;
                      if (!confirm("Add a doctor consultation to your Check-in round for 18,500 kr? You'll be charged via Straumur.")) return;
                      setPayingCheckinDoctor(true);
                      try {
                        const AMOUNT = 18500;
                        const res = await createStraumurCharge({
                          amountIsk: AMOUNT,
                          reference: `checkin-doctor-${user.id}-${Date.now()}`,
                          description: "Lifeline Health — Check-in doctor consultation",
                          customer: { name: `${profileFirstName} ${profileLastName}`.trim() || user.email || "", email: user.email || "", phone: phone || null },
                          returnUrl: typeof window !== "undefined" ? window.location.href : "",
                        });
                        if (!res.ok) { alert(`Payment failed: ${res.error}`); return; }
                        const paidAt = new Date().toISOString();
                        const { error: updErr } = await supabase
                          .from("clients")
                          .update({ checkin_doctor_addon_paid_at: paidAt })
                          .eq("id", user.id);
                        if (updErr) { alert(`Could not record payment: ${updErr.message}`); return; }
                        await supabase.from("payments").insert({
                          owner_type: "client",
                          owner_id: user.id,
                          amount_isk: AMOUNT,
                          currency: "ISK",
                          description: "Lifeline Health — Check-in doctor consultation",
                          provider: "straumur",
                          provider_reference: res.providerReference,
                          status: "succeeded",
                          related_type: "checkin_doctor_addon",
                          paid_at: paidAt,
                        });
                        setCheckinDoctorAddonPaidAt(paidAt);
                      } finally {
                        setPayingCheckinDoctor(false);
                      }
                    }}
                  />
                )}

                {/* Your journey timeline (hidden for B2C pre-booking, Self Check-in, and Check-in) */}
                {!(!companyId && bodyCompStatus === "none") && bodyCompPackage !== "self-checkin" && bodyCompPackage !== "checkin" && (
                <JourneyTimeline
                  onChangePackage={!companyId && bodyCompStatus !== "none" ? async () => {
                    if (!currentBookingId) { router.push("/account/book"); return; }
                    if (!confirm("Cancel your Foundational Health booking and choose a different package? Refunds for paid packages are handled manually — contact contact@lifelinehealth.is if you've already paid.")) return;
                    await supabase.from("body_comp_bookings").update({ status: "cancelled" }).eq("id", currentBookingId);
                    router.push("/account/book");
                  } : undefined}
                  isB2C={!companyId}
                  hasOnboarded={true}
                  biodyActivated={biodyActivated}
                  hasBodyCompSlot={!!mySlotAt}
                  hasBodyCompBooking={bodyCompStatus === "booked" || bodyCompStatus === "completed"}
                  hasBodyCompCompleted={bodyCompStatus === "completed"}
                  hasBloodTestBooking={!!myBloodTestBooking}
                  companyEvent={companyEvent}
                  hasApprovedBloodDays={upcomingBloodDays.length > 0}
                  hasInPersonDoctorBooking={!!myDoctorSlot}
                  hasAvailableInPersonSlots={upcomingDoctorSlots.length > 0}
                  hasVideoPortalConfirmed={!!videoPortalConfirmedAt}
                  videoConfirmBusy={videoConfirmBusy}
                  onPickBodyCompSlot={() => setBcPickerOpen(true)}
                  onPickBloodTestDay={() => setBtPickerOpen(true)}
                  onPickInPersonDoctorSlot={() => setDrPickerOpen(true)}
                  onConfirmVideoPortal={async () => {
                    if (!confirm("Have you booked a video meeting with your Lifeline doctor in the patient portal? Click OK to confirm your video booking.")) return;
                    setVideoConfirmBusy(true);
                    const { error: err } = await supabase.rpc("confirm_video_consultation_portal");
                    if (!err) setVideoPortalConfirmedAt(new Date().toISOString());
                    setVideoConfirmBusy(false);
                  }}
                  onClearVideoPortal={async () => {
                    if (!confirm("Clear your video consultation confirmation?")) return;
                    setVideoConfirmBusy(true);
                    const { error: err } = await supabase.rpc("clear_video_consultation_portal");
                    if (!err) setVideoPortalConfirmedAt(null);
                    setVideoConfirmBusy(false);
                  }}
                  onGoToBiody={() => setBiodyEditOpen(true)}
                />
                )}

                {/* Current bookings */}
                <CurrentBookings
                  isB2C={!companyId}
                  mySlotAt={mySlotAt}
                  companyEvent={companyEvent}
                  myBloodTestBooking={myBloodTestBooking}
                  myDoctorSlot={myDoctorSlot}
                  videoPortalConfirmedAt={videoPortalConfirmedAt}
                  bodyCompBookingAt={bodyCompBookingAt}
                  bodyCompStatus={bodyCompStatus}
                  bodyCompPackage={bodyCompPackage}
                  onChangeBcSlot={() => setBcPickerOpen(true)}
                  onChangeBloodDay={() => setBtPickerOpen(true)}
                  onChangeDoctorSlot={() => setDrPickerOpen(true)}
                  onClearVideoPortal={async () => {
                    if (!confirm("Clear your video consultation confirmation?")) return;
                    await supabase.rpc("clear_video_consultation_portal");
                    setVideoPortalConfirmedAt(null);
                  }}
                />

                {/* Body-comp slot picker modal */}
                {bcPickerOpen && companyEvent && (
                  <BodyCompSlotPickerModal
                    event={companyEvent}
                    onClose={() => setBcPickerOpen(false)}
                    onBooked={async () => {
                      const { data: myB } = await supabase
                        .from("body_comp_event_bookings")
                        .select("slot_at")
                        .eq("client_id", user.id)
                        .order("slot_at")
                        .limit(1)
                        .maybeSingle();
                      setMySlotAt(myB?.slot_at ?? null);
                    }}
                  />
                )}

                {/* Blood-test day picker modal */}
                {btPickerOpen && companyId && (
                  <BloodTestDayPickerModal
                    companyId={companyId}
                    days={upcomingBloodDays}
                    existing={myBloodTestBooking}
                    onClose={() => setBtPickerOpen(false)}
                    onBooked={(booking) => setMyBloodTestBooking(booking)}
                  />
                )}

                {/* Doctor consultation slot picker modal */}
                {drPickerOpen && (
                  <DoctorSlotPickerModal
                    slots={upcomingDoctorSlots}
                    existing={myDoctorSlot}
                    onClose={() => setDrPickerOpen(false)}
                    onBooked={async () => {
                      const { data: myDr } = await supabase
                        .from("doctor_slots")
                        .select("id, slot_at, duration_minutes, mode, location, meeting_link, doctor_name, notes, booking_note")
                        .eq("client_id", user.id)
                        .is("completed_at", null)
                        .maybeSingle();
                      setMyDoctorSlot(myDr as typeof myDoctorSlot);
                      const nowIso = new Date().toISOString();
                      const { data: drSlots } = await supabase
                        .from("doctor_slots")
                        .select("id, slot_at, duration_minutes, mode, location, meeting_link, doctor_name, notes")
                        .is("client_id", null)
                        .eq("mode", "in_person")
                        .gt("slot_at", nowIso)
                        .order("slot_at")
                        .limit(50);
                      setUpcomingDoctorSlots((drSlots || []) as typeof upcomingDoctorSlots);
                    }}
                    onCancelled={() => setMyDoctorSlot(null)}
                  />
                )}

                {/* Wellbeing check-in — disabled for now, moved to settings for later use */}
                {/* Satisfaction prompts after milestones */}
                <SatisfactionPromptCard
                  bodyCompStatus={bodyCompStatus}
                  myDoctorSlot={myDoctorSlot}
                  satisfactionDone={satisfactionDone}
                  onStart={(ctx) => setSatisfactionOpen(ctx)}
                />

                {wellbeingOpen && (
                  <WellbeingSurveyModal
                    companyId={companyId}
                    onClose={() => setWellbeingOpen(false)}
                    onSubmitted={() => setLastWellbeingAt(new Date().toISOString())}
                  />
                )}
                {satisfactionOpen && (
                  <SatisfactionSurveyModal
                    companyId={companyId}
                    context={satisfactionOpen}
                    onClose={() => setSatisfactionOpen(null)}
                    onSubmitted={() => setSatisfactionDone((d) => ({ ...d, [satisfactionOpen]: true }))}
                  />
                )}
                {biodyEditOpen && (
                  <BiodyProfileModal
                    userId={user.id}
                    onClose={() => setBiodyEditOpen(false)}
                    onActivated={() => setBiodyActivated(true)}
                  />
                )}

                {/* Patient portal hero — canonical home for clinical data */}
                <section className="relative overflow-hidden rounded-2xl shadow-sm bg-white">
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
                  <div className="p-6 sm:p-8">
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-teal-700 mb-1">Lifeline Health portal</div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937] leading-tight">Your report</h2>
                        <p className="text-sm text-[#6B7280] mt-2 leading-relaxed max-w-xl">
                          Everything clinical lives in Medalia, our secure patient portal. Sign in there to:
                        </p>
                        <ul className="text-sm text-[#4B5563] mt-3 space-y-1.5 list-disc list-inside">
                          <li>View your body-composition, blood-test, and assessment results</li>
                          <li>Read physician notes and your personalised health report</li>
                          <li>Book follow-up appointments with your Lifeline physician</li>
                          <li>Secure message your medical team</li>
                        </ul>
                        <div className="mt-5">
                          <MedaliaButton label="Open patient portal" size="md" />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* After your assessment — teaser for the coaching app */}
                <AppTeaserCard onGoToCoaching={() => { setActiveSection("upgrade"); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }} />

              </>
            )}

            {/* ============ PROFILE ============ */}
            {activeSection === "profile" && (
              <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <h2 className="text-lg font-semibold text-[#1F2937]">Personal Information</h2>
                  {!editingProfile && (
                    <button onClick={() => setEditingProfile(true)} className="text-sm font-medium text-[#10B981] hover:underline">
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
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                        <input value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900" />
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
                        placeholder="Phone number" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input value={address} onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
                        placeholder="Your address" />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact</label>
                        <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
                          placeholder="Contact name" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency phone</label>
                        <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} type="tel"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
                          placeholder="Contact phone" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
                      <input value={dob} onChange={(e) => setDob(e.target.value)} type="date"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900" />
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
                                ? "border-[#10B981] bg-[#10B981]/10 text-[#10B981]"
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
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#10B981] text-white text-sm font-semibold rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50">
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
                      className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-[#10B981] text-white text-sm font-semibold rounded-full hover:bg-[#047857] transition-colors">
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
                      Direct messaging with your coach is available on the Premium plan.
                    </p>
                    <button onClick={() => setActiveSection("billing")}
                      className="text-sm font-medium text-[#10B981] hover:underline">
                      View plans & billing
                    </button>
                  </div>
                )}
              </section>
            )}


            {/* ============ ASSESSMENT ============ */}
            {activeSection === "assessment" && (
              <ServicesSection companyName={companyName} onGoToCoaching={() => setActiveSection("upgrade")} />
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
                            eduSnippetWeek === wi ? "bg-[#10B981] text-white" : "bg-[#ecf0f3] text-[#6B7280] hover:bg-gray-200"
                          }`}>
                          {sw.week_range}
                        </button>
                      ))}
                    </div>

                    {/* Snippet cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {eduSnippets[eduSnippetWeek]?.days.map((day, di) => (
                        <div key={di} className="border border-gray-100 rounded-xl p-4 hover:border-[#10B981]/30 transition-colors">
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][di]}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[#1F2937] mb-2">{day.title || "—"}</p>
                          <ul className="space-y-1.5">
                            {day.bullets.filter(Boolean).map((b, bi) => (
                              <li key={bi} className="flex items-start gap-2 text-xs text-[#6B7280] leading-relaxed">
                                <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full mt-1.5 flex-shrink-0" />
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
                                  <svg className="w-6 h-6 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                  {isCustom && <span className="ml-1 text-[#10B981] font-medium">· Custom</span>}
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
                                    className="w-full text-left bg-white rounded-lg px-4 py-3 hover:bg-[#10B981]/5 border border-gray-200 hover:border-[#10B981] transition-all"
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
                      <p className="text-sm text-[#1F2937] font-medium mb-1">Your programs will appear here</p>
                      <p className="text-xs text-[#6B7280]">
                        {bodyCompStatus === "completed"
                          ? "Your Lifeline physician will assign programs after reviewing your report. You can also build your own below."
                          : "Complete your body-composition scan first — your Lifeline physician then assigns programs based on the results. You can also build your own below."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Custom programs */}
                {!showProgramBuilder && (
                  <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-[#1F2937]">My Custom Programs</h2>
                      <button onClick={() => openBuilder()} className="inline-flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#047857] transition-colors">
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
                                <span className="text-xs font-medium text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full">Active</span>
                              ) : (
                                <button onClick={() => activateCustomProgram(cp)} className="text-xs font-medium text-[#3B82F6] hover:text-white hover:bg-[#3B82F6] border border-[#3B82F6] px-3 py-1 rounded-full transition-colors" title="Make active">
                                  Activate
                                </button>
                              )}
                              <button onClick={() => openBuilder(cp)} className="p-2 text-[#6B7280] hover:text-[#10B981] transition-colors" title="Edit">
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${builderStep === s ? "bg-[#10B981] text-white" : builderStep > s ? "bg-[#10B981]/20 text-[#10B981]" : "bg-[#ecf0f3] text-[#9CA3AF]"}`}>{s}</div>
                          <span className={`text-sm hidden sm:inline ${builderStep === s ? "text-[#1F2937] font-medium" : "text-[#9CA3AF]"}`}>{s === 1 ? "Basics" : s === 2 ? "Workouts" : "Review"}</span>
                          {s < 3 && <div className={`w-8 h-0.5 ${builderStep > s ? "bg-[#10B981]" : "bg-[#ecf0f3]"}`} />}
                        </div>
                      ))}
                    </div>

                    {/* Step 1: Basics */}
                    {builderStep === 1 && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">Program Name</label>
                          <input type="text" value={builderName} onChange={e => setBuilderName(e.target.value)} placeholder="e.g., Morning Strength Routine"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">Goal</label>
                          <select value={builderGoal} onChange={e => setBuilderGoal(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none bg-white">
                            {goalOptions.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">Duration</label>
                          <div className="flex gap-2">
                            {[4, 8, 12].map(w => (
                              <button key={w} onClick={() => setBuilderDuration(w)}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${builderDuration === w ? "bg-[#10B981] text-white" : "bg-[#ecf0f3] text-[#6B7280] hover:bg-gray-200"}`}>
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
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${builderDaysPerWeek === d ? "bg-[#10B981] text-white" : "bg-[#ecf0f3] text-[#6B7280] hover:bg-gray-200"}`}>
                                {d} days
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button onClick={() => { if (builderName.trim()) setBuilderStep(2); }} disabled={!builderName.trim()}
                            className="px-6 py-2.5 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${builderActiveDay === dayIdx ? "bg-[#10B981] text-white" : "bg-[#ecf0f3] text-[#6B7280] hover:bg-gray-200"}`}>
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
                                        <img src={img} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200 hover:border-[#10B981] transition-colors" />
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
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs text-[#9CA3AF] mb-0.5">Reps</label>
                                  <input type="text" value={ex.reps} onChange={e => updateExerciseInDay(builderActiveDay, exIdx, "reps", e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none" placeholder="8-12" />
                                </div>
                                <div>
                                  <label className="block text-xs text-[#9CA3AF] mb-0.5">Rest</label>
                                  <input type="text" value={ex.rest} onChange={e => updateExerciseInDay(builderActiveDay, exIdx, "rest", e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none" placeholder="60s" />
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
                            className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-[#6B7280] hover:border-[#10B981] hover:text-[#10B981] transition-colors">
                            + Add Exercise
                          </button>
                        ) : (
                          <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="p-3 bg-gray-50 border-b border-gray-200">
                              <input type="text" value={exerciseSearch} onChange={e => setExerciseSearch(e.target.value)} placeholder="Search exercises..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none" autoFocus />
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
                                        <img src={ex.illustration_url} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200 hover:border-[#10B981] transition-colors" />
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
                                        className="mt-2 px-3 py-1 text-xs font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#047857] transition-colors">
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
                          <button onClick={() => setBuilderStep(3)} className="px-6 py-2.5 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#047857] transition-colors">Review</button>
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
                            className="px-6 py-2.5 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50 flex items-center gap-2">
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
                                  <span className="w-5 h-5 rounded-full bg-[#10B981] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                  <p className="text-sm text-[#374151] leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-3 pt-3 border-t border-gray-100">
                          <button onClick={() => { addExerciseToDay(builderActiveDay, viewingExercise); setViewingExercise(null); }}
                            className="flex-1 py-2.5 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#047857] transition-colors">+ Add to workout</button>
                          <button onClick={() => setViewingExercise(null)}
                            className="px-4 py-2.5 text-sm font-medium text-[#6B7280] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Close</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ============ UPGRADE (coaching app soft-sell) ============ */}
            {activeSection === "upgrade" && (
              <section className="space-y-6">
                {/* Hero */}
                <div className="rounded-2xl p-8 text-white shadow-sm"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #3B82F6, #10B981)" }}>
                  <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-90 mb-3">
                    Lifeline coaching app
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
                    Turn your results into daily habits.
                  </h1>
                  <p className="mt-3 text-base opacity-95 max-w-xl">
                    Daily actions, meal logs, weigh-ins, a personalised programme, and your coach in your pocket.
                    Your company covered the assessment — coaching is optional and paid personally.
                  </p>
                </div>

                {/* Download hero — first since the app isn't live yet */}
                <DownloadAppHero />

                {/* What's inside the app — shared block (features + pillars) */}
                <AppFeaturesBlock />
              </section>
            )}

            {/* ============ BILLING ============ */}
            {activeSection === "billing" && (
              <section className="space-y-6">
                {/* Your plan */}
                <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                    <h2 className="text-lg font-semibold text-[#1F2937]">Lifeline app subscription</h2>
                    {activeTier && (
                      <div className="flex items-center gap-3">
                        <button onClick={() => setShowChangePlan(!showChangePlan)} className="text-sm font-medium text-[#10B981] hover:underline">
                          {showChangePlan ? "Hide plans" : "Change plan"}
                        </button>
                        {currentTier !== "free-trial" && (
                          <button onClick={() => setShowCancelConfirm(true)} className="text-sm text-red-500 hover:underline">
                            Cancel subscription
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {activeTier ? (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${activeTier.badgeColor}`}>
                          {activeTier.name}
                        </span>
                        <span className="text-sm text-[#6B7280]">
                          {activeTier.price === "0" ? "Free" : `${activeTier.price} ISK / ${activeTier.period}`}
                        </span>
                      </div>
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
                        className="inline-flex items-center justify-center px-5 py-2.5 bg-[#10B981] text-white text-sm font-semibold rounded-full hover:bg-[#047857] transition-colors">
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
                              isCurrent ? "border-[#10B981] bg-[#10B981]/5" :
                              isSelected ? "border-blue-400 bg-blue-50" :
                              "border-gray-200 hover:border-[#10B981]/50"
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
                                  <svg className="w-3.5 h-3.5 text-[#10B981] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {f}
                                </li>
                              ))}
                            </ul>
                            {isCurrent && (
                              <p className="text-xs font-medium text-[#10B981] mt-3">Current plan</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Confirm plan change */}
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
                                <a href="mailto:contact@lifelinehealth.is" className="font-semibold underline">contact@lifelinehealth.is</a>
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
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#10B981] text-white text-sm font-semibold rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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

                {/* Payment methods + history — shared BillingPanel */}
                <BillingPanel ownerType="client" ownerId={user.id} />
              </section>
            )}


            {/* ============ SETTINGS ============ */}
            {activeSection === "settings" && (
              <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-6">Account Settings</h2>

                {/* Personal information entry (opens the Profile section) */}
                <div className="border-b border-gray-100 pb-5 mb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1F2937]">Personal information</p>
                      <p className="text-xs text-[#6B7280]">Name, phone, address, emergency contact</p>
                    </div>
                    <button onClick={() => setActiveSection("profile")}
                      className="text-sm font-medium text-[#10B981] hover:underline">
                      Edit
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div className="border-b border-gray-100 pb-5 mb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1F2937]">Password</p>
                      <p className="text-xs text-[#6B7280]">Update your account password</p>
                    </div>
                    <button onClick={() => setShowPasswordForm(!showPasswordForm)}
                      className="text-sm font-medium text-[#10B981] hover:underline">
                      {showPasswordForm ? "Cancel" : "Change"}
                    </button>
                  </div>
                  {showPasswordForm && (
                    <div className="mt-4 max-w-sm space-y-3">
                      <input type="password" placeholder="New password (min 6 characters)" value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900" />
                      {passwordMsg && (
                        <p className={`text-xs ${passwordMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>{passwordMsg}</p>
                      )}
                      <button onClick={handleChangePassword} disabled={newPassword.length < 6}
                        className="px-5 py-2 bg-[#10B981] text-white text-sm font-semibold rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Update Password
                      </button>
                    </div>
                  )}
                </div>

                {/* Beta feedback widget */}
                {hasPreviewCookie && (
                  <div className="border-b border-gray-100 pb-5 mb-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#1F2937]">Beta feedback button</p>
                        <p className="text-xs text-[#6B7280]">Show or hide the floating feedback button across the site</p>
                      </div>
                      <button
                        onClick={toggleFeedbackHidden}
                        role="switch"
                        aria-checked={!feedbackHidden}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          feedbackHidden ? "bg-gray-300" : "bg-[#10B981]"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            feedbackHidden ? "translate-x-0.5" : "translate-x-[22px]"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

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
        <div className="animate-spin w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full" />
      </div>
    }>
      <AccountPageInner />
    </Suspense>
  );
}

// ── Home overview sub-components ──────────────────────────────────────────

// Self Check-in has no on-site measurement, no blood test, no doctor visit —
// the next step is simply answering the questionnaire in the patient portal.
// We render an abbreviated journey and a purpose-built hero card.
function SelfCheckinJourney({ completed, onChangePackage }: { completed: boolean; onChangePackage: () => void | Promise<void> }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-[#1F2937]">Your journey</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onChangePackage} className="text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2">
            Change package
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            Self Check-in
          </span>
        </div>
      </div>
      <p className="text-sm text-[#6B7280] mb-6">
        Self Check-in is fully remote — no visit, no blood test. Just the questionnaire in the patient portal.
      </p>
      <ol className="relative border-l-2 border-gray-100 ml-4 space-y-5">
        {/* Step 1 */}
        <li className="ml-6 relative">
          <span className="absolute -left-9 top-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <div className="font-semibold text-[#1F2937]">Self Check-in booked</div>
            <p className="text-sm text-[#6B7280] mt-1">Your remote check-in is registered. You can find it under Current bookings below.</p>
          </div>
        </li>

        {/* Step 2 */}
        <li className="ml-6 relative">
          <span className={`absolute -left-9 top-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${completed ? "bg-emerald-500 text-white" : "bg-violet-500 text-white"}`}>
            {completed ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span>2</span>
            )}
          </span>
          <div>
            <div className="font-semibold text-[#1F2937]">Answer the questionnaire in the patient portal</div>
            <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
              {completed
                ? "Done. A Lifeline clinician has reviewed your answers and will reach out if anything is flagged."
                : "Open Medalia (the Lifeline patient portal) and complete your questionnaire. A clinician reviews it and will contact you if anything needs follow-up — otherwise you'll get an updated health score and insights directly in the portal."}
            </p>
            {!completed && (
              <div className="mt-3 flex flex-wrap gap-2">
                <MedaliaButton label="Open patient portal" size="sm" />
              </div>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}

// Check-in package: booked → activate Biody profile → measurement on the
// scheduled date → (optional) doctor consultation add-on at 18,500 ISK →
// view results in the patient portal.
function CheckinJourney({
  biodyActivated, bodyCompBookingAt, completed, hasDoctorBooking, onGoToBiody,
  doctorAddonPaid, payingDoctorAddon, onPayDoctorAddon,
  hasAvailableInPersonSlots, onPickInPersonDoctorSlot,
  onConfirmVideoPortal, videoConfirmBusy, onChangePackage,
}: {
  biodyActivated: boolean;
  bodyCompBookingAt: string | null;
  completed: boolean;
  hasDoctorBooking: boolean;
  onGoToBiody: () => void;
  doctorAddonPaid: boolean;
  payingDoctorAddon: boolean;
  onPayDoctorAddon: () => void | Promise<void>;
  hasAvailableInPersonSlots: boolean;
  onPickInPersonDoctorSlot: () => void;
  onConfirmVideoPortal: () => void;
  videoConfirmBusy: boolean;
  onChangePackage: () => void | Promise<void>;
}) {
  const slotLabel = bodyCompBookingAt
    ? new Date(bodyCompBookingAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;
  type S = { title: string; description: string; state: "done" | "active" | "pending"; cta?: React.ReactNode };
  const steps: S[] = [
    {
      title: "Check-in booked",
      description: "Your follow-up round is registered. See Current bookings below for the date and time.",
      state: "done",
    },
    {
      title: "Update and confirm your body-composition profile",
      description: biodyActivated
        ? "Your profile is synced with Biody. You can update details any time."
        : "Confirm your height, weight and activity level so we can send your profile to Biody before the measurement.",
      state: biodyActivated ? "done" : "active",
      cta: (
        <button onClick={onGoToBiody} className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-md bg-gradient-to-r from-[#10B981] to-[#14B8A6] text-white hover:opacity-95">
          {biodyActivated ? "Edit details" : "Activate profile"}
        </button>
      ),
    },
    {
      title: "Measurement appointment",
      description: completed
        ? "Measurement complete. Your progress report is being prepared."
        : slotLabel
          ? `Scheduled for ${slotLabel}. See Current bookings below for directions.`
          : "We'll confirm the time once your station slot is finalised.",
      state: completed ? "done" : biodyActivated ? "active" : "pending",
    },
    (() => {
      // Three sub-states: (a) not paid → offer 18,500 kr add-on
      //                   (b) paid but not yet booked → pick in-person or video
      //                   (c) booked → done
      if (hasDoctorBooking) {
        return {
          title: "Doctor consultation",
          description: "Your consultation is booked. See Current bookings below.",
          state: "done" as const,
        };
      }
      if (!doctorAddonPaid) {
        return {
          title: "Doctor consultation",
          description: "Optional add-on — book a 1:1 doctor review of your progress and an updated action plan. Charged separately at 18,500 kr.",
          state: "pending" as const,
          cta: (
            <button
              onClick={onPayDoctorAddon}
              disabled={payingDoctorAddon}
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-md bg-gradient-to-r from-[#3B82F6] to-[#10B981] text-white hover:opacity-95 disabled:opacity-50"
            >
              {payingDoctorAddon && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {payingDoctorAddon ? "Charging…" : "Add for 18,500 kr"}
            </button>
          ),
        };
      }
      return {
        title: "Doctor consultation",
        description: "Paid. Choose how you'd like to meet your Lifeline doctor.",
        state: "active" as const,
        cta: (
          <div className="flex flex-wrap items-center gap-2">
            {hasAvailableInPersonSlots ? (
              <button onClick={onPickInPersonDoctorSlot} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                Pick a time (in person)
              </button>
            ) : null}
            <MedaliaButton label="Book video via portal" size="sm" variant="outline" />
            <button
              onClick={onConfirmVideoPortal}
              disabled={videoConfirmBusy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {videoConfirmBusy ? "…" : "I've booked — confirm"}
            </button>
          </div>
        ),
      };
    })(),
    {
      title: "View your results in the patient portal",
      description: completed
        ? "Your progress report, updated health score and refreshed plan are in Medalia."
        : "After your measurement (and optional doctor review), your progress report lands in the Lifeline patient portal.",
      state: completed ? "active" : "pending",
      cta: completed ? <MedaliaButton label="Open patient portal" size="sm" /> : undefined,
    },
  ];

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-[#1F2937]">Your journey</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onChangePackage} className="text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2">
            Change package
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Check-in
          </span>
        </div>
      </div>
      <p className="text-sm text-[#6B7280] mb-6">Your follow-up round — track progress and refresh your plan.</p>
      <ol className="relative border-l-2 border-gray-100 ml-4 space-y-5">
        {steps.map((s, i) => {
          const color = s.state === "done" ? "bg-emerald-500 text-white" : s.state === "active" ? "bg-[#10B981] text-white" : "bg-gray-200 text-gray-500";
          return (
            <li key={i} className="ml-6 relative">
              <span className={`absolute -left-9 top-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${color}`}>
                {s.state === "done" ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              <div>
                <div className="font-semibold text-[#1F2937]">{s.title}</div>
                <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">{s.description}</p>
                {s.cta && <div className="mt-3">{s.cta}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function JourneyTimeline({
  isB2C,
  hasOnboarded, biodyActivated, hasBodyCompSlot, hasBodyCompBooking, hasBodyCompCompleted, hasBloodTestBooking,
  companyEvent, hasApprovedBloodDays,
  hasInPersonDoctorBooking, hasAvailableInPersonSlots, hasVideoPortalConfirmed, videoConfirmBusy,
  onPickBodyCompSlot, onPickBloodTestDay, onPickInPersonDoctorSlot,
  onConfirmVideoPortal, onClearVideoPortal, onGoToBiody,
  onChangePackage,
}: {
  isB2C: boolean;
  hasOnboarded: boolean;
  biodyActivated: boolean;
  hasBodyCompSlot: boolean;
  hasBodyCompBooking: boolean;
  hasBodyCompCompleted: boolean;
  hasBloodTestBooking: boolean;
  companyEvent: { event_date: string; start_time: string; end_time: string; location: string | null } | null;
  hasApprovedBloodDays: boolean;
  hasInPersonDoctorBooking: boolean;
  hasAvailableInPersonSlots: boolean;
  hasVideoPortalConfirmed: boolean;
  videoConfirmBusy: boolean;
  onPickBodyCompSlot: () => void;
  onPickBloodTestDay: () => void;
  onPickInPersonDoctorSlot: () => void;
  onConfirmVideoPortal: () => void;
  onClearVideoPortal: () => void;
  onGoToBiody: () => void;
  onChangePackage?: () => void | Promise<void>;
}) {
  const eventLabel = companyEvent
    ? `${new Date(companyEvent.event_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}, ${companyEvent.start_time.slice(0,5)}–${companyEvent.end_time.slice(0,5)}${companyEvent.location ? ` · ${companyEvent.location}` : ""}`
    : "";

  type JourneyCta = { label: string; onClick?: () => void; href?: string };
  type JourneyStep = {
    title: string;
    done: boolean;
    active: boolean;
    description: string;
    cta?: JourneyCta;
    portal?: boolean;
    customBody?: React.ReactNode;
  };
  const onboardingStep: JourneyStep = {
    title: "Onboarding",
    done: hasOnboarded,
    active: false,
    description: "Profile + consent complete.",
  };
  const bodyCompProfileStep: JourneyStep = {
    title: "Body-composition profile",
    done: biodyActivated,
    active: hasOnboarded && !biodyActivated,
    description: biodyActivated
      ? "Registered with our measurement partner. You can update your details (height, weight, activity level) any time."
      : "Activate your profile — takes about a minute.",
    cta: { label: biodyActivated ? "Edit details" : "Activate", onClick: onGoToBiody },
  };
  const b2cBookStep: JourneyStep = {
    // B2C: one step covers measurement + blood-draw referral via Medalia booking
    title: "Book your Foundational Health assessment",
    done: hasBodyCompBooking,
    active: !hasBodyCompBooking,
    description: hasBodyCompCompleted
      ? "Completed. Your results live in the patient portal."
      : hasBodyCompBooking
        ? "Booked. See 'Current bookings' below for the scheduled time."
        : "Pick a package, a time, and pay — one visit covers measurements and your blood-test referral.",
    cta: !hasBodyCompBooking
      ? { label: "Book at a station", href: "/account/book" }
      : undefined,
  };
  const b2bMeasurementsStep: JourneyStep = {
    title: "Measurements — book your time slot",
    done: hasBodyCompSlot,
    active: biodyActivated && !hasBodyCompSlot && !!companyEvent,
    description: hasBodyCompSlot
      ? "Your slot is booked. See 'Current bookings' below."
      : companyEvent
        ? `On-site at ${eventLabel}. Pick a 5-minute slot.`
        : "Your company will schedule the measurement day. You'll be notified.",
    cta: !hasBodyCompSlot && companyEvent ? { label: "Pick a slot", onClick: onPickBodyCompSlot } : undefined,
  };
  const steps: JourneyStep[] = [
    onboardingStep,
    // B2C flips the order: book first (pay, reserve a time), then profile
    ...(isB2C ? [b2cBookStep, bodyCompProfileStep] : [bodyCompProfileStep, b2bMeasurementsStep]),
    isB2C
      ? {
          // B2C: standing Sameind referral, no company-approved days
          title: "Blood test at Sameind",
          done: hasBodyCompCompleted, // covered in the single booking; completes when the visit is done
          active: hasBodyCompBooking && !hasBodyCompCompleted,
          description: hasBodyCompCompleted
            ? "Done — results will appear in your personal report."
            : hasBodyCompBooking
              ? "Included with your booking. Walk in at any Sameind station during its opening hours — remember to fast from midnight."
              : "Your Sameind referral is issued when you book your assessment above.",
          portal: hasBodyCompBooking,
        }
      : {
          title: "Blood test at Sameind — pick your day",
          done: hasBloodTestBooking,
          active: biodyActivated && !hasBloodTestBooking && hasApprovedBloodDays,
          description: hasBloodTestBooking
            ? "Day chosen. Walk in at any Sameind station during its opening hours."
            : hasApprovedBloodDays
              ? "Your company has approved days for you. Walk in at any Sameind station during its opening hours."
              : "Your company will approve blood-test days. You'll be notified.",
          cta: !hasBloodTestBooking && hasApprovedBloodDays ? { label: "Pick a day", onClick: onPickBloodTestDay } : undefined,
        },
    {
      title: "Health questionnaire",
      done: false,
      active: hasBodyCompSlot && hasBloodTestBooking,
      description: hasBodyCompSlot && hasBloodTestBooking
        ? "You'll receive an SMS from the Lifeline team within the next 7 days with a link to the questionnaire. The questionnaire will be available in your secure patient portal."
        : "You'll get an SMS with the questionnaire within 7 days of booking your measurement + blood test. The questionnaire will be available in your secure patient portal.",
      portal: true,
    },
    (() => {
      const hasAnyBooking = hasInPersonDoctorBooking || hasVideoPortalConfirmed;
      const canBook = hasAvailableInPersonSlots || hasBodyCompSlot; // video path always available
      const description = hasVideoPortalConfirmed && !hasInPersonDoctorBooking
        ? "Video meeting confirmed — you've booked it in your patient portal. See 'Current bookings' below."
        : hasInPersonDoctorBooking
          ? "In-person consultation booked. See 'Current bookings' below."
          : canBook
            ? "Choose how you'd like to meet your Lifeline doctor to build your action plan."
            : "Once your report is ready, the Lifeline team will open consultation options for you.";
      const customBody = !hasAnyBooking ? (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* In-person option */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-semibold text-blue-900">In person</span>
            </div>
            <p className="text-xs text-blue-900/80 leading-snug mb-2">Meet the doctor at the Lifeline location, set by our team.</p>
            {hasAvailableInPersonSlots ? (
              <button onClick={onPickInPersonDoctorSlot} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                Pick a time
              </button>
            ) : (
              <div className="text-xs text-blue-900/70">No in-person slots available right now.</div>
            )}
          </div>
          {/* Video option */}
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-violet-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold text-violet-900">Video via patient portal</span>
            </div>
            <p className="text-xs text-violet-900/80 leading-snug mb-2">Video meetings are booked inside the patient portal (Zoom Healthcare). Book there, then come back to confirm.</p>
            <div className="flex flex-wrap gap-2">
              <MedaliaButton label="Open patient portal" size="sm" variant="outline" />
              <button
                onClick={onConfirmVideoPortal}
                disabled={videoConfirmBusy}
                className="text-xs font-semibold px-3 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {videoConfirmBusy ? "…" : "I've booked — confirm"}
              </button>
            </div>
            <p className="mt-2 text-[10.5px] text-violet-900/60 leading-snug">
              Self-reported for now — we&apos;ll sync with your Medalia booking automatically once the integration is live.
            </p>
          </div>
        </div>
      ) : hasVideoPortalConfirmed && !hasInPersonDoctorBooking ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <MedaliaButton label="Open patient portal" size="sm" />
          <button onClick={onClearVideoPortal} disabled={videoConfirmBusy} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60">
            Clear confirmation
          </button>
        </div>
      ) : null;
      return {
        title: "Doctor consultation",
        done: hasAnyBooking,
        active: !hasAnyBooking,
        description,
        customBody,
      };
    })(),
    // Final step — every package ends in the patient portal.
    {
      title: "View your results in the patient portal",
      done: false,
      active: hasBodyCompCompleted,
      description: hasBodyCompCompleted
        ? "Your report, health score and action plan are ready in Medalia."
        : "Once your measurements, blood work and doctor consultation are done, your full personal report lands in the Lifeline patient portal.",
      portal: true,
    },
  ];

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-[#1F2937]">Your journey</h3>
        {isB2C && onChangePackage ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onChangePackage} className="text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2">
              Change package
            </button>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Foundational
            </span>
          </div>
        ) : null}
      </div>
      <p className="text-sm text-[#6B7280] mb-6">Where you are in the Lifeline programme.</p>
      <ol className="relative border-l-2 border-gray-100 ml-4">
        {steps.map((s, i) => {
          const dotColor = s.done
            ? "bg-emerald-500 text-white"
            : s.active
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-400";
          return (
            <li key={i} className="relative pl-6 pb-6 last:pb-0">
              <span className={`absolute -left-[13px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${dotColor}`}>
                {s.done ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} d="M5 13l4 4L19 7" />
                  </svg>
                ) : i + 1}
              </span>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className={`font-semibold ${s.done ? "text-gray-500" : s.active ? "text-gray-900" : "text-gray-400"}`}>
                    {s.title}
                  </div>
                  <div className={`text-sm ${s.active ? "text-gray-700" : "text-gray-500"} mt-0.5`}>{s.description}</div>
                  {"portal" in s && s.portal && (
                    <div className="mt-3">
                      <MedaliaButton label="Open patient portal" size="sm" />
                    </div>
                  )}
                  {"customBody" in s && s.customBody ? s.customBody : null}
                </div>
                {"cta" in s && s.cta && (
                  s.cta.href ? (
                    <Link href={s.cta.href} className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 shrink-0">
                      {s.cta.label}
                    </Link>
                  ) : (
                    <button onClick={s.cta.onClick} className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 shrink-0">
                      {s.cta.label}
                    </button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CurrentBookings({
  isB2C,
  mySlotAt, companyEvent, myBloodTestBooking, myDoctorSlot, videoPortalConfirmedAt,
  bodyCompBookingAt, bodyCompStatus, bodyCompPackage,
  onChangeBcSlot, onChangeBloodDay, onChangeDoctorSlot, onClearVideoPortal,
}: {
  isB2C: boolean;
  mySlotAt: string | null;
  companyEvent: { event_date: string; start_time: string; end_time: string; location: string | null; room_notes: string | null } | null;
  myBloodTestBooking: { day: string; note: string | null } | null;
  myDoctorSlot: { id: string; slot_at: string; duration_minutes: number; mode: "video" | "phone" | "in_person"; location: string | null; meeting_link: string | null; doctor_name: string | null; notes: string | null; booking_note: string | null } | null;
  videoPortalConfirmedAt: string | null;
  bodyCompBookingAt: string | null;
  bodyCompStatus: "none" | "booked" | "completed";
  bodyCompPackage: "foundational" | "checkin" | "self-checkin" | null;
  onChangeBcSlot: () => void;
  onChangeBloodDay: () => void;
  onChangeDoctorSlot: () => void;
  onClearVideoPortal: () => void;
}) {
  const hasB2CBodyComp = isB2C && bodyCompStatus === "booked" && !!bodyCompBookingAt;
  const hasSelfCheckin = isB2C && bodyCompPackage === "self-checkin" && bodyCompStatus !== "none";
  const nothing = !mySlotAt && !myBloodTestBooking && !myDoctorSlot && !videoPortalConfirmedAt && !hasB2CBodyComp && !hasSelfCheckin;
  const editIcon = (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
  const calIcon = (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#1F2937]">Current bookings</h3>
          <p className="text-sm text-[#6B7280]">Your confirmed appointments.</p>
        </div>
        {!nothing && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Confirmed
          </span>
        )}
      </div>
      {nothing ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center">
          <p className="text-sm text-gray-600">Nothing booked yet. Use the journey steps above to book your measurement and blood test.</p>
        </div>
      ) : (() => {
        const bcTime = mySlotAt ? new Date(mySlotAt).getTime() : Infinity;
        const btTime = myBloodTestBooking ? new Date(myBloodTestBooking.day + "T00:00:00").getTime() : Infinity;
        const drTime = myDoctorSlot ? new Date(myDoctorSlot.slot_at).getTime() : Infinity;
        const modeLabel = (m: "video" | "phone" | "in_person") => m === "video" ? "Video call" : m === "phone" ? "Phone call" : "In person";
        const calButtons = (ev: CalendarEvent, accentClasses: string) => (
          <>
            <a
              href={googleCalendarUrl(ev)}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white transition-colors ${accentClasses}`}
            >
              {calIcon}
              Google
            </a>
            <button
              onClick={() => downloadIcs(ev, "lifeline-booking.ics")}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white transition-colors ${accentClasses}`}
            >
              {calIcon}
              .ics
            </button>
          </>
        );
        const bcCard = mySlotAt && companyEvent ? (
          <div key="bc" className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-emerald-500" />
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  {/* Measuring tape */}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <circle cx="12" cy="12" r="3" strokeWidth={2} />
                    <path strokeLinecap="round" strokeWidth={2} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Measurements</div>
                  <div className="font-semibold text-gray-900 leading-tight">On-site</div>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">{new Date(mySlotAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">{new Date(mySlotAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                </div>
                {companyEvent.location && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{companyEvent.location}</span>
                  </div>
                )}
                {companyEvent.room_notes && <div className="text-xs text-gray-500 pl-6">{companyEvent.room_notes}</div>}
              </div>
              <div className="mt-3 rounded-lg bg-blue-50/70 border border-blue-100 px-3 py-2 text-xs text-blue-900">
                <div className="font-semibold mb-1">What to expect</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11.5px] text-blue-900/90">
                  <li>Blood pressure</li>
                  <li>Height</li>
                  <li>Weight</li>
                  <li>Body composition (muscle mass %, fat %)</li>
                </ul>
                <div className="mt-1.5 text-[11.5px] text-blue-900/80">Takes about 5 minutes. Avoid heavy meals just before.</div>
              </div>
              <div className="mt-4 pt-4 border-t border-blue-100/70 flex flex-wrap gap-2">
                <button onClick={onChangeBcSlot} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors">
                  {editIcon}
                  Change slot
                </button>
                {calButtons(
                  {
                    title: "Lifeline — Body-composition measurement",
                    start: new Date(mySlotAt),
                    durationMinutes: 5,
                    location: companyEvent.location || undefined,
                    description: [
                      "Your on-site Lifeline body-composition measurement.",
                      companyEvent.room_notes ? `Room: ${companyEvent.room_notes}` : "",
                      "What to expect: blood pressure, height, weight, body composition (muscle mass %, fat %).",
                    ].filter(Boolean).join("\n"),
                  },
                  "border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300",
                )}
              </div>
            </div>
          ) : null;
        const btCard = myBloodTestBooking ? (
          <div key="bt" className="relative overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-rose-500 to-amber-500" />
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-rose-600">Blood test</div>
                  <div className="font-semibold text-gray-900 leading-tight">Sameind walk-in</div>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">{new Date(myBloodTestBooking.day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Walk in at any Sameind station</span>
                </div>
                {myBloodTestBooking.note && <div className="text-xs text-gray-500 pl-6">{myBloodTestBooking.note}</div>}
              </div>
              <div className="mt-3 rounded-lg bg-rose-50/70 border border-rose-100 px-3 py-2 text-xs text-rose-900">
                <div className="font-semibold mb-1">What to expect</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11.5px] text-rose-900/90">
                  <li>Walk in at any Sameind station on your chosen day</li>
                  <li>Go as early as possible — preferably between 08:00 and 12:00</li>
                  <li>Check in at reception</li>
                  <li>Short blood draw (5 minutes)</li>
                  <li>Results will appear in your final health report</li>
                </ul>
              </div>
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-900">
                <span className="font-semibold">Fast from midnight.</span> Water only — no food, coffee, tea, juice or alcohol.
              </div>
              <div className="mt-4 pt-4 border-t border-rose-100/70 flex flex-wrap gap-2">
                {!isB2C && (
                  <button onClick={onChangeBloodDay} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 hover:border-rose-300 transition-colors">
                    {editIcon}
                    Change day
                  </button>
                )}
                {(() => {
                  const dayStart = new Date(`${myBloodTestBooking.day}T08:00:00`);
                  const dayEnd = new Date(`${myBloodTestBooking.day}T09:00:00`);
                  return calButtons(
                    {
                      title: "Lifeline — Blood test at Sameind",
                      start: dayStart,
                      end: dayEnd,
                      description: [
                        "Walk in at any Sameind station. Go as early as possible — preferably between 08:00 and 12:00.",
                        "Fast from midnight. Water only — no food, coffee, tea, juice, or alcohol.",
                        myBloodTestBooking.note ? `Note: ${myBloodTestBooking.note}` : "",
                      ].filter(Boolean).join("\n"),
                    },
                    "border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300",
                  );
                })()}
              </div>
            </div>
          ) : null;
        const drCard = myDoctorSlot ? (
          <div key="dr" className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            <div className="flex items-start gap-3 mb-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                {/* Stethoscope — FontAwesome 5 solid, matches app bottom-nav */}
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 512 512" aria-hidden>
                  <path d="M447.1 112c-34.2.5-62.3 28.4-63 62.6-.5 24.3 12.5 45.6 32 56.8V344c0 57.3-50.2 104-112 104-60 0-109.2-44.1-111.9-99.2C265 333.8 320 269.2 320 192V36.6c0-11.4-8.1-21.3-19.3-23.5L237.8.5c-13-2.6-25.6 5.8-28.2 18.8L206.4 35c-2.6 13 5.8 25.6 18.8 28.2l30.7 6.1v121.4c0 52.9-42.2 96.7-95.1 97.2-53.4.5-96.9-42.7-96.9-96V69.4l30.7-6.1c13-2.6 21.4-15.2 18.8-28.2l-3.1-15.7C107.7 6.4 95.1-2 82.1.6L19.3 13C8.1 15.3 0 25.1 0 36.6V192c0 77.3 55.1 142 128.1 156.8C130.7 439.2 208.6 512 304 512c97 0 176-75.4 176-168V231.4c19.1-11.1 32-31.7 32-55.4 0-35.7-29.2-64.5-64.9-64zm.9 80c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-violet-600">Doctor</div>
                <div className="font-semibold text-gray-900 leading-tight">
                  {myDoctorSlot.doctor_name ? `Consultation with ${myDoctorSlot.doctor_name}` : "Doctor consultation"}
                </div>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">{new Date(myDoctorSlot.slot_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">
                  {new Date(myDoctorSlot.slot_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  {" · "}{myDoctorSlot.duration_minutes} min
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{modeLabel(myDoctorSlot.mode)}{myDoctorSlot.location ? ` · ${myDoctorSlot.location}` : ""}</span>
              </div>
              {myDoctorSlot.meeting_link && (
                <a href={myDoctorSlot.meeting_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900 pl-6">
                  Join link ↗
                </a>
              )}
              {myDoctorSlot.notes && <div className="text-xs text-gray-500 pl-6">{myDoctorSlot.notes}</div>}
              {myDoctorSlot.booking_note && <div className="text-xs text-gray-500 pl-6 italic">“{myDoctorSlot.booking_note}”</div>}
            </div>
            <div className="mt-3 rounded-lg bg-violet-50/70 border border-violet-100 px-3 py-2 text-xs text-violet-900">
              <div className="font-semibold mb-1">What to expect</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11.5px] text-violet-900/90">
                <li>Walk through your body-composition + blood-test results</li>
                <li>Discuss your health questionnaire answers</li>
                <li>Agree on a personal action plan</li>
                <li>Time for your questions</li>
              </ul>
              <div className="mt-1.5 text-[11.5px] text-violet-900/80">Please review your health report in the patient portal before your doctor meeting.</div>
            </div>
            <div className="mt-4 pt-4 border-t border-violet-100/70 flex flex-wrap gap-2">
              <button onClick={onChangeDoctorSlot} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-violet-200 text-violet-700 bg-white hover:bg-violet-50 hover:border-violet-300 transition-colors">
                {editIcon}
                Change time
              </button>
              {calButtons(
                {
                  title: myDoctorSlot.doctor_name ? `Lifeline — Consultation with ${myDoctorSlot.doctor_name}` : "Lifeline — Doctor consultation",
                  start: new Date(myDoctorSlot.slot_at),
                  durationMinutes: myDoctorSlot.duration_minutes,
                  location: myDoctorSlot.mode === "in_person" ? (myDoctorSlot.location || undefined) : (myDoctorSlot.meeting_link || undefined),
                  description: [
                    `${modeLabel(myDoctorSlot.mode)} with your Lifeline doctor.`,
                    myDoctorSlot.meeting_link ? `Join link: ${myDoctorSlot.meeting_link}` : "",
                    myDoctorSlot.notes || "",
                    "Please review your health report in the patient portal before the meeting.",
                  ].filter(Boolean).join("\n"),
                },
                "border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300",
              )}
            </div>
          </div>
        ) : null;
        const drVideoCard = (!myDoctorSlot && videoPortalConfirmedAt) ? (
          <div key="dr-video" className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            <div className="flex items-start gap-3 mb-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-violet-600">Doctor · Video meeting</div>
                <div className="font-semibold text-gray-900 leading-tight">Video meeting booked in patient portal</div>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-gray-700">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Confirmed {new Date(videoPortalConfirmedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              <div className="text-sm text-gray-600">Your video consultation is booked inside the patient portal (Zoom Healthcare). Join the meeting from the portal at your scheduled time.</div>
            </div>
            <div className="mt-3 rounded-lg bg-violet-50/70 border border-violet-100 px-3 py-2 text-xs text-violet-900">
              <div className="font-semibold mb-1">What to expect</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11.5px] text-violet-900/90">
                <li>Join the video meeting from the patient portal</li>
                <li>Walk through your report with your doctor</li>
                <li>Agree on a personal action plan</li>
              </ul>
              <div className="mt-1.5 text-[11.5px] text-violet-900/80">Please review your health report in the patient portal before your doctor meeting.</div>
            </div>
            <div className="mt-4 pt-4 border-t border-violet-100/70 flex flex-wrap items-center gap-2">
              <MedaliaButton label="Go to patient portal" size="sm" />
              <button onClick={onClearVideoPortal} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 hover:border-rose-300 transition-colors">
                Clear
              </button>
            </div>
          </div>
        ) : null;
        const bcB2CCard = hasB2CBodyComp && bodyCompBookingAt ? (
          <div key="bc-b2c" className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#10B981] to-[#0D9488]" />
            <div className="flex items-start gap-3 mb-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth={2} />
                  <circle cx="12" cy="12" r="3" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M12 3v2M12 19v2M3 12h2M19 12h2" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Measurements</div>
                <div className="font-semibold text-gray-900 leading-tight">At a Lifeline station</div>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">{new Date(bodyCompBookingAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{new Date(bodyCompBookingAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-emerald-50/70 border border-emerald-100 px-3 py-2 text-xs text-emerald-900">
              <div className="font-semibold mb-1">What to expect</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11.5px] text-emerald-900/90">
                <li>Blood pressure, height, weight, body composition</li>
                <li>Targeted blood draw — fast from midnight</li>
                <li>Results appear in your personal report</li>
              </ul>
            </div>
          </div>
        ) : null;
        const selfCheckinCard = hasSelfCheckin ? (
          <div key="self-checkin" className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-violet-500 to-sky-500" />
            <div className="flex items-start gap-3 mb-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h3m-6 4h12a2 2 0 002-2V7a2 2 0 00-2-2h-3.172a2 2 0 01-1.414-.586l-1.828-1.828A2 2 0 0011.172 2H8a2 2 0 00-2 2v1" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-violet-600">Self Check-in</div>
                <div className="font-semibold text-gray-900 leading-tight">Remote questionnaire</div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {bodyCompStatus === "completed"
                ? "Completed — a clinician has reviewed your answers."
                : "Open the patient portal and answer the questionnaire. No visit required."}
            </p>
            <div className="mt-4">
              <MedaliaButton label="Open patient portal" size="sm" />
            </div>
          </div>
        ) : null;

        const entries = [
          { key: "self-checkin", card: selfCheckinCard, time: 0 },
          { key: "bc", card: bcCard, time: bcTime },
          { key: "bc-b2c", card: bcB2CCard, time: bodyCompBookingAt ? new Date(bodyCompBookingAt).getTime() : Infinity },
          { key: "bt", card: btCard, time: btTime },
          { key: "dr", card: drCard, time: drTime },
          { key: "dr-video", card: drVideoCard, time: videoPortalConfirmedAt ? new Date(videoPortalConfirmedAt).getTime() : Infinity },
        ].filter((e) => e.card).sort((a, b) => a.time - b.time);
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => e.card)}
          </div>
        );
      })()}
    </section>
  );
}

function BodyCompSlotPickerModal({
  event, onClose, onBooked,
}: {
  event: { id: string; event_date: string; start_time: string; end_time: string; location: string | null; room_notes: string | null; slot_minutes: number; slot_capacity: number };
  onClose: () => void;
  onBooked: () => void;
}) {
  return <SlotPicker event={event} onClose={onClose} onBooked={onBooked} />;
}

function BloodTestDayPickerModal({
  companyId, days, existing, onClose, onBooked,
}: {
  companyId: string;
  days: Array<{ day: string; notes: string | null }>;
  existing: { day: string; note: string | null } | null;
  onClose: () => void;
  onBooked: (booking: { day: string; note: string | null }) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<string>(existing?.day || "");
  const [note, setNote] = useState<string>(existing?.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!selectedDay) { setError("Pick a day."); return; }
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in"); setSaving(false); return; }
    const { error: upErr } = await supabase.from("blood_test_bookings").upsert({
      client_id: user.id,
      company_id: companyId,
      day: selectedDay,
      note: note.trim() || null,
    }, { onConflict: "client_id" });
    setSaving(false);
    if (upErr) { setError(upErr.message); return; }
    onBooked({ day: selectedDay, note: note.trim() || null });
    onClose();
  };

  const cancel = async () => {
    if (!confirm("Cancel your blood-test day booking?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("blood_test_bookings").delete().eq("client_id", user.id);
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">Pick your blood-test day</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your company approves specific days for you to visit Sameind. Walk in at any Sameind station during that station&apos;s opening hours.
          </p>
        </div>
        <div className="p-6 space-y-4">
          {days.length === 0 ? (
            <p className="text-sm text-gray-500">Your company hasn&apos;t approved any days yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {days.map((d) => {
                const isSelected = d.day === selectedDay;
                const label = new Date(d.day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
                return (
                  <button
                    key={d.day}
                    onClick={() => setSelectedDay(d.day)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium">{label}</div>
                    {d.notes && <div className="text-xs text-gray-500 mt-0.5">{d.notes}</div>}
                  </button>
                );
              })}
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Note (optional)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I'll aim for 8:30" className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
          </label>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
            <div className="font-semibold mb-1">Important — fast before your blood test</div>
            You must <strong>fast from midnight</strong> the night before your visit. Water is fine; no food, no coffee, no tea, no juice, no alcohol.
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">Sameind stations — walk in at any of these:</div>
            <ul className="divide-y divide-gray-100">
              {SAMEIND_STATIONS.map((s) => (
                <li key={s.id} className="py-2 text-xs">
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="text-gray-600">{fullAddress(s)}</div>
                  <div className="text-gray-500">{s.hours}</div>
                </li>
              ))}
            </ul>
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
        <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-2">
          {existing ? (
            <button onClick={cancel} className="text-sm text-red-600 hover:underline">Cancel booking</button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Close</button>
            <button onClick={save} disabled={saving || !selectedDay} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50">
              {saving ? "Saving…" : existing ? "Update" : "Confirm day"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BiodyProfileModal({
  userId, onClose, onActivated,
}: {
  userId: string;
  onClose: () => void;
  onActivated?: () => void;
}) {
  const [biodyActive, setBiodyActive] = useState(false);
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<"sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "">("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("sex, height_cm, weight_kg, activity_level, date_of_birth, biody_patient_id")
        .eq("id", userId)
        .maybeSingle();
      if (data) {
        const d = data as Record<string, unknown>;
        setSex((d.sex as "male" | "female" | "") || "");
        setHeightCm(d.height_cm ? String(d.height_cm) : "");
        setWeightKg(d.weight_kg ? String(d.weight_kg) : "");
        setActivityLevel((d.activity_level as typeof activityLevel) || "");
        setDob((d.date_of_birth as string) || "");
        setBiodyActive(!!d.biody_patient_id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!sex || !heightCm || !weightKg || !activityLevel) {
      setError("Please fill in every field.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: upErr } = await supabase.from("clients").update({
      sex,
      height_cm: Number(heightCm),
      weight_kg: Number(weightKg),
      activity_level: activityLevel,
      ...(dob ? { date_of_birth: dob } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (upErr) { setSaving(false); setError(upErr.message); return; }

    // First-time activation: fields saved, now create the Biody patient.
    if (!biodyActive) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch("/api/biody/activate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({}),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) {
          setSaving(false);
          setError(typeof j.detail === "string" ? j.detail : j.error || "Activation failed. Please contact support.");
          return;
        }
        setBiodyActive(true);
        if (onActivated) onActivated();
      } catch (err) {
        setSaving(false);
        setError((err as Error).message || "Activation failed.");
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => onClose(), 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">{biodyActive ? "Edit body-composition profile" : "Activate your body-composition profile"}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {biodyActive
              ? "Keep your details up to date so measurements and recommendations stay accurate."
              : "A few quick details so we can set up your profile with our measurement partner."}
          </p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <form onSubmit={save} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Sex</span>
                <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female" | "")} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Select…</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Activity level</span>
                <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as typeof activityLevel)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Select…</option>
                  <option value="sedentary">Sedentary — little or no exercise</option>
                  <option value="light">Light — exercise 1–3 days/week</option>
                  <option value="moderate">Moderate — exercise 3–5 days/week</option>
                  <option value="very_active">Very active — exercise 6–7 days/week</option>
                  <option value="extra_active">Extra active — daily intense training</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Height (cm)</span>
                <input type="number" min={100} max={230} step={1} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Weight (kg)</span>
                <input type="number" min={30} max={300} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </label>
              <label className="block sm:col-span-2">
                <span className="block text-xs font-medium text-gray-700 mb-1">Date of birth (optional)</span>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </label>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {saved && <div className="text-emerald-700 text-sm">Saved.</div>}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Close</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50">
                {saving ? (biodyActive ? "Saving…" : "Activating…") : (biodyActive ? "Save changes" : "Save & activate")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DoctorSlotPickerModal({
  slots, existing, onClose, onBooked, onCancelled,
}: {
  slots: Array<{ id: string; slot_at: string; duration_minutes: number; mode: "video" | "phone" | "in_person"; location: string | null; meeting_link: string | null; doctor_name: string | null; notes: string | null }>;
  existing: { id: string; slot_at: string; duration_minutes: number; mode: "video" | "phone" | "in_person"; doctor_name: string | null; location: string | null; booking_note: string | null } | null;
  onClose: () => void;
  onBooked: () => Promise<void> | void;
  onCancelled: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [note, setNote] = useState<string>(existing?.booking_note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const modeLabel = (m: "video" | "phone" | "in_person") => m === "video" ? "Video call" : m === "phone" ? "Phone call" : "In person";

  type SlotRow = typeof slots[number];
  const grouped = useMemo(() => {
    const map = new Map<string, SlotRow[]>();
    for (const s of slots) {
      const day = new Date(s.slot_at).toISOString().slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const save = async () => {
    if (!selectedId) { setError("Pick a time."); return; }
    setSaving(true);
    setError("");
    if (existing) {
      const { error: cancelErr } = await supabase.rpc("cancel_doctor_slot");
      if (cancelErr) { setSaving(false); setError(cancelErr.message); return; }
    }
    const { data, error: bookErr } = await supabase.rpc("book_doctor_slot", {
      p_slot_id: selectedId,
      p_note: note.trim() || null,
    });
    setSaving(false);
    if (bookErr) { setError(bookErr.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.ok === false) { setError(row.error === "slot_unavailable" ? "That slot was just taken. Pick another." : row.error === "already_booked" ? "You already have a booking." : row.error || "Failed to book."); return; }
    await onBooked();
    onClose();
  };

  const cancel = async () => {
    if (!confirm("Cancel your doctor consultation?")) return;
    const { error: cancelErr } = await supabase.rpc("cancel_doctor_slot");
    if (cancelErr) { setError(cancelErr.message); return; }
    onCancelled();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">{existing ? "Change your doctor consultation" : "Book your doctor consultation"}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Meet 1:1 with your Lifeline doctor to go through the report and agree an action plan.
          </p>
        </div>
        <div className="p-6 space-y-4">
          {existing && (
            <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-xs text-violet-900">
              Current booking:{" "}
              <strong>{new Date(existing.slot_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</strong>
              {existing.doctor_name && <> with {existing.doctor_name}</>}
              {" · "}{modeLabel(existing.mode)}
            </div>
          )}
          {grouped.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center text-sm text-gray-600">
              No open slots right now. The Lifeline team will open new times soon.
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([day, daySlots]) => (
                <div key={day}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                    {new Date(day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {daySlots.map((s) => {
                      const selected = selectedId === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          className={`text-left rounded-lg border px-3 py-2 text-sm transition-colors ${selected ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200" : "border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/50"}`}>
                          <div className="font-semibold text-gray-900">
                            {new Date(s.slot_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                          </div>
                          <div className="text-xs text-gray-500">{s.duration_minutes} min · {modeLabel(s.mode)}</div>
                          {s.doctor_name && <div className="text-xs text-gray-500 truncate">{s.doctor_name}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Note (optional)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the doctor should know in advance" className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </label>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
        <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-2">
          {existing ? (
            <button onClick={cancel} className="text-sm text-red-600 hover:underline">Cancel booking</button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Close</button>
            <button onClick={save} disabled={saving || !selectedId} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-violet-600 to-fuchsia-500 disabled:opacity-50">
              {saving ? "Saving…" : existing ? "Update" : "Confirm time"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pillar icons and colors match the Lifeline app (Ionicons + brand.ts palette)
const APP_PILLARS: Array<{ title: string; desc: string; color: string; bg: string; border: string; icon: React.ReactNode }> = [
    {
      title: "Exercise",
      desc: "Strength, cardio and movement — programs tailored to you.",
      color: "text-[#3B82F6]",
      bg: "bg-blue-50",
      border: "border-blue-100",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 512 512" aria-hidden>
          <path d="M467,176a29.94,29.94,0,0,0-25.32,12.5,2,2,0,0,1-3.64-1.14V150.71c0-20.75-16.34-38.21-37.08-38.7A38,38,0,0,0,362,150v82a2,2,0,0,1-2,2H152a2,2,0,0,1-2-2V150.71c0-20.75-16.34-38.21-37.08-38.7A38,38,0,0,0,74,150v37.38a2,2,0,0,1-3.64,1.14A29.94,29.94,0,0,0,45,176c-16.3.51-29,14.31-29,30.62v98.72c0,16.31,12.74,30.11,29,30.62a29.94,29.94,0,0,0,25.32-12.5A2,2,0,0,1,74,324.62v36.67C74,382,90.34,399.5,111.08,400A38,38,0,0,0,150,362V280a2,2,0,0,1,2-2H360a2,2,0,0,1,2,2v81.29c0,20.75,16.34,38.21,37.08,38.7A38,38,0,0,0,438,362V324.62a2,2,0,0,1,3.64-1.14A29.94,29.94,0,0,0,467,336c16.3-.51,29-14.31,29-30.62V206.64C496,190.33,483.26,176.53,467,176Z"/>
        </svg>
      ),
    },
    {
      title: "Nutrition",
      desc: "Guidance tied to your blood work, goals, and macros.",
      color: "text-[#0D9488]",
      bg: "bg-teal-50",
      border: "border-teal-100",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 512 512" aria-hidden>
          <path d="M439,166.29c-18.67-32.57-47.46-50.81-85.57-54.23-20.18-1.8-39,3.37-57.23,8.38C282.05,124.33,268.68,128,256,128s-26-3.68-40.06-7.57c-18.28-5-37.18-10.26-57.43-8.36C122.12,115.48,93,134.18,74.2,166.15,56.82,195.76,48,236.76,48,288c0,40.4,15,90.49,40,134,12.82,22.25,47,74,87.16,74,30.77,0,47.15-9.44,59.11-16.33,8.3-4.78,13.31-7.67,21.69-7.67s13.39,2.89,21.69,7.67C289.65,486.56,306,496,336.8,496c40.17,0,74.34-51.76,87.16-74,25.07-43.5,40-93.59,40-134C464,235.43,455.82,195.62,439,166.29ZM216,352c-13.25,0-24-21.49-24-48s10.75-48,24-48,24,21.49,24,48S229.25,352,216,352Zm80,0c-13.25,0-24-21.49-24-48s10.75-48,24-48,24,21.49,24,48S309.25,352,296,352Z"/>
          <path d="M265.1,111.93c13.16-1.75,37.86-7.83,58.83-28.79a98,98,0,0,0,28-58.2A8,8,0,0,0,343.38,16c-12.71.95-36.76,5.87-58.73,27.85A97.6,97.6,0,0,0,256,103.2,8,8,0,0,0,265.1,111.93Z"/>
        </svg>
      ),
    },
    {
      title: "Sleep",
      desc: "Better rest through rhythms, routines and environment.",
      color: "text-[#8B5CF6]",
      bg: "bg-violet-50",
      border: "border-violet-100",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 512 512" aria-hidden>
          <path d="M264,480A232,232,0,0,1,32,248C32,154,86,69.72,169.61,33.33a16,16,0,0,1,21.06,21.06C181.07,76.43,176,104.66,176,136c0,110.28,89.72,200,200,200,31.34,0,59.57-5.07,81.61-14.67a16,16,0,0,1,21.06,21.06C442.28,426,358,480,264,480Z"/>
        </svg>
      ),
    },
    {
      title: "Mental wellness",
      desc: "Mindfulness, breathing, stress tools and resilience.",
      color: "text-[#06B6D4]",
      bg: "bg-cyan-50",
      border: "border-cyan-100",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 512 512" aria-hidden>
          <path d="M414.39,97.61A224,224,0,1,0,97.61,414.39,224,224,0,1,0,414.39,97.61ZM184,208a24,24,0,1,1-24,24A23.94,23.94,0,0,1,184,208ZM351.67,314.17c-12,40.3-50.2,69.83-95.62,69.83s-83.62-29.53-95.72-69.83A8,8,0,0,1,168.16,304H343.85A8,8,0,0,1,351.67,314.17ZM328,256a24,24,0,1,1,24-24A23.94,23.94,0,0,1,328,256Z"/>
        </svg>
      ),
    },
];

const APP_FEATURES: Array<{ title: string; desc: string; color: string; bg: string; icon: React.ReactNode }> = [
    {
      title: "Daily actions",
      desc: "Small, concrete steps every day — chosen to move your specific numbers.",
      color: "text-[#10B981]",
      bg: "bg-[#10B981]/10",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      title: "Your health coach",
      desc: "A real human in your corner — plans, adjustments, regular reviews, and direct messaging whenever you need guidance.",
      color: "text-blue-600",
      bg: "bg-blue-50",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      title: "Accountability partner",
      desc: "Pair up with a friend or colleague. Shared streaks and gentle nudges — because habits stick faster together.",
      color: "text-amber-600",
      bg: "bg-amber-50",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      title: "Community & events",
      desc: "Join challenges, group sessions, and in-app events with others on the programme.",
      color: "text-fuchsia-600",
      bg: "bg-fuchsia-50",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      title: "Education",
      desc: "Short, evidence-based courses on everything from sleep science to protein targets.",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      title: "Macro tracking, made simple",
      desc: "Seriously advanced under the hood — ridiculously easy to use. Log a meal in seconds; protein, carbs and fat counted for you based on your meal plan.",
      color: "text-[#0D9488]",
      bg: "bg-teal-50",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h13v6M9 17H5a2 2 0 01-2-2v-1a2 2 0 012-2h4m0 5h13M9 11V7a2 2 0 012-2h9a2 2 0 012 2v4M9 11H5M9 11h13" />
          <circle cx="7" cy="17" r="2" strokeWidth={2} />
          <circle cx="18" cy="17" r="2" strokeWidth={2} />
        </svg>
      ),
    },
    {
      title: "Weigh-ins & trends",
      desc: "Weekly weigh-in reminders, body-composition history, and trend lines that matter.",
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M7 14l4-4 4 4 6-6" />
        </svg>
      ),
    },
    {
      title: "Live wearable insights",
      desc: "Connect Apple Watch, Garmin, Fitbit and more. Steps, heart rate, sleep and recovery stream into your plan in real time.",
      color: "text-pink-600",
      bg: "bg-pink-50",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="7" y="5" width="10" height="14" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 2h6M9 22h6M10 12h1.5l1-1.5L14 13l1-2" />
        </svg>
      ),
    },
    {
      title: "Health scores",
      desc: "One score per pillar, zero to one hundred. A single honest number that moves up as your habits stick — so you always know where you stand.",
      color: "text-[#10B981]",
      bg: "bg-[#10B981]/10",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-8 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v13a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13l3-3 3 3 4-4 5 5" />
        </svg>
      ),
    },
];

/**
 * Compact teaser card on /account Home — links to the full Coaching app page
 * where all feature content lives.
 */
// Shown when the user started a booking but hasn't finished paying.
// Mirrors GetStartedHero's look so the dashboard doesn't feel 'reset'.
function ResumeBookingHero({
  pkg, scheduledAt, bookingId, onCancel,
}: {
  pkg: string | null;
  scheduledAt: string | null;
  bookingId: string;
  onCancel: () => void | Promise<void>;
}) {
  const pkgLabel =
    pkg === "foundational" ? "Foundational Health"
      : pkg === "checkin" ? "Check-in"
      : pkg === "self-checkin" ? "Self Check-in"
      : "Your assessment";
  const slotLabel = scheduledAt ? new Date(scheduledAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <section className="relative overflow-hidden rounded-2xl shadow-sm text-white" style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}>
      <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="relative p-8 sm:p-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide">Continue where you left off</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold leading-tight max-w-xl">
          You have an incomplete booking.
        </h2>
        <p className="mt-3 text-base opacity-95 leading-relaxed max-w-xl">
          Your <strong>{pkgLabel}</strong> booking is reserved but hasn&apos;t been paid for yet.
          {slotLabel ? <> Scheduled for <strong>{slotLabel}</strong>.</> : null} Finish the payment to confirm it, or cancel to start over.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/account/book?resume=${bookingId}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#92400E] text-base font-semibold shadow-lg shadow-black/20 hover:shadow-black/30 hover:opacity-95 transition-all"
          >
            Finish booking
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/40 text-white text-sm font-semibold hover:bg-white/10"
          >
            Cancel and start over
          </button>
        </div>
      </div>
    </section>
  );
}

function GetStartedHero() {
  const [showPackages, setShowPackages] = useState(false);
  return (
    <section className="relative overflow-hidden rounded-2xl shadow-sm text-white" style={{ background: "linear-gradient(135deg, #10B981, #0D9488)" }}>
      <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="relative p-8 sm:p-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide">Get started</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold leading-tight max-w-xl">
          Ready to take the first step?
        </h2>
        <p className="mt-3 text-base opacity-95 leading-relaxed max-w-xl">
          Your Lifeline journey begins with the Foundational Health assessment — a 360° snapshot of your body-composition, blood work, and lifestyle, with a doctor-led action plan to take home.
        </p>
        <ul className="mt-5 space-y-2 text-sm text-white/95 max-w-xl">
          {[
            "On-site measurements at a Lifeline station",
            "Targeted blood panel (fasting)",
            "Full health questionnaire",
            "Doctor-reviewed personal report + 1:1 consultation",
          ].map((x) => (
            <li key={x} className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {x}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/account/book"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0F172A] text-base font-semibold shadow-lg shadow-black/20 hover:shadow-black/30 hover:opacity-95 transition-all"
          >
            Book your assessment
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setShowPackages((v) => !v)}
            aria-expanded={showPackages}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/40 text-white text-sm font-semibold hover:bg-white/10"
          >
            {showPackages ? "Hide packages" : "Compare packages"}
            <svg className={`w-4 h-4 transition-transform ${showPackages ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Packages dropdown — mirrors /account/book package cards */}
        {showPackages && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            {ASSESSMENT_PACKAGES.map((pkg) => (
              <div key={pkg.key} className="rounded-xl bg-white text-gray-900 shadow-sm overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${pkg.accent}`} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={`text-[10px] font-semibold uppercase tracking-wider ${pkg.dot}`}>{pkg.tag}</div>
                      <h3 className="text-base font-bold text-[#0F172A] mt-0.5">{pkg.name}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#0F172A] whitespace-nowrap">{formatPackagePrice(pkg.priceIsk)}</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">{pkg.summary}</p>
                  <ul className="mt-3 space-y-1.5">
                    {pkg.includes.map((inc) => (
                      <li key={inc} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <svg className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${pkg.dot}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/account/book?pkg=${pkg.key}`}
                    className={`mt-4 inline-flex items-center justify-center w-full gap-1 py-2 rounded-lg text-white text-xs font-semibold bg-gradient-to-r ${pkg.accent} hover:opacity-95`}
                  >
                    Choose this package
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ServicesSection({
  companyName, onGoToCoaching,
}: {
  companyName: string | null;
  onGoToCoaching: () => void;
}) {
  const packages: Array<{ name: string; tag: string; price: string; unit: string; desc: string; includes: string[]; accent: string; tone: string; dot: string; cta: string; href: string }> = [
    {
      name: "Foundational Health",
      tag: "Full programme",
      price: "49,900",
      unit: "ISK",
      desc: "The full measurement round — great for family members, or a fresh baseline outside the company programme.",
      includes: [
        "On-site measurements — blood pressure, body composition",
        "Targeted blood panel",
        "Full health questionnaire",
        "Doctor-reviewed personal report",
        "1:1 doctor consultation + action plan",
      ],
      accent: "from-[#3B82F6] to-[#10B981]",
      tone: "border-blue-100 bg-blue-50/40",
      dot: "text-[#3B82F6]",
      cta: "Book assessment",
      href: "/account/book",
    },
    {
      name: "Check-in",
      tag: "Follow-up",
      price: "19,900",
      unit: "ISK",
      desc: "A lighter round 3–12 months after the foundational — see what changed and refresh your action plan.",
      includes: [
        "On-site measurements",
        "Progress report vs baseline",
        "Updated health score",
        "Brief doctor review",
        "Refreshed action plan",
      ],
      accent: "from-[#10B981] to-[#14B8A6]",
      tone: "border-emerald-100 bg-emerald-50/40",
      dot: "text-[#10B981]",
      cta: "Book check-in",
      href: "/account/book",
    },
    {
      name: "Self Check-in",
      tag: "Free",
      price: "0",
      unit: "ISK",
      desc: "A self-guided online questionnaire you can rerun any time to track your own progress through the year.",
      includes: [
        "Online health questionnaire",
        "Self-reported metrics you control",
        "Updated personal health score",
        "Instant, private insight",
        "If something flags, Lifeline reaches out",
      ],
      accent: "from-[#8B5CF6] to-[#0EA5E9]",
      tone: "border-violet-100 bg-violet-50/40",
      dot: "text-[#8B5CF6]",
      cta: "Start now",
      href: "/account/book",
    },
  ];

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-semibold uppercase tracking-wide mb-3">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Book services
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] leading-tight">
          {companyName ? "Add to what your company covered" : "Your Lifeline services"}
        </h2>
        <p className="text-base text-[#475569] mt-3 leading-relaxed max-w-2xl">
          {companyName
            ? `${companyName} has already covered your Foundational Health assessment. Everything below is optional and personally billed — perfect for family members, mid-year check-ins, or ongoing coaching.`
            : "Start with a Foundational Health assessment, then layer check-ins and the coaching app as you go. All personally billed — mix and match what fits you."}
        </p>
      </div>

      {/* Assessment packages */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3 px-1">Assessment packages</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {packages.map((p) => (
            <div key={p.name} className={`relative overflow-hidden rounded-2xl border ${p.tone} bg-white shadow-sm flex flex-col`}>
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${p.accent}`} />
              <div className="p-6 flex-1 flex flex-col">
                <div className="inline-flex items-center self-start px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 mb-3">{p.tag}</div>
                <h3 className="text-lg font-bold text-[#0F172A]">{p.name}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#0F172A]">{p.price === "0" ? "Free" : p.price}</span>
                  {p.price !== "0" && <span className="text-xs font-medium text-[#64748B]">{p.unit} · one-time</span>}
                </div>
                <p className="text-sm text-[#475569] mt-2 leading-relaxed">{p.desc}</p>
                <ul className="mt-4 space-y-1.5 flex-1">
                  {p.includes.map((x) => (
                    <li key={x} className="flex items-start gap-2 text-sm text-[#334155]">
                      <svg className={`w-4 h-4 mt-0.5 shrink-0 ${p.dot}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {x}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`mt-5 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r ${p.accent} hover:opacity-95 shadow-sm`}
                >
                  {p.cta}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coaching app teaser */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] via-[#0D9488] to-[#8B5CF6]" />
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#3B82F6] mb-1">Coming soon</div>
              <h3 className="text-xl font-bold text-[#0F172A]">The Lifeline coaching app</h3>
              <p className="text-sm text-[#475569] mt-2 leading-relaxed max-w-2xl">
                Daily actions, a health coach, community, education and advanced macro tracking — available on three tiers. Turns your assessment into habits that actually stick.
              </p>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: "Free", sub: "community + education" },
                  { label: "Self-maintained", sub: "full app tools" },
                  { label: "Premium", sub: "personal coach" },
                ].map((row) => (
                  <div key={row.label} className="rounded-lg border border-gray-100 bg-[#f8fafc] px-3 py-2 text-sm">
                    <div className="font-semibold text-[#0F172A]">{row.label}</div>
                    <div className="text-xs text-[#64748B]">{row.sub}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={onGoToCoaching}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95 shadow-sm"
              >
                See the Lifeline app
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="rounded-2xl border border-dashed border-gray-200 bg-[#f8fafc] p-6 text-center">
        <p className="text-sm text-[#475569]">
          Need something custom, or have a question? Email us at{" "}
          <a href="mailto:contact@lifelinehealth.is" className="font-semibold text-[#10B981] hover:underline">
            contact@lifelinehealth.is
          </a>
        </p>
      </div>
    </section>
  );
}


function AppTeaserCard({ onGoToCoaching }: { onGoToCoaching: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-2xl shadow-sm bg-white">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] via-[#0D9488] to-[#8B5CF6]" />
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-1">After your assessment</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937] leading-tight">Keep building health with the Lifeline app</h2>
            <p className="text-sm text-[#6B7280] mt-2 leading-relaxed max-w-xl">
              Your report is the starting line. The app is how you move — every day, across all four pillars of health.
            </p>
            <ul className="text-sm text-[#4B5563] mt-3 space-y-1.5 list-disc list-inside">
              <li>Daily actions personalised to your results</li>
              <li>Your own health coach, in your pocket</li>
              <li>Accountability partner, community &amp; events</li>
              <li>Advanced macro tracking, made ridiculously simple</li>
            </ul>
            <div className="mt-5">
              <button
                type="button"
                onClick={onGoToCoaching}
                className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981] text-white text-base font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:opacity-95 transition-all group"
              >
                Explore the coaching app
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Full "What's inside the app" block used on the Coaching app page.
 * Combines the feature grid + four pillars + download row.
 */
function AppFeaturesBlock() {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-[#1F2937]">What&apos;s inside the app</h2>
        <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
          The app turns your report into daily actions across sleep, exercise, nutrition, and mental wellbeing — with a coach, community, and education built in.
        </p>
        <p className="text-sm font-semibold text-[#1F2937] mt-2">The only health and lifestyle app you&apos;ll ever need.</p>
      </div>

      {/* Feature grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {APP_FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-gray-100 bg-[#f8fafc] p-4 hover:shadow-sm transition-shadow">
            <div className={`w-9 h-9 rounded-lg ${f.bg} ${f.color} flex items-center justify-center mb-2`}>
              {f.icon}
            </div>
            <div className="font-semibold text-gray-900">{f.title}</div>
            <p className="text-sm text-[#6B7280] mt-1 leading-snug">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Personalised programs → four pillars */}
      <section className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-[#f5f7fb] via-white to-white shadow-sm mt-6">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] via-[#0D9488] via-[#8B5CF6] to-[#06B6D4]" />
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3B82F6] via-[#0D9488] to-[#8B5CF6] text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#3B82F6] mb-1">Personalised programs</div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#1F2937] leading-tight">Drive improvements across the four pillars</h3>
              <p className="text-sm text-[#6B7280] mt-2 leading-relaxed max-w-2xl">
                Strength, cardio, mobility, and mindfulness programs built around your level and your physician&apos;s plan. Made for real life, for real people — home and gym versions of every program, so you can train wherever you are.
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {APP_PILLARS.map((p) => (
              <div key={p.title} className={`rounded-xl border ${p.border} ${p.bg} p-3`}>
                <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center mb-2 ${p.color}`}>
                  {p.icon}
                </div>
                <div className={`font-semibold ${p.color}`}>{p.title}</div>
                <p className="text-xs text-[#4B5563] mt-1 leading-snug">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </section>
  );
}

function DownloadAppHero() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "account-coaching" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Could not subscribe. Try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
      setEmail("");
    } catch {
      setError("Could not subscribe. Try again.");
      setStatus("error");
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl shadow-sm bg-white">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] to-[#10B981]" />
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Coming soon
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937] leading-tight">The Lifeline app is on the way</h2>
            <p className="text-sm text-[#6B7280] mt-2 leading-relaxed max-w-xl">
              We&apos;re in final testing on iPhone and Android. Drop your email and we&apos;ll send you the download link the day it drops — along with anything worth knowing in the lead-up.
            </p>
            {status === "success" ? (
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Thanks — you&apos;re on the list.
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-lg">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={status === "submitting"}
                  className="flex-1 px-4 py-3 rounded-full border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981] text-white text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 whitespace-nowrap"
                >
                  {status === "submitting" ? "…" : "Notify me"}
                </button>
              </form>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <p className="mt-4 text-xs text-[#9CA3AF]">Available soon on iPhone and Android — App Store and Google Play.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WellbeingPromptCard({ lastWellbeingAt, onStart }: { lastWellbeingAt: string | null; onStart: () => void }) {
  const daysSince = lastWellbeingAt
    ? Math.floor((Date.now() - new Date(lastWellbeingAt).getTime()) / 86_400_000)
    : null;
  // Show if never done OR last done >30 days ago.
  const shouldShow = daysSince == null || daysSince >= 30;
  if (!shouldShow) return null;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-6 sm:p-8 shadow-sm">
      <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">
            {lastWellbeingAt ? "Monthly wellbeing check-in" : "Share a quick wellbeing check-in"}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Five questions, 30 seconds. Helps us see how you feel over time — your answers stay private, your company sees only anonymised group trends (min 5 people).
          </p>
          <button onClick={onStart} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-emerald-500 to-teal-500 hover:opacity-90">
            Start check-in
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

function SatisfactionPromptCard({
  bodyCompStatus, myDoctorSlot, satisfactionDone, onStart,
}: {
  bodyCompStatus: "none" | "booked" | "completed";
  myDoctorSlot: { slot_at: string } | null;
  satisfactionDone: Record<"body_comp" | "doctor" | "overall", boolean>;
  onStart: (ctx: "body_comp" | "doctor" | "overall") => void;
}) {
  const bcReady = bodyCompStatus === "completed" && !satisfactionDone.body_comp;
  const drReady = myDoctorSlot != null && new Date(myDoctorSlot.slot_at).getTime() < Date.now() && !satisfactionDone.doctor;
  if (!bcReady && !drReady) return null;
  const pending: Array<{ key: "body_comp" | "doctor"; title: string; sub: string }> = [];
  if (bcReady) pending.push({ key: "body_comp", title: "How was the body-composition scan?", sub: "30-second survey — 2 quick questions + an optional comment." });
  if (drReady) pending.push({ key: "doctor", title: "How was your doctor consultation?", sub: "30-second survey — 2 quick questions + an optional comment." });
  return (
    <div className="space-y-3">
      {pending.map((p) => (
        <section key={p.key} className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5 shadow-sm">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-400" />
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900">{p.title}</h3>
              <p className="text-sm text-gray-600 mt-0.5">{p.sub}</p>
              <button onClick={() => onStart(p.key)} className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-br from-blue-600 to-cyan-500 hover:opacity-90">
                Give feedback
              </button>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

