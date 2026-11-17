/**
 * محدودکننده‌ی ساده‌ی تلاش ورود (در حافظه‌ی پروسه).
 * از حملات حدس رمز جلوگیری می‌کند: حداکثر ۶ تلاش ناموفق در هر ۵ دقیقه.
 */
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 6;

export function checkLoginAllowed(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) return { allowed: true, retryAfterSec: 0 };
  if (now - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.firstAt + WINDOW_MS - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function registerFailedLogin(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }
  entry.count += 1;
}

export function clearLoginAttempts(key: string) {
  attempts.delete(key);
}
