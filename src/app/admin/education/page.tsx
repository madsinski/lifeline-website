"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface QuizQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

interface Module {
  id: string;
  title: string;
  content: string;
  readingTime: number;
  quizQuestions: QuizQuestion[];
}

interface Course {
  id: string;
  name: string;
  description: string;
  coverImageUrl: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedDuration: string;
  modules: Module[];
}

interface DailySnippet {
  title: string;
  bullets: string[];
}

interface SnippetWeek {
  weekRange: string;
  days: DailySnippet[];
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekRanges = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8"];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyModule(): Module {
  return {
    id: makeId(),
    title: "New Module",
    content: "",
    readingTime: 5,
    quizQuestions: [],
  };
}

function createEmptyQuiz(): QuizQuestion {
  return {
    id: makeId(),
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
  };
}

const defaultSnippetData: SnippetWeek[] = [
  // WEEK 1
  {
    weekRange: "Week 1",
    days: [
      { title: "Progressive Overload", bullets: ["Progressive overload is the gradual increase of stress placed on the body during training.", "This can be achieved by adding weight, increasing reps, or reducing rest periods between sets.", "Without progressive overload, your body adapts and improvements plateau."] },
      { title: "Protein Timing", bullets: ["Distributing protein intake across 4-5 meals per day maximises muscle protein synthesis.", "Aim for 25-40g of protein per meal to hit the leucine threshold that triggers muscle building.", "A protein-rich meal within 2 hours after training supports recovery, though total daily intake matters more."] },
      { title: "Sleep Pressure", bullets: ["Adenosine builds up in your brain during waking hours, creating 'sleep pressure' that drives drowsiness.", "Caffeine works by blocking adenosine receptors, which is why it can disrupt sleep if consumed after midday.", "Allowing sleep pressure to build naturally by avoiding naps after 3pm helps you fall asleep faster at night."] },
      { title: "Box Breathing", bullets: ["Box breathing (4 seconds inhale, 4 hold, 4 exhale, 4 hold) activates your parasympathetic nervous system.", "Navy SEALs use this technique to stay calm under extreme stress, and it works equally well in daily life.", "Practising box breathing for just 2 minutes can measurably lower cortisol levels and heart rate."] },
      { title: "Warm-Up Science", bullets: ["A proper warm-up increases muscle temperature by 1-2 degrees, improving contractile speed and power output.", "Dynamic stretching before exercise is more effective than static stretching for injury prevention.", "Include movement patterns that mirror your workout to prime the neuromuscular pathways you will use."] },
      { title: "Hydration Basics", bullets: ["Even 2% dehydration can reduce cognitive performance by up to 20% and physical performance by 10%.", "Your body loses approximately 1 litre of water overnight through breathing and perspiration.", "A simple hydration check: if your urine is pale yellow, you are adequately hydrated. Dark yellow indicates dehydration."] },
      { title: "Circadian Rhythm", bullets: ["Your body's master clock in the suprachiasmatic nucleus responds primarily to light exposure.", "Getting 10 minutes of sunlight within an hour of waking helps anchor your circadian rhythm for better sleep.", "Consistent wake times, even on weekends, are more important than consistent bedtimes for circadian health."] },
    ],
  },
  // WEEK 2
  {
    weekRange: "Week 2",
    days: [
      { title: "Cognitive Reframing", bullets: ["Cognitive reframing involves identifying negative thought patterns and deliberately replacing them with balanced ones.", "Studies show that reframing a stressful situation as a 'challenge' rather than a 'threat' improves performance.", "Practise by writing down an automatic negative thought, then listing three alternative interpretations."] },
      { title: "Eccentric Training", bullets: ["The eccentric (lowering) phase of a lift causes more muscle damage and stimulates greater adaptation.", "Controlling the eccentric phase for 3-4 seconds per rep significantly increases time under tension.", "Eccentric training is especially effective for tendon health and rehabilitation from injuries like tendinopathy."] },
      { title: "Fibre & Gut Health", bullets: ["Most adults eat only 15g of fibre per day, well below the recommended 30g minimum for optimal gut health.", "Soluble fibre feeds beneficial gut bacteria that produce short-chain fatty acids essential for immune function.", "Increasing fibre intake gradually by 5g per week helps avoid bloating and digestive discomfort."] },
      { title: "Sleep Stages", bullets: ["A complete sleep cycle lasts about 90 minutes and includes light sleep, deep sleep, and REM sleep.", "Deep sleep dominates the first half of the night and is critical for physical recovery and growth hormone release.", "REM sleep increases in later cycles and is essential for memory consolidation and emotional regulation."] },
      { title: "Stress & Cortisol", bullets: ["Cortisol follows a natural rhythm: it should peak within 30 minutes of waking and gradually decline throughout the day.", "Chronic stress flattens this cortisol curve, leading to fatigue in the morning and alertness at night.", "Short bursts of intense exercise can help reset cortisol patterns, but overtraining has the opposite effect."] },
      { title: "Mobility vs Flexibility", bullets: ["Flexibility is the passive range of motion in a joint, while mobility is the ability to actively control that range.", "Mobility training is more functional than static stretching because it builds strength throughout the range of motion.", "Spending 10 minutes daily on hip and thoracic spine mobility can dramatically improve squat depth and overhead position."] },
      { title: "Omega-3 Fatty Acids", bullets: ["EPA and DHA omega-3s reduce inflammation and support brain health, cardiovascular function, and joint integrity.", "Aim for at least 2 servings of fatty fish per week, or 2-3g of combined EPA/DHA from a quality supplement.", "Plant-based omega-3 (ALA) converts poorly to EPA/DHA at only 5-10%, so algae-based supplements are a better vegan option."] },
    ],
  },
  // WEEK 3
  {
    weekRange: "Week 3",
    days: [
      { title: "Sleep Temperature", bullets: ["Your core body temperature needs to drop by 1-2 degrees to initiate sleep onset.", "The ideal bedroom temperature for sleep is 16-19 degrees Celsius (60-67 degrees Fahrenheit).", "A warm shower 1-2 hours before bed paradoxically helps by causing a rebound cooling effect on your core temperature."] },
      { title: "Mindfulness Practice", bullets: ["Mindfulness meditation for just 10 minutes daily has been shown to reduce anxiety scores by 30% after 8 weeks.", "The key is non-judgmental awareness: observing thoughts without trying to change or suppress them.", "Body scan meditation is an excellent starting point, systematically directing attention to each body region."] },
      { title: "Compound Movements", bullets: ["Compound exercises like squats, deadlifts, and rows work multiple muscle groups simultaneously for maximum efficiency.", "These movements release more growth hormone and testosterone than isolation exercises due to greater muscle mass involvement.", "Building your programme around 4-5 compound movements ensures balanced development and functional strength."] },
      { title: "Blood Sugar Balance", bullets: ["Rapid blood sugar spikes followed by crashes drive hunger, fatigue, and irritability throughout the day.", "Pairing carbohydrates with protein, fat, or fibre slows glucose absorption and creates a more stable energy curve.", "Eating your vegetables and protein before carbohydrates in a meal can reduce the glucose spike by up to 40%."] },
      { title: "Blue Light & Melatonin", bullets: ["Blue light from screens suppresses melatonin production by up to 50%, delaying sleep onset significantly.", "Dimming lights and avoiding screens 60-90 minutes before bed allows natural melatonin release to begin.", "If you must use screens at night, blue-light-blocking glasses with amber lenses can reduce melatonin suppression."] },
      { title: "Heart Rate Variability", bullets: ["HRV measures the variation in time between heartbeats and reflects your autonomic nervous system balance.", "Higher HRV generally indicates better recovery, stress resilience, and cardiovascular fitness.", "Track your morning HRV trend over weeks rather than single readings to identify patterns in recovery and readiness."] },
      { title: "Recovery Between Sets", bullets: ["Rest periods of 2-3 minutes between heavy compound sets allow full phosphocreatine replenishment for maximum strength.", "For hypertrophy, 60-90 second rest periods maintain metabolic stress while allowing sufficient recovery.", "Active recovery like light walking between sets can aid clearance of metabolic byproducts without compromising performance."] },
    ],
  },
  // WEEK 4
  {
    weekRange: "Week 4",
    days: [
      { title: "Gratitude & Mental Health", bullets: ["Writing down three specific things you are grateful for each evening has been shown to improve sleep quality by 25%.", "Gratitude practice shifts brain activity from the amygdala (fear centre) to the prefrontal cortex (reasoning centre).", "The key is specificity: 'I am grateful for the conversation with my colleague about the project' is more effective than generic statements."] },
      { title: "Deload Weeks", bullets: ["A deload week reduces training volume or intensity by 40-60% to allow accumulated fatigue to dissipate.", "Planned deloads every 4-6 weeks prevent overtraining and often lead to strength gains in the following week.", "Signs you need a deload include persistent fatigue, decreased motivation, stalled progress, and elevated resting heart rate."] },
      { title: "Magnesium & Recovery", bullets: ["Magnesium is involved in over 300 enzymatic reactions including muscle contraction, nerve function, and energy production.", "Most people are deficient in magnesium because modern soils are depleted and processed foods contain very little.", "Magnesium glycinate before bed can improve sleep quality and reduce muscle cramps, while citrate form supports digestion."] },
      { title: "Napping Strategically", bullets: ["A 20-minute nap boosts alertness and performance without causing sleep inertia (the grogginess from deeper sleep).", "Napping after 3pm or for longer than 30 minutes can reduce sleep pressure and make it harder to fall asleep at night.", "A 'coffee nap' — drinking coffee immediately before a 20-minute nap — is especially effective as caffeine kicks in upon waking."] },
      { title: "Emotional Regulation", bullets: ["The 90-second rule states that the chemical lifespan of an emotion in your body is approximately 90 seconds.", "Any emotional response lasting longer is being sustained by your thoughts and narrative about the situation.", "Labelling emotions precisely ('I feel frustrated' rather than 'I feel bad') activates the prefrontal cortex and reduces emotional intensity."] },
      { title: "Core Training", bullets: ["Your core is a system of muscles including the diaphragm, pelvic floor, transversus abdominis, and multifidus.", "Anti-rotation and anti-extension exercises like Pallof presses and dead bugs build more functional core strength than crunches.", "A strong core transfers force between your upper and lower body, improving performance in every compound lift."] },
      { title: "Electrolytes", bullets: ["Electrolytes (sodium, potassium, magnesium, calcium) regulate fluid balance, muscle contractions, and nerve signalling.", "During intense exercise or in hot conditions, you can lose 1-2g of sodium per hour through sweat.", "Adding a pinch of salt to your water during and after training is a simple way to maintain electrolyte balance."] },
    ],
  },
  // WEEK 5
  {
    weekRange: "Week 5",
    days: [
      { title: "Sleep Debt", bullets: ["Sleep debt accumulates when you consistently get less than your body's required sleep, typically 7-9 hours.", "Even 30 minutes of nightly sleep debt compounds over a week, impairing reaction time equivalent to legal alcohol intoxication.", "You cannot fully 'catch up' on sleep debt over a weekend; consistent nightly sleep is the only real solution."] },
      { title: "Growth Mindset", bullets: ["A growth mindset views abilities as developable through dedication and hard work, not as fixed traits.", "People with a growth mindset recover from setbacks 40% faster because they interpret failure as feedback.", "Replacing 'I can not do this' with 'I can not do this yet' is a simple linguistic shift that rewires your approach to challenges."] },
      { title: "Tempo Training", bullets: ["Controlling rep tempo eliminates momentum and forces the target muscles to do more work.", "A 3-1-2-0 tempo (3s eccentric, 1s pause, 2s concentric, 0 pause) is excellent for building strength and control.", "Tempo training also improves mind-muscle connection, which is associated with greater muscle activation and growth."] },
      { title: "Meal Prep Fundamentals", bullets: ["Preparing meals in advance removes decision fatigue, which is a leading cause of poor food choices.", "Batch cooking 2-3 protein sources and 2-3 carb sources on Sunday creates mix-and-match options for the whole week.", "Pre-portioned meals help you stay consistent with your calorie and macro targets without needing to weigh food daily."] },
      { title: "Light Exposure & Energy", bullets: ["Morning bright light exposure boosts cortisol awakening response, improving alertness and mood for the entire day.", "Spending 2 hours outdoors in natural light has been shown to reduce myopia risk and improve vitamin D status.", "In winter months, a 10,000 lux light therapy lamp for 20-30 minutes each morning can combat seasonal energy dips."] },
      { title: "Self-Compassion", bullets: ["Self-compassion is not self-indulgence; it is treating yourself with the same kindness you would offer a close friend.", "Research shows self-compassion leads to greater motivation and resilience than self-criticism after setbacks.", "The three components are self-kindness, common humanity (recognising struggle is universal), and mindful awareness."] },
      { title: "Unilateral Training", bullets: ["Single-leg and single-arm exercises expose and correct strength imbalances between your left and right sides.", "Unilateral movements also challenge core stability more than bilateral exercises due to the asymmetric load.", "Bulgarian split squats, single-arm rows, and single-leg Romanian deadlifts are excellent unilateral staples."] },
    ],
  },
  // WEEK 6
  {
    weekRange: "Week 6",
    days: [
      { title: "Creatine Benefits", bullets: ["Creatine monohydrate is the most studied sports supplement, shown to improve strength, power, and lean mass.", "Beyond performance, creatine supports brain health by providing energy to neurons during cognitively demanding tasks.", "A daily dose of 3-5g is sufficient; loading phases are unnecessary and may cause temporary water retention and bloating."] },
      { title: "Sleep Consistency", bullets: ["Irregular sleep schedules are as damaging as short sleep, increasing cardiovascular disease risk by 27%.", "Your body's internal clock adjusts to consistent patterns, improving the quality of both deep sleep and REM sleep.", "Aim for your bedtime and wake time to vary by no more than 30 minutes, even on weekends and holidays."] },
      { title: "Breathing Under Load", bullets: ["The Valsalva manoeuvre (bracing your core and holding your breath) creates intra-abdominal pressure that protects your spine during heavy lifts.", "Inhale at the top of the movement, brace, execute the rep, then exhale at the top of the next rep.", "For lighter sets or endurance work, rhythmic breathing (exhale on exertion) prevents unnecessary blood pressure spikes."] },
      { title: "Stress Inoculation", bullets: ["Deliberately exposing yourself to manageable stressors (cold showers, hard workouts, public speaking) builds stress tolerance.", "This concept from psychology shows that controlled exposure increases your capacity to handle uncontrolled stressors.", "Start small and gradually increase the intensity; the goal is to expand your comfort zone, not overwhelm your system."] },
      { title: "Vitamin D & Immunity", bullets: ["Vitamin D receptors exist on virtually every cell in the immune system, making it critical for immune defence.", "Blood levels of 75-100 nmol/L are optimal, but most people in northern latitudes fall well below this without supplementation.", "Taking vitamin D3 with a fat-containing meal increases absorption by up to 50% compared to taking it on an empty stomach."] },
      { title: "Alcohol & Sleep", bullets: ["Even moderate alcohol consumption reduces REM sleep by up to 20%, impairing memory consolidation and emotional processing.", "Alcohol initially acts as a sedative but causes rebound wakefulness in the second half of the night.", "If you drink, stopping at least 3 hours before bed and having one glass of water per alcoholic drink minimises sleep disruption."] },
      { title: "Mind-Muscle Connection", bullets: ["Research shows that consciously focusing on the target muscle during an exercise increases its activation by 20-30%.", "This internal focus works best for isolation and lighter compound exercises; heavy compounds benefit from an external focus.", "Practise by placing your hand on the target muscle during warm-up sets to build the neural pathway."] },
    ],
  },
  // WEEK 7
  {
    weekRange: "Week 7",
    days: [
      { title: "Dopamine & Motivation", bullets: ["Dopamine is not the pleasure chemical; it is the anticipation and motivation chemical that drives you to pursue rewards.", "Constant dopamine hits from phones and social media can lower your baseline dopamine, reducing motivation for harder tasks.", "Dopamine fasting (periodically removing easy dopamine sources) can help restore sensitivity and reignite motivation."] },
      { title: "Periodisation", bullets: ["Periodisation structures training into phases (accumulation, intensification, realisation) to optimise long-term progress.", "Without periodisation, the body adapts to a fixed stimulus within 4-6 weeks and progress stalls.", "Even a simple approach of alternating between higher volume and higher intensity blocks every 4 weeks is highly effective."] },
      { title: "Gut-Brain Axis", bullets: ["Your gut produces 95% of your body's serotonin, directly influencing mood, anxiety, and cognitive function.", "A diverse diet with 30+ different plant foods per week supports gut microbiome diversity and mental health.", "Fermented foods like yoghurt, kefir, and sauerkraut introduce beneficial bacteria that communicate with your brain via the vagus nerve."] },
      { title: "Sleep & Muscle Recovery", bullets: ["Growth hormone release peaks during the first bout of deep sleep, typically within the first 90 minutes of the night.", "Athletes who sleep less than 7 hours have a 1.7 times higher injury risk compared to those sleeping 8+ hours.", "Sleeping in a cool, dark room and avoiding large meals 2-3 hours before bed optimises deep sleep for recovery."] },
      { title: "Attention Training", bullets: ["Your attention is a muscle that can be trained; focused attention practice improves concentration in all areas of life.", "The Pomodoro technique (25 minutes focused work, 5 minute break) trains sustained attention in manageable blocks.", "Single-tasking (doing one thing at a time) is 40% more productive than multitasking and reduces mental fatigue."] },
      { title: "Grip Strength & Longevity", bullets: ["Grip strength is one of the strongest predictors of all-cause mortality, outperforming blood pressure in some studies.", "Farmer's carries, dead hangs, and plate pinches are simple ways to build grip strength alongside your regular training.", "Grip strength reflects overall neuromuscular function, which is why it correlates so strongly with health and longevity."] },
      { title: "Anti-Inflammatory Eating", bullets: ["Chronic low-grade inflammation is linked to nearly every major disease, from heart disease to depression.", "Colourful fruits and vegetables contain polyphenols and antioxidants that actively combat inflammatory pathways.", "Reducing processed seed oils, refined sugar, and ultra-processed foods is often more impactful than adding specific anti-inflammatory foods."] },
    ],
  },
  // WEEK 8
  {
    weekRange: "Week 8",
    days: [
      { title: "Nervous System Recovery", bullets: ["Your central nervous system needs 48-72 hours to recover from maximal-effort training sessions.", "Signs of CNS fatigue include reduced grip strength, slower reaction times, and decreased motivation to train.", "Low-intensity activities like walking, swimming, and yoga on rest days promote blood flow and nervous system recovery."] },
      { title: "Caffeine Strategy", bullets: ["Caffeine has a half-life of 5-6 hours, meaning half the caffeine from a 2pm coffee is still in your system at 8pm.", "Peak performance benefits occur 30-60 minutes after consumption when blood caffeine levels are highest.", "Cycling off caffeine for 7-10 days periodically resets your adenosine receptors and restores caffeine's full effectiveness."] },
      { title: "Journalling for Resilience", bullets: ["Expressive writing about stressful events for 15-20 minutes has been shown to improve immune function and reduce anxiety.", "The act of translating emotions into words engages the prefrontal cortex, creating distance from overwhelming feelings.", "A simple framework: describe what happened, how you felt, what you learned, and what you would do differently."] },
      { title: "Hip Hinge Mastery", bullets: ["The hip hinge pattern (bending at the hips while keeping a neutral spine) is fundamental to safe and powerful movement.", "Practise with a dowel rod along your spine: it should maintain contact with your head, upper back, and sacrum throughout the movement.", "Mastering the hip hinge improves deadlifts, kettlebell swings, and protects your lower back during everyday lifting."] },
      { title: "Micronutrient Density", bullets: ["Organ meats, shellfish, and dark leafy greens are among the most nutrient-dense foods per calorie available.", "Cooking methods matter: steaming vegetables retains more nutrients than boiling, which leaches water-soluble vitamins.", "Pairing iron-rich foods with vitamin C sources (like lemon juice on spinach) can increase iron absorption by up to 6 times."] },
      { title: "Wind-Down Routine", bullets: ["A consistent 30-60 minute wind-down routine signals to your brain that sleep is approaching, improving onset latency.", "Effective elements include dimming lights, light stretching, reading physical books, and journalling.", "Avoid stimulating activities like intense exercise, heated discussions, or work emails in the final hour before bed."] },
      { title: "Values-Based Living", bullets: ["Identifying your core values provides a compass for decision-making that reduces stress and increases life satisfaction.", "When daily actions align with personal values, intrinsic motivation increases and burnout risk decreases significantly.", "Review your week each Sunday: did your time allocation reflect your stated values? This awareness alone drives meaningful change."] },
    ],
  },
];

