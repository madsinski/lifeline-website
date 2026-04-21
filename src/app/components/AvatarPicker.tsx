"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface Props {
  currentUrl: string | null;
  initial: string;
  uploading: boolean;
  error: string | null;
  gradient?: string;
  size?: "sm" | "md" | "lg"; // 12 / 16 / 24 in Tailwind units
  /** Called with the cropped JPEG blob. Parent uploads it. */
  onPicked: (blob: Blob) => void | Promise<void>;
  onError: (message: string) => void;
}

function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|Mobile/i.test(navigator.userAgent);
}

async function blobFromCanvasCrop(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load image for crop"));
    image.src = imageSrc;
  });
  const output = 512; // final square output size
  const canvas = document.createElement("canvas");
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, output, output);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas encoded blob is empty"))),
      "image/jpeg",
      0.9,
    ),
  );
}

export default function AvatarPicker({
  currentUrl, initial, uploading, error, gradient, size = "md", onPicked, onError,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const sizeClass = size === "sm" ? "w-12 h-12 text-lg" : size === "lg" ? "w-24 h-24 text-3xl" : "w-16 h-16 text-2xl";

  // ─── Menu ──────────────────────────────────────────────────
  function openMenu() {
    if (uploading) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 8, left: rect.left });
    setMenuOpen(true);
  }

  function pickFromLibrary() {
    setMenuOpen(false);
    libraryInputRef.current?.click();
  }

  function pickFromCamera() {
    setMenuOpen(false);
    if (isMobileUserAgent()) {
      // On mobile, the native camera via <input capture> gives a much better UX
      // than an in-browser getUserMedia modal.
      mobileCameraInputRef.current?.click();
    } else {
      setCameraOpen(true);
    }
  }

  // ─── File → crop handoff ──────────────────────────────────
  function onFilePicked(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { onError("Please choose an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { onError("Image is larger than 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(typeof reader.result === "string" ? reader.result : null);
      setCropPos({ x: 0, y: 0 });
      setCropZoom(1);
    };
    reader.readAsDataURL(file);
  }

  // ─── Live camera (desktop) ─────────────────────────────────
  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    setCameraError(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access isn't supported in this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        const msg = (e as Error).message || "Could not open the camera.";
        // NotAllowedError is the most common — permission denied
        setCameraError(
          msg.includes("Permission") || msg.includes("Denied") || msg.includes("NotAllowed")
            ? "Camera access was denied. Allow it in the browser's site settings and try again."
            : msg,
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  function takeSnapshot() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) { setCameraError("Camera didn't warm up yet — try again."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror so the preview and the snapshot match (selfie convention)
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    // Stop the stream immediately — we have the frame
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCropImage(dataUrl);
    setCropPos({ x: 0, y: 0 });
    setCropZoom(1);
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  // ─── Confirm crop → upload ─────────────────────────────────
  const onCropComplete = useCallback((_area: Area, areaPx: Area) => setCroppedArea(areaPx), []);

  async function confirmCrop() {
    if (!cropImage || !croppedArea) return;
    setSaving(true);
    try {
      const blob = await blobFromCanvasCrop(cropImage, croppedArea);
      await onPicked(blob);
      setCropImage(null);
    } catch (e) {
      onError((e as Error).message || "Could not crop image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shrink-0 relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={openMenu}
        className="relative block group"
        aria-label="Change profile photo"
      >
        <div className={`${sizeClass} rounded-full overflow-hidden bg-gradient-to-br ${gradient || "from-[#3B82F6] to-[#10B981]"} text-white font-bold flex items-center justify-center shadow-sm`}>
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        {(uploading || saving) && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/60">
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center text-gray-600">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </span>
      </button>

      {/* Hidden file inputs */}
      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onFilePicked(f ?? undefined); }}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onFilePicked(f ?? undefined); }}
      />

      {/* Menu */}
      {menuOpen && menuPos && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            className="fixed z-50 w-56 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              onClick={pickFromCamera}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 text-left"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take photo
            </button>
            <button
              type="button"
              onClick={pickFromLibrary}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 text-left border-t border-gray-100"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload from device
            </button>
          </div>
        </>
      )}

      {/* Camera modal (desktop) */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={closeCamera}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Take a photo</h3>
              <button onClick={closeCamera} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
            </div>
            <div className="relative bg-black aspect-square">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                  <div>
                    <p className="text-white text-sm mb-3">{cameraError}</p>
                    <button
                      onClick={() => { setCameraError(null); setCameraOpen(false); setTimeout(() => setCameraOpen(true), 10); }}
                      className="px-4 py-2 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 flex gap-2 justify-end">
              <button onClick={closeCamera} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={takeSnapshot}
                disabled={!!cameraError}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#10B981] text-white text-sm font-semibold disabled:opacity-40"
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {cropImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => !saving && setCropImage(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Crop photo</h3>
              <button onClick={() => !saving && setCropImage(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
            </div>
            <div className="relative bg-gray-900 aspect-square">
              <Cropper
                image={cropImage}
                crop={cropPos}
                zoom={cropZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCropPos}
                onZoomChange={setCropZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 8v6m-3-3h6" />
              </svg>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={cropZoom}
                onChange={(e) => setCropZoom(Number(e.target.value))}
                className="flex-1 accent-emerald-500"
                aria-label="Zoom"
              />
            </div>
            <div className="p-4 flex gap-2 justify-end border-t border-gray-100">
              <button onClick={() => setCropImage(null)} disabled={saving} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={confirmCrop}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#10B981] text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? "Saving…" : "Save photo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="mt-1.5 text-[11px] text-red-600 max-w-[180px]">{error}</div>}
    </div>
  );
}
