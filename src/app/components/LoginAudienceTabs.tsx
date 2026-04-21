"use client";

import Link from "next/link";

// Top-level Personal / Business switcher shown above the login card on
// both /account/login and /business/login so users can swap flows in
// one click. Styling is identical on both pages so the transition
// between them feels seamless.
export default function LoginAudienceTabs({ active }: { active: "personal" | "business" }) {
  const base =
    "flex-1 py-2 px-4 text-sm font-medium rounded-full text-center transition-all duration-200";
  const activeCls = "bg-white text-[#1F2937] shadow-sm";
  const inactiveCls = "text-[#6B7280] hover:text-[#1F2937]";

  return (
    <div className="flex mb-5 bg-[#E2E8F0]/70 rounded-full p-1" role="tablist" aria-label="Account type">
      <Link
        href="/account/login"
        role="tab"
        aria-selected={active === "personal"}
        className={`${base} ${active === "personal" ? activeCls : inactiveCls}`}
      >
        Personal
      </Link>
      <Link
        href="/business/login"
        role="tab"
        aria-selected={active === "business"}
        className={`${base} ${active === "business" ? activeCls : inactiveCls}`}
      >
        Business
      </Link>
    </div>
  );
}
