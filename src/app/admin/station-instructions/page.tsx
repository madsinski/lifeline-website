"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import StationInstructionsView from "@/app/components/StationInstructionsView";
import { DEFAULT_SLUG, type Block, type StationDoc } from "@/lib/station-instructions";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

const ADD_TYPES: { type: Block["type"]; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "subheading", label: "Subheading" },
  { type: "text", label: "Text" },
  { type: "steps", label: "Steps" },
  { type: "note", label: "Note" },
  { type: "image", label: "Image" },
];

function blankBlock(type: Block["type"]): Block {
  if (type === "steps") return { type, items: [""] };
  if (type === "image") return { type, src: "", caption: "" };
  return { type, text: "" } as Block;
}

export default function StationInstructionsAdmin() {
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [published, setPublished] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      const res = await fetch(`/api/admin/station-instructions?slug=${DEFAULT_SLUG}`, { headers: await authHeaders() });
      const j = await res.json().catch(() => ({}));
      setTitle(j.title || "");
      setIntro(j.doc?.intro || "");
      setBlocks((j.doc?.blocks as Block[]) || []);
      setPublished(!!j.is_published);
      setLoaded(true);
    })();
  }, []);

  const updateBlock = (i: number, b: Block) => setBlocks((prev) => prev.map((x, ix) => (ix === i ? b : x)));
  const move = (i: number, dir: -1 | 1) => setBlocks((prev) => {
    const j = i + dir; if (j < 0 || j >= prev.length) return prev;
    const c = [...prev]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  const remove = (i: number) => setBlocks((prev) => prev.filter((_, ix) => ix !== i));
  const add = (type: Block["type"]) => setBlocks((prev) => [...prev, blankBlock(type)]);

  async function uploadImage(i: number, file: File) {
    setUploadingIdx(i);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `station-instructions/${DEFAULT_SLUG}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("presentation-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("presentation-assets").getPublicUrl(path);
      updateBlock(i, { ...(blocks[i] as Extract<Block, { type: "image" }>), src: data.publicUrl });
    } catch (e) {
      alert("Upload failed: " + (e instanceof Error ? e.message : "error"));
    } finally {
      setUploadingIdx(null);
    }
  }

  async function persist() {
    setSave("saving");
    const doc: StationDoc = { title, intro, blocks };
    try {
      const res = await fetch("/api/admin/station-instructions", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ slug: DEFAULT_SLUG, title, doc, is_published: published }),
      });
      setSave(res.ok ? "saved" : "error");
    } catch { setSave("error"); }
  }

  if (!loaded) return <div className="p-8 text-gray-400">Loading…</div>;

  const publicUrl = `${origin}/leidbeiningar/${DEFAULT_SLUG}`;
  const previewDoc: StationDoc = { title, intro, blocks };

  return (
    <div className="px-6 py-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-gray-900">Station instructions</h1>
          <p className="text-sm text-gray-500">Measurement-station guide — editable, shareable, printable.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published (public link live)
        </label>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Open link ↗</a>
        <button
          onClick={async () => { try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >{copied ? "Copied!" : "Copy link"}</button>
        <button onClick={persist} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
          {save === "saving" ? "Saving…" : save === "saved" ? "Saved ✓" : save === "error" ? "Save failed" : "Save"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Editor */}
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Intro</label>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          {blocks.map((b, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{b.type}</span>
                <div className="flex items-center gap-1 text-gray-400">
                  <button onClick={() => move(i, -1)} className="px-1.5 hover:text-gray-700">↑</button>
                  <button onClick={() => move(i, 1)} className="px-1.5 hover:text-gray-700">↓</button>
                  <button onClick={() => remove(i)} className="px-1.5 hover:text-red-500">✕</button>
                </div>
              </div>

              {(b.type === "heading" || b.type === "subheading" || b.type === "text" || b.type === "note") && (
                <textarea
                  value={b.text}
                  onChange={(e) => updateBlock(i, { ...b, text: e.target.value })}
                  rows={b.type === "text" || b.type === "note" ? 3 : 1}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              )}

              {b.type === "steps" && (
                <textarea
                  value={b.items.join("\n")}
                  onChange={(e) => updateBlock(i, { ...b, items: e.target.value.split("\n") })}
                  rows={Math.max(3, b.items.length)}
                  placeholder="One step per line"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              )}

              {b.type === "image" && (
                <div className="space-y-2">
                  {b.src && <img src={b.src} alt="" className="max-h-40 rounded border border-gray-200" />}
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
                      {uploadingIdx === i ? "Uploading…" : b.src ? "Replace image" : "Upload image"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(i, f); }} />
                    </label>
                    <input value={b.src} onChange={(e) => updateBlock(i, { ...b, src: e.target.value })} placeholder="or paste URL / path" className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs" />
                  </div>
                  <input value={b.caption || ""} onChange={(e) => updateBlock(i, { ...b, caption: e.target.value })} placeholder="Caption (optional)" className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs" />
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-gray-300 p-3">
            <span className="self-center text-xs font-medium text-gray-500">Add block:</span>
            {ADD_TYPES.map((t) => (
              <button key={t.type} onClick={() => add(t.type)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">+ {t.label}</button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Preview</div>
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6">
            <StationInstructionsView doc={previewDoc} />
          </div>
        </div>
      </div>
    </div>
  );
}
