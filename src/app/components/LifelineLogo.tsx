interface LifelineLogoProps {
  size?: "sm" | "lg";
  className?: string;
  variant?: "default" | "white";
}

// Source PNG: public/lifeline-logo-rebrand.png — 4800 × 808 (≈ 5.94 : 1).
// The hi-res source gives ~13× the rendered lg width so browser zoom
// stays crisp without falling back to a softer interpolated raster.
const ASPECT = 7293 / 1227;

export default function LifelineLogo({
  size = "sm",
  className = "",
  variant = "default",
}: LifelineLogoProps) {
  const height = size === "lg" ? 60 : 38;
  const width = Math.round(height * ASPECT);
  const src = variant === "white" ? "/lifeline-logo-rebrand-white.png" : "/lifeline-logo-rebrand.png";

  // Plain <img>, not next/image. next/image was either rasterizing the
  // PNG down to a webp tuned for the rendered size (which then went
  // soft on zoom) or applying wrapper behaviour we didn't need.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt="Lifeline Health"
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
    />
  );
}
