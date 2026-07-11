"use client";

import { CollateralArchive } from "@/app/admin/presentations/collateral/CollateralArchive";
import type { SaveResult } from "@/app/admin/presentations/collateral/CollateralStudio";
import type { CollateralContent } from "@/app/admin/presentations/collateral/content";

export default function ArchiveClient({
  token,
  content,
}: {
  token: string;
  content: CollateralContent;
}) {
  const onSave = async (data: CollateralContent): Promise<SaveResult> => {
    try {
      const res = await fetch("/api/present/collateral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, data }),
      });
      if (res.ok) return { ok: true };
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error ?? String(res.status) };
    } catch {
      return { ok: false, error: "network" };
    }
  };

  return (
    <CollateralArchive
      initial={content}
      onSave={onSave}
      backHref={`/present/collateral/edit/${token}`}
    />
  );
}
