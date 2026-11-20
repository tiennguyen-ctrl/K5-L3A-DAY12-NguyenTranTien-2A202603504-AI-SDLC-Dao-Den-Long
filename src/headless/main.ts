import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { runHeadless } from "../core/runner.ts";
import { FormatError, parseInputs, parseScenario } from "../core/validate.ts";

const USAGE =
  "usage: --seed <int> --night <1|2|3> [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int>]";

class UsageError extends Error {}

/** Chấp nhận cả `--seed 1`, `-seed 1` và `--seed=1`. */
function parseArgs(argv: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("-")) throw new UsageError(`tham số lạ: ${a}`);
    const body = a.replace(/^--?/, "");
    const eq = body.indexOf("=");
    if (eq >= 0) {
      m.set(body.slice(0, eq), body.slice(eq + 1));
      continue;
    }
    const v = argv[++i];
    if (v === undefined) throw new UsageError(`thiếu giá trị cho ${a}`);
    m.set(body, v);
  }
  return m;
}

function intArg(m: Map<string, string>, k: string, required: boolean, def = 0): number {
  const v = m.get(k);
  if (v === undefined) {
    if (required) throw new UsageError(`thiếu --${k}`);
    return def;
  }
  if (!/^-?\d+$/.test(v)) throw new UsageError(`--${k} phải là số nguyên: ${v}`);
  return Number(v);
}

function readText(path: string, what: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    throw new FormatError(`không đọc được ${what} "${path}": ${(e as Error).message}`);
  }
}

function main(): void {
  const a = parseArgs(process.argv.slice(2));
  const seed = intArg(a, "seed", true);
  const night = intArg(a, "night", true);
  const ticks = intArg(a, "ticks", true);
  const every = intArg(a, "snapshot-every", false, 10);
  const out = a.get("out");
  if (!out) throw new UsageError("thiếu --out");
  if (night < 1 || night > 3) throw new UsageError(`--night phải là 1, 2 hoặc 3 (nhận ${night})`);
  if (ticks < 0) throw new UsageError("--ticks phải >= 0");
  if (every < 1) throw new UsageError("--snapshot-every phải >= 1");

  const sp = a.get("scenario");
  const ip = a.get("inputs");
  const scenario = sp ? parseScenario(readText(sp, "scenario")) : undefined;
  const inputs = ip ? parseInputs(readText(ip, "inputs")) : undefined;

  const lines = runHeadless({ seed, night, ticks, snapshotEvery: every, scenario, inputs });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join("\n") + "\n");
}

try {
  main();
} catch (e) {
  if (e instanceof FormatError) {
    console.error(`lỗi định dạng: ${e.message}`);
    process.exitCode = 2;
  } else if (e instanceof UsageError) {
    console.error(`lỗi tham số: ${e.message}\n${USAGE}`);
    process.exitCode = 1;
  } else {
    console.error(`lỗi: ${(e as Error).stack ?? e}`);
    process.exitCode = 1;
  }
}
