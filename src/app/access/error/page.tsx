// Error-display page for /access/claim. The claim route redirects here
// with ?reason=… when a token can't be used. Successful claims redirect
// straight to / instead — the proxy then lets the freshly-set cookie
// through, so there's no "you're in!" page.

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

const MESSAGES: Record<string, string> = {
  missing: "No token in the link. Ask whoever sent you for a fresh one.",
  not_found_or_inactive: "That access link doesn't exist or has been revoked.",
  expired: "That access link has expired.",
  exhausted: "That access link has been used up.",
  invalid: "That access link couldn't be used.",
};

export default async function ClaimErrorPage({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  const msg = (reason && MESSAGES[reason]) || MESSAGES.invalid;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-6">
      <div className="max-w-md text-center bg-white rounded-2xl shadow-sm p-8 space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Access link not valid</h1>
        <p className="text-sm text-gray-600">{msg}</p>
        <p className="text-xs text-gray-400">
          If you need access, contact{" "}
          <a href="mailto:contact@lifelinehealth.is" className="text-blue-600 hover:underline">
            contact@lifelinehealth.is
          </a>.
        </p>
      </div>
    </div>
  );
}
