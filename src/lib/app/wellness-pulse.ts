// Wellness pulse — the Lífstílseinkunn question bank and scoring.
//
// COPIED VERBATIM from fhir-health-dashboard/src/lib/wellnessPulse.ts
// (789 lines, zero imports — it is pure computation, so it ports as-is).
// Copied rather than retyped on purpose: 29 questions with scored options
// is exactly the kind of thing hand-transcription gets subtly wrong, and a
// wrong score here is a wrong health number shown to a person.
//
// Keep in sync with the app. If the two ever disagree, the app is the source
// of truth — it is where the score was designed.
//
// ─────────────────────────────────────────────────────────────────────

// Wellness Pulse — Lifeline's monthly self-assessment.
//
// 23 questions across 5 pillars (Sleep / Exercise / Nutrition / Andleg /
// Ávanabindandi). 15 are reused habit questions from Heilsumat (each
// tagged with its `heilsumatLinkId` for traceability with Medalia); 8
// are Lifeline-authored to avoid implementing validated clinical
// instruments (PHQ-9, PSS-10, AUDIT etc.) in the consumer app.
//
// The pulse score is unambiguously a wellness/lifestyle metric. The
// app deliberately does NOT compute or display PHQ-9, GAD-7, AUDIT,
// SCORE2, or any validated screening instrument — those stay in the
// Medalia patient portal for Iceland users; international users get
// the wellness pulse only.
//
// Scoring (Lifeline-proprietary, equal-weighted per user request):
//   • Each question produces a 0–10 score.
//   • Pillar score = mean of its question scores.
//   • Lífstílseinkunn = mean of pillar scores.
//   • Bands: 7.5–10 Gott (green), 5–7.5 Sæmilegt (blue), <5 Lélegt (red).
//
// Web admin test bench lives at /admin/wellness-pulse-bench in the
// website repo. Keep the catalog in sync between both surfaces.

export type Pillar = 'sleep' | 'exercise' | 'nutrition' | 'mental' | 'addictive';

export const PILLAR_LABELS: Record<Pillar, string> = {
  sleep:     'Sleep',
  exercise:  'Exercise',
  nutrition: 'Nutrition',
  mental:    'Mental wellbeing',
  addictive: 'Habits',
};

export type QuestionFormat =
  | { type: 'choice'; options: ChoiceOption[] }
  | { type: 'slider1to10' }
  | { type: 'multiselect'; options: MultiselectOption[] };

export interface ChoiceOption {
  /** Display label. */
  label: string;
  /** Score this option contributes (0-10). */
  score: number;
  /** Stable code for storage; defaults to the label if absent. */
  code?: string;
}

export interface MultiselectOption {
  code: string;
  label: string;
}

export interface PulseQuestion {
  /** Stable identifier — never reuse / rename, used as storage key. */
  id: string;
  pillar: Pillar;
  prompt: string;
  /** Where this question came from. */
  source: 'heilsumat' | 'lifeline';
  /** Heilsumat linkId for traceability with Medalia, when reused. */
  heilsumatLinkId?: string;
  format: QuestionFormat;
  /** Optional short clarifier shown under the prompt. */
  hint?: string;
  /** When true, the question is preserved in the catalog (so old runs
   *  still score) but NOT asked in new pulse runs. Used to retire
   *  weaker-evidence questions without invalidating historical data. */
  deprecated?: boolean;
  /** Evidence citation — surfaced in the question's "why this matters"
   *  tooltip and on the lifestyle subpage. Anchored to a guideline,
   *  meta-analysis, or top-journal paper. */
  evidence?: {
    /** Plain-language one-liner the user sees. */
    why: string;
    /** Authors / journal / year / PMID. */
    citation: string;
  };
}

// ──────────────────────────────────────────────────────────────────
// Catalog
// ──────────────────────────────────────────────────────────────────

