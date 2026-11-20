/**
 * Bảng xếp hạng cục bộ (Ticket-04): logic thuần, dùng chung cho trình duyệt (src/web/main.ts)
 * và Node (scripts/run.ts: lưu ra đĩa và --export-leaderboard).
 */
export interface LeaderEntry {
  name: string;
  /** tổng điểm các Đêm đã thắng */
  score: number;
  /** số Đêm đã thắng, 0..3 */
  nights_won: number;
  /** ISO 8601 có múi giờ */
  achieved_at: string;
  seed: number;
}

export const MAX_ENTRIES = 10;
export const LEADERBOARD_KEY = "dao-den-long.leaderboard.v1";

/**
 * Tên 3–12 ký tự gồm chữ cái, chữ số, gạch dưới. Yêu cầu của ticket là [A-Za-z0-9_];
 * tôi nhận thêm chữ cái tiếng Việt có dấu (điểm cộng, ticket nói không bắt buộc).
 */
const NAME_RE = /^[\p{L}\p{N}_]+$/u;

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

export function validateName(raw: unknown): NameCheck {
  if (typeof raw !== "string") return { ok: false, reason: "Tên phải là chuỗi" };
  const name = raw.trim().normalize("NFC");
  const len = [...name].length;
  if (len < 3 || len > 12) return { ok: false, reason: "Tên dài 3–12 ký tự" };
  if (!NAME_RE.test(name)) return { ok: false, reason: "Tên chỉ gồm chữ, số và dấu gạch dưới _" };
  return { ok: true, name };
}

/** ISO 8601 theo giờ máy, kèm múi giờ (ví dụ 2026-11-20T17:30:05+07:00). */
export function isoWithOffset(d: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  );
}

/** Điểm giảm dần; bằng điểm thì ai đạt trước đứng trên; bằng cả thời điểm thì ai vào trước (sắp ổn định). */
export function sortEntries(list: LeaderEntry[]): LeaderEntry[] {
  return list
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.score - a.e.score || Date.parse(a.e.achieved_at) - Date.parse(b.e.achieved_at) || a.i - b.i)
    .map((x) => x.e);
}

export function addEntry(list: LeaderEntry[], entry: LeaderEntry, max: number = MAX_ENTRIES): LeaderEntry[] {
  return sortEntries([...list, entry]).slice(0, max);
}

/** Điểm này có vào được top 10 không (để biết có nên mời nhập tên). */
export function qualifies(list: LeaderEntry[], score: number, max: number = MAX_ENTRIES): boolean {
  return list.length < max || score > list[Math.min(list.length, max) - 1].score;
}

function isEntry(v: unknown): v is LeaderEntry {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    validateName(o.name).ok &&
    typeof o.score === "number" && Number.isFinite(o.score) && o.score >= 0 &&
    typeof o.nights_won === "number" && Number.isInteger(o.nights_won) && o.nights_won >= 0 && o.nights_won <= 3 &&
    typeof o.achieved_at === "string" && Number.isFinite(Date.parse(o.achieved_at)) &&
    typeof o.seed === "number" && Number.isFinite(o.seed)
  );
}

/** Làm sạch dữ liệu đọc từ đĩa/localStorage: bỏ mục hỏng, sắp xếp lại, giữ top 10. */
export function sanitizeEntries(raw: unknown): LeaderEntry[] {
  const arr = Array.isArray(raw) ? raw : typeof raw === "object" && raw !== null && Array.isArray((raw as { entries?: unknown }).entries) ? (raw as { entries: unknown[] }).entries : [];
  const ok = arr.filter(isEntry).map((e) => ({ name: e.name, score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed }));
  return sortEntries(ok).slice(0, MAX_ENTRIES);
}

/** Dựng mục mới sau khi kiểm tên; trả lỗi (không lưu) nếu tên sai. */
export function makeEntry(rawName: unknown, score: number, nightsWon: number, seed: number, now: Date = new Date()): { ok: true; entry: LeaderEntry } | { ok: false; reason: string } {
  const c = validateName(rawName);
  if (!c.ok) return c;
  return { ok: true, entry: { name: c.name, score: Math.max(0, Math.floor(score)), nights_won: Math.min(3, Math.max(0, Math.floor(nightsWon))), achieved_at: isoWithOffset(now), seed } };
}

export const exportJson = (list: LeaderEntry[]): string => JSON.stringify({ entries: sortEntries(list).slice(0, MAX_ENTRIES) }, null, 2) + "\n";
