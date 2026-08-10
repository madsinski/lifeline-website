interface MedaliaButtonProps {
  label?: string;
  variant?: "filled" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}

// The Medalia patient portal. Opens in a new tab (previously an embedded SDK
// widget overlay — changed so every portal link opens in its own tab).
const PORTAL_URL = "https://app.medalia.is/7ca0ca21-8947-46cb-afbd-2e2d15efef6e";

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
      ? "bg-[#10B981] text-white hover:bg-[#047857] shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
      : "border-2 border-[#10B981] text-[#10B981] hover:bg-[#10B981] hover:text-white";

  return (
    <a
      href={PORTAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center font-semibold rounded-full transition-all whitespace-nowrap ${sizeClasses[size]} ${variantClasses} ${className}`}
    >
      {label}
    </a>
  );
}
