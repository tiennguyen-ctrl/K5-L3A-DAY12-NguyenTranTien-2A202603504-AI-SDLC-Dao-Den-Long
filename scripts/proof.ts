// Tạo bằng chứng thật: chạy từng kịch bản qua CLI headless, lưu scenario/inputs/output vào docs/proof/phase2/<kịch bản>/
// và kiểm lại hành vi. Chạy: npm run proof
// (docs/proof/phase1/ là bằng chứng đã đóng băng theo tag phase-1, script này KHÔNG đụng tới.)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CASES, parse } from "../tests/cases.ts";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "docs", "proof", "phase2");
mkdirSync(outDir, { recursive: true });
for (const c of CASES) rmSync(join(outDir, c.name), { recursive: true, force: true });

const rows: string[] = [];
let failed = 0;
for (const c of CASES) {
  const d = join(outDir, c.name);
  mkdirSync(d, { recursive: true });
  const args = ["src/headless/main.ts", "--seed", String(c.seed), "--night", String(c.night ?? 1), "--ticks", String(c.ticks), "--out", join(d, "output.jsonl")];
  if (c.snapshotEvery) args.push("--snapshot-every", String(c.snapshotEvery));
  if (c.scenario) { writeFileSync(join(d, "scenario.json"), JSON.stringify(c.scenario, null, 2)); args.push("--scenario", join(d, "scenario.json")); }
  if (c.inputs) { writeFileSync(join(d, "inputs.json"), JSON.stringify(c.inputs, null, 2)); args.push("--inputs", join(d, "inputs.json")); }
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  let ok = r.status === 0;
  let note = "";
  if (ok) {
    try { c.check(parse(readFileSync(join(d, "output.jsonl"), "utf8"))); } catch (e) { ok = false; note = (e as Error).message.split("\n")[0]; }
  } else note = `exit ${r.status}: ${r.stderr.trim()}`;
  if (!ok) failed++;
  rows.push(`| ${c.name} | ${c.phase === 1 ? "hồi quy P1" : "mới P2"} | Đêm ${c.night ?? 1} | ${c.proves} | ${ok ? "ĐẠT" : "CHƯA ĐẠT " + note} |`);
}
const table = ["| Kịch bản | Loại | Bản đồ | Chứng minh | Kết quả |", "|---|---|---|---|---|", ...rows].join("\n");
writeFileSync(join(outDir, "RESULTS.md"), `# Kết quả kịch bản headless Phase 2\n\nSinh bởi \`npm run proof\` (chạy qua CLI headless thật). Mỗi thư mục con có \`scenario.json\`, \`inputs.json\`, \`output.jsonl\`.\n\n${table}\n`);
console.log(table);
if (failed) { console.error(`\n${failed} kịch bản chưa đạt`); process.exitCode = 1; }
