import BusinessView from "./BusinessView";
import { getPublishedBlob } from "@/lib/site-content/server";

// Public "Companies" information page — always the marketing view, even when
// logged in. The business account (company list) lives at /business/account,
// reached from the account pillbox dropdown.
export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const initialBlob = await getPublishedBlob("business");
  return <BusinessView signedIn={false} initialBlob={initialBlob} />;
}
