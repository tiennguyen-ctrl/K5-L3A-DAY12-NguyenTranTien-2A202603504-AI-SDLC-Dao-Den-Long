/** Đổi phím (Ticket-04): logic thuần, test được mà không cần trình duyệt. Phím lưu theo KeyboardEvent.code. */
export const ACTIONS = ["up", "down", "left", "right", "jump", "dash", "interact", "pulse", "pause"] as const;
export type Action = (typeof ACTIONS)[number];
export type KeyMap = Record<Action, string>;

export const ACTION_LABEL: Record<Action, string> = {
  up: "Đi tới", down: "Đi lùi", left: "Sang trái", right: "Sang phải",
  jump: "Nhảy", dash: "Lướt", interact: "Nạp / châm dầu", pulse: "Tỏa Sáng", pause: "Tạm dừng",
};

export const DEFAULT_KEYS: KeyMap = {
  up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD",
  jump: "Space", dash: "ShiftLeft", interact: "KeyE", pulse: "KeyF", pause: "Escape",
};

/** Phím dành riêng cho game, không cho gán: Enter (xác nhận), F3 (FPS), mũi tên (xoay camera). */
export const RESERVED = ["Enter", "NumpadEnter", "F3", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const names: Record<string, string> = { Space: "Space", ShiftLeft: "Shift", ShiftRight: "Shift phải", Escape: "Esc", ControlLeft: "Ctrl", AltLeft: "Alt", Tab: "Tab" };
  return names[code] ?? code;
}

/** Cặp hành động đang trùng phím (rỗng nếu hợp lệ). */
export function findConflicts(map: KeyMap): [Action, Action][] {
  const out: [Action, Action][] = [];
  for (let i = 0; i < ACTIONS.length; i++) {
    for (let j = i + 1; j < ACTIONS.length; j++) if (map[ACTIONS[i]] === map[ACTIONS[j]]) out.push([ACTIONS[i], ACTIONS[j]]);
  }
  return out;
}

export type AssignResult = { ok: true; map: KeyMap } | { ok: false; reason: "reserved" | "duplicate"; with?: Action };

/** Gán phím cho một hành động. Trùng với hành động khác hoặc phím dành riêng thì KHÔNG gán và báo lý do. */
export function assignKey(map: KeyMap, action: Action, code: string): AssignResult {
  if (RESERVED.includes(code)) return { ok: false, reason: "reserved" };
  const other = ACTIONS.find((a) => a !== action && map[a] === code);
  if (other) return { ok: false, reason: "duplicate", with: other };
  return { ok: true, map: { ...map, [action]: code } };
}

/** Làm sạch dữ liệu đọc từ localStorage: thiếu/trùng/hỏng thì về mặc định. */
export function sanitizeKeys(raw: unknown): KeyMap {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_KEYS };
  const o = raw as Record<string, unknown>;
  const map = { ...DEFAULT_KEYS };
  for (const a of ACTIONS) {
    const v = o[a];
    if (typeof v !== "string" || v.length === 0 || v.length > 30 || RESERVED.includes(v)) return { ...DEFAULT_KEYS };
    map[a] = v;
  }
  return findConflicts(map).length ? { ...DEFAULT_KEYS } : map;
}

/** Phím `code` có kích hoạt hành động không (Shift phải cũng tính khi gán Shift trái). */
export const isDown = (map: KeyMap, action: Action, down: ReadonlySet<string>): boolean =>
  down.has(map[action]) || (map[action] === "ShiftLeft" && down.has("ShiftRight"));
