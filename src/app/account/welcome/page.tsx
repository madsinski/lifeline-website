"use client";

// Post-signup welcome slideshow. Replaces the previous static
// hero+text+team-photo welcome page with the 8-slide vertical
// scroll-snap deck that mirrors what the in-person intro
// presentation used to cover.
//
// Behaviour preserved from the previous implementation:
//   - Auth required (bounces to /account/login if no session).
//   - B2C clients (no company_id) are redirected to /account/onboard
//     where the existing onboarding wizard handles their flow.
//   - On completion (user reaches slide 8) we stamp
//     clients.welcome_seen_at so they are not shown the deck again.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import WelcomeSlideshow from "../../components/WelcomeSlideshow";

export default function AccountWelcomePage() {
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
      // B2C users without a company go through the onboarding wizard,
      // not this welcome deck. The deck assumes assessment is already
      // booked / company-scheduled.
      if (client && !client.company_id) {
        router.replace("/account/onboard");
        return;
      }
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("clients_decrypted")
          .update({ welcome_seen_at: new Date().toISOString() })
          .eq("id", user.id);
      }
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
