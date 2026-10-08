// The app's own copy, in both languages.
//
// The site already has i18n (src/lib/i18n.tsx) and this uses its locale, so
// there is one language choice across the whole product and the toggle in
// the app changes the marketing site too. What it does NOT use is that
// system's storage: t() resolves against a `translations` table in Supabase,
// which is right for marketing copy the team edits without a deploy, and
// wrong for app chrome — every label would wait on a network round trip and
// flash its fallback first. These are in code, typed, and reviewed in the
// same diff as the screen that uses them.
//
// Icelandic first because the product is Icelandic first; English is the
// second column, not an afterthought.

export const STRINGS = {
  // ── Navigation ──────────────────────────────────────────────────────
  "nav.home": { is: "Heim", en: "Home" },
  "nav.clinic": { is: "Stofan", en: "Clinic" },
  "nav.health": { is: "Heilsan", en: "Health" },
  "nav.coach": { is: "Þjálfari", en: "Coach" },
  "nav.community": { is: "Samfélag", en: "Community" },

  // ── Greetings ───────────────────────────────────────────────────────
  "hello.night": { is: "Góða nótt", en: "Good night" },
  "hello.morning": { is: "Góðan daginn", en: "Good morning" },
  "hello.day": { is: "Góðan dag", en: "Good afternoon" },
  "hello.evening": { is: "Gott kvöld", en: "Good evening" },

  // ── Home meters ─────────────────────────────────────────────────────
  "home.showingUp": { is: "Mæting", en: "Showing up" },
  "home.showingUp.hint": { is: "síðustu 7 daga", en: "last 7 days" },
  "home.completion": { is: "Klárað", en: "Completion" },
  "home.completion.hint": { is: "af því sem stóð til", en: "of what was planned" },
  "home.intensity": { is: "Ákefð", en: "Intensity" },
  "home.intensity.hint": { is: "hversu fast", en: "how hard" },
  "home.week": { is: "Vikan", en: "This week" },
  "home.failed": { is: "Náði ekki í mælana þína.", en: "Could not load your meters." },
  "home.rest": {
    is: "Þetta er fyrsti hlutinn af Heim úr appinu. Næst koma aðgerðir dagsins úr prógramminu, næringarhringurinn, skráning á máltíð og þyngd, stutt æfing og áminningar þjálfarans.",
    en: "This is the first part of Home from the app. Next: the day's actions from your programme, the macros wheel, meal and weight logging, a short session, and your coach's nudges.",
  },

  // ── Screens not built yet ───────────────────────────────────────────
  "clinic.body": {
    is: "Tímabókanir, mælingar, blóðprufur og upplýsingar um stofuna.",
    en: "Appointments, measurements, blood tests and clinic information.",
  },
  "clinic.now": { is: "Bóka tíma", en: "Book a time" },
  "health.body": {
    is: "Mælingarnar þínar yfir tíma: líkamssamsetning, blóðgildi, blóðþrýstingur og þyngd.",
    en: "Your measurements over time: body composition, blood markers, blood pressure and weight.",
  },
  "health.now": { is: "Sjá niðurstöðurnar", en: "See your results" },
  "coach.body": {
    is: "Prógrammið þitt, æfing dagsins og samtalið við þjálfarann.",
    en: "Your programme, today's session, and the conversation with your coach.",
  },
  "coach.now": { is: "Hafa samband", en: "Get in touch" },
  "community.body": {
    is: "Straumur, vinir, viðburðir, áskoranir og Lífstig.",
    en: "Feed, friends, events, challenges and Life Points.",
  },

  // ── Weekdays, short — for the week strip ────────────────────────────
  "day.0": { is: "Su", en: "Sun" },
  "day.1": { is: "Má", en: "Mon" },
  "day.2": { is: "Þr", en: "Tue" },
  "day.3": { is: "Mi", en: "Wed" },
  "day.4": { is: "Fi", en: "Thu" },
  "day.5": { is: "Fö", en: "Fri" },
  "day.6": { is: "La", en: "Sat" },
} as const;

export type StringKey = keyof typeof STRINGS;
