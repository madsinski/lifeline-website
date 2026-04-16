import Image from "next/image";

export const metadata = {
  title: "Lifeline Health — Coming Soon",
  description: "Comprehensive health assessments and personalised daily coaching. Launching soon.",
};

export default function ComingSoon() {
  return (
    <>
      <style>{`
        html, body { overflow: hidden; overscroll-behavior: none; height: 100%; }
      `}</style>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 overscroll-none">
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
      <p className="mt-3 text-gray-500 text-center max-w-md">
        We&apos;re building something great. Follow our journey and be the first to know when we launch.
      </p>
      <a
        href="mailto:contact@lifelinehealth.is"
        className="mt-8 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
      >
        contact@lifelinehealth.is
      </a>
      </div>
    </>
  );
}
