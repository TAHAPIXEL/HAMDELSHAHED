// آزمون یکپارچه‌ی API روی سرور واقعی (Next.js) و پایگاه‌داده‌ی PostgreSQL (PGlite)
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const DEV = { phone: "09000000000", password: "dev-test-pass" };
const STAFF_KEY = "staff-test-key";
const WIPE_PASS = "wipe-test";

let passed = 0;
const results = [];

async function req(method, path, { token, body, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function check(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n      ${err.message}`);
    throw err;
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

async function main() {
  let devToken;
  let principalToken;
  let teacherToken;
  let studentA;
  let studentB;
  let tokenA;
  let tokenB;
  const nat = () => String(Math.floor(1e9 + Math.random() * 9e9));
  const phone = () => `09${String(Math.floor(1e8 + Math.random() * 9e8))}`;

  await check("health: database and storage status", async () => {
    const r = await req("GET", "/api/health");
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.database, "postgres");
  });

  await check("launch state is completely empty (no users, chats, notices, …)", async () => {
    const d = await req("POST", "/api/auth/login", { body: DEV });
    assert.equal(d.status, 200);
    assert.equal(d.json.dev, true);
    devToken = d.json.token;
    const s = await req("GET", "/api/state", { token: devToken });
    assert.equal(s.status, 200);
    assert.deepEqual(s.json.rows, []);
    assert.equal(s.json.head, 0);
  });

  await check("state requires a session", async () => {
    const r = await req("GET", "/api/state");
    assert.equal(r.status, 401);
  });

  await check("wrong developer credentials are rejected", async () => {
    const r = await req("POST", "/api/auth/login", { body: { phone: DEV.phone, password: "nope" } });
    assert.equal(r.status, 401);
  });

  await check("staff registration without the staff key is refused", async () => {
    const r = await req("POST", "/api/auth/register", {
      body: { user: { role: "principal", firstName: "م", lastName: "د", phone: phone(), password: "1234" } },
    });
    assert.equal(r.status, 403);
  });

  await check("staff registration with a wrong staff key is refused", async () => {
    const r = await req("POST", "/api/auth/register", {
      body: { staffKey: "wrong", user: { role: "principal", firstName: "م", lastName: "د", phone: phone(), password: "1234" } },
    });
    assert.equal(r.status, 403);
    assert.match(r.json.error, /کد ثبت‌نام کادر/);
  });

  await check("first principal registers with the staff key (first admin path)", async () => {
    const p = phone();
    const r = await req("POST", "/api/auth/register", {
      body: { staffKey: STAFF_KEY, user: { role: "principal", staffRole: "principal", firstName: "علی", lastName: "مدیری", phone: p, password: "1234" } },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.role, "principal");
    const l = await req("POST", "/api/auth/login", { body: { phone: p, password: "1234" } });
    assert.equal(l.status, 200);
    principalToken = l.json.token;
    assert.equal(l.json.user.id, r.json.user.id);
  });

  await check("duplicate phone is rejected (409)", async () => {
    const p = phone();
    const body = { staffKey: STAFF_KEY, user: { role: "teacher", staffRole: "teacher", firstName: "الف", lastName: "ب", phone: p, password: "1111" } };
    assert.equal((await req("POST", "/api/auth/register", { body })).status, 200);
    const again = await req("POST", "/api/auth/register", { body });
    assert.equal(again.status, 409);
  });

  await check("manager creates a teacher without the staff key", async () => {
    const p = phone();
    const r = await req("POST", "/api/auth/register", {
      token: principalToken,
      body: { user: { role: "teacher", staffRole: "teacher", firstName: "معلم", lastName: "نمونه", phone: p, password: "2222" } },
    });
    assert.equal(r.status, 200);
    const l = await req("POST", "/api/auth/login", { body: { phone: p, password: "2222" } });
    teacherToken = l.json.token;
  });

  await check("student registration validates grade, section and national id", async () => {
    const bad = await req("POST", "/api/auth/register", {
      body: { user: { role: "student", firstName: "س", lastName: "ت", phone: phone(), password: "1234", grade: 6, section: "1", nationalId: nat(), fatherName: "پ", address: "ا" } },
    });
    assert.equal(bad.status, 400);
    const bad2 = await req("POST", "/api/auth/register", {
      body: { user: { role: "student", firstName: "س", lastName: "ت", phone: phone(), password: "1234", grade: 7, section: "1", nationalId: "123" } },
    });
    assert.equal(bad2.status, 400);
  });

  await check("student self-registration and login", async () => {
    studentA = { phone: phone(), password: "1234", nationalId: nat() };
    const r = await req("POST", "/api/auth/register", {
      body: { user: { role: "student", firstName: "رضا", lastName: "الف", fatherName: "پدر", nationalId: studentA.nationalId, address: "خیابان ۱", phone: studentA.phone, password: studentA.password, grade: 7, section: "1" } },
    });
    assert.equal(r.status, 200);
    studentA.id = r.json.user.id;
    const bad = await req("POST", "/api/auth/login", { body: { phone: studentA.phone, password: "9999" } });
    assert.equal(bad.status, 401);
    const ok = await req("POST", "/api/auth/login", { body: { phone: studentA.phone, password: studentA.password } });
    assert.equal(ok.status, 200);
    tokenA = ok.json.token;
  });

  await check("second student registers (same class)", async () => {
    studentB = { phone: phone(), password: "5678", nationalId: nat() };
    const r = await req("POST", "/api/auth/register", {
      body: { user: { role: "student", firstName: "نیلوفر", lastName: "ب", fatherName: "پدر", nationalId: studentB.nationalId, address: "ا", phone: studentB.phone, password: studentB.password, grade: 7, section: "1" } },
    });
    assert.equal(r.status, 200);
    studentB.id = r.json.user.id;
    tokenB = (await req("POST", "/api/auth/login", { body: { phone: studentB.phone, password: studentB.password } })).json.token;
  });

  await check("students cannot see others' private fields", async () => {
    const s = await req("GET", "/api/state", { token: tokenA });
    const users = s.json.rows.filter((r) => r.c === "users");
    const mine = users.find((r) => r.id === studentA.id);
    const other = users.find((r) => r.id === studentB.id);
    assert.ok(mine.d.phone && mine.d.password, "own record keeps phone/password");
    assert.equal(other.d.phone, undefined);
    assert.equal(other.d.password, undefined);
    assert.equal(other.d.nationalId, undefined);
    assert.equal(other.d.address, undefined);
  });

  let groupId;
  let secretChatId;
  await check("group chat: members see messages, non-members do not", async () => {
    groupId = `g_${uid()}`;
    const group = { id: groupId, type: "group", title: "کلاس", memberIds: [studentA.id, studentB.id], createdBy: studentA.id, createdAt: Date.now(), lastActivity: Date.now() };
    const w = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "chats", id: groupId, d: group }] } });
    assert.equal(w.status, 200, JSON.stringify(w.json));
    const msg = { id: `m_${uid()}`, chatId: groupId, senderId: studentA.id, text: "سلام", createdAt: Date.now() };
    const m = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "messages", id: msg.id, d: msg }] } });
    assert.equal(m.status, 200);
    const secret = { id: `c_${uid()}`, type: "direct", title: "", memberIds: [studentB.id, "u_other_member"], createdBy: studentB.id, createdAt: Date.now(), lastActivity: Date.now(), directKey: "x" };
    secretChatId = secret.id;
    await req("POST", "/api/state/sync", { token: tokenB, body: { ops: [{ c: "chats", id: secret.id, d: secret }] } });
    const sa = await req("GET", "/api/state", { token: tokenA });
    assert.ok(sa.json.rows.some((r) => r.c === "messages" && r.id === msg.id));
    assert.ok(!sa.json.rows.some((r) => r.c === "chats" && r.id === secret.id), "student A must not see B's direct chat");
  });

  await check("a student cannot post a message as someone else", async () => {
    const fid = `m_${uid()}`;
    const r = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "messages", id: fid, d: { id: fid, chatId: groupId, senderId: studentB.id, text: "جعلی", createdAt: 1 } }] } });
    assert.equal(r.status, 403);
  });

  await check("a student cannot change another student's role or profile", async () => {
    const r = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "users", id: studentB.id, d: { id: studentB.id, role: "teacher", firstName: "x", lastName: "y", phone: studentB.phone, password: "1", createdAt: 1 } }] } });
    assert.equal(r.status, 403);
  });

  await check("a student cannot change their own role", async () => {
    const r = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "users", id: studentA.id, d: { id: studentA.id, role: "principal", firstName: "x", lastName: "y", phone: studentA.phone, password: "1234", createdAt: 1 } }] } });
    assert.equal(r.status, 403);
  });

  await check("a student may update own profile (no role change)", async () => {
    const r = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "users", id: studentA.id, d: { id: studentA.id, role: "student", firstName: "رضا", lastName: "ویرایش", phone: studentA.phone, password: "1234", grade: 7, section: "1", createdAt: 1 } }] } });
    assert.equal(r.status, 200);
  });

  await check("a student cannot submit attendance or exam answers for another student", async () => {
    const r1 = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "attendance", id: `2026-01-01:${studentB.id}`, d: { id: `2026-01-01:${studentB.id}`, date: "2026-01-01", studentId: studentB.id, status: "absent" } }] } });
    assert.equal(r1.status, 403);
    const r2 = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "subs", id: "s1", d: { id: "s1", examId: "e", studentId: studentB.id, answers: {}, startedAt: 1 } }] } });
    assert.equal(r2.status, 403);
  });

  await check("own attendance and read-state are allowed; others' read-state is not", async () => {
    const own = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "attendance", id: `2026-01-02:${studentA.id}`, d: { id: `2026-01-02:${studentA.id}`, date: "2026-01-02", studentId: studentA.id, status: "present", auto: true } }, { c: "seen", id: `${studentA.id}:${groupId}`, d: 123 }] } });
    assert.equal(own.status, 200);
    const bad = await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "seen", id: `${studentB.id}:${groupId}`, d: 1 }] } });
    assert.equal(bad.status, 403);
  });

  await check("sync rejects malformed input", async () => {
    assert.equal((await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "nope", id: "1", d: {} }] } })).status, 400);
    assert.equal((await req("POST", "/api/state/sync", { token: tokenA, body: { ops: [{ c: "notices", id: "a", d: { id: "b", title: "t" } }] } })).status, 400);
    assert.equal((await req("POST", "/api/state/sync", { token: tokenA, body: { ops: "x" } })).status, 400);
  });

  await check("changes feed returns new rows after a cursor", async () => {
    const head = (await req("GET", "/api/state/changes?since=0", { token: tokenA })).json.head;
    const nid = `n_${uid()}`;
    await req("POST", "/api/state/sync", { token: devToken, body: { ops: [{ c: "notices", id: nid, d: { id: nid, title: "اطلاعیه", body: "متن", audience: "all", createdBy: "dev-root", createdAt: Date.now() } }] } });
    const ch = await req("GET", `/api/state/changes?since=${head}`, { token: tokenA });
    assert.ok(ch.json.changes.some((c) => c.c === "notices" && c.id === nid));
    const none = await req("GET", `/api/state/changes?since=${ch.json.head}`, { token: tokenA });
    assert.equal(none.json.changes.length, 0);
    assert.equal((await req("GET", "/api/state/changes?since=-1", { token: tokenA })).status, 400);
  });

  await check("upload: unsupported file type rejected (415)", async () => {
    const f = new FormData();
    f.append("file", new Blob(["hello world"], { type: "text/plain" }), "a.txt");
    const r = await req("POST", "/api/upload", { token: tokenA, form: f });
    assert.equal(r.status, 415);
  });

  await check("upload: real image bytes pass the sniff; storage config is checked", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const f = new FormData();
    f.append("file", new Blob([png], { type: "image/png" }), "a.png");
    const r = await req("POST", "/api/upload", { token: tokenA, form: f });
    // بدون تنظیم Supabase باید 503 بدهد (نه 500 یا 415)
    assert.equal(r.status, 503);
  });

  await check("registration avatar upload works before login (purpose=registration)", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const f = new FormData();
    f.append("purpose", "registration");
    f.append("file", new Blob([png], { type: "image/png" }), "avatar.png");
    const r = await req("POST", "/api/upload", { form: f });
    // بدون نشست پذیرفته می‌شود؛ بدون تنظیم Supabase در آزمون باید 503 بدهد (نه 401)
    assert.equal(r.status, 503);
  });

  await check("registration upload still refuses non-images", async () => {
    const f = new FormData();
    f.append("purpose", "registration");
    f.append("file", new Blob([Buffer.from("not an image")], { type: "text/plain" }), "a.txt");
    assert.equal((await req("POST", "/api/upload", { form: f })).status, 415);
  });

  await check("upload requires a session", async () => {
    const f = new FormData();
    f.append("file", new Blob(["x"], { type: "image/png" }), "a.png");
    assert.equal((await req("POST", "/api/upload", { form: f })).status, 401);
  });

  await check("wipe is restricted to managers and needs the wipe password", async () => {
    assert.equal((await req("POST", "/api/state/wipe/verify", { token: tokenA, body: { deletePassword: WIPE_PASS } })).status, 403);
    assert.equal((await req("POST", "/api/state/wipe/verify", { token: teacherToken, body: { deletePassword: WIPE_PASS } })).status, 403);
    assert.equal((await req("POST", "/api/state/wipe/verify", { token: devToken, body: { deletePassword: "bad" } })).status, 403);
    assert.equal((await req("POST", "/api/state/wipe/verify", { token: devToken, body: { deletePassword: WIPE_PASS } })).status, 200);
  });

  await check("logout invalidates the session token", async () => {
    const l = await req("POST", "/api/auth/login", { body: { phone: studentA.phone, password: studentA.password } });
    await req("POST", "/api/auth/logout", { token: l.json.token });
    assert.equal((await req("GET", "/api/state", { token: l.json.token })).status, 401);
  });

  await check("full wipe returns the site to zero data and ends all sessions", async () => {
    const r = await req("POST", "/api/state/wipe", { token: devToken, body: { deletePassword: WIPE_PASS } });
    assert.equal(r.status, 200);
    assert.ok(r.json.removedRecords > 0);
    assert.equal((await req("GET", "/api/state", { token: devToken })).status, 401);
    const d = await req("POST", "/api/auth/login", { body: DEV });
    const s = await req("GET", "/api/state", { token: d.json.token });
    assert.deepEqual(s.json.rows, []);
    // پس از پاک‌سازی ثبت‌نام دوباره‌ی یک کاربر با همان شماره ممکن است
    assert.equal((await req("POST", "/api/auth/login", { body: { phone: studentA.phone, password: studentA.password } })).status, 401);
  });
}


try {
  await main();
} catch {
  // ادامه‌ی گزارش
}
console.log(results.join("\n"));
console.log(`\n${passed} passed, ${results.filter((r) => r.startsWith("FAIL")).length} failed`);
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
