// ----------------------------------------------------------------------------
//  نقطه‌ی ورود خروجی: ساخت فایل و دانلود. کتابخانه‌های سنگین فقط هنگام کلیک لود می‌شوند.
// ----------------------------------------------------------------------------

import type { ExportDoc } from "./doc";

export type ExportFormat = "pdf" | "word" | "excel";
export const FORMAT_LABEL: Record<ExportFormat, string> = { pdf: "PDF", word: "Word", excel: "Excel" };
const EXT: Record<ExportFormat, string> = { pdf: "pdf", word: "docx", excel: "xlsx" };

export async function exportDocument(doc: ExportDoc, format: ExportFormat): Promise<void> {
  const blob =
    format === "pdf"
      ? await (await import("./pdf")).renderPdf(doc)
      : format === "word"
        ? await (await import("./word")).renderWord(doc)
        : await (await import("./excel")).renderExcel(doc);
  saveBlob(blob, `${doc.file}.${EXT[format]}`);
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type { ExportDoc } from "./doc";
