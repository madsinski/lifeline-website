"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { supabase } from "@/lib/supabase";

// Upload + crop control for CMS image fields (the phone/laptop mockup
// screenshots). Pick a file → crop to the mockup's aspect ratio → upload the
// cropped JPEG to the shared assets bucket → store the public URL. A URL can
// still be pasted directly for anyone who prefers that.

// Longest edge of the exported crop. Keeps screenshots crisp without bloating.
const MAX_EDGE = 1400;

async function cropToBlob(imageSrc: string, crop: Area, aspect: number): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Gat ekki hlaðið mynd til að skera til"));
    image.src = imageSrc;
  });
  const [w, h] = aspect >= 1 ? [MAX_EDGE, Math.round(MAX_EDGE / aspect)] : [Math.round(MAX_EDGE * aspect), MAX_EDGE];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Tóm mynd"))), "image/jpeg", 0.9),
  );
}

export default function ImageUploadCrop({
  value,
  fallback,
  aspect,
  disabled,
  onChange,
}: {
  value: string;
  fallback: string;
  /** width / height of the target frame (phone ≈ 0.48, laptop 1.6). */
  aspect: number;
  disabled: boolean;
  onChange: (url: string) => void;
}) {
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const shown = value.trim() || fallback;
  const portrait = aspect < 1;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Veldu myndaskrá."); return; }
    if (file.size > 15 * 1024 * 1024) { setErr("Myndin er stærri en 15 MB."); return; }
    setErr(null);
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(typeof reader.result === "string" ? reader.result : null);
      setCropPos({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_a: Area, px: Area) => setArea(px), []);

  const confirm = async () => {
    if (!cropImage || !area) return;
    setBusy(true);
    setErr(null);
    try {
      const blob = await cropToBlob(cropImage, area, aspect);
      const path = `website/${Date.now()}-${Math.round(area.width)}x${Math.round(area.height)}.jpg`;
      const { error } = await supabase.storage
        .from("presentation-assets")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("presentation-assets").getPublicUrl(path);
      onChange(data.publicUrl);
      setCropImage(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upphleðsla mistókst");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {/* Preview at the target aspect */}
        <div
          className={`shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200 ${portrait ? "w-12" : "w-24"}`}
          style={{ aspectRatio: `${aspect}` }}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <label className={`rounded-md px-3 py-1.5 text-sm font-medium ${disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#10B981] text-white hover:bg-[#047857] cursor-pointer"}`}>
              Hlaða upp & skera til
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={disabled}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onFile(f ?? undefined); }}
              />
            </label>
            {value.trim() && !disabled && (
              <button type="button" onClick={() => onChange("")} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">Fjarlægja</button>
            )}
          </div>
          {/* Direct path/URL still allowed */}
          <input
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fallback || "/mynd.png eða https://…"}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-emerald-200 outline-none disabled:bg-gray-50"
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
      </div>

      {/* Crop modal */}
      {cropImage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onClick={() => !busy && setCropImage(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Skera til mynd</h3>
              <button onClick={() => !busy && setCropImage(null)} className="text-gray-400 hover:text-gray-600" aria-label="Loka">✕</button>
            </div>
            <div className="relative bg-gray-900" style={{ height: "60vh" }}>
              <Cropper
                image={cropImage}
                crop={cropPos}
                zoom={zoom}
                aspect={aspect}
                showGrid
                onCropChange={setCropPos}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 8v6m-3-3h6" /></svg>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-emerald-500" aria-label="Aðdráttur" />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
              <button onClick={() => setCropImage(null)} disabled={busy} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Hætta við</button>
              <button onClick={confirm} disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#10B981] px-5 py-2 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
                {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {busy ? "Hleð upp…" : "Vista mynd"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
