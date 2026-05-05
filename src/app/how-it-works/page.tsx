"use client";

// Public preview of the onboarding deck. Same component as the
// post-signup /account/welcome page but with no firstName, no
// company personalization, and a sales-ish CTA at the end pointing
// to /pricing rather than the dashboard.
//
// B2B contact persons can share this URL with employees before
// sign-up to replace the in-person intro presentation.

import WelcomeSlideshow from "../components/WelcomeSlideshow";

export default function HowItWorksPage() {
  return (
    <WelcomeSlideshow
      variant="public"
      ctaHref="/pricing"
      ctaLabel="Skoða leiðir til þátttöku"
    />
  );
}
