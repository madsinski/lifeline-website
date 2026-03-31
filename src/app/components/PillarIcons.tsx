import { ReactNode } from "react";

// Barbell/dumbbell icon for Exercise (matches app's Ionicons "barbell")
export function ExerciseIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11M17.5 6.5v11M2 9v6M22 9v6M6.5 12h11M2 12h4.5M17.5 12H22" />
    </svg>
  );
}

// Apple icon for Nutrition — simple clean outline
export function NutritionIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Leaf */}
      <path d="M12 3c1.5-.5 3.5 0 4 1.5.5 1.5-1 2.5-2.5 2s-2-2-1.5-3.5z" fill="currentColor" stroke="none" />
      {/* Stem */}
      <path d="M12 3v4" />
      {/* Apple body */}
      <path d="M17.5 10c2 1.5 2.5 4 2 6.5C18.5 20 15.5 22 13 22c-.7 0-1-.5-1-.5s-.3.5-1 .5c-2.5 0-5.5-2-6.5-5.5-.5-2.5 0-5 2-6.5C8 9 10 8 12 9.5 14 8 16 9 17.5 10z" />
    </svg>
  );
}

// Moon icon for Sleep (matches app's Ionicons "moon")
export function SleepIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

// Smiley face icon for Mental Wellness (matches app's Ionicons "happy")
export function MentalIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface PillarCircleProps {
  color: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function PillarCircle({ color, children, size = "md" }: PillarCircleProps) {
  const sizeClass = size === "lg" ? "w-16 h-16" : size === "sm" ? "w-10 h-10" : "w-12 h-12";
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center border-2 transition-all duration-200`}
      style={{
        backgroundColor: `${color}15`,
        borderColor: color,
        color: color,
      }}
    >
      <div className="flex items-center justify-center w-full h-full">
        {children}
      </div>
    </div>
  );
}
