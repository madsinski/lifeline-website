import Image from "next/image";

interface StaticLaptopProps {
  screenshot: string;
  alt?: string;
  /** Max rendered width (CSS length). The laptop fills its column up to this. */
  maxWidth?: string;
}

// 16:10 is the modern laptop screen ratio. A landscape screenshot fills it with
// no cropping; a portrait one is object-cover'd (top-anchored).
const SCREEN_RATIO = "16 / 10";

/**
 * Static laptop mockup — a thin-bezel screen on a brushed-metal lid with a
 * hinge base. The companion to StaticPhone; both are chosen per mockup slot in
 * the website CMS (device = phone | laptop).
 */
export default function StaticLaptop({
  screenshot,
  alt = "Lifeline Health app",
  maxWidth = "560px",
}: StaticLaptopProps) {
  return (
    <div className="w-full flex justify-center pt-6">
      <div className="relative w-full" style={{ maxWidth }}>
        {/* Glow behind the laptop */}
        <div
          className="absolute -inset-8 rounded-[3rem] blur-3xl opacity-40 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(32,200,88,0.25) 0%, rgba(59,130,246,0.15) 40%, transparent 70%)",
          }}
        />
        {/* Lid: metal rail → black bezel → screen */}
        <div
          className="rounded-t-2xl rounded-b-md p-[3px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
          style={{ background: "linear-gradient(150deg,#5b616a 0%,#23262b 42%,#0e0f11 100%)" }}
        >
          <div className="rounded-t-2xl rounded-b-sm bg-black p-[6px] pt-[10px]">
            {/* Camera dot */}
            <div className="mx-auto mb-[6px] h-1 w-1 rounded-full bg-[#2b2e33]" />
            <div className="relative overflow-hidden rounded-lg bg-[#ecf0f3]" style={{ aspectRatio: SCREEN_RATIO }}>
              <Image
                src={screenshot}
                alt={alt}
                fill
                sizes="(min-width: 1024px) 560px, 90vw"
                quality={90}
                className="object-cover object-top"
              />
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 45%)" }}
              />
            </div>
          </div>
        </div>
        {/* Base / hinge — slightly wider than the lid */}
        <div className="relative mx-auto" style={{ width: "108%", marginLeft: "-4%" }}>
          <div className="h-3 rounded-b-xl bg-gradient-to-b from-[#3a3d43] to-[#1a1c1f] shadow-[0_10px_20px_-8px_rgba(0,0,0,0.5)]" />
          {/* Notch in the hinge */}
          <div className="absolute left-1/2 top-0 h-1.5 w-24 -translate-x-1/2 rounded-b-lg bg-[#0e0f11]" />
        </div>
      </div>
    </div>
  );
}
