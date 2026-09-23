// Composing the exercise and nutrition programmes.
//
// The presets fix the shape — how many sessions, what each is for, how the
// load progresses — because those should not be improvised per client. What
// varies is which exercises and which meals, and that is what the model does
// here, choosing from our own libraries: 976 exercises and 110 meals, both
// already rated.
//
// The model never invents an exercise. It is handed a slice of the library
// and must answer with ids from it; anything it returns that is not in that
// slice is dropped, and what survives is hydrated from the library row, so a
// published plan holds a real snapshot with the right illustration, cues and
// muscles rather than a name the model liked the sound of.
//
// Server-only: needs OPENAI_API_KEY and the service role.

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadReport } from "./report-store";
import { SIGNAL_IS } from "./analyze";
import type { ExerciseItem, ExerciseSession, PlanItem } from "./types";

export const COMPOSE_MODEL = process.env.OPENAI_MODEL_COMPOSE || "gpt-5.4";

/** How many library rows the model gets to choose from, per category. */
const PER_CATEGORY = 14;

const exerciseSchema = z.object({
  sessions: z.array(z.object({
    day: z.string().describe("Vikudagur á íslensku, t.d. „Mánudagur“"),
    title: z.string().describe("Heiti æfingarinnar, stutt. Íslenska."),
    focus: z.string().nullable().describe("Hvað æfingin snýst um, 2–5 orð. Íslenska."),
    minutes: z.number().nullable(),
    items: z.array(z.object({
      exercise_id: z.string().describe("id ÚR SAFNINU sem fylgir. Aldrei annað."),
      name_is: z.string().describe("Heiti æfingarinnar á íslensku. Safnið er á ensku og skjólstæðingurinn les íslensku — t.d. „Lat Pulldown“ verður „Niðurtog“."),
      prescription: z.string().describe("Lotur og endurtekningar, t.d. „3 × 8–12“ eða „40 mín.“"),
      note: z.string().nullable().describe("Ein stutt ábending ef þörf er. Íslenska."),
      block: z.enum(["warmup", "main", "finisher"]).nullable(),
    })).describe("4–7 atriði í æfingu"),
  })).describe("Ein æfing á hvern þjálfunardag"),
  note: z.string().describe("Tvær til fjórar setningar til skjólstæðingsins um áætlunina. Íslenska."),
});

const nutritionSchema = z.object({
  day_example: z.array(z.object({
    meal: z.string().describe("Máltíðin, t.d. „Morgunmatur“, „Hádegi“, „Millimál“, „Kvöldmatur“"),
    example: z.string().describe("Hvað er á borðinu, á ÍSLENSKU. Máltíðasafnið er á ensku — þýddu heitið, ekki afritaðu það."),
    meal_id: z.string().nullable().describe("id úr máltíðasafninu ef ein þeirra passar, annars null"),
  })).describe("Dagur eins og hann getur litið út, 3–5 máltíðir"),
  note: z.string().describe("Tvær til fjórar setningar til skjólstæðingsins. Íslenska."),
});

export type ComposeKind = "exercise" | "nutrition";

export interface ComposeResult {
  sessions?: ExerciseSession[];
  day_example?: { meal: string; example: string }[];
  note: string;
  /** Ids the model returned that were not in the library slice. */
  dropped: number;
}

const SYSTEM = `Þú setur saman æfinga- eða næringaráætlun fyrir hjúkrunarfræðing hjá Lifeline.

Aðferðafræði Lifeline — „mest fyrir minnst“:
• Stórar hreyfingar fyrst: hnébeygja, mjaðmalyfta, ýta, toga, bera.
• Fáar æfingar sem eru gerðar slá út margar sem eru það ekki. Samkvæmni fram yfir fullkomnun.
• Sniðmátið sem fylgir ákveður fjölda æfinga, lengd og framvindu. Þú fyllir það út, þú breytir því ekki.

Reglur sem þú mátt ekki brjóta:
• Notaðu EINGÖNGU exercise_id eða meal_id úr safninu sem fylgir. Aldrei búa til æfingu eða máltíð sem er ekki þar.
• Taktu mið af mæligildum og af því sem áætlunin tekur á. Ef verkir eru nefndir skaltu velja hreyfingar sem forðast þá og segja það í note.
• Þú greinir ekki sjúkdóma, ávísar ekki meðferð og lofar engum árangri.
• Allur texti er á íslensku og ávarpar skjólstæðinginn með „þú“.
• SAFNIÐ ER Á ENSKU en skjólstæðingurinn les íslensku. Skilaðu id-inu óbreyttu og heitinu á íslensku.`;

