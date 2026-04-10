"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "chest" | "back" | "shoulders" | "arms" | "legs" | "core" | "cardio" | "flexibility" | "full-body";
type Equipment = "none" | "dumbbells" | "barbell" | "machine" | "cables" | "bodyweight" | "bands" | "kettlebell" | "other";
type Difficulty = "beginner" | "intermediate" | "advanced";

interface Exercise {
  id: string;
  name: string;
  description: string;
  category: Category;
  equipment: Equipment;
  difficulty: Difficulty;
  illustration_url: string;
  video_url: string;
  instructions: string[];
  muscles_targeted: string[];
  created_at: string;
}

const CATEGORIES: Category[] = ["chest", "back", "shoulders", "arms", "legs", "core", "cardio", "flexibility", "full-body"];
const EQUIPMENT: Equipment[] = ["none", "dumbbells", "barbell", "machine", "cables", "bodyweight", "bands", "kettlebell", "other"];
const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];

const CATEGORY_COLORS: Record<Category, string> = {
  chest: "#EF4444",
  back: "#3B82F6",
  shoulders: "#F59E0B",
  arms: "#8B5CF6",
  legs: "#20c858",
  core: "#06B6D4",
  cardio: "#EC4899",
  flexibility: "#14B8A6",
  "full-body": "#6366F1",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: "#22C55E",
  intermediate: "#F59E0B",
  advanced: "#EF4444",
};

