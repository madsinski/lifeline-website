"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Intersection-observer-driven thumbnail. Renders a poster frame at first;
// when the card scrolls into view it lazily mounts a <video> + plays. When
// it scrolls back out, pauses to free the decoder. Without this, 800+
// simultaneous <video autoplay> elements tank Chrome on the exercises page.
function VideoThumb({ videoUrl, posterUrl, alt, className }: {
  videoUrl: string;
  posterUrl?: string | null;
  alt: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: null, rootMargin: "200px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {visible ? (
        <video
          src={videoUrl}
          autoPlay loop muted playsInline
          poster={posterUrl || undefined}
          className="w-full h-full object-cover"
          onEnded={(e) => { const v = e.target as HTMLVideoElement; v.currentTime = 0; v.play().catch(() => {}); }}
        />
      ) : posterUrl ? (
        <img src={posterUrl} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-100" />
      )}
    </div>
  );
}

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
  legs: "#10B981",
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
  "Flat Barbell Bench Press": `${IMG_BASE}Barbell_Bench_Press_-_Medium_Grip/0.jpg`,
  "Decline Barbell Bench Press": `${IMG_BASE}Decline_Barbell_Bench_Press/0.jpg`,
  "Dumbbell Bench Press": `${IMG_BASE}Dumbbell_Bench_Press/0.jpg`,
  "Incline Dumbbell Bench Press": `${IMG_BASE}Incline_Dumbbell_Press/0.jpg`,
  "Standard Push-Up": `${IMG_BASE}Pushups/0.jpg`,
  "Wide Push-Up": `${IMG_BASE}Pushups/0.jpg`,
  "Diamond Push-Up": `${IMG_BASE}Pushups/0.jpg`,
  "Dumbbell Chest Fly": `${IMG_BASE}Dumbbell_Flyes/0.jpg`,
  "Chest Dip": `${IMG_BASE}Dips_-_Chest_Version/0.jpg`,
  "Cable Crossover": `${IMG_BASE}Cable_Crossover/0.jpg`,
  "Pull-Up": `${IMG_BASE}Pullups/0.jpg`,
  "Chin-Up": `${IMG_BASE}Chin-Up/0.jpg`,
  "Lat Pulldown": `${IMG_BASE}Close-Grip_Front_Lat_Pulldown/0.jpg`,
  "Barbell Bent-Over Row": `${IMG_BASE}Bent_Over_Barbell_Row/0.jpg`,
  "Seated Cable Row": `${IMG_BASE}Seated_Cable_Rows/0.jpg`,
  "T-Bar Row": `${IMG_BASE}T-Bar_Row_with_Handle/0.jpg`,
  "Face Pull": `${IMG_BASE}Face_Pull/0.jpg`,
  "Conventional Deadlift": `${IMG_BASE}Barbell_Deadlift/0.jpg`,
  "Barbell Overhead Press": `${IMG_BASE}Barbell_Shoulder_Press/0.jpg`,
  "Seated Dumbbell Shoulder Press": `${IMG_BASE}Dumbbell_Shoulder_Press/0.jpg`,
  "Arnold Press": `${IMG_BASE}Arnold_Dumbbell_Press/0.jpg`,
  "Dumbbell Lateral Raise": `${IMG_BASE}Side_Lateral_Raise/0.jpg`,
  "Front Raise": `${IMG_BASE}Front_Dumbbell_Raise/0.jpg`,
  "Upright Row": `${IMG_BASE}Upright_Barbell_Row/0.jpg`,
  "Barbell Shrugs": `${IMG_BASE}Barbell_Shrug/0.jpg`,
  "Barbell Bicep Curl": `${IMG_BASE}Barbell_Curl/0.jpg`,
  "Dumbbell Bicep Curl": `${IMG_BASE}Dumbbell_Bicep_Curl/0.jpg`,
  "Hammer Curl": `${IMG_BASE}Alternate_Hammer_Curl/0.jpg`,
  "Preacher Curl": `${IMG_BASE}Preacher_Curl/0.jpg`,
  "Tricep Dip (Bench)": `${IMG_BASE}Bench_Dips/0.jpg`,
  "Tricep Pushdown": `${IMG_BASE}Triceps_Pushdown/0.jpg`,
  "Skull Crushers": `${IMG_BASE}Decline_Close-Grip_Bench_To_Skull_Crusher/0.jpg`,
  "Overhead Tricep Extension": `${IMG_BASE}Standing_Dumbbell_Triceps_Extension/0.jpg`,
  "Back Squat": `${IMG_BASE}Barbell_Full_Squat/0.jpg`,
  "Front Squat": `${IMG_BASE}Front_Squat_Clean_Grip/0.jpg`,
  "Goblet Squat": `${IMG_BASE}Goblet_Squat/0.jpg`,
  "Leg Press": `${IMG_BASE}Leg_Press/0.jpg`,
  "Walking Lunges": `${IMG_BASE}Barbell_Walking_Lunge/0.jpg`,
  "Reverse Lunge": `${IMG_BASE}Barbell_Lunge/0.jpg`,
  "Leg Extension": `${IMG_BASE}Leg_Extensions/0.jpg`,
  "Leg Curl": `${IMG_BASE}Lying_Leg_Curls/0.jpg`,
  "Standing Calf Raise": `${IMG_BASE}Standing_Calf_Raises/0.jpg`,
  "Hip Thrust": `${IMG_BASE}Barbell_Hip_Thrust/0.jpg`,
  "Romanian Deadlift": `${IMG_BASE}Romanian_Deadlift/0.jpg`,
  "Step-Up": `${IMG_BASE}Barbell_Step_Ups/0.jpg`,
  "Front Plank": `${IMG_BASE}Plank/0.jpg`,
  "Side Plank": `${IMG_BASE}Side_Bridge/0.jpg`,
  "Crunches": `${IMG_BASE}Crunches/0.jpg`,
  "Russian Twist": `${IMG_BASE}Russian_Twist/0.jpg`,
  "Hanging Leg Raise": `${IMG_BASE}Hanging_Leg_Raise/0.jpg`,
  "Mountain Climber": `${IMG_BASE}Mountain_Climbers/0.jpg`,
  "Dead Bug": `${IMG_BASE}Dead_Bug/0.jpg`,
  "Bird Dog": `${IMG_BASE}Superman/0.jpg`,
  "Ab Wheel Rollout": `${IMG_BASE}Ab_Roller/0.jpg`,
  "Jump Rope": `${IMG_BASE}Rope_Jumping/0.jpg`,
  "Burpees": `${IMG_BASE}Pushups/0.jpg`,
  "Jumping Jacks": `${IMG_BASE}Pushups/0.jpg`,
  "High Knees": `${IMG_BASE}Pushups/0.jpg`,
  // Chest
  "Incline Barbell Bench Press": `${IMG_BASE}Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg`,
  "Decline Push-Up": `${IMG_BASE}Decline_Push-Up/0.jpg`,
  "Cable Chest Fly": `${IMG_BASE}Butterfly/0.jpg`,
  "Machine Chest Press": `${IMG_BASE}Machine_Bench_Press/0.jpg`,
  "Svend Press": `${IMG_BASE}Svend_Press/0.jpg`,
  "Landmine Press": `${IMG_BASE}Clean_and_Press/0.jpg`,
  // Back
  "Hyperextension": `${IMG_BASE}Superman/0.jpg`,
  "Inverted Row": `${IMG_BASE}Inverted_Row/0.jpg`,
  "Dumbbell Single-Arm Row": `${IMG_BASE}One-Arm_Dumbbell_Row/0.jpg`,
  "Straight-Arm Pulldown": `${IMG_BASE}Straight-Arm_Pulldown/0.jpg`,
  "Pendlay Row": `${IMG_BASE}Bent_Over_Barbell_Row/0.jpg`,
  "Meadows Row": `${IMG_BASE}One-Arm_Dumbbell_Row/0.jpg`,
  "Rack Pull": `${IMG_BASE}Rack_Pulls/0.jpg`,
  "Dumbbell Pullover": `${IMG_BASE}Bent-Arm_Dumbbell_Pullover/0.jpg`,
  // Shoulders
  "Cable Lateral Raise": `${IMG_BASE}Side_Lateral_Raise/0.jpg`,
  "Rear Delt Fly": `${IMG_BASE}Seated_Bent-Over_Rear_Delt_Raise/0.jpg`,
  "Dumbbell Shrugs": `${IMG_BASE}Dumbbell_Shrug/0.jpg`,
  "Machine Shoulder Press": `${IMG_BASE}Leverage_Shoulder_Press/0.jpg`,
  "Reverse Pec Deck": `${IMG_BASE}Reverse_Flyes/0.jpg`,
  "Handstand Push-Up": `${IMG_BASE}Handstand_Push-Ups/0.jpg`,
  // Arms
  "Concentration Curl": `${IMG_BASE}Concentration_Curls/0.jpg`,
  "Cable Overhead Tricep Extension": `${IMG_BASE}Cable_Rope_Overhead_Triceps_Extension/0.jpg`,
  "Close-Grip Bench Press": `${IMG_BASE}Close-Grip_Barbell_Bench_Press/0.jpg`,
  "Wrist Curl": `${IMG_BASE}Palms-Down_Wrist_Curl_Over_A_Bench/0.jpg`,
  "Reverse Curl": `${IMG_BASE}Reverse_Barbell_Curl/0.jpg`,
  // Legs
  "Lateral Lunge": `${IMG_BASE}Groiners/0.jpg`,
  "Seated Calf Raise": `${IMG_BASE}Seated_Calf_Raise/0.jpg`,
  "Bulgarian Split Squat": `${IMG_BASE}Dumbbell_Lunges/0.jpg`,
  "Hack Squat": `${IMG_BASE}Hack_Squat/0.jpg`,
  // Core
  "Lying Leg Raise": `${IMG_BASE}Flat_Bench_Lying_Leg_Raise/0.jpg`,
  "Cable Woodchop": `${IMG_BASE}Cross-Body_Crunch/0.jpg`,
  "Hollow Hold": `${IMG_BASE}Jackknife_Sit-Up/0.jpg`,
  "Pallof Press": `${IMG_BASE}Pallof_Press/0.jpg`,
  // Cardio
  "Running": `${IMG_BASE}Rowing_Stationary/0.jpg`,
  "Cycling": `${IMG_BASE}Bicycling_Stationary/0.jpg`,
  "Rowing Machine": `${IMG_BASE}Rowing_Stationary/0.jpg`,
  "Stair Climbing": `${IMG_BASE}Stairmaster/0.jpg`,
  "Swimming": `${IMG_BASE}Rowing_Stationary/0.jpg`,
  "HIIT Intervals": `${IMG_BASE}Pushups/0.jpg`,
  "Elliptical Trainer": `${IMG_BASE}Elliptical_Trainer/0.jpg`,
  // Flexibility
  "Standing Hamstring Stretch": `${IMG_BASE}Hamstring_Stretch/0.jpg`,
  "Standing Quad Stretch": `${IMG_BASE}All_Fours_Quad_Stretch/0.jpg`,
  "Hip Flexor Stretch (Kneeling Lunge)": `${IMG_BASE}Kneeling_Hip_Flexor/0.jpg`,
  "Cat-Cow Stretch": `${IMG_BASE}Cat_Stretch/0.jpg`,
  "Child's Pose": `${IMG_BASE}Childs_Pose/0.jpg`,
  "Pigeon Pose": `${IMG_BASE}Groiners/0.jpg`,
  "Downward Dog": `${IMG_BASE}Cat_Stretch/0.jpg`,
  "Cobra Stretch": `${IMG_BASE}Cat_Stretch/0.jpg`,
  "Cross-Body Shoulder Stretch": `${IMG_BASE}Cross-Body_Crunch/0.jpg`,
  "Foam Rolling (Full Body)": `${IMG_BASE}Hamstring_Stretch/0.jpg`,
  "Seated Forward Fold": `${IMG_BASE}Seated_Floor_Hamstring_Stretch/0.jpg`,
  "Thoracic Spine Rotation": `${IMG_BASE}Cat_Stretch/0.jpg`,
  // Full-Body
  "Clean and Press": `${IMG_BASE}Clean_and_Press/0.jpg`,
  "Thrusters": `${IMG_BASE}Kettlebell_Thruster/0.jpg`,
  "Turkish Get-Up": `${IMG_BASE}Kettlebell_Turkish_Get-Up_Squat_style/0.jpg`,
  "Man Maker": `${IMG_BASE}One-Arm_Dumbbell_Row/0.jpg`,
  "Bear Crawl": `${IMG_BASE}Inchworm/0.jpg`,
  "Kettlebell Swing": `${IMG_BASE}One-Arm_Kettlebell_Swings/0.jpg`,
  "Battle Ropes": `${IMG_BASE}Battling_Ropes/0.jpg`,
  "Box Jump": `${IMG_BASE}Box_Jump_Multiple_Response/0.jpg`,
  "Wall Ball": `${IMG_BASE}Medicine_Ball_Chest_Pass/0.jpg`,
  "Sled Push": `${IMG_BASE}Sled_Drag_-_Harness/0.jpg`,
  "Farmers Walk": `${IMG_BASE}Farmers_Walk/0.jpg`,
  "Snatch (Barbell)": `${IMG_BASE}Snatch/0.jpg`,
};

