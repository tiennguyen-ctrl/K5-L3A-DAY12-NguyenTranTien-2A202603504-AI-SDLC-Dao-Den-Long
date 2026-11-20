// Tạo bằng chứng thật: chạy từng kịch bản qua CLI headless, lưu scenario/inputs/output vào docs/proof/phase1/
// và kiểm lại hành vi. Chạy: npm run proof
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CASES, parse } from "../tests/cases.ts";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "docs", "proof", "phase1");
mkdirSync(outDir, { recursive: true });
// Chỉ dọn thư mục kịch bản của chính script này (không đụng bot/, screenshots/, full-night-*.jsonl)
for (const c of CASES) rmSync(join(outDir, c.name), { recursive: true, force: true });

const rows: string[] = [];
let failed = 0;
for (const c of CASES) {
  const d = join(outDir, c.name);
  mkdirSync(d, { recursive: true });
  const args = ["src/headless/main.ts", "--seed", String(c.seed), "--night", "1", "--ticks", String(c.ticks), "--out", join(d, "output.jsonl")];
  if (c.scenario) { writeFileSync(join(d, "scenario.json"), JSON.stringify(c.scenario, null, 2)); args.push("--scenario", join(d, "scenario.json")); }
  if (c.inputs) { writeFileSync(join(d, "inputs.json"), JSON.stringify(c.inputs, null, 2)); args.push("--inputs", join(d, "inputs.json")); }
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  let ok = r.status === 0;
  let note = "";
  if (ok) {
    try { c.check(parse(readFileSync(join(d, "output.jsonl"), "utf8"))); } catch (e) { ok = false; note = (e as Error).message.split("\n")[0]; }
  } else note = `exit ${r.status}: ${r.stderr.trim()}`;
  if (!ok) failed++;
  rows.push(`| ${c.name} | ${c.proves} | docs/proof/phase1/${c.name}/ | ${ok ? "ĐẠT" : "CHƯA ĐẠT " + note} |`);
}
const table = ["| Kịch bản | Chứng minh | Bằng chứng | Kết quả |", "|---|---|---|---|", ...rows].join("\n");
writeFileSync(join(outDir, "RESULTS.md"), `# Kết quả kịch bản headless Phase 1\n\nSinh bởi \`npm run proof\` (chạy qua CLI headless thật).\n\n${table}\n`);
console.log(table);
if (failed) { console.error(`\n${failed} kịch bản chưa đạt`); process.exitCode = 1; }
