// Encrypted free-text on journeys and referrals. Server-only.
//
// hc_journeys.interview_notes / followup_notes / doctor_review_note /
// referral_note and hc_referrals.note / reason are stored encrypted
// (supabase/migration-hc-medalia-split.sql). A BEFORE trigger moves anything
// written to the plaintext columns into the *_enc column and nulls the
// plaintext, so writing is an ordinary update; reading goes through the
// service-role-only hc_journey_notes() RPC and hc_referrals_decrypted view.
//
// Interview notes are LIFESTYLE notes for the plan (sleep, exercise, food,
// mind, goals). Clinical content belongs in Medalia, not here.
//
// Every helper here degrades instead of throwing: if the migration has not
// run, the plaintext columns are still read as before.

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { InterviewNotes } from "./types";

export interface JourneyNotes {
  interview_notes: InterviewNotes | null;
  followup_notes: InterviewNotes | null;
  doctor_review_note: string | null;
  referral_note: string | null;
}

export type JourneyNoteField = keyof JourneyNotes;

/** Drop the ciphertext columns before a row leaves the server. */
export function stripCiphertext<T extends object>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!k.endsWith("_enc")) out[k] = v;
  return out as T;
}

/** Decrypted notes for many journeys at once. Empty map on any failure. */
export async function loadJourneyNotes(ids: string[]): Promise<Map<string, JourneyNotes>> {
  const map = new Map<string, JourneyNotes>();
  if (!ids.length) return map;
  const { data, error } = await supabaseAdmin.rpc("hc_journey_notes", { p_ids: ids });
  if (error || !Array.isArray(data)) return map;
  for (const r of data as (JourneyNotes & { id: string })[]) {
    map.set(r.id, {
      interview_notes: r.interview_notes ?? null,
      followup_notes: r.followup_notes ?? null,
      doctor_review_note: r.doctor_review_note ?? null,
      referral_note: r.referral_note ?? null,
    });
  }
  return map;
}

/**
 * A journey row with its notes decrypted in place and the ciphertext gone —
 * the shape the workstation has always read (j.interview_notes etc.).
 */
export async function withJourneyNotes<T extends { id: string }>(j: T): Promise<T & JourneyNotes> {
  const notes = (await loadJourneyNotes([j.id])).get(j.id);
  const row = stripCiphertext(j) as T & Partial<JourneyNotes>;
  return {
    ...row,
    interview_notes: notes?.interview_notes ?? row.interview_notes ?? null,
    followup_notes: notes?.followup_notes ?? row.followup_notes ?? null,
    doctor_review_note: notes?.doctor_review_note ?? row.doctor_review_note ?? null,
    referral_note: notes?.referral_note ?? row.referral_note ?? null,
  };
}

/**
 * Write one note. The trigger encrypts it on the way in. An empty value
 * clears the stored ciphertext (a NULL write would leave it alone).
 */
export async function saveJourneyNote(journeyId: string, field: JourneyNoteField, value: InterviewNotes | string | null): Promise<string | null> {
  const empty = value == null || (typeof value === "string" ? !value.trim() : !Object.values(value).some((v) => typeof v === "string" && v.trim()));
  if (empty) {
    const { error } = await supabaseAdmin.rpc("hc_journey_clear_note", { p_id: journeyId, p_field: field });
    if (!error) {
      await supabaseAdmin.from("hc_journeys").update({ updated_at: new Date().toISOString() }).eq("id", journeyId);
      return null;
    }
    // Pre-migration fallback: the plaintext column is the only store.
    const { error: e2 } = await supabaseAdmin.from("hc_journeys")
      .update({ [field]: field.endsWith("_notes") ? {} : null, updated_at: new Date().toISOString() }).eq("id", journeyId);
    return e2?.message ?? null;
  }
  const { error } = await supabaseAdmin.from("hc_journeys")
    .update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", journeyId);
  return error?.message ?? null;
}

/** Referrals for a journey with reason/note decrypted. */
export async function loadReferrals(filter: { journeyId?: string; ids?: string[] }): Promise<Record<string, unknown>[]> {
  const run = (table: string) => {
    let q = supabaseAdmin.from(table).select("*");
    if (filter.journeyId) q = q.eq("journey_id", filter.journeyId);
    if (filter.ids) q = q.in("id", filter.ids);
    return q.order("created_at", { ascending: false });
  };
  const { data, error } = await run("hc_referrals_decrypted");
  if (!error) return (data ?? []) as Record<string, unknown>[];
  const { data: plain } = await run("hc_referrals");
  return ((plain ?? []) as Record<string, unknown>[]).map(stripCiphertext);
}
