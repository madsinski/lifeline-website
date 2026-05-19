// Wellness Pulse catalog + scoring — website-side copy.
//
// SOURCE OF TRUTH: /home/mads/fhir-health-dashboard/src/lib/wellnessPulse.ts
// in the RN app repo. Keep this file in lockstep when the catalog
// changes; the admin bench at /admin/wellness-pulse-bench renders
// the same questions the in-app pulse uses.
//
// This file is staff-test only — no API endpoint reads from it, no
// user data is persisted on the website side. The bench computes
// scores in-browser and discards on refresh.

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

export interface ChoiceOption { label: string; score: number; code?: string }
export interface MultiselectOption { code: string; label: string }

export interface PulseQuestion {
  id: string;
  pillar: Pillar;
  prompt: string;
  source: 'heilsumat' | 'lifeline';
  heilsumatLinkId?: string;
  format: QuestionFormat;
  hint?: string;
}

export const WELLNESS_PULSE_QUESTIONS: PulseQuestion[] = [
  // ── Sleep ─────────────────────────────────────────────────────
  { id: 'sleep_rested', pillar: 'sleep',
    prompt: 'Do you feel well-rested most mornings when you wake up?',
    source: 'heilsumat', heilsumatLinkId: 'sleep_well-rested',
    format: { type: 'choice', options: [
      { code: 'always',   label: 'Almost always',   score: 10 },
      { code: 'sometimes',label: 'Sometimes',       score: 5 },
      { code: 'rarely',   label: 'Rarely or never', score: 0 },
    ] } },
  { id: 'sleep_duration', pillar: 'sleep',
    prompt: 'How much sleep do you usually get?',
    source: 'heilsumat', heilsumatLinkId: 'sleep_how-much',
    format: { type: 'choice', options: [
      { code: '<6',  label: 'Less than 6 hours',  score: 0 },
      { code: '6-7', label: '6–7 hours',          score: 5 },
      { code: '7-8', label: '7–8 hours',          score: 10 },
      { code: '8-9', label: '8–9 hours',          score: 10 },
      { code: '9+',  label: 'More than 9 hours',  score: 7 },
    ] } },
  { id: 'sleep_latency', pillar: 'sleep',
    prompt: 'Do you have trouble falling asleep?',
    source: 'heilsumat', heilsumatLinkId: 'sleep_asleep-diffi',
    format: { type: 'choice', options: [
      { code: 'always',    label: 'Yes, almost always', score: 0 },
      { code: 'sometimes', label: 'Yes, sometimes',     score: 5 },
      { code: 'never',     label: 'No, never',          score: 10 },
    ] } },
  { id: 'sleep_continuity', pillar: 'sleep',
    prompt: 'Do you wake up at least once during most nights?',
    source: 'heilsumat', heilsumatLinkId: 'sleep_wakeup',
    format: { type: 'choice', options: [
      { code: 'always',    label: 'Yes, almost always', score: 0 },
      { code: 'sometimes', label: 'Yes, sometimes',     score: 5 },
      { code: 'never',     label: 'No, never',          score: 10 },
    ] } },
  { id: 'sleep_screens', pillar: 'sleep',
    prompt: 'How long before bed do you stop using screens (phone, TV, computer)?',
    source: 'heilsumat', heilsumatLinkId: 'sleep_stop-screentime',
    format: { type: 'choice', options: [
      { code: 'just-before', label: 'Right up until bedtime', score: 0 },
      { code: '30-60',       label: '30–60 minutes before',   score: 5 },
      { code: '1-2h',        label: '1–2 hours before',       score: 8 },
      { code: '2h+',         label: '2+ hours before',        score: 10 },
    ] } },

  // ── Exercise ───────────────────────────────────────────────────
  { id: 'exercise_sitting', pillar: 'exercise',
    prompt: 'How much do you sit during a typical day?',
    source: 'heilsumat', heilsumatLinkId: 'f629fba6-e9ca-43c2',
    format: { type: 'choice', options: [
      { code: 'mostly-active', label: 'I move regularly and only sit for limited stretches', score: 10 },
      { code: 'mixed',         label: 'I sit several hours a day but also move',             score: 5 },
      { code: 'mostly-sit',    label: 'I sit most of the day with little movement',          score: 0 },
    ] } },
  { id: 'exercise_cardio_light', pillar: 'exercise',
    prompt: 'How many days per week do you do light to moderate cardio (walks, easy bike, gentle swim)?',
    source: 'heilsumat', heilsumatLinkId: '69f84c7e-a96f-4343',
    format: { type: 'choice', options: [
      { code: '5+', label: '5 or more days', score: 10 },
      { code: '2-4',label: '2–4 days',       score: 5 },
      { code: '0-1',label: '0–1 days',       score: 0 },
    ] } },
  { id: 'exercise_cardio_vigorous', pillar: 'exercise',
    prompt: 'How many days per week do you do vigorous cardio (running, hard cycling, HIIT)?',
    source: 'heilsumat', heilsumatLinkId: '7a250972-11c8-4b1d',
    format: { type: 'choice', options: [
      { code: '6-7', label: '6–7 days', score: 8 },
      { code: '3-5', label: '3–5 days', score: 10 },
      { code: '1-2', label: '1–2 days', score: 6 },
      { code: 'none',label: 'None',     score: 0 },
    ] } },
  { id: 'exercise_strength', pillar: 'exercise',
    prompt: 'How many days per week do you do strength training?',
    source: 'heilsumat', heilsumatLinkId: '221c4ab1-0adb-4bcb',
    format: { type: 'choice', options: [
      { code: '5-7',  label: '5–7 days', score: 10 },
      { code: '2-4',  label: '2–4 days', score: 8 },
      { code: '1',    label: '1 day',    score: 4 },
      { code: 'none', label: 'None',     score: 0 },
    ] } },

  // ── Nutrition ──────────────────────────────────────────────────
  { id: 'nutrition_processed', pillar: 'nutrition',
    prompt: 'How often do you eat ultra-processed food (chips, pizza, fast food, ready-meal sauces)?',
    source: 'heilsumat', heilsumatLinkId: '6173517f-dd37-4d91',
    format: { type: 'choice', options: [
      { code: 'often',  label: 'Often',           score: 0 },
      { code: 'some',   label: 'Sometimes',       score: 5 },
      { code: 'rarely', label: 'Rarely or never', score: 10 },
    ] } },
  { id: 'nutrition_added_sugar', pillar: 'nutrition',
    prompt: 'How often do you eat foods high in added sugar?',
    source: 'heilsumat', heilsumatLinkId: '73d666b2-b723-4a6f',
    format: { type: 'choice', options: [
      { code: 'often',  label: 'Often',           score: 0 },
      { code: 'some',   label: 'Sometimes',       score: 5 },
      { code: 'rarely', label: 'Rarely or never', score: 10 },
    ] } },
  { id: 'nutrition_plant_diversity', pillar: 'nutrition',
    prompt: 'How diverse is your plant-food intake (vegetables, fruits, legumes, whole grains)?',
    source: 'heilsumat', heilsumatLinkId: 'f766719a-46af-4edd',
    format: { type: 'choice', options: [
      { code: 'high',   label: 'High — varied plant foods most days', score: 10 },
      { code: 'medium', label: 'Some plant foods but limited variety',score: 5 },
      { code: 'low',    label: 'Very little plant food',              score: 0 },
    ] } },
  { id: 'nutrition_protein', pillar: 'nutrition',
    prompt: 'How adequate is your overall protein intake?',
    source: 'heilsumat', heilsumatLinkId: '25516d28-dcda-4b36',
    format: { type: 'choice', options: [
      { code: 'adequate', label: 'Adequate — most meals contain protein', score: 10 },
      { code: 'somewhat', label: 'Some meals contain protein',            score: 5 },
      { code: 'low',      label: 'Many meals lack a good protein source', score: 0 },
    ] } },
  { id: 'nutrition_hydration', pillar: 'nutrition',
    prompt: 'Do you feel you drink enough fluids throughout the day?',
    source: 'heilsumat', heilsumatLinkId: '8e01aaa3-0eb7-4a19',
    format: { type: 'choice', options: [
      { code: 'most',   label: 'Most days',       score: 10 },
      { code: 'some',   label: 'Sometimes',       score: 5 },
      { code: 'rarely', label: 'Rarely or never', score: 0 },
    ] } },
  { id: 'nutrition_stress_eating', pillar: 'nutrition',
    prompt: 'How often do you eat under stress, in a hurry, or while distracted?',
    source: 'heilsumat', heilsumatLinkId: 'a1860f4f-6b63-4fbc',
    format: { type: 'choice', options: [
      { code: 'most',   label: 'Most days',       score: 0 },
      { code: 'some',   label: 'Sometimes',       score: 5 },
      { code: 'rarely', label: 'Rarely or never', score: 10 },
    ] } },

  // ── Mental wellbeing ──────────────────────────────────────────
  { id: 'mental_mood', pillar: 'mental',
    prompt: 'Over the last 30 days, how would you rate your overall mood?',
    hint: '1 = consistently low · 10 = consistently positive',
    source: 'lifeline', format: { type: 'slider1to10' } },
  { id: 'mental_stress', pillar: 'mental',
    prompt: 'Over the last 30 days, how often have you felt stressed on most days?',
    source: 'lifeline',
    format: { type: 'choice', options: [
      { code: 'always',    label: 'Almost always', score: 0 },
      { code: 'often',     label: 'Often',         score: 2.5 },
      { code: 'sometimes', label: 'Sometimes',     score: 5 },
      { code: 'rarely',    label: 'Rarely',        score: 7.5 },
      { code: 'never',     label: 'Almost never',  score: 10 },
    ] } },
  { id: 'mental_energy', pillar: 'mental',
    prompt: 'Over the last 30 days, how would you describe your day-to-day energy?',
    hint: '1 = drained · 10 = energized',
    source: 'lifeline', format: { type: 'slider1to10' } },
  { id: 'mental_connection', pillar: 'mental',
    prompt: 'Over the last 30 days, have you felt meaningfully connected to people who matter to you?',
    source: 'lifeline',
    format: { type: 'choice', options: [
      { code: 'always',    label: 'Almost always', score: 10 },
      { code: 'often',     label: 'Often',         score: 7.5 },
      { code: 'sometimes', label: 'Sometimes',     score: 5 },
      { code: 'rarely',    label: 'Rarely',        score: 2.5 },
      { code: 'never',     label: 'Almost never',  score: 0 },
    ] } },

  // ── Habits ────────────────────────────────────────────────────
  { id: 'habits_alcohol', pillar: 'addictive',
    prompt: 'In a typical week this month, on how many days did you drink alcohol?',
    source: 'lifeline',
    format: { type: 'choice', options: [
      { code: '0',    label: '0 days', score: 10 },
      { code: '1-2',  label: '1–2 days', score: 7 },
      { code: '3-4',  label: '3–4 days', score: 4 },
      { code: '5+',   label: '5+ days',  score: 0 },
    ] } },
  { id: 'habits_nicotine', pillar: 'addictive',
    prompt: 'In the last 30 days, how often have you used nicotine products (cigarettes, vape, snus, pouches)?',
    source: 'lifeline',
    format: { type: 'choice', options: [
      { code: 'never',    label: 'Never',                  score: 10 },
      { code: 'occas',    label: 'Occasionally',           score: 6 },
      { code: 'daily',    label: 'Daily',                  score: 2 },
      { code: 'multi',    label: 'Multiple times daily',   score: 0 },
    ] } },
  { id: 'habits_caffeine', pillar: 'addictive',
    prompt: 'In a typical day this month, how many caffeinated drinks (coffee, tea, energy drinks) did you have?',
    hint: '1–2 a day is fine — 5+ flags a habit worth looking at.',
    source: 'lifeline',
    format: { type: 'choice', options: [
      { code: '0',    label: '0',     score: 10 },
      { code: '1-2',  label: '1–2',   score: 10 },
      { code: '3-4',  label: '3–4',   score: 5 },
      { code: '5+',   label: '5+',    score: 0 },
    ] } },
  { id: 'habits_balance', pillar: 'addictive',
    prompt: 'Has any of these felt out of balance this month?',
    hint: 'Tap all that apply. Self-flag — drives nudges, not a clinical screen.',
    source: 'lifeline',
    format: { type: 'multiselect', options: [
      { code: 'caffeine',  label: 'Caffeine' },
      { code: 'nicotine',  label: 'Nicotine' },
      { code: 'alcohol',   label: 'Alcohol' },
      { code: 'screen',    label: 'Screen time' },
      { code: 'gambling',  label: 'Gambling' },
      { code: 'food',      label: 'Food choices' },
    ] } },
];

