import CoachingView from "./CoachingView";

// CMS-driven: CoachingView fetches the published content blob
// (src/app/api/site-content/coaching) and falls back to the built-in defaults
// in src/lib/site-content/coaching.ts. Edit it in /admin/website.
export default function CoachingPage() {
  return <CoachingView />;
}
