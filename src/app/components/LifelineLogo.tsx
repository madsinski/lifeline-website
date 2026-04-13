import Image from "next/image";

interface LifelineLogoProps {
  size?: "sm" | "lg";
  className?: string;
  showHealth?: boolean;
  variant?: "default" | "white";
}

export default function LifelineLogo({
  size = "sm",
  className = "",
  showHealth = false,
  variant = "default",
}: LifelineLogoProps) {
  const width = size === "lg" ? 320 : 150;
  const height = size === "lg" ? 38 : 18;
  const src = variant === "white" ? "/lifeline-logo-rebrand-white.svg" : "/lifeline-logo-rebrand.svg";

  if (showHealth) {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        <Image
          src={src}
          alt="Lifeline"
          width={width}
          height={height}
          priority
          style={{ width, height }}
        />
        <span className="text-lg tracking-[5px] text-gray-400 font-light mt-1">
          HEALTH
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt="Lifeline"
      width={width}
      height={height}
      className={className}
      priority
      style={{ width, height }}
    />
  );
}
