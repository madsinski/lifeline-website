"use client";

// Admin onboarding bench. Three panels:
//   1. Step catalog       — what the app currently asks, in order
//   2. Completion funnel  — total clients vs. completed onboarding
//   3. Per-user inspector — pick a client by email, see the full
//      payload they submitted (onboarding_data + exercise_profile +
//      pillar levels). Useful for replaying support tickets and
//      sanity-checking the seed → level mapping.
//
// The step catalog is hand-maintained — onboarding is JSX-driven
// in the RN app, not data-driven, so the source of truth is the
// app code. Kept here in sync until we extract steps to a shared
// schema. The "Last verified" date marks the last manual review.

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const STEP_CATALOG_VERIFIED = "2026-05-16";  // Phase 2-6 onboarding additions

interface CatalogStep {
  step: number;
  name: string;
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "select" | "scale" | "multi" | "boolean" | "date";
    required: boolean;
    notes?: string;
  }>;
  notes?: string;
}

const ONBOARDING_CATALOG: CatalogStep[] = [
  {
    step: 0,
    name: "Welcome slideshow",
    fields: [],
    notes: "Full-screen horizontal pager. No data captured.",
  },
  {
    step: 1,
    name: "Personal info",
    fields: [
      { key: "firstName", label: "First name", type: "text", required: true },
      { key: "lastName", label: "Last name", type: "text", required: true },
      { key: "dateOfBirth", label: "Date of birth", type: "date", required: true },
      { key: "sex", label: "Sex", type: "select", required: true, notes: "male / female / other / prefer_not_to_say" },
      { key: "phone", label: "Phone", type: "text", required: false },
      { key: "address", label: "Address", type: "text", required: false },
      { key: "suburb", label: "Suburb / area", type: "text", required: false, notes: "Auto-parsed from address" },
      { key: "country", label: "Country", type: "select", required: true, notes: "Defaults to 'is'. Drives international vs Iceland routing." },
      { key: "emergencyName", label: "Emergency contact name", type: "text", required: false },
      { key: "emergencyPhone", label: "Emergency contact phone", type: "text", required: false },
      { key: "activityLevel", label: "Activity level", type: "select", required: true, notes: "beginner / intermediate / advanced — seeds exercise pillar level" },
      { key: "profilePhoto", label: "Profile photo / avatar", type: "text", required: false, notes: "URL or avatar: key" },
      { key: "acceptedTerms", label: "Terms accepted", type: "boolean", required: true },
    ],
  },
  {
    step: 2,
    name: "Training setup + pillar self-assessment",
    fields: [
      { key: "setting", label: "Where do you train", type: "select", required: true, notes: "gym / home / hybrid" },
      { key: "homeEquipment", label: "Equipment at home", type: "multi", required: false, notes: "Bodyweight implicit" },
      { key: "daysPerWeek", label: "Days per week", type: "scale", required: true, notes: "1–7" },
      { key: "sessionMinutes", label: "Session length", type: "select", required: true, notes: "15 / 20 / 30 / 45 / 60 / 75 / 90" },
      { key: "primaryGoals", label: "Primary goals", type: "multi", required: true },
      { key: "sleepQuality", label: "Sleep quality", type: "scale", required: false, notes: "1–10. Seeds sleep pillar level." },
      { key: "shiftWork", label: "I work shifts", type: "boolean", required: false },
      { key: "eatingPattern", label: "Eating pattern", type: "select", required: false, notes: "fast_food / mixed / cooks_most_days / tracks_macros. Seeds nutrition." },
      { key: "stressScore", label: "Stress level", type: "scale", required: false, notes: "1–10. Seeds mental level." },
      { key: "existingPractice", label: "Already meditate/journal", type: "boolean", required: false },
    ],
  },
  {
    step: 3,
    name: "Health limitations",
    fields: [
      { key: "allergies", label: "Food allergies", type: "multi", required: false, notes: "9 common allergens + dairy/lactose, gluten, soy, fish, sesame" },
      { key: "chronicConditions", label: "Dietary prefs + chronic conditions", type: "multi", required: false, notes: "Vegan / Vegetarian / Halal / Kosher + Asthma, Diabetes, Pregnancy, Recent surgery, Heart condition" },
      { key: "mskIssues", label: "Joint / movement limitations", type: "multi", required: false, notes: "Knees, lower back, shoulders, hips, wrists, ankles, etc. Drives program filtering." },
      { key: "limitationsNotes", label: "Anything else", type: "text", required: false, notes: "Free-text — fed to AI recommendation" },
    ],
    notes: "All fields optional. Persisted to clients.onboarding_data.limitations.",
  },
  {
    step: 4,
    name: "Connections + optional lab import",
    fields: [
      { key: "googleCalendarConnected", label: "Google Calendar", type: "boolean", required: false },
      { key: "healthConnectConnected", label: "Health Connect", type: "boolean", required: false },
      { key: "importedPanels", label: "Lab panels imported (intl only)", type: "scale", required: false, notes: "AI photo import via /api/health/parse-lab-report — international users only, saves to local SQLite" },
    ],
    notes: "International users see an extra 'Have recent lab results?' card. AI imports save locally on device, never to Supabase.",
  },
  {
    step: 5,
    name: "AI program recommendation",
    fields: [
      { key: "programPicks.exercise", label: "Exercise program pick", type: "select", required: false, notes: "AI suggests + 2 alternatives. User can override per pillar." },
      { key: "programPicks.nutrition", label: "Nutrition program pick", type: "select", required: false },
      { key: "programPicks.sleep", label: "Sleep program pick", type: "select", required: false },
      { key: "programPicks.mental", label: "Mental program pick", type: "select", required: false },
    ],
    notes: "Auto-fetches /api/onboarding/recommend-programs on arrival. User taps 'Use this plan' OR skips for manual selection later. Picks land on onboarding_data.programPicks.",
  },
  {
    step: 6,
    name: "Friends — share-sheet primary",
    fields: [],
    notes: "Native share-sheet (primary) → copy-link (secondary) → search existing Lifeline users (tertiary). No email-invite form, no Facebook. No persisted data here.",
  },
  {
    step: 7,
    name: "Finishing",
    fields: [],
    notes: "CTA to complete. On submit: clients row upsert, exercise_profile, onboarding_data (incl. limitations + programPicks), country, pillar levels seeded.",
  },
];

