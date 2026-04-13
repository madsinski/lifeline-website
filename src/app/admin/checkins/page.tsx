"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// Load Nunito Sans for PDF generation (brand book heading font)
if (typeof window !== "undefined") {
  const link = document.createElement("link");
  link.href = "https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800;900&display=swap";
  link.rel = "stylesheet";
  if (!document.querySelector('link[href*="Nunito"]')) document.head.appendChild(link);
}

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
    const { data, error } = await supabase.from("checkin_locations").select("*").order("created_at", { ascending: false });
    console.log("[checkins] load locations:", { data, error });
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
      const { error } = await supabase.from("checkin_locations").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId);
      if (error) console.error("[checkins] update error:", error);
    } else {
      const { error } = await supabase.from("checkin_locations").insert(payload);
      if (error) { console.error("[checkins] insert error:", error); alert("Insert failed: " + error.message); }
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

  // Brand book SVG logo (viewBox 0 0 374 85 — wordmark + angular mark, as-is from brand book)
  const WM = "M9.64 71.17C7.11 71.17 5.25 70.51 4.08 69.21C2.91 67.87 2.32 65.9 2.32 63.29V42.53H8.36V63.05C8.36 63.71 8.47 64.3 8.68 64.81C8.89 65.29 9.2 65.65 9.6 65.89C10.03 66.13 10.56 66.25 11.2 66.25C11.47 66.25 11.75 66.23 12.04 66.21C12.33 66.18 12.61 66.13 12.88 66.05L12.8 70.73C12.29 70.86 11.77 70.97 11.24 71.05C10.73 71.13 10.2 71.17 9.64 71.17ZM19.4 47.29V41.65H25.92V47.29H19.4ZM19.64 70.73V51.09H25.68V70.73H19.64ZM35.86 70.73V55.61H32.14V51.09H37.62L35.86 52.69V51.45C35.86 48.54 36.64 46.37 38.18 44.93C39.73 43.46 42.14 42.63 45.42 42.45L47.62 42.29L47.98 46.69L46.1 46.81C45.06 46.86 44.24 47.03 43.62 47.33C43.01 47.59 42.57 47.98 42.3 48.49C42.04 48.97 41.9 49.61 41.9 50.41V51.77L41.14 51.09H47.02V55.61H41.9V70.73H35.86ZM63.35 71.17C61.03 71.17 59.03 70.75 57.35 69.93C55.69 69.07 54.41 67.89 53.51 66.37C52.63 64.82 52.19 63.01 52.19 60.93C52.19 58.9 52.61 57.13 53.47 55.61C54.32 54.06 55.51 52.86 57.03 52.01C58.57 51.13 60.32 50.69 62.27 50.69C64.19 50.69 65.84 51.1 67.23 51.93C68.61 52.73 69.68 53.87 70.43 55.37C71.2 56.86 71.59 58.63 71.59 60.69V62.21H57.15V59.09H67.23L66.59 59.65C66.59 58.02 66.23 56.79 65.51 55.97C64.81 55.11 63.81 54.69 62.51 54.69C61.52 54.69 60.68 54.91 59.99 55.37C59.29 55.82 58.76 56.47 58.39 57.33C58.01 58.18 57.83 59.21 57.83 60.41V60.73C57.83 62.09 58.03 63.21 58.43 64.09C58.85 64.94 59.48 65.58 60.31 66.01C61.16 66.43 62.21 66.65 63.47 66.65C64.53 66.65 65.61 66.49 66.71 66.17C67.8 65.85 68.79 65.35 69.67 64.69L71.27 68.73C70.28 69.47 69.07 70.07 67.63 70.53C66.21 70.95 64.79 71.17 63.35 71.17ZM86.42 71.17C83.89 71.17 82.03 70.51 80.86 69.21C79.69 67.87 79.1 65.9 79.1 63.29V42.53H85.14V63.05C85.14 63.71 85.25 64.3 85.46 64.81C85.67 65.29 85.98 65.65 86.38 65.89C86.81 66.13 87.34 66.25 87.98 66.25C88.25 66.25 88.53 66.23 88.82 66.21C89.11 66.18 89.39 66.13 89.66 66.05L89.58 70.73C89.07 70.86 88.55 70.97 88.02 71.05C87.51 71.13 86.98 71.17 86.42 71.17ZM96.18 47.29V41.65H102.7V47.29H96.18ZM96.42 70.73V51.09H102.46V70.73H96.42ZM111.13 70.73V51.09H117.05V54.77H116.61C117.22 53.46 118.13 52.46 119.33 51.77C120.55 51.05 121.94 50.69 123.49 50.69C125.06 50.69 126.35 50.99 127.37 51.61C128.38 52.19 129.14 53.1 129.65 54.33C130.15 55.53 130.41 57.06 130.41 58.93V70.73H124.37V59.21C124.37 58.3 124.25 57.57 124.01 57.01C123.79 56.42 123.46 56.01 123.01 55.77C122.58 55.5 122.03 55.37 121.37 55.37C120.51 55.37 119.77 55.55 119.13 55.93C118.51 56.27 118.03 56.78 117.69 57.45C117.34 58.11 117.17 58.89 117.17 59.77V70.73H111.13ZM149.11 71.17C146.79 71.17 144.79 70.75 143.11 69.93C141.46 69.07 140.18 67.89 139.27 66.37C138.39 64.82 137.95 63.01 137.95 60.93C137.95 58.9 138.38 57.13 139.23 55.61C140.09 54.06 141.27 52.86 142.79 52.01C144.34 51.13 146.09 50.69 148.03 50.69C149.95 50.69 151.61 51.1 152.99 51.93C154.38 52.73 155.45 53.87 156.19 55.37C156.97 56.86 157.35 58.63 157.35 60.69V62.21H142.91V59.09H152.99L152.35 59.65C152.35 58.02 151.99 56.79 151.27 55.97C150.58 55.11 149.58 54.69 148.27 54.69C147.29 54.69 146.45 54.91 145.75 55.37C145.06 55.82 144.53 56.47 144.15 57.33C143.78 58.18 143.59 59.21 143.59 60.41V60.73C143.59 62.09 143.79 63.21 144.19 64.09C144.62 64.94 145.25 65.58 146.07 66.01C146.93 66.43 147.98 66.65 149.23 66.65C150.3 66.65 151.38 66.49 152.47 66.17C153.57 65.85 154.55 65.35 155.43 64.69L157.03 68.73C156.05 69.47 154.83 70.07 153.39 70.53C151.98 70.95 150.55 71.17 149.11 71.17Z";
  const MK = "M355.728 12.9986L298 70.7263V49.406L334.407 12.9986H355.728Z";

  const logoSVG = (wmColor: string, mkColor: string, w: number) => {
    const h = Math.round((85 / 374) * w);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 374 85"><path d="${WM}" fill="${wmColor}"/><path d="${MK}" fill="${mkColor}"/></svg>`;
  };

  const generateBrandedPDF = async (locs: CheckinLocation[], filename: string) => {
    const { default: jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;
    const QRCode = (await import("qrcode")).default;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(container);

    // App download QR (same for all pages)
    const appQR = await QRCode.toDataURL("https://lifelinehealth.is/download", { width: 200, margin: 1, color: { dark: "#1F2937", light: "#FFFFFF" } });

    for (let i = 0; i < locs.length; i++) {
      const loc = locs[i];
      const checkinQR = await QRCode.toDataURL(`lifeline://checkin/${loc.key}`, { width: 800, margin: 2, color: { dark: "#1F2937", light: "#FFFFFF" } });

      await document.fonts.load('800 48px "Nunito Sans"').catch(() => {});

      const page = document.createElement("div");
      page.style.cssText = "width:794px;height:1123px;position:relative;overflow:hidden;";
      page.innerHTML = `
        <!-- Background: subtle gradient from white to faint emerald tint -->
        <div style="position:absolute;inset:0;background:linear-gradient(180deg, #FFFFFF 0%, #F0FBF6 40%, #F8F6F1 100%);"></div>

        <!-- ═══ HEADER: compact emerald bar with logo ═══ -->
        <div style="position:relative;z-index:1;background:linear-gradient(135deg,#10B981,#047857);padding:24px 0;text-align:center;">
          ${logoSVG("#ffffff", "#ffffff", 220)}
        </div>

        <!-- ═══ MIDDLE: text + QR + info, vertically centered ═══ -->
        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:860px;padding:0 80px;">

          <!-- Tagline -->
          <p style="font-family:Inter,system-ui,sans-serif;font-size:15px;color:#6B7280;margin:0 0 32px;font-weight:500;letter-spacing:0.02em;">Scan to check in & earn your points</p>

          <!-- QR code in white card -->
          <div style="background:#FFFFFF;border-radius:20px;padding:28px;box-shadow:0 8px 32px rgba(16,185,129,0.1),0 2px 8px rgba(0,0,0,0.04);border:1px solid rgba(16,185,129,0.1);">
            <img src="${checkinQR}" width="260" height="260" style="display:block;border-radius:4px;" />
          </div>

          <!-- Location name -->
          <h2 style="font-family:'Nunito Sans',system-ui,sans-serif;font-size:34px;font-weight:800;color:#1F2937;margin:32px 0 0;letter-spacing:-0.02em;line-height:1.15;text-align:center;">${loc.name}</h2>

          <!-- Address -->
          ${loc.address ? `<p style="font-family:Inter,system-ui,sans-serif;font-size:15px;color:#9CA3AF;margin:8px 0 0;font-weight:400;text-align:center;">${loc.address}</p>` : ""}

          <!-- Points pill -->
          <div style="display:inline-flex;align-items:center;justify-content:center;background:rgba(16,185,129,0.08);border:2px solid #10B981;border-radius:100px;padding:10px 32px;margin-top:24px;height:48px;">
            <span style="font-family:'Nunito Sans',system-ui,sans-serif;font-size:20px;font-weight:800;color:#10B981;line-height:1;">+${loc.points} points</span>
          </div>
        </div>

        <!-- ═══ FOOTER: charcoal bar with app download ═══ -->
        <div style="position:absolute;bottom:0;left:0;right:0;background:#1F2937;padding:20px 40px;display:flex;align-items:center;justify-content:space-between;">
          <!-- Emerald top accent -->
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#10B981;"></div>

          <!-- Left: app name + store icons -->
          <div style="display:flex;align-items:center;gap:16px;">
            <div>
              <p style="font-family:'Nunito Sans',system-ui,sans-serif;font-size:13px;font-weight:700;color:#ffffff;margin:0 0 2px;">Lifeline Health</p>
              <p style="font-family:Inter,system-ui,sans-serif;font-size:10px;color:rgba(255,255,255,0.5);margin:0;">Download the app</p>
            </div>
            <div style="display:flex;gap:8px;">
              <!-- App Store pill -->
              <div style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 10px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)" xmlns="http://www.w3.org/2000/svg"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <span style="font-family:Inter;font-size:9px;font-weight:600;color:rgba(255,255,255,0.7);">App Store</span>
              </div>
              <!-- Google Play pill -->
              <div style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 10px;">
                <svg width="13" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)" xmlns="http://www.w3.org/2000/svg"><path d="M3.61 1.81L13.42 12 3.61 22.19c-.35-.57-.61-1.22-.61-1.94V3.75c0-.72.26-1.37.61-1.94zM15.42 10l2.53-2.53 3.55 2.04c.89.51.89 1.47 0 1.98l-3.55 2.04L15.42 11 15.42 10zM14.54 12.88l-9.81 9.81 12.27-7.03-2.46-2.78zM4.73 1.31l9.81 9.81 2.46-2.78L4.73 1.31z"/></svg>
                <span style="font-family:Inter;font-size:9px;font-weight:600;color:rgba(255,255,255,0.7);">Google Play</span>
              </div>
            </div>
          </div>

          <!-- Right: small QR to download app -->
          <div style="background:#ffffff;border-radius:6px;padding:4px;">
            <img src="${appQR}" width="52" height="52" style="display:block;border-radius:2px;" />
          </div>
        </div>
      `;

      container.innerHTML = "";
      container.appendChild(page);

      await new Promise(r => setTimeout(r, 250));

      const canvas = await html2canvas(page, { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" });
      const imgData = canvas.toDataURL("image/png");

      if (i > 0) doc.addPage();
      doc.addImage(imgData, "PNG", 0, 0, 210, 297);
    }

    document.body.removeChild(container);
    doc.save(filename);
  };

  const downloadSingleQR = async (loc: CheckinLocation) => {
    try {
      await generateBrandedPDF([loc], `lifeline-checkin-${loc.key}.pdf`);
    } catch (e) {
      console.error("QR download error:", e);
      alert("Failed to generate PDF.");
    }
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
      await generateBrandedPDF(toExport, "lifeline-checkin-qrcodes.pdf");
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
                    <button onClick={() => downloadSingleQR(loc)} className="p-1.5 text-gray-400 hover:text-emerald-600 rounded" title="Download QR">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
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
