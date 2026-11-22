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

/** زمان ضبط با دهم ثانیه به شکل تلگرام: 0:03,3 */
export function fmtRec(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${s < 10 ? "0" : ""}${s},${tenths % 10}`;
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

/** تعداد باندهای فرکانسی برای اکولایزر دایره‌ی ضبط */
export const ORB_BANDS = 16;
// بازه‌ی گفتار در تحلیلگر (fftSize 512 ≈ ۹۴ هرتز برای هر خانه): حدود ۱۸۰ هرتز تا ۶ کیلوهرتز
const BIN_LO = 2;
const BIN_HI = 64;

/** نوار فرکانس گفتار به باندهای لگاریتمی (زیر → بمی) تبدیل می‌شود؛ هر باند ۰ تا ۱ */
function bandsOf(freq: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < ORB_BANDS; i++) {
    const e0 = BIN_LO * Math.pow(BIN_HI / BIN_LO, i / ORB_BANDS);
    const e1 = BIN_LO * Math.pow(BIN_HI / BIN_LO, (i + 1) / ORB_BANDS);
    const a = Math.floor(e0);
    const b = Math.max(a + 1, Math.floor(e1));
    let sum = 0;
    for (let k = a; k < b && k < freq.length; k++) sum += freq[k];
    out.push(Math.min(1, ((sum / (b - a)) / 255) * 1.5));
  }
  return out;
}

/** هر فریم: بلندی صدا (۰ تا ۱) و زیر/بمی صدا (مرکز ثقل فرکانس، ۰ تا ۱) */
interface Frame {
  rms: number;
  pitch: number;
}

/**
 * شکل موج ذخیره‌شده: هر ستون ترکیبی از بلندی صدا و زیر/بمی است؛
 * صدای بم‌تر ستون کوتاه‌تر و صدای زیرتر ستون بلندتر می‌شود، و ارتفاع‌ها به بلندترین ستون نرمال می‌شوند.
 */
function buildWave(frames: Frame[], n: number): number[] {
  if (frames.length === 0) return Array.from({ length: n }, () => 0.2);
  const cols: Frame[] = [];
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i * frames.length) / n);
    const to = Math.max(from + 1, Math.floor(((i + 1) * frames.length) / n));
    let rms = 0;
    let pitch = 0;
    let k = 0;
    for (let j = from; j < to && j < frames.length; j++) {
      rms = Math.max(rms, frames[j].rms);
      pitch += frames[j].pitch;
      k++;
    }
    cols.push({ rms, pitch: k ? pitch / k : 0 });
  }
  const peak = Math.max(1e-4, ...cols.map((c) => c.rms));
  const voiced = cols.filter((c) => c.pitch > 0).map((c) => c.pitch);
  const pMin = voiced.length ? Math.min(...voiced) : 0;
  const pMax = voiced.length ? Math.max(...voiced) : 1;
  const span = Math.max(1e-4, pMax - pMin);
  const raw = cols.map((c) => {
    const amp = Math.pow(c.rms / peak, 0.7);
    const rel = c.pitch > 0 ? (c.pitch - pMin) / span : 0;
    return amp * (0.45 + 0.55 * rel);
  });
  const top = Math.max(1e-4, ...raw);
  return raw.map((v) => Math.round(Math.max(0.1, v / top) * 100) / 100);
}

export interface Recording {
  blob: Blob;
  mime: string;
  duration: number; // ms
  wave: number[];
}

/** داده‌ی هر لحظه‌ی ضبط برای نمایش زنده (اکولایزر دایره‌ای) */
export interface RecFrame {
  bands: number[];
  level: number;
  elapsed: number;
}

/** ضبط صدا با MediaRecorder؛ سطح و باندهای فرکانسی برای نمایش زنده و شکل موج ذخیره می‌شوند */
export class VoiceRecorder {
  onFrame?: (f: RecFrame) => void;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: number | null = null;
  private frames: Frame[] = [];
  private bands: number[] = new Array(ORB_BANDS).fill(0);
  private startedAt = 0;
  private cancelled = false;

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("ضبط صدا در این دستگاه پشتیبانی نمی‌شود.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    // اگر در حین آماده‌شدن میکروفون لغو شده، جریان را همان‌جا می‌بندیم
    if (this.cancelled) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    const mime = pickRecorderMime();
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.frames = [];
    this.rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.rec.start(250);
    this.startedAt = Date.now();

    const emit = (level: number, bands: number[]) =>
      this.onFrame?.({ bands, level, elapsed: Date.now() - this.startedAt });

    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try {
      this.ctx = new AC();
      const source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.55;
      source.connect(this.analyser);
      const td = new Uint8Array(this.analyser.fftSize);
      const fq = new Uint8Array(this.analyser.frequencyBinCount);
      this.timer = window.setInterval(() => {
        const an = this.analyser;
        if (!an) return;
        an.getByteTimeDomainData(td);
        an.getByteFrequencyData(fq);
        let sum = 0;
        for (const v of td) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        const rms = Math.min(1, Math.sqrt(sum / td.length));
        let ws = 0;
        let wc = 0;
        for (let i = BIN_LO; i < BIN_HI && i < fq.length; i++) {
          ws += fq[i];
          wc += fq[i] * (i - BIN_LO);
        }
        const pitch = ws > 0 ? wc / ws / (BIN_HI - BIN_LO) : 0;
        this.frames.push({ rms, pitch });
        // حمله‌ی سریع و افت آرام تا اکولایزر بیش‌ازحد نلرزد
        const raw = bandsOf(fq);
        this.bands = raw.map((v, i) => Math.max(v, this.bands[i] * 0.82));
        emit(Math.min(1, rms * 4), this.bands);
      }, 80);
    } catch {
      // بدون تحلیل صدا هم ضبط انجام می‌شود؛ نمایش زنده ساکت می‌ماند
      this.timer = window.setInterval(() => emit(0, new Array(ORB_BANDS).fill(0)), 200);
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
        const wave = buildWave(this.frames, 48);
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
    this.cancelled = true;
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
