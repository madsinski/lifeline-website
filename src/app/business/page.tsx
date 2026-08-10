import BusinessGate from "./BusinessGate";
import { getPublishedBlob } from "@/lib/site-content/server";

// Server-rendered published blob → no flash of default marketing copy. The
// auth/portal logic + signed-in panel live in the client BusinessGate.
export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const initialBlob = await getPublishedBlob("business");
  return <BusinessGate initialBlob={initialBlob} />;
}
