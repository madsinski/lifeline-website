"use client";

// The client app: one surface, built for daily use on a phone.
//
// Separate from /account on purpose. /account is the place someone visits
// when they have business with us — booking, their report, settings.
// This is the thing they open in the morning. It shares everything that
// matters (auth, Supabase, the hc component library, the design language)
// and nothing that does not.
//
// Kept out of the marketing chrome: no Navbar, no Footer. A bottom bar and
// the content, which is what makes it read as an app rather than a website
// with an app-shaped page in it.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppNav from "./AppNav";
import { LanguagePicker } from "@/lib/i18n";
import { appBrand } from "./ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        router.replace(`/account/login?next=${encodeURIComponent("/app")}`);
        return;
      }
      setTimeout(() => setReady(true), 0);
    })();
  }, [router]);

  // The app's canvas is #ecf0f3 — a grey-blue, not the website's off-white.
  // Cards read as raised against it, which is most of why the app's home
  // screen looks the way it does.
  return (
    <div className="min-h-screen lg:pl-56" style={{ background: appBrand.canvas, color: appBrand.ink1 }}>
      {/* pb clears the bottom bar; the safe-area inset is on the bar itself. */}
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4 lg:max-w-4xl lg:pb-10 lg:pt-8">
        {/* The marketing navbar carries the language toggle and is suppressed
            here, so without this there is no way to switch inside the app.
            Top-right and small: a setting, not a feature. */}
        <div className="mb-2 flex justify-end">
          <LanguagePicker />
        </div>
        {ready ? children : <div className="h-40 animate-pulse rounded-3xl bg-white/70" aria-hidden />}
      </main>
      <AppNav />
    </div>
  );
}
