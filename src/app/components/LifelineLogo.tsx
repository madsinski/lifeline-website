interface LifelineLogoProps {
  size?: "sm" | "lg";
  className?: string;
  variant?: "default" | "white";
}

// Source SVG: public/lifeline-logo-rebrand.svg — viewBox 7293 × 1227 (≈ 5.94 : 1)
const ASPECT = 7293 / 1227;

export default function LifelineLogo({
  size = "sm",
  className = "",
  variant = "default",
}: LifelineLogoProps) {
  const height = size === "lg" ? 60 : 38;
  const width = Math.round(height * ASPECT);
  const src = variant === "white" ? "/lifeline-logo-rebrand-white.svg" : "/lifeline-logo-rebrand.svg";

  // Plain <img> on purpose: the logo is an SVG so we want the browser
  // to render it as a true vector at every zoom level. next/image was
  // either rasterizing it to webp (jagged at small sizes) or wrapping
  // it in a way that introduced sub-pixel artefacts. Source SVG was
  // also cleaned of the duplicate stroked overlay paths that the design
  // tool exported, which were causing the small-size aliasing.
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