export const WELLNESS_PULSE_QUESTIONS: PulseQuestion[] = [
  // ── Sleep ─────────────────────────────────────────────────────
  {
    id: 'sleep_rested',
    pillar: 'sleep',
    prompt: 'Do you feel well-rested most mornings when you wake up?',
    source: 'heilsumat',
    heilsumatLinkId: 'sleep_well-rested',
    format: {
      type: 'choice',
      options: [
        { code: 'always',   label: 'Almost always',   score: 10 },
        { code: 'sometimes',label: 'Sometimes',       score: 5 },
        { code: 'rarely',   label: 'Rarely or never', score: 0 },
      ],
    },
  },
  {
    id: 'sleep_duration',
    pillar: 'sleep',
    prompt: 'How much sleep do you usually get?',
    source: 'heilsumat',
    heilsumatLinkId: 'sleep_how-much',
    format: {
      type: 'choice',
      options: [
        { code: '<6',  label: 'Less than 6 hours',  score: 0 },
        { code: '6-7', label: '6–7 hours',          score: 5 },
        { code: '7-8', label: '7–8 hours',          score: 10 },
        { code: '8-9', label: '8–9 hours',          score: 10 },
        { code: '9+',  label: 'More than 9 hours',  score: 7 },
      ],
    },
  },
  {
    id: 'sleep_latency',
    pillar: 'sleep',
    prompt: 'Do you have trouble falling asleep?',
    source: 'heilsumat',
    heilsumatLinkId: 'sleep_asleep-diffi',
    format: {
      type: 'choice',
      options: [
        { code: 'always',    label: 'Yes, almost always', score: 0 },
        { code: 'sometimes', label: 'Yes, sometimes',     score: 5 },
        { code: 'never',     label: 'No, never',          score: 10 },
      ],
    },
  },
  {
    id: 'sleep_continuity',
    pillar: 'sleep',
    prompt: 'Do you wake up at least once during most nights?',
    source: 'heilsumat',
    heilsumatLinkId: 'sleep_wakeup',
    format: {
      type: 'choice',
      options: [
        { code: 'always',    label: 'Yes, almost always', score: 0 },
        { code: 'sometimes', label: 'Yes, sometimes',     score: 5 },
        { code: 'never',     label: 'No, never',          score: 10 },
      ],
    },
  },
  {
    // Deprecated 2026-05-20: blue-light → melatonin is well-established
    // mechanistically but the real-world sleep effect of "screens
    // before bed" is modest (Tähkämö et al. Chronobiol Int 2019).
    // Replaced by the stronger sleep_regularity + sleep_eating items.
    // Kept in the catalog so old runs still score.
    id: 'sleep_screens',
    pillar: 'sleep',
    deprecated: true,
    prompt: 'How long before bed do you stop using screens (phone, TV, computer)?',
    source: 'heilsumat',
    heilsumatLinkId: 'sleep_stop-screentime',
    format: {
      type: 'choice',
      options: [
        { code: 'just-before', label: 'Right up until bedtime',     score: 0 },
        { code: '30-60',       label: '30–60 minutes before',       score: 5 },
        { code: '1-2h',        label: '1–2 hours before',           score: 8 },
        { code: '2h+',         label: '2+ hours before',            score: 10 },
      ],
    },
  },
  {
    // NEW — strongest single sleep-mortality predictor in the
    // literature; stronger than duration itself per Windred 2024.
    id: 'sleep_regularity',
    pillar: 'sleep',
    prompt: 'Do you keep roughly the same bedtime and wake time, even on weekends?',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: 'same',     label: 'Yes, within ~30 min most days', score: 10 },
        { code: 'somewhat', label: 'Within ~1 hour most days',      score: 5 },
        { code: 'irregular',label: 'Different every day',            score: 0 },
      ],
    },
    hint: 'Regularity matters more than total hours — the body clock thrives on rhythm.',
    evidence: {
      why: 'Sleep regularity predicts all-cause mortality more strongly than duration — irregular sleepers have about 50% higher mortality risk.',
      citation: 'Windred et al., Sleep 2024 (PMID 37738616)',
    },
  },
  {
    // NEW — user-requested. Late dinner → elevated postprandial
    // glucose → impaired sleep architecture (Gu 2020 + Yoshida 2024).
    id: 'sleep_eating',
    pillar: 'sleep',
    prompt: 'How long before bed do you typically finish eating?',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: '<1h',  label: 'Less than 1 hour',  score: 0 },
        { code: '1-2h', label: '1–2 hours',         score: 4 },
        { code: '2-3h', label: '2–3 hours',         score: 7 },
        { code: '3h+',  label: '3+ hours',          score: 10 },
      ],
    },
    hint: 'Eating close to bedtime raises overnight blood sugar and reduces deep sleep.',
    evidence: {
      why: 'Eating within 3 hours of bed raises 4-hour postprandial glucose ~11% and reduces sleep efficiency in PSG-measured RCTs.',
      citation: 'Gu et al., J Clin Endocrinol Metab 2020 (PMID 32525525)',
    },
  },

  // ── Exercise ───────────────────────────────────────────────────
  {
    id: 'exercise_sitting',
    pillar: 'exercise',
    prompt: 'How much do you sit during a typical day?',
    source: 'heilsumat',
    heilsumatLinkId: 'f629fba6-e9ca-43c2',
    format: {
      type: 'choice',
      options: [
        { code: 'mostly-active', label: 'I move regularly and only sit for limited stretches', score: 10 },
        { code: 'mixed',         label: 'I sit several hours a day but also move',             score: 5 },
        { code: 'mostly-sit',    label: 'I sit most of the day with little movement',          score: 0 },
      ],
    },
  },
  {
    id: 'exercise_cardio_light',
    pillar: 'exercise',
    prompt: 'How many days per week do you do light to moderate cardio (walks, easy bike, gentle swim)?',
    source: 'heilsumat',
    heilsumatLinkId: '69f84c7e-a96f-4343',
    format: {
      type: 'choice',
      options: [
        { code: '5+', label: '5 or more days', score: 10 },
        { code: '2-4',label: '2–4 days',       score: 5 },
        { code: '0-1',label: '0–1 days',       score: 0 },
      ],
    },
  },
  {
    id: 'exercise_cardio_vigorous',
    pillar: 'exercise',
    prompt: 'How many days per week do you do vigorous cardio (running, hard cycling, HIIT)?',
    source: 'heilsumat',
    heilsumatLinkId: '7a250972-11c8-4b1d',
    format: {
      type: 'choice',
      options: [
        { code: '6-7', label: '6–7 days', score: 8 },   // diminishing returns / overtraining risk
        { code: '3-5', label: '3–5 days', score: 10 },
        { code: '1-2', label: '1–2 days', score: 6 },
        { code: 'none',label: 'None',     score: 0 },
      ],
    },
  },
  {
    id: 'exercise_strength',
    pillar: 'exercise',
    prompt: 'How many days per week do you do strength training?',
    source: 'heilsumat',
    heilsumatLinkId: '221c4ab1-0adb-4bcb',
    format: {
      type: 'choice',
      options: [
        { code: '5-7',  label: '5–7 days', score: 10 },
        { code: '2-4',  label: '2–4 days', score: 8 },
        { code: '1',    label: '1 day',    score: 4 },
        { code: 'none', label: 'None',     score: 0 },
      ],
    },
    evidence: {
      why: 'Just 30-60 minutes per week of strength work cuts all-cause mortality by 10-17%; combined with cardio the effect grows to ~40%.',
      citation: 'Momma et al., Br J Sports Med 2022 (PMID 35228201)',
    },
  },
  {
    // NEW — covers the mobility / flexibility gap. Important for
    // older adults, desk workers, injury prevention.
    id: 'exercise_mobility',
    pillar: 'exercise',
    prompt: 'How often do you do mobility or stretching work (yoga, mobility flows, dedicated stretching)?',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: '4+',   label: '4+ days/week', score: 10 },
        { code: '2-3',  label: '2–3 days/week', score: 7 },
        { code: '1',    label: 'About once a week', score: 4 },
        { code: 'never',label: 'Rarely or never', score: 0 },
      ],
    },
    hint: 'Joint range-of-motion and tissue quality decline without dedicated work.',
  },

  // ── Nutrition ──────────────────────────────────────────────────
  {
    id: 'nutrition_processed',
    pillar: 'nutrition',
    prompt: 'How often do you eat ultra-processed food (chips, pizza, fast food, ready-meal sauces)?',
    source: 'heilsumat',
    heilsumatLinkId: '6173517f-dd37-4d91',
    format: {
      type: 'choice',
      options: [
        { code: 'often',  label: 'Often',           score: 0 },
        { code: 'some',   label: 'Sometimes',       score: 5 },
        { code: 'rarely', label: 'Rarely or never', score: 10 },
      ],
    },
  },
  {
    id: 'nutrition_added_sugar',
    pillar: 'nutrition',
    prompt: 'How often do you eat foods high in added sugar?',
    source: 'heilsumat',
    heilsumatLinkId: '73d666b2-b723-4a6f',
    format: {
      type: 'choice',
      options: [
        { code: 'often',  label: 'Often',           score: 0 },
        { code: 'some',   label: 'Sometimes',       score: 5 },
        { code: 'rarely', label: 'Rarely or never', score: 10 },
      ],
    },
  },
  {
    id: 'nutrition_plant_diversity',
    pillar: 'nutrition',
    prompt: 'How diverse is your plant-food intake (vegetables, fruits, legumes, whole grains)?',
    source: 'heilsumat',
    heilsumatLinkId: 'f766719a-46af-4edd',
    format: {
      type: 'choice',
      options: [
        { code: 'high',   label: 'High — varied plant foods most days', score: 10 },
        { code: 'medium', label: 'Some plant foods but limited variety',score: 5 },
        { code: 'low',    label: 'Very little plant food',              score: 0 },
      ],
    },
  },
  {
    id: 'nutrition_protein',
    pillar: 'nutrition',
    prompt: 'How adequate is your overall protein intake?',
    source: 'heilsumat',
    heilsumatLinkId: '25516d28-dcda-4b36',
    format: {
      type: 'choice',
      options: [
        { code: 'adequate',     label: 'Adequate — most meals contain protein', score: 10 },
        { code: 'somewhat',     label: 'Some meals contain protein',            score: 5 },
        { code: 'low',          label: 'Many meals lack a good protein source', score: 0 },
      ],
    },
  },
  {
    id: 'nutrition_hydration',
    pillar: 'nutrition',
    prompt: 'Do you feel you drink enough fluids throughout the day?',
    source: 'heilsumat',
    heilsumatLinkId: '8e01aaa3-0eb7-4a19',
    format: {
      type: 'choice',
      options: [
        { code: 'most',   label: 'Most days',       score: 10 },
        { code: 'some',   label: 'Sometimes',       score: 5 },
        { code: 'rarely', label: 'Rarely or never', score: 0 },
      ],
    },
  },
  {
    id: 'nutrition_stress_eating',
    pillar: 'nutrition',
    prompt: 'How often do you eat under stress, in a hurry, or while distracted?',
    source: 'heilsumat',
    heilsumatLinkId: 'a1860f4f-6b63-4fbc',
    format: {
      type: 'choice',
      options: [
        { code: 'most',   label: 'Most days',       score: 0 },
        { code: 'some',   label: 'Sometimes',       score: 5 },
        { code: 'rarely', label: 'Rarely or never', score: 10 },
      ],
    },
  },
  {
    // NEW — AHA-recommended 2x/week fatty fish. ~15% lower CV
    // mortality in pooled cohort data. Closest single-question
    // proxy for the omega-3 dimension.
    id: 'nutrition_fish',
    pillar: 'nutrition',
    prompt: 'How often do you eat fatty fish (salmon, mackerel, herring, sardines)?',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: '2+',   label: '2 or more times a week', score: 10 },
        { code: '1',    label: 'About once a week',      score: 6 },
        { code: 'rare', label: 'Rarely',                 score: 3 },
        { code: 'never',label: 'Never',                  score: 0 },
      ],
    },
    evidence: {
      why: 'Two servings of fatty fish per week lowers heart-disease death by ~15% in pooled cohort data.',
      citation: 'AHA Dietary Guidance 2021 + Hu et al., J Am Heart Assoc 2019',
    },
  },

  // ── Mental wellbeing (Andleg) ─────────────────────────────────
  // All four are Lifeline-authored to avoid implementing PHQ-9, GAD-7,
  // PSS-10, or WHO-5. Subjective wellness self-ratings, not symptom
  // screens.
  {
    id: 'mental_mood',
    pillar: 'mental',
    prompt: 'Over the last 30 days, how would you rate your overall mood?',
    hint: '1 = consistently low · 10 = consistently positive',
    source: 'lifeline',
    format: { type: 'slider1to10' },
  },
  {
    id: 'mental_stress',
    pillar: 'mental',
    prompt: 'Over the last 30 days, how often have you felt stressed on most days?',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: 'always',    label: 'Almost always', score: 0 },
        { code: 'often',     label: 'Often',         score: 2.5 },
        { code: 'sometimes', label: 'Sometimes',     score: 5 },
        { code: 'rarely',    label: 'Rarely',        score: 7.5 },
        { code: 'never',     label: 'Almost never',  score: 10 },
      ],
    },
  },
  {
    // Deprecated 2026-05 audit: contributed to the mental pillar
    // average but no action rule fired off the score and no other
    // surface read it. Kept in catalog so historic runs still score.
    id: 'mental_energy',
    pillar: 'mental',
    deprecated: true,
    prompt: 'Over the last 30 days, how would you describe your day-to-day energy?',
    hint: '1 = drained · 10 = energized',
    source: 'lifeline',
    format: { type: 'slider1to10' },
  },
  {
    id: 'mental_connection',
    pillar: 'mental',
    prompt: 'Over the last 30 days, have you felt meaningfully connected to people who matter to you?',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: 'always',    label: 'Almost always', score: 10 },
        { code: 'often',     label: 'Often',         score: 7.5 },
        { code: 'sometimes', label: 'Sometimes',     score: 5 },
        { code: 'rarely',    label: 'Rarely',        score: 2.5 },
        { code: 'never',     label: 'Almost never',  score: 0 },
      ],
    },
    evidence: {
      why: 'Strong social connections raise odds of 7-year survival by 50% — comparable in magnitude to quitting smoking.',
      citation: 'Holt-Lunstad et al., PLoS Med 2010 (PMID 20668659)',
    },
  },
  {
    // NEW — nature exposure shows a sharp threshold at 120 min/wk
    // (White 2019, n=20k). Below that, no measurable benefit;
    // above that, OR 1.59 for "good health".
    id: 'mental_nature',
    pillar: 'mental',
    prompt: 'About how much time do you spend outdoors in nature each week?',
    hint: 'Parks, forest, coast — anything green / blue counts.',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: '5h+',   label: '5+ hours per week',   score: 10 },
        { code: '2-5h',  label: '2–5 hours per week',  score: 8 },
        { code: '<2h',   label: 'Under 2 hours',        score: 3 },
        { code: 'none',  label: 'Almost none',          score: 0 },
      ],
    },
    evidence: {
      why: 'Two hours a week outdoors in nature is the threshold where wellbeing measurably improves — below that, no benefit.',
      citation: 'White et al., Sci Rep 2019 (PMID 31197192)',
    },
  },
  {
    // Deprecated 2026-05 audit: cited evidence is real (Cohen 2016)
    // but, like mental_energy, the score never fired an action rule
    // and no surface beyond the pillar average read it. Kept in
    // catalog so historic runs still score; can be revived if we
    // wire it to a purpose-focused action (journalling prompt etc.).
    id: 'mental_purpose',
    pillar: 'mental',
    deprecated: true,
    prompt: 'I feel my life has direction and meaning.',
    hint: '1 = strongly disagree · 10 = strongly agree',
    source: 'lifeline',
    format: { type: 'slider1to10' },
    evidence: {
      why: 'People who report a strong sense of purpose have 17% lower all-cause mortality — independent of mood, education, and income.',
      citation: 'Cohen et al., Psychosom Med 2016 (PMID 26630073)',
    },
  },

  // ── Habits (Ávanabindandi) ────────────────────────────────────
  // Lifeline-authored simple frequency questions. NOT AUDIT, NOT
  // Fagerström, NOT the validated substance-use screens.
  {
    // Updated 2026-05-20 from days/week → drinks/week. GBD 2022
    // and WHO/CCSA 2023 guidance use total drinks/week, not days,
    // because a 5-drink weekend (1 day, heavy) is worse than 5
    // single drinks across the week. Scoring matches CCSA 2023
    // risk bands (≤2 low, 3-6 moderate, 7+ high).
    id: 'habits_alcohol',
    pillar: 'addictive',
    prompt: 'In a typical week this month, about how many standard drinks did you have?',
    hint: 'One standard drink ≈ a small beer, a small glass of wine, or a single shot.',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: '0',    label: 'None',          score: 10 },
        { code: '1-2',  label: '1–2 drinks',    score: 8 },
        { code: '3-6',  label: '3–6 drinks',    score: 5 },
        { code: '7-13', label: '7–13 drinks',   score: 2 },
        { code: '14+',  label: '14+ drinks',    score: 0 },
      ],
    },
    evidence: {
      why: 'GBD 2022 retracted the "moderate drinking is healthy" finding — under 40, any alcohol is net harmful; over 40, the safest level is under 2 drinks/week.',
      citation: 'GBD 2020 Alcohol Collaborators, Lancet 2022 (PMID 35843246)',
    },
  },
  {
    id: 'habits_nicotine',
    pillar: 'addictive',
    prompt: 'In the last 30 days, how often have you used nicotine products (cigarettes, vape, snus, pouches)?',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: 'never',    label: 'Never',                  score: 10 },
        { code: 'occas',    label: 'Occasionally',           score: 6 },
        { code: 'daily',    label: 'Daily',                  score: 2 },
        { code: 'multi',    label: 'Multiple times daily',   score: 0 },
      ],
    },
  },
  {
    id: 'habits_caffeine',
    pillar: 'addictive',
    prompt: 'In a typical day this month, how many caffeinated drinks (coffee, tea, energy drinks) did you have?',
    hint: '1–2 a day is fine — 5+ flags a habit worth looking at.',
    source: 'lifeline',
    format: {
      type: 'choice',
      options: [
        { code: '0',    label: '0',     score: 10 },
        { code: '1-2',  label: '1–2',   score: 10 },
        { code: '3-4',  label: '3–4',   score: 5 },
        { code: '5+',   label: '5+',    score: 0 },
      ],
    },
  },
  {
    id: 'habits_balance',
    pillar: 'addictive',
    prompt: 'Has any of these felt out of balance this month?',
    hint: 'Tap all that apply. Self-flag — drives nudges, not a clinical screen.',
    source: 'lifeline',
    format: {
      type: 'multiselect',
      options: [
        { code: 'caffeine',  label: 'Caffeine' },
        { code: 'nicotine',  label: 'Nicotine' },
        { code: 'alcohol',   label: 'Alcohol' },
        { code: 'screen',    label: 'Screen time' },
        { code: 'gambling',  label: 'Gambling' },
        { code: 'food',      label: 'Food choices' },
      ],
    },
  },
];

