"use client";

// Archived documents view. "Eyða" in the studio soft-deletes into
// content.archived; here they can be restored or permanently removed. Shared by
// the admin studio and the token-gated external editor (auth via onSave prop).

import { useState } from "react";
import type { CollateralContent, ArchivedDoc, Doc } from "./content";
import type { SaveResult } from "./CollateralStudio";

const TYPE_LABEL: Record<string, string> = {
  poster: "Veggspjald",
  referral: "Tilvísunarleiðbeiningar",
  advert: "Blaðaauglýsing",
};

function fmt(iso?: string) {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  const t = iso.slice(11, 16);
  return `${d} ${t}`;
}

export function CollateralArchive({
  initial,
  onSave,
  backHref,
}: {
  initial: CollateralContent;
  onSave: (content: CollateralContent) => Promise<SaveResult>;
  backHref: string;
}) {
  const [content, setContent] = useState<CollateralContent>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const archived = content.archived ?? [];

  async function persist(next: CollateralContent) {
    setContent(next);
    setBusy(true);
    setMsg(null);
    try {
      const r = await onSave(next);
      setMsg(r.ok ? "Vistað ✓" : r.error === "mfa_required" ? "Þarft MFA til að vista." : `Villa: ${r.error ?? "óþekkt"}`);
    } catch {
      setMsg("Netvilla — reyndu aftur.");
    } finally {
      setBusy(false);
    }
  }

  function restore(i: number) {
    const a = archived[i];
    const rest: Record<string, unknown> = { ...a };
    delete rest.archivedAt;
    persist({
      ...content,
      docs: [...content.docs, rest as Doc],
      archived: archived.filter((_, j) => j !== i),
    });
  }

  function remove(i: number) {
    if (!window.confirm("Eyða endanlega? Þetta er ekki hægt að afturkalla.")) return;
    persist({ ...content, archived: archived.filter((_, j) => j !== i) });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <a href={backHref} className="text-sm text-gray-400 hover:text-emerald-700">← Til baka í ritil</a>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Geymsla</h1>
          <p className="text-sm text-gray-500">Skjöl sem hefur verið eytt. Endurheimtu þau eða eyddu endanlega.</p>
        </div>
        {msg && <span className="text-sm text-gray-500">{busy ? "Vista…" : msg}</span>}
      </div>

      {archived.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-400">
          Engin skjöl í geymslu.
        </div>
      ) : (
        <ul className="space-y-3">
          {archived.map((a: ArchivedDoc, i) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">{a.name || "(nafnlaust)"}</div>
                <div className="text-xs text-gray-500">
                  {TYPE_LABEL[a.type] ?? a.type}
                  {a.archivedAt ? ` · eytt ${fmt(a.archivedAt)}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => restore(i)} disabled={busy}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40">
                  Endurheimta
                </button>
                <button onClick={() => remove(i)} disabled={busy}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                  Eyða endanlega
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
