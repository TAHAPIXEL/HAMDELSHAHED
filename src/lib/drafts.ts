// ----------------------------------------------------------------------------
//  پیش‌نویس‌های ماندگار کاربر (در پایگاه‌داده، مجموعه‌ی drafts)
//  - متن نیمه‌کاره‌ی گفتگو، پاسخ آزمون (با زمان شروع، تا رفرش زمان را تازه نکند) و پاسخ تکلیف.
//  - هر پیش‌نویس فقط برای صاحبش دیده می‌شود (قانون سرور).
//  - ذخیره با تأخیر کوتاه انجام می‌شود و هنگام بسته‌شدن صفحه همان لحظه نوشته می‌شود.
//  - ذخیره‌ی خام در draftstore.ts است (بدون React، قابل آزمون در Node).
// ----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { readDraft, removeDraft, writeDraft, type DraftScope } from "./draftstore";

export type { DraftScope } from "./draftstore";

interface DraftOptions<T> {
  /** وقتی true باشد پیش‌نویس ذخیره نمی‌شود (مثلاً حالت ویرایش پیام) */
  enabled?: boolean;
  /** وقتی مقدار خالی است، پیش‌نویس حذف می‌شود */
  isEmpty?: (value: T) => boolean;
  /** اگر پیش‌نویسی نباشد، مقدار اولیه همین لحظه ذخیره شود (مثلاً زمان شروع آزمون) */
  persistInitial?: boolean;
  delayMs?: number;
}

/**
 * حالت ماندگار یک فرم: مقدار اولیه از پیش‌نویس ذخیره‌شده خوانده می‌شود.
 * `set` مثل setState کار می‌کند؛ `clear` پیش‌نویس را پاک می‌کند (بعد از ثبت نهایی).
 */
export function useDraft<T>(
  userId: string,
  scope: DraftScope,
  key: string,
  initial: () => T,
  opts: DraftOptions<T> = {},
) {
  const { enabled = true, isEmpty, persistInitial = false, delayMs = 500 } = opts;
  const [value, setValue] = useState<T>(() => readDraft<T>(userId, scope, key) ?? initial());
  const valueRef = useRef(value);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cfg = useRef({ enabled, isEmpty, userId, scope, key });

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current) return;
    pendingRef.current = false;
    const c = cfg.current;
    if (!c.enabled) return;
    if (c.isEmpty?.(valueRef.current)) removeDraft(c.userId, c.scope, c.key);
    else writeDraft(c.userId, c.scope, c.key, valueRef.current);
  }, []);

  // تنظیمات جاری (پس از هر رندر) — پیش از ذخیره‌ی زمان‌بندی‌شده خوانده می‌شود
  useEffect(() => {
    cfg.current = { enabled, isEmpty, userId, scope, key };
  });

  useEffect(() => {
    valueRef.current = value;
    if (!pendingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, delayMs);
  }, [value, flush, delayMs]);

  // مقدار اولیه‌ای که هنوز پیش‌نویسی ندارد، فوراً ذخیره شود
  useEffect(() => {
    if (!persistInitial || !enabled) return;
    if (readDraft(userId, scope, key) === undefined) writeDraft(userId, scope, key, valueRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // هنگام بستن (unmount) تغییرات در انتظار همان لحظه ذخیره می‌شود
  useEffect(() => () => flush(), [flush]);

  const set = useCallback((next: SetStateAction<T>) => {
    pendingRef.current = true;
    setValue(next);
  }, []);

  const clear = useCallback(() => {
    pendingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const c = cfg.current;
    removeDraft(c.userId, c.scope, c.key);
  }, []);

  return { value, set, clear };
}
