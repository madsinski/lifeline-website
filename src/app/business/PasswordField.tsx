"use client";

// Labelled password input with a show/hide toggle, styled like the B2C
// screens (/account/login, /byrja). Used by the B2B login/signup and the
// co-admin setup so all three behave the same.

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authInput, authLabel } from "@/app/components/AuthShell";

export const B2B_MIN_PW = 12;

export default function PasswordField({
  label, value, onChange, autoComplete, minLength, hint, autoFocus, id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  /** Set for new passwords; also gives the browser an Icelandic message. */
  minLength?: number;
  hint?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block" htmlFor={id}>
      <span className={authLabel}>{label}</span>
      <span className="relative block">
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          autoFocus={autoFocus}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          onInvalid={(e) => e.currentTarget.setCustomValidity(
            minLength && e.currentTarget.value
              ? `Lykilorðið þarf að vera minnst ${minLength} stafir.`
              : "Sláðu inn lykilorðið.",
          )}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          className={`${authInput} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Fela lykilorð" : "Sýna lykilorð"}
          aria-pressed={show}
          className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-hc-element text-hc-ink-2 hover:bg-hc-sunken-2"
        >
          {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </span>
      {hint && <span className="mt-1 block text-xs text-hc-ink-3">{hint}</span>}
    </label>
  );
}
