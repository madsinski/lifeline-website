// Pure jsPDF PDF generation — no html2canvas, pixel-perfect coordinates

interface CheckinLoc {
  name: string;
  key: string;
  address: string | null;
  points: number;
}

// Render an SVG string to a PNG data URL via offscreen canvas
function svgToPng(svg: string, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  });
}

// Build the logo SVG with custom colors (from the brand rebrand file)
function buildLogoSvg(wmColor: string, mkColor: string, pw: number) {
  const ph = Math.round((85 / 374) * pw);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 374 85" fill="none">
<path d="M9.64 71.17C7.11 71.17 5.25 70.51 4.08 69.21C2.91 67.87 2.32 65.9 2.32 63.29V42.53H8.36V63.05C8.36 63.71 8.47 64.3 8.68 64.81C8.89 65.29 9.2 65.65 9.6 65.89C10.03 66.13 10.56 66.25 11.2 66.25L12.88 66.05L12.8 70.73C12.29 70.86 11.77 70.97 11.24 71.05C10.73 71.13 10.2 71.17 9.64 71.17ZM19.4 47.29V41.65H25.92V47.29H19.4ZM19.64 70.73V51.09H25.68V70.73H19.64ZM35.86 70.73V55.61H32.14V51.09H37.62L35.86 52.69V51.45C35.86 48.54 36.64 46.37 38.18 44.93C39.73 43.46 42.14 42.63 45.42 42.45L47.62 42.29L47.98 46.69L46.1 46.81C45.06 46.86 44.24 47.03 43.62 47.33C43.01 47.59 42.57 47.98 42.3 48.49C42.04 48.97 41.9 49.61 41.9 50.41V51.77L41.14 51.09H47.02V55.61H41.9V70.73H35.86ZM63.35 71.17C61.03 71.17 59.03 70.75 57.35 69.93C55.69 69.07 54.41 67.89 53.51 66.37C52.63 64.82 52.19 63.01 52.19 60.93C52.19 58.9 52.61 57.13 53.47 55.61C54.32 54.06 55.51 52.86 57.03 52.01C58.57 51.13 60.32 50.69 62.27 50.69C64.19 50.69 65.84 51.1 67.23 51.93C68.61 52.73 69.68 53.87 70.43 55.37C71.2 56.86 71.59 58.63 71.59 60.69V62.21H57.15V59.09H67.23L66.59 59.65C66.59 58.02 66.23 56.79 65.51 55.97C64.81 55.11 63.81 54.69 62.51 54.69C61.52 54.69 60.68 54.91 59.99 55.37C59.29 55.82 58.76 56.47 58.39 57.33C58.01 58.18 57.83 59.21 57.83 60.41V60.73C57.83 62.09 58.03 63.21 58.43 64.09C58.85 64.94 59.48 65.58 60.31 66.01C61.16 66.43 62.21 66.65 63.47 66.65C64.53 66.65 65.61 66.49 66.71 66.17C67.8 65.85 68.79 65.35 69.67 64.69L71.27 68.73C70.28 69.47 69.07 70.07 67.63 70.53C66.21 70.95 64.79 71.17 63.35 71.17ZM86.42 71.17C83.89 71.17 82.03 70.51 80.86 69.21C79.69 67.87 79.1 65.9 79.1 63.29V42.53H85.14V63.05C85.14 63.71 85.25 64.3 85.46 64.81C85.67 65.29 85.98 65.65 86.38 65.89C86.81 66.13 87.34 66.25 87.98 66.25L89.66 66.05L89.58 70.73C89.07 70.86 88.55 70.97 88.02 71.05C87.51 71.13 86.98 71.17 86.42 71.17ZM96.18 47.29V41.65H102.7V47.29H96.18ZM96.42 70.73V51.09H102.46V70.73H96.42ZM111.13 70.73V51.09H117.05V54.77H116.61C117.22 53.46 118.13 52.46 119.33 51.77C120.55 51.05 121.94 50.69 123.49 50.69C125.06 50.69 126.35 50.99 127.37 51.61C128.38 52.19 129.14 53.1 129.65 54.33C130.15 55.53 130.41 57.06 130.41 58.93V70.73H124.37V59.21C124.37 58.3 124.25 57.57 124.01 57.01C123.79 56.42 123.46 56.01 123.01 55.77C122.58 55.5 122.03 55.37 121.37 55.37C120.51 55.37 119.77 55.55 119.13 55.93C118.51 56.27 118.03 56.78 117.69 57.45C117.34 58.11 117.17 58.89 117.17 59.77V70.73H111.13ZM149.11 71.17C146.79 71.17 144.79 70.75 143.11 69.93C141.46 69.07 140.18 67.89 139.27 66.37C138.39 64.82 137.95 63.01 137.95 60.93C137.95 58.9 138.38 57.13 139.23 55.61C140.09 54.06 141.27 52.86 142.79 52.01C144.34 51.13 146.09 50.69 148.03 50.69C149.95 50.69 151.61 51.1 152.99 51.93C154.38 52.73 155.45 53.87 156.19 55.37C156.97 56.86 157.35 58.63 157.35 60.69V62.21H142.91V59.09H152.99L152.35 59.65C152.35 58.02 151.99 56.79 151.27 55.97C150.58 55.11 149.58 54.69 148.27 54.69C147.29 54.69 146.45 54.91 145.75 55.37C145.06 55.82 144.53 56.47 144.15 57.33C143.78 58.18 143.59 59.21 143.59 60.41V60.73C143.59 62.09 143.79 63.21 144.19 64.09C144.62 64.94 145.25 65.58 146.07 66.01C146.93 66.43 147.98 66.65 149.23 66.65C150.3 66.65 151.38 66.49 152.47 66.17C153.57 65.85 154.55 65.35 155.43 64.69L157.03 68.73C156.05 69.47 154.83 70.07 153.39 70.53C151.98 70.95 150.55 71.17 149.11 71.17Z" fill="${wmColor}"/>
<path d="M355.728 12.999L298 70.726V49.406L334.407 12.999H355.728Z" fill="${mkColor}"/>
</svg>`,
    w: pw,
    h: ph,
  };
}

export async function generateBrandedPDF(locs: CheckinLoc[], filename: string) {
  const { default: jsPDF } = await import("jspdf");
  const QRCode = (await import("qrcode")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, CX = W / 2;

  // Pre-render logo as PNG (black wordmark + emerald mark)
  const logo = buildLogoSvg("#000000", "#10B981", 1200);
  const logoMmW = 80, logoMmH = Math.round((85 / 374) * logoMmW);
  const logoPng = await svgToPng(logo.svg, logo.w, logo.h);

  // App download QR (shared across pages)
  const appQR = await QRCode.toDataURL("https://lifelinehealth.is/download", {
    width: 200, margin: 1, color: { dark: "#1F2937", light: "#FFFFFF" },
  });

  for (let i = 0; i < locs.length; i++) {
    const loc = locs[i];
    if (i > 0) doc.addPage();

    // ── Background: subtle gradient white → faint green → cream ──
    for (let s = 0; s < 40; s++) {
      const t = s / 40;
      const r = t < 0.5 ? 255 : Math.round(255 - 7 * ((t - 0.5) * 2));
      const g = t < 0.5 ? Math.round(255 - 4 * (t * 2)) : Math.round(251 - 5 * ((t - 0.5) * 2));
      const b = t < 0.5 ? Math.round(255 - 9 * (t * 2)) : Math.round(246 - 5 * ((t - 0.5) * 2));
      doc.setFillColor(r, g, b);
      doc.rect(0, (H / 40) * s, W, H / 40 + 0.5, "F");
    }

    // ── Logo centered at top (exact SVG, no extra text) ──
    doc.addImage(logoPng, "PNG", CX - logoMmW / 2, 30, logoMmW, logoMmH);

    // ── Tagline ──
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(156, 163, 175); // #9CA3AF
    doc.text("Scan to check in & earn your points", CX, 30 + logoMmH + 10, { align: "center" });

    // ── QR code ──
    const qrUrl = await QRCode.toDataURL(`lifeline://checkin/${loc.key}`, {
      width: 600, margin: 2, color: { dark: "#1F2937", light: "#FFFFFF" },
    });
    const qrMm = 70, qrY = 78;

    // White card shadow
    doc.setFillColor(215, 218, 215);
    doc.roundedRect(CX - qrMm / 2 - 6 + 0.7, qrY - 5 + 0.7, qrMm + 12, qrMm + 10, 4, 4, "F");
    // White card
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(CX - qrMm / 2 - 6, qrY - 5, qrMm + 12, qrMm + 10, 4, 4, "F");
    // Subtle border
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(CX - qrMm / 2 - 6, qrY - 5, qrMm + 12, qrMm + 10, 4, 4, "S");

    doc.addImage(qrUrl, "PNG", CX - qrMm / 2, qrY, qrMm, qrMm);

    // ── Location name ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55); // #1F2937
    const nameLines = doc.splitTextToSize(loc.name, 140);
    const nameY = qrY + qrMm + 18;
    doc.text(nameLines, CX, nameY, { align: "center" });
    const nameBlockH = nameLines.length * 7;

    // ── Address ──
    let addrH = 0;
    if (loc.address) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text(loc.address, CX, nameY + nameBlockH + 2, { align: "center" });
      addrH = 7;
    }

    // ── Points pill (pure coordinate math) ──
    const pillLabel = `+${loc.points} points`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const pillTextW = doc.getTextWidth(pillLabel);
    const pillPadX = 10, pillPadY = 4;
    const pillW = pillTextW + pillPadX * 2;
    const pillH = 4 + pillPadY * 2; // font ~4mm + padding
    const pillY = nameY + nameBlockH + addrH + 6;
    // Background
    doc.setFillColor(240, 253, 244); // very light emerald
    doc.roundedRect(CX - pillW / 2, pillY, pillW, pillH, pillH / 2, pillH / 2, "F");
    // Border
    doc.setDrawColor(16, 185, 129); // #10B981
    doc.setLineWidth(0.5);
    doc.roundedRect(CX - pillW / 2, pillY, pillW, pillH, pillH / 2, pillH / 2, "S");
    // Text — exact vertical center: top + half height + ~1/3 of font size
    doc.setTextColor(16, 185, 129);
    doc.text(pillLabel, CX, pillY + pillH / 2 + 1.3, { align: "center" });

    // ── Footer: charcoal bar ──
    const fH = 16, fY = H - fH;
    doc.setFillColor(31, 41, 55);
    doc.rect(0, fY, W, fH, "F");
    // Emerald accent line
    doc.setFillColor(16, 185, 129);
    doc.rect(0, fY, W, 0.8, "F");

    // "Lifeline Health"
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Lifeline Health", 12, fY + 5.5);

    // "Download the free app"
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(130, 140, 150);
    doc.text("Download the free app", 12, fY + 9.5);

    // Store labels
    doc.setFontSize(5.5);
    doc.setTextColor(110, 120, 130);
    doc.text("App Store  |  Google Play", 12, fY + 13);

    // Small app QR on the right
    doc.addImage(appQR, "PNG", W - 17, fY + 2, 12, 12);
  }

  doc.save(filename);
}
