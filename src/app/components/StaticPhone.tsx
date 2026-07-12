import Image from "next/image";

interface StaticPhoneProps {
  screenshot: string;
  alt?: string;
  /** Rendered phone height (CSS length). Width follows the screenshot ratio. */
  phoneHeight?: string;
}

// The screenshots are 1440×2988 after the status bar is cropped (keeping the
// app's natural padding above the header). The screen uses this exact ratio so
// the whole screenshot shows with no cropping on any side — the phone frame
// simply follows the image instead of the other way round.
const SCREEN_RATIO = "1440 / 2988";

/**
 * Static app mockup in a modern flagship-style frame: thin uniform bezels, a
 * brushed-metal edge rail and a large corner radius. The device screen
 * matches the screenshot's aspect ratio, so the full image is
 * always visible — nothing is cropped. Rendered via next/image so the browser
 * gets a variant resampled to the display size (no downscaling grain).
 */
export default function StaticPhone({
  screenshot,
  alt = "Lifeline Health app",
  phoneHeight = "70vh",
}: StaticPhoneProps) {
  return (
    <div className="flex justify-center px-10 pt-14 sm:px-16 sm:pt-20">
      {/* Metal edge rail — height is fixed; width is derived from the screen ratio. */}
      <div
        className="relative rounded-[3rem] sm:rounded-[3.4rem] p-[3px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
        style={{
          height: phoneHeight,
          background: "linear-gradient(150deg,#5b616a 0%,#23262b 42%,#0e0f11 100%)",
        }}
      >
        {/* Glow behind the phone */}
        <div
          className="absolute -inset-6 sm:-inset-10 rounded-[4rem] blur-3xl opacity-40 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(32,200,88,0.25) 0%, rgba(59,130,246,0.15) 40%, transparent 70%)",
          }}
        />
        {/* Thin black bezel */}
        <div className="relative h-full rounded-[2.85rem] sm:rounded-[3.25rem] bg-black p-[5px]">
          {/* Screen — aspect-locked to the screenshot, height fills the bezel */}
          <div
            className="relative h-full overflow-hidden rounded-[2.5rem] sm:rounded-[2.9rem] bg-[#ecf0f3]"
            style={{ aspectRatio: SCREEN_RATIO }}
          >
            <Image
              src={screenshot}
              alt={alt}
              fill
              sizes="(min-width: 1024px) 440px, 72vw"
              quality={90}
              className="object-cover"
            />
            {/* Screen reflection */}
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 45%)",
              }}
            />
          </div>
        </div>
        {/* Slim side buttons */}
        <div className="absolute -right-[2px] top-[26%] h-16 w-[2px] rounded-r bg-[#2b2e33]" />
        <div className="absolute -left-[2px] top-[20%] h-10 w-[2px] rounded-l bg-[#2b2e33]" />
        <div className="absolute -left-[2px] top-[33%] h-10 w-[2px] rounded-l bg-[#2b2e33]" />
      </div>
    </div>
  );
}
