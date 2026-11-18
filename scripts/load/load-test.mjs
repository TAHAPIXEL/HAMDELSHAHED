#!/usr/bin/env node
// ----------------------------------------------------------------------------
//  آزمون بار همدل: بارگذاری کامل داده (/api/state) و تغییرات (/api/state/changes)
//  برای دانش‌آموزان تستی (lt_s0001 … lt_s0500)
//
//  استفاده:
//    node scripts/load/load-test.mjs --base https://hamdelshahed.vercel.app \
//         --count 500 --concurrency 50 --rounds 2 [--mode tokens|login] [--json]
//
//  --mode tokens  (پیش‌فرض) از نشست‌های sessions.sql استفاده می‌کند؛ محدودیت ورود را دور می‌زند.
//  --mode login   ورود واقعی با شماره و رمز تستی؛ محدودیت ۳۰ ورود در ۱۰ دقیقه برای هر IP
//                 اعمال می‌شود و خطای ۴۲۹ گزارش می‌شود (همان رفتار واقعی).
//
//  فقط حساب‌های تستی استفاده می‌شوند. هیچ داده‌ای نوشته یا تغییر نمی‌شود.
// ----------------------------------------------------------------------------

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? "true" : v;
};

const BASE = opt("base", "http://127.0.0.1:3100").replace(/\/+$/, "");
const COUNT = Math.min(500, Math.max(1, Number(opt("count", 500))));
const CONCURRENCY = Math.max(1, Number(opt("concurrency", 50)));
const ROUNDS = Math.max(1, Number(opt("rounds", 1)));
const MODE = opt("mode", "tokens");
const AS_JSON = opt("json", "false") === "true";
const PASSWORD = "1234";

const studentNo = (i) => String(i).padStart(4, "0");
const phoneOf = (i) => `0990${String(i).padStart(7, "0")}`;
const tokenOf = (i) => `loadtest-token-${String(i).padStart(6, "0")}`;

/** اجرای fn روی همه‌ی موارد با حداکثر `n` درخواست هم‌زمان */
async function runPool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await fn(items[k], k);
    }
  });
  await Promise.all(workers);
  return out;
}

/** درخواست با زمان‌سنجی؛ بدنه‌ی پاسخ را برمی‌گرداند */
async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    return { status: res.status, ms: performance.now() - t0, bytes: Buffer.byteLength(text), text };
  } catch (err) {
    return { status: 0, ms: performance.now() - t0, bytes: 0, text: "", error: String(err.cause?.code ?? err.message) };
  }
}

const round1 = (x) => (Number.isFinite(x) ? Math.round(x) : null);

function summarize(label, results) {
  const ok = results.filter((r) => r.status === 200);
  const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] : NaN);
  const statuses = {};
  for (const r of results) {
    const key = r.status || r.error || "error";
    statuses[key] = (statuses[key] ?? 0) + 1;
  }
  const bytes = ok.reduce((s, r) => s + r.bytes, 0);
  return {
    label,
    requests: results.length,
    ok: ok.length,
    statuses,
    p50_ms: round1(pct(0.5)),
    p95_ms: round1(pct(0.95)),
    max_ms: round1(ms.at(-1) ?? NaN),
    avg_kb: ok.length ? Math.round(bytes / ok.length / 1024) : null,
  };
}

async function main() {
  const started = Date.now();
  const ids = Array.from({ length: COUNT }, (_, k) => k + 1);
  const report = { base: BASE, mode: MODE, students: COUNT, concurrency: CONCURRENCY, rounds: ROUNDS, steps: [] };

  // ۱) گرفتن نشست‌ها
  let tokens;
  if (MODE === "login") {
    const logins = await runPool(ids, CONCURRENCY, async (i) => {
      const r = await call("POST", "/api/auth/login", { body: { phone: phoneOf(i), password: PASSWORD } });
      let token = null;
      if (r.status === 200) token = JSON.parse(r.text).token ?? null;
      return { ...r, text: undefined, token };
    });
    report.steps.push(summarize("login", logins));
    tokens = logins.filter((r) => r.token).map((r) => r.token);
  } else {
    tokens = ids.map((i) => tokenOf(i));
  }

  // ۲) بارگذاری کامل داده (همان کاری که مرورگر هنگام ورود انجام می‌دهد)
  const heads = new Map();
  let stateResults = [];
  for (let round = 0; round < ROUNDS; round++) {
    const r = await runPool(tokens, CONCURRENCY, async (token) => {
      const x = await call("GET", "/api/state", { token });
      if (x.status === 200) {
        const parsed = JSON.parse(x.text);
        heads.set(token, parsed.head);
        x.rows = parsed.rows?.length ?? 0;
      }
      return { ...x, text: undefined };
    });
    stateResults = stateResults.concat(r);
  }
  report.steps.push(summarize("state (full load)", stateResults));
  const rowsSample = stateResults.find((r) => r.rows !== undefined)?.rows ?? null;
  report.rows_per_student = rowsSample;

  // ۳) همگام‌سازی تغییرات از آخرین سر (کار دوره‌ای مرورگر)
  const changeResults = await runPool([...heads.entries()], CONCURRENCY, async ([token, head]) => {
    const x = await call("GET", `/api/state/changes?since=${head}`, { token });
    return { ...x, text: undefined };
  });
  report.steps.push(summarize("changes (incremental)", changeResults));

  report.total_seconds = Math.round((Date.now() - started) / 1000);

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`آزمون بار ${MODE} روی ${BASE} | ${COUNT} دانش‌آموز | هم‌زمانی ${CONCURRENCY} | ${ROUNDS} دور`);
    for (const s of report.steps) {
      console.log(
        `- ${s.label}: ${s.ok}/${s.requests} موفق | p50 ${s.p50_ms} ms | p95 ${s.p95_ms} ms | بیشینه ${s.max_ms} ms | میانگین حجم ${s.avg_kb} KB | ${JSON.stringify(s.statuses)}`,
      );
    }
    console.log(`ردیف‌های قابل‌مشاهده برای یک دانش‌آموز: ${report.rows_per_student ?? "-"} | زمان کل: ${report.total_seconds} ثانیه`);
  }
}

main().catch((err) => {
  console.error("آزمون بار با خطا متوقف شد:", err);
  process.exit(1);
});
