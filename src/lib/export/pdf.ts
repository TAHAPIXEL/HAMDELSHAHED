// ----------------------------------------------------------------------------
//  خروجی PDF: سند را در مرورگر با فونت Abar رندر می‌کنیم (شکل‌دهی فارسی درست)،
//  سپس صفحه‌به‌صفحه در A4 قرار می‌دهیم. برش صفحات روی مرز ردیف‌ها انجام می‌شود.
// ----------------------------------------------------------------------------

import type { ExportDoc, Cell, Tone } from "./doc";
import { SITE_NAME } from "./doc";

const TONE_COLOR: Record<Tone, string> = {
  ok: "#15803d",
  bad: "#b91c1c",
  warn: "#b45309",
  muted: "#64748b",
  strong: "#1d4ed8",
};
const TONE_BG: Record<Tone, string> = {
  ok: "#dcfce7",
  bad: "#fee2e2",
  warn: "#fef3c7",
  muted: "transparent",
  strong: "#dbeafe",
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function cellHtml(c: Cell, head = false, total = false): string {
  const text = typeof c === "string" ? c : c.t;
  const tone = typeof c === "string" ? undefined : c.tone;
  const style = [
    tone && !head ? `color:${TONE_COLOR[tone]};background:${TONE_BG[tone]};font-weight:800` : "",
    total ? "font-weight:900;background:#f1f5f9" : "",
  ].join(";");
  return `<td data-brk="" style="${style}">${esc(text)}</td>`;
}

export function buildHtml(doc: ExportDoc): string {
  const css = `
    *{box-sizing:border-box}
    .hm-title{font-family:'Abar High',Tahoma,sans-serif;font-weight:900;font-size:24px;color:#0f172a;margin:0}
    .hm-sub{font-family:'Abar Mid',Tahoma,sans-serif;font-size:13px;color:#475569;margin-top:6px}
    .hm-h{font-family:'Abar High',Tahoma,sans-serif;font-weight:800;font-size:14px;color:#1e3a8a;margin:18px 0 8px}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-family:'Abar Low',Tahoma,sans-serif;font-size:11.5px}
    th{background:#1e40af;color:#fff;font-family:'Abar High',Tahoma,sans-serif;font-weight:800;padding:7px 4px;border:1px solid #1e40af;text-align:center}
    td{border:1px solid #cbd5e1;padding:6px 4px;text-align:center;color:#0f172a;word-wrap:break-word}
    tr:nth-child(even) td{background:#f8fafc}
    .hm-meta td{font-family:'Abar Mid',Tahoma,sans-serif;font-size:12px;padding:6px 8px}
    .hm-meta td.k{background:#eff6ff;font-weight:800;color:#1e3a8a;width:24%;text-align:right}
    .hm-meta td.v{text-align:right;font-weight:600}
    .hm-sum{display:flex;gap:8px;margin-top:4px}
    .hm-sum div{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 6px;text-align:center}
    .hm-sum b{display:block;font-family:'Abar High',Tahoma,sans-serif;font-size:16px;font-weight:900}
    .hm-sum span{font-family:'Abar Mid',Tahoma,sans-serif;font-size:11px;color:#64748b}
    .hm-note{font-family:'Abar Mid',Tahoma,sans-serif;font-size:11px;color:#64748b;margin-top:6px;line-height:1.9}
    .hm-foot{margin-top:18px;border-top:2px solid #1e40af;padding-top:8px;display:flex;justify-content:space-between;font-family:'Abar Mid',Tahoma,sans-serif;font-size:11px;color:#64748b}
  `;

  const meta = `<table class="hm-meta">${doc.meta
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`)
    .join("")}</table>`;

  const summary = doc.summary?.length
    ? `<div class="hm-h">خلاصه</div><div class="hm-sum">${doc.summary
        .map(
          (s) =>
            `<div style="${s.tone ? `color:${TONE_COLOR[s.tone]}` : ""}"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`,
        )
        .join("")}</div>`
    : "";

  const tables = doc.tables
    .map((t) => {
      const cols = t.widths?.length ? `<colgroup>${t.widths.map((w) => `<col style="width:${w}%">`).join("")}</colgroup>` : "";
      const head = `<thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`;
      const body = `<tbody>${t.rows.map((r) => `<tr>${r.map((c) => cellHtml(c)).join("")}</tr>`).join("")}${
        t.totalRow ? `<tr>${t.totalRow.map((c) => cellHtml(c, false, true)).join("")}</tr>` : ""
      }</tbody>`;
      return `${t.heading ? `<div class="hm-h">${esc(t.heading)}</div>` : ""}<table>${cols}${head}${body}</table>`;
    })
    .join("");

  const notes = doc.notes.map((n) => `<div class="hm-note">${esc(n)}</div>`).join("");

  return `<style>${css}</style>
    <div data-brk="">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:3px solid #1e40af;padding-bottom:12px">
        <div>
          <div class="hm-title">${esc(doc.title)}</div>
          <div class="hm-sub">${esc(doc.subtitle)}</div>
        </div>
        <div style="font-family:'Abar High',Tahoma,sans-serif;font-weight:900;font-size:18px;color:#1e40af">${esc(SITE_NAME)}</div>
      </div>
    </div>
    <div data-brk="" style="margin-top:14px">${meta}</div>
    <div data-brk="">${summary}</div>
    ${tables}
    <div data-brk="">${notes}</div>
    <div class="hm-foot" data-brk=""><span>${esc(SITE_NAME)}</span><span>${esc(doc.title)}</span></div>`;
}

/** کد PDF به‌صورت Blob (اجرا فقط در مرورگر) */
export async function renderPdf(doc: ExportDoc): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const landscape = doc.orientation === "landscape";
  const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10; // mm

  const contentW = pageW - margin * 2;
  const widthPx = Math.round(contentW * (96 / 25.4)); // عرض محتوا در CSS px
  const host = document.createElement("div");
  host.setAttribute("dir", "rtl");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${widthPx}px;padding:6px 4px;background:#ffffff;color:#0f172a;direction:rtl;`;
  host.innerHTML = buildHtml(doc);
  document.body.appendChild(host);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = await html2canvas(host, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });

    const hostTop = host.getBoundingClientRect().top;
    const pxPerCss = canvas.width / widthPx;
    const pageCssH = (pageH - margin * 2) * (96 / 25.4); // ارتفاع هر صفحه در CSS px
    // نقاط مجاز برش: بالای هر ردیف/بلوک
    const breaks = Array.from(host.querySelectorAll<HTMLElement>("[data-brk], tr"))
      .map((el) => el.getBoundingClientRect().top - hostTop)
      .filter((y) => y > 0)
      .sort((a, b) => a - b);
    const totalCss = host.getBoundingClientRect().height;

    let start = 0;
    let first = true;
    while (start < totalCss - 1) {
      let end = start + pageCssH;
      if (end < totalCss) {
        const candidates = breaks.filter((y) => y > start + pageCssH * 0.5 && y <= end);
        if (candidates.length) end = candidates[candidates.length - 1];
      } else {
        end = totalCss;
      }
      const sy = Math.round(start * pxPerCss);
      const sh = Math.max(1, Math.round((end - start) * pxPerCss));
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sh;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, sh);
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      if (!first) pdf.addPage();
      first = false;
      const hMm = (sh / pxPerCss) / (96 / 25.4);
      pdf.addImage(slice.toDataURL("image/jpeg", 0.93), "JPEG", margin, margin, contentW, hMm, undefined, "FAST");
      start = end;
    }
  } finally {
    host.remove();
  }
  return pdf.output("blob");
}
