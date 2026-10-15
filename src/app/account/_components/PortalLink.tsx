"use client";

// The patient portal (sjúklingagátt, run by Medalia), as an account-page
// button. Same address as components/MedaliaButton — that one is white on
// #10B981 (2.5:1, fails AA) and pill-shaped, so it does not match the rest
// of these pages. Keep the two URLs in step.

import { ExternalLink } from "lucide-react";
import { buttonClass, type ButtonSize } from "@/app/components/account/ui";
import { useI18n } from "@/lib/i18n";

export const PORTAL_URL = "https://app.medalia.is/7ca0ca21-8947-46cb-afbd-2e2d15efef6e";

export default function PortalLink({ label, variant = "primary", size = "sm", className = "" }: {
  label?: string;
  variant?: "primary" | "secondary";
  size?: ButtonSize;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)}>
      {label ?? t("acct.p.opna-sjuklingagatt", "Opna sjúklingagátt")}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only"> ({t("acc.common.newtab", "opnast í nýjum flipa")})</span>
    </a>
  );
}