function createEmptySnippets(): SnippetWeek[] {
  return defaultSnippetData.map((week) => ({
    weekRange: week.weekRange,
    days: week.days.map((d) => ({
      title: d.title,
      bullets: [...d.bullets],
    })),
  }));
}

const sampleCourses: Course[] = [
  {
    id: makeId(),
    name: "Understanding Your Health Numbers",
    description: "Learn to interpret key health biomarkers and what they mean for your well-being.",
    coverImageUrl: "",
    difficulty: "Beginner",
    estimatedDuration: "2 hours",
    modules: [
      { id: makeId(), title: "Blood Pressure Basics", content: "What systolic and diastolic readings tell you.", readingTime: 8, quizQuestions: [] },
      { id: makeId(), title: "Cholesterol Demystified", content: "HDL, LDL, triglycerides and their impact.", readingTime: 10, quizQuestions: [] },
      { id: makeId(), title: "Blood Sugar & HbA1c", content: "Understanding glucose metabolism markers.", readingTime: 7, quizQuestions: [] },
      { id: makeId(), title: "Body Composition", content: "BMI, body fat percentage, and lean mass.", readingTime: 6, quizQuestions: [] },
    ],
  },
  {
    id: makeId(),
    name: "Nutrition Foundations",
    description: "Core principles of balanced nutrition for optimal health.",
    coverImageUrl: "",
    difficulty: "Beginner",
    estimatedDuration: "1.5 hours",
    modules: [
      { id: makeId(), title: "Macronutrients 101", content: "Proteins, carbs, and fats explained.", readingTime: 10, quizQuestions: [] },
      { id: makeId(), title: "Micronutrient Essentials", content: "Vitamins and minerals your body needs.", readingTime: 8, quizQuestions: [] },
      { id: makeId(), title: "Meal Planning", content: "Practical strategies for healthy eating.", readingTime: 12, quizQuestions: [] },
    ],
  },
  {
    id: makeId(),
    name: "Sleep Science",
    description: "Evidence-based strategies for better sleep quality.",
    coverImageUrl: "",
    difficulty: "Intermediate",
    estimatedDuration: "1 hour",
    modules: [
      { id: makeId(), title: "Sleep Architecture", content: "Understanding sleep stages and cycles.", readingTime: 10, quizQuestions: [] },
      { id: makeId(), title: "Sleep Hygiene", content: "Creating the ideal sleep environment.", readingTime: 8, quizQuestions: [] },
    ],
  },
  {
    id: makeId(),
    name: "Stress Management",
    description: "Techniques to manage and reduce stress in daily life.",
    coverImageUrl: "",
    difficulty: "Beginner",
    estimatedDuration: "1.5 hours",
    modules: [
      { id: makeId(), title: "Understanding Stress", content: "The physiology of stress response.", readingTime: 8, quizQuestions: [] },
      { id: makeId(), title: "Breathing Techniques", content: "Practical breathing exercises for calm.", readingTime: 6, quizQuestions: [] },
      { id: makeId(), title: "Mindfulness Practice", content: "Introduction to mindfulness meditation.", readingTime: 10, quizQuestions: [] },
    ],
  },
];

