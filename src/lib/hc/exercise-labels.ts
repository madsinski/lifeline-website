// Icelandic labels for the exercise library (`exercises`, English source
// data from /admin/content) and the helper that turns a library row into a
// plan item. Client-safe.

import type { ExerciseBlock, ExerciseItem, LibraryExercise } from "./types";

export const CATEGORY_IS: Record<string, string> = {
  legs: "Fætur", back: "Bak", chest: "Brjóst", shoulders: "Axlir", arms: "Handleggir",
  core: "Bolur", "full-body": "Allur líkaminn", cardio: "Þol", "warm-up": "Upphitun", flexibility: "Liðleiki",
};

export const EQUIPMENT_IS: Record<string, string> = {
  bodyweight: "Eigin þyngd", none: "Án búnaðar", dumbbells: "Handlóð", kettlebell: "Ketilbjalla",
  bands: "Teygja", barbell: "Stöng", cables: "Kaðlavél", machine: "Tæki", other: "Annað",
};

export const MUSCLE_IS: Record<string, string> = {
  abdominals: "kviður", quadriceps: "framanvert læri", hamstrings: "aftanvert læri", glutes: "rass",
  calves: "kálfar", chest: "brjóst", shoulders: "axlir", triceps: "þríhöfði", biceps: "tvíhöfði",
  lats: "breiðir bakvöðvar", "middle back": "miðbak", "lower back": "mjóbak", traps: "herðar",
  forearms: "framhandleggir", adductors: "innanvert læri", abductors: "utanvert læri", neck: "háls",
};

export const BLOCK_IS: Record<ExerciseBlock, string> = { warmup: "Upphitun", main: "Aðalhluti", finisher: "Lokahluti" };

export const muscleIs = (m: string) => MUSCLE_IS[m.toLowerCase()] ?? m;

/** Sensible starting dose for a library exercise; the nurse adjusts it. */
export function itemFromLibrary(ex: LibraryExercise): ExerciseItem {
  const cat = ex.category ?? "";
  const block: ExerciseBlock = cat === "warm-up" || cat === "flexibility" ? "warmup" : "main";
  const prescription =
    cat === "cardio" ? "20 mín" :
    block === "warmup" ? "1 mín" :
    cat === "core" ? "3 x 30 sek" : "3 x 8–12";
  return {
    name: ex.name,
    prescription,
    note: null,
    exercise_id: ex.id,
    image: ex.illustration_url,
    video: ex.video_url,
    muscles: [...(ex.primary_muscles ?? []), ...(ex.secondary_muscles ?? [])].slice(0, 4),
    equipment: ex.equipment,
    cues: (ex.instructions ?? []).slice(0, 3),
    rest: block === "main" && cat !== "cardio" ? "60–90 sek" : null,
    block,
  };
}
