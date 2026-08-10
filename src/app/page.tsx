import HomeView from "./HomeView";

// The home page is now CMS-driven: HomeView fetches the published content blob
// (src/app/api/site-content/home) and falls back to the built-in defaults in
// src/lib/site-content/home.ts, so it renders identically when the CMS is empty.
// Edit it in /admin/website.
export default function Home() {
  return <HomeView />;
}
