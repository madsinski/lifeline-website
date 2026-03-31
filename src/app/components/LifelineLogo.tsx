import Image from "next/image";

interface LifelineLogoProps {
  size?: "sm" | "lg";
  className?: string;
  showHealth?: boolean;
}

export default function LifelineLogo({
  size = "sm",
  className = "",
  showHealth = false,
}: LifelineLogoProps) {
  const width = size === "lg" ? 320 : 150;
  const height = size === "lg" ? 38 : 18;

  if (showHealth) {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        <Image
          src="/lifeline-logo.svg"
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
      src="/lifeline-logo.svg"
      alt="Lifeline"
      width={width}
      height={height}
      className={className}
      priority
      style={{ width, height }}
    />
  );
}
