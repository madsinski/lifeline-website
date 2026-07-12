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
 * Static app mockup. The device screen matches the screenshot's aspect ratio,
 * so the full image is always visible — nothing is cropped. Uses next/image so
 * the browser is served a variant resampled to the actual display size (avoids
 * the graininess of the browser downscaling an oversized source). Wrapped in
 * generous top/side padding for breathing room.
 */
export default function StaticPhone({
  screenshot,
  alt = "Lifeline Health app",
  phoneHeight = "54vh",
}: StaticPhoneProps) {
  return (
    <div className="flex justify-center px-10 pt-14 sm:px-16 sm:pt-20">
      {/* Phone frame — height is fixed; width is derived from the screen ratio. */}
      <div
        className="relative rounded-[2.8rem] sm:rounded-[3.2rem] bg-[#1F2937] border-[3px] border-[#374151] shadow-2xl p-[6px]"
        style={{ height: phoneHeight }}
      >
        {/* Glow behind the phone */}
        <div
          className="absolute -inset-6 sm:-inset-10 rounded-[4rem] blur-3xl opacity-40 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(32,200,88,0.25) 0%, rgba(59,130,246,0.15) 40%, transparent 70%)",
          }}
        />
        {/* Screen — aspect-locked to the screenshot, height fills the frame */}
        <div
          className="relative h-full overflow-hidden rounded-[2.4rem] sm:rounded-[2.8rem] bg-[#ecf0f3]"
          style={{ aspectRatio: SCREEN_RATIO }}
        >
          <Image
            src={screenshot}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 360px, 60vw"
            quality={90}
            className="object-cover"
          />
          {/* Screen reflection */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)",
            }}
          />
        </div>
        {/* Side buttons */}
        <div className="absolute -right-[2px] top-[28%] w-[3px] h-14 bg-[#333] rounded-r-sm" />
        <div className="absolute -left-[2px] top-[22%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
        <div className="absolute -left-[2px] top-[36%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
      </div>
    </div>
  );
}
