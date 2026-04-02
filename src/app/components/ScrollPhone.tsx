"use client";

import { useEffect, useRef, useState } from "react";

interface ScrollPhoneProps {
  screenshot?: string;
  alt?: string;
}

export default function ScrollPhone({
  screenshot = "/app-screenshot-scroll.jpg",
  alt = "Lifeline Health app",
}: ScrollPhoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const containerH = rect.height;
      const windowH = window.innerHeight;

      // How far through the scroll container are we?
      // When container top = viewport top → progress = 0
      // When container bottom = viewport bottom → progress = 1
      const scrollableDistance = containerH - windowH;
      if (scrollableDistance <= 0) return;

      const progress = -rect.top / scrollableDistance;
      setScrollProgress(Math.max(0, Math.min(1, progress)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Phone height = 80vh. The image is ~2.7x taller than the visible screen.
  // Scroll from 0% to ~62% of the image height.
  const maxTranslate = 62;
  const translateY = -(scrollProgress * maxTranslate);

  return (
    <div
      ref={containerRef}
      style={{ height: "300vh" }} // Tall scroll space — phone content scrolls through this
    >
      <div className="sticky top-0 h-screen flex items-center justify-center">
        {/* Phone frame — 80% viewport height */}
        <div className="relative" style={{ height: "80vh", aspectRatio: "9/19.5" }}>
          {/* Frame */}
          <div className="absolute inset-0 bg-[#1a1a1a] rounded-[2.8rem] sm:rounded-[3.2rem] border-[3px] border-[#2a2a2a] shadow-2xl" />
          {/* Inner bezel */}
          <div className="absolute inset-[4px] bg-[#111] rounded-[2.6rem] sm:rounded-[3rem]" />
          {/* Screen */}
          <div className="absolute inset-[6px] rounded-[2.4rem] sm:rounded-[2.8rem] overflow-hidden bg-[#ecf0f3]">
            <img
              src={screenshot}
              alt={alt}
              className="w-full"
              style={{
                transform: `translateY(${translateY}%)`,
                transition: "transform 0.05s linear",
                transformOrigin: "top center",
              }}
            />
          </div>
          {/* Side buttons */}
          <div className="absolute -right-[2px] top-[28%] w-[3px] h-14 bg-[#333] rounded-r-sm" />
          <div className="absolute -left-[2px] top-[22%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
          <div className="absolute -left-[2px] top-[36%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
          {/* Reflection */}
          <div
            className="absolute inset-[6px] rounded-[2.4rem] sm:rounded-[2.8rem] pointer-events-none z-10"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
