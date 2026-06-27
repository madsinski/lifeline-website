"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Heroicons v2 outline style, stroke 1.5 for a finer professional line.
// All icons share a single emerald-neutral monochrome palette via currentColor.
const sidebarLinks = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/admin/coach",
    label: "Coach",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    href: "/admin/clients",
    label: "Clients",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    badgeType: "clients" as const,
  },
  {
    href: "/admin/conversations",
    label: "Conversations",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    badge: true,
    badgeType: "feedback" as const,
  },
  {
    href: "/admin/scheduling",
    label: "Scheduling",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
    badgeType: "refund-requests" as const,
  },
  {
    href: "/admin/content",
    label: "Content",
    badgeType: "audit",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    href: "/admin/presentations",
    label: "Presentations",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12a2.25 2.25 0 002.25-2.25V3M3.75 3h16.5M3.75 3H2.25m18 0h1.5m-18 13.5L12 21m0 0l5.25-4.5M12 21V11.25" />
      </svg>
    ),
  },
  {
    href: "/admin/research",
    label: "Research",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    href: "/admin/business",
    label: "Business",
    badgeType: "business",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    href: "/admin/access",
    label: "Access",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    href: "/admin/communication",
    label: "Communication",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: "/admin/legal",
    label: "Legal",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: "/admin/beta",
    label: "Beta",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/releases",
    label: "Releases",
    icon: (
      // Tag / version icon — Heroicons "tag" outline.
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    href: "/admin/surveys",
    label: "Surveys",
    badgeType: "surveys",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    href: "/admin/ai-test-bench",
    label: "AI test bench",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    href: "/admin/ai-feedback",
    label: "AI feedback",
    badgeType: "ai-feedback",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    href: "/admin/errors",
    label: "Error logs",
    badgeType: "errors",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    href: "/admin/wearable-issues",
    label: "Wearable issues",
    badgeType: "wearable-issues",
    icon: (
      // Smartwatch: rounded face with strap nubs top/bottom and a side button.
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <rect x="6" y="6" width="12" height="12" rx="3" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6M9 21h6M18.75 10.5v3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75V12l1.5 1.5" />
      </svg>
    ),
  },
  {
    href: "/admin/action-feedback",
    label: "Action feedback",
    badgeType: "action-feedback",
    icon: (
      // Circle with a slash — "removed from plan" feedback.
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 1 0 5.636 5.636a9 9 0 0 0 12.728 12.728zM5.636 5.636L18.364 18.364" />
      </svg>
    ),
  },
  {
    href: "/admin/onboarding-bench",
    label: "Onboarding bench",
    icon: (
      // Construct / wrench icon — this is a developer-facing bench
      // for inspecting + tuning the new-user flow.
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
      </svg>
    ),
  },
  {
    href: "/admin/wellness-pulse-bench",
    label: "Wellness pulse bench",
    icon: (
      // Heartbeat / sparkline — wellness pulse self-assessment
      // preview. Staff-only test surface; never collects user data.
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h3l3-9 4.5 18 3-9h3.75" />
      </svg>
    ),
  },
  {
    href: "/admin/access-review",
    label: "Access review",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    badge: true,
    badgeType: "access-review" as const,
  },
  {
    href: "/admin/data-requests",
    label: "Privacy requests",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
    badge: true,
    badgeType: "data-requests" as const,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let path = "";
  for (const seg of segments) {
    path += "/" + seg;
    const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
    crumbs.push({ label, href: path });
  }
  return crumbs;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<boolean | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [coachingView, setCoachingView] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("coach");
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [unresolvedFeedbackCount, setUnresolvedFeedbackCount] = useState(0);
  const [pendingRefundRequestsCount, setPendingRefundRequestsCount] = useState(0);
  const [openDsrCount, setOpenDsrCount] = useState(0);
  const [overdueAccessReviewCount, setOverdueAccessReviewCount] = useState(0);
  const [openErrorsCount, setOpenErrorsCount] = useState(0);
  const [openAiFeedbackCount, setOpenAiFeedbackCount] = useState(0);
  const [pendingSurveysCount, setPendingSurveysCount] = useState(0);
  const [newSurveyResponsesCount, setNewSurveyResponsesCount] = useState(0);
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const [newCompaniesCount, setNewCompaniesCount] = useState(0);
  const [untaggedActionsCount, setUntaggedActionsCount] = useState(0);
  const [openWearableIssuesCount, setOpenWearableIssuesCount] = useState(0);
  const [newActionFeedbackCount, setNewActionFeedbackCount] = useState(0);
  const isAdmin = userRole === "admin" || userPermissions.includes("manage_team");
  // Medical advisor gets the full sidebar visibility but is read-only on
  // everything except surveys. Treat them as "view-all" for sidebar
  // filtering, but the strict isAdmin still blocks the coaching-view
  // toggle and other admin-only affordances.
  const canViewAllSections = isAdmin || userRole === "medical_advisor";
  const isReadOnlyView = userRole === "medical_advisor";

  // Coaching-view preference is resolved inside loadStaffProfile once
  // the role is known — we used to read it here on mount, which made
  // the toggle "stick" for users whose role had changed (e.g. coach
  // promoted back to admin still saw the coach sidebar).

  // Per-tab "last visit" timestamps stored in localStorage. Used as
  // the lower bound for the "new since you last looked" badges so they
  // clear when the user opens the page and only re-grow as new
  // activity arrives. Falls back to a 7-day floor so the count never
  // includes ancient items if the tab has never been visited.
  const cutoffFor = useCallback((key: string): string => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (typeof window === "undefined") return sevenDaysAgo;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return sevenDaysAgo;
      return stored > sevenDaysAgo ? stored : sevenDaysAgo;
    } catch { return sevenDaysAgo; }
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const { count: msgCount, error: msgErr } = await supabase
        .from("messages_decrypted")
        .select("*", { count: "exact", head: true })
        .eq("read", false)
        .neq("sender_role", "coach");
      if (!msgErr && msgCount !== null) setUnreadCount(msgCount);
    } catch {}
    try {
      const { count: clientCount, error: clientErr } = await supabase
        .from("clients_decrypted")
        .select("*", { count: "exact", head: true })
        .gte("created_at", cutoffFor("last_seen_clients"));
      if (!clientErr && clientCount !== null) setNewClientsCount(clientCount);
    } catch {}
    try {
      const { count: fbCount, error: fbErr } = await supabase
        .from("beta_feedback")
        .select("*", { count: "exact", head: true })
        .eq("resolved", false);
      if (!fbErr && fbCount !== null) setUnresolvedFeedbackCount(fbCount);
    } catch {}
    try {
      const { count: rrCount, error: rrErr } = await supabase
        .from("refund_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (!rrErr && rrCount !== null) setPendingRefundRequestsCount(rrCount);
    } catch {}
    try {
      const { count: dsrCount, error: dsrErr } = await supabase
        .from("dsr_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["received", "in_progress"]);
      if (!dsrErr && dsrCount !== null) setOpenDsrCount(dsrCount);
    } catch {}
    // Open (unresolved) error events. Counted across the whole table —
    // RLS is admin-only so the query returns 0 for non-admins.
    try {
      const { count: errCount, error: errErr } = await supabase
        .from("app_errors")
        .select("*", { count: "exact", head: true })
        .is("resolved_at", null);
      if (!errErr && errCount !== null) setOpenErrorsCount(errCount);
    } catch {}
    // Open AI recommendation feedback ("doesn't feel right" reports
    // from the app). Counts open + reviewed (i.e. anything not yet
    // applied or dismissed) so escalated patterns stay visible until
    // the prompt/filter is actually tuned.
    try {
      const { count: aifbCount, error: aifbErr } = await supabase
        .from("ai_recommendation_feedback")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "reviewed"]);
      if (!aifbErr && aifbCount !== null) setOpenAiFeedbackCount(aifbCount);
    } catch {}
    // Surveys awaiting approval — admin/medical_advisor needs to
    // review the question structure. Always-on signal (kept for the
    // hub's own status pills, not the sidebar badge).
    try {
      const { count: srvCount, error: srvErr } = await supabase
        .from("feedback_surveys")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval");
      if (!srvErr && srvCount !== null) setPendingSurveysCount(srvCount);
    } catch {}
    // New survey responses since the user last visited /admin/surveys.
    try {
      const { count: respCount, error: respErr } = await supabase
        .from("feedback_assignments")
        .select("*", { count: "exact", head: true })
        .gte("completed_at", cutoffFor("last_seen_surveys"));
      if (!respErr && respCount !== null) setNewSurveyResponsesCount(respCount);
    } catch {}
    // New body-comp + blood-test bookings since last visit to /admin/bookings.
    try {
      const cutoff = cutoffFor("last_seen_bookings");
      const [{ count: bcCount }, { count: btCount }] = await Promise.all([
        supabase.from("body_comp_bookings").select("*", { count: "exact", head: true }).gte("created_at", cutoff),
        supabase.from("blood_test_bookings").select("*", { count: "exact", head: true }).gte("created_at", cutoff),
      ]);
      setNewBookingsCount((bcCount || 0) + (btCount || 0));
    } catch {}
    // New company signups since last visit to /admin/business.
    try {
      const { count: coCount, error: coErr } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .gte("created_at", cutoffFor("last_seen_business"));
      if (!coErr && coCount !== null) setNewCompaniesCount(coCount);
    } catch {}
    // Untagged action library rows — drives /admin/programs/audit
    // attention. Persistent (not last-visit-based): the count only
    // drops when staff actually tag rows. Surfaces under Content
    // since /admin/programs/audit lives under that section.
    try {
      const { count: untaggedCount, error: untaggedErr } = await supabase
        .from("program_actions")
        .select("*", { count: "exact", head: true })
        .is("audited_at", null);
      if (!untaggedErr && untaggedCount !== null) setUntaggedActionsCount(untaggedCount);
    } catch {}
    // Open wearable-setup troubleshooting reports submitted from the
    // in-app "Stuck?" form. Counts open + in_progress so triage stays
    // visible until staff resolve or dismiss the row.
    try {
      const { count: wiCount, error: wiErr } = await supabase
        .from("wearable_setup_issues")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);
      if (!wiErr && wiCount !== null) setOpenWearableIssuesCount(wiCount);
    } catch {}
    // Action-feedback inbox: count "Not for me" dismissals submitted
    // since the staff member last opened the page. Falls back to a
    // 7-day floor (handled inside cutoffFor) so a stale tab doesn't
    // show ancient items.
    try {
      const { count: afCount, error: afErr } = await supabase
        .from("client_action_dismissals")
        .select("*", { count: "exact", head: true })
        .gte("dismissed_at", cutoffFor("last_seen_action_feedback"));
      if (!afErr && afCount !== null) setNewActionFeedbackCount(afCount);
    } catch {}
    // Overdue access reviews: active staff whose most recent review is
    // older than 90 days (or never reviewed and created more than 90 days ago).
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: activeStaff } = await supabase
        .from("staff")
        .select("id, created_at")
        .eq("active", true);
      if (activeStaff && activeStaff.length > 0) {
        const ids = activeStaff.map((s) => s.id);
        const { data: reviews } = await supabase
          .from("staff_access_reviews")
          .select("reviewed_staff_id, reviewed_at")
          .in("reviewed_staff_id", ids)
          .order("reviewed_at", { ascending: false });
        const lastReviewed: Record<string, string> = {};
        for (const r of reviews || []) {
          if (!lastReviewed[r.reviewed_staff_id]) lastReviewed[r.reviewed_staff_id] = r.reviewed_at;
        }
        const overdue = activeStaff.filter((s) => {
          const ref = lastReviewed[s.id] || s.created_at;
          return ref < ninetyDaysAgo;
        }).length;
        setOverdueAccessReviewCount(overdue);
      }
    } catch {}
  }, [cutoffFor]);

  // Stamp last_seen for the tracked tabs whenever the user lands on
  // them, so the count clears immediately and only re-grows as new
  // activity arrives. Maps prefix → localStorage key.
  useEffect(() => {
    const lastSeenMap: Record<string, string> = {
      "/admin/clients": "last_seen_clients",
      "/admin/bookings": "last_seen_bookings",
      "/admin/surveys": "last_seen_surveys",
      "/admin/business": "last_seen_business",
      "/admin/action-feedback": "last_seen_action_feedback",
    };
    let touched = false;
    for (const [prefix, key] of Object.entries(lastSeenMap)) {
      if (pathname.startsWith(prefix)) {
        try { localStorage.setItem(key, new Date().toISOString()); touched = true; } catch {}
      }
    }
    if (touched) loadCounts();
  }, [pathname, loadCounts]);

  useEffect(() => {
    loadCounts();
    const interval = setInterval(loadCounts, 30000);

    // Real-time subscription for instant unread count updates
    const channel = supabase
      .channel("layout-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: Record<string, unknown>) => {
        const msg = payload.new as { sender_role?: string; read?: boolean } | undefined;
        if (msg && msg.sender_role === "client" && !msg.read) {
          setUnreadCount((prev) => prev + 1);
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadCounts]);

  const loadStaffProfile = async (email: string) => {
    try {
      const { data } = await supabase
        .from("staff")
        .select("role, permissions")
        .eq("email", email)
        .eq("active", true)
        .maybeSingle();
      // SECURITY: any auth'd user was previously falling through here
      // when they had no staff row — they'd see the admin shell with
      // empty sidebars and "coach" defaults. Sign them out and bounce
      // to /admin/login.
      if (!data && pathname !== "/admin/login" && pathname !== "/admin/mfa") {
        try { await supabase.auth.signOut(); } catch {}
        router.replace("/admin/login?reason=not_staff");
        return;
      }
      if (data) {
        setUserRole(data.role || "coach");
        setUserPermissions((data.permissions as string[]) || []);
        // External counsel ("lawyer") only ever sees the Legal section.
        // If they land on anything else, bounce them to the drafts viewer.
        if (data.role === "lawyer") {
          setCoachingView(false);
          try { localStorage.removeItem("admin_coaching_view"); } catch {}
          if (typeof window !== "undefined" && pathname && !pathname.startsWith("/admin/legal") && pathname !== "/admin/onboard" && pathname !== "/admin/login" && pathname !== "/admin/mfa") {
            router.replace("/admin/legal/drafts");
          }
          return;
        }
        // Medical advisor: read-everything view of the admin. They see
        // the full sidebar (clients, conversations, scheduling, etc.) but
        // the only writable surface is surveys (approval workflow). Reads
        // are enforced by RLS — see migration-medical-advisor-readonly.sql;
        // writes are blocked at both UI level (read-only banner + button
        // gating) and DB level (UPDATE/INSERT/DELETE policies still
        // exclude is_active_medical_advisor()).
        //
        // Early return — without it the coaching-view resolver below
        // was treating them as a non-admin and locking them into the
        // narrow coach sidebar.
        if (data.role === "medical_advisor") {
          setCoachingView(false);
          try { localStorage.removeItem("admin_coaching_view"); } catch {}
          return;
        }
        // Resolve the coaching-view preference:
        //   - Non-admins (no manage_team) are locked into coaching view
        //     and any stale localStorage value is cleared.
        //   - Admins respect their saved preference (default: admin view).
        const hasManageTeam = (data.permissions as string[])?.includes("manage_team");
        const adminLevel = data.role === "admin" || hasManageTeam;
        if (!adminLevel) {
          setCoachingView(true);
          try { localStorage.removeItem("admin_coaching_view"); } catch {}
        } else {
          try {
            const saved = localStorage.getItem("admin_coaching_view");
            setCoachingView(saved === "true");
          } catch {
            setCoachingView(false);
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    // Server-verify with getUser() so tokens revoked in other tabs
    // (signOut in tab A, this is tab B) don't leave the admin UI
    // falsely rendered. Only fall through to getSession() once the
    // server has confirmed the user is still active.
    (async () => {
      const { data: { user: verifiedUser } } = await supabase.auth.getUser();
      if (!verifiedUser) {
        setSession(false);
        if (pathname !== "/admin/login") router.push("/admin/login");
        return;
      }
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s) {
        // NOTE: setSession(true) is deliberately deferred until after the
        // MFA gate below. Granting render here flashes the full admin UI
        // for the redirect round-trip to /admin/mfa.
        setUserEmail(s.user?.email ?? null);
        if (s.user?.email) loadStaffProfile(s.user.email);

        // Look up role inline before the MFA gate — loadStaffProfile is
        // async and writes to state, but we need the role *now* to decide
        // whether to enforce AAL2.
        let inlineRole: string | null = null;
        if (s.user?.email) {
          try {
            const { data: roleRow } = await supabase
              .from("staff")
              .select("role")
              .eq("email", s.user.email)
              .eq("active", true)
              .maybeSingle();
            inlineRole = (roleRow?.role as string | undefined) ?? null;
          } catch { /* fall through */ }
        }

        // Admins get the coming-soon bypass cookie so they can browse the
        // public marketing site without the splash. The gate is cosmetic
        // (see src/middleware.ts) — this reuses its existing `site_preview`
        // bypass, so production stays gated for everyone except logged-in
        // admins. 30-day cookie; refreshed on every admin page load.
        if (inlineRole === "admin") {
          document.cookie = `site_preview=lifelinepreview2026; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        }

        // MFA gate. Admins/clinicians/coaches handle patient data — they
        // need a TOTP-verified session (AAL2). External counsel (lawyer)
        // only ever sees /admin/legal/*, which contains zero patient data,
        // so we skip MFA for that role to keep the review experience
        // friction-free. Signoff non-repudiation comes from the
        // authenticated session + IP + sha256 + PDF certificate stored in
        // legal_review_signoffs, not from AAL2.
        //
        // Medical advisor still requires MFA — they read survey responses
        // which can include identifying open-text quotes from clients.
        if (inlineRole !== "lawyer") {
          try {
            const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const totpFactors = factorsData?.totp || [];
            const hasFactor = totpFactors.some((f) => f.status === "verified");
            const needsMfa = pathname !== "/admin/mfa" && pathname !== "/admin/login";
            if (needsMfa) {
              if (!hasFactor) {
                router.replace("/admin/mfa?mode=enroll");
                return;
              }
              if (aalData?.currentLevel !== "aal2") {
                router.replace("/admin/mfa?mode=challenge");
                return;
              }
            }
          } catch {
            // MFA endpoints missing or network blip — fall through to the
            // rest of the layout so we never hard-lock out a legit admin.
          }
        }

        // Only now — after the AAL2/MFA gate has decided no redirect is
        // needed — is the admin shell allowed to render. The spinner
        // stays up for sessions that are about to be bounced to MFA.
        setSession(true);

        // Staff e-signature gate: if this user has any outstanding
        // required agreement (NDA / þagnarskylda / acceptable use /
        // data-protection briefing) they land on /admin/onboard until
        // all of them are signed at the current version. /admin/login
        // and /admin/onboard itself are exempt so we don't loop.
        // Lawyer = external counsel — they're the ones reviewing these
        // documents, so they can't sign them as click-throughs (chicken-
        // and-egg). Skip the gate entirely for them.
        // Medical advisor obligations are handled in their engagement
        // letter, similar to lawyer; skip the in-app gate.
        if (inlineRole !== "lawyer" && inlineRole !== "medical_advisor" && pathname !== "/admin/onboard" && pathname !== "/admin/login" && pathname !== "/admin/mfa") {
          try {
            const token = s.access_token;
            const res = await fetch("/api/admin/staff/me/agreements", {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const j = await res.json().catch(() => ({}));
            if (res.ok && j?.ok && Array.isArray(j.pending) && j.pending.length > 0) {
              router.replace("/admin/onboard");
            }
          } catch {
            // Gate is best-effort — don't block the page on network blips.
          }
        }
      } else {
        setSession(false);
        if (pathname !== "/admin/login") router.push("/admin/login");
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        // Deliberately NOT setSession(true) here: SIGNED_IN fires before
        // the AAL2/MFA gate above has run, and granting render here
        // flashes the admin UI pre-MFA. The pathname-keyed effect above
        // is the only place that grants render, after the gate. This
        // handler only keeps profile state fresh.
        setUserEmail(s.user?.email ?? null);
        if (s.user?.email) loadStaffProfile(s.user.email);
      } else {
        setSession(false);
        if (pathname !== "/admin/login") {
          router.push("/admin/login");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  // Idle-session timeout. Admins can see patient data, so if the tab
  // is left open and unattended we force a re-auth. Any mouse move /
  // key press / click resets the clock; 30 minutes of silence signs
  // out. Login + MFA pages are exempt so we don't kick people during
  // enrollment.
  useEffect(() => {
    if (pathname === "/admin/login" || pathname === "/admin/mfa") return;
    const IDLE_MS = 30 * 60 * 1000; // 30 minutes
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
        router.replace("/admin/login?reason=idle");
      }, IDLE_MS);
    };
    const events: (keyof DocumentEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    for (const ev of events) document.addEventListener(ev, reset, { passive: true });
    reset();
    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of events) document.removeEventListener(ev, reset);
    };
  }, [pathname, router]);

  if (pathname === "/admin/login" || pathname === "/admin/mfa") {
    return <div className="min-h-screen bg-gray-100">{children}</div>;
  }

  if (session === null || !session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B981]" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const breadcrumbs = getBreadcrumbs(pathname);
  const initials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : "AD";

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? "w-16" : "w-64"
        } bg-[#1F2937] text-white flex flex-col transition-all duration-200 flex-shrink-0`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
          {!sidebarCollapsed && (
            <span className="text-lg font-bold tracking-tight">
              Lifeline <span className="text-[#10B981]">{coachingView ? "Coach" : "Admin"}</span>
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded hover:bg-gray-700 transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className={`px-4 py-3 border-b border-gray-700 flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{userEmail ?? "Admin"}</p>
              <p className="text-xs text-gray-400">{isAdmin ? (coachingView ? "Health Coach" : "Administrator") : userRole.charAt(0).toUpperCase() + userRole.slice(1)}</p>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {(userRole === "lawyer"
            // External counsel: only Legal section visible. Everything else
            // hidden — no clients, no messages, no scheduling, no business.
            ? sidebarLinks.filter((l) => l.href === "/admin/legal" || l.href.startsWith("/admin/legal/"))
            : coachingView
            ? sidebarLinks.filter((l) => ["/admin/coach", "/admin/clients", "/admin/conversations", "/admin/scheduling", "/admin/content"].includes(l.href))
            : sidebarLinks
          ).filter((link) => {
            // Admin-only sections are visible to admin OR medical_advisor
            // (medical_advisor reads everywhere; writes are gated separately).
            if (link.href === "/admin/settings" && !canViewAllSections) return false;
            if (link.href === "/admin/business" && !canViewAllSections) return false;
            if (link.href === "/admin/communication" && !canViewAllSections) return false;
            if (link.href === "/admin/data-requests" && !canViewAllSections) return false;
            if (link.href === "/admin/access-review" && !canViewAllSections) return false;
            if (link.href === "/admin/errors" && !canViewAllSections) return false;
            if (link.href === "/admin/wearable-issues" && !canViewAllSections) return false;
            if (link.href === "/admin/action-feedback" && !canViewAllSections) return false;
            if (link.href === "/admin/onboarding-bench" && !canViewAllSections) return false;
            if (link.href === "/admin/wellness-pulse-bench" && !canViewAllSections) return false;
            if (link.href === "/admin/ai-feedback" && !canViewAllSections) return false;
            if (link.href === "/admin/ai-test-bench" && !canViewAllSections) return false;
            if (link.href === "/admin/analytics" && !userPermissions.includes("view_analytics") && !canViewAllSections) return false;
            if (link.href === "/admin/content" && !userPermissions.includes("manage_programs") && !canViewAllSections) return false;
            return true;
          }).map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            const badgeType = (link as any).badgeType as string | undefined;
            const isMessageBadge = 'badge' in link && (link as any).badge;
            const badgeCount =
              badgeType === "clients" ? newClientsCount
              : badgeType === "feedback" ? unresolvedFeedbackCount
              // Bookings combines refund-requests + new bookings of any
              // kind in the last 7 days, since both land on the same page.
              : badgeType === "refund-requests" ? pendingRefundRequestsCount + newBookingsCount
              : badgeType === "data-requests" ? openDsrCount
              : badgeType === "access-review" ? overdueAccessReviewCount
              : badgeType === "errors" ? openErrorsCount
              : badgeType === "ai-feedback" ? openAiFeedbackCount
              // Surveys badge counts only new completed responses in
              // the last 7 days. Pending-approval state is more of an
              // editorial signal and gets its own treatment inside the
              // surveys hub itself.
              : badgeType === "surveys" ? newSurveyResponsesCount
              : badgeType === "business" ? newCompaniesCount
              : badgeType === "audit" ? untaggedActionsCount
              : badgeType === "wearable-issues" ? openWearableIssuesCount
              : badgeType === "action-feedback" ? newActionFeedbackCount
              : isMessageBadge ? unreadCount
              : 0;
            const hasBadge = badgeCount > 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/10 text-white ring-1 ring-white/10 shadow-[inset_3px_0_0_0_#10B981]"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
                title={sidebarCollapsed ? link.label : undefined}
              >
                {link.icon}
                {!sidebarCollapsed && (
                  <span className="flex items-center gap-2">
                    {link.label}
                    {hasBadge && (
                      <span className="bg-[#10B981] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {badgeCount}
                      </span>
                    )}
                  </span>
                )}
                {sidebarCollapsed && hasBadge && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#10B981] rounded-full" />
                )}
              </Link>
            );
          })}
          {/* Divider */}
          <div className={`my-2 mx-3 border-t border-gray-700`} />

          {/* Coaching view toggle — admin only */}
          {isAdmin && (
            <button
              onClick={() => {
                const next = !coachingView;
                setCoachingView(next);
                try { localStorage.setItem("admin_coaching_view", String(next)); } catch {}
                if (next && pathname === "/admin") {
                  router.push("/admin/coach");
                } else if (!next && pathname === "/admin/coach") {
                  router.push("/admin");
                }
              }}
              className={`flex items-center w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              } ${coachingView ? "bg-[#10B981]/15 text-[#10B981]" : "text-gray-400 hover:bg-gray-700 hover:text-white"}`}
              title={sidebarCollapsed ? (coachingView ? "Switch to Admin view" : "Switch to Coaching view") : undefined}
            >
              {!sidebarCollapsed ? (
                <span>{coachingView ? "Coaching view" : "Admin view"}</span>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              )}
              {!sidebarCollapsed && (
                <span className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${coachingView ? "bg-[#10B981]" : "bg-gray-600"}`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${coachingView ? "translate-x-5" : "translate-x-0"}`} />
                </span>
              )}
            </button>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-[#1F2937]">
              {sidebarLinks.find(
                (l) =>
                  l.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(l.href)
              )?.label || "Admin"}
            </h1>
            {/* Breadcrumbs */}
            {breadcrumbs.length > 1 && (
              <div className="hidden md:flex items-center gap-1 text-sm text-gray-400 ml-2">
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.href} className="flex items-center gap-1">
                    {i > 0 && <span>/</span>}
                    {i === breadcrumbs.length - 1 ? (
                      <span className="text-gray-600 font-medium">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="hover:text-[#10B981] transition-colors">
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Notification bell with count */}
            <Link href="/admin/messages" className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50" title={unreadCount > 0 ? `${unreadCount} unread messages` : "No new notifications"}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-[#1F2937] transition-colors"
            >
              View Site
            </Link>
          </div>
        </header>

        {/* Read-only banner for medical_advisor */}
        {isReadOnlyView && pathname && !pathname.startsWith("/admin/surveys") && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-900 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth={2} />
            </svg>
            <span>
              <strong>Read-only view.</strong> Edit affordances are disabled. You can browse every section but only edit content under <Link href="/admin/surveys" className="underline font-medium">/admin/surveys</Link>.
            </span>
          </div>
        )}

        {/* Page content. The .readonly-locked class is picked up by
            globals.css to disable every form-write affordance for
            medical_advisor outside /admin/surveys — defense in depth
            on top of the API-level isStaff() role check. */}
        <main
          className={`flex-1 overflow-y-auto p-6 ${
            isReadOnlyView && pathname && !pathname.startsWith("/admin/surveys")
              ? "readonly-locked"
              : ""
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
