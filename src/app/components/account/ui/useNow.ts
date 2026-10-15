"use client";

import { useState } from "react";

/**
 * "Now", read once when the component mounts. Rendering must be pure, so
 * past/upcoming splits and "is it due?" checks take the time from here
 * rather than calling Date.now() during render.
 */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
