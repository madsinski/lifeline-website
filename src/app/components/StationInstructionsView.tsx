import type { StationDoc, Block } from "@/lib/station-instructions";

/* eslint-disable @next/next/no-img-element -- printable document; plain <img> keeps print/PDF layout predictable. */

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="si-h2 mt-10 mb-3 text-2xl font-bold text-[#0F172A] border-t border-gray-200 pt-8">
          {block.text}
        </h2>
      );
    case "subheading":
      return <h3 className="si-h3 mt-6 mb-2 text-lg font-semibold text-[#1F2937]">{block.text}</h3>;
    case "text":
      return <p className="my-3 leading-relaxed text-[#334155]">{block.text}</p>;
    case "steps":
      return (
        <ol className="si-steps my-3 list-decimal space-y-1.5 pl-6 text-[#334155]">
          {block.items.map((it, i) => (
            <li key={i} className="leading-relaxed">{it}</li>
          ))}
        </ol>
      );
    case "note":
      return (
        <div className="si-note my-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {block.text}
        </div>
      );
    case "image":
      return (
        <figure className="si-figure my-5">
          <img
            src={block.src}
            alt={block.caption || ""}
            className="w-full rounded-lg border border-gray-200 shadow-sm"
          />
          {block.caption && (
            <figcaption className="mt-2 text-center text-xs text-[#64748B]">{block.caption}</figcaption>
          )}
        </figure>
      );
    default:
      return null;
  }
}

export default function StationInstructionsView({ doc }: { doc: StationDoc }) {
  return (
    <article className="si-doc">
      <h1 className="text-3xl font-bold leading-tight text-[#0F172A]">{doc.title}</h1>
      {doc.intro && <p className="mt-3 text-[#475569] leading-relaxed">{doc.intro}</p>}
      {doc.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </article>
  );
}
