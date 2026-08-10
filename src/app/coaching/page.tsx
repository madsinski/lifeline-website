import CoachingView from "./CoachingView";
import { getPublishedBlob } from "@/lib/site-content/server";

export const dynamic = "force-dynamic";

export default async function CoachingPage() {
  const initialBlob = await getPublishedBlob("coaching");
  return <CoachingView initialBlob={initialBlob} />;
}
