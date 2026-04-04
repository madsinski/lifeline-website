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

      if (inline) {
        // Inline mode: measure when the phone itself has settled into sticky position
        // The phone is sticky — image scrolling should only start once the phone
        // is pinned (i.e., its parent has scrolled past the phone's offset)
        const phoneEl = containerRef.current;
        const section = phoneEl.closest("section");
        if (!section) return;

        const sectionRect = section.getBoundingClientRect();
        const phoneRect = phoneEl.getBoundingClientRect();
        const windowH = window.innerHeight;

        // The phone becomes "stuck" when its top matches the sticky offset
        // Mobile: top-[10vh], Desktop (lg 1024+): top-0
        const isDesktop = window.innerWidth >= 1024;
        const stickyOffset = isDesktop ? 0 : windowH * 0.1;
        const phoneIsStuck = phoneRect.top <= stickyOffset + 2;

        if (!phoneIsStuck) {
          setScrollProgress(0);
          // Remember where the phone sticks so we can measure from that point
          return;
        }

        // Phone is stuck — measure progress from the phone's current position
        // to the bottom of the section
        const sectionBottom = sectionRect.bottom;
        const phoneBottom = phoneRect.bottom;

        // How far below the phone does the section extend?
        const scrollRemaining = sectionBottom - windowH;
        // Total distance the section extends below the phone when it first sticks
        // Phone sticks when sectionRect.top = -(phoneOffsetFromSectionTop - stickyOffset)
        // The remaining scrollable = section bottom - viewport bottom
        const phoneOffsetInSection = phoneRect.top - sectionRect.top;
        const totalScrollableAfterStick = sectionRect.height - phoneOffsetInSection - windowH + stickyOffset;

        if (totalScrollableAfterStick <= 0) return;

        const progress = Math.max(0, Math.min(1, 1 - (scrollRemaining / totalScrollableAfterStick)));
        setScrollProgress(progress);
      } else {
        // Standalone mode: simple progress based on container scroll
        const rect = containerRef.current.getBoundingClientRect();
        const containerH = rect.height;
        const windowH = window.innerHeight;
        const scrollableDistance = containerH - windowH;
        if (scrollableDistance <= 0) return;

        const progress = -rect.top / scrollableDistance;
        setScrollProgress(Math.max(0, Math.min(1, progress)));
      }
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
