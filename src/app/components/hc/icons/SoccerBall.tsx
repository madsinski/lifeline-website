// A football, because lucide does not have one.
//
// Its `goal` icon is a net, which is where the ball goes rather than the
// sport, and `volleyball` and `circle-dot` were both standing in for it.
// Drawn to match lucide's conventions so it sits correctly beside them:
// 24×24 viewBox, currentColor stroke, 2px width, round caps and joins, no
// fill — the panels are strokes, not shapes.
//
// The pattern is the real one: a pentagon at the centre with seams running
// out to the circumference, which is what reads as "football" at 12px.

export default function SoccerBall({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      {/* The centre pentagon, point up. */}
      <path d="M12 7.2 15.6 9.8 14.2 14 9.8 14 8.4 9.8Z" />
      {/* Seams from each vertex to the edge. */}
      <path d="M12 7.2V2.2" />
      <path d="m15.6 9.8 4.75-1.55" />
      <path d="m14.2 14 2.94 4.04" />
      <path d="m9.8 14-2.94 4.04" />
      <path d="M8.4 9.8 3.65 8.25" />
    </svg>
  );
}
