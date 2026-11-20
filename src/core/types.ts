export type Vec3 = [number, number, number];

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
}

/** Trạng thái input đang giữ (sau khi áp các frame). */
export interface InputState {
  move: [number, number];
  yaw: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
}

export interface Scenario {
  player?: { pos?: Vec3; carried?: number; flames?: number };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3 }[];
  lanterns?: { id: string; pos?: Vec3; deposited?: number; lit?: boolean }[];
  time_left_s?: number;
}

export interface GameEvent {
  type: "event";
  tick: number;
  name: string;
  data: Record<string, unknown>;
}
