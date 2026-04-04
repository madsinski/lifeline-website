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
  // Track when the phone first becomes stuck (mobile only)
  const stickPointRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      // Find the scroll container
      let el: Element | null = containerRef.current;
      if (inline) {
        el = containerRef.current.closest("section") || containerRef.current.parentElement;
      }
      if (!el) return;

      const sectionRect = el.getBoundingClientRect();
      const sectionH = sectionRect.height;
      const windowH = window.innerHeight;
      const scrollableDistance = sectionH - windowH;
      if (scrollableDistance <= 0) return;

      // How far the section has scrolled (0 = top at viewport top, 1 = bottom at viewport bottom)
      const rawProgress = -sectionRect.top / scrollableDistance;

      if (inline) {
        const isDesktop = window.innerWidth >= 1024;

        if (isDesktop) {
          // Desktop: no delay, direct progress
          setScrollProgress(Math.max(0, Math.min(1, rawProgress)));
        } else {
          // Mobile: wait until phone reaches sticky position before scrolling image
          const phoneRect = containerRef.current.getBoundingClientRect();
          const stickyOffset = windowH * 0.1; // top-[10vh]
          const phoneIsStuck = phoneRect.top <= stickyOffset + 2;

          if (!phoneIsStuck) {
            // Phone still moving down to its position — record the scroll position when it sticks
            stickPointRef.current = null;
            setScrollProgress(0);
          } else {
            // Phone is stuck — start scrolling the image from this point
            if (stickPointRef.current === null) {
              stickPointRef.current = -sectionRect.top;
            }
            const scrollSinceStick = -sectionRect.top - stickPointRef.current;
            const remainingDistance = scrollableDistance - stickPointRef.current;
            if (remainingDistance <= 0) return;

            const progress = scrollSinceStick / remainingDistance;
            setScrollProgress(Math.max(0, Math.min(1, progress)));
          }
        }
      } else {
        // Standalone mode
        setScrollProgress(Math.max(0, Math.min(1, rawProgress)));
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
    <div ref={containerRef} style={{ height: scrollHeight }}>
      <div className="sticky top-0 h-screen flex items-center justify-center pt-8">
        {phoneFrame}
      </div>
    </div>
  );
}
