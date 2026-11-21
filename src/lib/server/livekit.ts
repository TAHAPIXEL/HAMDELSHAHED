// ----------------------------------------------------------------------------
//  LiveKit (SFU): صدا، تصویر و اشتراک صفحه‌ی کلاس آنلاین
//  - مدرس و دانش‌آموزان فقط به یک سرور رسانه‌ی مرکزی وصل می‌شوند (نه مش)؛ پس هر کسی یک آپلود دارد.
//  - توکن‌ها روی سرور و با کلید مخفی امضا می‌شوند؛ مجوز انتشار صدا/تصویر هم اینجا تعیین می‌شود.
//  - تنظیمات از متغیرهای محیطی: LIVEKIT_URL، LIVEKIT_API_KEY، LIVEKIT_API_SECRET
// ----------------------------------------------------------------------------

import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { HttpError } from "./http";

/** ظرفیت حاضران (دانش‌آموز) هر کلاس؛ حداقل ۸۰ نفر */
export const MAX_LISTENERS = 100;
/** ظرفیت کل اتاق = حاضران + مدرس و کادر ناظر */
const ROOM_CAPACITY = MAX_LISTENERS + 20;

export interface LiveConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export function liveConfig(): LiveConfig | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

function requireConfig(): LiveConfig {
  const cfg = liveConfig();
  if (!cfg) {
    throw new HttpError(503, "سرویس صوتی کلاس آنلاین هنوز تنظیم نشده است. با مدیر سامانه تماس بگیرید.");
  }
  return cfg;
}

/** نام اتاق LiveKit برای هر کلاس */
export function liveRoomName(roomId: string): string {
  return `class-${roomId}`;
}

function service(cfg: LiveConfig): RoomServiceClient {
  // LiveKit سرویس REST را روی https می‌خواهد
  const httpUrl = cfg.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  return new RoomServiceClient(httpUrl, cfg.apiKey, cfg.apiSecret);
}

const ALL_SOURCES = [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE];

/** شروع کلاس: اتاق LiveKit ساخته می‌شود (اگر از قبل باشد، همان برمی‌گردد) */
export async function openLiveRoom(roomId: string): Promise<void> {
  const cfg = requireConfig();
  await service(cfg).createRoom({
    name: liveRoomName(roomId),
    emptyTimeout: 60 * 10,
    maxParticipants: ROOM_CAPACITY,
  });
}

/** پایان کلاس: همه‌ی شرکت‌کنندگان بیرون می‌روند */
export async function closeLiveRoom(roomId: string): Promise<void> {
  const cfg = requireConfig();
  try {
    await service(cfg).deleteRoom(liveRoomName(roomId));
  } catch {
    // اتاق از قبل بسته شده؛ نیازی به خطا نیست
  }
}

/** اجازه‌ی صحبت (میکروفون، دوربین و اشتراک صفحه) را تغییر می‌دهد */
export async function setSpeakPermission(roomId: string, identity: string, allowed: boolean): Promise<void> {
  const cfg = requireConfig();
  try {
    await service(cfg).updateParticipant(liveRoomName(roomId), identity, {
      permission: {
        canSubscribe: true,
        canPublish: allowed,
        canPublishData: true,
        canPublishSources: allowed ? ALL_SOURCES : [],
        hidden: false,
        recorder: false,
      },
    });
  } catch (err) {
    // کاربر هنوز وصل نیست: مجوز با توکن بعدی اعمال می‌شود
    const status = (err as { status?: number })?.status;
    if (status !== 404) throw err;
  }
}

/** توکن ورود به اتاق؛ فقط مدرس اجازه‌ی انتشار دارد، بقیه تا زمان اجازه فقط می‌شنوند */
export async function mintLiveToken(opts: {
  roomId: string;
  identity: string;
  name: string;
  isTeacher: boolean;
}): Promise<{ url: string; token: string }> {
  const cfg = requireConfig();
  const at = new AccessToken(cfg.apiKey, cfg.apiSecret, {
    identity: opts.identity,
    name: opts.name || "کاربر",
    ttl: "6h",
    metadata: JSON.stringify({ teacher: opts.isTeacher }),
  });
  at.addGrant({
    roomJoin: true,
    room: liveRoomName(opts.roomId),
    canSubscribe: true,
    canPublish: opts.isTeacher,
    canPublishData: true,
    canPublishSources: opts.isTeacher ? ALL_SOURCES : [],
  });
  return { url: cfg.url, token: await at.toJwt() };
}
