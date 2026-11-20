// Máy chủ nhỏ dùng chung (Ticket-04): phục vụ thư mục web tĩnh + API bảng xếp hạng lưu ra ĐĨA + nhận kết quả benchmark.
// Dùng cho: scripts/serve.ts (chơi bản build), scripts/bench.ts (benchmark), scripts/run.ts (middleware của Vite dev).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { addEntry, exportJson, sanitizeEntries } from "../src/web/leaderboard.ts";
import type { LeaderEntry } from "../src/web/leaderboard.ts";

/** Nơi lưu bảng xếp hạng trên đĩa. Có thể đổi bằng biến môi trường DDL_LEADERBOARD. */
export const leaderboardPath = (root: string) => process.env.DDL_LEADERBOARD ?? join(root, "data", "leaderboard.json");

export function readLeaderboard(file: string): LeaderEntry[] {
  try {
    return existsSync(file) ? sanitizeEntries(JSON.parse(readFileSync(file, "utf8"))) : [];
  } catch {
    return []; // file hỏng: coi như rỗng, không làm vỡ game
  }
}

export function writeLeaderboard(file: string, list: LeaderEntry[]): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, exportJson(list));
}

async function body(req: IncomingMessage): Promise<string> {
  let s = "";
  for await (const c of req) { s += c; if (s.length > 100_000) throw new Error("quá lớn"); }
  return s;
}

const json = (res: ServerResponse, code: number, data: unknown) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
};

/** Xử lý /api/leaderboard (GET lấy top 10, POST thêm một mục). Trả true nếu đã xử lý. */
export async function handleLeaderboard(req: IncomingMessage, res: ServerResponse, file: string): Promise<boolean> {
  if (!(req.url ?? "").startsWith("/api/leaderboard")) return false;
  if (req.method === "GET") { json(res, 200, { entries: readLeaderboard(file) }); return true; }
  if (req.method === "POST") {
    try {
      const [entry] = sanitizeEntries([JSON.parse(await body(req))]);
      if (!entry) { json(res, 400, { error: "mục không hợp lệ (tên 3–12 ký tự, điểm, nights_won 0–3, achieved_at ISO 8601, seed)" }); return true; }
      const list = addEntry(readLeaderboard(file), entry);
      writeLeaderboard(file, list);
      json(res, 200, { entries: list });
    } catch {
      json(res, 400, { error: "yêu cầu không hợp lệ" });
    }
    return true;
  }
  json(res, 405, { error: "chỉ hỗ trợ GET và POST" });
  return true;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".map": "application/json",
};

export interface ServerOptions {
  dir: string;
  leaderboardFile: string;
  /** Nhận kết quả benchmark do trang bench gửi tới (POST /__bench_result). */
  onBenchResult?: (data: Record<string, unknown>) => void;
}

export function createStaticServer(o: ServerOptions): Server {
  return createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/__bench_result" && o.onBenchResult) {
        o.onBenchResult(JSON.parse(await body(req)));
        json(res, 200, { ok: true });
        return;
      }
      if (await handleLeaderboard(req, res, o.leaderboardFile)) return;
      const url = new URL(req.url ?? "/", "http://localhost");
      let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
      if (rel === "" || rel.endsWith("/")) rel += "index.html";
      if (rel.includes("..")) { res.writeHead(403); res.end("cấm"); return; }
      const file = join(o.dir, rel);
      if (!existsSync(file)) { res.writeHead(404); res.end("không có"); return; }
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(readFileSync(file));
    } catch (e) {
      res.writeHead(500); res.end(String((e as Error).message));
    }
  });
}
