"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ClientError extends Error {}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    headers: init?.body && !isFormData ? { "content-type": "application/json" } : undefined,
    ...init,
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `خطای ${response.status}`;
    throw new ClientError(message);
  }
  return data as T;
}

export type ImageFolder =
  | "avatars"
  | "messages"
  | "announcements"
  | "assignments"
  | "submissions"
  | "quizzes";

/**
 * بهینه‌سازی هوشمند تصویر پیش از آپلود (مخصوص عکس‌های سنگین دوربین موبایل)
 * تصاویر متحرک GIF دست‌نخورده ارسال می‌شوند.
 */
async function prepareImageFile(file: File, folder: ImageFolder): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new ClientError("فقط فایل تصویری مجاز است");
  }
  if (file.type === "image/gif") {
    if (file.size > 4 * 1024 * 1024) {
      throw new ClientError("حجم تصویر GIF باید کمتر از ۴ مگابایت باشد");
    }
    return file;
  }

  const maxDim = folder === "avatars" ? 512 : 1600;
  // اگر فایل کوچک است و نیاز به تغییر اندازه ندارد، همان را بفرست
  if (file.size <= 700 * 1024 && folder !== "avatars") {
    return file;
  }

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && file.size <= 3.5 * 1024 * 1024) {
        resolve(file);
        return;
      }
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const outputType = file.type === "image/png" && folder === "avatars" ? "image/webp" : "image/jpeg";
      const quality = folder === "avatars" ? 0.88 : 0.85;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const ext = outputType === "image/webp" ? "webp" : "jpg";
          resolve(new File([blob], `upload.${ext}`, { type: outputType }));
        },
        outputType,
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

/** آپلود تصویر به سرور و ذخیره‌سازی دائمی در Supabase Storage */
export async function uploadImage(file: File, folder: ImageFolder): Promise<string> {
  const prepared = await prepareImageFile(file, folder);
  if (prepared.size > 4 * 1024 * 1024) {
    throw new ClientError("حجم تصویر پس از فشرده‌سازی هم بیشتر از ۴ مگابایت است");
  }
  const form = new FormData();
  form.append("file", prepared);
  form.append("folder", folder);
  const res = await api<{ url: string }>("/api/upload", {
    method: "POST",
    body: form,
  });
  return res.url;
}

type UseApiOptions = {
  /** بازخوانی خودکار هر چند میلی‌ثانیه (برای گفت‌وگو) */
  refreshMs?: number;
  enabled?: boolean;
};

export function useApi<T>(path: string | null, options: UseApiOptions = {}) {
  const { refreshMs, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path) && enabled);
  const mounted = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (!path || !enabled) return;
      if (!silent) setLoading(true);
      try {
        const result = await api<T>(path);
        if (!mounted.current) return;
        setData(result);
        setError(null);
      } catch (e) {
        if (!mounted.current) return;
        setError(e instanceof Error ? e.message : "خطای نامشخص");
      } finally {
        if (mounted.current && !silent) setLoading(false);
      }
    },
    [path, enabled],
  );

  useEffect(() => {
    // با تغییر مسیر، داده‌ی قبلی نباید لحظه‌ای نمایش داده شود
    setData(null);
    setError(null);
    setLoading(Boolean(path) && enabled);
  }, [path, enabled]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!refreshMs || !path || !enabled) return;
    const id = setInterval(() => void load(true), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs, path, enabled, load]);

  return { data, error, loading, reload: load, setData };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "خطای نامشخص";
}