// ── Seed Data ──────────────────────────────────────────────────────────────────

const SEED_EXERCISES: Omit<Exercise, "id" | "created_at" | "illustration_url">[] = [
  { name: "Flat Barbell Bench Press", description: "The classic chest builder. Lie on a flat bench and press a barbell from chest level to full arm extension.", category: "chest", equipment: "barbell", difficulty: "intermediate", instructions: ["Lie flat on a bench with your eyes under the bar and feet flat on the floor.", "Grip the bar slightly wider than shoulder-width and unrack it with straight arms.", "Lower the bar slowly to your mid-chest, keeping elbows at roughly 45 degrees.", "Press the bar back up to full lockout, exhaling as you push.", "Re-rack the bar carefully after completing your reps."], muscles_targeted: ["pectoralis major", "anterior deltoid", "triceps"], video_url: "" },
  { name: "Incline Barbell Bench Press", description: "Targets the upper chest by pressing on an incline bench set to 30-45 degrees.", category: "chest", equipment: "barbell", difficulty: "intermediate", instructions: ["Set the bench to a 30-45 degree incline and lie back with feet flat.", "Unrack the barbell with a shoulder-width or slightly wider grip.", "Lower the bar to your upper chest just below the collarbone.", "Press the bar straight up until your arms are fully extended.", "Control the weight on the way down for each rep."], muscles_targeted: ["upper pectoralis major", "anterior deltoid", "triceps"], video_url: "" },
  { name: "Decline Barbell Bench Press", description: "Emphasises the lower chest fibres by pressing on a decline bench.", category: "chest", equipment: "barbell", difficulty: "intermediate", instructions: ["Secure your legs at the end of a decline bench and lie back.", "Unrack the barbell with a shoulder-width grip.", "Lower the bar to your lower chest / upper abdomen area.", "Press the bar back up to lockout.", "Re-rack carefully; have a spotter if using heavy weight."], muscles_targeted: ["lower pectoralis major", "triceps", "anterior deltoid"], video_url: "" },
  { name: "Dumbbell Bench Press", description: "A dumbbell variation of the bench press that allows greater range of motion and independent arm work.", category: "chest", equipment: "dumbbells", difficulty: "beginner", instructions: ["Sit on a flat bench holding a dumbbell in each hand on your thighs.", "Lie back and press the dumbbells above your chest with palms facing forward.", "Lower both dumbbells slowly until your upper arms are parallel to the floor.", "Press back up, squeezing your chest at the top."], muscles_targeted: ["pectoralis major", "anterior deltoid", "triceps"], video_url: "" },
  { name: "Incline Dumbbell Bench Press", description: "Upper-chest focused dumbbell press performed on an incline bench.", category: "chest", equipment: "dumbbells", difficulty: "beginner", instructions: ["Set the bench to 30-45 degrees and sit with a dumbbell in each hand.", "Lie back and press the dumbbells above your upper chest.", "Lower with control until upper arms are roughly parallel to the floor.", "Press back up to full extension, keeping a slight arch in your back."], muscles_targeted: ["upper pectoralis major", "anterior deltoid", "triceps"], video_url: "" },
  { name: "Standard Push-Up", description: "A foundational bodyweight exercise that builds chest, shoulder, and tricep strength.", category: "chest", equipment: "bodyweight", difficulty: "beginner", instructions: ["Start in a high plank position with hands slightly wider than shoulder-width.", "Keep your body in a straight line from head to heels.", "Lower your chest toward the floor by bending your elbows.", "Push back up to the starting position, fully extending your arms."], muscles_targeted: ["pectoralis major", "triceps", "anterior deltoid", "core"], video_url: "" },
  { name: "Wide Push-Up", description: "A push-up variation with hands placed wider than normal to emphasise the outer chest.", category: "chest", equipment: "bodyweight", difficulty: "beginner", instructions: ["Get into a push-up position with hands placed well outside shoulder-width.", "Keep your core tight and body straight.", "Lower your chest to the floor, flaring elbows out to the sides.", "Press back up to full arm extension."], muscles_targeted: ["pectoralis major", "anterior deltoid", "triceps"], video_url: "" },
  { name: "Diamond Push-Up", description: "A push-up variation with hands close together in a diamond shape, heavily targeting the triceps and inner chest.", category: "chest", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Get into push-up position and place your hands together, forming a diamond shape with your thumbs and index fingers.", "Keep your elbows close to your body as you lower your chest toward your hands.", "Press back up to the starting position.", "Maintain a straight body line throughout the movement."], muscles_targeted: ["triceps", "inner pectoralis major", "anterior deltoid"], video_url: "" },
  { name: "Decline Push-Up", description: "Push-ups with feet elevated on a bench or step, shifting emphasis to the upper chest and shoulders.", category: "chest", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Place your feet on a bench or elevated surface behind you.", "Get into a push-up position with hands on the floor, shoulder-width apart.", "Lower your chest toward the floor while keeping your body straight.", "Push back up to full extension."], muscles_targeted: ["upper pectoralis major", "anterior deltoid", "triceps"], video_url: "" },
  { name: "Dumbbell Chest Fly", description: "An isolation exercise that stretches and contracts the chest through a wide arc of motion.", category: "chest", equipment: "dumbbells", difficulty: "beginner", instructions: ["Lie on a flat bench holding dumbbells above your chest with palms facing each other.", "With a slight bend in your elbows, lower the dumbbells out to the sides in a wide arc.", "Lower until you feel a deep stretch in your chest.", "Squeeze your chest to bring the dumbbells back together above you."], muscles_targeted: ["pectoralis major", "anterior deltoid"], video_url: "" },
  { name: "Cable Chest Fly", description: "A cable-based fly that provides constant tension throughout the range of motion.", category: "chest", equipment: "cables", difficulty: "beginner", instructions: ["Set both cable pulleys to chest height and grasp one handle in each hand.", "Step forward so you feel a stretch in your chest with arms extended to the sides.", "Bring your hands together in front of your chest in a hugging motion.", "Slowly return to the stretched position with control."], muscles_targeted: ["pectoralis major", "anterior deltoid"], video_url: "" },
  { name: "Chest Dip", description: "A compound bodyweight exercise performed on parallel bars, leaning forward to emphasise the chest.", category: "chest", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Grip the parallel bars and lift yourself to the starting position with arms straight.", "Lean your torso forward about 30 degrees.", "Lower yourself by bending your elbows until you feel a stretch in your chest.", "Press back up to the starting position without fully locking out."], muscles_targeted: ["pectoralis major", "triceps", "anterior deltoid"], video_url: "" },
  { name: "Cable Crossover", description: "A standing cable exercise that targets the chest from high to low or low to high angles.", category: "chest", equipment: "cables", difficulty: "intermediate", instructions: ["Set cable pulleys to the highest position and grab a handle in each hand.", "Step forward and lean slightly, arms extended out to the sides.", "Pull the handles down and together in front of your hips in a sweeping arc.", "Slowly return to the starting position, feeling the stretch in your chest."], muscles_targeted: ["pectoralis major", "anterior deltoid"], video_url: "" },
  { name: "Machine Chest Press", description: "A machine-based pressing movement that provides a guided path, great for beginners or high-rep finishers.", category: "chest", equipment: "machine", difficulty: "beginner", instructions: ["Adjust the seat so the handles are at chest height.", "Sit with your back flat against the pad and grasp the handles.", "Press the handles forward until your arms are fully extended.", "Return slowly to the starting position."], muscles_targeted: ["pectoralis major", "triceps", "anterior deltoid"], video_url: "" },
  { name: "Svend Press", description: "An unusual pressing movement where you squeeze two plates together and press them out in front of your chest.", category: "chest", equipment: "other", difficulty: "beginner", instructions: ["Stand upright holding two small weight plates squeezed together at chest level.", "Press the plates outward in front of you while continuing to squeeze them together.", "Extend your arms fully, focusing on the chest contraction.", "Bring the plates back to your chest and repeat."], muscles_targeted: ["inner pectoralis major", "anterior deltoid"], video_url: "" },
  { name: "Landmine Press", description: "A single-arm pressing movement using a barbell anchored in a landmine attachment, great for upper chest.", category: "chest", equipment: "barbell", difficulty: "intermediate", instructions: ["Place one end of a barbell in a landmine attachment or corner.", "Stand facing the barbell and hold the free end at shoulder height with one hand.", "Press the barbell up and forward until your arm is extended.", "Lower it back to shoulder height with control."], muscles_targeted: ["upper pectoralis major", "anterior deltoid", "triceps"], video_url: "" },
  { name: "Pull-Up", description: "The king of back exercises. Hang from a bar and pull yourself up until your chin clears the bar.", category: "back", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Hang from a pull-up bar with an overhand grip, hands slightly wider than shoulder-width.", "Engage your lats and pull yourself up until your chin is above the bar.", "Lower yourself with control back to a full hang.", "Avoid swinging or using momentum."], muscles_targeted: ["latissimus dorsi", "biceps", "rhomboids", "rear deltoid"], video_url: "" },
  { name: "Chin-Up", description: "An underhand grip variation of the pull-up that recruits more bicep involvement.", category: "back", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Hang from a bar with a supinated (underhand) grip, hands shoulder-width apart.", "Pull yourself up until your chin clears the bar.", "Lower with control to a dead hang.", "Keep your core engaged throughout."], muscles_targeted: ["latissimus dorsi", "biceps", "lower trapezius"], video_url: "" },
  { name: "Lat Pulldown", description: "A cable machine exercise that mimics the pull-up motion and is excellent for building lat width.", category: "back", equipment: "cables", difficulty: "beginner", instructions: ["Sit at a lat pulldown machine and secure your thighs under the pads.", "Grasp the wide bar with an overhand grip.", "Pull the bar down to your upper chest while squeezing your shoulder blades together.", "Slowly extend your arms back up to the starting position."], muscles_targeted: ["latissimus dorsi", "biceps", "rhomboids"], video_url: "" },
  { name: "Barbell Bent-Over Row", description: "A compound rowing movement that builds overall back thickness and strength.", category: "back", equipment: "barbell", difficulty: "intermediate", instructions: ["Stand with feet hip-width apart, holding a barbell with an overhand grip.", "Hinge at the hips until your torso is roughly 45 degrees to the floor.", "Pull the barbell to your lower chest / upper abdomen, squeezing your back.", "Lower the bar with control and repeat."], muscles_targeted: ["latissimus dorsi", "rhomboids", "trapezius", "biceps"], video_url: "" },
  { name: "Dumbbell Single-Arm Row", description: "A unilateral rowing exercise that lets you focus on each side of your back independently.", category: "back", equipment: "dumbbells", difficulty: "beginner", instructions: ["Place one knee and hand on a bench for support, holding a dumbbell in the other hand.", "Let the dumbbell hang at arm's length below your shoulder.", "Row the dumbbell up to your hip, squeezing your lat at the top.", "Lower it back down with control and repeat before switching sides."], muscles_targeted: ["latissimus dorsi", "rhomboids", "biceps"], video_url: "" },
  { name: "Seated Cable Row", description: "A cable machine row performed seated that builds mid-back thickness.", category: "back", equipment: "cables", difficulty: "beginner", instructions: ["Sit at the cable row station with feet on the footplate and knees slightly bent.", "Grasp the V-bar or straight bar attachment.", "Pull the handle to your lower chest, squeezing your shoulder blades together.", "Extend your arms back to the start with control, keeping your torso upright."], muscles_targeted: ["rhomboids", "latissimus dorsi", "trapezius", "biceps"], video_url: "" },
  { name: "T-Bar Row", description: "A heavy compound row using a T-bar or landmine setup that targets the mid-back.", category: "back", equipment: "barbell", difficulty: "intermediate", instructions: ["Straddle the T-bar or landmine barbell and grip the handle.", "Hinge at the hips with a flat back.", "Row the weight up toward your chest, driving your elbows back.", "Lower with control and maintain your hip hinge throughout."], muscles_targeted: ["latissimus dorsi", "rhomboids", "trapezius", "biceps"], video_url: "" },
  { name: "Face Pull", description: "A rear delt and upper-back exercise using a cable rope attachment, excellent for shoulder health.", category: "back", equipment: "cables", difficulty: "beginner", instructions: ["Set a cable pulley to upper chest height and attach a rope.", "Grasp both ends of the rope with an overhand grip.", "Pull the rope toward your face, separating the ends as you pull.", "Squeeze your rear delts and upper back, then return with control."], muscles_targeted: ["rear deltoid", "rhomboids", "trapezius"], video_url: "" },
  { name: "Conventional Deadlift", description: "The ultimate full-posterior-chain exercise. Lift a loaded barbell from the floor to hip level.", category: "back", equipment: "barbell", difficulty: "advanced", instructions: ["Stand with feet hip-width apart, barbell over mid-foot.", "Hinge at the hips and grip the bar just outside your legs.", "Brace your core, flatten your back, and drive through your heels to stand up.", "Lock out at the top with hips and knees fully extended.", "Reverse the movement to return the bar to the floor."], muscles_targeted: ["erector spinae", "glutes", "hamstrings", "trapezius", "forearms"], video_url: "" },
  { name: "Hyperextension", description: "A lower-back strengthening exercise performed on a 45-degree or flat hyperextension bench.", category: "back", equipment: "bodyweight", difficulty: "beginner", instructions: ["Position yourself on the hyperextension bench with hips on the pad and feet secured.", "Cross your arms over your chest or behind your head.", "Lower your torso toward the floor by hinging at the hips.", "Raise back up until your body forms a straight line; do not over-extend."], muscles_targeted: ["erector spinae", "glutes", "hamstrings"], video_url: "" },
  { name: "Inverted Row", description: "A bodyweight row performed hanging under a bar, perfect for building up to pull-ups.", category: "back", equipment: "bodyweight", difficulty: "beginner", instructions: ["Set a bar at about waist height and lie underneath it.", "Grasp the bar with an overhand grip, body straight and heels on the floor.", "Pull your chest up to the bar, squeezing your shoulder blades.", "Lower yourself back down with control."], muscles_targeted: ["latissimus dorsi", "rhomboids", "biceps", "rear deltoid"], video_url: "" },
  { name: "Straight-Arm Pulldown", description: "A cable isolation exercise that targets the lats without significant bicep involvement.", category: "back", equipment: "cables", difficulty: "beginner", instructions: ["Stand facing a cable machine with the pulley set high; attach a straight bar.", "Grip the bar with straight arms and step back slightly.", "With a slight bend in your elbows, push the bar down in an arc to your thighs.", "Slowly return to the starting position, feeling the stretch in your lats."], muscles_targeted: ["latissimus dorsi", "teres major"], video_url: "" },
  { name: "Pendlay Row", description: "A strict barbell row where the bar returns to the floor between each rep for explosive pulling power.", category: "back", equipment: "barbell", difficulty: "advanced", instructions: ["Stand over the barbell with feet hip-width apart, barbell on the floor.", "Hinge at the hips until your torso is parallel to the floor.", "Explosively row the barbell to your lower chest.", "Lower the bar back to the floor and reset before each rep."], muscles_targeted: ["latissimus dorsi", "rhomboids", "trapezius", "biceps"], video_url: "" },
  { name: "Meadows Row", description: "A single-arm landmine row variation that uniquely targets the lats with a long range of motion.", category: "back", equipment: "barbell", difficulty: "intermediate", instructions: ["Stand perpendicular to a landmine barbell with the end at your side.", "Stagger your stance with the near foot slightly back.", "Grip the end of the barbell with an overhand grip and row it to your hip.", "Lower with a full stretch and repeat before switching sides."], muscles_targeted: ["latissimus dorsi", "teres major", "rear deltoid"], video_url: "" },
  { name: "Rack Pull", description: "A partial-range deadlift performed from pins in a power rack, focusing on the lockout and upper back.", category: "back", equipment: "barbell", difficulty: "intermediate", instructions: ["Set the pins in a power rack to just below knee height.", "Stand over the barbell and grip it with a double overhand or mixed grip.", "Brace your core and stand up by driving your hips forward.", "Lower the bar back to the pins with control."], muscles_targeted: ["trapezius", "erector spinae", "glutes", "forearms"], video_url: "" },
  { name: "Dumbbell Pullover", description: "A classic exercise that stretches and works the lats and chest through a large range of motion.", category: "back", equipment: "dumbbells", difficulty: "intermediate", instructions: ["Lie across a flat bench supporting your upper back, feet on the floor.", "Hold a single dumbbell overhead with both hands, arms slightly bent.", "Lower the dumbbell behind your head in an arc until you feel a deep stretch.", "Pull the dumbbell back over your chest by engaging your lats."], muscles_targeted: ["latissimus dorsi", "pectoralis major", "triceps"], video_url: "" },
  { name: "Barbell Overhead Press", description: "A standing compound press that is the primary mass builder for the shoulders.", category: "shoulders", equipment: "barbell", difficulty: "intermediate", instructions: ["Stand with feet shoulder-width apart, barbell racked at collarbone height.", "Grip the bar slightly wider than shoulder-width.", "Press the bar overhead until your arms are locked out.", "Lower the bar back to your collarbone with control.", "Keep your core braced and avoid excessive back lean."], muscles_targeted: ["anterior deltoid", "lateral deltoid", "triceps", "upper chest"], video_url: "" },
  { name: "Seated Dumbbell Shoulder Press", description: "A seated pressing movement with dumbbells that allows independent arm work for balanced shoulder development.", category: "shoulders", equipment: "dumbbells", difficulty: "beginner", instructions: ["Sit on a bench with back support, holding a dumbbell in each hand at shoulder height.", "Press both dumbbells overhead until your arms are extended.", "Lower the dumbbells back to shoulder height.", "Keep your back pressed against the pad throughout."], muscles_targeted: ["anterior deltoid", "lateral deltoid", "triceps"], video_url: "" },
  { name: "Arnold Press", description: "A rotational dumbbell press named after Arnold Schwarzenegger that hits all three deltoid heads.", category: "shoulders", equipment: "dumbbells", difficulty: "intermediate", instructions: ["Sit and hold dumbbells at shoulder height with palms facing you.", "As you press upward, rotate your palms to face forward.", "Fully extend your arms overhead.", "Reverse the rotation as you lower the dumbbells back to the start."], muscles_targeted: ["anterior deltoid", "lateral deltoid", "rear deltoid", "triceps"], video_url: "" },
  { name: "Dumbbell Lateral Raise", description: "An isolation exercise that targets the lateral (side) head of the deltoid for wider-looking shoulders.", category: "shoulders", equipment: "dumbbells", difficulty: "beginner", instructions: ["Stand holding a dumbbell in each hand at your sides.", "With a slight bend in your elbows, raise the dumbbells out to the sides.", "Lift until your arms are parallel to the floor.", "Lower slowly back to your sides."], muscles_targeted: ["lateral deltoid"], video_url: "" },
  { name: "Cable Lateral Raise", description: "A lateral raise using a low cable for constant tension throughout the movement.", category: "shoulders", equipment: "cables", difficulty: "beginner", instructions: ["Stand sideways to a low cable pulley, grasping the handle with the far hand.", "With a slight elbow bend, raise your arm out to the side to shoulder height.", "Lower with control back to the start.", "Complete all reps then switch sides."], muscles_targeted: ["lateral deltoid"], video_url: "" },
  { name: "Front Raise", description: "An isolation exercise that targets the anterior (front) deltoid by raising weight in front of you.", category: "shoulders", equipment: "dumbbells", difficulty: "beginner", instructions: ["Stand holding dumbbells in front of your thighs with palms facing you.", "Raise one or both dumbbells in front of you to shoulder height.", "Keep a slight bend in your elbows throughout.", "Lower slowly and repeat."], muscles_targeted: ["anterior deltoid"], video_url: "" },
  { name: "Rear Delt Fly", description: "An isolation exercise for the rear deltoids, performed bent over or on a machine.", category: "shoulders", equipment: "dumbbells", difficulty: "beginner", instructions: ["Bend at the hips so your torso is nearly parallel to the floor, dumbbells hanging below.", "With a slight bend in your elbows, raise the dumbbells out to the sides.", "Squeeze your rear delts at the top of the movement.", "Lower slowly back to the starting position."], muscles_targeted: ["rear deltoid", "rhomboids"], video_url: "" },
  { name: "Upright Row", description: "A pulling movement that targets the lateral deltoids and upper traps.", category: "shoulders", equipment: "barbell", difficulty: "intermediate", instructions: ["Stand holding a barbell in front of your thighs with a narrow grip.", "Pull the bar straight up along your body toward your chin.", "Lead with your elbows, raising them above your hands.", "Lower the bar back to the starting position with control."], muscles_targeted: ["lateral deltoid", "trapezius", "biceps"], video_url: "" },
  { name: "Barbell Shrugs", description: "An isolation exercise for the upper trapezius muscles. Shrug the shoulders up toward the ears.", category: "shoulders", equipment: "barbell", difficulty: "beginner", instructions: ["Stand holding a barbell at arm's length in front of you.", "Shrug your shoulders straight up toward your ears.", "Hold the contraction at the top for a second.", "Lower your shoulders back down with control."], muscles_targeted: ["upper trapezius"], video_url: "" },
  { name: "Dumbbell Shrugs", description: "A trap-building exercise using dumbbells at your sides for a more natural arm path.", category: "shoulders", equipment: "dumbbells", difficulty: "beginner", instructions: ["Stand holding a dumbbell in each hand at your sides.", "Shrug both shoulders up toward your ears.", "Squeeze at the top and hold briefly.", "Lower with control."], muscles_targeted: ["upper trapezius"], video_url: "" },
  { name: "Machine Shoulder Press", description: "A shoulder press performed on a machine for a guided, stable pressing path.", category: "shoulders", equipment: "machine", difficulty: "beginner", instructions: ["Adjust the seat so the handles are at shoulder height.", "Sit with your back against the pad and grasp the handles.", "Press the handles overhead until your arms are extended.", "Lower back to the starting position with control."], muscles_targeted: ["anterior deltoid", "lateral deltoid", "triceps"], video_url: "" },
  { name: "Reverse Pec Deck", description: "A machine exercise targeting the rear delts by performing a reverse fly motion.", category: "shoulders", equipment: "machine", difficulty: "beginner", instructions: ["Sit facing the pec deck machine pad and grasp the handles.", "With a slight bend in your elbows, push the handles apart behind you.", "Squeeze your rear delts at the fully open position.", "Return slowly to the starting position."], muscles_targeted: ["rear deltoid", "rhomboids"], video_url: "" },
  { name: "Handstand Push-Up", description: "An advanced bodyweight shoulder press performed in a handstand position against a wall.", category: "shoulders", equipment: "bodyweight", difficulty: "advanced", instructions: ["Kick up into a handstand against a wall, hands shoulder-width apart.", "Lower yourself by bending your elbows until your head lightly touches the floor.", "Press back up to full arm extension.", "Maintain core tension and avoid arching your back."], muscles_targeted: ["anterior deltoid", "lateral deltoid", "triceps", "trapezius"], video_url: "" },
  { name: "Barbell Bicep Curl", description: "The classic bicep builder. Curl a barbell from hip level to shoulder height.", category: "arms", equipment: "barbell", difficulty: "beginner", instructions: ["Stand holding a barbell with an underhand grip, arms fully extended.", "Curl the bar up toward your shoulders by flexing your elbows.", "Squeeze your biceps at the top.", "Lower the bar back down with control; avoid swinging."], muscles_targeted: ["biceps", "brachialis", "forearms"], video_url: "" },
  { name: "Dumbbell Bicep Curl", description: "A staple arm exercise using dumbbells, allowing supination for a full bicep contraction.", category: "arms", equipment: "dumbbells", difficulty: "beginner", instructions: ["Stand holding a dumbbell in each hand at your sides, palms facing forward.", "Curl both dumbbells up toward your shoulders.", "Squeeze your biceps at the top of the movement.", "Lower slowly back to the starting position."], muscles_targeted: ["biceps", "brachialis"], video_url: "" },
  { name: "Hammer Curl", description: "A curl variation with a neutral grip that targets the brachialis and forearms in addition to the biceps.", category: "arms", equipment: "dumbbells", difficulty: "beginner", instructions: ["Stand holding dumbbells at your sides with palms facing each other (neutral grip).", "Curl both dumbbells up without rotating your wrists.", "Squeeze at the top and lower with control.", "Keep your elbows pinned to your sides throughout."], muscles_targeted: ["brachialis", "biceps", "brachioradialis"], video_url: "" },
  { name: "Preacher Curl", description: "A bicep curl performed on a preacher bench that eliminates momentum and isolates the biceps.", category: "arms", equipment: "barbell", difficulty: "intermediate", instructions: ["Sit at a preacher bench and place the backs of your upper arms on the pad.", "Hold an EZ-curl bar or barbell with an underhand grip.", "Curl the weight up toward your shoulders.", "Lower slowly, fully extending your arms at the bottom."], muscles_targeted: ["biceps", "brachialis"], video_url: "" },
  { name: "Concentration Curl", description: "A seated single-arm curl that provides peak contraction isolation for the biceps.", category: "arms", equipment: "dumbbells", difficulty: "beginner", instructions: ["Sit on a bench and brace the back of one arm against your inner thigh.", "Hold a dumbbell with your arm fully extended.", "Curl the weight up toward your shoulder, squeezing the bicep hard.", "Lower slowly and repeat; switch arms after completing the set."], muscles_targeted: ["biceps"], video_url: "" },
  { name: "Tricep Dip (Bench)", description: "A bodyweight tricep exercise performed with hands on a bench behind you.", category: "arms", equipment: "bodyweight", difficulty: "beginner", instructions: ["Sit on the edge of a bench and place your hands beside your hips.", "Slide your hips off the bench, supporting yourself with your arms.", "Lower your body by bending your elbows to about 90 degrees.", "Press back up to full arm extension."], muscles_targeted: ["triceps", "anterior deltoid"], video_url: "" },
  { name: "Tricep Pushdown", description: "A cable isolation exercise for the triceps using a rope or straight bar attachment.", category: "arms", equipment: "cables", difficulty: "beginner", instructions: ["Stand at a cable machine with the pulley set high; attach a rope or bar.", "Grasp the attachment and tuck your elbows to your sides.", "Push the attachment down by extending your elbows fully.", "Slowly let the weight return to the starting position without flaring your elbows."], muscles_targeted: ["triceps"], video_url: "" },
  { name: "Skull Crushers", description: "A lying tricep extension where you lower a barbell or dumbbells toward your forehead.", category: "arms", equipment: "barbell", difficulty: "intermediate", instructions: ["Lie on a flat bench holding an EZ-curl bar above your chest with arms extended.", "Keeping your upper arms stationary, bend your elbows to lower the bar toward your forehead.", "Stop just above your forehead and extend your arms back up.", "Keep your elbows pointing toward the ceiling throughout."], muscles_targeted: ["triceps"], video_url: "" },
  { name: "Overhead Tricep Extension", description: "A tricep exercise performed overhead with a dumbbell or cable to target the long head.", category: "arms", equipment: "dumbbells", difficulty: "beginner", instructions: ["Stand or sit holding a dumbbell overhead with both hands.", "Lower the dumbbell behind your head by bending your elbows.", "Keep your upper arms close to your ears.", "Extend your arms back to the starting position."], muscles_targeted: ["triceps (long head)"], video_url: "" },
  { name: "Cable Overhead Tricep Extension", description: "A cable variation of the overhead extension that provides constant tension on the tricep long head.", category: "arms", equipment: "cables", difficulty: "beginner", instructions: ["Attach a rope to a low cable pulley and face away from the machine.", "Hold the rope behind your head with elbows bent.", "Extend your arms overhead until fully straight.", "Lower back behind your head with control."], muscles_targeted: ["triceps (long head)"], video_url: "" },
  { name: "Close-Grip Bench Press", description: "A bench press with a narrow grip that shifts emphasis from the chest to the triceps.", category: "arms", equipment: "barbell", difficulty: "intermediate", instructions: ["Lie on a flat bench and grip the barbell with hands about shoulder-width apart.", "Unrack the bar and lower it to your lower chest, keeping elbows close to your body.", "Press the bar back up to full lockout.", "Focus on feeling the triceps working throughout."], muscles_targeted: ["triceps", "pectoralis major", "anterior deltoid"], video_url: "" },
  { name: "Wrist Curl", description: "An isolation exercise for the forearm flexors performed seated with a barbell or dumbbells.", category: "arms", equipment: "barbell", difficulty: "beginner", instructions: ["Sit on a bench and rest your forearms on your thighs, wrists hanging off your knees.", "Hold a barbell with an underhand grip.", "Curl your wrists upward, squeezing your forearms.", "Lower slowly and repeat."], muscles_targeted: ["forearm flexors"], video_url: "" },
  { name: "Reverse Curl", description: "A curl performed with an overhand grip to target the brachioradialis and forearm extensors.", category: "arms", equipment: "barbell", difficulty: "intermediate", instructions: ["Stand holding a barbell with an overhand (pronated) grip at arm's length.", "Curl the bar up toward your shoulders, keeping your elbows pinned.", "Squeeze at the top.", "Lower the bar slowly to the starting position."], muscles_targeted: ["brachioradialis", "forearm extensors", "biceps"], video_url: "" },
  { name: "Back Squat", description: "The foundational lower-body compound exercise. A barbell is placed across the upper back and you squat down.", category: "legs", equipment: "barbell", difficulty: "intermediate", instructions: ["Position the barbell across your upper traps and step back from the rack.", "Stand with feet shoulder-width apart, toes slightly pointed out.", "Brace your core and squat down until your thighs are at least parallel to the floor.", "Drive through your heels to stand back up.", "Keep your chest up and knees tracking over your toes."], muscles_targeted: ["quadriceps", "glutes", "hamstrings", "core"], video_url: "" },
  { name: "Front Squat", description: "A squat variation with the barbell held in front across the shoulders, emphasising the quads and core.", category: "legs", equipment: "barbell", difficulty: "advanced", instructions: ["Rack the barbell across the front of your shoulders in a clean grip or cross-arm grip.", "Unrack and step back with feet shoulder-width apart.", "Squat down keeping your torso as upright as possible.", "Drive up through your heels to stand.", "Keep your elbows high throughout to prevent the bar from rolling forward."], muscles_targeted: ["quadriceps", "glutes", "core", "upper back"], video_url: "" },
  { name: "Goblet Squat", description: "A beginner-friendly squat holding a dumbbell or kettlebell at chest level.", category: "legs", equipment: "dumbbells", difficulty: "beginner", instructions: ["Hold a dumbbell vertically at chest height with both hands cupping one end.", "Stand with feet slightly wider than shoulder-width.", "Squat down, keeping the weight close to your chest and your elbows between your knees.", "Stand back up by driving through your heels."], muscles_targeted: ["quadriceps", "glutes", "core"], video_url: "" },
  { name: "Leg Press", description: "A machine-based compound leg exercise that allows you to load heavy weight safely.", category: "legs", equipment: "machine", difficulty: "beginner", instructions: ["Sit in the leg press machine with your back and head against the pad.", "Place your feet on the platform about shoulder-width apart.", "Release the safety handles and lower the platform by bending your knees.", "Press the platform back up without fully locking your knees."], muscles_targeted: ["quadriceps", "glutes", "hamstrings"], video_url: "" },
  { name: "Walking Lunges", description: "A dynamic lunge variation where you step forward continuously, building single-leg strength and balance.", category: "legs", equipment: "bodyweight", difficulty: "beginner", instructions: ["Stand with feet together, hands on hips or holding dumbbells.", "Step forward with one leg and lower your back knee toward the floor.", "Push off the front foot and step the back leg forward into the next lunge.", "Continue alternating legs as you walk forward."], muscles_targeted: ["quadriceps", "glutes", "hamstrings"], video_url: "" },
  { name: "Reverse Lunge", description: "A lunge variation where you step backward, which is easier on the knees and emphasises the glutes.", category: "legs", equipment: "bodyweight", difficulty: "beginner", instructions: ["Stand with feet together.", "Step one leg backward and lower your back knee toward the floor.", "Keep your front shin vertical and torso upright.", "Push off the back foot to return to standing."], muscles_targeted: ["glutes", "quadriceps", "hamstrings"], video_url: "" },
  { name: "Lateral Lunge", description: "A side lunge that targets the inner thighs and glutes while improving lateral mobility.", category: "legs", equipment: "bodyweight", difficulty: "beginner", instructions: ["Stand with feet together.", "Take a large step to one side, bending that knee and sitting your hips back.", "Keep the trailing leg straight.", "Push off the bent leg to return to the starting position."], muscles_targeted: ["adductors", "glutes", "quadriceps"], video_url: "" },
  { name: "Leg Extension", description: "A machine isolation exercise for the quadriceps.", category: "legs", equipment: "machine", difficulty: "beginner", instructions: ["Sit in the leg extension machine with the pad against your lower shins.", "Extend your legs to fully straighten your knees.", "Squeeze your quads at the top.", "Lower the weight back slowly."], muscles_targeted: ["quadriceps"], video_url: "" },
  { name: "Leg Curl", description: "A machine isolation exercise for the hamstrings, performed lying or seated.", category: "legs", equipment: "machine", difficulty: "beginner", instructions: ["Lie face down on the leg curl machine with the pad behind your ankles.", "Curl your heels toward your glutes by bending your knees.", "Squeeze your hamstrings at the top.", "Lower the weight back with control."], muscles_targeted: ["hamstrings"], video_url: "" },
  { name: "Standing Calf Raise", description: "An isolation exercise for the calves performed standing on a platform or machine.", category: "legs", equipment: "machine", difficulty: "beginner", instructions: ["Stand on the edge of a step or calf raise machine with heels hanging off.", "Rise up on your toes as high as possible.", "Hold the contraction at the top for a second.", "Lower your heels below the platform for a full stretch."], muscles_targeted: ["gastrocnemius", "soleus"], video_url: "" },
  { name: "Seated Calf Raise", description: "A calf exercise targeting the soleus muscle, performed seated with weight on the knees.", category: "legs", equipment: "machine", difficulty: "beginner", instructions: ["Sit in the seated calf raise machine with the pad on your lower thighs.", "Place the balls of your feet on the platform.", "Push up on your toes, raising your heels as high as possible.", "Lower slowly for a full stretch."], muscles_targeted: ["soleus", "gastrocnemius"], video_url: "" },
  { name: "Hip Thrust", description: "The premier glute-building exercise. Drive your hips up against a barbell resting across your lap.", category: "legs", equipment: "barbell", difficulty: "intermediate", instructions: ["Sit on the floor with your upper back against a bench and a barbell across your hips.", "Plant your feet flat on the floor, about shoulder-width apart.", "Drive your hips up by squeezing your glutes until your body forms a straight line from shoulders to knees.", "Lower your hips back down with control."], muscles_targeted: ["glutes", "hamstrings"], video_url: "" },
  { name: "Romanian Deadlift", description: "A hip-hinge movement that targets the hamstrings and glutes by lowering a barbell with minimal knee bend.", category: "legs", equipment: "barbell", difficulty: "intermediate", instructions: ["Stand holding a barbell at hip height with a shoulder-width grip.", "Push your hips back and lower the bar along your legs, keeping a slight knee bend.", "Lower until you feel a deep stretch in your hamstrings.", "Drive your hips forward to return to standing.", "Keep the bar close to your body and maintain a flat back."], muscles_targeted: ["hamstrings", "glutes", "erector spinae"], video_url: "" },
  { name: "Step-Up", description: "A unilateral leg exercise where you step onto an elevated platform, building single-leg strength.", category: "legs", equipment: "bodyweight", difficulty: "beginner", instructions: ["Stand in front of a box or bench at about knee height.", "Place one foot entirely on the platform.", "Drive through that foot to step up, bringing the other foot to the top.", "Step back down and repeat; complete all reps on one side before switching."], muscles_targeted: ["quadriceps", "glutes"], video_url: "" },
  { name: "Bulgarian Split Squat", description: "A challenging single-leg squat with the rear foot elevated on a bench behind you.", category: "legs", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Stand about two feet in front of a bench and place one foot on the bench behind you.", "Lower your hips straight down until your front thigh is parallel to the floor.", "Push through your front heel to stand back up.", "Keep your torso upright throughout."], muscles_targeted: ["quadriceps", "glutes", "hamstrings"], video_url: "" },
  { name: "Hack Squat", description: "A machine squat variation that emphasises the quadriceps with back support.", category: "legs", equipment: "machine", difficulty: "intermediate", instructions: ["Position yourself in the hack squat machine with your back against the pad.", "Place your feet shoulder-width apart on the platform.", "Release the safety handles and lower yourself by bending your knees.", "Press back up to the starting position without locking your knees."], muscles_targeted: ["quadriceps", "glutes"], video_url: "" },
  { name: "Front Plank", description: "An isometric core exercise that builds endurance in the abs, obliques, and deep stabiliser muscles.", category: "core", equipment: "bodyweight", difficulty: "beginner", instructions: ["Start on the floor in a forearm plank position, elbows under shoulders.", "Engage your core and glutes to keep your body in a straight line.", "Hold the position without letting your hips sag or pike up.", "Breathe steadily and hold for the prescribed time."], muscles_targeted: ["rectus abdominis", "transverse abdominis", "obliques"], video_url: "" },
  { name: "Side Plank", description: "An isometric hold on one forearm that targets the obliques and lateral core stability.", category: "core", equipment: "bodyweight", difficulty: "beginner", instructions: ["Lie on your side and prop yourself up on your forearm, elbow directly under your shoulder.", "Stack your feet and lift your hips off the floor.", "Keep your body in a straight line from head to feet.", "Hold for the prescribed time, then switch sides."], muscles_targeted: ["obliques", "transverse abdominis", "glute medius"], video_url: "" },
  { name: "Crunches", description: "A basic abdominal exercise that targets the upper rectus abdominis.", category: "core", equipment: "bodyweight", difficulty: "beginner", instructions: ["Lie on your back with knees bent, feet flat on the floor.", "Place your hands behind your head or across your chest.", "Curl your shoulders off the floor by contracting your abs.", "Lower back down with control without fully resting your shoulders."], muscles_targeted: ["rectus abdominis"], video_url: "" },
  { name: "Russian Twist", description: "A rotational core exercise performed seated with feet off the ground, targeting the obliques.", category: "core", equipment: "bodyweight", difficulty: "beginner", instructions: ["Sit on the floor with knees bent and lean back slightly, lifting your feet off the ground.", "Hold your hands together or hold a weight at chest level.", "Rotate your torso to one side, bringing the weight beside your hip.", "Rotate to the other side in a controlled manner."], muscles_targeted: ["obliques", "rectus abdominis"], video_url: "" },
  { name: "Hanging Leg Raise", description: "An advanced core exercise performed hanging from a bar, targeting the lower abs and hip flexors.", category: "core", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Hang from a pull-up bar with an overhand grip, arms fully extended.", "Keeping your legs straight, raise them in front of you to at least parallel.", "Lower your legs slowly back down without swinging.", "For added difficulty, raise your toes all the way to the bar."], muscles_targeted: ["lower rectus abdominis", "hip flexors"], video_url: "" },
  { name: "Lying Leg Raise", description: "A lower-ab exercise performed lying on your back, raising both legs toward the ceiling.", category: "core", equipment: "bodyweight", difficulty: "beginner", instructions: ["Lie flat on your back with legs straight and hands under your lower back or at your sides.", "Raise both legs toward the ceiling, keeping them straight.", "Lower them back down slowly without letting them touch the floor.", "Keep your lower back pressed into the floor throughout."], muscles_targeted: ["lower rectus abdominis", "hip flexors"], video_url: "" },
  { name: "Mountain Climber", description: "A dynamic core and cardio exercise performed in a plank position, driving knees toward the chest.", category: "core", equipment: "bodyweight", difficulty: "beginner", instructions: ["Start in a high plank position with hands under shoulders.", "Drive one knee toward your chest.", "Quickly switch legs, driving the other knee forward.", "Continue alternating at a fast pace while keeping your hips level."], muscles_targeted: ["rectus abdominis", "hip flexors", "shoulders"], video_url: "" },
  { name: "Dead Bug", description: "An anti-extension core exercise that teaches proper bracing while moving opposite arm and leg.", category: "core", equipment: "bodyweight", difficulty: "beginner", instructions: ["Lie on your back with arms extended toward the ceiling and knees bent at 90 degrees.", "Press your lower back into the floor.", "Simultaneously lower one arm overhead and extend the opposite leg.", "Return to the starting position and repeat on the other side."], muscles_targeted: ["transverse abdominis", "rectus abdominis"], video_url: "" },
  { name: "Bird Dog", description: "A core stability exercise performed on all fours, extending opposite arm and leg simultaneously.", category: "core", equipment: "bodyweight", difficulty: "beginner", instructions: ["Start on all fours with wrists under shoulders and knees under hips.", "Extend your right arm forward and left leg backward simultaneously.", "Hold briefly, keeping your hips level and core tight.", "Return to the starting position and repeat with the opposite arm and leg."], muscles_targeted: ["erector spinae", "glutes", "transverse abdominis"], video_url: "" },
  { name: "Ab Wheel Rollout", description: "An advanced core exercise using an ab wheel that challenges anti-extension strength.", category: "core", equipment: "other", difficulty: "advanced", instructions: ["Kneel on the floor holding an ab wheel with both hands.", "Roll the wheel forward, extending your body as far as you can control.", "Keep your core tight and avoid letting your lower back sag.", "Roll back to the starting position by contracting your abs."], muscles_targeted: ["rectus abdominis", "obliques", "latissimus dorsi"], video_url: "" },
  { name: "Cable Woodchop", description: "A rotational core exercise using a cable machine that mimics a chopping motion.", category: "core", equipment: "cables", difficulty: "intermediate", instructions: ["Set a cable pulley to the highest position and stand sideways to the machine.", "Grasp the handle with both hands above one shoulder.", "Pull the handle down and across your body toward the opposite hip.", "Control the return to the starting position.", "Complete all reps, then switch sides."], muscles_targeted: ["obliques", "transverse abdominis", "shoulders"], video_url: "" },
  { name: "Hollow Hold", description: "A gymnastics-based core exercise where you create a \"hollow\" position by pressing your lower back into the floor.", category: "core", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Lie on your back and press your lower back firmly into the floor.", "Extend your arms overhead and your legs straight out.", "Lift your shoulders and legs a few inches off the floor.", "Hold this position, keeping your lower back glued to the ground."], muscles_targeted: ["rectus abdominis", "transverse abdominis", "hip flexors"], video_url: "" },
  { name: "Pallof Press", description: "An anti-rotation core exercise using a cable or band that builds rotational stability.", category: "core", equipment: "cables", difficulty: "beginner", instructions: ["Stand sideways to a cable machine with the pulley at chest height.", "Hold the handle at your chest with both hands.", "Press the handle straight out in front of you, resisting the rotation.", "Hold for a moment, then bring it back to your chest."], muscles_targeted: ["obliques", "transverse abdominis", "glutes"], video_url: "" },
  { name: "Running", description: "A foundational cardio exercise that can be performed outdoors or on a treadmill at various intensities.", category: "cardio", equipment: "none", difficulty: "beginner", instructions: ["Start with a light warm-up walk or jog for 5 minutes.", "Run at your target pace, maintaining good posture with a slight forward lean.", "Land mid-foot with each stride and keep your arms swinging naturally.", "Cool down with a slow jog or walk for 5 minutes."], muscles_targeted: ["quadriceps", "hamstrings", "calves", "hip flexors", "cardiovascular system"], video_url: "" },
  { name: "Cycling", description: "A low-impact cardio exercise performed on a stationary bike or outdoors, great for leg endurance.", category: "cardio", equipment: "machine", difficulty: "beginner", instructions: ["Adjust the seat height so your leg has a slight bend at the bottom of the pedal stroke.", "Begin pedalling at a moderate pace.", "Increase resistance or speed to raise intensity.", "Maintain a steady cadence and keep your upper body relaxed."], muscles_targeted: ["quadriceps", "hamstrings", "calves", "cardiovascular system"], video_url: "" },
  { name: "Rowing Machine", description: "A full-body cardio exercise on an ergometer that works the legs, back, and arms simultaneously.", category: "cardio", equipment: "machine", difficulty: "beginner", instructions: ["Sit on the rower and strap your feet in; grasp the handle.", "Drive with your legs first, then lean back slightly and pull the handle to your chest.", "Reverse the motion: extend arms, lean forward, then bend knees to return to the start.", "Maintain a smooth, continuous rhythm."], muscles_targeted: ["latissimus dorsi", "quadriceps", "hamstrings", "biceps", "cardiovascular system"], video_url: "" },
  { name: "Jump Rope", description: "A high-intensity cardio exercise that improves coordination, footwork, and cardiovascular fitness.", category: "cardio", equipment: "other", difficulty: "beginner", instructions: ["Hold the rope handles at hip height with elbows close to your sides.", "Swing the rope overhead and jump just high enough to clear it.", "Land softly on the balls of your feet.", "Maintain a consistent rhythm; start with shorter intervals."], muscles_targeted: ["calves", "shoulders", "forearms", "cardiovascular system"], video_url: "" },
  { name: "Burpees", description: "A brutal full-body cardio exercise combining a squat, push-up, and jump into one movement.", category: "cardio", equipment: "bodyweight", difficulty: "intermediate", instructions: ["Stand with feet shoulder-width apart.", "Drop into a squat and place your hands on the floor.", "Jump your feet back into a push-up position and perform a push-up.", "Jump your feet back toward your hands and explode up into a jump."], muscles_targeted: ["full body", "cardiovascular system"], video_url: "" },
  { name: "Jumping Jacks", description: "A classic cardio warm-up exercise that elevates heart rate quickly.", category: "cardio", equipment: "bodyweight", difficulty: "beginner", instructions: ["Stand with feet together and arms at your sides.", "Jump your feet out to the sides while raising your arms overhead.", "Jump your feet back together and lower your arms.", "Repeat at a brisk pace."], muscles_targeted: ["calves", "shoulders", "cardiovascular system"], video_url: "" },
  { name: "High Knees", description: "A high-intensity cardio drill where you run in place driving your knees as high as possible.", category: "cardio", equipment: "bodyweight", difficulty: "beginner", instructions: ["Stand with feet hip-width apart.", "Run in place, driving your knees up to hip height or higher.", "Pump your arms in opposition to your legs.", "Maintain a fast pace for the prescribed duration."], muscles_targeted: ["hip flexors", "quadriceps", "calves", "cardiovascular system"], video_url: "" },
  { name: "Stair Climbing", description: "A cardio exercise that involves walking or running up stairs, building leg strength and endurance.", category: "cardio", equipment: "none", difficulty: "beginner", instructions: ["Find a staircase or use a stair climber machine.", "Walk or run up the stairs at a steady pace.", "Focus on driving through each step with your whole foot.", "Walk back down (or step slowly) for recovery between sets."], muscles_targeted: ["quadriceps", "glutes", "calves", "cardiovascular system"], video_url: "" },
  { name: "Swimming", description: "A low-impact, full-body cardio exercise performed in water that is easy on the joints.", category: "cardio", equipment: "none", difficulty: "beginner", instructions: ["Enter the pool and choose your stroke (freestyle, backstroke, breaststroke, etc.).", "Swim at a steady pace, focusing on smooth breathing.", "Use interval sets of different distances to vary intensity.", "Cool down with easy laps."], muscles_targeted: ["full body", "cardiovascular system"], video_url: "" },
  { name: "HIIT Intervals", description: "High-Intensity Interval Training alternating short bursts of maximum effort with rest periods.", category: "cardio", equipment: "none", difficulty: "intermediate", instructions: ["Choose an exercise such as sprinting, cycling, or bodyweight moves.", "Perform the exercise at maximum intensity for 20-30 seconds.", "Rest or perform low-intensity movement for 30-60 seconds.", "Repeat for 8-12 rounds."], muscles_targeted: ["full body", "cardiovascular system"], video_url: "" },
  { name: "Elliptical Trainer", description: "A low-impact cardio machine that simulates a running motion without the joint stress.", category: "cardio", equipment: "machine", difficulty: "beginner", instructions: ["Step onto the elliptical and grasp the handles.", "Start pedalling in a smooth, elliptical motion.", "Increase resistance or incline for higher intensity.", "Maintain an upright posture throughout."], muscles_targeted: ["quadriceps", "hamstrings", "glutes", "cardiovascular system"], video_url: "" },
  { name: "Standing Hamstring Stretch", description: "A basic stretch for the hamstrings performed by reaching toward your toes from a standing position.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Stand with feet together.", "Hinge at the hips and reach toward your toes, keeping your legs straight.", "Go only as far as comfortable; feel the stretch in the back of your legs.", "Hold for 20-30 seconds and return to standing."], muscles_targeted: ["hamstrings", "lower back"], video_url: "" },
  { name: "Standing Quad Stretch", description: "A stretch for the quadriceps performed by pulling one foot toward your glutes while standing.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Stand on one foot and bend the other knee, bringing your heel toward your glutes.", "Grasp your ankle with the same-side hand.", "Keep your knees together and push your hip forward slightly.", "Hold for 20-30 seconds and switch sides."], muscles_targeted: ["quadriceps", "hip flexors"], video_url: "" },
  { name: "Hip Flexor Stretch (Kneeling Lunge)", description: "A deep stretch for the hip flexors performed in a kneeling lunge position.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Kneel on one knee with the other foot planted in front in a lunge position.", "Push your hips forward gently until you feel a stretch in the front of the back hip.", "Keep your torso upright and core engaged.", "Hold for 20-30 seconds and switch sides."], muscles_targeted: ["hip flexors", "quadriceps"], video_url: "" },
  { name: "Cat-Cow Stretch", description: "A gentle spinal mobilisation exercise alternating between arching and rounding the back.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Start on all fours with wrists under shoulders and knees under hips.", "Inhale and arch your back, dropping your belly and lifting your head (cow).", "Exhale and round your back, tucking your chin and tailbone (cat).", "Alternate smoothly between positions for 10-15 repetitions."], muscles_targeted: ["spine", "abdominals", "erector spinae"], video_url: "" },
  { name: "Child's Pose", description: "A restful yoga pose that stretches the back, hips, and shoulders.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Kneel on the floor and sit back on your heels.", "Fold forward, extending your arms in front of you on the floor.", "Rest your forehead on the mat and relax your entire body.", "Hold for 30-60 seconds, breathing deeply."], muscles_targeted: ["latissimus dorsi", "hips", "lower back"], video_url: "" },
  { name: "Pigeon Pose", description: "A deep hip-opening stretch that targets the hip rotators and glutes.", category: "flexibility", equipment: "none", difficulty: "intermediate", instructions: ["From all fours, bring one knee forward and place it behind your same-side wrist.", "Extend the other leg straight behind you.", "Lower your hips toward the floor.", "Fold forward over your bent leg for a deeper stretch; hold for 30-60 seconds per side."], muscles_targeted: ["hip rotators", "glutes", "hip flexors"], video_url: "" },
  { name: "Downward Dog", description: "A yoga pose that stretches the hamstrings, calves, and shoulders while strengthening the arms.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Start on all fours, then lift your hips up and back.", "Straighten your legs and press your heels toward the floor.", "Spread your fingers wide and press through your palms.", "Hold for 30-60 seconds, pedalling your feet if needed."], muscles_targeted: ["hamstrings", "calves", "shoulders", "latissimus dorsi"], video_url: "" },
  { name: "Cobra Stretch", description: "A prone back extension stretch that opens the chest and stretches the abdominals.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Lie face down with your hands under your shoulders.", "Press your hips into the floor and straighten your arms to lift your chest.", "Keep your shoulders down and away from your ears.", "Hold for 20-30 seconds."], muscles_targeted: ["abdominals", "hip flexors", "chest"], video_url: "" },
  { name: "Cross-Body Shoulder Stretch", description: "A simple stretch for the posterior shoulder and upper back.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Bring one arm across your body at chest height.", "Use the opposite hand to gently pull it closer to your chest.", "Feel the stretch in the back of your shoulder.", "Hold for 20-30 seconds and switch sides."], muscles_targeted: ["rear deltoid", "rhomboids"], video_url: "" },
  { name: "Foam Rolling (Full Body)", description: "Self-myofascial release using a foam roller to reduce muscle tension and improve mobility.", category: "flexibility", equipment: "other", difficulty: "beginner", instructions: ["Place the foam roller under the muscle group you want to target.", "Use your body weight to apply pressure and slowly roll back and forth.", "Pause on tender spots for 20-30 seconds.", "Roll each muscle group for 1-2 minutes."], muscles_targeted: ["full body fascia and muscles"], video_url: "" },
  { name: "Seated Forward Fold", description: "A seated stretch where you reach toward your toes to stretch the hamstrings and lower back.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Sit on the floor with legs extended straight in front of you.", "Hinge at the hips and reach toward your feet.", "Keep your back as flat as possible; avoid rounding excessively.", "Hold for 30 seconds, breathing deeply to relax into the stretch."], muscles_targeted: ["hamstrings", "lower back", "calves"], video_url: "" },
  { name: "Thoracic Spine Rotation", description: "A mobility exercise that improves rotation in the upper back, beneficial for posture and overhead movements.", category: "flexibility", equipment: "none", difficulty: "beginner", instructions: ["Lie on your side with knees bent at 90 degrees and arms extended in front of you.", "Keeping your knees stacked, rotate your top arm over to the other side, opening your chest.", "Follow your hand with your eyes and hold the open position for a breath.", "Return to the start and repeat 8-10 times before switching sides."], muscles_targeted: ["thoracic spine", "obliques", "chest"], video_url: "" },
  { name: "Clean and Press", description: "An Olympic-style lift that cleans a barbell from the floor to the shoulders, then presses it overhead.", category: "full-body", equipment: "barbell", difficulty: "advanced", instructions: ["Stand over the barbell with feet hip-width apart.", "Grip the bar and explosively pull it from the floor to your shoulders (the clean).", "Dip your knees slightly and press the bar overhead.", "Lower the bar back to your shoulders, then to the floor."], muscles_targeted: ["quadriceps", "glutes", "shoulders", "trapezius", "core"], video_url: "" },
  { name: "Thrusters", description: "A brutal combination of a front squat and overhead press performed in one fluid motion.", category: "full-body", equipment: "barbell", difficulty: "intermediate", instructions: ["Hold a barbell in the front rack position at your shoulders.", "Perform a full front squat.", "As you stand up, use the momentum to press the barbell overhead.", "Lower the bar back to your shoulders and immediately squat again."], muscles_targeted: ["quadriceps", "glutes", "shoulders", "triceps", "core"], video_url: "" },
  { name: "Turkish Get-Up", description: "A complex full-body exercise where you stand up from lying on the floor while holding a weight overhead.", category: "full-body", equipment: "kettlebell", difficulty: "advanced", instructions: ["Lie on your back holding a kettlebell in one hand with arm extended toward the ceiling.", "Bend the knee on the same side and roll onto your opposite forearm.", "Push up to your hand, then sweep your leg underneath to a kneeling position.", "Stand up while keeping the kettlebell locked out overhead.", "Reverse the steps to return to lying down."], muscles_targeted: ["shoulders", "core", "glutes", "quadriceps", "hip stabilisers"], video_url: "" },
  { name: "Man Maker", description: "A gruelling complex combining a push-up, renegade row, and dumbbell clean and press.", category: "full-body", equipment: "dumbbells", difficulty: "advanced", instructions: ["Start in a push-up position with hands on two dumbbells.", "Perform a push-up, then row one dumbbell to your hip.", "Row the other dumbbell, then jump your feet forward to a squat.", "Clean the dumbbells to your shoulders and press them overhead."], muscles_targeted: ["chest", "back", "shoulders", "arms", "core", "legs"], video_url: "" },
  { name: "Bear Crawl", description: "A primal movement pattern that builds full-body coordination, core stability, and endurance.", category: "full-body", equipment: "bodyweight", difficulty: "beginner", instructions: ["Start on all fours with knees hovering just above the ground.", "Move forward by stepping the opposite hand and foot simultaneously.", "Keep your hips low and your back flat.", "Crawl forward for the prescribed distance or time."], muscles_targeted: ["shoulders", "core", "quadriceps", "hip flexors"], video_url: "" },
  { name: "Kettlebell Swing", description: "A ballistic hip-hinge exercise using a kettlebell that builds explosive power and cardiovascular fitness.", category: "full-body", equipment: "kettlebell", difficulty: "intermediate", instructions: ["Stand with feet slightly wider than shoulder-width, kettlebell on the floor in front of you.", "Hinge at the hips, grip the kettlebell, and hike it back between your legs.", "Explosively drive your hips forward to swing the kettlebell to chest height.", "Let the kettlebell swing back between your legs and repeat."], muscles_targeted: ["glutes", "hamstrings", "core", "shoulders"], video_url: "" },
  { name: "Battle Ropes", description: "A high-intensity conditioning exercise using heavy ropes to build upper body endurance and power.", category: "full-body", equipment: "other", difficulty: "intermediate", instructions: ["Stand facing the anchor point holding one end of the rope in each hand.", "Create waves by alternating arm slams up and down.", "Keep a slight squat position and engaged core.", "Continue for the prescribed time (typically 20-30 seconds per set)."], muscles_targeted: ["shoulders", "arms", "core", "cardiovascular system"], video_url: "" },
  { name: "Box Jump", description: "A plyometric exercise that builds explosive lower-body power by jumping onto a box.", category: "full-body", equipment: "other", difficulty: "intermediate", instructions: ["Stand facing a sturdy box at an appropriate height.", "Swing your arms and bend your knees to load the jump.", "Explode upward and land softly on top of the box with both feet.", "Stand up fully, then step back down and repeat."], muscles_targeted: ["quadriceps", "glutes", "calves", "core"], video_url: "" },
  { name: "Wall Ball", description: "A full-body exercise where you squat with a medicine ball and then throw it at a target on a wall.", category: "full-body", equipment: "other", difficulty: "intermediate", instructions: ["Stand facing a wall holding a medicine ball at chest height.", "Perform a full squat.", "As you stand up, throw the ball at a target high on the wall.", "Catch the ball on its return and immediately squat again."], muscles_targeted: ["quadriceps", "glutes", "shoulders", "triceps"], video_url: "" },
  { name: "Sled Push", description: "A conditioning exercise where you push a weighted sled across the floor for full-body power and endurance.", category: "full-body", equipment: "other", difficulty: "intermediate", instructions: ["Load the sled with an appropriate weight.", "Grip the handles and lean into the sled at about a 45-degree angle.", "Drive through your legs to push the sled forward.", "Maintain a low body position and drive with each step."], muscles_targeted: ["quadriceps", "glutes", "calves", "shoulders", "core"], video_url: "" },
  { name: "Farmers Walk", description: "A loaded carry exercise that builds grip strength, core stability, and total-body conditioning.", category: "full-body", equipment: "dumbbells", difficulty: "beginner", instructions: ["Pick up a heavy dumbbell or kettlebell in each hand.", "Stand tall with shoulders back and core braced.", "Walk forward with controlled, steady steps.", "Maintain an upright posture for the prescribed distance or time."], muscles_targeted: ["forearms", "trapezius", "core", "legs"], video_url: "" },
  { name: "Snatch (Barbell)", description: "An Olympic lift where the barbell is pulled from the floor to overhead in one explosive motion.", category: "full-body", equipment: "barbell", difficulty: "advanced", instructions: ["Stand over the bar with a wide grip (snatch grip) and feet hip-width apart.", "Pull the bar from the floor explosively, keeping it close to your body.", "As the bar reaches chest height, pull yourself under it into an overhead squat.", "Stand up with the bar locked out overhead.", "Lower the bar back to the floor with control."], muscles_targeted: ["quadriceps", "glutes", "hamstrings", "shoulders", "trapezius", "core"], video_url: "" },
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
  const [viewingExercise, setViewingExercise] = useState<Exercise | null>(null);
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [programForm, setProgramForm] = useState({ name: "", description: "", level: "beginner" as "beginner" | "intermediate" | "advanced", duration: 8, category: "exercise" });
  const [creatingProgram, setCreatingProgram] = useState(false);

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

  // ── Create Program from selected exercises ─────────────────────────────────

  const createProgram = async () => {
    if (!programForm.name.trim()) { setToast({ message: "Program name is required", type: "error" }); return; }
    setCreatingProgram(true);
    try {
      const key = programForm.name.toLowerCase().replace(/\s+/g, "-");
      // Get category_id from program_categories
      const { data: catData } = await supabase.from("program_categories").select("id").eq("key", programForm.category).single();
      const categoryId = catData?.id;
      if (!categoryId) { setToast({ message: "Could not find program category", type: "error" }); setCreatingProgram(false); return; }

      const { error: progError } = await supabase.from("programs").insert([{
        key,
        name: programForm.name,
        description: programForm.description,
        level: programForm.level,
        duration: programForm.duration,
        category_id: categoryId,
      }]);
      if (progError) { setToast({ message: "Failed to create program: " + progError.message, type: "error" }); setCreatingProgram(false); return; }

      // Insert action_exercises for each selected exercise
      const selectedExercises = exercises.filter(e => selectedIds.has(e.id));
      const actionExercises = selectedExercises.map((ex, idx) => ({
        action_key: `${key}-workout`,
        program_key: key,
        week_range: 0,
        day_of_week: 0,
        exercise_id: ex.id,
        exercise_name: ex.name,
        sets: 3,
        reps: "10",
        rest: "60s",
        sort_order: idx,
      }));
      const { error: aeError } = await supabase.from("action_exercises").insert(actionExercises);
      if (aeError) { setToast({ message: "Program created but failed to link exercises: " + aeError.message, type: "error" }); }
      else { setToast({ message: `Created program "${programForm.name}" with ${selectedIds.size} exercises`, type: "success" }); }

      setSelectedIds(new Set());
      setShowCreateProgram(false);
      setProgramForm({ name: "", description: "", level: "beginner", duration: 8, category: "exercise" });
    } catch (err) {
      setToast({ message: "Unexpected error creating program", type: "error" });
    }
    setCreatingProgram(false);
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
          <button onClick={seedExercises} disabled={seeding} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {seeding ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Seeding...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Seed / Update {SEED_EXERCISES.length} Exercises</>
            )}
          </button>
          {selectedIds.size > 0 && (
            <>
              <button onClick={() => { setShowCreateProgram(true); setProgramForm({ name: "", description: "", level: "beginner", duration: 8, category: "exercise" }); }} className="px-4 py-2 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Create Program ({selectedIds.size})
              </button>
              <button onClick={() => setBulkDeleteConfirm(true)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete {selectedIds.size} Selected
              </button>
            </>
          )}
          <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] transition-colors flex items-center gap-2">
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
          <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value as Equipment | "all")} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent bg-white">
            <option value="all">All Equipment</option>
            {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq.charAt(0).toUpperCase() + eq.slice(1)}</option>)}
          </select>
          <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as Difficulty | "all")} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent bg-white">
            <option value="all">All Difficulties</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
          </select>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises..." className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent" />
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B981]" />
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
            <div key={ex.id} className={`bg-white rounded-xl p-5 shadow-sm border transition-all cursor-pointer hover:shadow-md ${selectedIds.has(ex.id) ? "border-[#10B981] ring-2 ring-[#10B981]/20" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <input type="checkbox" checked={selectedIds.has(ex.id)} onChange={() => toggleSelect(ex.id)} className="mt-1 w-4 h-4 rounded border-gray-300 text-[#10B981] focus:ring-[#10B981] cursor-pointer" onClick={(e) => e.stopPropagation()} />
                  {ex.video_url ? (
                    <VideoThumb
                      videoUrl={ex.video_url}
                      posterUrl={ex.illustration_url}
                      alt={ex.name}
                      className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100"
                    />
                  ) : ex.illustration_url ? (
                    <img src={ex.illustration_url} alt={ex.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : null}
                  <div className="min-w-0 flex-1" onClick={() => setViewingExercise(ex)}>
                    <h3 className="font-semibold text-gray-900 truncate">{ex.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ex.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setEditingExercise({ ...ex }); setIsCreating(false); }} className="p-1.5 text-gray-400 hover:text-[#10B981] rounded-lg hover:bg-green-50 transition-colors" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: ex.id, name: ex.name }); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
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
          <button onClick={() => { setCategoryFilter("all"); setEquipmentFilter("all"); setDifficultyFilter("all"); setSearch(""); }} className="mt-2 text-sm text-[#10B981] hover:underline">Clear filters</button>
        </div>
      )}

      {/* ── Exercise Detail View Modal ──────────────────────────────────────── */}
      {viewingExercise && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingExercise(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Media — video if available, else illustration, else generic icon */}
            {viewingExercise.video_url ? (
              <video
                src={viewingExercise.video_url}
                autoPlay loop muted playsInline
                poster={viewingExercise.illustration_url || undefined}
                className="w-full h-[300px] object-cover rounded-t-2xl bg-black"
                onLoadedData={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
                onEnded={(e) => { const v = e.target as HTMLVideoElement; v.currentTime = 0; v.play().catch(() => {}); }}
              />
            ) : viewingExercise.illustration_url ? (
              <img src={viewingExercise.illustration_url} alt={viewingExercise.name} className="w-full h-[300px] object-cover rounded-t-2xl" />
            ) : (
              <div className="w-full h-[300px] rounded-t-2xl flex items-center justify-center" style={{ backgroundColor: `${CATEGORY_COLORS[viewingExercise.category]}20` }}>
                <svg className="w-20 h-20" style={{ color: CATEGORY_COLORS[viewingExercise.category] }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
            )}
            <div className="p-6 space-y-4">
              {/* Name */}
              <h2 className="text-2xl font-bold text-gray-900">{viewingExercise.name}</h2>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 text-xs font-semibold rounded-full text-white" style={{ backgroundColor: CATEGORY_COLORS[viewingExercise.category] }}>
                  {viewingExercise.category.charAt(0).toUpperCase() + viewingExercise.category.slice(1)}
                </span>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                  {viewingExercise.equipment.charAt(0).toUpperCase() + viewingExercise.equipment.slice(1)}
                </span>
                <span className="px-3 py-1 text-xs font-semibold rounded-full text-white" style={{ backgroundColor: DIFFICULTY_COLORS[viewingExercise.difficulty] }}>
                  {viewingExercise.difficulty.charAt(0).toUpperCase() + viewingExercise.difficulty.slice(1)}
                </span>
              </div>

              {/* Description */}
              {viewingExercise.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{viewingExercise.description}</p>
              )}

              {/* Muscles targeted */}
              {viewingExercise.muscles_targeted && viewingExercise.muscles_targeted.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Muscles Targeted</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingExercise.muscles_targeted.map((m) => (
                      <span key={m} className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">{m}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {viewingExercise.instructions && viewingExercise.instructions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Instructions</h4>
                  <ol className="space-y-2">
                    {viewingExercise.instructions.map((inst, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-600">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#10B981]/10 text-[#10B981] flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        <span className="leading-relaxed">{inst}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Video URL */}
              {viewingExercise.video_url && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Video</h4>
                  <a href={viewingExercise.video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#10B981] hover:underline flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Watch video
                  </a>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button onClick={() => { setEditingExercise({ ...viewingExercise }); setIsCreating(false); setViewingExercise(null); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] transition-colors flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit
                </button>
                <button onClick={() => { setConfirmDelete({ id: viewingExercise.id, name: viewingExercise.name }); setViewingExercise(null); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Program Modal ─────────────────────────────────────────────── */}
      {showCreateProgram && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateProgram(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create Program</h2>
              <button onClick={() => setShowCreateProgram(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Program name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Program Name *</label>
              <input type="text" value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent" placeholder="e.g. Upper Body Strength" />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select value={programForm.category} onChange={(e) => setProgramForm({ ...programForm, category: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent bg-white">
                <option value="exercise">Exercise</option>
                <option value="nutrition">Nutrition</option>
                <option value="sleep">Sleep</option>
                <option value="mental">Mental</option>
              </select>
            </div>

            {/* Duration pills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (weeks)</label>
              <div className="flex gap-2">
                {[4, 8, 12].map((w) => (
                  <button key={w} onClick={() => setProgramForm({ ...programForm, duration: w })} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors border ${programForm.duration === w ? "bg-[#10B981] text-white border-transparent" : "text-gray-600 border-gray-300 hover:border-gray-400"}`}>
                    {w} weeks
                  </button>
                ))}
              </div>
            </div>

            {/* Level pills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Level</label>
              <div className="flex gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
                  <button key={lvl} onClick={() => setProgramForm({ ...programForm, level: lvl })} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors border ${programForm.level === lvl ? "text-white border-transparent" : "text-gray-600 border-gray-300 hover:border-gray-400"}`} style={programForm.level === lvl ? { backgroundColor: DIFFICULTY_COLORS[lvl] } : {}}>
                    {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={programForm.description} onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent resize-none" placeholder="Describe this program..." />
            </div>

            {/* Selected exercises preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Exercises ({selectedIds.size})</label>
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
                {exercises.filter((ex) => selectedIds.has(ex.id)).map((ex) => (
                  <div key={ex.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[ex.category] }} />
                    {ex.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setShowCreateProgram(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={createProgram} disabled={creatingProgram} className="px-5 py-2 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] transition-colors disabled:opacity-50 flex items-center gap-2">
                {creatingProgram && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {creatingProgram ? "Creating..." : "Create Program"}
              </button>
            </div>
          </div>
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
              <input type="text" value={editingExercise.name || ""} onChange={(e) => setEditingExercise({ ...editingExercise, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent" placeholder="e.g. Barbell Bench Press" />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={editingExercise.description || ""} onChange={(e) => setEditingExercise({ ...editingExercise, description: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent resize-none" placeholder="Brief description of the exercise..." />
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
              <select value={editingExercise.equipment || "none"} onChange={(e) => setEditingExercise({ ...editingExercise, equipment: e.target.value as Equipment })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent bg-white">
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
                    }} className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent" placeholder={`Step ${i + 1}`} />
                    {(editingExercise.instructions || []).length > 1 && (
                      <button onClick={() => {
                        const updated = (editingExercise.instructions || []).filter((_, j) => j !== i);
                        setEditingExercise({ ...editingExercise, instructions: updated });
                      }} className="p-1 text-gray-400 hover:text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setEditingExercise({ ...editingExercise, instructions: [...(editingExercise.instructions || []), ""] })} className="text-xs text-[#10B981] hover:underline font-medium">+ Add step</button>
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
                <input type="text" id="muscle-input" placeholder="e.g. chest, triceps" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent" onKeyDown={(e) => {
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
                }} className="px-3 py-1.5 text-xs font-medium text-[#10B981] border border-[#10B981] rounded-lg hover:bg-[#10B981]/5">Add</button>
              </div>
            </div>

            {/* Illustration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exercise Image</label>
              {editingExercise.illustration_url && (
                <div className="mb-2 relative inline-block">
                  <img src={editingExercise.illustration_url} alt="" className="w-full max-w-xs h-40 object-cover rounded-lg border border-gray-200" />
                  <button onClick={() => setEditingExercise({ ...editingExercise, illustration_url: "" })} className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">✕</button>
                </div>
              )}
              <input type="url" value={editingExercise.illustration_url || ""} onChange={(e) => setEditingExercise({ ...editingExercise, illustration_url: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent" placeholder="Image URL (https://...)" />
              <p className="text-xs text-gray-400 mt-1">Paste an image URL or upload to Supabase Storage</p>
            </div>

            {/* Video URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (optional)</label>
              <input type="url" value={editingExercise.video_url || ""} onChange={(e) => setEditingExercise({ ...editingExercise, video_url: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent" placeholder="https://..." />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => { setEditingExercise(null); setIsCreating(false); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={saveExercise} className="px-5 py-2 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] transition-colors">
                {isCreating ? "Create Exercise" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// build 1775827594
