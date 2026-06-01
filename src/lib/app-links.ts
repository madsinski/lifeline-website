// Single source of truth for the Lifeline mobile app's store presence.
//
// FLIP `APP_LIVE` TO `true` once BOTH store listings are live and the URLs
// below hold the real values. Until then every surface shows "coming soon"
// copy instead of links that would 404 — so we never ship a broken store link.
//
// Identifiers come from the app repo (fhir-health-dashboard/app.config.js):
//   Android package = com.madsinski.fhirhealthdashboard
// so PLAY_STORE_URL is already correct once the listing is published. The
// App Store URL needs the numeric app ID from App Store Connect — until then
// it is a clearly-marked placeholder and is only shown when APP_LIVE is true.

/** Set to true when the beta is live on the App Store AND Google Play.
 *  Typed as boolean (not the literal `false`) so the "app is live" branches
 *  aren't treated as dead code before launch. */
export const APP_LIVE: boolean = false;

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.madsinski.fhirhealthdashboard";

// TODO(launch): replace with the real listing URL once it exists, e.g.
//   https://apps.apple.com/is/app/lifeline-health/id<NUMERIC_APP_ID>
export const APP_STORE_URL = "https://apps.apple.com/app/lifeline-health";
