"use client";

import Image from "next/image";
import { useState } from "react";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body?.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
      setEmail("");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  return (
    <>
      <style>{`
        html, body { overflow: hidden; overscroll-behavior: none; height: 100%; }
      `}</style>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-white px-6 py-10 overscroll-none">
        {/* Top spacer */}
        <div className="flex-1" />

        {/* Center block */}
        <div className="flex flex-col items-center max-w-md w-full">
          <Image
            src="/lifeline-logo-rebrand.svg"
            alt="Lifeline Health"
            width={220}
            height={60}
            priority
            style={{ transform: "translateX(20px)" }}
          />
          <h1 className="mt-10 text-2xl font-semibold text-gray-900 tracking-tight">
            Coming Soon
          </h1>
          <p className="mt-3 text-gray-500 text-center">
            We&apos;re building something great. Be the first to know when we launch.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 w-full flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={status === "submitting" || status === "success"}
              className="flex-1 px-4 py-3 rounded-full border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "submitting" || status === "success"}
              className="px-6 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-full hover:bg-emerald-700 transition-all duration-200 whitespace-nowrap disabled:opacity-60"
            >
              {status === "submitting" ? "…" : status === "success" ? "Thanks!" : "Notify me"}
            </button>
          </form>

          {status === "success" && (
            <p className="mt-3 text-sm text-emerald-600">
              You&apos;re on the list. We&apos;ll be in touch.
            </p>
          )}
          {status === "error" && (
            <p className="mt-3 text-sm text-red-600">{errorMsg}</p>
          )}
        </div>

        {/* Bottom: contact */}
        <div className="flex-1 flex items-end">
          <a
            href="mailto:contact@lifelinehealth.is"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            contact@lifelinehealth.is
          </a>
        </div>
      </div>
    </>
  );
}
