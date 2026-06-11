"use client";
/* eslint-disable @next/next/no-img-element -- editor thumbnails preview CMS/storage image URLs; plain <img> is intentional. */

import { useRef, useState } from "react";
import {
  SLIDE_SCHEMAS, ICON_OPTIONS,
  type Slide, type FieldDef, type SubFieldDef, type ImageRole,
} from "@/lib/presentations/types";
import { ImagePicker } from "./ImagePicker";

const inputCls = "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

function isScalarList(f: FieldDef): boolean {
  return !!f.itemFields && f.itemFields.length === 1 && f.itemFields[0].key === "value";
}
function isTranslatableSub(sf: SubFieldDef): boolean {
  return (sf.kind === "text" || sf.kind === "textarea") && !sf.noTranslate;
}

function defaultForSub(sf: SubFieldDef): unknown {
  if (sf.kind === "icon") return "target";
  if (sf.kind === "select") return sf.options?.[0]?.value ?? "";
  return "";
}
function defaultItem(f: FieldDef): unknown {
  if (isScalarList(f)) return "";
  const o: Record<string, unknown> = {};
  for (const sf of f.itemFields || []) o[sf.key] = defaultForSub(sf);
  return o;
}

// ---- small controls -------------------------------------------------------
function ImageField({ value, role, presentationId, onChange }: { value?: string; role: ImageRole; presentationId: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-14 w-20 flex-none overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          {value
            ? <img src={value} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">none</div>}
        </div>
        <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          {value ? "Change" : "Choose"}
        </button>
        {value && <button type="button" onClick={() => onChange("")} className="text-xs text-gray-400 hover:text-red-500">Remove</button>}
      </div>
      {open && <ImagePicker value={value} role={role} presentationId={presentationId} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---- highlight-area picker -------------------------------------------------
// Draw / move / resize the report slide's screenshot spotlights directly on
// the image. Value format matches the renderer: one or more "x,y,w,h" rects
// (% of the image) separated by ";".
type Rect = { x: number; y: number; w: number; h: number };
const MAX_HIGHLIGHTS = 3;

function parseRect(v?: string): Rect | null {
  if (!v) return null;
  const n = v.split(/[,\s]+/).filter(Boolean).map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return null;
  const [x, y, w, h] = n;
  return { x, y, w, h };
}
function parseRects(v?: string): Rect[] {
  return (v || "").split(";").map((part) => parseRect(part.trim())).filter((r): r is Rect => !!r);
}
const fmtRect = (r: Rect) => [r.x, r.y, r.w, r.h].map((n) => Math.round(n * 10) / 10).join(",");
const fmtRects = (rs: Rect[]) => rs.map(fmtRect).join("; ");

type DragMode = { idx: number } & (
  | { kind: "draw"; ax: number; ay: number }            // anchor corner (start point)
  | { kind: "move"; dx: number; dy: number; w: number; h: number } // pointer offset within rect
  | { kind: "resize"; ax: number; ay: number }           // anchor = opposite corner
);

function HighlightAreaField({ value, image, onChange }: { value?: string; image?: string; onChange: (v: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragMode | null>(null);
  const rects = parseRects(value);

  if (!image) return <p className="text-[11px] text-gray-400">Add a screenshot first, then select the area to highlight here.</p>;

  function pct(e: React.PointerEvent): { x: number; y: number } {
    const b = boxRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - b.left) / b.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - b.top) / b.height) * 100)),
    };
  }
  function commitAt(idx: number, r: Rect) {
    const copy = rects.slice();
    copy[idx] = r;
    onChange(fmtRects(copy));
  }
  function removeAt(idx: number) {
    onChange(fmtRects(rects.filter((_, i) => i !== idx)));
  }

  function fromCorners(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(1, Math.abs(a.x - b.x)), h: Math.max(1, Math.abs(a.y - b.y)) };
  }

  function onDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = pct(e);
    const t = e.target as HTMLElement;
    if (t.dataset.handle) {
      // "corner:index" — anchor at the corner opposite the grabbed handle
      const [corner, is] = t.dataset.handle.split(":");
      const idx = Number(is);
      const r = rects[idx];
      if (!r) return;
      const ax = corner.includes("e") ? r.x : r.x + r.w;
      const ay = corner.includes("s") ? r.y : r.y + r.h;
      drag.current = { kind: "resize", idx, ax, ay };
    } else if (t.dataset.rect !== undefined) {
      const idx = Number(t.dataset.rect);
      const r = rects[idx];
      if (!r) return;
      drag.current = { kind: "move", idx, dx: p.x - r.x, dy: p.y - r.y, w: r.w, h: r.h };
    } else if (rects.length < MAX_HIGHLIGHTS) {
      // empty area → draw a new box
      const idx = rects.length;
      drag.current = { kind: "draw", idx, ax: p.x, ay: p.y };
      commitAt(idx, { x: p.x, y: p.y, w: 1, h: 1 });
    }
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = pct(e);
    if (d.kind === "move") {
      commitAt(d.idx, {
        x: Math.max(0, Math.min(100 - d.w, p.x - d.dx)),
        y: Math.max(0, Math.min(100 - d.h, p.y - d.dy)),
        w: d.w, h: d.h,
      });
    } else {
      commitAt(d.idx, fromCorners({ x: d.ax, y: d.ay }, p));
    }
  }
  function onUp() { drag.current = null; }

  const HANDLES: { id: string; style: React.CSSProperties }[] = [
    { id: "nw", style: { left: 0, top: 0, cursor: "nwse-resize", transform: "translate(-50%,-50%)" } },
    { id: "ne", style: { right: 0, top: 0, cursor: "nesw-resize", transform: "translate(50%,-50%)" } },
    { id: "sw", style: { left: 0, bottom: 0, cursor: "nesw-resize", transform: "translate(-50%,50%)" } },
    { id: "se", style: { right: 0, bottom: 0, cursor: "nwse-resize", transform: "translate(50%,50%)" } },
  ];

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        className="relative w-full touch-none select-none overflow-hidden rounded-md border border-gray-200"
        style={{ cursor: rects.length < MAX_HIGHLIGHTS ? "crosshair" : "default" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img src={image} alt="" className="block w-full" draggable={false} />
        {rects.map((rect, i) => (
          <div
            key={i}
            data-rect={i}
            className="absolute border-2 border-cyan-500 bg-cyan-400/20"
            style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%`, cursor: "move", borderRadius: 4 }}
          >
            <span className="pointer-events-none absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-[9px] font-bold text-white" style={{ transform: "translate(-50%,-50%)" }}>{i + 1}</span>
            {HANDLES.map((h) => (
              <span key={h.id} data-handle={`${h.id}:${i}`} className="absolute h-2.5 w-2.5 rounded-sm border border-white bg-cyan-500" style={h.style} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="x,y,w,h; x,y,w,h (%)" className={inputCls} />
        {value && (
          <button type="button" onClick={() => onChange("")} className="flex-none text-xs text-gray-400 hover:text-red-500">Clear all</button>
        )}
      </div>
      {rects.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {rects.map((_, i) => (
            <button key={i} type="button" onClick={() => removeAt(i)} className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-gray-500 hover:border-red-400 hover:text-red-500" title={`Remove box ${i + 1}`}>
              Box {i + 1} ✕
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-gray-400">
        Drag on the image to draw a box{rects.length < MAX_HIGHLIGHTS ? ` (up to ${MAX_HIGHLIGHTS})` : ""}; drag a box to move it, corners to resize, chips below to remove.
      </p>
    </div>
  );
}

function SubControl({ def, value, presentationId, onChange }: { def: SubFieldDef; value: unknown; presentationId: string; onChange: (v: unknown) => void }) {
  const v = (value ?? "") as string;
  if (def.kind === "textarea") return <textarea rows={2} value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
  if (def.kind === "image") return <ImageField value={v} role={def.imageRole || "photo"} presentationId={presentationId} onChange={onChange} />;
  if (def.kind === "icon") return (
    <select value={v} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  if (def.kind === "select") return (
    <select value={v} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {(def.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  return <input value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
}

// ---- list editor ----------------------------------------------------------
function ListEditor({ field, value, presentationId, onChange, textOnly }: { field: FieldDef; value: unknown[]; presentationId: string; onChange: (v: unknown[]) => void; textOnly?: boolean }) {
  const items = value || [];
  const scalar = isScalarList(field);
  const subFields = textOnly ? (field.itemFields || []).filter(isTranslatableSub) : (field.itemFields || []);
  const atMax = field.max != null && items.length >= field.max;

  function update(i: number, next: unknown) {
    const copy = items.slice(); copy[i] = next; onChange(copy);
  }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const copy = items.slice(); [copy[i], copy[j]] = [copy[j], copy[i]]; onChange(copy);
  }
  function add() { if (!atMax) onChange([...items, defaultItem(field)]); }

  const scalarSub = field.itemFields?.[0];

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-gray-200 bg-gray-50/60 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{field.itemLabel} {i + 1}</span>
            {!textOnly && (
              <div className="flex items-center gap-1.5 text-gray-400">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 hover:text-gray-700 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="px-1 hover:text-gray-700 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => remove(i)} className="px-1 hover:text-red-500">✕</button>
              </div>
            )}
          </div>
          {scalar && scalarSub ? (
            <SubControl def={scalarSub} value={item} presentationId={presentationId} onChange={(v) => update(i, v)} />
          ) : (
            <div className="space-y-2">
              {subFields.map((sf) => (
                <div key={sf.key}>
                  <label className={labelCls}>{sf.label}</label>
                  <SubControl
                    def={sf}
                    value={(item as Record<string, unknown>)?.[sf.key]}
                    presentationId={presentationId}
                    onChange={(v) => update(i, { ...(item as Record<string, unknown>), [sf.key]: v })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {!textOnly && !atMax && (
        <button type="button" onClick={add} className="w-full rounded-md border border-dashed border-gray-300 py-1.5 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
          + Add {field.itemLabel}
        </button>
      )}
      {!textOnly && atMax && <p className="text-[11px] text-gray-400">Maximum {field.max} reached.</p>}
    </div>
  );
}

// ---- the editor for one slide ---------------------------------------------
export function SlideFields({ slide, presentationId, onChange, textOnly }: { slide: Slide; presentationId: string; onChange: (s: Slide) => void; textOnly?: boolean }) {
  const schema = SLIDE_SCHEMAS[slide.type];

  function setField(key: string, value: unknown) {
    let v = value;
    if (key === "columns") v = Number(value);
    onChange({ ...slide, [key]: v });
  }

  // In text-only (translation) mode show only translatable fields.
  const fields = textOnly
    ? schema.fields.filter((f) => {
        if (f.noTranslate) return false;
        if (f.kind === "text" || f.kind === "textarea") return true;
        if (f.kind === "list") return (f.itemFields || []).some(isTranslatableSub);
        return false;
      })
    : schema.fields;

  return (
    <div className="space-y-4">
      {fields.length === 0 && <p className="text-sm text-gray-400">This slide has no translatable text.</p>}
      {fields.map((f) => {
        const key = f.key as string;
        const raw = (slide as unknown as Record<string, unknown>)[key];
        return (
          <div key={key}>
            <label className={labelCls}>{f.label}</label>
            {f.kind === "text" && key === "highlight" && (
              <HighlightAreaField value={(raw as string) ?? ""} image={slide.image} onChange={(v) => setField(key, v)} />
            )}
            {f.kind === "text" && key !== "highlight" && <input value={(raw as string) ?? ""} onChange={(e) => setField(key, e.target.value)} className={inputCls} />}
            {f.kind === "textarea" && <textarea rows={key === "heading" ? 2 : 3} value={(raw as string) ?? ""} onChange={(e) => setField(key, e.target.value)} className={inputCls} />}
            {f.kind === "image" && <ImageField value={(raw as string) ?? ""} role={f.imageRole || "photo"} presentationId={presentationId} onChange={(v) => setField(key, v)} />}
            {f.kind === "icon" && (
              <select value={(raw as string) ?? "target"} onChange={(e) => setField(key, e.target.value)} className={inputCls}>
                {ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {f.kind === "select" && (
              <select value={String(raw ?? f.options?.[0]?.value ?? "")} onChange={(e) => setField(key, e.target.value)} className={inputCls}>
                {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {f.kind === "list" && <ListEditor field={f} value={(raw as unknown[]) ?? []} presentationId={presentationId} onChange={(v) => setField(key, v)} textOnly={textOnly} />}
            {f.help && <p className="mt-1 text-[11px] text-gray-400">{f.help}</p>}
          </div>
        );
      })}
    </div>
  );
}