// ──────────────────────────────────────────────────────────────────
// Active-question helper. Returns the questions to ask in a new run
// (skipping deprecated ones). Deprecated questions stay in the
// catalog so old runs still score, but new pulses don't surface them.
// ──────────────────────────────────────────────────────────────────

export function activeQuestions(): PulseQuestion[] {
  return WELLNESS_PULSE_QUESTIONS.filter((q) => !q.deprecated);
}

// ──────────────────────────────────────────────────────────────────
// Scoring
// ──────────────────────────────────────────────────────────────────

/** Raw answers keyed by question id. */
export type PulseAnswers = Record<string, ChoiceAnswer | SliderAnswer | MultiselectAnswer>;

export interface ChoiceAnswer       { type: 'choice';       code: string }
export interface SliderAnswer       { type: 'slider1to10';  value: number }
export interface MultiselectAnswer  { type: 'multiselect';  codes: string[] }

export interface PillarBreakdown {
  pillar: Pillar;
  score: number;          // 0-10, 1 decimal
  questionCount: number;  // how many questions contributed
}

export interface LifestyleScoreResult {
  lifestyleScore: number;          // 0-10, 1 decimal
  pillarScores: PillarBreakdown[];
  flags: string[];                 // codes from habits_balance multiselect (if any)
  completeness: number;            // 0-1 (answered / total)
}

