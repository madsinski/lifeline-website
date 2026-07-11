import type { Metadata } from "next";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { mergeContent } from "@/app/admin/presentations/collateral/content";
import ArchiveClient from "./ArchiveClient";

// Token-gated archive view for the external editor (restore / permanently
// delete documents removed with "Eyða"). Same token as the edit link.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Geymsla — prentefni",
  robots: { index: false, follow: false },
};

async function tokenIsValid(token: string): Promise<boolean> {
  try {
    const hash = createHash("sha256").update(token).digest("hex");
    const { data } = await supabaseAdmin
      .from("presentation_collateral_tokens")
      .select("revoked, expires_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!data || data.revoked) return false;
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchContent() {
  try {
    const { data } = await supabaseAdmin
      .from("presentation_collateral")
      .select("data")
      .eq("id", 1)
      .maybeSingle();
    return mergeContent(data?.data);
  } catch {
    return mergeContent(undefined);
  }
}

function Invalid() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "2rem",
        background: "linear-gradient(135deg,#06231c 0%,#064e3b 55%,#07372b 100%)",
        color: "#eafaf3",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
    >
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: ".6rem" }}>Tengill ekki gildur</h1>
        <p style={{ color: "#bfe7d8", maxWidth: "44ch", margin: "0 auto" }}>
          Þessi tengill er ógildur, útrunninn eða hefur verið afturkallaður.
        </p>
      </div>
    </div>
  );
}

export default async function CollateralArchivePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!(await tokenIsValid(token))) return <Invalid />;
  const content = await fetchContent();
  return <ArchiveClient token={token} content={content} />;
}
