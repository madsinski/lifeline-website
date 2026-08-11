import HomeView from "./HomeView";
import { getPublishedBlob, getPublishedWhatsNewCards } from "@/lib/site-content/server";

// Server-rendered with the published CMS blob + "What's new" cards so the page
// paints the live content on first load (no flash of defaults). Edit in
// /admin/website.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [initialBlob, whatsNewCards] = await Promise.all([
    getPublishedBlob("home"),
    getPublishedWhatsNewCards(),
  ]);
  return <HomeView initialBlob={initialBlob} whatsNewCards={whatsNewCards} />;
}
