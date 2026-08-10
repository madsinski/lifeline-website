import HomeView from "./HomeView";
import { getPublishedBlob } from "@/lib/site-content/server";

// Server-rendered with the published CMS blob so the page paints the live
// content on first load (no flash of defaults). Falls back to built-in
// defaults when nothing is published. Edit in /admin/website.
export const dynamic = "force-dynamic";

export default async function Home() {
  const initialBlob = await getPublishedBlob("home");
  return <HomeView initialBlob={initialBlob} />;
}
