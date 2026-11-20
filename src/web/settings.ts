/** Cài đặt người chơi (âm lượng, độ nhạy chuột), lưu giữa các lần mở game bằng localStorage. */
export interface Settings {
  /** 0..1 */
  volume: number;
  /** 0.2..3 (1 = mặc định) */
  sensitivity: number;
}

export const DEFAULT_SETTINGS: Settings = { volume: 0.7, sensitivity: 1 };
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
    return text ? sanitize(JSON.parse(text)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
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
