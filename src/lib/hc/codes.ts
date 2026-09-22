// Human-typeable codes: activation codes (issued after payment, redeemed in
// the patient portal) and employer codes (one per employee). Server-only.
//
// Alphabet drops 0/O/1/I/L so a code read aloud or copied from paper
// survives. 8 random characters over 31 symbols ≈ 39.6 bits; codes are also
// single-use and rate-limited at redemption.

import { randomInt } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function chunk(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** LL-XXXX-XXXX — the patient-portal activation code. */
export const newActivationCode = () => `LL-${chunk(4)}-${chunk(4)}`;

/** FY-XXXX-XXXX — an employer code (fyrirtæki). */
export const newCompanyCode = () => `FY-${chunk(4)}-${chunk(4)}`;

/** Normalise what a person typed: case, spaces, missing dashes. */
export function normalizeCode(input: string): string {
  const raw = (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 10) return raw;
  return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6)}`;
}
