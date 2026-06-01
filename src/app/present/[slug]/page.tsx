import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { PresentationData } from "@/lib/presentations/types";
import { Deck } from "@/app/components/presentation/Deck";
import { resolveSlides, hasIcelandic } from "@/lib/presentations/i18n";

// Always render fresh: unpublishing must take effect immediately, and we never
// want a stale published copy cached at the edge.
export const dynamic = "force-dynamic";

async function fetchPublished(slug: string): Promise<{ title: string; data: PresentationData } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("presentations")
      .select("title, data, is_published")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data || !data.is_published) return null;
    return { title: data.title as string, data: (data.data as PresentationData) ?? { slides: [] } };
  } catch {
    // Misconfiguration (e.g. missing service-role key) or transient failure —
    // show the friendly "unavailable" page rather than a 500.
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await fetchPublished(slug);
  return {
    title: found ? `${found.title} · Lifeline` : "Presentation · Lifeline",
    robots: { index: false, follow: false },
  };
}

function Unavailable() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: "2rem",
      background: "linear-gradient(135deg,#06231c 0%,#064e3b 55%,#07372b 100%)", color: "#eafaf3", zIndex: 9999, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>
      <div>
        <div style={{ fontSize: ".8rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#6ee7b7", marginBottom: "1rem" }}>Lifeline</div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: ".6rem" }}>This presentation isn&rsquo;t available</h1>
        <p style={{ color: "#bfe7d8", maxWidth: "42ch", margin: "0 auto" }}>
          The link may be wrong, or the presentation hasn&rsquo;t been published yet. Check with whoever shared it.
        </p>
      </div>
    </div>
  );
}

export default async function PresentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await fetchPublished(slug);
  if (!found) return <Unavailable />;
  const data = found.data;
  const slidesIs = hasIcelandic(data) ? resolveSlides(data, "is") : undefined;
  return <Deck slides={data.slides} slidesIs={slidesIs} design={data.design} />;
}
