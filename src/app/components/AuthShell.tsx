// One frame for every way into Lifeline: /byrja (signup), /account/login,
// /auth/*, the B2B employee onboarding and the partner invite.
//
// Five screens used to have five shells — two logos on some (the site's
// Navbar plus their own), a gradient here, a sticky bar there. This is the
// one: logo top left, optional back + "Skref n af N" with a bar, and a
// single white card on the hc page colour. The routes that use it are in
// the Navbar/Footer chromeFree lists so the logo appears once.
//
// Presentational only — no Supabase, no state. Stateful pieces (resend,
// forms) live with their callers.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LifelineLogo from "@/app/components/LifelineLogo";
import { hcCard } from "@/app/components/hc/ui";

type Props = {
  children: React.ReactNode;
  /** Progress, e.g. { n: 2, of: 6 } → "Skref 2 af 6" and a bar. */
  step?: { n: number; of: number };
  /** Back: a handler, or an href. */
  back?: (() => void) | string;
  /** Under the card (secondary links). */
  footer?: React.ReactNode;
  /** Above the card, outside it (e.g. audience tabs). */
  above?: React.ReactNode;
  /** "md" (default) for forms; "lg" for screens carrying long documents. */
  width?: "md" | "lg";
  /** Render children without the card wrapper (they bring their own). */
  bare?: boolean;
};

export const authInput =
  "mt-1 block min-h-12 w-full rounded-hc-element border border-hc-control bg-hc-surface px-3.5 text-[16px] text-hc-ink outline-none transition focus:border-hc-brand-dark focus:ring-2 focus:ring-hc-brand/30";
export const authLabel = "block text-sm font-medium text-hc-ink";
export const authPrimary =
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-hc-element bg-hc-brand-dark px-4 font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand disabled:cursor-not-allowed disabled:opacity-50";
export const authSecondary =
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-hc-element border border-hc-control bg-hc-surface px-4 font-semibold text-hc-ink-2 transition hover:bg-hc-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand disabled:cursor-not-allowed disabled:opacity-50";
export const authLink = "font-semibold text-hc-brand-text underline-offset-2 hover:underline";

export default function AuthShell({ children, step, back, footer, above, width = "md", bare }: Props) {
  const max = width === "lg" ? "max-w-2xl" : "max-w-md";
  const backEl = !back ? null : typeof back === "string" ? (
    <Link href={back} className="-ml-1.5 inline-flex min-h-10 items-center gap-1 rounded-hc-element px-1.5 text-sm font-semibold text-hc-ink-2 hover:bg-hc-sunken-2">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
    </Link>
  ) : (
    <button type="button" onClick={back} className="-ml-1.5 inline-flex min-h-10 items-center gap-1 rounded-hc-element px-1.5 text-sm font-semibold text-hc-ink-2 hover:bg-hc-sunken-2">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
    </button>
  );

  return (
    <div className="min-h-screen bg-hc-page">
      <div className={`mx-auto ${max} px-4 pb-16 pt-5 sm:pt-8`}>
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Lifeline Health – forsíða" className="inline-flex">
            <LifelineLogo size="sm" />
          </Link>
        </header>

        {(backEl || step) && (
          <div className="mt-5">
            <div className="flex min-h-10 items-center justify-between gap-3">
              <span>{backEl}</span>
              {step && (
                <span className="text-xs font-semibold tabular-nums text-hc-ink-3">
                  Skref {step.n} af {step.of}
                </span>
              )}
            </div>
            {step && (
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hc-sunken-2"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={step.of}
                aria-valuenow={step.n}
                aria-label={`Skref ${step.n} af ${step.of}`}
              >
                <div
                  className="h-full rounded-full bg-hc-brand-dark transition-all duration-300"
                  style={{ width: `${Math.min(100, (step.n / step.of) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {above && <div className="mt-6">{above}</div>}

        <main className={above ? "mt-3" : "mt-6"}>
          {bare ? children : <div className={`${hcCard.base} p-6 sm:p-8`}>{children}</div>}
        </main>

        {footer && <div className="mt-6 text-center text-sm text-hc-ink-2">{footer}</div>}
      </div>
    </div>
  );
}
