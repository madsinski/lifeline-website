"use client";

// What a cold load looks like.
//
// The skeletons already keep the layout from jumping when data lands; this
// is the part that says something is happening. A thin bar across the top
// rather than a spinner in the middle: the page underneath is real, most of
// it is already drawn, and covering it to say "wait" would be a downgrade.

/**
 * An indeterminate bar, pinned to the top of the viewport.
 *
 * Indeterminate because we genuinely do not know: the payload is a handful
 * of small reads whose total depends on a cold function and somebody's
 * signal. A percentage would have to be invented, and an invented
 * percentage that sticks at 90% is worse than an honest sweep.
 */
export function LoadingBar({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <div
      role="progressbar"
      aria-label="Hleð"
      aria-busy="true"
      className="hc-loading-bar pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-hc-brand/10"
    />
  );
}

/** A block of the right size, shimmering rather than blinking. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`hc-shimmer rounded-3xl ${className}`} />;
}