// ── Exercise Image URLs ─────────────────────────────────────────────────────────
const IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const EXERCISE_IMAGES: Record<string, string> = {
  "Flat Barbell Bench Press": `${IMG_BASE}Barbell_Bench_Press/0.jpg`,
  "Decline Barbell Bench Press": `${IMG_BASE}Decline_Barbell_Bench_Press/0.jpg`,
  "Flat Dumbbell Bench Press": `${IMG_BASE}Dumbbell_Bench_Press/0.jpg`,
  "Incline Dumbbell Press": `${IMG_BASE}Incline_Dumbbell_Press/0.jpg`,
  "Standard Push-Up": `${IMG_BASE}Push-Up/0.jpg`,
  "Wide Push-Up": `${IMG_BASE}Wide_Push-Up/0.jpg`,
  "Diamond Push-Up": `${IMG_BASE}Diamond_Push-Up/0.jpg`,
  "Dumbbell Fly": `${IMG_BASE}Dumbbell_Fly/0.jpg`,
  "Chest Dip": `${IMG_BASE}Chest_Dip/0.jpg`,
  "Cable Crossover": `${IMG_BASE}Cable_Crossover/0.jpg`,
  "Pull-Up": `${IMG_BASE}Pull-Up/0.jpg`,
  "Chin-Up": `${IMG_BASE}Chin-Up/0.jpg`,
  "Lat Pulldown": `${IMG_BASE}Lat_Pulldown/0.jpg`,
  "Barbell Bent-Over Row": `${IMG_BASE}Bent_Over_Barbell_Row/0.jpg`,
  "Seated Cable Row": `${IMG_BASE}Seated_Cable_Row/0.jpg`,
  "T-Bar Row": `${IMG_BASE}T-Bar_Row/0.jpg`,
  "Face Pull": `${IMG_BASE}Face_Pull/0.jpg`,
  "Barbell Deadlift": `${IMG_BASE}Barbell_Deadlift/0.jpg`,
  "Barbell Overhead Press": `${IMG_BASE}Barbell_Shoulder_Press/0.jpg`,
  "Dumbbell Shoulder Press": `${IMG_BASE}Dumbbell_Shoulder_Press/0.jpg`,
  "Arnold Press": `${IMG_BASE}Arnold_Dumbbell_Press/0.jpg`,
  "Dumbbell Lateral Raise": `${IMG_BASE}Lateral_Raise/0.jpg`,
  "Dumbbell Front Raise": `${IMG_BASE}Front_Raise/0.jpg`,
  "Upright Row": `${IMG_BASE}Upright_Barbell_Row/0.jpg`,
  "Barbell Shrug": `${IMG_BASE}Barbell_Shrug/0.jpg`,
  "Barbell Curl": `${IMG_BASE}Barbell_Curl/0.jpg`,
  "Dumbbell Bicep Curl": `${IMG_BASE}Dumbbell_Curl/0.jpg`,
  "Hammer Curl": `${IMG_BASE}Hammer_Curl/0.jpg`,
  "Preacher Curl": `${IMG_BASE}Preacher_Curl/0.jpg`,
  "Tricep Dip": `${IMG_BASE}Tricep_Dip/0.jpg`,
  "Tricep Pushdown": `${IMG_BASE}Tricep_Pushdown/0.jpg`,
  "Skull Crusher": `${IMG_BASE}Skull_Crusher/0.jpg`,
  "Overhead Tricep Extension": `${IMG_BASE}Overhead_Tricep_Extension/0.jpg`,
  "Barbell Back Squat": `${IMG_BASE}Barbell_Squat/0.jpg`,
  "Front Squat": `${IMG_BASE}Front_Squat/0.jpg`,
  "Goblet Squat": `${IMG_BASE}Goblet_Squat/0.jpg`,
  "Leg Press": `${IMG_BASE}Leg_Press/0.jpg`,
  "Walking Lunge": `${IMG_BASE}Walking_Lunge/0.jpg`,
  "Reverse Lunge": `${IMG_BASE}Reverse_Lunge/0.jpg`,
  "Leg Extension": `${IMG_BASE}Leg_Extension/0.jpg`,
  "Leg Curl": `${IMG_BASE}Leg_Curl/0.jpg`,
  "Standing Calf Raise": `${IMG_BASE}Calf_Raise/0.jpg`,
  "Barbell Hip Thrust": `${IMG_BASE}Hip_Thrust/0.jpg`,
  "Romanian Deadlift": `${IMG_BASE}Romanian_Deadlift/0.jpg`,
  "Step-Up": `${IMG_BASE}Step-Up/0.jpg`,
  "Front Plank": `${IMG_BASE}Plank/0.jpg`,
  "Side Plank": `${IMG_BASE}Side_Plank/0.jpg`,
  "Crunch": `${IMG_BASE}Crunch/0.jpg`,
  "Russian Twist": `${IMG_BASE}Russian_Twist/0.jpg`,
  "Hanging Leg Raise": `${IMG_BASE}Leg_Raise/0.jpg`,
  "Mountain Climber": `${IMG_BASE}Mountain_Climber/0.jpg`,
  "Dead Bug": `${IMG_BASE}Dead_Bug/0.jpg`,
  "Bird Dog": `${IMG_BASE}Bird_Dog/0.jpg`,
  "Ab Wheel Rollout": `${IMG_BASE}Ab_Roller/0.jpg`,
  "Jump Rope": `${IMG_BASE}Jump_Rope/0.jpg`,
  "Burpee": `${IMG_BASE}Burpee/0.jpg`,
  "Jumping Jack": `${IMG_BASE}Jumping_Jack/0.jpg`,
  "High Knees": `${IMG_BASE}High_Knees/0.jpg`,
  "Barbell Bench Press": `${IMG_BASE}Barbell_Bench_Press/0.jpg`,
  "Dumbbell Bench Press": `${IMG_BASE}Dumbbell_Bench_Press/0.jpg`,
  "Push-Up": `${IMG_BASE}Push-Up/0.jpg`,
  "Lateral Raise": `${IMG_BASE}Lateral_Raise/0.jpg`,
  "Squat": `${IMG_BASE}Barbell_Squat/0.jpg`,
  "Deadlift": `${IMG_BASE}Barbell_Deadlift/0.jpg`,
  "Calf Raise": `${IMG_BASE}Calf_Raise/0.jpg`,
  "Plank": `${IMG_BASE}Plank/0.jpg`,
  "Leg Raise": `${IMG_BASE}Leg_Raise/0.jpg`,
  "Hip Thrust": `${IMG_BASE}Hip_Thrust/0.jpg`,
};

