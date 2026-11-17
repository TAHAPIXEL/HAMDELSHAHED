import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * هش رمز عبور با scrypt (نمکِ تصادفی برای هر کاربر).
 * قالب ذخیره‌شده:  scrypt$<salt-hex>$<hash-hex>
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password.normalize("NFKC"), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  try {
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password.normalize("NFKC"), salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export const SESSION_COOKIE = "hamdel_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // دو هفته
