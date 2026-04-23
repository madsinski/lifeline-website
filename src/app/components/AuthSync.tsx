"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Cross-tab auth state sync.
//
// Without this: signing out in tab A clears its own localStorage but
// tab B's Supabase client still holds the cached JWT until expiry, and
// getSession() (used on most of our dashboards) doesn't hit the server
// to verify. Tab B keeps rendering as logged-in for up to an hour.
//
// This component listens for two signals:
//   1. In-tab auth state changes via supabase.auth.onAuthStateChange —
//      fires for sign-ins, sign-outs, token refreshes, and USER_UPDATED.
//   2. Cross-tab storage events via window.addEventListener("storage")
//      — fires in other tabs when Supabase writes / clears its entry
//      in localStorage. We check whether the Supabase auth key
//      (sb-<ref>-auth-token) changed meaningfully.
//
// On SIGNED_OUT we hard-reload the current tab. That forces every
// in-memory state (user, route, subscriptions) to re-initialise and
// the page's auth-gate to redirect to /account/login correctly.

const SUPABASE_PROJECT_REF = "cfnibfxzltxiriqxvvru";
const STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

export default function AuthSync() {
  useEffect(() => {
    // Track the last known user id so we can tell sign-outs from
    // routine token refreshes (both show up as auth state changes
    // but only the former should reload the tab).
    let lastUserId: string | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      lastUserId = data?.user?.id || null;
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id || null;
      const wasSignedIn = !!lastUserId;
      const isSignedIn = !!nextUserId;
      const identityChanged = lastUserId !== nextUserId;
      lastUserId = nextUserId;
      if (event === "SIGNED_OUT" || (wasSignedIn && !isSignedIn)) {
        // Full reload — clears all in-memory state, triggers
        // auth-gated pages to redirect cleanly.
        if (typeof window !== "undefined") window.location.reload();
        return;
      }
      if (identityChanged && isSignedIn && wasSignedIn) {
        // Account switched in another tab. Reload so we don't render
        // previous-user data on this tab.
        if (typeof window !== "undefined") window.location.reload();
      }
    });

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== STORAGE_KEY) return;
      // The storage event fires in OTHER tabs when localStorage is
      // written by one of them. Supabase writes a JSON object with
      // access_token + refresh_token + user; it's null (or removed)
      // after signOut. If the value vanished, treat it as SIGNED_OUT
      // regardless of what the in-tab Supabase client thinks.
      const cleared = ev.newValue === null || ev.newValue === "" || ev.newValue === "null";
      if (cleared) {
        if (typeof window !== "undefined") window.location.reload();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
