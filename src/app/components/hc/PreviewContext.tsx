"use client";

// "This is somebody else's screen, shown to staff."
//
// CoachAsClient renders the participant's own components (MyActions,
// TrainingView, NutritionView …) so the coach sees exactly what the client
// sees. Most of their writes go through `api` and CoachAsClient maps those to
// the journey's as-client route — those land on the client's journey and are
// audited to the coach, which is the point.
//
// A few components write straight to Supabase from the browser instead
// (meal_log in useDayMeals, set_logs in WorkoutRunner). Those use the
// SIGNED-IN user's id, and on the workstation that is the staff member — so
// a tick in the preview would have logged a meal or a set in the coach's own
// diary. Inside <PreviewProvider> those paths do not read or write at all,
// and the controls say so instead.
//
// Outside a provider usePreview() is false, so participant pages are
// unaffected.

import { createContext, useContext } from "react";

export const PREVIEW_NOTE = "Forskoðun — hér er ekkert vistað";

const PreviewContext = createContext(false);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  return <PreviewContext.Provider value>{children}</PreviewContext.Provider>;
}

/** True when rendered inside a staff preview of a participant's screen. */
export function usePreview(): boolean {
  return useContext(PreviewContext);
}

/** The one-line note shown in place of a control that would write. */
export function PreviewNote({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-xl bg-hc-sunken p-3 text-sm text-hc-ink-2 ${className}`} role="note">
      {PREVIEW_NOTE}
    </p>
  );
}
