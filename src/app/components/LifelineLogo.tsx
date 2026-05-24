import Image from "next/image";

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
  // PNG (not SVG) is intentional. At small display sizes the SVG's
  // sub-pixel strokes on the mark produced visible aliasing that only
  // smoothed out on browser zoom. next/image converts the PNG to a
  // size-appropriate webp per viewport + DPR, which renders cleaner.
  const src = variant === "white" ? "/lifeline-logo-rebrand-white.png" : "/lifeline-logo-rebrand.png";

  return (
    <Image
      src={src}
      alt="Lifeline Health"
      width={width}
      height={height}
      className={className}
      priority
      style={{ width, height }}
    />
  );
}
