// ----------------------------------------------------------------------------
//  پل اپ اندروید (Capacitor). در مرورگر همه‌ی توابع یا false برمی‌گردانند یا
//  از روش وب استفاده می‌کنند؛ بنابراین نسخه‌ی وب بدون تغییر کار می‌کند.
// ----------------------------------------------------------------------------

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/** آیا صفحه داخل برنامه‌ی اندروید (APK) باز شده است؟ */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

interface ScreenSharePlugin {
  start(): Promise<{ started: boolean }>;
  stop(): Promise<void>;
  addListener(event: "frame", cb: (e: { data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "ended" | "error", cb: (e: { message?: string }) => void): Promise<PluginListenerHandle>;
}

const ScreenShare = registerPlugin<ScreenSharePlugin>("ScreenShare");

interface ClassroomKeepAlivePlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
}
const ClassroomKeepAlive = registerPlugin<ClassroomKeepAlivePlugin>("ClassroomKeepAlive");

/**
 * در APK: تا وقتی کلاس باز است، سرویس پیش‌زمینه اجرا می‌شود تا صدا و تصویر با رفتن به پس‌زمینه قطع نشوند.
 * در مرورگر کاری نمی‌کند (مرورگر اجازه‌ی این کار را نمی‌دهد).
 */
export async function setClassroomKeepAlive(on: boolean): Promise<void> {
  if (!isNativeApp()) return;
  try {
    if (on) await ClassroomKeepAlive.start();
    else await ClassroomKeepAlive.stop();
  } catch {
    // اجرا نشد؛ کلاس بدون سرویس ادامه می‌یابد
  }
}

const CANVAS_FPS = 6;
let installed = false;

/**
 * در برنامه‌ی اندروید، navigator.mediaDevices.getDisplayMedia را با منبعی جایگزین می‌کند
 * که فریم‌های ضبط‌شده‌ی گوشی را روی canvas می‌کشد و به‌صورت یک ویدیوی استاندارد
 * (canvas.captureStream) برمی‌گرداند. LiveKit همان مسیر اشتراک صفحه‌ی مرورگر را استفاده می‌کند.
 */
export function installNativeScreenShare(): void {
  if (installed || !isNativeApp() || typeof navigator === "undefined" || !navigator.mediaDevices) return;
  installed = true;
  navigator.mediaDevices.getDisplayMedia = nativeDisplayMedia as typeof navigator.mediaDevices.getDisplayMedia;
}

async function nativeDisplayMedia(): Promise<MediaStream> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("نمایش تصویر روی این دستگاه ممکن نیست.");
  const stream = canvas.captureStream(CANVAS_FPS);
  const track = stream.getVideoTracks()[0];

  let busy = false;
  let sized = false;
  const frameHandle = await ScreenShare.addListener("frame", ({ data }) => {
    if (busy) return; // اگر دیکد کردن عقب است، فریم را رها کن تا تأخیر جمع نشود
    busy = true;
    const img = new Image();
    img.onload = () => {
      if (!sized) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        sized = true;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      busy = false;
    };
    img.onerror = () => {
      busy = false;
    };
    img.src = "data:image/jpeg;base64," + data;
  });
  const endHandle = await ScreenShare.addListener("ended", () => track.stop());
  const errHandle = await ScreenShare.addListener("error", () => track.stop());

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    void frameHandle.remove();
    void endHandle.remove();
    void errHandle.remove();
    void ScreenShare.stop().catch(() => undefined);
  };
  const originalStop = track.stop.bind(track);
  track.stop = () => {
    cleanup();
    originalStop();
  };

  try {
    await ScreenShare.start();
  } catch (err) {
    cleanup();
    originalStop();
    throw err instanceof Error ? err : new Error("اشتراک صفحه انجام نشد.");
  }
  return stream;
}

/** ذخیره‌ی فایل: در وب دانلود مرورگر، در اپ اندروید برگه‌ی اشتراک‌گذاری (ذخیره در فایل‌ها، WPS، Google Drive و…) */
export async function saveFile(blob: Blob, name: string): Promise<void> {
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return;
  }
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const data = await blobToBase64(blob);
  const path = `exports/${Date.now()}-${name.replace(/[\\/:*?"<>|]/g, "_")}`;
  await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
  const uri = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({ title: name, files: [uri.uri] });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}
