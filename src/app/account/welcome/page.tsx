"use client";

// Post-signup welcome slideshow. Replaces the previous in-person /
// online intro PPT with the 8-slide vertical scroll-snap deck.
//
// Canonical landing for every newly signed-up client (B2B or B2C).
// Body composition + the GDPR Art. 9 health-data consent are
// collected LATER, when the user actually activates Biody — not
// as a gate to viewing the deck. So unlike the prior implementation
// the welcome page no longer redirects B2C users away to
// /account/onboard.
//
// Auth still required (bounces to /account/login if no session).
// On completion (user reaches slide 8) we stamp
// clients.welcome_seen_at so they don't see the deck on every
// future sign-in.

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import WelcomeSlideshow from "../../components/WelcomeSlideshow";

function AccountWelcomePageInner() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [variant, setVariant] = useState<"b2b" | "b2c">("b2c");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/account/login"); return; }

      const { data: client } = await supabase
        .from("clients_decrypted")
        .select("full_name, company_id")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (client) {
        setFirstName((client.full_name || "").split(" ")[0] || "");
        const cid = client.company_id as string | null;
        if (cid) {
          setVariant("b2b");
          const { data: c } = await supabase.from("companies").select("name").eq("id", cid).maybeSingle();
          if (c?.name && !cancelled) setCompanyName(c.name);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const markSeen = async () => {
    // Server-side endpoint that writes the base `clients` table
    // directly, bypassing the clients_decrypted INSTEAD OF UPDATE
    // trigger. The trigger was blanking biody_patient_id (and other
    // non-encrypted columns) on a partial update, which made users
    // who re-watched the slideshow lose their Biody activation
    // state.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      await fetch("/api/account/welcome/seen", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* best-effort, don't block UX */ }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Hleð kynningu…</div>;
  }

  return (
    <WelcomeSlideshow
      variant={variant}
      firstName={firstName || undefined}
      companyName={companyName}
      ctaHref="/account"
      ctaLabel={variant === "b2b" ? "Halda áfram á mælaborðið" : "Halda áfram"}
      onComplete={markSeen}
    />
  );
}

export default function AccountWelcomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Hleð kynningu…</div>}>
      <AccountWelcomePageInner />
    </Suspense>
  );
}
