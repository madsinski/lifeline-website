// Sample education data — loaded on demand via "Load Sample Data" button

export interface QuizQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export interface Module {
  id: string;
  title: string;
  content: string;
  readingTime: number;
  quizQuestions: QuizQuestion[];
}

export interface Course {
  id: string;
  name: string;
  description: string;
  coverImageUrl: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedDuration: string;
  modules: Module[];
}

export interface DailySnippet {
  title: string;
  bullets: string[];
}

export interface SnippetWeek {
  weekRange: string;
  days: DailySnippet[];
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export const sampleCourses: Course[] = [
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

export const sampleSnippets: SnippetWeek[] = [
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
  {
    weekRange: "Week 3",
    days: [
      { title: "Sleep Temperature", bullets: ["Your core body temperature needs to drop by 1-2 degrees to initiate sleep onset.", "The ideal bedroom temperature for sleep is 16-19 degrees Celsius (60-67 degrees Fahrenheit).", "A warm shower 1-2 hours before bed paradoxically helps by causing a rebound cooling effect on your core temperature."] },
      { title: "Mindfulness Practice", bullets: ["Mindfulness meditation for just 10 minutes daily has been shown to reduce anxiety scores by 30% after 8 weeks.", "The key is non-judgmental awareness: observing thoughts without trying to change or suppress them.", "Body scan meditation is an excellent starting point, systematically directing attention to each body region."] },
      { title: "Compound Movements", bullets: ["Compound exercises like squats, deadlifts, and rows work multiple muscle groups simultaneously for maximum efficiency.", "These movements release more growth hormone and testosterone than isolation exercises due to greater muscle mass involvement.", "Building your programme around 4-5 compound movements ensures balanced development and functional strength."] },
      { title: "Blood Sugar Balance", bullets: ["Blood sugar spikes and crashes affect energy, mood, and long-term metabolic health.", "Pairing carbohydrates with protein, fat, or fibre slows glucose absorption and prevents sharp spikes.", "Walking for just 10 minutes after a meal can reduce the post-meal glucose spike by up to 30%."] },
      { title: "Gratitude & Wellbeing", bullets: ["Writing down three specific things you are grateful for each day rewires your brain to notice positives.", "Gratitude journaling for two weeks has been shown to improve sleep quality and reduce symptoms of depression.", "Being specific matters more than quantity: 'I am grateful for the warm conversation with Sam at lunch' beats 'I am grateful for friends'."] },
      { title: "Recovery Methods", bullets: ["Sleep is the single most important recovery tool, with 7-9 hours needed for optimal tissue repair and adaptation.", "Active recovery like walking or light swimming increases blood flow to damaged tissue without adding training stress.", "Cold water immersion (10-15 degrees for 10 minutes) can reduce muscle soreness but may blunt long-term strength gains if used too frequently."] },
      { title: "Anti-Inflammatory Eating", bullets: ["Chronic low-grade inflammation is linked to nearly every major disease, from heart disease to depression.", "Colourful fruits and vegetables contain polyphenols and antioxidants that actively combat inflammatory pathways.", "Reducing processed seed oils, refined sugar, and ultra-processed foods is often more impactful than adding specific anti-inflammatory foods."] },
    ],
  },
  {
    weekRange: "Week 4",
    days: [
      { title: "Heart Rate Zones", bullets: ["Training in Zone 2 (60-70% of max heart rate) builds aerobic base and improves fat oxidation efficiency.", "Zone 4-5 intervals improve VO2max and anaerobic capacity but require adequate recovery between sessions.", "A simple formula for max heart rate is 220 minus your age, though individual variation can be significant."] },
      { title: "Vitamin D", bullets: ["Vitamin D is crucial for bone health, immune function, and mood regulation, yet most people in northern latitudes are deficient.", "Your skin produces vitamin D when exposed to UVB radiation, but sunscreen, clothing, and latitude limit this.", "Supplementing with 1000-2000 IU daily is generally safe and effective during winter months."] },
      { title: "Sleep Debt", bullets: ["Sleep debt accumulates when you consistently sleep less than your body needs, typically 7-9 hours.", "Even two nights of 6 hours sleep can impair cognitive performance equivalent to staying awake for 24 hours.", "You cannot fully 'repay' chronic sleep debt with a single long sleep, recovery requires consistent adequate sleep over several nights."] },
      { title: "Emotional Regulation", bullets: ["The amygdala hijack describes how strong emotions can bypass rational thought, triggering fight-or-flight responses.", "Creating a 'pause' between stimulus and response, even just 6 seconds, allows the prefrontal cortex to engage.", "Labelling your emotions ('I am feeling anxious') activates the prefrontal cortex and reduces amygdala reactivity."] },
      { title: "Deload Weeks", bullets: ["A deload week reduces training volume or intensity by 40-60% to allow accumulated fatigue to dissipate.", "Most people benefit from a deload every 4-6 weeks, though beginners can often go longer between them.", "Signs you need a deload include persistent fatigue, declining performance, disturbed sleep, and increased irritability."] },
      { title: "Meal Timing", bullets: ["Eating in alignment with your circadian rhythm means consuming most calories earlier in the day.", "A 10-12 hour eating window gives your body adequate time for overnight fasting and cellular repair processes.", "Eating a large meal within 2 hours of bedtime can disrupt sleep quality by raising core body temperature."] },
      { title: "Breathing & Performance", bullets: ["Nasal breathing during low-to-moderate exercise filters, warms, and humidifies air while producing nitric oxide.", "Diaphragmatic breathing improves core stability, which directly translates to better lifting performance.", "The physiological sigh (double inhale through nose, long exhale through mouth) is the fastest way to calm your nervous system."] },
    ],
  },
  {
    weekRange: "Week 5",
    days: [
      { title: "Grip Strength", bullets: ["Grip strength is one of the strongest predictors of overall longevity and functional capacity in later life.", "Dead hangs, farmer's carries, and thick-bar training are the most effective ways to build grip strength.", "Grip endurance can be a limiting factor in back exercises, so training it separately allows better back development."] },
      { title: "Creatine", bullets: ["Creatine monohydrate is the most researched and effective supplement for increasing strength and power output.", "A daily dose of 3-5g is sufficient; loading phases are unnecessary and just speed up muscle saturation by a few days.", "Creatine also shows promising benefits for cognitive function, particularly under stress or sleep deprivation."] },
      { title: "Light Exposure & Sleep", bullets: ["Blue light from screens in the evening suppresses melatonin production by up to 50%, delaying sleep onset.", "Using blue-light filters or warm lighting after sunset can help preserve your natural melatonin curve.", "Morning bright light exposure is actually more impactful on sleep quality than evening light avoidance."] },
      { title: "Self-Compassion", bullets: ["Self-compassion involves treating yourself with the same kindness you would offer a friend during difficult times.", "Research shows self-compassion is more effective than self-criticism for motivation and behaviour change.", "The three components are self-kindness (vs self-judgment), common humanity (vs isolation), and mindfulness (vs over-identification)."] },
      { title: "Unilateral Training", bullets: ["Single-leg and single-arm exercises expose and correct strength imbalances between your left and right sides.", "Unilateral training demands greater core stability, as your body must resist rotation and lateral flexion.", "Bulgarian split squats, single-arm rows, and single-leg deadlifts are excellent unilateral staples."] },
      { title: "Magnesium", bullets: ["Magnesium is involved in over 300 enzymatic reactions and most people do not consume enough through diet alone.", "Magnesium glycinate is well-absorbed and particularly helpful for sleep and relaxation when taken before bed.", "Signs of magnesium deficiency include muscle cramps, poor sleep, anxiety, and irregular heart rhythms."] },
      { title: "Social Connection & Health", bullets: ["Loneliness increases mortality risk by 26%, comparable to smoking 15 cigarettes per day.", "Quality of social connections matters more than quantity, with deep relationships providing the greatest health benefits.", "Regular face-to-face interaction triggers oxytocin release, which reduces stress and supports immune function."] },
    ],
  },
  {
    weekRange: "Week 6",
    days: [
      { title: "Proprioception", bullets: ["Proprioception is your body's ability to sense its position in space without visual input.", "Balance training on unstable surfaces improves proprioception and reduces injury risk by up to 50%.", "Simple exercises like single-leg stands with eyes closed can dramatically improve proprioceptive awareness."] },
      { title: "Caffeine Strategy", bullets: ["Caffeine has a half-life of 5-6 hours, so a 2pm coffee still has half its caffeine in your system at 8pm.", "Delaying your first caffeine intake to 90 minutes after waking allows natural cortisol to fully wake you up.", "Tolerance develops within 1-2 weeks of daily use; cycling off for 7-10 days resets caffeine sensitivity."] },
      { title: "Deep Sleep Optimisation", bullets: ["Deep sleep is when your body releases the majority of growth hormone for tissue repair and muscle building.", "Alcohol, even in small amounts, can reduce deep sleep by up to 40% despite making you feel drowsy.", "Consistent exercise, particularly resistance training, significantly increases the amount of deep sleep you get."] },
      { title: "Values-Based Living", bullets: ["Identifying your core values provides a compass for decision-making and increases life satisfaction.", "When your daily actions align with your values, you experience greater motivation and reduced inner conflict.", "A simple exercise: write down five things that matter most to you, then rate how much time you spend on each."] },
      { title: "Time Under Tension", bullets: ["Time under tension (TUT) refers to how long a muscle is under strain during a set.", "Slowing the tempo to 3-4 seconds per phase increases TUT and stimulates more muscle fibre recruitment.", "A typical hypertrophy set should aim for 40-60 seconds of total time under tension for optimal growth."] },
      { title: "Gut-Brain Axis", bullets: ["Your gut contains 500 million neurons and produces 95% of your body's serotonin, directly influencing mood.", "The vagus nerve is the primary communication highway between your gut and brain.", "Fermented foods like yoghurt, kimchi, and sauerkraut support gut bacteria diversity, which correlates with better mental health."] },
      { title: "Nature & Wellbeing", bullets: ["Spending just 20 minutes in a natural setting measurably reduces cortisol and blood pressure.", "The Japanese practice of 'forest bathing' (shinrin-yoku) has been shown to boost natural killer cell activity for up to 7 days.", "Even viewing nature through a window or looking at nature photographs can reduce stress and improve focus."] },
    ],
  },
  {
    weekRange: "Week 7",
    days: [
      { title: "Mind-Muscle Connection", bullets: ["Consciously focusing on the target muscle during an exercise can increase its activation by up to 20%.", "This internal focus is most effective for isolation exercises and hypertrophy-focused training.", "For compound lifts and maximal strength, an external focus (moving the weight) tends to produce better performance."] },
      { title: "Electrolytes", bullets: ["Sodium, potassium, and magnesium are the three primary electrolytes lost through sweat during exercise.", "Hyponatremia (low sodium) from drinking too much plain water during long exercise is more dangerous than mild dehydration.", "Adding a pinch of salt and a squeeze of citrus to water provides a simple, effective electrolyte drink."] },
      { title: "Nap Science", bullets: ["A 20-minute power nap boosts alertness and performance without causing sleep inertia or grogginess.", "Napping after 3pm or for longer than 30 minutes can interfere with nighttime sleep quality.", "A 'coffee nap' (drinking coffee then immediately napping for 20 minutes) is surprisingly effective as caffeine kicks in as you wake."] },
      { title: "Growth Mindset", bullets: ["A growth mindset views abilities as developable through effort, while a fixed mindset sees them as innate and unchangeable.", "Praising effort and strategy rather than talent fosters resilience and willingness to tackle challenges.", "Reframing 'I can't do this' to 'I can't do this yet' activates different neural pathways associated with learning."] },
      { title: "Periodisation", bullets: ["Periodisation divides your training into phases with different goals: hypertrophy, strength, power, and recovery.", "Linear periodisation increases intensity while decreasing volume over weeks, ideal for beginners.", "Undulating periodisation varies intensity and volume within a single week and may produce better results for intermediate lifters."] },
      { title: "Protein Quality", bullets: ["Protein quality is determined by amino acid profile and digestibility, measured by the DIAAS score.", "Animal proteins generally have higher DIAAS scores, but combining plant proteins can achieve equivalent quality.", "Leucine content is the key driver of muscle protein synthesis, with whey protein being the richest source."] },
      { title: "Digital Detox", bullets: ["Constant smartphone use fragments attention and reduces your capacity for deep, focused work.", "Setting specific phone-free periods (meals, first hour of the day, last hour before bed) builds healthier habits.", "A weekly digital sabbath, even just half a day without screens, can significantly reduce anxiety and improve presence."] },
    ],
  },
  {
    weekRange: "Week 8",
    days: [
      { title: "Posture & Pain", bullets: ["'Perfect' posture is less important than posture variety; the best posture is your next posture.", "Prolonged sitting increases disc pressure by 40% compared to standing, contributing to lower back discomfort.", "Strengthening the posterior chain (glutes, hamstrings, upper back) naturally improves postural endurance."] },
      { title: "Fibre Types", bullets: ["Type I (slow-twitch) muscle fibres excel at endurance and are primarily trained with higher reps and sustained efforts.", "Type II (fast-twitch) fibres generate more force and power but fatigue quickly, trained with heavy loads and explosive movements.", "Most muscles contain a mix of fibre types, and training both ensures complete development and functional capacity."] },
      { title: "Sleep Consistency", bullets: ["Varying your sleep and wake times by more than one hour is associated with a 27% higher risk of metabolic issues.", "Social jet lag (different weekend vs weekday schedules) disrupts circadian rhythm as much as crossing time zones.", "Setting a consistent wake time, even on weekends, is the single most impactful change for sleep quality."] },
      { title: "Purpose & Longevity", bullets: ["Having a strong sense of purpose in life is associated with a 15% lower risk of death from any cause.", "Ikigai, the Japanese concept of 'reason for being', is considered a key factor in Okinawan longevity.", "Purpose can be found in work, relationships, creativity, or contribution; it does not have to be grand or world-changing."] },
      { title: "Progressive Mobility", bullets: ["Like strength training, mobility should be progressively overloaded by increasing range or adding resistance.", "Loaded stretching (stretching a muscle while it bears weight) builds strength and flexibility simultaneously.", "The 'CARs' method (Controlled Articular Rotations) is an excellent daily practice for maintaining joint health."] },
      { title: "Nutrient Timing Window", bullets: ["The 'anabolic window' is wider than once thought; eating protein within 2-3 hours of training is sufficient.", "Pre-workout nutrition matters more than post-workout if you train in a fasted state.", "For most people, focusing on total daily protein intake (1.6-2.2g/kg) matters more than precise timing around workouts."] },
      { title: "Habit Stacking", bullets: ["Habit stacking attaches a new behaviour to an existing habit, leveraging established neural pathways.", "The formula is: 'After I [current habit], I will [new habit]' — for example, 'After I pour my morning coffee, I will write in my journal'.", "Starting with tiny habits (under 2 minutes) and gradually expanding them has a much higher success rate than attempting dramatic changes."] },
    ],
  },
];
