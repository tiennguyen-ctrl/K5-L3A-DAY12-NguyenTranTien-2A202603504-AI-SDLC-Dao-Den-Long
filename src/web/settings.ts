import { DEFAULT_KEYS, sanitizeKeys } from "./keybinds.ts";
import type { KeyMap } from "./keybinds.ts";

/** Cài đặt người chơi (âm lượng, độ nhạy chuột, phím, trợ năng), lưu giữa các lần mở game bằng localStorage. */
export interface Settings {
  /** 0..1 */
  volume: number;
  /** 0.2..3 (1 = mặc định) */
  sensitivity: number;
  /** Bảng màu dễ phân biệt (chế độ mù màu), Ticket-03. */
  colorblind: boolean;
  /** Giảm chuyển động (Ticket-04): tắt rung/nảy camera và hiệu ứng chớp màn hình. */
  reduceMotion: boolean;
  /** Chữ lớn ×1,25 (Ticket-04). */
  largeText: boolean;
  /** Phím điều khiển, theo KeyboardEvent.code. */
  keys: KeyMap;
}

export const DEFAULT_SETTINGS: Settings = { volume: 0.7, sensitivity: 1, colorblind: false, reduceMotion: false, largeText: false, keys: { ...DEFAULT_KEYS } };
export const SETTINGS_KEY = "dao-den-long.settings.v1";

/** Giao diện tối thiểu của storage để test được mà không cần trình duyệt. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const clamp = (v: unknown, lo: number, hi: number, def: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : def;
  return Math.min(hi, Math.max(lo, n));
};

export function sanitize(raw: unknown): Settings {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    volume: clamp(o.volume, 0, 1, DEFAULT_SETTINGS.volume),
    sensitivity: clamp(o.sensitivity, 0.2, 3, DEFAULT_SETTINGS.sensitivity),
    colorblind: o.colorblind === true,
    reduceMotion: o.reduceMotion === true,
    largeText: o.largeText === true,
    keys: sanitizeKeys(o.keys),
  };
}

function defaultStorage(): KV | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // localStorage có thể bị chặn (chế độ riêng tư...)
  }
}

export function loadSettings(storage: KV | null = defaultStorage()): Settings {
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    return text ? sanitize(JSON.parse(text)) : { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS } };
  } catch {
    return { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS } };
  }
}

export function saveSettings(s: Settings, storage: KV | null = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SETTINGS_KEY, JSON.stringify(sanitize(s)));
    return true;
  } catch {
    return false;
  }
}