// ── Seed Data ──────────────────────────────────────────────────────────────────

const SEED_EXERCISES: Omit<Exercise, "id" | "created_at" | "illustration_url">[] = [
  // Chest
  { name: "Barbell Bench Press", description: "Compound chest exercise using a barbell on a flat bench", category: "chest", equipment: "barbell", difficulty: "intermediate", instructions: ["Lie on bench", "Grip bar slightly wider than shoulders", "Lower to chest", "Press up to lockout"], muscles_targeted: ["chest", "triceps", "front delts"], video_url: "" },
  { name: "Dumbbell Flyes", description: "Isolation chest exercise focusing on the pectoral stretch", category: "chest", equipment: "dumbbells", difficulty: "intermediate", instructions: ["Lie on flat bench with dumbbells", "Extend arms above chest", "Lower arms in arc to sides", "Squeeze chest to return"], muscles_targeted: ["chest", "front delts"], video_url: "" },
  { name: "Incline Dumbbell Press", description: "Upper chest focused pressing movement", category: "chest", equipment: "dumbbells", difficulty: "intermediate", instructions: ["Set bench to 30-45 degrees", "Press dumbbells from shoulders", "Lower with control", "Press to lockout"], muscles_targeted: ["upper chest", "triceps", "front delts"], video_url: "" },
  { name: "Push-Ups", description: "Classic bodyweight chest exercise", category: "chest", equipment: "bodyweight", difficulty: "beginner", instructions: ["Start in plank position", "Lower chest to floor", "Keep core tight", "Push back up"], muscles_targeted: ["chest", "triceps", "core"], video_url: "" },
  // Back
  { name: "Barbell Deadlift", description: "Full posterior chain compound lift", category: "back", equipment: "barbell", difficulty: "advanced", instructions: ["Stand with feet hip-width", "Grip bar outside knees", "Drive through heels", "Lock out hips at top"], muscles_targeted: ["lower back", "glutes", "hamstrings", "traps"], video_url: "" },
  { name: "Pull-Ups", description: "Bodyweight vertical pulling movement", category: "back", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Hang from bar with overhand grip", "Pull chin above bar", "Lower with control", "Full extension at bottom"], muscles_targeted: ["lats", "biceps", "rear delts"], video_url: "" },
  { name: "Barbell Bent-Over Row", description: "Horizontal pulling for back thickness", category: "back", equipment: "barbell", difficulty: "intermediate", instructions: ["Hinge at hips 45 degrees", "Pull bar to lower chest", "Squeeze shoulder blades", "Lower with control"], muscles_targeted: ["lats", "rhomboids", "biceps", "rear delts"], video_url: "" },
  { name: "Lat Pulldown", description: "Machine-based vertical pull for lats", category: "back", equipment: "machine", difficulty: "beginner", instructions: ["Sit at machine, grip bar wide", "Pull bar to upper chest", "Squeeze lats at bottom", "Control the return"], muscles_targeted: ["lats", "biceps", "rear delts"], video_url: "" },
  // Shoulders
  { name: "Overhead Press", description: "Standing barbell press for shoulder development", category: "shoulders", equipment: "barbell", difficulty: "intermediate", instructions: ["Start bar at shoulders", "Press overhead", "Lock out at top", "Lower with control"], muscles_targeted: ["front delts", "side delts", "triceps"], video_url: "" },
  { name: "Lateral Raises", description: "Isolation for side deltoids", category: "shoulders", equipment: "dumbbells", difficulty: "beginner", instructions: ["Hold dumbbells at sides", "Raise arms to shoulder height", "Slight bend in elbows", "Lower slowly"], muscles_targeted: ["side delts"], video_url: "" },
  { name: "Face Pulls", description: "Rear delt and rotator cuff exercise", category: "shoulders", equipment: "cables", difficulty: "beginner", instructions: ["Set cable at face height", "Pull rope to face", "Externally rotate at end", "Squeeze rear delts"], muscles_targeted: ["rear delts", "rotator cuff", "traps"], video_url: "" },
  // Arms
  { name: "Barbell Curl", description: "Classic bicep builder with barbell", category: "arms", equipment: "barbell", difficulty: "beginner", instructions: ["Stand with barbell, underhand grip", "Curl bar to shoulders", "Keep elbows pinned", "Lower with control"], muscles_targeted: ["biceps", "forearms"], video_url: "" },
  { name: "Tricep Dips", description: "Compound bodyweight tricep exercise", category: "arms", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Support on parallel bars", "Lower body by bending arms", "Go to 90 degrees", "Press back up"], muscles_targeted: ["triceps", "chest", "front delts"], video_url: "" },
  { name: "Hammer Curls", description: "Neutral grip dumbbell curl for brachialis", category: "arms", equipment: "dumbbells", difficulty: "beginner", instructions: ["Hold dumbbells with neutral grip", "Curl to shoulders", "Keep elbows stationary", "Lower slowly"], muscles_targeted: ["biceps", "brachialis", "forearms"], video_url: "" },
  { name: "Tricep Pushdown", description: "Cable isolation for triceps", category: "arms", equipment: "cables", difficulty: "beginner", instructions: ["Stand at cable machine", "Push bar down to full extension", "Keep elbows at sides", "Control the return"], muscles_targeted: ["triceps"], video_url: "" },
  // Legs
  { name: "Barbell Back Squat", description: "King of leg exercises for total lower body", category: "legs", equipment: "barbell", difficulty: "intermediate", instructions: ["Bar on upper back", "Squat to parallel or below", "Drive through heels", "Lock out at top"], muscles_targeted: ["quads", "glutes", "hamstrings", "core"], video_url: "" },
  { name: "Romanian Deadlift", description: "Hip hinge for hamstrings and glutes", category: "legs", equipment: "barbell", difficulty: "intermediate", instructions: ["Hold bar at hips", "Hinge at hips, slight knee bend", "Lower bar along legs", "Squeeze glutes to stand"], muscles_targeted: ["hamstrings", "glutes", "lower back"], video_url: "" },
  { name: "Bulgarian Split Squat", description: "Single-leg squat with rear foot elevated", category: "legs", equipment: "dumbbells", difficulty: "intermediate", instructions: ["Rear foot on bench", "Lower until front thigh parallel", "Keep torso upright", "Drive through front heel"], muscles_targeted: ["quads", "glutes", "hamstrings"], video_url: "" },
  { name: "Leg Press", description: "Machine compound leg exercise", category: "legs", equipment: "machine", difficulty: "beginner", instructions: ["Sit in machine, feet shoulder-width", "Lower platform toward chest", "Press to near lockout", "Control the descent"], muscles_targeted: ["quads", "glutes", "hamstrings"], video_url: "" },
  // Core
  { name: "Plank", description: "Isometric core stabilization exercise", category: "core", equipment: "bodyweight", difficulty: "beginner", instructions: ["Forearms and toes on floor", "Keep body in straight line", "Engage core throughout", "Hold for time"], muscles_targeted: ["core", "shoulders", "glutes"], video_url: "" },
  { name: "Hanging Leg Raise", description: "Advanced core exercise from a bar", category: "core", equipment: "bodyweight", difficulty: "advanced", instructions: ["Hang from pull-up bar", "Raise legs to parallel", "Control the descent", "Avoid swinging"], muscles_targeted: ["lower abs", "hip flexors", "core"], video_url: "" },
  { name: "Cable Woodchop", description: "Rotational core movement with cable", category: "core", equipment: "cables", difficulty: "intermediate", instructions: ["Set cable high", "Rotate and pull diagonally down", "Pivot feet naturally", "Control return"], muscles_targeted: ["obliques", "core", "shoulders"], video_url: "" },
  { name: "Ab Rollout", description: "Anti-extension core exercise using wheel or barbell", category: "core", equipment: "other", difficulty: "intermediate", instructions: ["Kneel with wheel in front", "Roll forward extending body", "Keep core braced", "Roll back to start"], muscles_targeted: ["core", "lats", "shoulders"], video_url: "" },
  // Cardio
  { name: "Treadmill Running", description: "Steady state or interval running on treadmill", category: "cardio", equipment: "machine", difficulty: "beginner", instructions: ["Set desired speed and incline", "Run with natural stride", "Maintain upright posture", "Cool down gradually"], muscles_targeted: ["quads", "hamstrings", "calves", "cardiovascular"], video_url: "" },
  { name: "Rowing Machine", description: "Full body cardiovascular exercise", category: "cardio", equipment: "machine", difficulty: "beginner", instructions: ["Sit on rower, feet in straps", "Push with legs first", "Pull handle to chest", "Return in reverse order"], muscles_targeted: ["back", "legs", "arms", "cardiovascular"], video_url: "" },
  { name: "Jump Rope", description: "High-intensity cardio and coordination", category: "cardio", equipment: "other", difficulty: "intermediate", instructions: ["Hold rope handles at hips", "Jump with minimal height", "Land on balls of feet", "Keep wrists relaxed"], muscles_targeted: ["calves", "shoulders", "cardiovascular"], video_url: "" },
  { name: "Burpees", description: "Full body high-intensity conditioning", category: "cardio", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Stand, then squat down", "Jump feet back to plank", "Do a push-up", "Jump feet forward and jump up"], muscles_targeted: ["full body", "cardiovascular"], video_url: "" },
  // Flexibility
  { name: "Standing Hamstring Stretch", description: "Basic hamstring flexibility exercise", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Stand with one foot forward", "Hinge at hips", "Reach toward toes", "Hold 20-30 seconds each side"], muscles_targeted: ["hamstrings", "lower back"], video_url: "" },
  { name: "Pigeon Pose", description: "Deep hip flexor and glute stretch from yoga", category: "flexibility", equipment: "none", difficulty: "intermediate", instructions: ["From all fours, bring one knee forward", "Extend back leg behind", "Lower hips toward floor", "Hold 30-60 seconds"], muscles_targeted: ["hip flexors", "glutes", "piriformis"], video_url: "" },
  { name: "Cat-Cow Stretch", description: "Spinal mobility warm-up", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Start on hands and knees", "Arch back, look up (cow)", "Round back, tuck chin (cat)", "Flow between positions"], muscles_targeted: ["spine", "core", "neck"], video_url: "" },
  // Full-body
  { name: "Kettlebell Swing", description: "Explosive hip hinge for power and conditioning", category: "full-body", equipment: "kettlebell", difficulty: "intermediate", instructions: ["Stand with feet wider than shoulders", "Hinge and swing kettlebell between legs", "Drive hips forward to swing up", "Control the descent"], muscles_targeted: ["glutes", "hamstrings", "core", "shoulders"], video_url: "" },
  { name: "Turkish Get-Up", description: "Complex full body movement with kettlebell", category: "full-body", equipment: "kettlebell", difficulty: "advanced", instructions: ["Lie with kettlebell pressed up", "Roll to elbow, then hand", "Bridge hips and sweep leg through", "Stand up, reverse to return"], muscles_targeted: ["shoulders", "core", "glutes", "full body"], video_url: "" },
  { name: "Thrusters", description: "Front squat to overhead press combination", category: "full-body", equipment: "barbell", difficulty: "intermediate", instructions: ["Hold bar at shoulders", "Squat to parallel", "Drive up explosively", "Press bar overhead at top"], muscles_targeted: ["quads", "shoulders", "core", "triceps"], video_url: "" },
  { name: "Man Makers", description: "Dumbbell complex combining row, push-up, clean and press", category: "full-body", equipment: "dumbbells", difficulty: "advanced", instructions: ["Start in push-up position on dumbbells", "Row each dumbbell", "Do a push-up", "Jump feet in, clean and press"], muscles_targeted: ["full body", "cardiovascular"], video_url: "" },
];

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, type === "info" ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [onClose, type]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 max-w-md ${
      type === "success" ? "bg-green-600 text-white" : type === "info" ? "bg-blue-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "success" && (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      )}
      {type === "error" && (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      )}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
    </div>
  );
}

// ── Delete Confirmation Dialog ─────────────────────────────────────────────────

function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [editingExercise, setEditingExercise] = useState<Partial<Exercise> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // ── Load exercises ─────────────────────────────────────────────────────────

  const loadExercises = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("exercises").select("*").order("name");
    if (error) {
      setToast({ message: "Failed to load exercises", type: "error" });
    } else {
      setExercises((data as Exercise[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadExercises(); }, [loadExercises]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = exercises.filter((ex) => {
    if (categoryFilter !== "all" && ex.category !== categoryFilter) return false;
    if (equipmentFilter !== "all" && ex.equipment !== equipmentFilter) return false;
    if (difficultyFilter !== "all" && ex.difficulty !== difficultyFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!ex.name.toLowerCase().includes(q) && !ex.description?.toLowerCase().includes(q) && !(ex.muscles_targeted || []).some((m) => m.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const saveExercise = async () => {
    if (!editingExercise) return;
    const { id, created_at, ...rest } = editingExercise as Exercise;
    if (!rest.name?.trim()) { setToast({ message: "Name is required", type: "error" }); return; }
    if (!rest.category) { setToast({ message: "Category is required", type: "error" }); return; }

    if (isCreating) {
      const { error } = await supabase.from("exercises").insert([rest]);
      if (error) { setToast({ message: "Failed to create exercise: " + error.message, type: "error" }); return; }
      setToast({ message: `Created "${rest.name}"`, type: "success" });
    } else {
      const { error } = await supabase.from("exercises").update(rest).eq("id", id);
      if (error) { setToast({ message: "Failed to update exercise: " + error.message, type: "error" }); return; }
      setToast({ message: `Updated "${rest.name}"`, type: "success" });
    }
    setEditingExercise(null);
    setIsCreating(false);
    loadExercises();
  };

  const deleteExercise = async (id: string, name: string) => {
    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (error) { setToast({ message: "Failed to delete: " + error.message, type: "error" }); return; }
    setToast({ message: `Deleted "${name}"`, type: "success" });
    setConfirmDelete(null);
    loadExercises();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("exercises").delete().in("id", ids);
    if (error) { setToast({ message: "Bulk delete failed: " + error.message, type: "error" }); return; }
    setToast({ message: `Deleted ${ids.length} exercises`, type: "success" });
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
    loadExercises();
  };

  const seedExercises = async () => {
    setSeeding(true);
    let inserted = 0;
    for (const ex of SEED_EXERCISES) {
      const withImage = { ...ex, illustration_url: EXERCISE_IMAGES[ex.name] || null };
      const { error } = await supabase.from("exercises").upsert(withImage as Record<string, unknown>, { onConflict: "name" });
      if (!error) inserted++;
    }
    setToast({ message: `Seeded ${inserted} exercises`, type: "success" });
    setSeeding(false);
    loadExercises();
  };

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)));
    }
  };

  // ── New exercise template ──────────────────────────────────────────────────

  const openCreate = () => {
    setEditingExercise({ name: "", description: "", category: "chest", equipment: "barbell", difficulty: "intermediate", instructions: [""], muscles_targeted: [], video_url: "" });
    setIsCreating(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmDelete && <ConfirmDialog title="Delete Exercise" message={`Are you sure you want to delete "${confirmDelete.name}"? This cannot be undone.`} onConfirm={() => deleteExercise(confirmDelete.id, confirmDelete.name)} onCancel={() => setConfirmDelete(null)} />}
      {bulkDeleteConfirm && <ConfirmDialog title="Delete Selected" message={`Delete ${selectedIds.size} selected exercises? This cannot be undone.`} onConfirm={bulkDelete} onCancel={() => setBulkDeleteConfirm(false)} />}

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Exercise Library</h1>
          <span className="bg-gray-100 text-gray-600 text-sm font-medium px-2.5 py-0.5 rounded-full">{exercises.length}</span>
        </div>
        <div className="flex items-center gap-3">
          {exercises.length === 0 && !loading && (
            <button onClick={seedExercises} disabled={seeding} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
              {seeding ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Seeding...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Seed {SEED_EXERCISES.length} Exercises</>
              )}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button onClick={() => setBulkDeleteConfirm(true)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete {selectedIds.size} Selected
            </button>
          )}
          <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-[#20c858] rounded-lg hover:bg-[#1ab34e] transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Exercise
          </button>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCategoryFilter("all")} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${categoryFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategoryFilter(cat === categoryFilter ? "all" : cat)} className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors" style={{ backgroundColor: categoryFilter === cat ? CATEGORY_COLORS[cat] : `${CATEGORY_COLORS[cat]}18`, color: categoryFilter === cat ? "#fff" : CATEGORY_COLORS[cat] }}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Second filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value as Equipment | "all")} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent bg-white">
            <option value="all">All Equipment</option>
            {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq.charAt(0).toUpperCase() + eq.slice(1)}</option>)}
          </select>
          <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as Difficulty | "all")} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent bg-white">
            <option value="all">All Difficulties</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
          </select>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises..." className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent" />
          </div>
          {filtered.length > 0 && (
            <button onClick={toggleSelectAll} className="text-xs text-gray-500 hover:text-gray-700 underline whitespace-nowrap">
              {selectedIds.size === filtered.length ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c858]" />
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {!loading && exercises.length === 0 && (
        <div className="text-center py-20">
          <svg className="mx-auto w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No exercises yet</h3>
          <p className="text-sm text-gray-400 mb-6">Seed the library or add exercises manually</p>
          <button onClick={seedExercises} disabled={seeding} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {seeding ? "Seeding..." : `Seed ${SEED_EXERCISES.length} Exercises`}
          </button>
        </div>
      )}

      {/* ── Exercise Grid ─────────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((ex) => (
            <div key={ex.id} className={`bg-white rounded-xl p-5 shadow-sm border transition-all cursor-pointer hover:shadow-md ${selectedIds.has(ex.id) ? "border-[#20c858] ring-2 ring-[#20c858]/20" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <input type="checkbox" checked={selectedIds.has(ex.id)} onChange={() => toggleSelect(ex.id)} className="mt-1 w-4 h-4 rounded border-gray-300 text-[#20c858] focus:ring-[#20c858] cursor-pointer" onClick={(e) => e.stopPropagation()} />
                  {ex.illustration_url && (
                    <img src={ex.illustration_url} alt={ex.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1" onClick={() => { setEditingExercise({ ...ex }); setIsCreating(false); }}>
                    <h3 className="font-semibold text-gray-900 truncate">{ex.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ex.description}</p>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: ex.id, name: ex.name }); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full text-white" style={{ backgroundColor: CATEGORY_COLORS[ex.category] }}>
                  {ex.category}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600">
                  {ex.equipment}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full text-white" style={{ backgroundColor: DIFFICULTY_COLORS[ex.difficulty] }}>
                  {ex.difficulty}
                </span>
              </div>
              {/* Muscles */}
              {ex.muscles_targeted && ex.muscles_targeted.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {ex.muscles_targeted.map((m) => (
                    <span key={m} className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-500 rounded">{m}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── No results ────────────────────────────────────────────────────────── */}
      {!loading && exercises.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">No exercises match your filters</p>
          <button onClick={() => { setCategoryFilter("all"); setEquipmentFilter("all"); setDifficultyFilter("all"); setSearch(""); }} className="mt-2 text-sm text-[#20c858] hover:underline">Clear filters</button>
        </div>
      )}

      {/* ── Edit / Create Modal ───────────────────────────────────────────────── */}
      {editingExercise && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-10">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{isCreating ? "Add Exercise" : "Edit Exercise"}</h2>
              <button onClick={() => { setEditingExercise(null); setIsCreating(false); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={editingExercise.name || ""} onChange={(e) => setEditingExercise({ ...editingExercise, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent" placeholder="e.g. Barbell Bench Press" />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={editingExercise.description || ""} onChange={(e) => setEditingExercise({ ...editingExercise, description: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent resize-none" placeholder="Brief description of the exercise..." />
            </div>

            {/* Category pills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setEditingExercise({ ...editingExercise, category: cat })} className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors" style={{ backgroundColor: editingExercise.category === cat ? CATEGORY_COLORS[cat] : `${CATEGORY_COLORS[cat]}18`, color: editingExercise.category === cat ? "#fff" : CATEGORY_COLORS[cat] }}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
              <select value={editingExercise.equipment || "none"} onChange={(e) => setEditingExercise({ ...editingExercise, equipment: e.target.value as Equipment })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent bg-white">
                {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq.charAt(0).toUpperCase() + eq.slice(1)}</option>)}
              </select>
            </div>

            {/* Difficulty radio pills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <button key={d} onClick={() => setEditingExercise({ ...editingExercise, difficulty: d })} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors border ${editingExercise.difficulty === d ? "text-white border-transparent" : "text-gray-600 border-gray-300 hover:border-gray-400"}`} style={editingExercise.difficulty === d ? { backgroundColor: DIFFICULTY_COLORS[d] } : {}}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Instructions — dynamic list */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
              <div className="space-y-2">
                {(editingExercise.instructions || [""]).map((inst, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                    <input type="text" value={inst} onChange={(e) => {
                      const updated = [...(editingExercise.instructions || [""])];
                      updated[i] = e.target.value;
                      setEditingExercise({ ...editingExercise, instructions: updated });
                    }} className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent" placeholder={`Step ${i + 1}`} />
                    {(editingExercise.instructions || []).length > 1 && (
                      <button onClick={() => {
                        const updated = (editingExercise.instructions || []).filter((_, j) => j !== i);
                        setEditingExercise({ ...editingExercise, instructions: updated });
                      }} className="p-1 text-gray-400 hover:text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setEditingExercise({ ...editingExercise, instructions: [...(editingExercise.instructions || []), ""] })} className="text-xs text-[#20c858] hover:underline font-medium">+ Add step</button>
              </div>
            </div>

            {/* Muscles targeted — dynamic tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Muscles Targeted</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(editingExercise.muscles_targeted || []).map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                    {m}
                    <button onClick={() => {
                      const updated = (editingExercise.muscles_targeted || []).filter((_, j) => j !== i);
                      setEditingExercise({ ...editingExercise, muscles_targeted: updated });
                    }} className="text-gray-400 hover:text-red-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" id="muscle-input" placeholder="e.g. chest, triceps" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent" onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val && !(editingExercise.muscles_targeted || []).includes(val)) {
                      setEditingExercise({ ...editingExercise, muscles_targeted: [...(editingExercise.muscles_targeted || []), val] });
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }} />
                <button onClick={() => {
                  const input = document.getElementById("muscle-input") as HTMLInputElement;
                  const val = input?.value.trim();
                  if (val && !(editingExercise.muscles_targeted || []).includes(val)) {
                    setEditingExercise({ ...editingExercise, muscles_targeted: [...(editingExercise.muscles_targeted || []), val] });
                    input.value = "";
                  }
                }} className="px-3 py-1.5 text-xs font-medium text-[#20c858] border border-[#20c858] rounded-lg hover:bg-[#20c858]/5">Add</button>
              </div>
            </div>

            {/* Video URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (optional)</label>
              <input type="url" value={editingExercise.video_url || ""} onChange={(e) => setEditingExercise({ ...editingExercise, video_url: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent" placeholder="https://..." />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => { setEditingExercise(null); setIsCreating(false); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={saveExercise} className="px-5 py-2 text-sm font-medium text-white bg-[#20c858] rounded-lg hover:bg-[#1ab34e] transition-colors">
                {isCreating ? "Create Exercise" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
