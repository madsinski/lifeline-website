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

  // Exact SVG from logo rebrand file (viewBox 0 0 374 85, black wordmark + #10B981 mark)
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 374 85" fill="none"><path d="M9.64 71.1661C7.10667 71.1661 5.25333 70.5128 4.08 69.2061C2.90667 67.8728 2.32 65.8995 2.32 63.2861V42.5261H8.36V63.0461C8.36 63.7128 8.46667 64.2995 8.68 64.8061C8.89333 65.2861 9.2 65.6461 9.6 65.8861C10.0267 66.1261 10.56 66.2461 11.2 66.2461C11.4667 66.2461 11.7467 66.2328 12.04 66.2061C12.3333 66.1795 12.6133 66.1261 12.88 66.0461L12.8 70.7261C12.2933 70.8595 11.7733 70.9661 11.24 71.0461C10.7333 71.1261 10.2 71.1661 9.64 71.1661ZM19.4003 47.2861V41.6461H25.9203V47.2861H19.4003ZM19.6403 70.7261V51.0861H25.6803V70.7261H19.6403ZM35.8634 70.7261V55.6061H32.1434V51.0861H37.6234L35.8634 52.6861V51.4461C35.8634 48.5395 36.6368 46.3661 38.1834 44.9261C39.7301 43.4595 42.1434 42.6328 45.4234 42.4461L47.6234 42.2861L47.9834 46.6861L46.1034 46.8061C45.0634 46.8595 44.2368 47.0328 43.6234 47.3261C43.0101 47.5928 42.5701 47.9795 42.3034 48.4861C42.0368 48.9661 41.9034 49.6061 41.9034 50.4061V51.7661L41.1434 51.0861H47.0234V55.6061H41.9034V70.7261H35.8634ZM63.3481 71.1661C61.0281 71.1661 59.0281 70.7528 57.3481 69.9261C55.6948 69.0728 54.4148 67.8861 53.5081 66.3661C52.6281 64.8195 52.1881 63.0061 52.1881 60.9261C52.1881 58.8995 52.6148 57.1261 53.4681 55.6061C54.3215 54.0595 55.5081 52.8595 57.0281 52.0061C58.5748 51.1261 60.3215 50.6861 62.2681 50.6861C64.1881 50.6861 65.8415 51.0995 67.2281 51.9261C68.6148 52.7261 69.6815 53.8728 70.4281 55.3661C71.2015 56.8595 71.5881 58.6328 71.5881 60.6861V62.2061H57.1481V59.0861H67.2281L66.5881 59.6461C66.5881 58.0195 66.2281 56.7928 65.5081 55.9661C64.8148 55.1128 63.8148 54.6861 62.5081 54.6861C61.5215 54.6861 60.6815 54.9128 59.9881 55.3661C59.2948 55.8195 58.7615 56.4728 58.3881 57.3261C58.0148 58.1795 57.8281 59.2061 57.8281 60.4061V60.7261C57.8281 62.0861 58.0281 63.2061 58.4281 64.0861C58.8548 64.9395 59.4815 65.5795 60.3081 66.0061C61.1615 66.4328 62.2148 66.6461 63.4681 66.6461C64.5348 66.6461 65.6148 66.4861 66.7081 66.1661C67.8015 65.8461 68.7881 65.3528 69.6681 64.6861L71.2681 68.7261C70.2815 69.4728 69.0681 70.0728 67.6281 70.5261C66.2148 70.9528 64.7881 71.1661 63.3481 71.1661ZM86.4213 71.1661C83.8879 71.1661 82.0346 70.5128 80.8613 69.2061C79.6879 67.8728 79.1013 65.8995 79.1013 63.2861V42.5261H85.1413V63.0461C85.1413 63.7128 85.2479 64.2995 85.4613 64.8061C85.6746 65.2861 85.9813 65.6461 86.3813 65.8861C86.8079 66.1261 87.3413 66.2461 87.9813 66.2461C88.2479 66.2461 88.5279 66.2328 88.8213 66.2061C89.1146 66.1795 89.3946 66.1261 89.6613 66.0461L89.5813 70.7261C89.0746 70.8595 88.5546 70.9661 88.0213 71.0461C87.5146 71.1261 86.9813 71.1661 86.4213 71.1661ZM96.1816 47.2861V41.6461H102.702V47.2861H96.1816ZM96.4216 70.7261V51.0861H102.462V70.7261H96.4216ZM111.125 70.7261V51.0861H117.045V54.7661H116.605C117.218 53.4595 118.125 52.4595 119.325 51.7661C120.551 51.0461 121.938 50.6861 123.485 50.6861C125.058 50.6861 126.351 50.9928 127.365 51.6061C128.378 52.1928 129.138 53.0995 129.645 54.3261C130.151 55.5261 130.405 57.0595 130.405 58.9261V70.7261H124.365V59.2061C124.365 58.2995 124.245 57.5661 124.005 57.0061C123.791 56.4195 123.458 56.0061 123.005 55.7661C122.578 55.4995 122.031 55.3661 121.365 55.3661C120.511 55.3661 119.765 55.5528 119.125 55.9261C118.511 56.2728 118.031 56.7795 117.685 57.4461C117.338 58.1128 117.165 58.8861 117.165 59.7661V70.7261H111.125ZM149.114 71.1661C146.794 71.1661 144.794 70.7528 143.114 69.9261C141.46 69.0728 140.18 67.8861 139.274 66.3661C138.394 64.8195 137.954 63.0061 137.954 60.9261C137.954 58.8995 138.38 57.1261 139.234 55.6061C140.087 54.0595 141.274 52.8595 142.794 52.0061C144.34 51.1261 146.087 50.6861 148.034 50.6861C149.954 50.6861 151.607 51.0995 152.994 51.9261C154.38 52.7261 155.447 53.8728 156.194 55.3661C156.967 56.8595 157.354 58.6328 157.354 60.6861V62.2061H142.914V59.0861H152.994L152.354 59.6461C152.354 58.0195 151.994 56.7928 151.274 55.9661C150.58 55.1128 149.58 54.6861 148.274 54.6861C147.287 54.6861 146.447 54.9128 145.754 55.3661C145.06 55.8195 144.527 56.4728 144.154 57.3261C143.78 58.1795 143.594 59.2061 143.594 60.4061V60.7261C143.594 62.0861 143.794 63.2061 144.194 64.0861C144.62 64.9395 145.247 65.5795 146.074 66.0061C146.927 66.4328 147.98 66.6461 149.234 66.6461C150.3 66.6461 151.38 66.4861 152.474 66.1661C153.567 65.8461 154.554 65.3528 155.434 64.6861L157.034 68.7261C156.047 69.4728 154.834 70.0728 153.394 70.5261C151.98 70.9528 150.554 71.1661 149.114 71.1661Z" fill="WMFILL"/><path d="M355.728 12.9986L298 70.7263V49.406L334.407 12.9986H355.728Z" fill="MKFILL"/></svg>`;

  const logoHTML = (wmColor: string, mkColor: string, w: number, healthColor?: string) => {
    const h = Math.round((85 / 374) * w);
    const svg = LOGO_SVG.replace('WMFILL', wmColor).replace('MKFILL', mkColor);
    const healthEl = healthColor
      ? `<div style="font-family:'Nunito Sans',Inter,system-ui,sans-serif;font-size:${Math.round(w * 0.042)}px;font-weight:300;color:${healthColor};letter-spacing:0.35em;text-transform:uppercase;margin-top:${Math.round(w * 0.01)}px;text-align:center;">health</div>`
      : "";
    return `<div style="width:${w}px;margin:0 auto;">${svg.replace('viewBox=', `width="${w}" height="${h}" viewBox=`)}${healthEl}</div>`;
  };

  const generateBrandedPDF = async (locs: CheckinLocation[], filename: string) => {
    const { default: jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;
    const QRCode = (await import("qrcode")).default;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(container);

    const appQR = await QRCode.toDataURL("https://lifelinehealth.is/download", { width: 200, margin: 1, color: { dark: "#1F2937", light: "#FFFFFF" } });

    for (let i = 0; i < locs.length; i++) {
      const loc = locs[i];
      const checkinQR = await QRCode.toDataURL(`lifeline://checkin/${loc.key}`, { width: 800, margin: 2, color: { dark: "#1F2937", light: "#FFFFFF" } });

      await document.fonts.load('800 48px "Nunito Sans"').catch(() => {});

      const page = document.createElement("div");
      page.style.cssText = "width:794px;height:1123px;position:relative;overflow:hidden;";
      page.innerHTML = `
        <!-- Background: subtle accent gradient -->
        <div style="position:absolute;inset:0;background:linear-gradient(180deg, #FFFFFF 0%, #F0FBF6 50%, #F8F6F1 100%);"></div>

        <!-- ═══ LOGO: big, centered, no header bar ═══ -->
        <div style="position:relative;z-index:1;padding-top:56px;">
          ${logoHTML("#000000", "#10B981", 340, "#6B7280")}
        </div>

        <!-- ═══ MIDDLE: vertically centered content ═══ -->
        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:780px;padding:0 80px;">

          <p style="font-family:Inter,system-ui,sans-serif;font-size:15px;color:#9CA3AF;margin:0 0 28px;font-weight:500;letter-spacing:0.02em;">Scan to check in & earn your points</p>

          <div style="background:#FFFFFF;border-radius:20px;padding:28px;box-shadow:0 8px 32px rgba(16,185,129,0.08),0 1px 4px rgba(0,0,0,0.04);border:1px solid rgba(16,185,129,0.08);">
            <img src="${checkinQR}" width="260" height="260" style="display:block;border-radius:4px;" />
          </div>

          <h2 style="font-family:'Nunito Sans',system-ui,sans-serif;font-size:34px;font-weight:800;color:#1F2937;margin:28px 0 0;letter-spacing:-0.02em;line-height:1.15;text-align:center;">${loc.name}</h2>
          ${loc.address ? `<p style="font-family:Inter,system-ui,sans-serif;font-size:15px;color:#9CA3AF;margin:8px 0 0;font-weight:400;text-align:center;">${loc.address}</p>` : ""}

          <!-- Points pill -->
          <table style="margin-top:24px;border-collapse:collapse;"><tr>
            <td style="background:rgba(16,185,129,0.08);border:2px solid #10B981;border-radius:100px;padding:12px 32px;text-align:center;vertical-align:middle;">
              <span style="font-family:'Nunito Sans',system-ui,sans-serif;font-size:18px;font-weight:800;color:#10B981;">+${loc.points} points</span>
            </td>
          </tr></table>
        </div>

        <!-- ═══ FOOTER ═══ -->
        <div style="position:absolute;bottom:0;left:0;right:0;background:#1F2937;padding:16px 32px;display:flex;align-items:center;justify-content:space-between;">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#10B981;"></div>

          <!-- Left: text + store badges -->
          <div style="display:flex;align-items:center;gap:14px;">
            <div>
              <p style="font-family:'Nunito Sans',system-ui,sans-serif;font-size:14px;font-weight:800;color:#ffffff;margin:0 0 2px;">Lifeline Health</p>
              <p style="font-family:Inter,system-ui,sans-serif;font-size:10px;color:rgba(255,255,255,0.45);margin:0;">Download the free app</p>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <div style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:5px 10px;">
                <svg width="14" height="17" viewBox="0 0 14 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.32 8.98c-.02-2.14 1.74-3.17 1.82-3.22-.99-1.45-2.53-1.65-3.08-1.67-1.31-.13-2.56.77-3.23.77-.67 0-1.7-.75-2.79-.73C2.49 4.15 1.21 4.92.5 6.13c-1.45 2.52-.37 6.25 1.04 8.3.69 1 1.51 2.12 2.59 2.08 1.04-.04 1.43-.67 2.69-.67 1.26 0 1.61.67 2.71.65 1.12-.02 1.83-.98 2.51-1.98.79-1.15 1.12-2.27 1.14-2.32-.02-.01-2.18-.84-2.2-3.33l.34.12zM9.32 2.87c.57-.7 .96-1.66.85-2.62-.82.03-1.82.55-2.41 1.24-.53.61-.99 1.59-.87 2.52.92.07 1.86-.46 2.43-1.14z" fill="rgba(255,255,255,0.6)"/></svg>
                <span style="font-family:Inter,system-ui,sans-serif;font-size:9px;font-weight:600;color:rgba(255,255,255,0.6);">App Store</span>
              </div>
              <div style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:5px 10px;">
                <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M.55.28l6.2 6.2L.55 12.7A2.1 2.1 0 01.1 11.4V1.58c0-.48.17-.93.45-1.3z" fill="rgba(255,255,255,0.6)"/><path d="M9.05 5.04l1.6 1.29c.56.32.56.93 0 1.25L9.05 8.87 7.47 7.48l-.72-1 .72-.99 1.58-1.45z" fill="rgba(255,255,255,0.6)"/><path d="M7.47 7.48L1.26 13.2l7.79-4.33-1.58-1.39z" fill="rgba(255,255,255,0.6)"/><path d="M1.26.7l6.21 6.21 1.58-1.87L1.26.7z" fill="rgba(255,255,255,0.6)"/></svg>
                <span style="font-family:Inter,system-ui,sans-serif;font-size:9px;font-weight:600;color:rgba(255,255,255,0.6);">Google Play</span>
              </div>
            </div>
          </div>

          <!-- Right: small QR to download app -->
          <div style="background:#ffffff;border-radius:6px;padding:4px;">
            <img src="${appQR}" width="48" height="48" style="display:block;border-radius:2px;" />
          </div>
        </div>
      `;

      container.innerHTML = "";
      container.appendChild(page);
      await new Promise(r => setTimeout(r, 250));

      const canvas = await html2canvas(page, { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" });
      if (i > 0) doc.addPage();
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
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
