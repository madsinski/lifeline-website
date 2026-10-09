// Adaptive training programme ("HIIT og styrkur"): one programme that adapts
// to the participant instead of a fixed list of sessions.
//
//   level     — "beginner" starts with a 4-week adaptation block so muscles
//               and tendons get used to the load; "active" starts at Stig 1.
//   load      — −2…+2, the participant's own plus/minus: sets, how close to
//               failure each set goes, and the number of HIIT rounds.
//   injuries  — shoulder / knee / back: every exercise that loads that area
//               swaps to a variant that spares it, and HIIT drops jumping,
//               running or rowing as needed.
//   stage     — from the start date: one level up every 12 weeks.
//
// Client-safe and pure: the same settings always give the same sessions, so
// the participant page, the workstation and the print layout agree.
// Library links (image / video / muscles) come from adaptive-program-media.ts.

import type { ActionPlan, ExerciseItem, ExercisePhase, ExerciseSession, ExerciseTemplate } from "./types";
import { PROGRAM_MEDIA } from "./adaptive-program-media";
import type { LiftPattern } from "./start-weight";

export type Region = "shoulder" | "knee" | "back";
export type TrainingLevel = "beginner" | "active";

/** Where the week actually happens. Changes which equipment the plan assumes. */
export type Place = "gym" | "class" | "home";
export const PLACES: Place[] = ["gym", "class", "home"];
export const PLACE_IS: Record<Place, { label: string; hint: string }> = {
  gym: { label: "Í ræktinni", hint: "Þú ferð sjálf(ur) í tækjasal með lóð og tæki." },
  class: { label: "Í hóptímum", hint: "Þú mætir í tíma hjá þjálfara og fylgir tímaplaninu." },
  home: { label: "Heima", hint: "Engin tæki — eigin líkamsþyngd, teygjur og það sem til er." },
};

/**
 * How much hard cardio the body tolerates right now.
 *
 * HIIT is the goal for everyone — it is the single best lever on þol and
 * efnaskipti — but it is earned, not assumed. "limited" keeps the week at
 * Zone 2 until a doctor says otherwise; "easy" builds up through gentler
 * intervals; "full" gets the real thing once the adaptation block is done.
 */
export type CardioLimit = "full" | "easy" | "limited";
export const CARDIO_IS: Record<CardioLimit, { label: string; hint: string }> = {
  full: { label: "Engar takmarkanir", hint: "Þú mátt taka á því." },
  easy: { label: "Fer rólega af stað", hint: "Mæði, verkur eða lítil þjálfun síðustu mánuði. Byrjum mildar." },
  limited: { label: "Má ekki taka hart á því", hint: "Hjartavandi, mikil mæði eða læknisráð um að fara varlega. Aðeins rólegt þol þar til annað kemur í ljós." },
};

/**
 * What a session of something actually trains.
 *
 * The three are deliberately separate rather than one "cardio" bucket,
 * because a sport can be excellent and still leave a hole. Innanhússfótbolti
 * is sprint-and-stop — it is interval work, not steady aerobic work — so it
 * covers `hiit` and leaves the Zone 2 base exactly as empty as it was. Lump
 * them together and the plan wrongly concludes that a footballer needs no
 * easy aerobic work at all, which is the opposite of true.
 */
export type Covers = "strength" | "hiit" | "cardio";
export const COVERS_IS: Record<Covers, string> = { strength: "Styrkur", hiit: "HIIT", cardio: "Rólegt þol" };

/**
 * What something is good for when it trains none of the three qualities.
 *
 * "Góð hreyfing" was the fallback and it says nothing. Fríköfun is the case
 * that forced the distinction: it covers no training quality — apnea research
 * is explicit that breath-hold work does not raise aerobic power, and the
 * dive reflex lowers heart rate rather than driving it — but freedivers score
 * measurably lower on stress, state anxiety and negative affect, and the
 * breathing itself is parasympathetic training. That is worth naming rather
 * than filing under "exercise, sort of".
 */
export type Benefit = "mental" | "mobility" | "breath";
export const BENEFIT_IS: Record<Benefit, string> = {
  mental: "andleg líðan",
  mobility: "liðleiki",
  breath: "öndunarþjálfun",
};

/** How hard it is on the body, for spacing and for not stacking hard days. */
export type Intensity = "hard" | "moderate" | "easy";
export const INTENSITY_IS: Record<Intensity, string> = { hard: "Erfitt", moderate: "Miðlungs", easy: "Rólegt" };

/**
 * Something the participant already does every week.
 *
 * Most people arrive with a week that is already half full — football on
 * Mondays, CrossFit on Saturdays — and a plan that ignores it either
 * double-books them or prescribes strength they are already getting. These
 * are declared once, with what each one actually trains, and the core fills
 * the gaps around them instead of competing with them.
 */
export interface Activity {
  id: string;
  name: string;
  /** Monday-first 0–6 */
  day: number;
  /** "HH:MM", when they know it. */
  at: string | null;
  minutes: number | null;
  covers: Covers[];
  /** Qualities it half-covers; see ActivityPreset.partial. */
  partial?: Covers[];
  /** What it is good for when it replaces none of the three. */
  benefits?: Benefit[];
  intensity: Intensity;
  /**
   * Which split a strength session is, when the person knows.
   *
   * "Lyftingar" on a Friday says nothing about what is being trained, so the
   * core cannot tell whether the week already covers legs. Asking once, when
   * it is added, is cheaper than guessing every week — and it is what lets
   * the session card say which areas are loaded.
   */
  focus?: StrengthFocus | null;
  /** Per-session load offset, −2…+2, on top of the programme's own. */
  load?: number | null;
}

export type StrengthFocus = "full" | "upper" | "lower" | "core";

export const STRENGTH_FOCUS_IS: Record<StrengthFocus, { label: string; blurb: string; areas: string[] }> = {
  full:  { label: "Allur líkaminn", blurb: "Blandað — fætur, bak, bringa, axlir", areas: ["Mjóbak", "Hné", "Axlir"] },
  upper: { label: "Efri hluti",     blurb: "Bak, bringa, axlir, armar",           areas: ["Axlir", "Olnbogar"] },
  lower: { label: "Neðri hluti",    blurb: "Fætur, rass, aftanlæri",              areas: ["Hné", "Mjóbak", "Aftanlæri"] },
  core:  { label: "Kviður og bol",  blurb: "Kviður, mjóbak, stöðugleiki",          areas: ["Mjóbak"] },
};

/** Which presets are a lift, and therefore worth asking the split for. */
export const asksStrengthFocus = (covers: string[], name: string) =>
  covers.includes("strength") && /lyfting|styrk|ræktin|gym/i.test(name);

/** The usual suspects, so adding one is two taps rather than a form. */
export interface ActivityPreset {
  name: string;
  covers: Covers[];
  /**
   * Half-credit. A sport can contribute to a quality without replacing it.
   *
   * Football is the case that forced this. An hour of it is 5–10 km of
   * running, so claiming it does nothing for the aerobic base is plainly
   * wrong — but the time is spent at 80–90% of max heart rate, above the
   * zone 2 band, and the adaptations zone 2 is for (mitochondrial density,
   * fat oxidation, capillarisation) come from long efforts BELOW the first
   * threshold. So two games a week count as one zone 2 session, not two and
   * not none, and the plan adds the one that is missing.
   */
  partial?: Covers[];
  /** What it is good for when it replaces none of the three. */
  benefits?: Benefit[];
  intensity: Intensity;
  minutes: number;
  group: string;
  /** A lucide icon name; see MODALITY_ICONS in ActivityIcon.tsx. */
  icon: string;
  why?: string;
}

/**
 * What a sport actually trains.
 *
 * Each entry claims only what the evidence supports. Three rules decide the
 * `covers` list and they are worth stating, because the obvious answer is
 * often wrong:
 *
 *   • Sprint-and-stop sports cover HIIT and NOT rólegt þol. Football is
 *     interval work; crediting it as steady aerobic work would let a
 *     footballer skip the Zone 2 base, which is the opposite of true.
 *   • Steady work at a conversational pace covers rólegt þol and not HIIT,
 *     however long it lasts. A four-hour hike is still Zone 2.
 *   • Something can be excellent and cover nothing. Yoga, mobility and
 *     breath work are worth doing and are not a substitute for strength,
 *     intervals or an aerobic base, so they say so.
 */
