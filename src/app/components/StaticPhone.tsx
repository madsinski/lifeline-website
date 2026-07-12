"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";

interface StaticPhoneProps {
  screenshot: string;
  alt?: string;
  /** Rendered phone height (CSS length). Width follows the 9:19.5 device ratio. */
  phoneHeight?: string;
  /** object-position for the screenshot inside the screen. */
  objectPosition?: string;
  /** Click the phone to open a full-screen enlarged view. Defaults to true. */
  zoomable?: boolean;
}

/** The device frame with the screenshot filling the screen edge-to-edge
 *  (object-cover, top-aligned) so there's never a grey gap. Shared by the
 *  inline mockup and the enlarged lightbox. */
function PhoneFrame({
  screenshot,
  alt,
  phoneHeight,
  objectPosition,
  onActivate,
  interactive,
}: {
  screenshot: string;
  alt: string;
  phoneHeight: string;
  objectPosition: string;
  onActivate?: () => void;
  interactive?: boolean;
}) {
  return (
    <div
      className={`relative mx-auto ${interactive ? "cursor-zoom-in" : ""}`}
      style={{ height: phoneHeight, aspectRatio: "9/19.5" }}
      {...(interactive
        ? {
            role: "button" as const,
            tabIndex: 0,
            "aria-label": alt,
            onClick: onActivate,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate?.();
              }
            },
          }
        : {})}
    >
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
  );
}

/** Full-screen enlarged phone. Click anywhere or press Escape to close. */
function PhoneLightbox({
  screenshot,
  alt,
  objectPosition,
  onClose,
}: {
  screenshot: string;
  alt: string;
  objectPosition: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[10060] grid place-items-center cursor-zoom-out"
      style={{ background: "rgba(3,16,12,0.93)", padding: "3vmin" }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-5 right-6 text-white/70 hover:text-white text-3xl leading-none"
      >
        ×
      </button>
      <div onClick={(e) => e.stopPropagation()}>
        <PhoneFrame
          screenshot={screenshot}
          alt={alt}
          phoneHeight="min(90vh, 820px)"
          objectPosition={objectPosition}
        />
      </div>
    </div>,
    document.body
  );
}

/**
 * Static app mockup: a single screenshot sits inside the device frame and
 * fills the screen edge-to-edge. Click to open an enlarged full-screen view.
 * Replaces the old scroll-scrubbed ScrollPhone.
 */
export default function StaticPhone({
  screenshot,
  alt = "Lifeline Health app",
  phoneHeight = "78vh",
  objectPosition = "top center",
  zoomable = true,
}: StaticPhoneProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div title={zoomable ? t("common.tapToEnlarge", "Click to enlarge") : undefined}>
      <PhoneFrame
        screenshot={screenshot}
        alt={alt}
        phoneHeight={phoneHeight}
        objectPosition={objectPosition}
        interactive={zoomable}
        onActivate={() => setOpen(true)}
      />
      {open && (
        <PhoneLightbox
          screenshot={screenshot}
          alt={alt}
          objectPosition={objectPosition}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
