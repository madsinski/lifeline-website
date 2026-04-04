"use client";

import { useEffect, useRef, useState } from "react";

interface ScrollPhoneProps {
  screenshot?: string;
  alt?: string;
  initialOffset?: number;
  maxTranslate?: number;
  scrollHeight?: string;
  phoneHeight?: string;
  inline?: boolean;
}

export default function ScrollPhone({
  screenshot = "/app-screenshot-scroll.jpg",
  alt = "Lifeline Health app",
  initialOffset = 0,
  maxTranslate = 37.5,
  scrollHeight = "250vh",
  phoneHeight = "80vh",
  inline = false,
}: ScrollPhoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      // Find the section that controls scroll
      let el: Element | null = containerRef.current;
      if (inline) {
        el = containerRef.current.closest("section") || containerRef.current.parentElement;
      }
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const scrollableDistance = rect.height - window.innerHeight;
      if (scrollableDistance <= 0) return;

      const progress = -rect.top / scrollableDistance;
      setScrollProgress(Math.max(0, Math.min(1, progress)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [inline]);

  const translateY = -(initialOffset + scrollProgress * maxTranslate);

  const phoneFrame = (
    <div className="relative" style={{ height: phoneHeight, aspectRatio: "9/19.5" }}>
      <div className="absolute inset-0 bg-[#1a1a1a] rounded-[2.8rem] sm:rounded-[3.2rem] border-[3px] border-[#2a2a2a] shadow-2xl" />
      <div className="absolute inset-[4px] bg-[#111] rounded-[2.6rem] sm:rounded-[3rem]" />
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
      <div className="absolute -right-[2px] top-[28%] w-[3px] h-14 bg-[#333] rounded-r-sm" />
      <div className="absolute -left-[2px] top-[22%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
      <div className="absolute -left-[2px] top-[36%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
      <div
        className="absolute inset-[6px] rounded-[2.4rem] sm:rounded-[2.8rem] pointer-events-none z-10"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
        }}
      />
    </div>
  );

  if (inline) {
    return (
      <div ref={containerRef} className="sticky top-[10vh] lg:top-0 h-[80vh] lg:h-screen flex items-center justify-center">
        {phoneFrame}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: scrollHeight }}>
      <div className="sticky top-0 h-screen flex items-center justify-center pt-8">
        {phoneFrame}
      </div>
    </div>
  );
}
