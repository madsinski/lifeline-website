import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vinnustöð | Lifeline Health",
  robots: { index: false, follow: false },
};

export default function VinnustodLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-hc-page text-hc-ink">{children}</div>;
}
