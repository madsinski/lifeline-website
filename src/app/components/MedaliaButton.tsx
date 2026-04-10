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
      ? "bg-[#0D9488] text-white hover:bg-[#0B7B73] shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
      : "border-2 border-[#0D9488] text-[#0D9488] hover:bg-[#0D9488] hover:text-white";

  return (
    <button
      className={`medalia-widget inline-flex items-center justify-center font-semibold rounded-xl transition-all ${sizeClasses[size]} ${variantClasses} ${className}`}
      data-src="https://app.medalia.is/7ca0ca21-8947-46cb-afbd-2e2d15efef6e"
      type="button"
    >
      {label}
    </button>
  );
}
