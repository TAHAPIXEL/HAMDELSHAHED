"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, FileType2, Loader2 } from "lucide-react";
import type { ExportDoc } from "@/lib/export/doc";
import { exportDocument, FORMAT_LABEL, type ExportFormat } from "@/lib/export";
import { useToast } from "./ui";

/** سه دکمه‌ی PDF / Word / Excel برای یک سند. build هنگام کلیک داده را می‌خواند. */
export function ExportButtons({ build, disabled }: { build: () => ExportDoc | null; disabled?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat) => {
    const doc = build();
    if (!doc) {
      toast("error", "داده‌ای برای خروجی پیدا نشد");
      return;
    }
    setBusy(format);
    try {
      await exportDocument(doc, format);
      toast("success", `فایل ${FORMAT_LABEL[format]} آماده شد`);
    } catch (e) {
      console.error(e);
      toast("error", `ساخت فایل ${FORMAT_LABEL[format]} انجام نشد`);
    } finally {
      setBusy(null);
    }
  };

  const items: { f: ExportFormat; icon: React.ReactNode; cls: string }[] = [
    { f: "pdf", icon: <FileText className="size-4" />, cls: "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10" },
    { f: "word", icon: <FileType2 className="size-4" />, cls: "text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10" },
    { f: "excel", icon: <FileSpreadsheet className="size-4" />, cls: "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button
          key={it.f}
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => run(it.f)}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[12.5px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 ${it.cls}`}
        >
          {busy === it.f ? <Loader2 className="size-4 animate-spin" /> : it.icon}
          <span>{FORMAT_LABEL[it.f]}</span>
          <Download className="size-3.5 opacity-50" />
        </button>
      ))}
    </div>
  );
}
