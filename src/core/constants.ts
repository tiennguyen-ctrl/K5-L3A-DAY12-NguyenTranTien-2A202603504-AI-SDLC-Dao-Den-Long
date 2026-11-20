import contract from "../../game.contract.json" with { type: "json" };

/** Nguồn sự thật duy nhất cho các con số tuning: game.contract.json. */
export const T = contract.tuning;

export const TICKS_PER_SECOND = 60;
export const DT = 1 / TICKS_PER_SECOND;
export const ticksOf = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);

/** Hằng số chuẩn của Ticket-02 và các lựa chọn của tôi (xem docs/notes/phase2-spec.md). */
export const WORLD = {
  // di chuyển
  jump_speed: 7,
  gravity: 20,
  step_height: 0.35,
  fall_y: -10,
  fall_wait_ticks: 60,
  respawn_invuln_ticks: 90,
  // đom đóm
  mote_initial: 20,
  mote_cap: 30,
  mote_spawn_every: 240,
  mote_drop_ttl: 480,
  mote_drop_r_min: 1.5,
  mote_drop_r_max: 2.5,
  touch_height: 1.5,
  // bóng mực
  shade_detect: 12,
  shade_abandon: 18,
  shade_spawning_ticks: 30,
  shade_wander_speed: 2,
  shade_center_height: 1,
  shade_recoil_ticks: 60,
  shade_recoil_m: 2,
  shade_push_ticks: 15,
  shade_first_tick: 300,
  shade_first_count: 2,
  shade_min_player_dist: 15,
  zone_margin: 0.01,
  zone_push_per_tick: 0.2004, // (6 + 0,01) / 30: từ tâm đèn ra mép trong tối đa 30 tick
  // sức chứa tăng dần (Ticket-03)
  capacity_per_light: 2,
  // bóng hút dầu (Ticket-03)
  drain_range: 2,
  drain_event_every: 60,
  // tỏa sáng
  pulse_center_up: 0.8,
  // gió lạc
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_spawn_every: 1200,
  drifter_trigger_carried: 5,
  drifter_trigger_dist: 15,
  drifter_steal_radius: 1.2,
  drifter_steal_amount: 3,
  drifter_flee_ticks: 240,
  drifter_drop_vanish_ticks: 120,
  // bùa gió
  charm_ticks: 600,
  charm_speed: 7.2,
  charm_respawn_ticks: 2700,
  // gió mạnh
  wind_period: 1800,
  wind_duration: 300,
  wind_warning: 120,
  wind_speed: 2,
} as const;
