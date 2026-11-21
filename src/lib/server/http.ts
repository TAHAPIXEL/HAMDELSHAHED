// ابزارهای مشترک مسیرهای API (خطا، بدنه‌ی JSON، محدودیت نرخ)

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status, headers: NO_STORE });
  }
  const pgCode = (err as { code?: string } | null)?.code;
  if (pgCode === "23505") {
    return Response.json(
      { error: "این مقدار (مثلاً شماره تلفن) قبلاً ثبت شده است." },
      { status: 409, headers: NO_STORE },
    );
  }
  console.error("[api]", err);
  return Response.json(
    { error: "خطای داخلی سرور؛ لطفاً دوباره تلاش کنید." },
    { status: 500, headers: NO_STORE },
  );
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  let value: unknown;
  try {
    value = await req.json();
  } catch {
    throw new HttpError(400, "درخواست نامعتبر است.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "درخواست نامعتبر است.");
  }
  return value as T;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "unknown";
}

const hits = new Map<string, number[]>();

/** محدودیت نرخ ساده‌ی درون‌حافظه (برای جلوگیری از حدس رمز و آپلود انبوه) */
export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    throw new HttpError(429, "تعداد درخواست‌ها بیش از حد است؛ کمی صبر کنید.");
  }
  recent.push(now);
  hits.set(key, recent);
}
