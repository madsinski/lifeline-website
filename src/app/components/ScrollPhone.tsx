"use client";

import { useEffect, useRef, useState } from "react";

interface ScrollPhoneProps {
  screenshot: string;
  alt?: string;
  maxWidth?: number;
}

export default function ScrollPhone({
  screenshot = "/app-screenshot-scroll.jpg",
  alt = "Lifeline Health app",
  maxWidth = 300,
}: ScrollPhoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowH = window.innerHeight;

      // Calculate how far the phone is through the viewport
      // Start scrolling when phone enters viewport, end when it leaves
      const containerTop = rect.top;
      const containerH = rect.height;

      // Progress: 0 when container top enters viewport, 1 when container bottom leaves
      const start = windowH; // container top reaches bottom of viewport
      const end = -containerH; // container bottom leaves top of viewport
      const current = containerTop;
      const progress = 1 - (current - end) / (start - end);

      setScrollProgress(Math.max(0, Math.min(1, progress)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // The image is much taller than the phone screen
  // translateY moves from 0% (top of image) to -X% (bottom of image)
  // The phone screen shows ~40% of the image height at any time
  const maxTranslate = 60; // percentage of image to scroll through
  const translateY = -(scrollProgress * maxTranslate);

  return (
    <div
      ref={containerRef}
      className="flex justify-center"
      style={{ minHeight: "120vh" }} // Extra height for scroll space
    >
      <div className="sticky top-24" style={{ maxWidth, width: "100%" }}>
        <div className="relative w-full aspect-[9/18] overflow-hidden">
          {/* Phone frame */}
          <div className="absolute inset-0 bg-[#1a1a1a] rounded-[3rem] border-[3px] border-[#2a2a2a] shadow-2xl" />
          {/* Inner bezel */}
          <div className="absolute inset-[4px] bg-[#111] rounded-[2.8rem]" />
          {/* Screen */}
          <div className="absolute inset-[6px] rounded-[2.6rem] overflow-hidden bg-[#ecf0f3]">
            <img
              src={screenshot}
              alt={alt}
              className="w-full transition-transform duration-100 ease-out"
              style={{
                transform: `translateY(${translateY}%)`,
                transformOrigin: "top center",
              }}
            />
          </div>
          {/* Side buttons */}
          <div className="absolute -right-[2px] top-[28%] w-[3px] h-14 bg-[#333] rounded-r-sm" />
          <div className="absolute -left-[2px] top-[22%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
          <div className="absolute -left-[2px] top-[36%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
          {/* Subtle reflection */}
          <div
            className="absolute inset-[6px] rounded-[2.6rem] pointer-events-none z-10"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