/** Score one question against the catalog. Returns null if the
 *  answer is missing or the question id is unknown. */
export function scoreQuestion(qid: string, answer: PulseAnswers[string] | undefined): number | null {
  if (!answer) return null;
  const q = WELLNESS_PULSE_QUESTIONS.find((x) => x.id === qid);
  if (!q) return null;

  if (q.format.type === 'choice' && answer.type === 'choice') {
    const opt = q.format.options.find((o) => (o.code ?? o.label) === answer.code);
    return opt ? clamp01_10(opt.score) : null;
  }
  if (q.format.type === 'slider1to10' && answer.type === 'slider1to10') {
    return clamp01_10(answer.value);
  }
  if (q.format.type === 'multiselect' && answer.type === 'multiselect') {
    // habits_balance scoring: floor(0, 10 − 2×flags). Other future
    // multiselects can override with a custom helper.
    return Math.max(0, 10 - 2 * answer.codes.length);
  }
  return null;
}

/** Compute pillar averages + overall Lífstílseinkunn. Missing answers
 *  reduce the question count but don't blow up the average — a partly
 *  completed pulse still produces a usable result, with `completeness`
 *  telling the UI how much trust to place in it. */
export function computeLifestyleScore(answers: PulseAnswers): LifestyleScoreResult {
  const pillarBuckets: Record<Pillar, number[]> = {
    sleep: [], exercise: [], nutrition: [], mental: [], addictive: [],
  };
  let answered = 0;

  // Score every question, including deprecated ones — old runs may
  // have answered them, and we want their pillar averages to still
  // be honest. New runs simply don't ask deprecated ones (see the
  // activeQuestions helper below).
  for (const q of WELLNESS_PULSE_QUESTIONS) {
    const s = scoreQuestion(q.id, answers[q.id]);
    if (s != null) {
      pillarBuckets[q.pillar].push(s);
      answered++;
    }
  }

  const pillarScores: PillarBreakdown[] = (Object.keys(pillarBuckets) as Pillar[]).map((p) => {
    const xs = pillarBuckets[p];
    const score = xs.length === 0 ? 0 : round1(xs.reduce((a, b) => a + b, 0) / xs.length);
    return { pillar: p, score, questionCount: xs.length };
  });

  // Equal weight across pillars; skip pillars with zero answers so an
  // unfinished pulse doesn't drag the score to 0.
  const answered_pillars = pillarScores.filter((p) => p.questionCount > 0);
  const lifestyleScore = answered_pillars.length === 0
    ? 0
    : round1(answered_pillars.reduce((a, p) => a + p.score, 0) / answered_pillars.length);

  // Pull self-flags from the habits_balance multiselect, if present.
  const bal = answers['habits_balance'];
  const flags = bal && bal.type === 'multiselect' ? bal.codes.slice() : [];

  return {
    lifestyleScore,
    pillarScores,
    flags,
    completeness: WELLNESS_PULSE_QUESTIONS.length === 0
      ? 0
      : round2(answered / WELLNESS_PULSE_QUESTIONS.length),
  };
}

