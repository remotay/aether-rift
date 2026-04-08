// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE CONFIG — single source of truth for all tunable gameplay numbers
// ═══════════════════════════════════════════════════════════════════════════════
//
// Adjust values here to rebalance the entire game. No magic numbers in game logic.
// Import this file wherever you need gameplay constants.

export const BALANCE = {

  // ─── Player ──────────────────────────────────────────────────────────────
  player: {
    speed:          440,
    focusSpeed:     176,
    shootInterval:  0.10,       // seconds between shot bursts (was 0.09)
    bulletSpeed:    1800,
    hitboxR:        10,
    grazeR:         50,
    iframes:        2.5,
    bombDuration:   3.2,
    respawnDelay:   1.4,
    startLives:     3,
    startBombs:     3,
    maxPower:       128,

    /** Power per gem collected (was 2, now 1 for slower progression) */
    powerPerGem:    2,

    /** Power level thresholds: [lvl2, lvl3, lvl4] */
    powerThresholds: [24, 56, 100] as [number, number, number],

    /** Damage formula: base + powerLevel * perLevel */
    damage: {
      base:     2,              // was 4
      perLevel: 2,              // was 3 → gives 4/6/8/10 instead of 7/10/13/16
    },

    /** Bomb damage by target type */
    bomb: {
      enemyDamage:    200,      // was 999 — still kills most regulars
      minibossDamage: 80,       // was 180
      bossDamage:     60,       // was 120
    },
  },

  // ─── Enemy HP and speed by type ──────────────────────────────────────────
  enemies: {
    fairy: {
      hp:       18,             // -25%
      speed:    320,
      hoverDur: 5,
      score:    100,
    },
    bat: {
      hp:       9,              // -25%
      speed:    400,
      hoverDur: 0,
      score:    80,
    },
    soul: {
      hp:       38,             // -25%
      speed:    240,
      hoverDur: 6,
      score:    200,
    },
    wisp: {
      hp:       14,             // -25%
      speed:    380,
      hoverDur: 4,
      score:    150,
    },
    phantom: {
      hp:       53,             // -25%
      speed:    180,
      hoverDur: 8,
      score:    250,
    },
    knight: {
      hp:       68,             // -25%
      speed:    260,
      hoverDur: 7,
      score:    300,
    },
  },

  // ─── Enemy bullet speeds by stage section ────────────────────────────────
  // Used by fireEnemyPattern to vary difficulty across the stage
  bulletSpeed: {
    early:  240,                // waves 1-3: slow, learnable
    mid:    310,                // waves 4-8: moderate
    late:   360,                // waves 9-15: challenging
    base:   310,                // fallback / default
  },

  // ─── Wave timing ─────────────────────────────────────────────────────────
  waves: {
    /** Total stage pre-miniboss duration target: ~80 seconds of waves */
    totalWaves:    18,

    /** Breathing room between concepts (seconds) */
    breathingRoom: 4,

    /** Miniboss triggers when all waves spawned AND enemies cleared */
  },

  // ─── Miniboss ────────────────────────────────────────────────────────────
  miniboss: {
    hp:            2200,        // -60%
    attackTimer:   1.5,         // initial delay before first attack
    score:         3000,

    /** Bullet speed multiplier for miniboss attacks */
    bulletSpeedMult: 0.85,      // relative to base
  },

  // ─── Boss ────────────────────────────────────────────────────────────────
  boss: {
    totalHp:       8000,        // -60%

    /** Phase thresholds as fraction of maxHp remaining */
    phase2at:      0.60,        // enter phase 2 when HP drops to 60% (12000 HP left)
    phase3at:      0.28,        // enter phase 3 when HP drops to 28% (5600 HP left)

    /** Per-phase bullet speeds */
    phase1speed:   340,         // readable, learnable
    phase2speed:   380,         // moderate
    phase3speed:   420,         // intense

    /** Telegraph durations per phase */
    phase1telegraph: 0.8,       // generous — teach patterns
    phase2telegraph: 0.5,       // moderate
    phase3telegraph: 0.35,      // intense — less warning

    /** Pause between attacks per phase */
    phase1pause:   1.6,         // breathing room
    phase2pause:   1.2,         // tighter
    phase3pause:   0.7,         // relentless

    /** Idle time between attack cycles per phase */
    phase1idle:    0.5,
    phase2idle:    0.3,
    phase3idle:    0.15,

    /** Phase transition grace period */
    phaseTransitionPause: 2.5,

    score:         20000,

    /** Boss positioning */
    homeX:         1500,
    homeY:         540,
  },

  // ─── Score ───────────────────────────────────────────────────────────────
  score: {
    graze:         15,
    pickup:        50,
    /** Score multiplier: consecutive kills within window grant bonus */
    chainWindow:   2.0,         // seconds to maintain chain
    chainBonus:    0.1,         // +10% per chain level
    maxChainMult:  2.0,         // cap at 2x
  },

  // ─── Pickup rates ────────────────────────────────────────────────────────
  pickups: {
    /** Chance to spawn a power gem on enemy kill */
    powerDropRate:   0.35,
    /** Number of power gems from miniboss kill */
    minibossDrops:   6,
    /** Number of power gems from boss kill */
    bossDrops:       8,
  },

} as const;

// ─── Derived helpers ──────────────────────────────────────────────────────

/** Get bullet speed for a given wave number (1-indexed) */
export function getWaveBulletSpeed(waveNum: number): number {
  if (waveNum <= 3)  return BALANCE.bulletSpeed.early;
  if (waveNum <= 8)  return BALANCE.bulletSpeed.mid;
  return BALANCE.bulletSpeed.late;
}

/** Player damage at a given power level (1-4) */
export function getPlayerDamage(powerLevel: number): number {
  return BALANCE.player.damage.base + powerLevel * BALANCE.player.damage.perLevel;
}

/** Get power level from raw power value */
export function getPowerLevel(power: number): 1 | 2 | 3 | 4 {
  const [t2, t3, t4] = BALANCE.player.powerThresholds;
  if (power < t2) return 1;
  if (power < t3) return 2;
  if (power < t4) return 3;
  return 4;
}
