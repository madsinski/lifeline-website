"use client";

// One button for the account pages, built on the same base as /app's hcBtn
// so a primary action looks the same on both sides of the "Opna appið" link.
// Primary is hc-brand-dark (white on it is 5.48:1); #10B981 with white text
// fails AA and is not used for buttons anywhere here.

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { hcBtn } from "@/app/components/hc/ui";

export type ButtonVariant = "primary" | "secondary" | "danger" | "dangerOutline" | "ghost" | "link" | "inverse" | "inverseOutline";
export type ButtonSize = "sm" | "md";

const small = "min-h-8 px-3 text-xs";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: hcBtn.primary,
  secondary: hcBtn.secondary,
  ghost: hcBtn.ghost,
  danger: `${hcBtn.base} bg-red-700 text-white hover:bg-red-800`,
  dangerOutline: `${hcBtn.base} border border-red-300 bg-hc-surface text-red-700 hover:bg-red-50`,
  // For use on the dark-emerald PageHero.
  inverse: `${hcBtn.base} bg-white text-hc-brand-text hover:bg-hc-brand-surface`,
  inverseOutline: `${hcBtn.base} border border-white/50 text-white hover:bg-white/10`,
  link: "inline-flex items-center gap-1 rounded text-sm font-semibold text-hc-brand-text underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand disabled:opacity-40",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  const v = VARIANTS[variant];
  const s = size === "sm" && variant !== "link" ? small : "";
  return [v, s, extra].filter(Boolean).join(" ");
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "primary", size = "md", busy = false, icon, className = "", children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || busy} aria-busy={busy || undefined} className={buttonClass(variant, size, className)} {...rest}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function ButtonLink({ variant = "primary", size = "md", icon, className = "", children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
