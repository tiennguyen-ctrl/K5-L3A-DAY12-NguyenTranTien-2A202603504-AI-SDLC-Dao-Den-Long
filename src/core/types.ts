export type Vec3 = [number, number, number];

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

/** Trạng thái input đang giữ (sau khi áp các frame). */
export interface InputState {
  move: [number, number];
  yaw: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export const SHADE_STATES = ["spawning", "wander", "chase", "recoil", "stunned"] as const;
export type ShadeState = (typeof SHADE_STATES)[number];
export const DRIFTER_STATES = ["idle", "chase", "flee", "removed"] as const;
export type DrifterState = (typeof DRIFTER_STATES)[number];

export interface Scenario {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: { pos: Vec3; kind?: "random" | "dropped"; ttl_ticks?: number }[];
  shades?: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number }[];
  drifters?: { id?: string; pos: Vec3; state?: DrifterState; stolen?: number; state_ticks_left?: number }[];
  charms?: { id?: string; pos?: Vec3; available?: boolean; respawn_ticks?: number }[];
  lanterns?: { id: string; pos?: Vec3; deposited?: number; lit?: boolean }[];
  time_left_s?: number;
}

export interface GameEvent {
  type: "event";
  tick: number;
  name: string;
  data: Record<string, unknown>;
}
