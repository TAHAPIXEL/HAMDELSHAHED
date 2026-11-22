"use client";

import { BarChart3, Camera, FileText, Image as ImageIcon } from "lucide-react";

/** برگه‌ی پیوست، مثل تلگرام: هر گزینه مستقیم انتخابگر سیستم را باز می‌کند */
export function AttachSheet({
  open,
  onClose,
  onGallery,
  onCamera,
  onFile,
  onPoll,
}: {
  open: boolean;
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
  onFile: () => void;
  onPoll?: () => void;
}) {
  if (!open) return null;
  const items = [
    { label: "گالری", icon: ImageIcon, tone: "bg-accent", run: onGallery },
    { label: "دوربین", icon: Camera, tone: "bg-accent", run: onCamera },
    { label: "فایل", icon: FileText, tone: "bg-[#e0873a]", run: onFile },
    ...(onPoll ? [{ label: "نظرسنجی", icon: BarChart3, tone: "bg-[#8a6cf0]", run: onPoll }] : []),
  ];
  const pick = (run: () => void) => {
    onClose();
    run();
  };
  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="پیوست">
      <button className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-label="بستن" />
      <div className="anim-pop absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[26px] bg-ink pb-[max(env(safe-area-inset-bottom),14px)] text-white shadow-2xl">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-surface/25" />
        <div className="grid grid-cols-4 gap-2 px-4 pb-2 pt-4">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => pick(it.run)}
              className="flex flex-col items-center gap-2 rounded-2xl py-3 transition hover:bg-surface/5 active:scale-95"
            >
              <span className={`grid size-12 place-items-center rounded-full text-white ${it.tone}`}>
                <it.icon className="size-5" />
              </span>
              <span className="text-[12px] font-bold text-white/85">{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
