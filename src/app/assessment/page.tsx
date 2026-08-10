import AssessmentView from "./AssessmentView";

// CMS-driven: AssessmentView fetches the published content blob
// (src/app/api/site-content/assessment) and falls back to the built-in defaults
// in src/lib/site-content/assessment.ts. Edit it in /admin/website.
export default function AssessmentPage() {
  return <AssessmentView />;
}