// ──────────────────────────────────────────────────────────────────
// Signal bands (Gott / Sæmilegt / Lélegt) — mirrors Medalia's bands.
// ──────────────────────────────────────────────────────────────────

export type PulseBand = 'gott' | 'saemilegt' | 'lelegt';

export function pulseBand(score: number): PulseBand {
  if (score >= 7.5) return 'gott';
  if (score >= 5)   return 'saemilegt';
  return 'lelegt';
}

export function pulseBandLabel(band: PulseBand): string {
  return band === 'gott' ? 'Good'
       : band === 'saemilegt' ? 'Moderate'
       : 'Needs attention';
}

export function pulseBandColor(band: PulseBand): string {
  // Aligned with the universal signal palette used everywhere else
  // in the app (signalColor()) so the lifestyle-score pill matches
  // the green/yellow/red dot rendered next to it. Previous blue for
  // the "saemilegt" band caused a visual mismatch between the pill
  // (blue) and the SignalDot (amber).
  return band === 'gott' ? '#10B981'      // green
       : band === 'saemilegt' ? '#F59E0B' // amber/yellow
       : '#EF4444';                       // red
}

// ──────────────────────────────────────────────────────────────────
// Pillar → program mapping. When a pillar drops to "Needs attention"
// (or persistently to Moderate-low), HealthCoach can activate the
// matching foundational program. Caller decides the threshold.
// ──────────────────────────────────────────────────────────────────

