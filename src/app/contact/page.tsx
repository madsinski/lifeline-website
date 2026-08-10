import ContactView from "./ContactView";
import { getPublishedBlob } from "@/lib/site-content/server";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const initialBlob = await getPublishedBlob("contact");
  return <ContactView initialBlob={initialBlob} />;
}
