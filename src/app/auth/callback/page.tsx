"use client";

import { useEffect } from "react";

export default function AuthCallbackPage() {
  useEffect(() => {
    // Authorization code flow: Google returns ?code= in query string
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      const appUrl = `lifelinehealth://auth?code=${encodeURIComponent(code)}`;
      window.location.href = appUrl;
      return;
    }

    // Legacy implicit flow: token in URL fragment (#access_token=...)
    const hash = window.location.hash;
    if (hash) {
      const appUrl = `lifelinehealth://auth${hash}`;
      window.location.href = appUrl;
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ecf0f3]">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600">Connecting to Lifeline Health...</p>
        <p className="text-sm text-gray-400 mt-2">Redirecting back to the app</p>
      </div>
    </div>
  );
}