export const PILLAR_TO_PROGRAM: Record<Pillar, { category: string; programKey: string; programName: string }> = {
  sleep:     { category: 'sleep',     programKey: 'sleep-reset',         programName: 'Sleep reset' },
  exercise:  { category: 'exercise',  programKey: 'essential-strength',  programName: 'Essential strength' },
  nutrition: { category: 'nutrition', programKey: 'foundational-eating', programName: 'Foundational eating' },
  mental:    { category: 'mental',    programKey: 'stress-reset',        programName: 'Stress reset' },
  // Addictive pillar maps to the same mental program — no dedicated
  // addiction program in Lifeline's catalog yet. Update when one ships.
  addictive: { category: 'mental',    programKey: 'stress-reset',        programName: 'Stress reset' },
};

// Pillars at or below this score trigger an automatic foundational
// program activation. Matches the Lélegt band ("Needs attention").
export const PULSE_ACTIVATION_THRESHOLD = 5;

export interface PulseActivation {
  pillar: Pillar;
  category: string;
  programKey: string;
  programName: string;
  score: number;
}

/** Given a computed pulse result, return the unique foundational
 *  program activations a low-pillar trigger would produce. Dedupes
 *  by category (so Mental + Habits — which share the stress-reset
 *  program — only activate it once). */
export function recommendedActivationsForResult(result: LifestyleScoreResult): PulseActivation[] {
  const seen = new Set<string>();
  const out: PulseActivation[] = [];
  for (const p of result.pillarScores) {
    if (p.score >= PULSE_ACTIVATION_THRESHOLD) continue;
    if (p.questionCount === 0) continue; // unanswered pillar, don't act
    const mapping = PILLAR_TO_PROGRAM[p.pillar];
    const key = `${mapping.category}:${mapping.programKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      pillar: p.pillar,
      category: mapping.category,
      programKey: mapping.programKey,
      programName: mapping.programName,
      score: p.score,
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }
function clamp01_10(n: number): number { return Math.max(0, Math.min(10, n)); }
