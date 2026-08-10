import AssessmentView from "./AssessmentView";
import { getPublishedBlob } from "@/lib/site-content/server";

export const dynamic = "force-dynamic";

export default async function AssessmentPage() {
  const initialBlob = await getPublishedBlob("assessment");
  return <AssessmentView initialBlob={initialBlob} />;
}
