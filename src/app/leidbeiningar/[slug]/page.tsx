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
        @page { size: A4; margin: 14mm; }
        @media print {
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print, .no-print * { display: none !important; }
          html, body { background: #fff !important; }
          .si-doc { max-width: 100% !important; font-size: 10.5pt; line-height: 1.45; }
          .si-doc h1 { font-size: 17pt; margin-bottom: 6px; }
          .si-h2 { font-size: 13.5pt; margin-top: 14px; padding-top: 10px; }
          .si-h3 { font-size: 11.5pt; }
          /* Keep headings with their following content; don't orphan them. */
          .si-h2, .si-h3 { break-after: avoid; break-inside: avoid; }
          .si-steps li, .si-note { break-inside: avoid; }
          /* Images: centered and height-capped so they never dominate a page. */
          .si-figure { text-align: center; break-inside: avoid; margin: 8px 0; }
          .si-figure button {
            display: inline-block !important; width: auto !important; max-width: 100% !important;
            border: 0 !important; box-shadow: none !important; padding: 0 !important; overflow: visible !important;
          }
          .si-figure img {
            display: block; margin: 0 auto; width: auto !important; height: auto !important;
            max-width: 100% !important; max-height: 80mm !important;
            border: 1px solid #e5e7eb; border-radius: 6px; transform: none !important;
          }
          .si-figure figcaption { text-align: center; }
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
