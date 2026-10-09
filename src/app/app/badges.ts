// Badge names in both languages.
//
// user_badges.title is English in the database ("50 actions completed"), and
// so is activity_feed.action. On an Icelandic-first product those read as
// untranslated, but they are stored strings written by the app — not
// something this surface can fix at the source.
//
// There are only eleven distinct badge_key values in the whole table, so the
// honest fix is to key off badge_key and fall back to the stored title for
// anything added later. Verified against the database on 2026-10-09.

export const BADGE: Record<string, { is: string; en: string }> = {
  founding_member: { is: "Stofnfélagi", en: "Founding Member" },
  l0_welcome: { is: "Velkomin", en: "Welcome" },
  l1_3day_streak: { is: "Þrír dagar í röð", en: "3-day streak" },
  l1_first_action: { is: "Fyrsta aðgerðin", en: "First action completed" },
  l1_first_event: { is: "Fyrsti viðburðurinn", en: "First event joined" },
  l1_first_friend: { is: "Fyrsti vinurinn", en: "First friend added" },
  l2_25_actions: { is: "25 aðgerðir", en: "25 actions completed" },
  l2_3_events: { is: "Þrír viðburðir", en: "3 events attended" },
  l2_3_friends: { is: "Þrír vinir", en: "3 friends connected" },
  l3_200_points: { is: "200 Lífstig", en: "200 LifePoints earned" },
  l3_50_actions: { is: "50 aðgerðir", en: "50 actions completed" },
};

/**
 * Feed lines, which are the same handful of stored English sentences.
 * Anything unrecognised is shown as stored rather than dropped.
 */
export const FEED_LINE: { match: RegExp; is: string; en: string }[] = [
  { match: /^joined Lifeline Health$/i, is: "gekk til liðs við Lifeline", en: "joined Lifeline Health" },
  { match: /^Completed a daily action$/i, is: "kláraði aðgerð dagsins", en: "completed a daily action" },
  { match: /^Maintained a (\d+)-day streak$/i, is: "hélt $1 daga í röð", en: "maintained a $1-day streak" },
];

export function feedLine(action: string, locale: "is" | "en"): string {
  for (const f of FEED_LINE) {
    const m = f.match.exec(action);
    if (m) return (locale === "is" ? f.is : f.en).replace("$1", m[1] ?? "");
  }
  return action;
}
