"use client";

interface MedaliaButtonProps {
  label?: string;
  variant?: "filled" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function MedaliaButton({
  label = "Open Patient Portal",
  variant = "filled",
  size = "md",
  className = "",
}: MedaliaButtonProps) {
  const sizeClasses = {
    sm: "px-5 py-2 text-sm",
    md: "px-7 py-3 text-base",
    lg: "px-10 py-4 text-base",
  };

  const variantClasses =
    variant === "filled"
      ? "bg-[#20c858] text-white hover:bg-[#1ab34d] shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
      : "border-2 border-[#20c858] text-[#20c858] hover:bg-[#20c858] hover:text-white";

  return (
    <button
      className={`medalia-widget inline-flex items-center justify-center font-semibold rounded-full transition-all ${sizeClasses[size]} ${variantClasses} ${className}`}
      data-src="https://app.medalia.is/7ca0ca21-8947-46cb-afbd-2e2d15efef6e"
      type="button"
    >
      {label}
    </button>
  );
}
