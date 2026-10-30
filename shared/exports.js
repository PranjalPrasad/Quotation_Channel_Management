/* ============================================================
 * Exporter — one look for Print, PDF and Excel across every module.
 *
 *   Exporter.print({ title, docNo, meta, sections, total })
 *   Exporter.pdfTable({ filename, title, subtitle, columns, rows })
 *   Exporter.excelTable({ filename, sheetName, title, subtitle, columns, rows })
 *
 * Shared column spec (PDF + Excel use the same array):
 *   { header, get: row => value, type: "text"|"money"|"number"|"date",
 *     total: true (sum in footer), width: excel column width, pdf: false (skip in PDF) }
 *
 * Branding can be changed once, before this file loads:
 *   window.EXPORT_BRAND = { company: "...", tagline: "...", logo: "/img/logo.webp" };
 * ============================================================ */
(function () {
  const cfg = Object.assign({
    company: "Sun Greaves EcoTech",
    tagline: "Solar Quotation Management",
    logo: "/img/logo.webp",
    primary: "#810B38",
    dark: "#541A1A",
    cream: "#F7ECE1",
    line: "#DCC3AA",
    text: "#1F2937",
    muted: "#6B7280",
    locale: "en-IN",
  }, window.EXPORT_BRAND || {});

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const num = (n) => Number(n) || 0;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- formatting (identical everywhere) ----------
  // symbol: "₹" for HTML/print/Excel, "Rs. " for PDF (jsPDF's built-in fonts have no ₹ glyph)
  function fmtMoney(n, symbol = "₹") {
    const x = num(n);
    const body = Math.abs(x).toLocaleString(cfg.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (x < 0 ? "-" : "") + symbol + body;
  }
  function fmtDate(v) {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d) ? "—" : d.toLocaleDateString(cfg.locale, { day: "2-digit", month: "short", year: "numeric" });
  }
  function fmtNow() {
    return new Date().toLocaleString(cfg.locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // ---------- helpers ----------
  const scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Failed to load " + src));
        document.head.appendChild(s);
      });
    }
    return scriptCache[src];
  }

  let logoPromise;
  /** Logo as PNG data-URL (jsPDF can't embed WebP). Resolves null if unavailable. */
  function logoPng() {
    if (!logoPromise) {
      logoPromise = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext("2d").drawImage(img, 0, 0);
            resolve({ data: c.toDataURL("image/png"), w: c.width, h: c.height });
          } catch (_) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = cfg.logo;
      });
    }
    return logoPromise;
  }

  function cellValue(col, row) {
    return typeof col.get === "function" ? col.get(row) : row[col.key];
  }

  // ============================================================
  // PRINT SLIP
  // ============================================================
  function ensurePrintStyle() {
    if (document.getElementById("xp-style")) return;
    const st = document.createElement("style");
    st.id = "xp-style";
    st.textContent = `
      @page { size: A4; margin: 12mm; }
      @media print {
        html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
        .app-shell, .modal-overlay, #toast-container, #sidebarBackdrop { display: none !important; }
        .print-area { position: static !important; padding: 0 !important; width: 100% !important; }
        .xp-doc, .xp-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      .xp-doc { font-family: Poppins, Arial, sans-serif; color: ${cfg.text}; font-size: 12px; }
      .xp-head { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 3px solid ${cfg.primary}; margin-bottom: 16px; }
      .xp-brand { display: flex; align-items: center; gap: 12px; }
      .xp-logo { height: 46px; width: auto; object-fit: contain; }
      .xp-company { font-size: 17px; font-weight: 700; color: ${cfg.primary}; line-height: 1.2; }
      .xp-tag { font-size: 10.5px; color: ${cfg.muted}; }
      .xp-docinfo { text-align: right; }
      .xp-title { font-size: 14px; font-weight: 700; color: ${cfg.dark}; text-transform: uppercase; letter-spacing: .04em; }
      .xp-meta { font-size: 10.5px; color: ${cfg.muted}; margin-top: 3px; line-height: 1.5; }
      .xp-sec { margin-bottom: 14px; page-break-inside: avoid; }
      .xp-sec-title { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #fff; background: ${cfg.primary}; padding: 5px 9px; border-radius: 4px 4px 0 0; }
      .xp-table { width: 100%; border-collapse: collapse; border: 1px solid ${cfg.line}; border-top: none; }
      .xp-table td { padding: 6px 9px; border-bottom: 1px solid #EFE3D5; font-size: 12px; }
      .xp-table tr:nth-child(even) td { background: #FBF6EF; }
      .xp-table .xp-op { width: 22px; color: #B9997C; font-weight: 700; text-align: center; padding-right: 0; }
      .xp-table .xp-val { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .xp-table tr.xp-strong td { font-weight: 700; background: ${cfg.cream}; border-top: 1.5px solid ${cfg.line}; }
      .xp-table tr.xp-neg .xp-val { color: #E11D48; }
      .xp-total { display: flex; justify-content: space-between; align-items: center; background: ${cfg.dark}; color: #fff; padding: 11px 14px; border-radius: 6px; margin: 4px 0 16px; }
      .xp-total span { font-size: 13px; font-weight: 600; }
      .xp-total strong { font-size: 18px; font-variant-numeric: tabular-nums; }
      .xp-foot { display: flex; justify-content: space-between; border-top: 1px solid ${cfg.line}; padding-top: 8px; font-size: 10px; color: ${cfg.muted}; }
    `;
    document.head.appendChild(st);
  }

  /**
   * sections: [{ title, rows: [{ label, value, op?, strong?, negative? }] }]
   * value may be a number (formatted as money) or a ready string.
   */
  async function print({ title, docNo, meta = [], sections = [], total, note } = {}) {
    ensurePrintStyle();
    let area = document.getElementById("printArea");
    if (!area) { area = document.createElement("div"); area.id = "printArea"; area.className = "print-area"; document.body.appendChild(area); }

    const showVal = (v) => (typeof v === "number" ? fmtMoney(v) : esc(v));
    const metaLines = [];
    if (docNo) metaLines.push(`Ref: <b>${esc(docNo)}</b>`);
    meta.forEach(([k, v]) => metaLines.push(`${esc(k)}: ${esc(v)}`));
    metaLines.push(`Date: ${esc(fmtDate(new Date()))}`);

    area.innerHTML = `
      <div class="xp-doc">
        <div class="xp-head">
          <div class="xp-brand">
            <img class="xp-logo" id="xpLogo" src="${esc(cfg.logo)}" alt="" onerror="this.style.display='none'">
            <div><div class="xp-company">${esc(cfg.company)}</div><div class="xp-tag">${esc(cfg.tagline)}</div></div>
          </div>
          <div class="xp-docinfo"><div class="xp-title">${esc(title)}</div><div class="xp-meta">${metaLines.join("<br>")}</div></div>
        </div>
        ${sections.map((s) => {
          const hasOp = s.rows.some((r) => r.op !== undefined);
          return `<div class="xp-sec"><div class="xp-sec-title">${esc(s.title)}</div><table class="xp-table"><tbody>
            ${s.rows.map((r) => `<tr class="${r.strong ? "xp-strong" : ""} ${r.negative ? "xp-neg" : ""}">
              ${hasOp ? `<td class="xp-op">${esc(r.op || "")}</td>` : ""}<td>${esc(r.label)}</td><td class="xp-val">${showVal(r.value)}</td></tr>`).join("")}
          </tbody></table></div>`;
        }).join("")}
        ${total ? `<div class="xp-total"><span>${esc(total.label)}</span><strong>${showVal(total.value)}</strong></div>` : ""}
        ${note ? `<p style="font-size:10.5px;color:${cfg.muted};margin:0 0 12px">${esc(note)}</p>` : ""}
        <div class="xp-foot"><span>${esc(cfg.company)} · ${esc(cfg.tagline)}</span><span>Generated on ${esc(fmtNow())}</span></div>
      </div>`;

    const img = document.getElementById("xpLogo");
    if (img && !img.complete) await new Promise((r) => { img.onload = r; img.onerror = r; });
    window.print();
  }

  // ============================================================
  // PDF TABLE
  // ============================================================
  async function pdfTable({ filename = "export.pdf", title, subtitle, columns, rows, orientation = "landscape" }) {
    if (!window.jspdf) throw new Error("PDF library failed to load");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation });
    if (typeof doc.autoTable !== "function") throw new Error("PDF table plugin failed to load");
    const logo = await logoPng();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const M = 36;
    const primary = rgb(cfg.primary), dark = rgb(cfg.dark), cream = rgb(cfg.cream), muted = rgb(cfg.muted);

    const cols = columns.filter((c) => c.pdf !== false);
    const fmt = (c, v) => c.type === "money" ? fmtMoney(v, "Rs. ")
      : c.type === "date" ? fmtDate(v)
      : c.type === "number" ? (Number(v) || 0).toLocaleString(cfg.locale)
      : String(v ?? "");

    const body = rows.map((r) => cols.map((c) => fmt(c, cellValue(c, r))));
    const hasTotals = cols.some((c) => c.total);
    const foot = hasTotals ? [cols.map((c, i) => {
      if (c.total) return fmt(c, rows.reduce((s, r) => s + num(cellValue(c, r)), 0));
      return i === 0 ? "Total" : "";
    })] : undefined;

    const drawHeader = () => {
      doc.setFillColor(...cream); doc.rect(0, 0, pw, 62, "F");
      let x = M;
      if (logo) { const h = 36, w = h * logo.w / logo.h; doc.addImage(logo.data, "PNG", x, 13, w, h); x += w + 10; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...primary); doc.text(cfg.company, x, 31);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...muted); doc.text(cfg.tagline, x, 45);
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...dark); doc.text(title, pw - M, 31, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...muted);
      doc.text(subtitle || "", pw - M, 45, { align: "right" });
      doc.setDrawColor(...primary); doc.setLineWidth(2); doc.line(0, 62, pw, 62);
    };

    doc.autoTable({
      head: [cols.map((c) => c.header)],
      body, foot,
      startY: 80,
      margin: { top: 80, left: M, right: M, bottom: 42 },
      showFoot: "lastPage",
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, lineColor: rgb(cfg.line), lineWidth: 0.4, textColor: rgb(cfg.text), overflow: "linebreak" },
      headStyles: { fillColor: primary, textColor: 255, fontStyle: "bold", halign: "left" },
      footStyles: { fillColor: cream, textColor: dark, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [251, 246, 239] },
      columnStyles: cols.reduce((m, c, i) => {
        if (c.type === "money" || c.type === "number") m[i] = { halign: "right" };
        return m;
      }, {}),
      didParseCell: (d) => {
        const c = cols[d.column.index];
        if (c && (c.type === "money" || c.type === "number") && d.section !== "body") d.cell.styles.halign = "right";
      },
      didDrawPage: drawHeader,
    });

    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...rgb(cfg.line)); doc.setLineWidth(0.6); doc.line(M, ph - 30, pw - M, ph - 30);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
      doc.text(`${cfg.company} · Generated on ${fmtNow()}`, M, ph - 18);
      doc.text(`Page ${i} of ${pages}`, pw - M, ph - 18, { align: "right" });
    }
    doc.save(filename);
  }

  // ============================================================
  // EXCEL TABLE
  // Number formats work with any SheetJS build. Colours / borders / bold apply when the
  // "xlsx-js-style" build is loaded (see README note) and are ignored harmlessly otherwise.
  // ============================================================
  const XL_MONEY = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"##,##0.00';
  const XL_NUM = "#,##0.##";

  function excelTable({ filename = "export.xlsx", sheetName = "Sheet1", title, subtitle, columns, rows }) {
    if (!window.XLSX) throw new Error("Excel library failed to load");
    const X = window.XLSX;
    const cols = columns.filter((c) => c.excel !== false);
    const n = cols.length;
    const ws = {};
    const R0 = 4;                       // header row index (0-based)
    const first = R0 + 1;               // first data row
    const last = R0 + rows.length;      // last data row

    const border = { top: { style: "thin", color: { rgb: "DCC3AA" } }, bottom: { style: "thin", color: { rgb: "DCC3AA" } },
                     left: { style: "thin", color: { rgb: "DCC3AA" } }, right: { style: "thin", color: { rgb: "DCC3AA" } } };
    const put = (r, c, v, opts = {}) => {
      if (v === null || v === undefined) v = "";
      const cell = typeof v === "number" ? { t: "n", v } : { t: "s", v: String(v) };
      if (opts.z) cell.z = opts.z;
      if (opts.f) cell.f = opts.f;
      if (opts.s) cell.s = opts.s;
      ws[X.utils.encode_cell({ r, c })] = cell;
    };

    // brand block
    put(0, 0, cfg.company, { s: { font: { bold: true, sz: 16, color: { rgb: cfg.primary.slice(1) } } } });
    put(1, 0, [title, subtitle].filter(Boolean).join("  ·  "), { s: { font: { bold: true, sz: 12, color: { rgb: cfg.dark.slice(1) } } } });
    put(2, 0, `${cfg.tagline}  ·  Generated on ${fmtNow()}`, { s: { font: { sz: 9, color: { rgb: cfg.muted.slice(1) } } } });

    // header
    cols.forEach((c, i) => put(R0, i, c.header, { s: {
      font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: cfg.primary.slice(1) } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true }, border } }));

    // data
    rows.forEach((row, ri) => {
      cols.forEach((c, ci) => {
        const raw = cellValue(c, row);
        const zebra = ri % 2 ? { fill: { patternType: "solid", fgColor: { rgb: "FBF6EF" } } } : {};
        if (c.type === "money") put(first + ri, ci, num(raw), { z: XL_MONEY, s: { ...zebra, border, alignment: { horizontal: "right" } } });
        else if (c.type === "number") put(first + ri, ci, num(raw), { z: XL_NUM, s: { ...zebra, border, alignment: { horizontal: "right" } } });
        else if (c.type === "date") put(first + ri, ci, fmtDate(raw), { s: { ...zebra, border, alignment: { horizontal: "left" } } });
        else put(first + ri, ci, raw, { s: { ...zebra, border, alignment: { horizontal: "left" } } });
      });
    });

    // totals row (live SUM formulas, value cached too)
    let lastRow = last;
    if (cols.some((c) => c.total) && rows.length) {
      lastRow = last + 1;
      const tstyle = (extra = {}) => ({ font: { bold: true, color: { rgb: cfg.dark.slice(1) } }, fill: { patternType: "solid", fgColor: { rgb: cfg.cream.slice(1) } }, border, ...extra });
      cols.forEach((c, ci) => {
        if (c.total) {
          const L = X.utils.encode_col(ci);
          const sum = rows.reduce((s, r) => s + num(cellValue(c, r)), 0);
          const cell = { t: "n", v: sum, f: `SUM(${L}${first + 1}:${L}${last + 1})`, z: c.type === "money" ? XL_MONEY : XL_NUM, s: tstyle({ alignment: { horizontal: "right" } }) };
          ws[X.utils.encode_cell({ r: lastRow, c: ci })] = cell;
        } else {
          put(lastRow, ci, ci === 0 ? "Total" : "", { s: tstyle() });
        }
      });
    }

    ws["!ref"] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: n - 1 } });
    ws["!cols"] = cols.map((c) => ({ wch: c.width || (c.type === "money" ? 18 : c.type === "date" ? 14 : 18) }));
    ws["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: Math.max(n - 1, 0) } }));
    ws["!rows"] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 14 }, { hpt: 6 }, { hpt: 26 }];
    if (rows.length) ws["!autofilter"] = { ref: X.utils.encode_range({ s: { r: R0, c: 0 }, e: { r: last, c: n - 1 } }) };

    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    X.writeFile(wb, filename);
  }

  window.Exporter = { config: cfg, fmtMoney, fmtDate, fmtNow, print, pdfTable, excelTable };
})();