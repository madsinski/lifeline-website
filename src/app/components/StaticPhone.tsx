interface StaticPhoneProps {
  screenshot: string;
  alt?: string;
  /** Rendered phone height (CSS length). Width follows the 9:19.5 device ratio. */
  phoneHeight?: string;
  /** object-position for the screenshot inside the screen. */
  objectPosition?: string;
}

/**
 * Static app mockup: a single screenshot sits inside the device frame and
 * fills the screen edge-to-edge (object-cover, top-aligned) so there's never
 * a grey gap. Wrapped in generous top/side padding for breathing room.
 */
export default function StaticPhone({
  screenshot,
  alt = "Lifeline Health app",
  phoneHeight = "72vh",
  objectPosition = "top center",
}: StaticPhoneProps) {
  return (
    <div className="px-8 pt-12 sm:px-12 sm:pt-16">
      <div className="relative mx-auto" style={{ height: phoneHeight, aspectRatio: "9/19.5" }}>
        {/* Glow behind the phone */}
        <div
          className="absolute -inset-8 sm:-inset-12 rounded-[4rem] blur-3xl opacity-40 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(32,200,88,0.25) 0%, rgba(59,130,246,0.15) 40%, transparent 70%)",
          }}
        />
        {/* Frame */}
        <div className="absolute inset-0 bg-[#1F2937] rounded-[2.8rem] sm:rounded-[3.2rem] border-[3px] border-[#374151] shadow-2xl" />
        {/* Inner bezel */}
        <div className="absolute inset-[4px] bg-[#1F2937] rounded-[2.6rem] sm:rounded-[3rem]" />
        {/* Screen */}
        <div className="absolute inset-[6px] rounded-[2.4rem] sm:rounded-[2.8rem] overflow-hidden bg-[#ecf0f3]">
          {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed device screen; next/image's layout constraints don't fit here. */}
          <img
            src={screenshot}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition,
              filter: "brightness(1.04) contrast(1.05) saturate(1.12)",
            }}
          />
        </div>
        {/* Side buttons */}
        <div className="absolute -right-[2px] top-[28%] w-[3px] h-14 bg-[#333] rounded-r-sm" />
        <div className="absolute -left-[2px] top-[22%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
        <div className="absolute -left-[2px] top-[36%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
        {/* Screen reflection */}
        <div
          className="absolute inset-[6px] rounded-[2.4rem] sm:rounded-[2.8rem] pointer-events-none z-10"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)",
          }}
        />
      </div>
    </div>
  );
}
