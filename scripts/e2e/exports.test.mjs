// آزمون خروجی‌ها: حضور و غیاب (روزانه/هفتگی/ماهانه) و کارنامه‌ی ماهانه، به‌صورت Word و Excel
// داده‌ها روی حافظه‌ی محلی کلاینت تزریق می‌شوند؛ فایل‌ها ساخته و بازخوانی و با داده مقایسه می‌شوند.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, ".e2e-build");

// ---- ترانspile همه‌ی فایل‌های lib (سازگار با ماژول‌های ESM) ----
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
for (const file of walk(join(root, "src/lib")).filter((f) => f.endsWith(".ts") && !f.endsWith("pdf.ts") && !f.endsWith("index.ts"))) {
  const rel = relative(join(root, "src/lib"), file).replace(/\.ts$/, "");
  const dest = join(out, `${rel}.mjs`);
  mkdirSync(dirname(dest), { recursive: true });
  let js = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  js = js.replace(/from "(\.{1,2}\/[^"]+?)"/g, (_, s) => `from "${s}.mjs"`);
  writeFileSync(dest, js);
}

// ---- محیط مرورگر شبیه‌سازی‌شده ----
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
  dispatchEvent: () => true,
  addEventListener() {},
  removeEventListener() {},
  location: { reload() {} },
};
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };

const model = await import(join(out, "model.mjs"));
const reports = await import(join(out, "reports.mjs"));
const docMod = await import(join(out, "export/doc.mjs"));
const word = await import(join(out, "export/word.mjs"));
const excel = await import(join(out, "export/excel.mjs"));
const ExcelJS = (await import("exceljs")).default;
const { DB } = model;

// ---- داده‌ی آزمایشی: یک کلاس (پایه ۷ شعبه ۱) با ۳ دانش‌آموز و یک ماه حضور و غیاب ----
const now = Date.now();
const students = [
  { id: "u_s1", role: "student", firstName: "علی", lastName: "احمدی", fatherName: "حسن", nationalId: "0012345678", phone: "09120000001", password: "x", grade: 7, section: "1", createdAt: now },
  { id: "u_s2", role: "student", firstName: "زهرا", lastName: "کریمی", phone: "09120000002", password: "x", grade: 7, section: "1", createdAt: now },
  { id: "u_s3", role: "student", firstName: "محمد", lastName: "رضایی", phone: "09120000003", password: "x", grade: 7, section: "1", createdAt: now },
];
DB.saveUsers(students);
const jy = 1404, jm = 8; // آبان ۱۴۰۴ (۳۰ روز)
const dk = (d) => model.jalaliToDateKey(jy, jm, d);
const pattern = { u_s1: "PPAPPAPPAPPAPPAPPAPPAPPAPPAPPA", u_s2: "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", u_s3: "AAPEPPPAAPPPPPPPEPPPPPPPPPPPPP" };
const attendance = [];
for (const s of students) {
  pattern[s.id].split("").forEach((c, i) => {
    const status = c === "P" ? "present" : c === "A" ? "absent" : "excused";
    attendance.push({ id: `${dk(i + 1)}:${s.id}`, date: dk(i + 1), studentId: s.id, status, updatedBy: "dev", updatedAt: now });
  });
}
DB.saveAttendance(attendance);

const exam = { id: "e1", title: "آزمون ریاضی", grade: 7, section: "1", durationMin: 30, status: "published", createdBy: "t", createdAt: now,
  questions: [{ id: "q1", text: "a", score: 10 }, { id: "q2", text: "b", score: 10 }] };
DB.saveExams([exam]);
const midMonthTs = new Date(model.jalaliToDateKey(jy, jm, 10).split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))[0], model.jalaliToDateKey(jy, jm, 10).split("-")[1] - 1, 10, 12).getTime();
DB.saveSubs([
  { id: "sub1", examId: "e1", studentId: "u_s1", answers: {}, startedAt: midMonthTs, submittedAt: midMonthTs, total: 15, graded: true, grades: { q1: 10, q2: 5 } },
  { id: "sub2", examId: "e1", studentId: "u_s2", answers: {}, startedAt: midMonthTs, submittedAt: midMonthTs, total: 8, graded: true, grades: { q1: 8, q2: 0 } },
]);

