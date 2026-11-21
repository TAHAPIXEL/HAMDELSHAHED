// ----------------------------------------------------------------------------
//  نقطه‌ی ورود خروجی: ساخت فایل و دانلود. کتابخانه‌های سنگین فقط هنگام کلیک لود می‌شوند.
// ----------------------------------------------------------------------------

import type { ExportDoc } from "./doc";
import { saveFile } from "@/lib/native";

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
  await saveBlob(blob, `${doc.file}.${EXT[format]}`);
}

export async function saveBlob(blob: Blob, name: string): Promise<void> {
  await saveFile(blob, name);
}

export type { ExportDoc } from "./doc";
