"use client";
/* eslint-disable @next/next/no-img-element -- editor thumbnails preview CMS/storage image URLs; plain <img> is intentional. */

import { useState } from "react";
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
function ListEditor({ field, value, presentationId, onChange }: { field: FieldDef; value: unknown[]; presentationId: string; onChange: (v: unknown[]) => void }) {
  const items = value || [];
  const scalar = isScalarList(field);
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
            <div className="flex items-center gap-1.5 text-gray-400">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 hover:text-gray-700 disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="px-1 hover:text-gray-700 disabled:opacity-30">↓</button>
              <button type="button" onClick={() => remove(i)} className="px-1 hover:text-red-500">✕</button>
            </div>
          </div>
          {scalar && scalarSub ? (
            <SubControl def={scalarSub} value={item} presentationId={presentationId} onChange={(v) => update(i, v)} />
          ) : (
            <div className="space-y-2">
              {(field.itemFields || []).map((sf) => (
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
      {!atMax && (
        <button type="button" onClick={add} className="w-full rounded-md border border-dashed border-gray-300 py-1.5 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
          + Add {field.itemLabel}
        </button>
      )}
      {atMax && <p className="text-[11px] text-gray-400">Maximum {field.max} reached.</p>}
    </div>
  );
}

// ---- the editor for one slide ---------------------------------------------
export function SlideFields({ slide, presentationId, onChange }: { slide: Slide; presentationId: string; onChange: (s: Slide) => void }) {
  const schema = SLIDE_SCHEMAS[slide.type];

  function setField(key: string, value: unknown) {
    let v = value;
    if (key === "columns") v = Number(value);
    onChange({ ...slide, [key]: v });
  }

  return (
    <div className="space-y-4">
      {schema.fields.map((f) => {
        const key = f.key as string;
        const raw = (slide as unknown as Record<string, unknown>)[key];
        return (
          <div key={key}>
            <label className={labelCls}>{f.label}</label>
            {f.kind === "text" && <input value={(raw as string) ?? ""} onChange={(e) => setField(key, e.target.value)} className={inputCls} />}
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
            {f.kind === "list" && <ListEditor field={f} value={(raw as unknown[]) ?? []} presentationId={presentationId} onChange={(v) => setField(key, v)} />}
            {f.help && <p className="mt-1 text-[11px] text-gray-400">{f.help}</p>}
          </div>
        );
      })}
    </div>
  );
}
