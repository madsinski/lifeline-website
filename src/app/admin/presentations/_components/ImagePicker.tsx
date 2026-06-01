"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EXISTING_IMAGES } from "@/lib/presentations/existing-images";
import type { ImageRole } from "@/lib/presentations/types";

const ROLE_CATEGORIES: Record<ImageRole, string[]> = {
  background: ["Backgrounds", "Editorial"],
  photo: ["Team", "Editorial", "Backgrounds"],
  phone: ["App screenshots"],
};

export function ImagePicker({
  value, role, presentationId, onChange, onClose,
}: {
  value?: string;
  role: ImageRole;
  presentationId: string;
  onChange: (url: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"existing" | "upload" | "url">("existing");
  const [urlInput, setUrlInput] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preferred = ROLE_CATEGORIES[role];
  const images = useMemo(
    () => [...EXISTING_IMAGES].sort((a, b) => preferred.indexOf(a.category) - preferred.indexOf(b.category)),
    [preferred]
  );

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${presentationId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("presentation-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("presentation-assets").getPublicUrl(path);
      onChange(data.publicUrl);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="font-semibold text-gray-800">Choose image</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex gap-1 px-5 pt-3">
          {(["existing", "upload", "url"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {t === "existing" ? "Pick existing" : t === "upload" ? "Upload" : "Paste URL"}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-auto p-5">
          {tab === "existing" && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((img) => (
                <button
                  key={img.url}
                  onClick={() => { onChange(img.url); onClose(); }}
                  className={`group overflow-hidden rounded-lg border text-left ${value === img.url ? "border-emerald-500 ring-2 ring-emerald-200" : "border-gray-200 hover:border-emerald-300"}`}
                  title={img.label}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.label} className="h-24 w-full object-cover" />
                  <div className="truncate px-2 py-1 text-[11px] text-gray-500">{img.label}</div>
                </button>
              ))}
            </div>
          )}

          {tab === "upload" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <label className="cursor-pointer rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                {uploading ? "Uploading…" : "Select an image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                />
              </label>
              <p className="text-xs text-gray-400">PNG, JPG or WebP. Stored in the presentation-assets bucket.</p>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {tab === "url" && (
            <div className="flex flex-col gap-3 py-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://… or /path-in-public.jpg"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              {urlInput && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={urlInput} alt="preview" className="max-h-40 rounded-md border border-gray-200 object-contain" />
              )}
              <div className="flex justify-end gap-2">
                {value && <button onClick={() => { onChange(""); onClose(); }} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">Clear</button>}
                <button onClick={() => { onChange(urlInput.trim()); onClose(); }} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Use this URL</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
