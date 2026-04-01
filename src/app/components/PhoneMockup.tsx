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
        {/* Screenshot */}
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