export const ACTIVITY_PRESETS: ActivityPreset[] = [
  // ── Styrkur ───────────────────────────────────────────────────────────
  { group: "Styrkur", name: "Lyftingar", covers: ["strength"], intensity: "hard", minutes: 60, icon: "Dumbbell" },
  { group: "Styrkur", name: "CrossFit", covers: ["strength", "hiit"], intensity: "hard", minutes: 60, icon: "Flame", why: "Lyftingar og HIIT í sama tíma — telst sem hvoru tveggja." },
  { group: "Styrkur", name: "Hóptími með lóðum", covers: ["strength"], intensity: "moderate", minutes: 55, icon: "Users" },
  { group: "Styrkur", name: "Áhaldaleikfimi", covers: ["strength"], intensity: "moderate", minutes: 55, icon: "PersonStanding" },
  { group: "Styrkur", name: "Kettlebell-tími", covers: ["strength", "hiit"], intensity: "hard", minutes: 45, icon: "Weight", why: "Lyft og púl í senn." },
  { group: "Styrkur", name: "Klifur", covers: ["strength"], intensity: "hard", minutes: 90, icon: "Mountain", why: "Gríðarlegur gripstyrkur og efri líkami." },
  { group: "Styrkur", name: "Ólympískar lyftingar", covers: ["strength"], intensity: "hard", minutes: 75, icon: "Medal" },
  { group: "Styrkur", name: "TRX eða hringir", covers: ["strength"], intensity: "moderate", minutes: 45, icon: "Cable" },

  // ── Íþróttir: spretta-og-stopp ────────────────────────────────────────
  { group: "Íþróttir", name: "Innanhússfótbolti", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 60, icon: "Goal", why: "Spretta-og-stopp — telst sem HIIT, ekki sem rólegt þol." },
  { group: "Íþróttir", name: "Fótbolti úti", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 90, icon: "Goal", why: "Spretta-og-stopp — telst sem HIIT." },
  { group: "Íþróttir", name: "Handbolti", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 60, icon: "Target", why: "Spretta-og-stopp — telst sem HIIT." },
  { group: "Íþróttir", name: "Körfubolti", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 60, icon: "CircleDot", why: "Spretta-og-stopp — telst sem HIIT." },
  { group: "Íþróttir", name: "Blak", covers: ["hiit"], partial: ["cardio"], intensity: "moderate", minutes: 60, icon: "Volleyball" },
  { group: "Íþróttir", name: "Badminton", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 60, icon: "Volleyball", why: "Spretta-og-stopp — telst sem HIIT." },
  { group: "Íþróttir", name: "Tennis eða padel", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 60, icon: "Volleyball", why: "Spretta-og-stopp — telst sem HIIT." },
  { group: "Íþróttir", name: "Skvass", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 45, icon: "Volleyball" },
  { group: "Íþróttir", name: "Íshokkí", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 60, icon: "Snowflake" },
  { group: "Íþróttir", name: "Bardagaíþróttir", covers: ["hiit", "strength"], partial: ["cardio"], intensity: "hard", minutes: 75, icon: "Swords", why: "Lotur á fullu og mikil líkamleg vinna." },
  { group: "Íþróttir", name: "Dans", covers: ["cardio"], intensity: "moderate", minutes: 60, icon: "Music" },

  // ── HIIT og púl ───────────────────────────────────────────────────
  { group: "HIIT og púl", name: "Spinning", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 45, icon: "Bike" },
  { group: "HIIT og púl", name: "HIIT-tími", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 45, icon: "Flame" },
  { group: "HIIT og púl", name: "Sprettir eða brekkur", covers: ["hiit"], intensity: "hard", minutes: 30, icon: "Timer" },
  { group: "HIIT og púl", name: "Róður á fullu", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 30, icon: "Waves" },
  { group: "HIIT og púl", name: "Þrektími", covers: ["hiit", "strength"], partial: ["cardio"], intensity: "hard", minutes: 50, icon: "Flame" },
  { group: "HIIT og púl", name: "Hlaup — hraðaæfing", covers: ["hiit"], partial: ["cardio"], intensity: "hard", minutes: 45, icon: "SportShoe" },

  // ── Rólegt þol ────────────────────────────────────────────────────────
  { group: "Rólegt þol", name: "Skokk innandyra (hlaupabretti)", covers: ["cardio"], intensity: "moderate", minutes: 40, icon: "SportShoe" },
  { group: "Rólegt þol", name: "Skokk utandyra", covers: ["cardio"], intensity: "moderate", minutes: 40, icon: "SportShoe" },
  { group: "Rólegt þol", name: "Hjól innandyra (þrekhjól)", covers: ["cardio"], intensity: "moderate", minutes: 45, icon: "Bike" },
  { group: "Rólegt þol", name: "Hjól utandyra", covers: ["cardio"], intensity: "moderate", minutes: 60, icon: "Bike" },
  { group: "Rólegt þol", name: "Fjallahjól", covers: ["cardio"], intensity: "moderate", minutes: 75, icon: "Bike" },
  { group: "Rólegt þol", name: "Róðravél, rólega", covers: ["cardio"], intensity: "moderate", minutes: 30, icon: "Waves" },
  { group: "Rólegt þol", name: "Skíðavél", covers: ["cardio"], intensity: "moderate", minutes: 30, icon: "Wind" },
  { group: "Rólegt þol", name: "Sund", covers: ["cardio"], intensity: "moderate", minutes: 45, icon: "WavesLadder" },
  { group: "Rólegt þol", name: "Gönguferð eða fjallganga", covers: ["cardio"], intensity: "easy", minutes: 90, icon: "Mountain", why: "Löng og róleg — einmitt það sem rólegt þol er." },
  { group: "Rólegt þol", name: "Ganga", covers: ["cardio"], intensity: "easy", minutes: 45, icon: "Footprints" },
  { group: "Rólegt þol", name: "Gönguskíði", covers: ["cardio"], intensity: "moderate", minutes: 60, icon: "MountainSnow" },
  { group: "Rólegt þol", name: "Svigskíði eða bretti", covers: ["cardio"], intensity: "moderate", minutes: 120, icon: "MountainSnow" },
  { group: "Rólegt þol", name: "Golf (gangandi)", covers: ["cardio"], intensity: "easy", minutes: 180, icon: "Flag", why: "Löng, róleg ganga." },
  { group: "Rólegt þol", name: "Kajak eða róður úti", covers: ["cardio"], intensity: "moderate", minutes: 60, icon: "Sailboat" },
  { group: "Rólegt þol", name: "Hestamennska", covers: ["cardio"], intensity: "easy", minutes: 60, icon: "TreePine" },
  { group: "Rólegt þol", name: "Garðvinna eða snjómokstur", covers: ["cardio"], intensity: "moderate", minutes: 45, icon: "Shovel", why: "Telst með — þetta er alvöru vinna." },

  // ── Gott fyrir þig, en kemur ekki í stað neins ────────────────────────
  { group: "Annað", name: "Jóga", covers: [], benefits: ["mobility", "mental"], intensity: "easy", minutes: 60, icon: "StretchHorizontal", why: "Frábært fyrir liðleika og streitu, kemur ekki í stað styrks eða þols." },
  { group: "Annað", name: "Pilates", covers: [], benefits: ["mobility"], intensity: "easy", minutes: 55, icon: "PersonStanding" },
  { group: "Annað", name: "Teygjur eða liðleiki", covers: [], benefits: ["mobility"], intensity: "easy", minutes: 30, icon: "StretchHorizontal" },
  { group: "Annað", name: "Fríköfun", covers: [], benefits: ["breath", "mental"], intensity: "easy", minutes: 60, icon: "Fish", why: "Köfunarviðbragðið hægir á hjartanu í stað þess að auka álagið, og rannsóknir sýna að öndunarstopp eykur ekki þolið. Það kemur því hvorki í stað rólegs þols né HIIT — en kafarar mælast marktækt lægri í streitu og kvíða, og öndunin sjálf er þjálfun í slökun." },
  { group: "Annað", name: "Sjósund eða kuldaböð", covers: [], benefits: ["mental"], intensity: "easy", minutes: 20, icon: "WavesLadder" },
  { group: "Annað", name: "Öndunaræfingar", covers: [], benefits: ["breath", "mental"], intensity: "easy", minutes: 15, icon: "Wind" },
  { group: "Annað", name: "Sjúkraþjálfun", covers: [], benefits: ["mobility"], intensity: "easy", minutes: 45, icon: "HeartPulse" },
];

/**
 * What a sport IS, for the week.
 *
 * Not a note in the margin: an hour of indoor football is the hard lota for
 * that day and CrossFit is the strength day. Showing them as something other
 * than the session they are made the plan look empty on days that were
 * anything but.
 *
 * When something covers two qualities the harder one names the day, because
 * that is what the day costs you.
 */
