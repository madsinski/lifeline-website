"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import ScheduleBodyComp from "./ScheduleBodyComp";
import ScheduleBloodTests from "./ScheduleBloodTests";

interface Props {
  companyId: string;
  memberCount: number;
  completedCount: number;
  onChanged?: () => void;
}

interface BodyCompEvent {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  room_notes: string | null;
  slot_minutes: number;
  slot_capacity: number;
  status: string;
}

interface BloodTestDay {
  id: string;
  day: string;
  notes: string | null;
}

export default function OnboardingChecklist({ companyId, memberCount, completedCount, onChanged }: Props) {
  const { t } = useI18n();
  const [events, setEvents] = useState<BodyCompEvent[]>([]);
  const [bloodDays, setBloodDays] = useState<BloodTestDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleBC, setShowScheduleBC] = useState(false);
  const [showScheduleBlood, setShowScheduleBlood] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ev, bd] = await Promise.all([
      supabase.from("body_comp_events")
        .select("id, event_date, start_time, end_time, location, room_notes, slot_minutes, slot_capacity, status")
        .eq("company_id", companyId)
        .gte("event_date", new Date().toISOString().slice(0, 10))
        .order("event_date"),
      supabase.from("blood_test_days")
        .select("id, day, notes")
        .eq("company_id", companyId)
        .gte("day", new Date().toISOString().slice(0, 10))
        .order("day"),
    ]);
    setEvents((ev.data || []) as BodyCompEvent[]);
    setBloodDays((bd.data || []) as BloodTestDay[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const onStepChange = () => {
    load();
    onChanged?.();
  };

  const hasRoster = memberCount > 0;
  const rosterDone = memberCount > 0 && completedCount >= memberCount;
  const hasBodyComp = events.length > 0;
  const hasBloodDays = bloodDays.length > 0;

  const allDone = rosterDone && hasBodyComp && hasBloodDays;
  const stepsDone = [rosterDone, hasBodyComp, hasBloodDays].filter(Boolean).length;

  if (loading) return null;

  return (
    <section className={`rounded-2xl overflow-hidden shadow-sm ${allDone ? "bg-emerald-50 border border-emerald-100" : "bg-white"}`}>
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {allDone
                ? t("b2b.checklist.done_title", "Everything is set up. You're good to go.")
                : t("b2b.checklist.title", "Get your company up and running")}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {allDone
                ? t("b2b.checklist.done_subtitle", "Your employees can now book scans and blood tests.")
                : t("b2b.checklist.subtitle", "Three quick steps so employees can start their health programme.")}
            </p>
          </div>
          {!allDone && (
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold text-blue-600">{stepsDone}<span className="text-gray-400">/3</span></div>
              <div className="text-xs text-gray-500">{t("b2b.checklist.done_count", "done")}</div>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        <Step
          n={1}
          done={hasRoster}
          primary={!hasRoster}
          title={t("b2b.checklist.step1.title", "Register your employees")}
          body={
            hasRoster
              ? t("b2b.checklist.step1.progress", "{{total}} on roster · {{done}} completed onboarding").replace("{{total}}", String(memberCount)).replace("{{done}}", String(completedCount))
              : t("b2b.checklist.step1.body", "Add employee names, kennitala, email and phone. They each get an email invite to set up their Lifeline account.")
          }
          ctaLabel={hasRoster ? t("b2b.checklist.step1.cta_add", "Add more") : t("b2b.checklist.step1.cta", "Add employees")}
          onCta={() => document.getElementById("add-employees-section")?.scrollIntoView({ behavior: "smooth" })}
        />

        <Step
          n={2}
          done={hasBodyComp}
          primary={hasRoster && !hasBodyComp}
          title={t("b2b.checklist.step2.title", "Schedule the body-composition day")}
          body={
            hasBodyComp
              ? events.map((e) => `${new Date(e.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} · ${e.start_time.slice(0,5)}–${e.end_time.slice(0,5)}`).join(" · ")
              : t("b2b.checklist.step2.body", "Our Lifeline nurse travels to your office with the body-composition scanner. Pick a day and time window, and each employee books a 5-minute slot.")
          }
          ctaLabel={hasBodyComp ? t("b2b.checklist.step2.cta_add", "Schedule another") : t("b2b.checklist.step2.cta", "Schedule visit")}
          onCta={() => setShowScheduleBC(true)}
          extra={
            !hasBodyComp && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-900">
                <div className="font-semibold mb-1">{t("b2b.checklist.step2.req_title", "You'll need to provide:")}</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>{t("b2b.checklist.step2.req_room", "A private room at your office")}</li>
                  <li>{t("b2b.checklist.step2.req_screens", "A computer with two screens")}</li>
                  <li>{t("b2b.checklist.step2.req_quiet", "Quiet, private space for each 5-minute measurement")}</li>
                </ul>
              </div>
            )
          }
        />

        <Step
          n={3}
          done={hasBloodDays}
          primary={hasBodyComp && !hasBloodDays}
          title={t("b2b.checklist.step3.title", "Pick blood-test days")}
          body={
            hasBloodDays
              ? bloodDays.map((d) => new Date(d.day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })).join(" · ")
              : t("b2b.checklist.step3.body", "Blood tests happen at Sameind, 08:00–12:00. Pick the days when your employees are allowed to leave work to go in. They get the booking link via email.")
          }
          ctaLabel={hasBloodDays ? t("b2b.checklist.step3.cta_add", "Add more days") : t("b2b.checklist.step3.cta", "Pick days")}
          onCta={() => setShowScheduleBlood(true)}
        />
      </div>

      {showScheduleBC && (
        <ScheduleBodyComp
          companyId={companyId}
          onClose={() => setShowScheduleBC(false)}
          onCreated={() => { setShowScheduleBC(false); onStepChange(); }}
        />
      )}
      {showScheduleBlood && (
        <ScheduleBloodTests
          companyId={companyId}
          existing={bloodDays}
          onClose={() => setShowScheduleBlood(false)}
          onCreated={() => { setShowScheduleBlood(false); onStepChange(); }}
        />
      )}
    </section>
  );
}

function Step({
  n, done, primary, title, body, ctaLabel, onCta, extra,
}: {
  n: number;
  done: boolean;
  primary: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`p-5 flex items-start gap-4 ${primary ? "bg-blue-50/40" : ""}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
        done ? "bg-emerald-100 text-emerald-700" : primary ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
      }`}>
        {done ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
          </svg>
        ) : n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className={`font-semibold ${done ? "text-gray-500" : "text-gray-900"}`}>{title}</h3>
          <button
            onClick={onCta}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg shrink-0 ${
              done
                ? "text-gray-600 bg-white border border-gray-200 hover:border-gray-300"
                : "text-white bg-gradient-to-br from-blue-600 to-emerald-500 hover:opacity-90"
            }`}
          >
            {ctaLabel}
          </button>
        </div>
        <p className={`text-sm mt-1 ${done ? "text-emerald-700" : "text-gray-600"}`}>{body}</p>
        {extra}
      </div>
    </div>
  );
}
