import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vinnustöð | Lifeline Health",
  robots: { index: false, follow: false },
};

export default function VinnustodLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F4F7F6] text-slate-900">{children}</div>;
}