// ── Scoring ───────────────────────────────────────────────────────

export type PulseAnswers = Record<string, ChoiceAnswer | SliderAnswer | MultiselectAnswer>;
export interface ChoiceAnswer      { type: 'choice'; code: string }
export interface SliderAnswer      { type: 'slider1to10'; value: number }
export interface MultiselectAnswer { type: 'multiselect'; codes: string[] }

export interface PillarBreakdown {
  pillar: Pillar;
  score: number;
  questionCount: number;
}
export interface LifestyleScoreResult {
  lifestyleScore: number;
  pillarScores: PillarBreakdown[];
  flags: string[];
  completeness: number;
}

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
    return Math.max(0, 10 - 2 * answer.codes.length);
  }
  return null;
}

export function computeLifestyleScore(answers: PulseAnswers): LifestyleScoreResult {
  const buckets: Record<Pillar, number[]> = {
    sleep: [], exercise: [], nutrition: [], mental: [], addictive: [],
  };
  let answered = 0;
  for (const q of WELLNESS_PULSE_QUESTIONS) {
    const s = scoreQuestion(q.id, answers[q.id]);
    if (s != null) { buckets[q.pillar].push(s); answered++; }
  }
  const pillarScores: PillarBreakdown[] = (Object.keys(buckets) as Pillar[]).map((p) => {
    const xs = buckets[p];
    const score = xs.length === 0 ? 0 : round1(xs.reduce((a, b) => a + b, 0) / xs.length);
    return { pillar: p, score, questionCount: xs.length };
  });
  const answered_pillars = pillarScores.filter((p) => p.questionCount > 0);
  const lifestyleScore = answered_pillars.length === 0
    ? 0
    : round1(answered_pillars.reduce((a, p) => a + p.score, 0) / answered_pillars.length);
  const bal = answers['habits_balance'];
  const flags = bal && bal.type === 'multiselect' ? bal.codes.slice() : [];
  return {
    lifestyleScore, pillarScores, flags,
    completeness: WELLNESS_PULSE_QUESTIONS.length === 0
      ? 0
      : Math.round((answered / WELLNESS_PULSE_QUESTIONS.length) * 100) / 100,
  };
}

