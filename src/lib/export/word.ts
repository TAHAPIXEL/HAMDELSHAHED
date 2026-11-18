// ----------------------------------------------------------------------------
//  خروجی Word (.docx) با کتابخانه docx: راست‌به‌چپ، جدول‌های RTL، رنگ وضعیت‌ها.
// ----------------------------------------------------------------------------

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  VerticalAlign,
} from "docx";
import type { Cell, ExportDoc, ExportTable, Tone } from "./doc";
import { SITE_NAME } from "./doc";

const FONT = "Tahoma";
const COLOR: Record<Tone, string> = { ok: "15803D", bad: "B91C1C", warn: "B45309", muted: "64748B", strong: "1D4ED8" };
const BG: Partial<Record<Tone, string>> = { ok: "DCFCE7", bad: "FEE2E2", warn: "FEF3C7", strong: "DBEAFE" };
const HEAD_BG = "1E40AF";
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" } as const;
const borders = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const run = (text: string, o: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({
    text,
    bold: o.bold,
    size: o.size ?? 22,
    color: o.color,
    font: { name: FONT, cs: FONT, hint: "cs" },
    rightToLeft: true,
  });

const para = (text: string, o: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) =>
  new Paragraph({
    bidirectional: true,
    alignment: o.align ?? AlignmentType.RIGHT,
    spacing: { before: o.before ?? 0, after: o.after ?? 80 },
    children: [run(text, o)],
  });

function cell(c: Cell, width: number, o: { head?: boolean; total?: boolean; center?: boolean } = {}) {
  const text = typeof c === "string" ? c : c.t;
  const tone = typeof c === "string" ? undefined : c.tone;
  const fill = o.head ? HEAD_BG : o.total ? "F1F5F9" : tone ? BG[tone] : undefined;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    verticalAlign: VerticalAlign.CENTER,
    shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        children: [
          run(text, {
            bold: o.head || o.total || (!!tone && tone !== "muted"),
            size: o.head ? 20 : 19,
            color: o.head ? "FFFFFF" : tone && !o.total ? COLOR[tone] : undefined,
          }),
        ],
      }),
    ],
  });
}

function table(t: ExportTable, totalWidth: number) {
  const n = t.headers.length;
  const weights = t.widths?.length === n ? t.widths : Array(n).fill(1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((w / sum) * totalWidth));
  const rows: TableRow[] = [
    new TableRow({ tableHeader: true, children: t.headers.map((h, i) => cell(h, widths[i], { head: true })) }),
    ...t.rows.map(
      (r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i])) }),
    ),
  ];
  if (t.totalRow) rows.push(new TableRow({ cantSplit: true, children: t.totalRow.map((c, i) => cell(c, widths[i], { total: true })) }));
  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    visuallyRightToLeft: true,
    rows,
  });
}

function metaTable(doc: ExportDoc, totalWidth: number) {
  const kw = Math.round(totalWidth * 0.26);
  const vw = totalWidth - kw;
  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: [kw, vw],
    visuallyRightToLeft: true,
    rows: doc.meta.map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: kw, type: WidthType.DXA },
              borders,
              shading: { type: ShadingType.CLEAR, color: "auto", fill: "EFF6FF" },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [run(k, { bold: true, size: 20, color: "1E3A8A" })] })],
            }),
            new TableCell({
              width: { size: vw, type: WidthType.DXA },
              borders,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [run(v, { size: 20 })] })],
            }),
          ],
        }),
    ),
  });
}

function summaryTable(doc: ExportDoc, totalWidth: number) {
  const items = doc.summary ?? [];
  if (!items.length) return null;
  const cols = Math.min(items.length, 6);
  const w = Math.floor(totalWidth / cols);
  const chunks: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += cols) chunks.push(items.slice(i, i + cols));
  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: w * cols, type: WidthType.DXA },
    columnWidths: Array(cols).fill(w),
    visuallyRightToLeft: true,
    rows: chunks.map(
      (row) =>
        new TableRow({
          children: Array.from({ length: cols }, (_, i) => {
            const s = row[i];
            return new TableCell({
              width: { size: w, type: WidthType.DXA },
              borders,
              margins: { top: 90, bottom: 90, left: 80, right: 80 },
              children: s
                ? [
                    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [run(s.value, { bold: true, size: 26, color: s.tone ? COLOR[s.tone] : "0F172A" })] }),
                    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [run(s.label, { size: 18, color: "64748B" })] }),
                  ]
                : [new Paragraph("")],
            });
          }),
        }),
    ),
  });
}

export async function renderWord(doc: ExportDoc): Promise<Blob> {
  const landscape = doc.orientation === "landscape";
  // A4 به twip؛ حاشیه حدود ۱۲ میلی‌متر (۶۸۰ twip) برای دو طرف
  const pageW = landscape ? 16838 : 11906;
  const pageH = landscape ? 11906 : 16838;
  const margin = 680;
  const contentW = pageW - margin * 2;

  const children: (Paragraph | Table)[] = [
    para(doc.title, { bold: true, size: 34, color: "0F172A", after: 60 }),
    para(doc.subtitle, { size: 22, color: "475569", after: 120 }),
    para(SITE_NAME, { bold: true, size: 24, color: HEAD_BG, after: 200 }),
    metaTable(doc, contentW),
  ];
  const sum = summaryTable(doc, contentW);
  if (sum) {
    children.push(para("خلاصه", { bold: true, size: 26, color: "1E3A8A", before: 240, after: 100 }));
    children.push(sum);
  }
  for (const t of doc.tables) {
    if (t.heading) children.push(para(t.heading, { bold: true, size: 26, color: "1E3A8A", before: 260, after: 100 }));
    children.push(table(t, contentW));
  }
  for (const n of doc.notes) children.push(para(n, { size: 19, color: "64748B", before: 120, after: 60 }));

  const word = new Document({
    creator: SITE_NAME,
    title: doc.title,
    description: doc.subtitle,
    styles: { default: { document: { run: { font: FONT, size: 22, rightToLeft: true } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: pageW, height: pageH, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(word);
}