interface LibRow {
  id: string;
  name: string;
  category: string | null;
  equipment: string | null;
  level: string | null;
  primary_muscles: string[] | null;
}

/**
 * The library, best-rated first but spread across categories.
 *
 * Taking the top 140 outright would hand the model fourteen variations of a
 * row and no hip hinge, so it is capped per category. bang_for_buck already
 * lives on the exercises table, so "best" is the library's own judgement.
 */
async function exerciseSlice(): Promise<LibRow[]> {
  const { data } = await supabaseAdmin
    .from("exercises")
    .select("id, name, category, equipment, level, primary_muscles, bang_for_buck")
    .order("bang_for_buck", { ascending: false, nullsFirst: false })
    .limit(600);
  const byCategory = new Map<string, LibRow[]>();
  for (const e of (data ?? []) as LibRow[]) {
    const k = e.category ?? "other";
    const list = byCategory.get(k) ?? [];
    if (list.length < PER_CATEGORY) { list.push(e); byCategory.set(k, list); }
  }
  return [...byCategory.values()].flat();
}

interface MealRow { id: string; name: string; category: string | null; protein: number | null }

async function mealSlice(): Promise<MealRow[]> {
  const { data } = await supabaseAdmin
    .from("meals")
    .select("id, name, category, protein")
    .eq("is_filler", false)
    .limit(140);
  return (data ?? []) as MealRow[];
}

/**
 * Compose one of the two programmes. Never throws: the caller wants a message
 * rather than a stack trace, and the nurse can always build it by hand.
 */
