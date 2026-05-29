"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface DiscountCode {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  note: string | null;
  created_at: string;
}

function fmtValue(c: DiscountCode): string {
  return c.kind === "percent" ? `${c.value}%` : `${c.value.toLocaleString("is-IS")} kr`;
}

export default function DiscountCodesContent() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New-code form
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("discount_codes")
      .select("id, code, kind, value, active, expires_at, max_uses, used_count, note, created_at")
      .order("created_at", { ascending: false });
    if (e) setError(e.message);
    else setCodes((data as DiscountCode[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const normalized = code.trim().toUpperCase();
    const numValue = Number(value);
    if (!normalized) { setError("Code is required."); return; }
    if (!Number.isFinite(numValue) || numValue < 0) { setError("Value must be a non-negative number."); return; }
    if (kind === "percent" && numValue > 100) { setError("Percent cannot exceed 100."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insErr } = await supabase.from("discount_codes").insert({
      code: normalized,
      kind,
      value: numValue,
      max_uses: maxUses ? Number(maxUses) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      note: note.trim() || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (insErr) { setError(insErr.message.includes("duplicate") ? "That code already exists." : insErr.message); return; }
    setCode(""); setValue(""); setMaxUses(""); setExpiresAt(""); setNote("");
    load();
  };

  const toggleActive = async (c: DiscountCode) => {
    await supabase.from("discount_codes").update({ active: !c.active }).eq("id", c.id);
    load();
  };

  return (
    <div className="px-8 py-6 space-y-8">
      {/* Create form */}
      <form onSubmit={create} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 max-w-3xl">
        <h2 className="font-semibold text-gray-900">New discount code</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-gray-500">Code
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER25"
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 uppercase" />
          </label>
          <label className="text-xs text-gray-500">Type
            <select value={kind} onChange={(e) => setKind(e.target.value === "fixed" ? "fixed" : "percent")}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
              <option value="percent">Percent (%)</option>
              <option value="fixed">Fixed (ISK)</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">{kind === "percent" ? "Percent off" : "ISK off"}
            <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
          <label className="text-xs text-gray-500">Max uses (blank = ∞)
            <input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
          <label className="text-xs text-gray-500">Expires (blank = never)
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
          <label className="text-xs text-gray-500">Note
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pilot partner"
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {saving ? "Saving…" : "Create code"}
        </button>
      </form>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-w-3xl">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">No discount codes yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="py-2 px-4">Code</th>
                <th className="py-2 px-4">Discount</th>
                <th className="py-2 px-4">Used</th>
                <th className="py-2 px-4">Expires</th>
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 px-4 font-semibold text-gray-900">{c.code}{c.note && <span className="block text-xs font-normal text-gray-400">{c.note}</span>}</td>
                  <td className="py-2 px-4">{fmtValue(c)}</td>
                  <td className="py-2 px-4">{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ""}</td>
                  <td className="py-2 px-4">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-GB") : "—"}</td>
                  <td className="py-2 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-right">
                    <button onClick={() => toggleActive(c)} className="text-xs font-medium text-blue-600 hover:underline">
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
