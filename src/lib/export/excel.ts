// ----------------------------------------------------------------------------
//  خروجی Excel (.xlsx) با exceljs: صفحه‌ی راست‌به‌چپ، سرجدول رنگی، رنگ وضعیت‌ها،
//  عرض ستون مناسب و آمادهٔ چاپ. هر بخش گزارش در همان شیت، زیر بخش قبلی می‌آید.
// ----------------------------------------------------------------------------

import ExcelJS from "exceljs";
import type { Cell, ExportDoc, Tone } from "./doc";
import { SITE_NAME } from "./doc";

const FONT = "Tahoma";
const ARGB: Record<Tone, string> = { ok: "FF15803D", bad: "FFB91C1C", warn: "FFB45309", muted: "FF64748B", strong: "FF1D4ED8" };
const BG: Partial<Record<Tone, string>> = { ok: "FFDCFCE7", bad: "FFFEE2E2", warn: "FFFEF3C7", strong: "FFDBEAFE" };
const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

const sheetName = (s: string) => s.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

export async function renderExcel(doc: ExportDoc): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = SITE_NAME;
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName(doc.title), {
    views: [{ rightToLeft: true, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: doc.orientation,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  // تعداد ستون‌ها برای ادغام عنوان و محاسبه‌ی عرض
  const cols = Math.max(4, ...doc.tables.map((t) => t.headers.length));
  // ستون اول (ردیف) باریک، ستون دوم (نام/عنوان) پهن، بقیه متوسط
  const colWidth = (i: number, t?: { headers: string[] }) => {
    if (i === 0) return 7;
    if (i === 1) return 28;
    return t && t.headers.length > 8 ? 6 : 14;
  };
  for (let i = 1; i <= cols; i++) ws.getColumn(i).width = colWidth(i, doc.tables[0]);

  let r = 1;
  const merge = (row: number, from: number, to: number) => {
    if (to > from) ws.mergeCells(row, from, row, to);
  };
  const styleCell = (
    c: ExcelJS.Cell,
    o: { bold?: boolean; size?: number; color?: string; fill?: string; align?: ExcelJS.Alignment["horizontal"]; border?: boolean; wrap?: boolean },
  ) => {
    c.font = { name: FONT, size: o.size ?? 11, bold: o.bold, color: o.color ? { argb: o.color } : undefined };
    c.alignment = { horizontal: o.align ?? "right", vertical: "middle", readingOrder: "rtl", wrapText: o.wrap ?? false };
    if (o.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
    if (o.border) c.border = thin;
  };

  // عنوان
  ws.getRow(r).height = 30;
  ws.getCell(r, 1).value = doc.title;
  merge(r, 1, cols);
  styleCell(ws.getCell(r, 1), { bold: true, size: 16, color: "FF0F172A", align: "center" });
  r++;
  ws.getCell(r, 1).value = doc.subtitle;
  merge(r, 1, cols);
  styleCell(ws.getCell(r, 1), { size: 11, color: "FF475569", align: "center" });
  r++;
  ws.getCell(r, 1).value = SITE_NAME;
  merge(r, 1, cols);
  styleCell(ws.getCell(r, 1), { bold: true, size: 12, color: "FF1E40AF", align: "center" });
  r += 2;

  // مشخصات
  for (const [k, v] of doc.meta) {
    const kc = ws.getCell(r, 1);
    kc.value = k;
    styleCell(kc, { bold: true, color: "FF1E3A8A", fill: "FFEFF6FF", border: true });
    // ستون اول باریک است: برچسب را در ستون ۱–۲ ادغام و مقدار را در بقیه می‌گذاریم
    ws.mergeCells(r, 1, r, 2);
    const vc = ws.getCell(r, 3);
    vc.value = v;
    if (cols > 3) ws.mergeCells(r, 3, r, cols);
    styleCell(vc, { border: true });
    for (let c = 3; c <= cols; c++) ws.getCell(r, c).border = thin;
    r++;
  }
  r++;

  // خلاصه
  if (doc.summary?.length) {
    for (const s of doc.summary) {
      const lc = ws.getCell(r, 1);
      lc.value = s.label;
      ws.mergeCells(r, 1, r, 2);
      styleCell(lc, { bold: true, color: "FF1E3A8A", fill: "FFF1F5F9", border: true });
      const vc = ws.getCell(r, 3);
      vc.value = s.value;
      if (cols > 3) ws.mergeCells(r, 3, r, cols);
      styleCell(vc, { bold: true, size: 12, color: s.tone ? ARGB[s.tone] : "FF0F172A", border: true, align: "center" });
      r++;
    }
    r++;
  }

  // جدول‌ها
  for (const t of doc.tables) {
    if (t.heading) {
      ws.getCell(r, 1).value = t.heading;
      merge(r, 1, t.headers.length);
      styleCell(ws.getCell(r, 1), { bold: true, size: 13, color: "FF1E3A8A" });
      ws.getRow(r).height = 22;
      r++;
    }
    // سرجدول
    t.headers.forEach((h, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = h;
      styleCell(c, { bold: true, color: "FFFFFFFF", fill: "FF1E40AF", align: "center", border: true, wrap: true });
    });
    ws.getRow(r).height = 24;
    r++;
    // ردیف‌ها
    const writeRow = (cells: Cell[], opts: { total?: boolean; zebra?: boolean }) => {
      cells.forEach((cell, i) => {
        const c = ws.getCell(r, i + 1);
        const text = typeof cell === "string" ? cell : cell.t;
        const tone = typeof cell === "string" ? undefined : cell.tone;
        c.value = text === "" ? null : (/^[0-9.]+$/.test(text) ? Number(text) : text);
        styleCell(c, {
          bold: opts.total || (!!tone && tone !== "muted"),
          color: tone && !opts.total ? ARGB[tone] : undefined,
          fill: opts.total ? "FFF1F5F9" : tone && BG[tone] ? BG[tone] : opts.zebra ? "FFF8FAFC" : undefined,
          align: i === 1 ? "right" : "center",
          border: true,
          wrap: true,
        });
      });
      r++;
    };
    t.rows.forEach((row, idx) => writeRow(row, { zebra: idx % 2 === 1 }));
    if (t.totalRow) writeRow(t.totalRow, { total: true });
    r++;
  }

  // یادداشت‌ها
  for (const n of doc.notes) {
    ws.getCell(r, 1).value = n;
    merge(r, 1, cols);
    styleCell(ws.getCell(r, 1), { size: 10, color: "FF64748B" });
    r++;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
