"use client";

import { useEffect, useRef, useState } from "react";

interface ScrollPhoneProps {
  screenshot?: string;
  alt?: string;
  /** Starting image offset in % — use to hide the app header/status bar */
  initialOffset?: number;
  /** Max scroll distance in % */
  maxTranslate?: number;
  /** Height of the scroll container */
  scrollHeight?: string;
  /** Phone height as CSS value */
  phoneHeight?: string;
  /** Whether this phone is standalone (full-width centered) or inline (no container height) */
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
      let el: Element | null = containerRef.current;
      if (inline) {
        el = containerRef.current.closest("section") || containerRef.current.parentElement;
      }
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const containerH = rect.height;
      const windowH = window.innerHeight;

      const scrollableDistance = containerH - windowH;
      if (scrollableDistance <= 0) return;

      // For inline mode, delay scroll start until the phone is in view
      // The phone is sticky and centered — don't start scrolling the image
      // until the user has scrolled past the text content above
      const rawProgress = -rect.top / scrollableDistance;
      const delayStart = inline ? 0.15 : 0; // 15% delay for inline to let phone settle
      const adjustedProgress = Math.max(0, (rawProgress - delayStart) / (1 - delayStart));
      const progress = Math.max(0, Math.min(1, adjustedProgress));
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [inline]);

  const translateY = -(initialOffset + scrollProgress * maxTranslate);

  const phoneFrame = (
    <div className="relative" style={{ height: phoneHeight, aspectRatio: "9/19.5" }}>
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
  );

  // Inline mode: sticky phone centered vertically with offset
  if (inline) {
    return (
      <div ref={containerRef} className="sticky top-[10vh] h-[80vh] flex items-center justify-center">
        {phoneFrame}
      </div>
    );
  }

  // Standalone mode: self-contained scroll container
  return (
    <div
      ref={containerRef}
      style={{ height: scrollHeight }}
    >
      <div className="sticky top-0 h-screen flex items-center justify-center pt-8">
        {phoneFrame}
      </div>
    </div>
  );
}
