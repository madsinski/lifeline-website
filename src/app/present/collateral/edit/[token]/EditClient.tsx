"use client";

import {
  CollateralStudio,
  type SaveResult,
} from "@/app/admin/presentations/collateral/CollateralStudio";
import type { CollateralContent } from "@/app/admin/presentations/collateral/content";

// External editor surface: same studio as admin, but saves through the
// token-gated public API instead of the admin (AAL2) API.
export default function EditClient({
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
    <CollateralStudio
      initial={content}
      onSave={onSave}
      heading="Fjarlækningar — prentefni fyrir HSU"
      subtitle="Breyttu textanum og vistaðu. Breytingar birtast strax á opinberu síðunni."
    />
  );
}
