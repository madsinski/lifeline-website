// The app's visual language, copied from its own tokens.
//
// src/theme/brand.ts in fhir-health-dashboard, the `classic` palette, which
// the comment there calls "current live app". Values are not approximations:
//
//   primary #20c858   primaryDark #1aad4a   primaryLight #86EFAC
//   accent  #F59E0B   error       #EF4444
//   ink1 #000000  ink2 #6B7280  ink3 #9CA3AF  ink4 #D1D5DB
//   canvas #ecf0f3  card #FFFFFF  cardAlt #e6ecf4  hairline #E5E7EB
//   exercise #3B82F6  nutrition #0D9488  sleep #8B5CF6  mental #06B6D4
//
// Note the green: the app is #20c858, brighter than the website's emerald
// #10B981. Keeping the app's own value is the point — this surface should
// look like the app, not like the marketing site wearing an app's layout.
//
// Cards are radius 14 with a 1px rgba(0,0,0,0.06) border and a soft shadow
// (HomeScreen.tsx:2958-2966, 3203-3212), and the section headers are
// gradient bars with white text, an icon and a chevron — that bar is the
// most recognisable thing about the app's home screen.

export const appBrand = {
  primary: "#20c858",
  primaryDark: "#1aad4a",
  primaryLight: "#86EFAC",
  accent: "#F59E0B",
  error: "#EF4444",
  ink1: "#000000",
  ink2: "#6B7280",
  ink3: "#9CA3AF",
  ink4: "#D1D5DB",
  canvas: "#ecf0f3",
  cardAlt: "#e6ecf4",
  hairline: "#E5E7EB",
  exercise: "#3B82F6",
  nutrition: "#0D9488",
  sleep: "#8B5CF6",
  mental: "#06B6D4",
} as const;

/** A card, the app's way: white, radius 14, hairline border, soft shadow. */
export const appCard =
  "rounded-[14px] border border-black/[0.06] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]";

/** The gradient header bar. `from`/`to` are inline because they are brand values. */
export const appHeaderBar = "flex items-center gap-2 rounded-[14px] px-3.5 py-3 text-white";

/** The green header (Today's Health), diagonal — HomeScreen.tsx:2265. */
export const greenHeader = { backgroundImage: `linear-gradient(135deg, ${appBrand.primary}, ${appBrand.primaryLight})` };

/** The dark header (What's coming up), horizontal — HomeScreen.tsx:2443. */
export const darkHeader = { backgroundImage: `linear-gradient(90deg, ${appBrand.ink1}, #4B5563)` };
