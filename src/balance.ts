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
      base:     2.6,            // gives 5.2/7.8/10.4/13.0
      perLevel: 2.6,            // DPS at pwr2: 78, pwr3: 104, pwr4: 130
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
    /** Total stage pre-miniboss duration target: ~90 seconds of waves */
    totalWaves:    18,

    /** Breathing room between sections (seconds) — larger gaps at act breaks */
    breathingRoom: 4,

    /** Miniboss triggers when all waves spawned AND enemies cleared */
    /** Structure: Tutorial(1-3) → Introduction(4-7) → Combination(8-12) → Crescendo(13-18) */
  },

  // ─── Miniboss ────────────────────────────────────────────────────────────
  miniboss: {
    hp:            2400,        // up from 1540 — prevent melting, ~30-40s fight
    attackTimer:   2.0,         // initial delay before first attack (dramatic entrance)
    score:         3000,

    /** Bullet speed multiplier for miniboss attacks */
    bulletSpeedMult: 0.85,      // relative to base

    /** Phase 2 triggers at this HP fraction — faster attacks, denser patterns */
    phase2at:      0.45,
    phase2speedMult: 1.18,      // 18% faster bullets in phase 2
  },

  // ─── Boss ────────────────────────────────────────────────────────────────
  boss: {
    totalHp:       7800,        // up from 5600 — phases should feel distinct

    /** Phase thresholds as fraction of maxHp remaining */
    phase2at:      0.65,        // enter phase 2 at 65% → 2730 HP in P1
    phase3at:      0.30,        // enter phase 3 at 30% → 2730 HP in P2, 2340 HP in P3

    /** Per-phase bullet speeds */
    phase1speed:   320,         // slow and readable — teach phase
    phase2speed:   380,         // moderate
    phase3speed:   440,         // intense — noticeable speed jump

    /** Telegraph durations per phase */
    phase1telegraph: 0.85,      // generous — teach patterns
    phase2telegraph: 0.5,       // moderate
    phase3telegraph: 0.30,      // intense — snap reactions

    /** Pause between attacks per phase */
    phase1pause:   1.8,         // long breathing room
    phase2pause:   1.0,         // tighter
    phase3pause:   0.50,        // relentless

    /** Idle time between attack cycles per phase */
    phase1idle:    0.7,         // relaxed
    phase2idle:    0.25,        // brisk
    phase3idle:    0.10,        // no rest

    /** Phase transition grace period */
    phaseTransitionPause: 3.0,  // dramatic pause on transition

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
    powerDropRate:   0.385,     // +10% from 0.35
    /** Number of power gems from miniboss kill */
    minibossDrops:   6,
    /** Number of power gems from boss kill */
    bossDrops:       8,
  },

  // ─── Stage 2: Clockwork Abyss ──────────────────────────────────────────
  stage2: {
    enemies: {
      drone: {
        hp:       12,
        speed:    350,
        hoverDur: 5,
        score:    120,
      },
    },

    bulletSpeed: {
      early:  280,
      mid:    360,
      late:   430,
      base:   360,
    },

    miniboss: {
      hp:              3200,
      attackTimer:     2.0,
      score:           4000,
      bulletSpeedMult: 0.90,
      phase2at:        0.40,
      phase2speedMult: 1.20,
    },

    boss: {
      totalHp:              9600,
      phase2at:             0.65,
      phase3at:             0.28,
      phase1speed:          340,
      phase2speed:          400,
      phase3speed:          460,
      phase1telegraph:      0.90,
      phase2telegraph:      0.55,
      phase3telegraph:      0.38,
      phase1pause:          1.6,
      phase2pause:          1.0,
      phase3pause:          0.55,
      phase1idle:           0.6,
      phase2idle:           0.25,
      phase3idle:           0.12,
      phaseTransitionPause: 3.0,
      score:                25000,
      homeX:                1500,
      homeY:                540,
    },

    laser: {
      thinWidth:       12,
      wideWidth:       28,
      telegraphAlpha:  0.4,
      activeAlpha:     0.95,
      defaultTelegraph: 1.0,
      defaultActive:    2.0,
      fadeoutDur:       0.3,
      maxSimultaneous:  8,
    },
  },

} as const;

// ─── Derived helpers ──────────────────────────────────────────────────────

/** Get bullet speed for a given wave number (1-indexed) */
export function getWaveBulletSpeed(waveNum: number, stage = 1): number {
  const speeds = stage === 2 ? BALANCE.stage2.bulletSpeed : BALANCE.bulletSpeed;
  if (waveNum <= 3)  return speeds.early;
  if (waveNum <= 8)  return speeds.mid;
  return speeds.late;
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
