"use client";

import Image from "next/image";

interface PhoneMockupProps {
  screenshot?: string;
  alt?: string;
}

export function PhoneMockup({
  screenshot = "/app-screenshot-home.jpg",
  alt = "Lifeline Health app"
}: PhoneMockupProps) {
  return (
    <div className="relative w-[280px] h-[580px]">
      {/* Phone frame */}
      <div className="absolute inset-0 bg-[#1a1a1a] rounded-[3rem] shadow-2xl border border-[#333]" />
      {/* Inner bezel */}
      <div className="absolute inset-[3px] bg-[#111] rounded-[2.85rem]" />
      {/* Screen with real screenshot */}
      <div className="absolute inset-[4px] rounded-[2.8rem] overflow-hidden bg-[#ecf0f3]">
        {/* Subtle reflection */}
        <div
          className="absolute inset-0 z-30 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.03) 100%)",
          }}
        />
        {/* Dynamic Island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-[22px] bg-black rounded-full z-20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a] border border-[#333] ml-6" />
        </div>
        {/* Screenshot - shifted left to clip settings icon */}
        <Image
          src={screenshot}
          alt={alt}
          fill
          className="object-cover"
          style={{ objectPosition: "left top" }}
          sizes="280px"
          priority
        />
      </div>
      {/* Side buttons */}
      <div className="absolute -right-[2px] top-28 w-[3px] h-12 bg-[#333] rounded-r-sm" />
      <div className="absolute -left-[2px] top-24 w-[3px] h-7 bg-[#333] rounded-l-sm" />
      <div className="absolute -left-[2px] top-36 w-[3px] h-7 bg-[#333] rounded-l-sm" />
    </div>
  );
}

// Named export for coaching page
export const PhoneMockupCoach = PhoneMockup;
export default PhoneMockup;
