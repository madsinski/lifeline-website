"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const screenshots = [
  { src: "/app-screenshot-home.jpg", label: "Daily Actions" },
  { src: "/app-screenshot-health.jpg", label: "Health Overview" },
  { src: "/app-screenshot-coach.jpg", label: "Coach Messaging" },
  { src: "/app-screenshot-report.jpg", label: "Health Report" },
  { src: "/app-screenshot-community.jpg", label: "Community" },
  { src: "/app-screenshot-blood.jpg", label: "Blood Results" },
];

export function PhoneMockup({ autoPlay = true }: { autoPlay?: boolean }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % screenshots.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [autoPlay]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[280px] h-[580px]">
        {/* Phone frame */}
        <div className="absolute inset-0 bg-[#1a1a1a] rounded-[3rem] shadow-2xl border border-[#333]" />
        {/* Inner bezel */}
        <div className="absolute inset-[3px] bg-[#111] rounded-[2.85rem]" />
        {/* Screen with real screenshot */}
        <div className="absolute inset-[4px] rounded-[2.8rem] overflow-hidden bg-[#ecf0f3]">
          {/* Subtle reflection overlay */}
          <div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.03) 100%)",
            }}
          />

          {/* Dynamic Island notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-[22px] bg-black rounded-full z-20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a] border border-[#333] ml-6" />
          </div>

          {/* Screenshot image */}
          <Image
            src={screenshots[current].src}
            alt={screenshots[current].label}
            fill
            className="object-cover object-top transition-opacity duration-500"
            sizes="280px"
            priority={current === 0}
          />
        </div>

        {/* Side button (power) */}
        <div className="absolute -right-[2px] top-28 w-[3px] h-12 bg-[#333] rounded-r-sm" />
        {/* Volume buttons */}
        <div className="absolute -left-[2px] top-24 w-[3px] h-7 bg-[#333] rounded-l-sm" />
        <div className="absolute -left-[2px] top-36 w-[3px] h-7 bg-[#333] rounded-l-sm" />
      </div>

      {/* Dot indicators */}
      <div className="flex items-center gap-2">
        {screenshots.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setCurrent(i)}
            className={`transition-all duration-300 rounded-full ${
              i === current
                ? "w-6 h-2 bg-[#20c858]"
                : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
            }`}
            aria-label={s.label}
          />
        ))}
      </div>

      {/* Current screen label */}
      <p className="text-xs text-[#6B7280] font-medium">
        {screenshots[current].label}
      </p>
    </div>
  );
}

// Alias exports for different pages
export const PhoneMockupCoach = PhoneMockup;
export default PhoneMockup;
