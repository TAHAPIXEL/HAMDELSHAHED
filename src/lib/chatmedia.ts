// ----------------------------------------------------------------------------
//  فایل و ویس پیام: آپلود مستقیم با درصد پیشرفت، ضبط صدا با شکل موج، دانلود و بازکردن
// ----------------------------------------------------------------------------

import { api } from "@/lib/store";
import { isNativeApp, saveFile } from "@/lib/native";

/** فرمت‌های انتخابی برای ارسال فایل (همان فهرست سرور) */
export const FILE_ACCEPT =
  "application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,audio/*,.mp3,.m4a,.wav,.ogg,.aac";

/** حداکثر حجم فایل انتخابی در مرورگر (هماهنگ با سرور) */
export const CHAT_FILE_MAX = 25 * 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  zip: "application/zip",
  rar: "application/vnd.rar",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
  webm: "audio/webm",
};

export function baseMime(m: string): string {
  return m.split(";")[0].trim().toLowerCase();
}

/** نوع فایل از روی MIME مرورگر یا پسوند نام فایل؛ خالی یعنی نامعتبر */
export function guessMime(name: string, type: string): string {
  const t = baseMime(type || "");
  if (t && t !== "application/octet-stream") return t;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "";
}

/** مدت زمان به شکل m:ss */
export function fmtDur(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** آپلود بلاب به فضای ابری با گزارش پیشرفت؛ پاسخ آدرس نهایی فایل است */
export async function uploadChatBlob(blob: Blob, mime: string, onProgress: (p: number) => void): Promise<string> {
  const type = baseMime(mime);
  const { uploadUrl, url } = await api<{ uploadUrl: string; url: string }>("/api/upload/sign", {
    method: "POST",
    body: { mime: type, size: blob.size },
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error("بارگذاری انجام نشد. دوباره تلاش کنید."));
      }
    };
    xhr.onerror = () => reject(new Error("اتصال برقرار نشد."));
    xhr.send(blob);
  });
  return url;
}

/** دانلود فایل با درصد پیشرفت و ذخیره‌ی آن (در اپ: برگه‌ی اشتراک‌گذاری) */
export async function downloadMedia(url: string, name: string, onProgress?: (p: number) => void): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error("دانلود انجام نشد.");
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress?.(received / total);
  }
  onProgress?.(1);
  const blob = new Blob(chunks as BlobPart[], { type: res.headers.get("content-type") || "application/octet-stream" });
  await saveFile(blob, name);
}

/** بازکردن فایل: در مرورگر تب جدید (تصویر و PDF نمایش داده می‌شود)، در اپ اندروید ذخیره/اشتراک */
export function openMedia(url: string, name: string, onProgress?: (p: number) => void): Promise<void> {
  if (isNativeApp()) return downloadMedia(url, name, onProgress);
  window.open(url, "_blank", "noopener");
  return Promise.resolve();
}

/* ------------------------------- ضبط صدا -------------------------------- */

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/** کاهش نمونه‌های سطح صدا به n میله برای شکل موج */
function resample(levels: number[], n: number): number[] {
  if (levels.length === 0) return Array.from({ length: n }, () => 0.15);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i * levels.length) / n);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / n));
    let sum = 0;
    for (let j = from; j < to; j++) sum += levels[j];
    out.push(Math.round(Math.max(0.08, Math.min(1, (sum / (to - from)) * 1.2)) * 100) / 100);
  }
  return out;
}

export interface Recording {
  blob: Blob;
  mime: string;
  duration: number; // ms
  wave: number[];
}

/** ضبط صدا با MediaRecorder؛ سطح صدا برای شکل موج زنده نمونه‌برداری می‌شود */
export class VoiceRecorder {
  onLevel?: (levels: number[], elapsedMs: number) => void;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: number | null = null;
  private levels: number[] = [];
  private startedAt = 0;

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("ضبط صدا در این دستگاه پشتیبانی نمی‌شود.");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    const mime = pickRecorderMime();
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.levels = [];
    this.rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.rec.start(250);
    this.startedAt = Date.now();

    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try {
      this.ctx = new AC();
      const source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      const buf = new Uint8Array(this.analyser.fftSize);
      this.timer = window.setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        this.levels.push(Math.min(1, Math.sqrt(sum / buf.length) * 3));
        this.onLevel?.(this.levels, Date.now() - this.startedAt);
      }, 100);
    } catch {
      // بدون تحلیل صدا هم ضبط انجام می‌شود؛ شکل موج صاف خواهد بود
      this.timer = window.setInterval(() => this.onLevel?.(this.levels, Date.now() - this.startedAt), 200);
    }
  }

  elapsed(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }

  /** پایان ضبط و برگرداندن فایل صوتی */
  stop(): Promise<Recording> {
    return new Promise((resolve, reject) => {
      const rec = this.rec;
      if (!rec) return reject(new Error("ضبطی در جریان نیست."));
      const duration = Date.now() - this.startedAt;
      rec.onstop = () => {
        const mime = baseMime(rec.mimeType || "audio/webm");
        const blob = new Blob(this.chunks, { type: mime });
        const wave = resample(this.levels, 48);
        this.cleanup();
        resolve({ blob, mime, duration, wave });
      };
      if (rec.state === "inactive") {
        rec.onstop(new Event("stop"));
      } else {
        rec.stop();
      }
    });
  }

  /** لغو ضبط بدون ذخیره */
  cancel(): void {
    if (this.rec && this.rec.state !== "inactive") {
      this.rec.onstop = null;
      this.rec.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => undefined);
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.rec = null;
  }
}