export async function composeProgram(opts: {
  kind: ComposeKind;
  journeyId: string;
  clientId: string;
  /** The preset skeleton to fill in. */
  template: Record<string, unknown> | null;
  /** The actions already in the plan — what the programme has to serve. */
  planItems: PlanItem[];
  /** Free text from the nurse: pain, equipment, what they will actually do. */
  constraints?: string | null;
}): Promise<{ ok: true; result: ComposeResult } | { ok: false; message: string }> {
  if (!process.env.OPENAI_API_KEY) return { ok: false, message: "AI-samsetning er ekki uppsett." };

  const stored = await loadReport(opts.journeyId, opts.clientId);
  const values = (stored?.report.items ?? [])
    .filter((i) => stored?.signals[i.key] && stored.signals[i.key] !== "green")
    .map((i) => `${i.title}: ${i.value}${i.unit ? ` ${i.unit}` : ""} → ${SIGNAL_IS[stored!.signals[i.key]!]}`)
    .join("\n");

  const actions = opts.planItems
    .filter((m) => (opts.kind === "exercise" ? m.pillar === "exercise" : m.pillar === "nutrition"))
    .map((m) => `${m.title}${m.frequency ? ` (${m.frequency})` : ""}`)
    .join("\n");

  try {
    if (opts.kind === "exercise") {
      const lib = await exerciseSlice();
      const catalog = lib
        .map((e) => `${e.id} | ${e.name} | ${e.category ?? "-"} | ${e.equipment ?? "engin tæki"} | ${e.level ?? "-"}`)
        .join("\n");
      const t = opts.template ?? {};
      const prompt = [
        `SNIÐMÁT: ${t.name ?? "ósniðið"} — ${t.goal ?? ""}`,
        `Æfingar á viku: ${t.days_per_week ?? 3}. Lengd hverrar: ${t.session_minutes ?? 40} mín.`,
        Array.isArray(t.principles) && t.principles.length ? `Reglur sniðmátsins:\n${(t.principles as string[]).map((x) => `• ${x}`).join("\n")}` : "",
        t.progression ? `Framvinda: ${t.progression}` : "",
        "",
        values ? `MÆLIGILDI UTAN VIÐMIÐA:\n${values}` : "Engin gildi utan viðmiða skráð.",
        actions ? `\nAÐGERÐIR Í ÁÆTLUNINNI SEM ÞETTA ÞARF AÐ ÞJÓNA:\n${actions}` : "",
        opts.constraints ? `\nFRÁ HJÚKRUNARFRÆÐINGI:\n${opts.constraints}` : "",
        "",
        "ÆFINGASAFN (id | heiti | flokkur | búnaður | þyngdarstig) — veldu EINGÖNGU úr þessum:",
        catalog,
      ].filter(Boolean).join("\n");

      const r = await generateText({
        model: openai(COMPOSE_MODEL),
        output: Output.object({ schema: exerciseSchema }),
        maxOutputTokens: 6000,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
      });
      const out = r.experimental_output as z.infer<typeof exerciseSchema>;

      // Only ids we actually offered, hydrated from the library row.
      const byId = new Map(lib.map((e) => [e.id, e]));
      let dropped = 0;
      const sessions: ExerciseSession[] = (out.sessions ?? []).map((s) => ({
        day: s.day,
        title: s.title,
        focus: s.focus,
        minutes: s.minutes,
        items: (s.items ?? []).reduce<ExerciseItem[]>((acc, it) => {
          const e = byId.get(it.exercise_id);
          if (!e) { dropped++; return acc; }
          acc.push({
            // The Icelandic name is what the client reads; the id is what
            // carries the illustration, the cues and the muscles.
            name: it.name_is?.trim() || e.name,
            prescription: it.prescription,
            note: it.note,
            exercise_id: e.id,
            muscles: e.primary_muscles ?? undefined,
            equipment: e.equipment ?? undefined,
            block: it.block ?? undefined,
          });
          return acc;
        }, []),
      })).filter((s) => s.items.length > 0);

      return { ok: true, result: { sessions, note: out.note, dropped } };
    }

    const lib = await mealSlice();
    const catalog = lib
      .map((m) => `${m.id} | ${m.name} | ${m.category ?? "-"} | ${m.protein ?? "?"} g prótein`)
      .join("\n");
    const t = opts.template ?? {};
    const prompt = [
      `SNIÐMÁT: ${t.name ?? "ósniðið"} — ${t.goal ?? ""}`,
      Array.isArray(t.principles) && t.principles.length ? `Reglur sniðmátsins:\n${(t.principles as string[]).map((x) => `• ${x}`).join("\n")}` : "",
      "",
      values ? `MÆLIGILDI UTAN VIÐMIÐA:\n${values}` : "Engin gildi utan viðmiða skráð.",
      actions ? `\nAÐGERÐIR Í ÁÆTLUNINNI SEM ÞETTA ÞARF AÐ ÞJÓNA:\n${actions}` : "",
      opts.constraints ? `\nFRÁ HJÚKRUNARFRÆÐINGI:\n${opts.constraints}` : "",
      "",
      "MÁLTÍÐASAFN (id | heiti | flokkur | prótein):",
      catalog,
    ].filter(Boolean).join("\n");

    const r = await generateText({
      model: openai(COMPOSE_MODEL),
      output: Output.object({ schema: nutritionSchema }),
      maxOutputTokens: 3000,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
    });
    const out = r.experimental_output as z.infer<typeof nutritionSchema>;
    const names = new Map(lib.map((m) => [m.id, m.name]));
    let dropped = 0;
    const day_example = (out.day_example ?? []).map((d) => {
      if (d.meal_id && !names.has(d.meal_id)) dropped++;
      // The model has already written the meal in Icelandic. Prefixing the
      // library's English name produced "Salmon quinoa bowl — Salmon quinoa
      // bowl. Byrjaðu á…", so it is left alone.
      return { meal: d.meal, example: d.example.trim() };
    });
    return { ok: true, result: { day_example, note: out.note, dropped } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "unknown" };
  }
}