const results = [];
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (err) {
    failed++;
    results.push(`FAIL  ${name}\n      ${err.message}`);
  }
}

const period = (kind, d) => reports.periodFor(kind, jy, jm, d);

await test("ماهانه: جمع حاضر/غایب/موجه کلاس با داده‌ی خام یکی است", async () => {
  const rep = reports.buildAttendanceReport(7, "1", period("month", 1));
  assert.equal(rep.days.length, 30);
  const raw = (c) => Object.values(pattern).join("").split("").filter((x) => x === c).length;
  assert.equal(rep.totals.present, raw("P"));
  assert.equal(rep.totals.absent, raw("A"));
  assert.equal(rep.totals.excused, raw("E"));
  const r1 = rep.rows.find((r) => r.student.id === "u_s1");
  assert.equal(r1.present, pattern.u_s1.split("").filter((c) => c === "P").length);
});

await test("هفتگی: بازه‌ی شنبه تا جمعه و ۷ روز", async () => {
  const p = period("week", 15);
  const from = new Date(p.from.split("-").map(Number)[0], p.from.split("-")[1] - 1, p.from.split("-")[2]);
  assert.equal(from.getDay(), 6, "شروع هفته باید شنبه (getDay=6) باشد");
  const to = new Date(p.to.split("-").map(Number)[0], p.to.split("-")[1] - 1, p.to.split("-")[2]);
  assert.equal((to - from) / 86400000, 6);
});

await test("روزانه: یک ستون با وضعیت همان روز", async () => {
  const rep = reports.buildAttendanceReport(7, "1", period("day", 3));
  assert.equal(rep.days.length, 1);
  assert.equal(rep.rows.find((r) => r.student.id === "u_s1").cells[0], "absent"); // روز ۳ = A
});

await test("کارنامه: نمره‌ی درصدی و میانگین ماه", async () => {
  const card = reports.buildReportCard(students[0], jy, jm);
  assert.equal(card.exams.length, 1);
  assert.equal(card.exams[0].score, 15);
  assert.equal(card.exams[0].total, 20);
  assert.equal(card.exams[0].percent, 75);
  assert.equal(card.average, 75);
  assert.equal(card.days.length, 30);
  assert.equal(card.attendance.present, pattern.u_s1.split("").filter((c) => c === "P").length);
});

await test("سند کارنامه و حضور: فیلدهای کامل", async () => {
  const doc = docMod.reportCardDoc(students[0].id, jy, jm);
  assert.ok(doc.meta.some(([k, v]) => k === "کد ملی" && v === "۰۰۱۲۳۴۵۶۷۸"));
  assert.equal(doc.tables.length, 2);
  assert.ok(doc.tables[0].rows.length > 0, "جدول آزمون باید ردیف داشته باشد");
  const att = docMod.attendanceDoc(7, "1", period("month", 1));
  assert.equal(att.tables[0].rows.length, 3);
  assert.equal(att.tables[0].headers.length, 2 + 30 + 4);
});

await test("Word: فایل معتبر و راست‌به‌چپ با متن فارسی", async () => {
  const doc = docMod.attendanceDoc(7, "1", period("month", 1));
  const blob = await word.renderWord(doc);
  const path = join(out, "exports", "attendance-month.docx");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
  const xml = execFileSync("unzip", ["-p", path, "word/document.xml"]).toString();
  assert.ok(xml.includes("حضور و غیاب"));
  assert.ok(xml.includes("<w:bidiVisual"), "جدول باید راست‌به‌چپ باشد");
  assert.ok(xml.includes("<w:bidi"), "پاراگراف‌ها باید راست‌به‌چپ باشند");
});

await test("Excel: شیت راست‌به‌چپ و مقادیر درست", async () => {
  const doc = docMod.reportCardDoc(students[0].id, jy, jm);
  const blob = await excel.renderExcel(doc);
  const path = join(out, "exports", "report-card.xlsx");
  writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];
  assert.equal(ws.views[0].rightToLeft, true);
  const texts = [];
  ws.eachRow((row) => row.eachCell((c) => texts.push(String(c.value ?? ""))));
  assert.ok(texts.includes("آزمون ریاضی"));
  assert.ok(texts.includes("۷۵٪"));
});

results.forEach((l) => console.log(l));
console.log(`\n${results.length - failed}/${results.length} passed`);
if (failed) process.exit(1);