/** Days already holding something hard — nothing else should land there. */
export function hardDays(s: Pick<TrainingSettings, "activities">): number[] {
  return [...new Set((s.activities ?? [])
    .filter((a) => a.intensity === "hard" || a.covers.includes("hiit") || a.covers.includes("strength"))
    .map((a) => a.day))];
}

export function activityModality(a: { covers: Covers[] }): "strength" | "hiit" | "cardio" | "other" {
  if (a.covers.includes("hiit")) return "hiit";
  if (a.covers.includes("strength")) return "strength";
  if (a.covers.includes("cardio")) return "cardio";
  return "other";
}

/** "Styrkur og HIIT" — everything it trains, for the session's subtitle. */
/** "a", "a og b", "a, b og c" — one conjunction, at the end, as Icelandic does. */
function listIs(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} og ${parts[parts.length - 1]}`;
}

export function activityFocus(a: { covers: Covers[]; partial?: Covers[]; benefits?: Benefit[] }): string {
  // HIIT is an acronym; lower-casing it the way the other labels are would
  // read as a typo.
  const label = (c: Covers) => (c === "hiit" ? "HIIT" : COVERS_IS[c].toLowerCase());
  const full = a.covers.map(label);
  const half = (a.partial ?? []).filter((c) => !a.covers.includes(c)).map((c) => `hálft ${label(c)}`);
  const all = [...full, ...half];
  // Nothing from the three qualities: say what it IS good for rather than
  // the empty "Góð hreyfing".
  if (!all.length) {
    const b = (a.benefits ?? []).map((x) => BENEFIT_IS[x]);
    return b.length ? listIs(b).replace(/^./, (m) => m.toUpperCase()) : "Góð hreyfing";
  }
  return listIs(all).replace(/^./, (m) => m.toUpperCase());
}

export const ACTIVITY_GROUPS = ["Styrkur", "Íþróttir", "HIIT og púl", "Rólegt þol", "Annað"] as const;

/**
 * Other ways to satisfy a session.
 *
 * The plan asks for a quality, not for a particular room: a strength day is
 * two whole-body lifts' worth of work, and a CrossFit class is that. Naming
 * the equivalents on the session itself is what stops someone skipping the
 * week because they could not face the gym.
 */
export const EQUIVALENTS: Record<Covers, string[]> = {
  strength: ["CrossFit", "lyftingatími", "hóptími með lóðum", "áhaldaleikfimi"],
  hiit: ["innanhússfótbolti", "handbolti", "spinning", "sprettir eða brekkur", "HIIT-tími"],
  cardio: ["rösk ganga", "skokk úti eða á bretti", "hjól úti eða inni", "sund", "fjallganga"],
};

export interface TrainingSettings {
  level: TrainingLevel;
  /** −2 … +2 */
  load: number;
  injuries: Region[];
  /** First training day; the stage is counted from here (else the plan start). */
  started_on: string | null;
  /**
   * Where they train — several, because that is the normal case. Someone
   * lifts at the gym, takes a class on Saturdays and does something in the
   * living room when the week falls apart.
   *
   * The equipment the plan assumes comes from the best-equipped place they
   * have (gym over home), since anyone with a gym can always do the home
   * version but not the reverse. Classes only take over the delivery when
   * they are the only place, because a class-goer who also lifts wants the
   * lifts written out.
   */
  places: Place[];
  cardio: CardioLimit;
  /** Weekdays the participant can train, Monday-first 0–6. */
  days: number[];
  /** What they already do every week; the core fills in around it. */
  activities: Activity[];
}

/** Monday, Wednesday, Friday until they say otherwise. */
export const DEFAULT_DAYS = [0, 2, 4];

export const DEFAULT_TRAINING: TrainingSettings = {
  level: "beginner", load: 0, injuries: [], started_on: null,
  places: ["gym"], cardio: "full", days: DEFAULT_DAYS, activities: [],
};

/** The place whose equipment the prescription assumes. */
export function effectivePlace(places: Place[]): Place {
  if (places.includes("gym")) return "gym";
  if (places.includes("home")) return "home";
  return places.includes("class") ? "class" : "gym";
}

export const REGION_IS: Record<Region, { label: string; gen: string }> = {
  shoulder: { label: "Öxl", gen: "axlar" },
  knee: { label: "Hné", gen: "hnés" },
  back: { label: "Bak", gen: "baks" },
};
export const REGIONS: Region[] = ["shoulder", "knee", "back"];

export const LOAD_IS: Record<number, string> = {
  [-2]: "Mun léttara",
  [-1]: "Léttara",
  0: "Samkvæmt áætlun",
  1: "Þyngra",
  2: "Mun þyngra",
};

/** Programme keys that are computed here rather than stored as sessions. */
export const ADAPTIVE_KEYS = ["hiit-styrkur"] as const;
export const isAdaptive = (key: string | null | undefined) =>
  !!key && (ADAPTIVE_KEYS as readonly string[]).includes(key.replace(/-custom$/, ""));

// ── stages ─────────────────────────────────────────────────────────
type StageKey = "adapt" | "s1" | "s2" | "s3";
interface Stage {
  key: StageKey;
  title: string;
  /** null = open-ended */
  weeks: number | null;
  text: string;
  sets: number;
  reps: string;
  /** reps left in the tank at the end of each set */
  rir: number;
  tempo: string | null;
  hiit: { rounds: number; work: number; rest: number };
}
const STAGES: Record<StageKey, Stage> = {
  adapt: {
    key: "adapt", title: "Aðlögun", weeks: 4,
    text: "Vöðvar og sinar venjast álaginu. Létt, rólegt og tæknin í forgangi. Sinar aðlagast hægar en vöðvar og því er byrjað svona.",
    sets: 2, reps: "12–15", rir: 4, tempo: "3 sek. niður, 1 sek. upp",
    hiit: { rounds: 6, work: 20, rest: 70 },
  },
  s1: {
    key: "s1", title: "Stig 1 – Grunnur", weeks: 12,
    text: "Þrjú sett af stóru hreyfingunum. Þegar þú nærð efri mörkum endurtekninga í öllum settum máttu þyngja.",
    sets: 3, reps: "10–12", rir: 3, tempo: null,
    hiit: { rounds: 8, work: 30, rest: 60 },
  },
  s2: {
    key: "s2", title: "Stig 2 – Uppbygging", weeks: 12,
    text: "Þyngri útgáfur og færri endurtekningar. Síðustu endurtekningarnar eiga að vera krefjandi.",
    sets: 3, reps: "8–10", rir: 2, tempo: null,
    hiit: { rounds: 10, work: 30, rest: 45 },
  },
  s3: {
    key: "s3", title: "Stig 3 – Styrkur", weeks: null,
    text: "Þungt og krefjandi, með góðri tækni. Haltu áfram að þyngja smám saman.",
    sets: 4, reps: "6–8", rir: 1, tempo: null,
    hiit: { rounds: 8, work: 40, rest: 40 },
  },
};

const sequence = (level: TrainingLevel): StageKey[] => (level === "beginner" ? ["adapt", "s1", "s2", "s3"] : ["s1", "s2", "s3"]);

const DAY = 86_400_000;
export interface StageInfo {
  key: StageKey;
  index: number;
  count: number;
  title: string;
  text: string;
  week: number;
  /** weeks until the next level, null at the last one */
  weeksToNext: number | null;
  nextTitle: string | null;
}

export function stageAt(s: TrainingSettings, planStart: string | null, now = new Date()): StageInfo {
  const start = s.started_on || planStart;
  const t0 = start ? Date.parse(start) : NaN;
  const weeksIn = Number.isNaN(t0) ? 0 : Math.max(0, Math.floor((now.getTime() - t0) / (7 * DAY)));
  const seq = sequence(s.level);
  let from = 0;
  for (let i = 0; i < seq.length; i++) {
    const st = STAGES[seq[i]];
    if (st.weeks === null || weeksIn < from + st.weeks) {
      const next = seq[i + 1] ? STAGES[seq[i + 1]] : null;
      return {
        key: st.key, index: i, count: seq.length, title: st.title, text: st.text,
        week: weeksIn - from + 1,
        weeksToNext: st.weeks === null ? null : from + st.weeks - weeksIn,
        nextTitle: next?.title ?? null,
      };
    }
    from += st.weeks;
  }
  const last = STAGES[seq[seq.length - 1]];
  return { key: last.key, index: seq.length - 1, count: seq.length, title: last.title, text: last.text, week: 1, weeksToNext: null, nextTitle: null };
}

/** The stages as the plan's progression timeline. */
export function stagePhases(level: TrainingLevel): ExercisePhase[] {
  let from = 1;
  return sequence(level).map((k) => {
    const st = STAGES[k];
    const weeks = st.weeks === null ? `Frá viku ${from}` : `Vika ${from}–${from + st.weeks - 1}`;
    if (st.weeks) from += st.weeks;
    return { weeks, title: st.title, text: st.text };
  });
}

// ── exercises ──────────────────────────────────────────────────────
interface Variant { name: string; lib?: string; note?: string }
interface Slot {
  /** areas the movement loads */
  loads: Region[];
  /** What kind of movement it is, for the starting-weight estimate. */
  pattern?: LiftPattern;
  byStage: Record<StageKey, Variant>;
  /** The same pattern with nothing but bodyweight, a band and a heavy bag. */
  atHome: Record<StageKey, Variant>;
  /** the variant that spares an injured area */
  spare: Partial<Record<Region, Variant>>;
  /** timed hold instead of reps, e.g. plank */
  hold?: boolean;
  cues: string[];
}

const SQUAT: Slot = {
  loads: ["knee", "back"],
  pattern: "squat",
  byStage: {
    adapt: { name: "Hnébeygja niður á kassa eða stól", lib: "Box Squat" },
    s1: { name: "Bikarhnébeygja með ketilbjöllu", lib: "Goblet Squat" },
    s2: { name: "Bikarhnébeygja, þyngri ketilbjalla", lib: "Goblet Squat" },
    s3: { name: "Hnébeygja með stöng", lib: "Barbell Full Squat" },
  },
  atHome: {
    adapt: { name: "Hnébeygja niður á stól", lib: "Box Squat" },
    s1: { name: "Hnébeygja með eigin líkamsþyngd", lib: "Bodyweight Squat" },
    s2: { name: "Hnébeygja með bakpoka eða þyngd í fangi", lib: "Goblet Squat", note: "Bakpoki með bókum eða vatnsbrúsum dugar vel." },
    s3: { name: "Búlgörsk hnébeygja með þyngd", lib: "Bulgarian Split Squat", note: "Aftari fótur upp á stól." },
  },
  spare: {
    knee: { name: "Hnébeygja niður á háan kassa", lib: "Box Squat", note: "Styttri hreyfiferill sem minnkar álag á hnén. Hærri kassi, minna álag." },
    back: { name: "Fótapressa í tæki", lib: "Leg Press", note: "Bakið er stutt. Í stað hnébeygju vegna baks." },
  },
  cues: ["Brjóstið upp og þyngdin á hælunum.", "Hnén fylgja tánum."],
};
const HINGE: Slot = {
  loads: ["back"],
  pattern: "hinge",
  byStage: {
    adapt: { name: "Mjaðmalyfta á gólfi", lib: "Glute Bridges" },
    s1: { name: "Rúmensk réttstöðulyfta með handlóðum", lib: "Romanian Deadlift" },
    s2: { name: "Réttstöðulyfta með ketilbjöllu eða hex-stöng", lib: "Conventional Deadlift" },
    s3: { name: "Réttstöðulyfta með stöng", lib: "Barbell Deadlift" },
  },
  atHome: {
    adapt: { name: "Mjaðmalyfta á gólfi", lib: "Glute Bridges" },
    s1: { name: "Mjaðmalyfta á öðrum fæti", lib: "Single Leg Glute Bridge" },
    s2: { name: "Rúmensk réttstöðulyfta með teygju", lib: "Romanian Deadlift" },
    s3: { name: "Réttstöðulyfta á öðrum fæti með þyngd", lib: "Kettlebell One-Legged Deadlift" },
  },
  spare: {
    back: { name: "Mjaðmalyfta með lóð", lib: "Hip Thrust", note: "Í stað réttstöðulyftu vegna baks." },
  },
  cues: ["Beint bak, hreyfingin kemur frá mjöðmunum.", "Lóðið nálægt líkamanum."],
};
const LUNGE: Slot = {
  loads: ["knee"],
  pattern: "lunge",
  byStage: {
    adapt: { name: "Afturstig með stuðningi", lib: "Reverse Lunge" },
    s1: { name: "Afturstig", lib: "Reverse Lunge" },
    s2: { name: "Afturstig með handlóðum", lib: "Reverse Lunge" },
    s3: { name: "Búlgörsk hnébeygja", lib: "Bulgarian Split Squat" },
  },
  atHome: {
    adapt: { name: "Afturstig með stuðningi við vegg", lib: "Reverse Lunge" },
    s1: { name: "Afturstig", lib: "Reverse Lunge" },
    s2: { name: "Afturstig með bakpoka", lib: "Reverse Lunge" },
    s3: { name: "Uppstig á stól með þyngd", lib: "Step-Up" },
  },
  spare: {
    knee: { name: "Mjaðmalyfta á öðrum fæti", lib: "Single Leg Glute Bridge", note: "Í stað framstigs vegna hnés." },
  },
  cues: ["Stutt, stjórnað skref.", "Framhnéð yfir miðjum fæti."],
};
const PUSH: Slot = {
  loads: ["shoulder"],
  pattern: "push",
  byStage: {
    adapt: { name: "Armbeygjur upp við vegg eða borð", lib: "Incline Push-Up", note: "Því hærra sem hendurnar eru, því léttara." },
    s1: { name: "Armbeygjur á bekk eða hnjám", lib: "Incline Push-Up" },
    s2: { name: "Bekkpressa með handlóðum", lib: "Dumbbell Bench Press" },
    s3: { name: "Bekkpressa með stöng", lib: "Barbell Bench Press - Medium Grip" },
  },
  atHome: {
    adapt: { name: "Armbeygjur upp við vegg", lib: "Incline Push-Up", note: "Því hærra sem hendurnar eru, því léttara." },
    s1: { name: "Armbeygjur á hnjám eða upp við borð", lib: "Incline Push-Up" },
    s2: { name: "Armbeygjur á gólfi", lib: "Standard Push-Up" },
    s3: { name: "Armbeygjur með fætur upp á stól", lib: "Decline Push-Up" },
  },
  spare: {
    shoulder: { name: "Gólfpressa með handlóðum, hlutlaust grip", lib: "Dumbbell Floor Press", note: "Styttri hreyfiferill sem hlífir öxlinni." },
  },
  cues: ["Olnbogar um 45° frá líkamanum.", "Spenntur kviður, beinn líkami."],
};
const PULL: Slot = {
  loads: ["back"],
  pattern: "pull",
  byStage: {
    adapt: { name: "Sitjandi róður í tæki", lib: "Seated Cable Row" },
    s1: { name: "Róður með handlóð á bekk", lib: "Dumbbell Single-Arm Row" },
    s2: { name: "Sitjandi róður í kapli", lib: "Seated Cable Row" },
    s3: { name: "Róður með stöng", lib: "Pendlay Row" },
  },
  atHome: {
    adapt: { name: "Róður með teygju, sitjandi", lib: "Bodyweight Mid Row" },
    s1: { name: "Róður með teygju", lib: "Bodyweight Mid Row" },
    s2: { name: "Róður með bakpoka, annar handleggur", lib: "Dumbbell Single-Arm Row", note: "Styðjið hina höndina á stól." },
    s3: { name: "Öfugur róður undir traustu borði", lib: "Inverted Row", note: "Því láréttari sem líkaminn er, því þyngra." },
  },
  spare: {
    back: { name: "Sitjandi róður í tæki með brjóststuðningi", lib: "Seated Cable Row", note: "Bakið er stutt. Í stað frambeygðs róðurs vegna baks." },
  },
  cues: ["Dragðu herðablöðin saman og niður.", "Olnbogar nálægt líkamanum."],
};
const PRESS: Slot = {
  loads: ["shoulder", "back"],
  pattern: "press",
  byStage: {
    adapt: { name: "Axlapressa sitjandi, létt handlóð", lib: "Seated Dumbbell Shoulder Press" },
    s1: { name: "Axlapressa sitjandi með handlóðum", lib: "Seated Dumbbell Shoulder Press" },
    s2: { name: "Axlapressa standandi með handlóðum", lib: "Dumbbell One-Arm Shoulder Press" },
    s3: { name: "Axlapressa með stöng", lib: "Barbell Overhead Press" },
  },
  atHome: {
    adapt: { name: "Axlapressa með teygju, sitjandi", lib: "Seated Dumbbell Shoulder Press" },
    s1: { name: "Axlapressa með teygju", lib: "Shoulder Press - With Bands" },
    s2: { name: "Axlapressa með bakpoka", lib: "Dumbbell One-Arm Shoulder Press" },
    s3: { name: "Pike-armbeygjur", note: "Mjaðmir hátt, höfuðið niður á milli handanna." },
  },
  spare: {
    shoulder: { name: "Teygjusundurdráttur", lib: "Band Pull-Aparts", note: "Styrkir aftanverða öxlina án þess að lyfta yfir höfuð." },
    back: { name: "Axlapressa sitjandi með bakstuðningi", lib: "Seated Dumbbell Shoulder Press", note: "Bakið er stutt." },
  },
  cues: ["Spenntur kviður, ekki fetta bakið.", "Lóðin upp í beinni línu."],
};
const CORE: Slot = {
  loads: ["shoulder", "back"],
  hold: true,
  byStage: {
    adapt: { name: "Planki á hnjám", lib: "Front Plank" },
    s1: { name: "Planki", lib: "Plank" },
    s2: { name: "Hliðarplanki", lib: "Side Plank" },
    s3: { name: "Planki með axlasnertingu", lib: "Plank" },
  },
  atHome: {
    adapt: { name: "Planki á hnjám", lib: "Front Plank" },
    s1: { name: "Planki", lib: "Plank" },
    s2: { name: "Hliðarplanki", lib: "Side Plank" },
    s3: { name: "Planki með axlasnertingu", lib: "Plank" },
  },
  spare: {
    shoulder: { name: "Dauða pöddan", lib: "Dead Bug", note: "Engin þyngd á öxlunum." },
    back: { name: "Dauða pöddan", lib: "Dead Bug", note: "Mjóbakið helst í gólfinu." },
  },
  cues: ["Andaðu rólega.", "Beinn líkami frá höfði til hæla."],
};
const CARRY: Slot = {
  loads: ["back", "shoulder"],
  pattern: "carry",
  hold: true,
  byStage: {
    adapt: { name: "Bændaganga með létt lóð", lib: "Farmer's Walk" },
    s1: { name: "Bændaganga", lib: "Farmer's Walk" },
    s2: { name: "Bændaganga, þyngri", lib: "Farmer's Walk" },
    s3: { name: "Bændaganga, þung", lib: "Farmer's Walk" },
  },
  atHome: {
    adapt: { name: "Bændaganga með innkaupapoka", lib: "Farmer's Walk" },
    s1: { name: "Bændaganga með bakpoka í annarri hendi", lib: "Farmer's Walk" },
    s2: { name: "Bændaganga, þyngri poki", lib: "Farmer's Walk" },
    s3: { name: "Bændaganga, þung, lengri vegalengd", lib: "Farmer's Walk" },
  },
  spare: {
    back: { name: "Pallof-pressa með teygju", lib: "Pallof Press", note: "Styrkir kviðinn án þyngdar á hryggnum." },
    shoulder: { name: "Pallof-pressa með teygju", lib: "Pallof Press", note: "Létt fyrir axlirnar." },
  },
  cues: ["Uppréttur, axlirnar niður.", "Stutt og örugg skref."],
};

// ── HIIT ───────────────────────────────────────────────────────────
function hiitMode(injuries: Region[], place: Place = "gym"): { mode: string; note: string | null } {
  const k = injuries.includes("knee"), b = injuries.includes("back"), s = injuries.includes("shoulder");
  // Nothing that needs a machine when the machine is not there.
  if (place === "home") {
    if (k) return { mode: "Rösk ganga upp brekku eða þrep", note: "Engin hlaup eða stökk vegna hnés." };
    if (b) return { mode: "Rösk ganga upp brekku", note: "Engin stökk vegna baks." };
    return { mode: "Rösk ganga eða skokk upp brekku, þrepaganga", note: null };
  }
  if (k && (b || s)) return { mode: "Þrekhjól með hóflegri mótstöðu", note: "Engin hlaup, stökk eða róðravél vegna meiðsla." };
  if (k) return { mode: "Þrekhjól, sund eða skíðavél", note: "Engin hlaup eða stökk vegna hnés." };
  if (b) return { mode: "Þrekhjól eða rösk ganga upp brekku", note: "Ekki róðravél eða stökk vegna baks." };
  if (s) return { mode: "Þrekhjól, rösk ganga upp brekku eða sprettir", note: "Ekki róðravél eða burpees vegna axlar." };
  return { mode: "Þrekhjól, róðravél, sprettir eða rösk ganga upp brekku", note: null };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function rirText(rir: number): string {
  if (rir >= 4) return "hættu þegar 4 eða fleiri endurtekningar eru eftir";
  if (rir === 3) return "hættu þegar 3 endurtekningar eru eftir";
  if (rir === 2) return "hættu þegar 2 endurtekningar eru eftir";
  if (rir === 1) return "hættu þegar 1 endurtekning er eftir";
  return "síðasta endurtekningin er erfið, en tæknin helst góð";
}

function strengthItem(slot: Slot, st: Stage, s: TrainingSettings): ExerciseItem {
  const injured = slot.loads.find((r) => s.injuries.includes(r) && slot.spare[r]);
  // An injury swap wins over the place: sparing the joint matters more than
  // matching the equipment, and every spare variant is doable at home.
  const place = effectivePlace(s.places);
  const v = injured ? slot.spare[injured]! : place === "home" ? slot.atHome[st.key] : slot.byStage[st.key];
  // An injury swap also takes the load down a notch for that exercise.
  const load = clamp(s.load - (injured ? 1 : 0), -2, 2);
  const sets = clamp(st.sets + (load >= 2 ? 1 : 0) - (load <= -2 ? 1 : 0), 1, 5);
  const rir = clamp(st.rir - load, 0, 5);
  const media = v.lib ? PROGRAM_MEDIA[v.lib] : undefined;
  const holdSec = clamp((st.key === "adapt" ? 20 : st.key === "s1" ? 30 : 40) + load * 5, 10, 60);
  return {
    name: v.name,
    pattern: slot.pattern,
    stage: st.key,
    prescription: slot.hold ? `${sets} × ${holdSec} sek.` : `${sets} × ${st.reps}`,
    note: [slot.hold ? null : `Veldu þyngd svo að þú ${rirText(rir)}.`, st.tempo && !slot.hold ? `Taktur: ${st.tempo}.` : null, v.note ?? null].filter(Boolean).join(" ") || null,
    exercise_id: media?.id ?? null,
    image: media?.image ?? null,
    video: media?.video ?? null,
    muscles: media?.muscles ?? [],
    equipment: media?.equipment ?? null,
    cues: slot.cues,
    rest: st.key === "s3" ? "2 mín." : st.key === "adapt" ? "60 sek." : "90 sek.",
    block: "main",
  };
}

function hiitItem(st: Stage, s: TrainingSettings, extra = 0): ExerciseItem {
  // 10–20 minutes: never more than 20 minutes of intervals.
  const rounds = clamp(st.hiit.rounds + extra + s.load * 2, 4, Math.floor((20 * 60) / (st.hiit.work + st.hiit.rest)));
  const { mode, note } = hiitMode(s.injuries, effectivePlace(s.places));
  const min = Math.round((rounds * (st.hiit.work + st.hiit.rest)) / 60);
  return {
    name: `${primaryMode(mode)} — lotur`,
    prescription: `${rounds} × ${st.hiit.work} sek. hratt / ${st.hiit.rest} sek. rólega`,
    note: [
      `Um ${min} mín. Má líka vera: ${mode}.`,
      st.key === "adapt" ? "„Hratt“ þýðir rösklega: þú getur sagt nokkur orð en ekki heila setningu." : "„Hratt“ þýðir nálægt hámarki í hverri lotu.",
      note,
    ].filter(Boolean).join(" "),
    muscles: [],
    cues: ["Byrjaðu rólega og auktu hraðann í hverri lotu.", "Rólegu kaflarnir eru hluti af æfingunni."],
    rest: null,
    block: "finisher",
  };
}

const WARMUP: ExerciseItem = {
  name: "Upphitun",
  prescription: "5 mín.",
  note: "Rólegt á hjóli eða í göngu, svo nokkrar hnébeygjur, mjaðmahringir og handahringir.",
  muscles: [],
  cues: [],
  rest: null,
  block: "warmup",
};

// ── Zone 2 ─────────────────────────────────────────────────────────
/** Easy aerobic work: the base everything else is built on. */
/** The first option in a mode list, as a title: "Þrekhjól". */
export function primaryMode(mode: string): string {
  const first = mode.split(/,| eða /)[0].trim();
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function zone2Item(st: Stage, s: TrainingSettings): ExerciseItem {
  const { mode } = hiitMode(s.injuries, effectivePlace(s.places));
  const minutes = st.key === "adapt" ? 30 : st.key === "s1" ? 35 : st.key === "s2" ? 40 : 45;
  return {
    name: primaryMode(mode),
    prescription: `${clamp(minutes + s.load * 5, 20, 60)} mín. á jöfnum, rólegum hraða`,
    note: `Má líka vera: ${mode}. Þú átt að geta haldið uppi samtali allan tímann — ef þú nærð ekki að tala í heilum setningum ertu að fara of hratt.`,
    muscles: [],
    cues: ["Jafn hraði allan tímann — engar lotur.", "Neföndun ef þú getur; það heldur þér á réttum stað."],
    rest: null,
    block: "main",
  };
}

/**
 * Is hard interval work on the table yet?
 *
 * Not during the adaptation block — tendons are still catching up — and not
 * at all while cardio is "limited". Everyone else gets it, which is the
 * point: HIIT is the goal, reached when the body is ready for it.
 */
/**
 * Whether intervals are on the table yet, from a plan start date.
 *
 * hiitState wants a Stage, which is private to this module. Callers on the
 * screen have a start date, not a stage, and should not be reaching in here
 * for the STAGES table to bridge the two.
 */
export function hiitOnAt(s: TrainingSettings, planStart: string | null): boolean {
  return hiitState(s, STAGES[stageAt(s, planStart).key]).on;
}

export function hiitState(s: TrainingSettings, st: Stage): { on: boolean; why: string | null } {
  if (s.cardio === "limited") return { on: false, why: "HIIT bíður þar til læknir gefur grænt ljós. Rólegt þol byggir undir það." };
  if (st.key === "adapt") return { on: false, why: "HIIT bætist við eftir aðlögunina — fyrst venjast sinar og vöðvar álaginu." };
  return { on: true, why: null };
}

const dayName = (weekday: number) => WEEKDAY_NAMES[((weekday % 7) + 7) % 7];
/** "á mánudegi", not "á mánudagur" — the preposition takes the dative. */
const DAY_DATIVE = ["mánudegi", "þriðjudegi", "miðvikudegi", "fimmtudegi", "föstudegi", "laugardegi", "sunnudegi"];
export const dayDative = (weekday: number) => DAY_DATIVE[((weekday % 7) + 7) % 7];
const WEEKDAY_NAMES = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];

export interface WeekGaps {
  /** Whole-body strength sessions still missing from the week (0–2). */
  strengthNeed: number;
  /** Easy aerobic sessions still missing (0–2). */
  zone2Need: number;
  /** Whether the plan should add a hard interval session of its own. */
  addHiit: boolean;
  /** Hard sessions already in the week from what they do anyway. */
  hardAlready: number;
  /** One line per thing the week already covers, for showing the reasoning. */
  covered: string[];
}

/**
 * What is actually missing from this person's week.
 *
 * Counted per quality rather than as one lump, because the qualities do not
 * substitute for each other. Four games of football a week cover interval
 * work completely and the Zone 2 base not at all; two CrossFit sessions
 * cover strength and intervals but still leave the easy aerobic hole. The
 * plan should fill the hole, not repeat what is already there.
 */
export function weekGaps(s: TrainingSettings, hiitOn: boolean): WeekGaps {
  const acts = s.activities ?? [];
  // Full credit for what a session is, half for what it contributes to.
  const n = (c: Covers) =>
    acts.filter((a) => a.covers.includes(c)).length
    + acts.filter((a) => !a.covers.includes(c) && (a.partial ?? []).includes(c)).length * 0.5;
  const strength = n("strength"), hiitAct = n("hiit"), cardio = n("cardio");
  const hardAlready = acts.filter((a) => a.intensity === "hard").length;

  /** "2", "hálf", "1,5" — Icelandic says "hálf æfing", not "0,5 æfingar". */
  const count = (x: number, one: string, many: string) =>
    x === 0.5 ? `hálf ${one}` : `${Number.isInteger(x) ? x : String(x).replace(".", ",")} ${x === 1 ? one : many}`;
  const covered: string[] = [];
  if (strength) covered.push(`${count(strength, "styrktaræfing", "styrktaræfingar")} í vikunni þinni`);
  if (hiitAct) covered.push(`${count(hiitAct, "HIIT-æfing", "HIIT-æfingar")} í vikunni þinni`);
  if (cardio) covered.push(`${count(cardio, "róleg þolæfing", "rólegar þolæfingar")} í vikunni þinni`);

  return {
    strengthNeed: clamp(Math.round(2 - strength), 0, 2),
    zone2Need: clamp(Math.round(2 - cardio), 0, 2),
    // No point adding intervals to a week that already has hard days in it.
    addHiit: hiitOn && hiitAct === 0 && hardAlready < 2,
    hardAlready,
    covered,
  };
}

/** What a good week holds, per quality. */
export const WEEKLY_TARGET: Record<Covers, number> = { strength: 2, hiit: 1, cardio: 2 };

export interface ModalityScore {
  key: Covers;
  label: string;
  /** Sessions a good week holds. 0 when this quality is not on the table yet. */
  target: number;
  /** Sessions their own week already holds. */
  have: number;
  /** 0–10. */
  score: number;
  /** Null when it is covered; otherwise what is missing, in one line. */
  gap: string | null;
}

export interface TrainingScore {
  per: ModalityScore[];
  /** 0–10 across the qualities that count right now. */
  overall: number;
  summary: string;
}

/**
 * How well this person's own week already covers what training is for.
 *
 * Scored per quality rather than as one number, because that is where the
 * useful answer lives: someone playing football four times a week is not
 * "80% trained", they are fully covered for intervals and empty on both
 * strength and the easy aerobic base. One number would hide exactly the
 * thing worth telling them.
 *
 * It scores what they already do, not what the plan adds — otherwise every
 * score would read 10 the moment a plan existed, which tells nobody anything.
 */
export function trainingScore(
  s: TrainingSettings, hiitOn: boolean,
  /** Structural on purpose: importing the personalised session type here
      would close a cycle between this module and personalise.ts. */
  sessions?: readonly { modality: Covers | "other" }[],
): TrainingScore {
  const acts = s.activities ?? [];
  // Prescribed sessions count when they are passed in. They are not passed
  // in by the prescribing logic — that would feed back on itself, and the
  // week would always report itself complete the moment a plan existed.
  // The screen passes them, because to the person reading it there is one
  // week, and a lift the plan put on Tuesday trains them exactly as much as
  // one they put there themselves.
  const prescribed = (sessions ?? []).filter((x) => x.modality !== "other");
  const per: ModalityScore[] = (["strength", "hiit", "cardio"] as Covers[]).map((c) => {
    const have = acts.filter((a) => a.covers.includes(c)).length
      + acts.filter((a) => !a.covers.includes(c) && (a.partial ?? []).includes(c)).length * 0.5
      + prescribed.filter((x) => x.modality === c).length;
    // HIIT is not on the table during adaptation or while cardio is limited,
    // so it is not scored then — a zero there would be a mark against someone
    // for correctly not doing it yet.
    const target = c === "hiit" && !hiitOn ? 0 : WEEKLY_TARGET[c];
    const score = target === 0 ? 10 : clamp(Math.round((have / target) * 100) / 10, 0, 10);
    const missing = Math.max(0, target - have);
    return {
      key: c, label: COVERS_IS[c], target, have, score,
      gap: missing > 0 ? `Vantar ${missing === 0.5 ? "hálfa" : String(missing).replace(".", ",")} ${missing === 1 ? "æfingu" : "æfingar"} á viku` : null,
    };
  });
  const counted = per.filter((x) => x.target > 0);
  const over = per.filter((x) => x.target > 0 && x.have > x.target + 1);
  const overall = counted.length ? Math.round((counted.reduce((n, x) => n + x.score, 0) / counted.length) * 10) / 10 : 10;
  const worst = [...counted].sort((a, b) => a.score - b.score)[0];
  return {
    per, overall,
    summary: !worst || worst.score >= 10
      // A week can be complete and still lopsided: four hard days and the
      // easy aerobic base nowhere is a week that reads 10 on every row.
      ? over.length
        ? `Allt þakið, en ${over.map((x) => x.label.toLowerCase()).join(" og ")} er ríflegt.`
        : "Vikan þekur allt sem þarf."
      : worst.score === 0
        ? `${worst.label} vantar alveg í vikuna.`
        : `Veikasti hlekkurinn er ${worst.label.toLowerCase()}.`,
  };
}

export const SCORE_TONE = (score: number) =>
  score >= 9.5 ? { label: "Fullþakið", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900" }
  : score >= 6 ? { label: "Næstum því", bar: "bg-emerald-400", chip: "bg-emerald-50 text-emerald-800" }
  : score >= 3 ? { label: "Hálfnað", bar: "bg-amber-400", chip: "bg-amber-50 text-amber-900" }
  : { label: "Vantar", bar: "bg-rose-400", chip: "bg-rose-50 text-rose-900" };

/**
 * The core week: two whole-body strength sessions and the rest aerobic.
 *
 * One programme, not ten. Two whole-body days beat a three-way split at this
 * dose — every movement pattern gets trained twice a week, and missing one
 * session costs half a week rather than a whole muscle group. Zone 2 fills
 * the remaining days they said they could train, and HIIT replaces one of
 * those once it has been earned.
 */
/**
 * A real session for a lift the person put in the week themselves.
 *
 * "Lyftingar" on a Friday used to be a chip with a name and nothing behind
 * it — no exercises, no weights, nothing to run. It is a training day like
 * any other, so it gets the same treatment: the slots its focus implies,
 * built by strengthItem, which already handles the stage, the load, where
 * they train and which joints to spare.
 *
 * Which slots per focus is the ordinary split. Full body takes the five
 * patterns that cover it; upper and lower take their half; core takes the
 * trunk work plus a hinge, because a core day with no hinge trains the
 * front of the body only.
 */
const FOCUS_SLOTS: Record<StrengthFocus, Slot[]> = {
  full: [SQUAT, HINGE, PUSH, PULL, CORE],
  upper: [PUSH, PULL, PRESS, CARRY],
  lower: [SQUAT, HINGE, LUNGE, CORE],
  core: [CORE, CARRY, HINGE],
};

export function itemsForFocus(
  focus: StrengthFocus, s: TrainingSettings, planStart: string | null, extraLoad = 0,
): ExerciseItem[] {
  const info = stageAt(s, planStart);
  const st = STAGES[info.key];
  // The session's own ±álag rides on top of the programme's.
  const tuned: TrainingSettings = { ...s, load: clamp(s.load + extraLoad, -2, 2) };
  return FOCUS_SLOTS[focus].map((slot) => strengthItem(slot, st, tuned));
}

export function buildSessions(s: TrainingSettings, st: Stage): ExerciseSession[] {
  const it = (slot: Slot) => strengthItem(slot, st, s);
  const strengthMinutes = Math.round(5 + 4 * st.sets * 2.5);
  const hiit = hiitState(s, st);

  const days = s.days.length >= 2 ? s.days : DEFAULT_DAYS;

  // What the week already contains. Someone doing CrossFit twice does not
  // need two more strength days bolted on top; they need whatever is missing.
  const { strengthNeed, zone2Need, addHiit } = weekGaps(s, hiit.on);
  const aerobicNeed = zone2Need + (addHiit ? 1 : 0);
  /**
   * Days the plan must not touch.
   *
   * A day that already holds a hard session is finished. Putting Zone 2 on
   * top of a football match is the bug this exists to stop: the aerobic work
   * is already done there (which is what the half credit says), the easy
   * session cannot be easy after an hour of sprinting, and the point of Zone
   * 2 is the low intensity it would no longer have.
   *
   * A day with something light on it — yoga, a swim, fríköfun — is still
   * available, because that is not a hard day and stacking is not a problem.
   */
  const acts = s.activities ?? [];
  const blocked = new Set(
    acts.filter((a) => a.intensity === "hard" || a.covers.includes("hiit") || a.covers.includes("strength"))
      .map((a) => a.day));

  // Never fall back to the blocked days. If the week is full it is full, and
  // adding a session on top of a hard one is worse than adding nothing.
  const usable = days.filter((d) => !blocked.has(d));

  const strengthDays = new Set<number>();
  if (strengthNeed > 0 && usable.length > 0) {
    strengthDays.add(usable[0]);
    if (strengthNeed > 1 && usable.length > 1) strengthDays.add(usable[Math.min(usable.length - 1, Math.round((usable.length - 1) / 2) + (usable.length > 3 ? 1 : 0))] ?? usable[usable.length - 1]);
    // Two strength days must not collapse onto one.
    if (strengthDays.size < strengthNeed && usable.length > 1) strengthDays.add(usable[usable.length - 1]);
  }

  const out: ExerciseSession[] = [];
  let aerobic = 0;
  let strengthDone = 0;
  for (const d of usable) {
    if (strengthDays.has(d)) {
      // Whole body, twice a week: the two halves alternate the emphasis but
      // both cover legs, push, pull and trunk.
      const aSession = strengthDone++ === 0;
      out.push(aSession
        ? { day: dayName(d), title: "Styrkur — allur líkaminn A", focus: "Styrkur", minutes: strengthMinutes, items: [WARMUP, it(SQUAT), it(PUSH), it(PULL), it(CORE)] }
        : { day: dayName(d), title: "Styrkur — allur líkaminn B", focus: "Styrkur", minutes: strengthMinutes, items: [WARMUP, it(HINGE), it(PRESS), it(LUNGE), it(CARRY)] });
    } else if (aerobic < aerobicNeed) {
      // The first aerobic day is the hard one once HIIT is earned — unless
      // the week already has hard lotur in it, in which case Zone 2 is what
      // is actually missing.
      const useHiit = addHiit && aerobic === 0;
      aerobic++;
      out.push(useHiit
        ? { day: dayName(d), title: `${primaryMode(hiitMode(s.injuries, effectivePlace(s.places)).mode)} — lotur`, focus: "HIIT", minutes: 25, items: [WARMUP, hiitItem(st, s, s.cardio === "easy" ? -2 : 0)] }
        : { day: dayName(d), title: primaryMode(hiitMode(s.injuries, effectivePlace(s.places)).mode), focus: "Rólegt þol · Zone 2", minutes: 45, items: [zone2Item(st, s)] });
    }
  }
  // Every chosen day went to strength and no aerobic day was left — but
  // Zone 2 is half the core and needs no gym slot, so it goes on the end of
  // the last session rather than being dropped. Not when the week already
  // has þol in it from something they do anyway.
  if (aerobic === 0 && aerobicNeed > 0 && out.length > 0) {
    const lastDay = out[out.length - 1];
    lastDay.items = [...lastDay.items, { ...zone2Item(st, s), block: "finisher" }];
    lastDay.minutes = (lastDay.minutes ?? 0) + 30;
    lastDay.focus = "Styrkur og rólegt þol";
  }
  // Classes only rewrite the session when they are the only place they train.
  return s.places.length === 1 && s.places[0] === "class" ? out.map((x) => asClass(x, st, s)) : out;
}

/** What to look for on the timetable, by what the session is for. */
export const CLASS_KINDS = {
  strength: { title: "Styrktartími", look: ["Lyftingar", "Styrkur", "Functional", "Body Pump"] },
  hiit: { title: "Brennslutími", look: ["HIIT", "Tabata", "Spinning", "Þrek"] },
  zone2: { title: "Rólegur tími eða eigin þolæfing", look: ["Hjólatími á lágum styrk", "Jóga-flæði", "Rösk ganga"] },
} as const;

/**
 * The same week, delivered as classes.
 *
 * A class-goer does not pick their own exercises, so prescribing eight of
 * them is noise. What they need is which class on the timetable does the job
 * and what to tell the instructor — the stage, the load and the injuries are
 * exactly that.
 */
function asClass(x: ExerciseSession, st: Stage, s: TrainingSettings): ExerciseSession {
  const kind = x.title.startsWith("Allur") ? CLASS_KINDS.strength : x.title === "HIIT" ? CLASS_KINDS.hiit : CLASS_KINDS.zone2;
  const spare = s.injuries.map((r) => REGION_IS[r].label.toLowerCase());
  return {
    ...x,
    title: kind.title,
    focus: x.focus,
    items: [{
      name: kind.title,
      prescription: `Leitaðu að: ${kind.look.join(", ")}`,
      note: [
        `Þú ert á ${st.title.toLowerCase()}.`,
        s.load !== 0 ? `Þú hefur stillt álagið á „${LOAD_IS[s.load].toLowerCase()}“.` : null,
        spare.length ? `Segðu þjálfaranum frá: ${spare.join(", ")}.` : null,
        "Ef tíminn er fullbókaður eða fellur niður, taktu æfinguna sjálf(ur) í tækjasalnum.",
      ].filter(Boolean).join(" "),
      muscles: [],
      cues: x.items.flatMap((i) => i.cues ?? []).slice(0, 2),
      rest: null,
      block: "main",
    }],
  };
}

/**
 * The week these settings produce right now, for showing someone the result
 * before they commit to it. STAGES stays private: callers have no business
 * assembling a Stage by hand.
 */
export function previewWeek(s: TrainingSettings, planStart: string | null, now = new Date()): {
  sessions: ExerciseSession[];
  stage: StageInfo;
  hiit: { on: boolean; why: string | null };
  gaps: WeekGaps;
  score: TrainingScore;
} {
  const stage = stageAt(s, planStart, now);
  const st = STAGES[stage.key];
  const hiit = hiitState(s, st);
  return { sessions: buildSessions(s, st), stage, hiit, gaps: weekGaps(s, hiit.on), score: trainingScore(s, hiit.on) };
}

/** Which exercises were swapped for an injury, for the "adapted for you" note. */
export function injuryNotes(s: TrainingSettings): string[] {
  return s.injuries.map((r) => {
    const n = [SQUAT, HINGE, LUNGE, PUSH, PULL, PRESS, CORE, CARRY].filter((x) => x.loads.includes(r) && x.spare[r]).length;
    return `${REGION_IS[r].label}: ${n} æfingum skipt út fyrir mildari útgáfu og HIIT aðlagað.`;
  });
}

type PlanExercise = NonNullable<ActionPlan["exercise"]>;

/** The stored template (name, goal, principles) with sessions and timeline for these settings. */
export function adaptExercise(e: PlanExercise, s: TrainingSettings, planStart: string | null, now = new Date()): PlanExercise {
  const info = stageAt(s, planStart, now);
  const st = STAGES[info.key];
  const sessions = buildSessions(s, st);
  const level: ExerciseTemplate["level"] = info.key === "adapt" || info.key === "s1" ? "beginner" : info.key === "s2" ? "intermediate" : "advanced";
  return {
    ...e,
    level,
    days_per_week: s.days.length,
    session_minutes: Math.round(sessions.reduce((n, x) => n + (x.minutes ?? 0), 0) / sessions.length),
    sessions,
    progression: stagePhases(s.level),
  };
}

export function sanitizeTraining(b: Record<string, unknown>): TrainingSettings {
  const level: TrainingLevel = b.level === "active" ? "active" : "beginner";
  const load = clamp(Math.round(Number(b.load) || 0), -2, 2);
  const injuries = (Array.isArray(b.injuries) ? b.injuries : []).filter((r): r is Region => (REGIONS as unknown[]).includes(r));
  const started_on = typeof b.started_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.started_on) ? b.started_on : null;
  const rawPlaces = Array.isArray(b.places) ? b.places : b.place ? [b.place] : [];
  const places = [...new Set(rawPlaces.filter((p): p is Place => PLACES.includes(p as Place)))];
  const cardio: CardioLimit = b.cardio === "easy" || b.cardio === "limited" ? b.cardio : "full";
  // At least two days, or there is no programme to lay out.
  const picked = [...new Set((Array.isArray(b.days) ? b.days : []).map((d) => Math.round(Number(d))).filter((d) => d >= 0 && d <= 6))].sort((x, y) => x - y);
  const days = picked.length >= 2 ? picked : DEFAULT_DAYS;
  return {
    level, load, injuries: [...new Set(injuries)], started_on,
    places: places.length ? places : ["gym"],
    cardio, days, activities: sanitizeActivities(b.activities),
  };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeActivities(v: unknown): Activity[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).map((raw, i): Activity | null => {
    const a = (raw ?? {}) as Record<string, unknown>;
    const name = String(a.name ?? "").trim().slice(0, 60);
    if (!name) return null;
    const day = Math.round(Number(a.day));
    const at = typeof a.at === "string" && HHMM.test(a.at) ? a.at : null;
    const minutes = Number.isFinite(Number(a.minutes)) ? clamp(Math.round(Number(a.minutes)), 10, 300) : null;
    const isCover = (c: unknown): c is Covers => c === "strength" || c === "hiit" || c === "cardio";

    /**
     * What a sport trains is re-read from the catalogue, not from the row.
     *
     * The classification is a judgement we keep refining — freediving used to
     * be credited as rólegt þol until the apnea literature said otherwise,
     * and football only gained its half credit for the aerobic base later. A
     * row saved before either change would carry the old answer forever, so a
     * named preset wins and only a hand-typed activity keeps what was stored.
     */
    const preset = ACTIVITY_PRESETS.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const covers = preset ? preset.covers : (Array.isArray(a.covers) ? a.covers : []).filter(isCover);
    const partial = preset ? (preset.partial ?? []) : (Array.isArray(a.partial) ? a.partial : []).filter(isCover);
    const isBenefit = (x: unknown): x is Benefit => x === "mental" || x === "mobility" || x === "breath";
    const benefits = preset ? (preset.benefits ?? []) : (Array.isArray(a.benefits) ? a.benefits : []).filter(isBenefit);
    const intensity: Intensity = preset ? preset.intensity
      : a.intensity === "hard" || a.intensity === "easy" ? a.intensity : "moderate";

    /**
     * The split, and this session's own load offset.
     *
     * Both were dropped on the way through here, which is why a lift came
     * back from a save with no programme behind it: the picker set focus,
     * the card rendered its exercises from it, and then the POST response —
     * sanitised, and so focus-less — replaced that state a second later.
     * Unlike covers, these two are the person's own answer about their own
     * session, so the stored value is the only source for them.
     */
    const focus = a.focus === "full" || a.focus === "upper" || a.focus === "lower" || a.focus === "core"
      ? a.focus : null;
    const load = Number.isFinite(Number(a.load)) ? clamp(Math.round(Number(a.load)), -2, 2) : null;
    return day >= 0 && day <= 6
      ? { id: typeof a.id === "string" && a.id ? a.id.slice(0, 40) : `a${i}`, name, day, at, minutes, covers: [...new Set(covers)], partial: [...new Set(partial)], benefits: [...new Set(benefits)], intensity, focus, load }
      : null;
  }).filter((a): a is Activity => !!a);
}

/**
 * What the week is missing, and the best days to put it on.
 *
 * The setup asked "which days can you train?" with no opinion about the
 * answer, even though it already knew what the person does. Someone who
 * listed three bike rides and nothing else was left to work out for
 * themselves that they have no strength work and that Tuesday is a bad day
 * for it because they play football on Monday.
 *
 * Rules, in the order they decide a day:
 *  · a day already holding something hard cannot take more hard work
 *  · nor can the day straight after one — that is the 48 hours tendons want
 *  · the two strength days are spread as far apart as the week allows
 *  · easy aerobic work avoids hard days but is happy next to them
 */
export interface DaySuggestion {
  modality: Covers;
  day: number;
  /** Why this day and not another, in the person's own terms. */
  why: string;
}

export function suggestDays(s: TrainingSettings, hiitOn: boolean): DaySuggestion[] {
  const acts = s.activities ?? [];
  const hard = new Set(hardDays({ activities: acts }));
  const busy = new Set(acts.map((a) => a.day));
  const score = trainingScore(s, hiitOn);
  const out: DaySuggestion[] = [];
  const taken = new Set<number>();

  /** Distance to the nearest day in `days`, wrapping the week. */
  const gapFrom = (d: number, days: Set<number>) =>
    days.size === 0 ? 7 : Math.min(...[...days].map((x) => Math.min((d - x + 7) % 7, (x - d + 7) % 7)));

  for (const m of score.per) {
    const missing = Math.ceil(Math.max(0, m.target - m.have));
    for (let k = 0; k < missing; k++) {
      const needsRest = m.key !== "cardio";
      const best = [...Array(7).keys()]
        .filter((d) => !taken.has(d))
        .map((d) => {
          const after = hard.has((d + 6) % 7);
          let pts = 0;
          if (needsRest && hard.has(d)) pts -= 10;        // already hard
          if (needsRest && after) pts -= 4;               // the day after a hard one
          if (!needsRest && hard.has(d)) pts -= 6;        // easy work on a hard day is wasted
          if (busy.has(d)) pts -= 1;                      // doable, just busier
          pts += gapFrom(d, new Set([...hard, ...taken])); // spread it out
          return { d, pts };
        })
        .sort((a, b) => b.pts - a.pts)[0];
      if (!best) break;
      taken.add(best.d);
      const why = hard.has((best.d + 6) % 7)
        ? "lengst frá hörðu dögunum sem eftir eru"
        : busy.has(best.d)
          ? `þú ert þegar á ferðinni á ${dayDative(best.d)}`
          : `${dayName(best.d).toLowerCase()} er laus og vel staðsettur`;
      out.push({ modality: m.key, day: best.d, why });
    }
  }
  return out;
}