interface ClientRow {
  id: string;
  email: string | null;
  full_name: string | null;
  onboarding_complete: boolean | null;
  onboarding_data: any | null;
  exercise_profile: any | null;
  created_at: string;
}

interface PillarLevelRow {
  pillar: string;
  level: string;
  source: string;
  set_at: string;
  note: string | null;
}

export default function OnboardingBenchPage() {
  const [counts, setCounts] = useState<{ total: number; completed: number; last30: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClientRow[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [pillarLevels, setPillarLevels] = useState<PillarLevelRow[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Funnel numbers
  useEffect(() => {
    (async () => {
      try {
        const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
        const [{ count: total }, { count: completed }, { count: last30 }] = await Promise.all([
          supabase.from("clients_decrypted").select("*", { count: "exact", head: true }),
          supabase.from("clients_decrypted").select("*", { count: "exact", head: true }).eq("onboarding_complete", true),
          supabase.from("clients_decrypted").select("*", { count: "exact", head: true }).eq("onboarding_complete", true).gte("created_at", since30),
        ]);
        setCounts({ total: total ?? 0, completed: completed ?? 0, last30: last30 ?? 0 });
      } catch (e) {
        console.log("[bench] funnel error", e);
      }
    })();
  }, []);

  // Debounced client search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const q = searchQuery.trim();
        const { data } = await supabase
          .from("clients_decrypted")
          .select("id, email, full_name, onboarding_complete, onboarding_data, exercise_profile, created_at")
          .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
          .limit(10);
        setSearchResults((data ?? []) as ClientRow[]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const pickClient = useCallback(async (c: ClientRow) => {
    setSelectedClient(c);
    setPillarLevels(null);
    try {
      const { data } = await supabase
        .from("client_pillar_levels")
        .select("pillar, level, source, set_at, note")
        .eq("client_id", c.id);
      setPillarLevels((data ?? []) as PillarLevelRow[]);
    } catch {
      setPillarLevels([]);
    }
  }, []);

  const completionPct = useMemo(() => {
    if (!counts || counts.total === 0) return 0;
    return Math.round((counts.completed / counts.total) * 100);
  }, [counts]);

  return (
    <div className="px-8 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Onboarding bench</h1>
        <p className="text-sm text-gray-500">
          Step catalog, completion analytics, and per-user inspector. Walk the live flow in the app via{" "}
          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">Settings → Developer / QA → Onboarding bench (test run)</span>.
        </p>
      </div>

      {/* Funnel */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Completion</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Stat label="Total clients" value={counts?.total ?? "—"} />
          <Stat label="Completed onboarding" value={counts?.completed ?? "—"} sub={counts ? `${completionPct}%` : undefined} />
          <Stat label="Completed (last 30d)" value={counts?.last30 ?? "—"} />
          <Stat label="Steps in catalog" value={ONBOARDING_CATALOG.length} sub={`verified ${STEP_CATALOG_VERIFIED}`} />
        </div>
      </section>

      {/* Step catalog */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Step catalog</h2>
        <div className="space-y-3">
          {ONBOARDING_CATALOG.map((s) => (
            <div key={s.step} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                  {s.step}
                </div>
                <h3 className="text-sm font-bold text-gray-900">{s.name}</h3>
                <span className="text-xs text-gray-500">· {s.fields.length} field{s.fields.length === 1 ? "" : "s"}</span>
              </div>
              {s.notes && <p className="text-xs text-gray-500 italic mb-3 ml-10">{s.notes}</p>}
              {s.fields.length > 0 && (
                <div className="ml-10 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {s.fields.map((f) => (
                    <div key={f.key} className="flex items-baseline gap-2 text-xs">
                      <span className={`font-medium ${f.required ? "text-gray-900" : "text-gray-500"}`}>{f.label}</span>
                      {f.required && <span className="text-red-500">*</span>}
                      <span className="text-gray-400">·</span>
                      <span className="font-mono text-[10px] text-gray-500">{f.type}</span>
                      {f.notes && <span className="text-gray-400 text-[10px] italic">— {f.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Per-user inspector */}
      <section>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Per-user inspector</h2>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by email or name…"
          className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3"
        />
        {searching && <div className="text-xs text-gray-400 mb-2">Searching…</div>}
        {searchResults.length > 0 && !selectedClient && (
          <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 max-w-md mb-3">
            {searchResults.map((c) => (
              <button
                key={c.id}
                onClick={() => pickClient(c)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
              >
                <div className="font-medium text-gray-900">{c.full_name || "(no name)"}</div>
                <div className="text-xs text-gray-500">{c.email || "(no email)"} · {c.onboarding_complete ? "onboarded" : "incomplete"}</div>
              </button>
            ))}
          </div>
        )}
        {selectedClient && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-bold text-gray-900">{selectedClient.full_name || "(no name)"}</div>
                <div className="text-xs text-gray-500">{selectedClient.email} · joined {new Date(selectedClient.created_at).toLocaleDateString()}</div>
              </div>
              <button
                onClick={() => { setSelectedClient(null); setSearchQuery(""); setSearchResults([]); setPillarLevels(null); }}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>

            <Detail title="Onboarding status" value={selectedClient.onboarding_complete ? "Complete" : "Incomplete"} />

            {pillarLevels && pillarLevels.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Seeded pillar levels</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pillarLevels.map((p) => (
                    <div key={p.pillar} className="border border-gray-200 rounded-lg p-2.5 text-xs">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-gray-900 capitalize">{p.pillar}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                          {p.level}
                        </span>
                      </div>
                      <div className="text-gray-500 mt-1">via {p.source}</div>
                      {p.note && <div className="text-gray-400 italic mt-1">"{p.note}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedClient.onboarding_data && (
              <div className="mt-4">
                <div className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">onboarding_data</div>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[10px] overflow-x-auto leading-relaxed">
                  {JSON.stringify(selectedClient.onboarding_data, null, 2)}
                </pre>
              </div>
            )}
            {selectedClient.exercise_profile && (
              <div className="mt-4">
                <div className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">exercise_profile</div>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[10px] overflow-x-auto leading-relaxed">
                  {JSON.stringify(selectedClient.exercise_profile, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Detail({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="text-xs font-bold text-gray-600 uppercase tracking-wide w-32">{title}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
