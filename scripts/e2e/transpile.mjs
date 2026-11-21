// کامپایل ماژول‌های کلاینت (TypeScript) به JavaScript برای آزمون‌های Node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, ".e2e-build");
mkdirSync(out, { recursive: true });

for (const name of ["collections", "store", "model"]) {
  const src = readFileSync(join(root, "src/lib", `${name}.ts`), "utf8");
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  js = js.replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(out, `${name}.mjs`), js);
}
console.log("TRANSPILED", out);
