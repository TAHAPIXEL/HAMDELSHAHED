// آزمون لایه‌ی همگام‌سازی کلاینت (store.ts و model.ts کامپایل‌شده) در برابر سرور واقعی
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const DEV = { phone: "09000000000", password: "dev-test-pass" };
const WIPE_PASS = "wipe-test";

// ---- محیط مرورگر شبیه‌سازی‌شده ----
const realFetch = globalThis.fetch;
globalThis.fetch = (u, init) => realFetch(typeof u === "string" && u.startsWith("/") ? BASE + u : u, init);

const storage = new Map();
const events = [];
globalThis.window = {
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
  dispatchEvent: (e) => {
    events.push({ type: e.type, detail: e.detail });
    return true;
  },
  addEventListener() {},
  removeEventListener() {},
  location: { reload() {} },
};
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };

const model = await import("../../.e2e-build/model.mjs");
const store = await import("../../.e2e-build/store.mjs");
const { DB } = model;

const results = [];
let failed = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeout = 8000) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > timeout) throw new Error("timeout waiting for condition");
    await sleep(100);
  }
}
async function rawState(token) {
  const r = await fetch(`${BASE}/api/state`, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}
async function test(name, fn) {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (err) {
    failed++;
    results.push(`FAIL  ${name}\n      ${err.message}`);
  }
}
const tok = () => store.getToken();
const uid = () => Math.random().toString(36).slice(2, 10);
const phone = () => `09${String(Math.floor(1e8 + Math.random() * 9e8))}`;
const nat = () => String(Math.floor(1e9 + Math.random() * 9e9));
const errorsSeen = () => events.filter((e) => e.type === "hamdel:error");

await test("no session: local cache is empty and nothing is sent", async () => {
  assert.deepEqual(DB.users(), []);
  assert.equal(store.getToken(), null);
});

let S1, S2;
await test("developer login hydrates an empty site", async () => {
  const r = await model.login(DEV.phone, DEV.password);
  assert.equal(r.ok, true);
  assert.equal(r.dev, true);
  assert.deepEqual(DB.users(), []);
  assert.deepEqual(DB.messages(), []);
});

await test("manager registers students (cached immediately, persisted on server)", async () => {
  const p1 = phone();
  const a = await model.registerUser({ role: "student", firstName: "سارا", lastName: "الف", fatherName: "پ", nationalId: nat(), address: "ا", phone: p1, password: "1234", grade: 8, section: "2" });
  assert.equal(a.ok, true, a.error);
  S1 = { id: a.user.id, phone: p1, password: "1234" };
  const p2 = phone();
  const b = await model.registerUser({ role: "student", firstName: "دانیال", lastName: "ب", fatherName: "پ", nationalId: nat(), address: "ا", phone: p2, password: "5678", grade: 8, section: "2" });
  assert.equal(b.ok, true, b.error);
  S2 = { id: b.user.id, phone: p2, password: "5678" };
  assert.ok(DB.users().some((u) => u.id === S1.id));
  const st = await rawState(tok());
  assert.ok(st.rows.some((r) => r.c === "users" && r.id === S1.id));
});

await test("duplicate registration reports a readable error", async () => {
  const r = await model.registerUser({ role: "student", firstName: "x", lastName: "y", fatherName: "p", nationalId: nat(), address: "a", phone: S1.phone, password: "1234", grade: 8, section: "2" });
  assert.equal(r.ok, false);
  assert.match(r.error, /قبلاً ثبت/);
});

await test("in-place mutation + DB.saveUsers is detected and synced", async () => {
  const u = DB.users().find((x) => x.id === S1.id);
  u.firstName = "سارای ویرایش‌شده";
  DB.saveUsers(DB.users());
  await waitFor(async () => {
    const st = await rawState(tok());
    return st.rows.find((r) => r.c === "users" && r.id === S1.id)?.d.firstName === "سارای ویرایش‌شده";
  });
});

await test("in-place mutation of a record map (seen) is synced", async () => {
  const seen = DB.seen();
  seen["u_x:chat_y"] = 42;
  DB.saveSeen(seen);
  await waitFor(async () => {
    const st = await rawState(tok());
    return st.rows.some((r) => r.c === "seen" && r.id === "u_x:chat_y" && r.d === 42);
  });
});

await test("deleting from a collection deletes on server", async () => {
  DB.saveNotices([{ id: "n_del", title: "t", body: "b", audience: "all", createdBy: "dev-root", createdAt: Date.now() }]);
  await waitFor(async () => (await rawState(tok())).rows.some((r) => r.c === "notices" && r.id === "n_del"));
  DB.saveNotices([]);
  await waitFor(async () => !(await rawState(tok())).rows.some((r) => r.c === "notices" && r.id === "n_del"));
});

await test("large write is split into batches (450 messages)", async () => {
  const chatId = `g_${uid()}`;
  DB.saveChats([{ id: chatId, type: "group", title: "گروه بزرگ", memberIds: [S1.id, S2.id], createdBy: "dev-root", createdAt: Date.now(), lastActivity: Date.now() }]);
  const msgs = Array.from({ length: 450 }, (_, i) => ({ id: `m_${chatId}_${i}`, chatId, senderId: "dev-root", text: `پیام ${i}`, createdAt: Date.now() + i }));
  DB.saveMessages(msgs);
  await waitFor(async () => {
    const st = await rawState(tok());
    return st.rows.filter((r) => r.c === "messages" && r.id.startsWith(`m_${chatId}_`)).length === 450;
  }, 15000);
});

await test("remote change from another client arrives via polling", async () => {
  const nid = `n_remote_${uid()}`;
  const r = await fetch(`${BASE}/api/state/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
    body: JSON.stringify({ ops: [{ c: "notices", id: nid, d: { id: nid, title: "از راه دور", body: "b", audience: "all", createdBy: "x", createdAt: Date.now() } }] }),
  });
  assert.equal(r.status, 200);
  await waitFor(() => DB.notices().some((n) => n.id === nid), 12000);
});

await test("student login: sees own full record, others shaped (no phone/password)", async () => {
  await model.logout();
  assert.equal(store.getToken(), null);
  const r = await model.login(S1.phone, S1.password);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.user.id, S1.id);
  assert.equal(r.user.phone, S1.phone);
  const other = DB.users().find((u) => u.id === S2.id);
  assert.ok(other, "other student visible");
  assert.equal(other.phone, undefined);
  assert.equal(other.password, undefined);
});

await test("student login records attendance (synced)", async () => {
  const today = DB.attendance().find((a) => a.studentId === S1.id);
  assert.ok(today && today.auto === true);
  await waitFor(async () => (await rawState(tok())).rows.some((r) => r.c === "attendance" && r.d.studentId === S1.id));
});

await test("forbidden write is rolled back and reported", async () => {
  const before = errorsSeen().length;
  const role = DB.users().find((u) => u.id === S1.id);
  const hacked = { ...role, role: "principal" };
  DB.saveUsers(DB.users().map((u) => (u.id === S1.id ? hacked : u)));
  await waitFor(() => errorsSeen().length > before, 8000);
  await waitFor(() => DB.users().find((u) => u.id === S1.id)?.role === "student", 8000);
});

await test("student cannot write attendance for a classmate: rollback after resync", async () => {
  const before = errorsSeen().length;
  DB.saveAttendance([...DB.attendance(), { id: `2026-01-03:${S2.id}`, date: "2026-01-03", studentId: S2.id, status: "absent" }]);
  await waitFor(() => errorsSeen().length > before, 8000);
  await waitFor(() => !DB.attendance().some((a) => a.id === `2026-01-03:${S2.id}`), 8000);
});

await test("student's own read state is accepted", async () => {
  const reads = DB.noticeReads();
  reads[`${S1.id}:n_x`] = Date.now();
  DB.saveNoticeReads(reads);
  await waitFor(async () => (await rawState(tok())).rows.some((r) => r.c === "noticeReads" && r.id === `${S1.id}:n_x`));
});

await test("logout clears local data", async () => {
  await model.logout();
  assert.deepEqual(DB.users(), []);
  assert.equal(store.getToken(), null);
});

await test("wipe with a wrong password is refused and changes nothing", async () => {
  await model.login(DEV.phone, DEV.password);
  assert.equal(await model.verifyWipePassword("wrong"), false);
  const r = await model.wipeAll("wrong");
  assert.equal(r.ok, false);
  assert.ok(DB.users().length > 0);
});

await test("wipe with the right password empties the site and ends the session", async () => {
  assert.equal(await model.verifyWipePassword(WIPE_PASS), true);
  const r = await model.wipeAll(WIPE_PASS);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(DB.users(), []);
  assert.deepEqual(DB.messages(), []);
  assert.equal(store.getToken(), null);
  const st = await fetch(`${BASE}/api/state`);
  assert.equal(st.status, 401);
});

await test("after wipe a fresh developer login sees zero data", async () => {
  const r = await model.login(DEV.phone, DEV.password);
  assert.equal(r.ok, true);
  const st = await rawState(tok());
  assert.deepEqual(st.rows, []);
  await model.logout();
});

// ---- پیش‌نویس‌ها: ذخیره در سرور و بازیابی پس از شروع دوباره ----
const drafts = await import("../../.e2e-build/draftstore.mjs");
const DEV_ID = "dev-root";
const DRAFT_ID = `${DEV_ID}:chat:c_draft`;

await test("drafts: saved on the server and restored after a fresh start", async () => {
  const r = await model.login(DEV.phone, DEV.password);
  assert.equal(r.ok, true);
  drafts.writeDraft(DEV_ID, "chat", "c_draft", "پیش‌نویس");
  await waitFor(async () => (await rawState(tok())).rows.some((x) => x.c === "drafts" && x.id === DRAFT_ID));
  store.clearLocal();
  await store.hydrate();
  assert.equal(drafts.readDraft(DEV_ID, "chat", "c_draft"), "پیش‌نویس");
});

await test("drafts: removal reaches the server", async () => {
  drafts.removeDraft(DEV_ID, "chat", "c_draft");
  await waitFor(async () => !(await rawState(tok())).rows.some((x) => x.c === "drafts" && x.id === DRAFT_ID));
  assert.equal(drafts.readDraft(DEV_ID, "chat", "c_draft"), undefined);
  await model.logout();
});

console.log(results.join("\n"));
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
