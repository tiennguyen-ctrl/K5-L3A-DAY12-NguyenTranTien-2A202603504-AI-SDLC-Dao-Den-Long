import contract from "../../game.contract.json" with { type: "json" };

/** Nguồn sự thật duy nhất cho các con số: game.contract.json -> tuning. */
export const T = contract.tuning;

export const TICKS_PER_SECOND = 60;
export const DT = 1 / TICKS_PER_SECOND;

/** Hằng số thế giới không nằm trong contract (xem docs/notes/phase1-assumptions.md). */
export const WORLD = {
  island_radius: 40,
  lantern_ring_radius: 25,
  gravity: 20,
  jump_speed: 7.5,
  mote_target: 24,
  mote_respawn_ticks: 180,
  mote_min_r: 4,
  mote_max_r: 36,
  shade_first_tick: 480,
  shade_interval_ticks: 900,
  shade_max: 5,
  shade_spawn_radius: 38,
  shade_height: 1,
  /** Bóng Mực bị đẩy ra ngoài safe_radius + biên này để khoảng cách luôn > safe_radius. */
  safe_margin: 0.01,
} as const;
