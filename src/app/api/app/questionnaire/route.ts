// The eight-question health questionnaire.
//
// Questions extracted verbatim from QuestionnaireScreen.tsx rather than
// retyped — the options carry meaning in their order (worst first, best
// last), so a reworded option is a changed answer.
//
// Answers upsert on (client_id, question_key), exactly as
// api.ts:saveQuestionnaireResponse (3072) does, so the app and the web see
// one set of answers rather than two.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export const QUESTIONS = [
  { key: "strength", question: "How often do you do strength training?",
    options: ["I don't exercise", "1-2 times per week", "3-6 times per week"] },
  { key: "cardio", question: "How often do you do cardio exercise?",
    options: ["Never", "1-2 times per week", "3+ times per week"] },
  { key: "sleep", question: "How many hours of sleep do you get per night?",
    options: ["Less than 6", "6-7 hours", "8+ hours"] },
  { key: "diet", question: "How would you describe your diet?",
    options: ["Mostly processed food", "Mixed", "Mostly whole foods"] },
  { key: "stress", question: "How would you rate your stress levels?",
    options: ["High", "Moderate", "Low"] },
  { key: "alcohol", question: "How often do you consume alcohol?",
    options: ["Daily", "A few times per week", "Rarely or never"] },
  { key: "smoking", question: "Do you smoke?",
    options: ["Yes, regularly", "Occasionally", "No"] },
  { key: "water", question: "How much water do you drink daily?",
    options: ["Less than 1 litre", "1-2 litres", "More than 2 litres"] },
] as const;

/**
 * Icelandic for the same eight. The stored answer is always the English
 * string, because the app writes and reads those — translating at rest
 * would split one answer set in two.
 */
export const QUESTIONS_IS: Record<string, { q: string; o: string[] }> = {
  strength: { q: "Hversu oft lyftirðu eða gerir styrktaræfingar?",
    o: ["Ég hreyfi mig ekki", "1–2 sinnum í viku", "3–6 sinnum í viku"] },
  cardio: { q: "Hversu oft gerirðu þolæfingar?",
    o: ["Aldrei", "1–2 sinnum í viku", "3+ sinnum í viku"] },
  sleep: { q: "Hvað sefurðu margar klukkustundir á nóttu?",
    o: ["Minna en 6", "6–7 klukkustundir", "8+ klukkustundir"] },
  diet: { q: "Hvernig myndirðu lýsa mataræðinu þínu?",
    o: ["Mest unnin matvara", "Blandað", "Mest óunnin matvara"] },
  stress: { q: "Hvernig metur þú streitustigið þitt?",
    o: ["Hátt", "Í meðallagi", "Lágt"] },
  alcohol: { q: "Hversu oft drekkurðu áfengi?",
    o: ["Daglega", "Nokkrum sinnum í viku", "Sjaldan eða aldrei"] },
  smoking: { q: "Reykir þú?", o: ["Já, reglulega", "Stundum", "Nei"] },
  water: { q: "Hvað drekkurðu mikið vatn á dag?",
    o: ["Minna en 1 lítra", "1–2 lítra", "Meira en 2 lítra"] },
};

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { data } = await supabaseAdmin
    .from("questionnaire_responses")
    .select("question_key, answer, completed_at")
    .eq("client_id", user.id);

  const answers: Record<string, string> = {};
  for (const r of data ?? []) answers[r.question_key as string] = r.answer as string;

  return NextResponse.json({
    questions: QUESTIONS.map((q) => ({ ...q, is: QUESTIONS_IS[q.key] ?? null })),
    answers,
    complete: QUESTIONS.every((q) => answers[q.key]),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const b = await req.json().catch(() => null);
  const key = typeof b?.key === "string" ? b.key : null;
  const answer = typeof b?.answer === "string" ? b.answer : null;

  const q = QUESTIONS.find((x) => x.key === key);
  if (!q || !answer) return NextResponse.json({ error: "bad request" }, { status: 400 });
  // The answer must be one of the options — a free-text value here would
  // mean nothing to whatever reads these later.
  if (!(q.options as readonly string[]).includes(answer)) {
    return NextResponse.json({ error: "not an option" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("questionnaire_responses").upsert(
    { client_id: user.id, question_key: q.key, answer, completed_at: new Date().toISOString() },
    { onConflict: "client_id,question_key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
