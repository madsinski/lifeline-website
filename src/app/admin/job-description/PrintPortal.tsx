"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders its children into a <div class="jd-print-portal"> appended to
// <body>. Being a direct body child means that, in print, hiding every
// other body child leaves this content in normal document flow — so it
// paginates naturally across pages instead of being clipped like an
// absolutely-positioned block. Hidden on screen via CSS.
export default function PrintPortal({ children }: { children: React.ReactNode }) {
  // Portal target (document.body) only exists on the client, so render
  // nothing until mounted to keep SSR and first client render in sync.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<div className="jd-print-portal">{children}</div>, document.body);
}
