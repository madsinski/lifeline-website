import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_DOC, type StationDoc } from "@/lib/station-instructions";
import StationInstructionsView from "@/app/components/StationInstructionsView";
import PrintButton from "./PrintButton";

// Public, unlisted, printable instructions link. Renders the published document
// for the slug, falling back to the seed content so the link always works.
export const dynamic = "force-dynamic";

async function fetchDoc(slug: string): Promise<StationDoc> {
  try {
    const { data } = await supabaseAdmin
      .from("station_instructions")
      .select("title, doc, is_published")
      .eq("slug", slug)
      .maybeSingle();
    const doc = data?.doc as StationDoc | undefined;
    if (data?.is_published && doc && Array.isArray(doc.blocks)) return doc;
  } catch {
    /* fall through to seed */
  }
  return DEFAULT_DOC;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = await fetchDoc(slug);
  return { title: doc.title, robots: { index: false, follow: false } };
}

export default async function StationInstructionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await fetchDoc(slug);

  return (
    <div className="min-h-screen bg-[#ecf0f3] print:bg-white">
      <style>{`
        @page { size: A4; margin: 16mm 14mm; }
        @media print {
          .no-print { display: none !important; }
          .si-doc { max-width: none !important; }
          .si-figure, .si-steps li, .si-note { break-inside: avoid; }
          .si-h2, .si-h3 { break-after: avoid; }
          html, body { background: #fff !important; }
        }
      `}</style>

      {/* Screen-only top bar */}
      <div className="no-print border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3">
          <span className="text-sm font-semibold text-[#10B981]">Lifeline Health</span>
          <PrintButton />
        </div>
      </div>

      <main className="mx-auto max-w-3xl bg-white px-8 py-10 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none sm:my-8 sm:rounded-2xl">
        <StationInstructionsView doc={doc} />
        <p className="no-print mt-12 border-t border-gray-100 pt-4 text-center text-xs text-[#94A3B8]">
          Lifeline Health · leiðbeiningar fyrir mælingastöð
        </p>
      </main>
    </div>
  );
}