// Toast component
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
      type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "success" ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
    </div>
  );
}

// Snippet preview component
function SnippetPreview({ snippet }: { snippet: DailySnippet }) {
  return (
    <div className="bg-gray-900 rounded-xl p-3 w-[200px]">
      <div className="bg-white rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-800 mb-1.5">{snippet.title || "Untitled"}</p>
        <ul className="space-y-1">
          {snippet.bullets.filter(Boolean).map((b, i) => (
            <li key={i} className="text-[10px] text-gray-600 flex items-start gap-1.5">
              <span className="w-1 h-1 bg-[#20c858] rounded-full mt-1 flex-shrink-0" />
              <span>{b}</span>
            </li>
          ))}
          {snippet.bullets.filter(Boolean).length === 0 && (
            <li className="text-[10px] text-gray-300 italic">No content</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default function EducationPage() {
  const [courses, setCourses] = useState<Course[]>(sampleCourses);
  const [snippetWeeks, setSnippetWeeks] = useState<SnippetWeek[]>(createEmptySnippets());
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeSection, setActiveSection] = useState<"courses" | "snippets">("courses");
  const [previewModule, setPreviewModule] = useState<string | null>(null);
  const [snippetWeekIdx, setSnippetWeekIdx] = useState(0);
  const [snippetPreviewDay, setSnippetPreviewDay] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFromSupabase = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("education_courses")
        .select("*")
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        const parsed: Course[] = data.map((row: Record<string, string>) => {
          const modules = JSON.parse(row.modules || "[]");
          return {
            id: row.id,
            name: row.name,
            description: row.description || "",
            coverImageUrl: row.cover_image_url || "",
            difficulty: (row.difficulty || "Beginner") as Course["difficulty"],
            estimatedDuration: row.estimated_duration || "",
            modules: modules.map((m: Record<string, unknown>) => ({
              id: m.id || makeId(),
              title: m.title || "",
              content: m.content || m.description || "",
              readingTime: m.readingTime || 5,
              quizQuestions: m.quizQuestions || [],
            })),
          };
        });
        setCourses(parsed);
        setLoadedFromDb(true);
      }
    } catch {
      // Table may not exist, use sample data
    }

    try {
      const { data: snippetData } = await supabase
        .from("education_snippets")
        .select("*")
        .order("created_at", { ascending: true });
      if (snippetData && snippetData.length > 0) {
        const parsed: SnippetWeek[] = snippetData.map((row: Record<string, string>) => ({
          weekRange: row.week_range,
          days: JSON.parse(row.days || "[]"),
        }));
        if (parsed.length === 4) {
          setSnippetWeeks(parsed);
        }
      }
    } catch {
      // Table may not exist
    }
  }, []);

  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  const update = (updated: Course[]) => {
    setCourses(updated);
    setDirty(true);
  };

  const updateSnippets = (updated: SnippetWeek[]) => {
    setSnippetWeeks(updated);
    setDirty(true);
  };

  const addCourse = () => {
    update([
      ...courses,
      {
        id: makeId(),
        name: "New Course",
        description: "",
        coverImageUrl: "",
        difficulty: "Beginner",
        estimatedDuration: "",
        modules: [],
      },
    ]);
  };

  const deleteCourse = (id: string) => {
    update(courses.filter((c) => c.id !== id));
  };

  const updateCourse = (id: string, field: keyof Course, value: string) => {
    update(courses.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const addModule = (courseId: string) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? { ...c, modules: [...c.modules, createEmptyModule()] }
          : c
      )
    );
  };

  const deleteModule = (courseId: string, moduleId: string) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? { ...c, modules: c.modules.filter((m) => m.id !== moduleId) }
          : c
      )
    );
  };

  const updateModule = (
    courseId: string,
    moduleId: string,
    field: keyof Module,
    value: string | number
  ) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId ? { ...m, [field]: value } : m
              ),
            }
          : c
      )
    );
  };

  const addQuiz = (courseId: string, moduleId: string) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId
                  ? { ...m, quizQuestions: [...m.quizQuestions, createEmptyQuiz()] }
                  : m
              ),
            }
          : c
      )
    );
  };

  const deleteQuiz = (courseId: string, moduleId: string, quizId: string) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId
                  ? { ...m, quizQuestions: m.quizQuestions.filter((q) => q.id !== quizId) }
                  : m
              ),
            }
          : c
      )
    );
  };

  const updateQuiz = (
    courseId: string,
    moduleId: string,
    quizId: string,
    field: string,
    value: string | number | [string, string, string, string]
  ) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId
                  ? {
                      ...m,
                      quizQuestions: m.quizQuestions.map((q) =>
                        q.id === quizId ? { ...q, [field]: value } : q
                      ),
                    }
                  : m
              ),
            }
          : c
      )
    );
  };

  const updateQuizOption = (
    courseId: string,
    moduleId: string,
    quizId: string,
    optIndex: number,
    value: string
  ) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId
                  ? {
                      ...m,
                      quizQuestions: m.quizQuestions.map((q) => {
                        if (q.id !== quizId) return q;
                        const newOpts: [string, string, string, string] = [...q.options];
                        newOpts[optIndex] = value;
                        return { ...q, options: newOpts };
                      }),
                    }
                  : m
              ),
            }
          : c
      )
    );
  };

  const updateSnippetField = (weekIdx: number, dayIdx: number, field: "title", value: string) => {
    const updated = snippetWeeks.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => di === dayIdx ? { ...d, [field]: value } : d),
      };
    });
    updateSnippets(updated);
  };

  const updateSnippetBullet = (weekIdx: number, dayIdx: number, bulletIdx: number, value: string) => {
    const updated = snippetWeeks.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d;
          const newBullets = [...d.bullets];
          newBullets[bulletIdx] = value;
          return { ...d, bullets: newBullets };
        }),
      };
    });
    updateSnippets(updated);
  };

  const addSnippetBullet = (weekIdx: number, dayIdx: number) => {
    const updated = snippetWeeks.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d;
          return { ...d, bullets: [...d.bullets, ""] };
        }),
      };
    });
    updateSnippets(updated);
  };

  const removeSnippetBullet = (weekIdx: number, dayIdx: number, bulletIdx: number) => {
    const updated = snippetWeeks.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d;
          return { ...d, bullets: d.bullets.filter((_, bi) => bi !== bulletIdx) };
        }),
      };
    });
    updateSnippets(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save courses
      await supabase.from("education_courses").delete().neq("id", "");
      const rows = courses.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        cover_image_url: c.coverImageUrl,
        difficulty: c.difficulty,
        estimated_duration: c.estimatedDuration,
        modules: JSON.stringify(c.modules),
      }));
      if (rows.length > 0) {
        await supabase.from("education_courses").insert(rows);
      }

      // Save snippets
      await supabase.from("education_snippets").delete().neq("id", "");
      const snippetRows = snippetWeeks.map((sw, i) => ({
        id: `snippet-week-${i}`,
        week_range: sw.weekRange,
        days: JSON.stringify(sw.days),
      }));
      if (snippetRows.length > 0) {
        await supabase.from("education_snippets").insert(snippetRows);
      }

      setDirty(false);
      setToast({ message: "All changes saved successfully", type: "success" });
    } catch (err) {
      console.error("Save error:", err);
      setToast({ message: "Failed to save changes", type: "error" });
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    if (loadedFromDb) {
      loadFromSupabase();
    } else {
      setCourses(sampleCourses);
      setSnippetWeeks(createEmptySnippets());
    }
    setDirty(false);
  };

  const handleExport = () => {
    const data = { courses, snippetWeeks };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "education-export.json";
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: "Exported education data as JSON", type: "success" });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.courses && Array.isArray(data.courses)) {
          setCourses(data.courses);
          if (data.snippetWeeks) setSnippetWeeks(data.snippetWeeks);
          setDirty(true);
          setToast({ message: "Imported education data from JSON", type: "success" });
        } else {
          setToast({ message: "Invalid JSON format", type: "error" });
        }
      } catch {
        setToast({ message: "Failed to parse JSON file", type: "error" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const difficultyColors: Record<string, string> = {
    Beginner: "bg-green-100 text-green-700",
    Intermediate: "bg-amber-100 text-amber-700",
    Advanced: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Section tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 w-fit">
        <button
          onClick={() => setActiveSection("courses")}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeSection === "courses" ? "bg-[#20c858] text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Courses ({courses.length})
        </button>
        <button
          onClick={() => setActiveSection("snippets")}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeSection === "snippets" ? "bg-[#20c858] text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Daily Snippets
        </button>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {activeSection === "courses" && (
          <button
            onClick={addCourse}
            className="px-4 py-2 bg-[#20c858] text-white text-sm font-medium rounded-lg hover:bg-[#1ab34d] transition-colors"
          >
            + Add Course
          </button>
        )}
        <button
          onClick={handleExport}
          className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Export JSON
        </button>
        <label className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
          Import JSON
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        <div className="ml-auto flex items-center gap-3">
          {dirty && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleDiscard}
            disabled={!dirty}
            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#20c858] text-white text-sm font-medium rounded-lg hover:bg-[#1ab34d] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* COURSES SECTION */}
      {activeSection === "courses" && (
        <div className="space-y-3">
          {courses.map((course) => {
            const totalReadingTime = course.modules.reduce((s, m) => s + m.readingTime, 0);
            return (
              <div
                key={course.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Course header */}
                <div className="flex items-center gap-4 p-4">
                  <button
                    onClick={() => {
                      setExpandedCourse(expandedCourse === course.id ? null : course.id);
                      setExpandedModule(null);
                      setExpandedQuiz(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className={`w-5 h-5 transition-transform ${
                        expandedCourse === course.id ? "rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={course.name}
                        onChange={(e) => updateCourse(course.id, "name", e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900 flex-1 min-w-[200px]"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[course.difficulty]}`}>
                        {course.difficulty}
                      </span>
                      <span className="text-xs text-gray-400">
                        {course.modules.length} module{course.modules.length !== 1 ? "s" : ""} / {totalReadingTime} min
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCourse(course.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Expanded: course details + modules */}
                {expandedCourse === course.id && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Course metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-xl">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                        <textarea
                          value={course.description}
                          onChange={(e) => updateCourse(course.id, "description", e.target.value)}
                          placeholder="Course description..."
                          rows={3}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-[#20c858] outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Cover Image URL</label>
                        <input
                          type="text"
                          value={course.coverImageUrl}
                          onChange={(e) => updateCourse(course.id, "coverImageUrl", e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                        />
                        {course.coverImageUrl && (
                          <div className="mt-2 w-full h-16 bg-gray-200 rounded-lg overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={course.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Difficulty</label>
                        <select
                          value={course.difficulty}
                          onChange={(e) => updateCourse(course.id, "difficulty", e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Estimated Duration</label>
                        <input
                          type="text"
                          value={course.estimatedDuration}
                          onChange={(e) => updateCourse(course.id, "estimatedDuration", e.target.value)}
                          placeholder="e.g. 2 hours"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                        />
                      </div>
                    </div>

                    {/* Modules */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Modules</h3>
                        <button
                          onClick={() => addModule(course.id)}
                          className="px-3 py-1.5 text-sm text-[#20c858] hover:bg-green-50 rounded-lg transition-colors font-medium"
                        >
                          + Add Module
                        </button>
                      </div>
                      <div className="space-y-2">
                        {course.modules.map((mod, idx) => (
                          <div
                            key={mod.id}
                            className={`rounded-lg border overflow-hidden transition-colors ${
                              expandedModule === mod.id ? "border-[#20c858]/30 bg-green-50/20" : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            {/* Module header */}
                            <div className="flex items-center gap-3 p-3">
                              {/* Drag handle */}
                              <div className="text-gray-300 cursor-grab flex-shrink-0">
                                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                </svg>
                              </div>
                              <span className="text-xs text-gray-400 font-mono w-6 text-center flex-shrink-0">
                                {idx + 1}
                              </span>
                              <button
                                onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                                className="flex-1 text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-800">{mod.title || "Untitled"}</span>
                                  <span className="text-xs text-gray-400">{mod.readingTime} min read</span>
                                  {mod.quizQuestions.length > 0 && (
                                    <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                                      {mod.quizQuestions.length} quiz Q
                                    </span>
                                  )}
                                </div>
                              </button>
                              <button
                                onClick={() => setPreviewModule(previewModule === mod.id ? null : mod.id)}
                                className={`p-1 rounded transition-colors text-xs ${
                                  previewModule === mod.id ? "bg-[#20c858] text-white" : "text-gray-400 hover:text-gray-600"
                                }`}
                                title="Preview"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteModule(course.id, mod.id)}
                                className="p-1 text-red-400 hover:text-red-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            {/* Module expanded */}
                            {expandedModule === mod.id && (
                              <div className="border-t border-gray-200 p-4 space-y-3 bg-white">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
                                    <input
                                      type="text"
                                      value={mod.title}
                                      onChange={(e) => updateModule(course.id, mod.id, "title", e.target.value)}
                                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                                      placeholder="Module title"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Reading Time (min)</label>
                                    <input
                                      type="number"
                                      value={mod.readingTime}
                                      onChange={(e) => updateModule(course.id, mod.id, "readingTime", parseInt(e.target.value) || 0)}
                                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                                      min={1}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-gray-500 mb-1 block">Content (Markdown)</label>
                                  <div className="flex gap-3">
                                    <textarea
                                      value={mod.content}
                                      onChange={(e) => updateModule(course.id, mod.id, "content", e.target.value)}
                                      placeholder="Write module content in markdown..."
                                      rows={8}
                                      className={`px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-[#20c858] outline-none resize-y font-mono ${
                                        previewModule === mod.id ? "w-1/2" : "w-full"
                                      }`}
                                    />
                                    {previewModule === mod.id && (
                                      <div className="w-1/2 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 overflow-y-auto max-h-64">
                                        <p className="text-xs text-gray-400 mb-2 font-medium">Preview</p>
                                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                          {mod.content || "No content yet..."}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Quiz section */}
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => setExpandedQuiz(expandedQuiz === mod.id ? null : mod.id)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-purple-50 hover:bg-purple-100/70 transition-colors"
                                  >
                                    <span className="text-sm font-medium text-purple-700">
                                      Quiz Questions ({mod.quizQuestions.length})
                                    </span>
                                    <svg
                                      className={`w-4 h-4 text-purple-400 transition-transform ${
                                        expandedQuiz === mod.id ? "rotate-180" : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {expandedQuiz === mod.id && (
                                    <div className="p-4 space-y-3">
                                      {mod.quizQuestions.map((q, qi) => (
                                        <div key={q.id} className="p-3 border border-purple-200 rounded-lg bg-purple-50/30 space-y-2">
                                          <div className="flex items-start gap-2">
                                            <span className="text-xs text-purple-400 font-mono mt-2">Q{qi + 1}</span>
                                            <input
                                              type="text"
                                              value={q.question}
                                              onChange={(e) => updateQuiz(course.id, mod.id, q.id, "question", e.target.value)}
                                              placeholder="Question text"
                                              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none text-gray-900"
                                            />
                                            <button
                                              onClick={() => deleteQuiz(course.id, mod.id, q.id)}
                                              className="p-1 text-red-400 hover:text-red-600"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 pl-6">
                                            {q.options.map((opt, oi) => (
                                              <div key={oi} className="flex items-center gap-1.5">
                                                <input
                                                  type="radio"
                                                  name={`quiz-${q.id}`}
                                                  checked={q.correctIndex === oi}
                                                  onChange={() => updateQuiz(course.id, mod.id, q.id, "correctIndex", oi)}
                                                  className="accent-[#20c858]"
                                                />
                                                <input
                                                  type="text"
                                                  value={opt}
                                                  onChange={(e) => updateQuizOption(course.id, mod.id, q.id, oi, e.target.value)}
                                                  placeholder={`Option ${oi + 1}`}
                                                  className={`flex-1 px-2 py-1 border rounded text-xs focus:ring-1 outline-none text-gray-900 ${
                                                    q.correctIndex === oi ? "border-green-400 bg-green-50 focus:ring-green-400" : "border-gray-200 focus:ring-purple-400"
                                                  }`}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                      <button
                                        onClick={() => addQuiz(course.id, mod.id)}
                                        className="px-3 py-1.5 text-xs text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
                                      >
                                        + Add Question
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {course.modules.length === 0 && (
                          <p className="text-center text-gray-300 text-sm py-6">No modules yet. Add one above.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {courses.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
              No courses yet. Click &quot;+ Add Course&quot; to create one.
            </div>
          )}
        </div>
      )}

      {/* DAILY SNIPPETS SECTION */}
      {activeSection === "snippets" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Daily Educational Snippets</h3>
              <p className="text-xs text-gray-400 mt-0.5">7 snippets per week, 4 weeks. Each snippet has a title and 3-4 bullet points.</p>
            </div>
          </div>

          {/* Week tabs */}
          <div className="px-4 pt-4">
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 w-fit">
              {weekRanges.map((wr, wi) => (
                <button
                  key={wi}
                  onClick={() => { setSnippetWeekIdx(wi); setSnippetPreviewDay(null); }}
                  className={`px-4 py-1.5 text-xs rounded-md font-medium transition-colors ${
                    snippetWeekIdx === wi
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {wr}
                </button>
              ))}
            </div>
          </div>

          {/* Snippets grid */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {snippetWeeks[snippetWeekIdx].days.map((snippet, dayIdx) => (
              <div key={dayIdx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white hover:border-[#20c858]/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase">{dayLabels[dayIdx]}</span>
                  <button
                    onClick={() => setSnippetPreviewDay(snippetPreviewDay === dayIdx ? null : dayIdx)}
                    className={`p-0.5 rounded text-xs ${
                      snippetPreviewDay === dayIdx ? "bg-[#20c858] text-white" : "text-gray-300 hover:text-gray-500"
                    }`}
                    title="Preview"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={snippet.title}
                  onChange={(e) => updateSnippetField(snippetWeekIdx, dayIdx, "title", e.target.value)}
                  placeholder="Snippet title"
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#20c858] outline-none text-gray-900"
                />
                <div className="space-y-1">
                  {snippet.bullets.map((bullet, bi) => (
                    <div key={bi} className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-gray-300 rounded-full flex-shrink-0" />
                      <input
                        type="text"
                        value={bullet}
                        onChange={(e) => updateSnippetBullet(snippetWeekIdx, dayIdx, bi, e.target.value)}
                        placeholder={`Bullet ${bi + 1}`}
                        className="flex-1 px-1.5 py-0.5 border border-gray-200 rounded text-[11px] focus:ring-1 focus:ring-[#20c858] outline-none text-gray-900"
                      />
                      {snippet.bullets.length > 1 && (
                        <button
                          onClick={() => removeSnippetBullet(snippetWeekIdx, dayIdx, bi)}
                          className="text-gray-300 hover:text-red-400 text-xs"
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                  {snippet.bullets.length < 5 && (
                    <button
                      onClick={() => addSnippetBullet(snippetWeekIdx, dayIdx)}
                      className="text-[10px] text-[#20c858] hover:underline font-medium"
                    >
                      + bullet
                    </button>
                  )}
                </div>

                {/* Inline preview */}
                {snippetPreviewDay === dayIdx && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <SnippetPreview snippet={snippet} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