export type PulseBand = 'gott' | 'saemilegt' | 'lelegt';
export function pulseBand(score: number): PulseBand {
  if (score >= 7.5) return 'gott';
  if (score >= 5)   return 'saemilegt';
  return 'lelegt';
}
export function pulseBandLabel(band: PulseBand): string {
  return band === 'gott' ? 'Good' : band === 'saemilegt' ? 'Moderate' : 'Needs attention';
}
export function pulseBandColor(band: PulseBand): string {
  return band === 'gott' ? '#10B981' : band === 'saemilegt' ? '#3B82F6' : '#EF4444';
}

// ── Program activation recommendations ──────────────────────────────
// Pillars at or below this score trigger a foundational program in
// HealthCoach. Mirror of the RN-side helper.
export const PULSE_ACTIVATION_THRESHOLD = 5;

export const PILLAR_TO_PROGRAM: Record<Pillar, { category: string; programKey: string; programName: string }> = {
  sleep:     { category: 'sleep',     programKey: 'sleep-reset',         programName: 'Sleep reset' },
  exercise:  { category: 'exercise',  programKey: 'essential-strength',  programName: 'Essential strength' },
  nutrition: { category: 'nutrition', programKey: 'foundational-eating', programName: 'Foundational eating' },
  mental:    { category: 'mental',    programKey: 'stress-reset',        programName: 'Stress reset' },
  addictive: { category: 'mental',    programKey: 'stress-reset',        programName: 'Stress reset' },
};

export interface PulseActivation {
  pillar: Pillar;
  category: string;
  programKey: string;
  programName: string;
  score: number;
}

export function recommendedActivationsForResult(result: LifestyleScoreResult): PulseActivation[] {
  const seen = new Set<string>();
  const out: PulseActivation[] = [];
  for (const p of result.pillarScores) {
    if (p.score >= PULSE_ACTIVATION_THRESHOLD) continue;
    if (p.questionCount === 0) continue;
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

function round1(n: number): number { return Math.round(n * 10) / 10; }
function clamp01_10(n: number): number { return Math.max(0, Math.min(10, n)); }
