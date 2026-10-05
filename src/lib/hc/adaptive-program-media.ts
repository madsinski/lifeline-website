// Generated from the exercise library (`exercises`) for adaptive-program.ts:
// library name → id, illustration, video, muscles, equipment.
//
// Do not edit by hand. Regenerate with:
//   node --env-file=.env.local scripts/hc-gen-program-media.mjs
// It reads the `lib:` names out of adaptive-program.ts and fails if any of
// them is missing from the library, so a variant can never silently lose its
// picture again.

export interface ProgramMedia { id: string; image: string | null; video: string | null; muscles: string[]; equipment: string | null }

export const PROGRAM_MEDIA: Record<string, ProgramMedia> = {
  "Band Pull-Aparts": {
    "id": "5f0432eb-373d-44c5-9da4-363c413e4df8",
    "image": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80",
    "video": null,
    "muscles": [],
    "equipment": "bodyweight"
  },
  "Barbell Bench Press - Medium Grip": {
    "id": "6c2d46f9-a51f-4175-9188-6ccc7ec4e272",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Barbell_Bench_Press_-_Medium_Grip.mp4",
    "muscles": [
      "chest"
    ],
    "equipment": "barbell"
  },
  "Barbell Deadlift": {
    "id": "4c9491b1-1476-4168-ae33-8158451811e5",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Barbell_Deadlift.mp4",
    "muscles": [
      "lower back"
    ],
    "equipment": "barbell"
  },
  "Barbell Full Squat": {
    "id": "42245a7d-856f-42ae-80a2-69bca6e12eab",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Full_Squat/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Barbell_Full_Squat.mp4",
    "muscles": [
      "quadriceps"
    ],
    "equipment": "barbell"
  },
  "Barbell Overhead Press": {
    "id": "9439387a-1d60-4983-a21b-0ffbb6dd678f",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "barbell"
  },
  "Bodyweight Mid Row": {
    "id": "c9dc146a-5310-4724-81f6-d1a6269d38f3",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bodyweight_Mid_Row/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Bodyweight_Mid_Row.mp4",
    "muscles": [
      "middle back"
    ],
    "equipment": "other"
  },
  "Bodyweight Squat": {
    "id": "a63fc630-c008-44db-9f1a-4fa3caaaff88",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bodyweight_Squat/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Bodyweight_Squat.mp4",
    "muscles": [
      "quadriceps"
    ],
    "equipment": "bodyweight"
  },
  "Box Squat": {
    "id": "8524e536-f6bb-4810-8f7f-b2465d9931af",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Box_Squat/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Box_Squat.mp4",
    "muscles": [
      "quadriceps"
    ],
    "equipment": "barbell"
  },
  "Bulgarian Split Squat": {
    "id": "29e19759-aadf-4734-9f25-538e47caa2b0",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunges/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "bodyweight"
  },
  "Conventional Deadlift": {
    "id": "3a5a24a4-a8c9-4cc0-917f-5fb87c37f373",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "barbell"
  },
  "Dead Bug": {
    "id": "274c7d9b-4456-490a-8019-39f4a57cf0b1",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dead_Bug/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Dead_Bug.mp4",
    "muscles": [
      "abdominals"
    ],
    "equipment": "bodyweight"
  },
  "Decline Push-Up": {
    "id": "a6d57d88-2e9c-4655-9e1b-1881461435f1",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Decline_Push-Up/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Decline_Push-Up.mp4",
    "muscles": [
      "chest"
    ],
    "equipment": "bodyweight"
  },
  "Dumbbell Bench Press": {
    "id": "d09b9ddd-4324-4448-8025-58a7f3f22cfb",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Dumbbell_Bench_Press.mp4",
    "muscles": [
      "chest"
    ],
    "equipment": "dumbbells"
  },
  "Dumbbell Floor Press": {
    "id": "60958854-b55f-488f-9d71-4e686bcb4442",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Floor_Press/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Dumbbell_Floor_Press.mp4",
    "muscles": [
      "triceps"
    ],
    "equipment": "dumbbells"
  },
  "Dumbbell One-Arm Shoulder Press": {
    "id": "f6f1f2a9-047b-4008-be3a-a738e0b23507",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_One-Arm_Shoulder_Press/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Dumbbell_One-Arm_Shoulder_Press.mp4",
    "muscles": [
      "shoulders"
    ],
    "equipment": "dumbbells"
  },
  "Dumbbell Single-Arm Row": {
    "id": "9c9e3f29-537f-46bc-a55e-0d042a29f84c",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/One-Arm_Dumbbell_Row/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "dumbbells"
  },
  "Farmer's Walk": {
    "id": "47e2ec9a-9eaf-4f2c-979c-7a286728de87",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Farmers_Walk/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Farmers_Walk.mp4",
    "muscles": [
      "forearms"
    ],
    "equipment": "other"
  },
  "Front Plank": {
    "id": "3554965c-210e-48aa-a521-129a74660ec4",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "bodyweight"
  },
  "Glute Bridges": {
    "id": "b37f5dea-3370-4f08-bf3e-0ac06301ba4e",
    "image": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80",
    "video": null,
    "muscles": [],
    "equipment": "bodyweight"
  },
  "Goblet Squat": {
    "id": "c2f6a2c5-c964-473f-b544-9209c9f31f0f",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Goblet_Squat/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Goblet_Squat.mp4",
    "muscles": [
      "quadriceps"
    ],
    "equipment": "dumbbells"
  },
  "Hip Thrust": {
    "id": "d57c3084-fd14-4e8e-9bd6-02a6a4e7bebc",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Hip_Thrust/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "barbell"
  },
  "Incline Push-Up": {
    "id": "12faab26-2810-4494-9f6c-9980cc49ae18",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Push-Up/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Incline_Push-Up.mp4",
    "muscles": [
      "chest"
    ],
    "equipment": "bodyweight"
  },
  "Inverted Row": {
    "id": "d5424ae7-97f7-44ac-bf99-e0a397b1ba16",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Inverted_Row/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Inverted_Row.mp4",
    "muscles": [
      "middle back"
    ],
    "equipment": "bodyweight"
  },
  "Kettlebell One-Legged Deadlift": {
    "id": "d99d50f0-8738-4126-9241-165b9535a49e",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Kettlebell_One-Legged_Deadlift/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Kettlebell_One-Legged_Deadlift.mp4",
    "muscles": [
      "hamstrings"
    ],
    "equipment": "kettlebell"
  },
  "Leg Press": {
    "id": "3dde588e-e825-4893-897a-7a2a01ec1a07",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Leg_Press.mp4",
    "muscles": [
      "quadriceps"
    ],
    "equipment": "machine"
  },
  "Pallof Press": {
    "id": "08d07557-a61a-49af-a373-e21488b65c68",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pallof_Press/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Pallof_Press.mp4",
    "muscles": [
      "abdominals"
    ],
    "equipment": "cables"
  },
  "Pendlay Row": {
    "id": "fe05e496-a121-4fe0-a250-e0803bb30b20",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "barbell"
  },
  "Plank": {
    "id": "eb4c921b-262c-442e-a667-8ab6eef3de76",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Plank.mp4",
    "muscles": [
      "abdominals"
    ],
    "equipment": "bodyweight"
  },
  "Reverse Lunge": {
    "id": "c5659258-a2ae-49d6-9781-0a272a22c57a",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Lunge/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "bodyweight"
  },
  "Romanian Deadlift": {
    "id": "5c25deeb-f7e8-4602-8322-a9180a7a69e9",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Romanian_Deadlift.mp4",
    "muscles": [
      "hamstrings"
    ],
    "equipment": "barbell"
  },
  "Seated Cable Row": {
    "id": "48aaa703-709d-4c91-af57-a7a69a133829",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "cables"
  },
  "Seated Dumbbell Shoulder Press": {
    "id": "9b2113b0-0112-4373-bf3c-8290afb275bd",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shoulder_Press/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "dumbbells"
  },
  "Shoulder Press - With Bands": {
    "id": "b15f855b-e61b-40c7-9c76-df05eba867d0",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Shoulder_Press_-_With_Bands/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Shoulder_Press_-_With_Bands.mp4",
    "muscles": [
      "shoulders"
    ],
    "equipment": "bands"
  },
  "Side Plank": {
    "id": "b07dbb08-2cc0-40f5-b202-e7da2919bd2b",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Side_Bridge/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "bodyweight"
  },
  "Single Leg Glute Bridge": {
    "id": "559697ad-7526-46aa-8356-12750075066c",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Single_Leg_Glute_Bridge/0.jpg",
    "video": "https://cfnibfxzltxiriqxvvru.supabase.co/storage/v1/object/public/exercise-media/Single_Leg_Glute_Bridge.mp4",
    "muscles": [
      "glutes"
    ],
    "equipment": "bodyweight"
  },
  "Standard Push-Up": {
    "id": "25ffc26c-f31a-4ab0-b1ea-d632c1deab6d",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pushups/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "bodyweight"
  },
  "Step-Up": {
    "id": "7c68f43e-25d1-4df8-aeb1-60e60029aa42",
    "image": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Step_Ups/0.jpg",
    "video": "",
    "muscles": [],
    "equipment": "bodyweight"
  }
};
