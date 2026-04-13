"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CheckinLocation {
  id: string;
  name: string;
  key: string;
  address: string | null;
  points: number;
  category: string;
  active: boolean;
  created_at: string;
}

interface CheckinLog {
  id: string;
  client_id: string;
  location_key: string;
  points_awarded: number;
  checked_in_at: string;
  client_name?: string;
}

const CATEGORIES = ["general", "exercise", "nutrition", "mental", "recovery", "social"];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function QRCodeSVG({ value, size = 200 }: { value: string; size?: number }) {
  // Simple QR placeholder — real generation happens in PDF export via qrcode library
  // For preview we show a styled placeholder
  return (
    <div
      className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50"
      style={{ width: size, height: size }}
    >
      <div className="text-center px-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-1" width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="3" height="3" />
          <rect x="18" y="14" width="3" height="3" />
          <rect x="14" y="18" width="3" height="3" />
          <rect x="18" y="18" width="3" height="3" />
        </svg>
        <p className="text-[9px] text-gray-400 break-all leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function CheckinsAdminPage() {
  const [locations, setLocations] = useState<CheckinLocation[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<CheckinLog[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", key: "", address: "", points: "5", category: "general" });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Record<string, number>>({});

  const loadLocations = useCallback(async () => {
    const { data } = await supabase.from("checkin_locations").select("*").order("created_at", { ascending: false });
    if (data) setLocations(data);
  }, []);

  const loadRecentCheckins = useCallback(async () => {
    const { data } = await supabase
      .from("checkin_log")
      .select("*, clients:client_id(full_name)")
      .order("checked_in_at", { ascending: false })
      .limit(50);
    if (data) {
      setRecentCheckins(data.map((r: any) => ({ ...r, client_name: r.clients?.full_name ?? "Unknown" })));
    }
  }, []);

  const loadStats = useCallback(async () => {
    const { data } = await supabase.from("checkin_log").select("location_key");
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((r: any) => { counts[r.location_key] = (counts[r.location_key] || 0) + 1; });
      setStats(counts);
    }
  }, []);

  useEffect(() => {
    loadLocations();
    loadRecentCheckins();
    loadStats();
  }, [loadLocations, loadRecentCheckins, loadStats]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.key.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      key: form.key.trim(),
      address: form.address.trim() || null,
      points: parseInt(form.points) || 5,
      category: form.category,
    };

    if (editingId) {
      await supabase.from("checkin_locations").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId);
    } else {
      await supabase.from("checkin_locations").insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", key: "", address: "", points: "5", category: "general" });
    loadLocations();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("checkin_locations").update({ active: !active }).eq("id", id);
    loadLocations();
  };

  const deleteLocation = async (id: string) => {
    if (!confirm("Delete this check-in location? This cannot be undone.")) return;
    await supabase.from("checkin_locations").delete().eq("id", id);
    loadLocations();
  };

  const startEdit = (loc: CheckinLocation) => {
    setForm({ name: loc.name, key: loc.key, address: loc.address || "", points: String(loc.points), category: loc.category });
    setEditingId(loc.id);
    setShowForm(true);
  };

  const togglePrintSelect = (key: string) => {
    setSelectedForPrint(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAllForPrint = () => {
    const activeKeys = locations.filter(l => l.active).map(l => l.key);
    setSelectedForPrint(new Set(activeKeys));
  };

  const exportPDF = async () => {
    const toExport = locations.filter(l => selectedForPrint.has(l.key));
    if (toExport.length === 0) { alert("Select at least one location to export."); return; }

    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const QRCode = (await import("qrcode")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297;
      const cols = 2, rows = 3;
      const cardW = 80, cardH = 80;
      const gapX = (pageW - cols * cardW) / (cols + 1);
      const gapY = (pageH - rows * cardH) / (rows + 1);

      for (let i = 0; i < toExport.length; i++) {
        if (i > 0 && i % (cols * rows) === 0) doc.addPage();
        const loc = toExport[i];
        const idx = i % (cols * rows);
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = gapX + col * (cardW + gapX);
        const y = gapY + row * (cardH + gapY);

        // Card border
        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cardW, cardH, 4, 4);

        // QR code
        const qrDataUrl = await QRCode.toDataURL(`lifeline://checkin/${loc.key}`, { width: 200, margin: 1 });
        doc.addImage(qrDataUrl, "PNG", x + 15, y + 5, 50, 50);

        // Location name
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        const nameLines = doc.splitTextToSize(loc.name, cardW - 8);
        doc.text(nameLines, x + cardW / 2, y + 60, { align: "center" });

        // Points
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`+${loc.points} pts · Scan to check in`, x + cardW / 2, y + 68, { align: "center" });
        doc.setTextColor(0);

        // Lifeline branding
        doc.setFontSize(6);
        doc.setTextColor(150);
        doc.text("Lifeline Health", x + cardW / 2, y + 75, { align: "center" });
        doc.setTextColor(0);
      }

      doc.save("lifeline-checkin-qrcodes.pdf");
    } catch (e) {
      console.error("PDF export error:", e);
      alert("Failed to generate PDF. Check console for details.");
    }
    setExporting(false);
  };

  const categoryColor: Record<string, string> = {
    exercise: "bg-blue-100 text-blue-700",
    nutrition: "bg-emerald-100 text-emerald-700",
    mental: "bg-purple-100 text-purple-700",
    recovery: "bg-amber-100 text-amber-700",
    social: "bg-cyan-100 text-cyan-700",
    general: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">QR Check-in Locations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage physical check-in points. Print QR codes for gyms, clinics, and outdoor spots.</p>
        </div>
        <div className="flex gap-2">
          {selectedForPrint.size > 0 && (
            <button
              onClick={exportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {exporting ? "Generating..." : `Export PDF (${selectedForPrint.size})`}
            </button>
          )}
          <button
            onClick={selectAllForPrint}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
          >
            Select all
          </button>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: "", key: "", address: "", points: "5", category: "general" }); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add location
          </button>
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{editingId ? "Edit location" : "New check-in location"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Location name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g. Lifeline Gym – Lágmúli"
                value={form.name}
                onChange={e => {
                  setForm(f => ({ ...f, name: e.target.value, ...(editingId ? {} : { key: slugify(e.target.value) }) }));
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Unique key (QR code identifier)</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g. gym-lagmuli"
                value={form.key}
                onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
              />
              <p className="text-xs text-gray-400 mt-1">QR will encode: lifeline://checkin/{form.key || "..."}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Address (optional)</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g. Lágmúla 5, Reykjavík"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Points</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={form.points}
                  onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
                  min={1}
                  max={100}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Preview */}
          {form.key && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-center gap-4">
              <QRCodeSVG value={`lifeline://checkin/${form.key}`} size={80} />
              <div>
                <p className="text-sm font-bold text-gray-900">{form.name || "Location name"}</p>
                <p className="text-xs text-gray-500">{form.address || "No address"}</p>
                <p className="text-xs text-emerald-600 font-semibold mt-1">+{form.points} points per check-in</p>
                <p className="text-[10px] text-gray-400 font-mono mt-1">lifeline://checkin/{form.key}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.key.trim()}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Locations table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" onChange={e => e.target.checked ? selectAllForPrint() : setSelectedForPrint(new Set())} checked={selectedForPrint.size === locations.filter(l => l.active).length && locations.length > 0} /></th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Key</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Points</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Check-ins</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No check-in locations yet. Create one to get started.</td></tr>
            )}
            {locations.map(loc => (
              <tr key={loc.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input type="checkbox" className="rounded" checked={selectedForPrint.has(loc.key)} onChange={() => togglePrintSelect(loc.key)} />
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{loc.name}</p>
                  {loc.address && <p className="text-xs text-gray-400 mt-0.5">{loc.address}</p>}
                </td>
                <td className="px-4 py-3"><code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{loc.key}</code></td>
                <td className="text-center px-4 py-3"><span className="text-sm font-bold text-emerald-600">+{loc.points}</span></td>
                <td className="text-center px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${categoryColor[loc.category] || categoryColor.general}`}>
                    {loc.category}
                  </span>
                </td>
                <td className="text-center px-4 py-3"><span className="text-sm font-semibold text-gray-700">{stats[loc.key] || 0}</span></td>
                <td className="text-center px-4 py-3">
                  <button
                    onClick={() => toggleActive(loc.id, loc.active)}
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${loc.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {loc.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="text-right px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => startEdit(loc)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Edit">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteLocation(loc.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent check-ins */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-700">Recent check-ins</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentCheckins.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">No check-ins yet.</p>
          )}
          {recentCheckins.slice(0, 20).map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm"><span className="font-semibold text-gray-900">{c.client_name}</span> checked in at <span className="font-semibold text-gray-900">{c.location_key}</span></p>
                <p className="text-xs text-gray-400">{new Date(c.checked_in_at).toLocaleString()}</p>
              </div>
              <span className="text-xs font-bold text-emerald-600">+{c.points_awarded} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
