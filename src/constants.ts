// ─── Game dimensions ────────────────────────────────────────────────────────
export const W = 1920;
export const H = 1080;

// ─── Depth layers ────────────────────────────────────────────────────────────
export const DEPTH = {
  BG_FAR:    0,
  BG_MID:    2,
  BG_NEAR:   4,
  PICKUP:    8,
  EBULLET:   10,
  ENEMY:     15,
  PBULLET:   18,
  PLAYER:    20,
  FX:        25,
  HUD:       100,
  OVERLAY:   200,
} as const;

// ─── Player (re-exported from balance for backward compat) ──────────────────
import { BALANCE } from './balance';

export const PLAYER_SPEED       = BALANCE.player.speed;
export const PLAYER_FOCUS_SPEED = BALANCE.player.focusSpeed;
export const SHOOT_INTERVAL     = BALANCE.player.shootInterval;
export const PBULLET_SPEED      = BALANCE.player.bulletSpeed;
export const HITBOX_R           = BALANCE.player.hitboxR;
export const GRAZE_R            = BALANCE.player.grazeR;
export const IFRAMES            = BALANCE.player.iframes;
export const BOMB_DURATION      = BALANCE.player.bombDuration;
export const RESPAWN_DELAY      = BALANCE.player.respawnDelay;
export const START_LIVES        = BALANCE.player.startLives;
export const START_BOMBS        = BALANCE.player.startBombs;
export const MAX_POWER          = BALANCE.player.maxPower;

// ─── Score (re-exported from balance) ───────────────────────────────────────
export const SC_ENEMY  = 100;
export const SC_GRAZE  = BALANCE.score.graze;
export const SC_PICKUP = BALANCE.score.pickup;

// ─── Enemy bullet base speed (re-exported from balance) ─────────────────────
export const EBULLET_BASE = BALANCE.bulletSpeed.base;

// ─── Boss positioning (re-exported from balance) ────────────────────────────
export const BOSS_HOME_X = BALANCE.boss.homeX;
export const BOSS_HOME_Y = BALANCE.boss.homeY;

// ─── Font ────────────────────────────────────────────────────────────────────
export const FONT = '"Consolas", "SF Mono", "Menlo", "Liberation Mono", monospace';

// ─── Colors ──────────────────────────────────────────────────────────────────
export const COL = {
  SCORE:  0xe8f4ff,
  LIVES:  0xffcc44,
  BOMBS:  0xcc88ff,
  POWER:  0x44eeff,
  GRAZE:  0xff88cc,
  HP_BAR: 0xff4488,
  WHITE:  0xffffff,
  BLACK:  0x000000,
} as const;
