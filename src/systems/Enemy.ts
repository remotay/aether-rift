import Phaser from 'phaser';
import { W, H, DEPTH } from '../constants';
import type { LaserFireFn } from './Laser';

export type { LaserFireFn };

export type EnemyFireFn = (ex: number, ey: number, angle: number, pattern: EnemyPattern) => void;

/** Monotonic ID counter for unique enemy laser ownership. */
let nextEnemyId = 0;

export type EnemyPattern =
  | 'aimed'       // single aimed shot
  | 'aimed3'      // 3-shot tight fan
  | 'aimed5'      // 5-shot wide fan
  | 'spread5'     // 5 fixed spread
  | 'burst_wide'  // 6-shot 180° front arc
  | 'ring8'       // 8-shot ring
  | 'ring12'      // 12-shot dense ring
  | 'laser2'      // 2 slow heavy bullets
  | 'aimed_back'  // 3 shots away from player
  | 'volley'      // 3 quick single shots in sequence
  | 'laser_aimed' // single laser aimed at player
  | 'laser_sweep' // laser that sweeps 45 degrees
  | 'laser_cross' // two perpendicular lasers
  | 'laser_fan'   // three lasers in 60-degree spread
  | 'burst3'      // 3-round rapid burst
  | 'split'       // forward-then-split
  | 'spiral3'     // 3-shot spinning spiral
  | 'spray16'     // massive 16-bullet fan spray
  | 'helix'       // oscillating double-stream
  | 'scatter'     // tight random cluster burst
  | 'none';

export interface EnemyDef {
  type:      'fairy' | 'soul' | 'wisp' | 'phantom' | 'knight' | 'bat' | 'drone' | 'gunner' | 'bloom' | 'prism' | 'seraph' | 'shade' | 'comet';
  x:         number;
  y:         number;
  targetX:   number;
  targetY:   number;
  hp:        number;
  speed:     number;
  hoverDur:  number;
  pattern:   EnemyPattern;
  shootInt:  number;
  score:     number;
  tint?:     number;
  alpha?:    number;
  behavior?: 'hover' | 'sweep' | 'strafe';
  delay?:    number;   // stagger spawn within a wave (seconds)
}

// ═════════════════════════════════════════════════════════════════════════════
// Per-type texture keys, scales, and animation configs
// ═════════════════════════════════════════════════════════════════════════════

interface EnemyTypeConfig {
  bodyKey: string;
  animKey: string;
  animBehind: boolean;   // animated layer behind body?
  scale: number;
  anim: {
    ampX: number;       // local-space X drift
    ampY: number;       // local-space Y drift
    ampRot: number;     // degrees of rotation
    freqX: number;
    freqY: number;
    freqRot: number;
    phase: number;
  };
}

const TWO_PI = Math.PI * 2;

const ENEMY_CONFIG: Record<EnemyDef['type'], EnemyTypeConfig> = {
  fairy: {
    bodyKey: 'enemy-fairy-body', animKey: 'enemy-fairy-wings', animBehind: true,
    scale: 0.06,
    anim: { ampX: 4, ampY: 6, ampRot: 5, freqX: 3.0, freqY: 4.0, freqRot: 3.5, phase: 0 },
  },
  soul: {
    bodyKey: 'enemy-soul-body', animKey: 'enemy-soul-wisps', animBehind: true,
    scale: 0.08,
    anim: { ampX: 15, ampY: 8, ampRot: 3, freqX: 0.7, freqY: 0.5, freqRot: 0.6, phase: 0.3 },
  },
  wisp: {
    bodyKey: 'enemy-wisp-body', animKey: 'enemy-wisp-tail', animBehind: true,
    scale: 0.06,
    anim: { ampX: 12, ampY: 8, ampRot: 6, freqX: 1.2, freqY: 0.9, freqRot: 1.0, phase: 0.5 },
  },
  phantom: {
    bodyKey: 'enemy-phantom-body', animKey: 'enemy-phantom-cape', animBehind: true,
    scale: 0.08,
    anim: { ampX: 18, ampY: 10, ampRot: 4, freqX: 0.6, freqY: 0.45, freqRot: 0.5, phase: 0.7 },
  },
  knight: {
    bodyKey: 'enemy-knight-body', animKey: 'enemy-knight-cape', animBehind: true,
    scale: 0.07,
    anim: { ampX: 10, ampY: 6, ampRot: 5, freqX: 0.8, freqY: 0.7, freqRot: 0.9, phase: 0.2 },
  },
  bat: {
    bodyKey: 'enemy-bat-body', animKey: 'enemy-bat-wings', animBehind: true,
    scale: 0.045,
    anim: { ampX: 3, ampY: 5, ampRot: 8, freqX: 4.0, freqY: 5.0, freqRot: 4.5, phase: 0 },
  },
  drone: {
    bodyKey: 'enemy-drone-body', animKey: 'enemy-drone-rotor', animBehind: true,
    scale: 0.05,
    anim: { ampX: 2, ampY: 2, ampRot: 360, freqX: 0.5, freqY: 0.5, freqRot: 3.0, phase: 0 },
  },
  gunner: {
    bodyKey: 'enemy-gunner-body', animKey: 'enemy-gunner-wings', animBehind: true,
    scale: 0.06,
    anim: { ampX: 3, ampY: 5, ampRot: 4, freqX: 3.5, freqY: 4.5, freqRot: 3.0, phase: 0.2 },
  },
  bloom: {
    bodyKey: 'enemy-bloom-body', animKey: 'enemy-bloom-petals', animBehind: true,
    scale: 0.07,
    anim: { ampX: 8, ampY: 10, ampRot: 6, freqX: 1.0, freqY: 0.8, freqRot: 0.5, phase: 0.4 },
  },
  prism: {
    bodyKey: 'enemy-prism-body', animKey: 'enemy-prism-crystal', animBehind: false,
    scale: 0.06,
    anim: { ampX: 5, ampY: 4, ampRot: 360, freqX: 1.5, freqY: 1.2, freqRot: 1.8, phase: 0.6 },
  },
  seraph: {
    bodyKey: 'enemy-seraph-body', animKey: 'enemy-seraph-wings', animBehind: true,
    scale: 0.08,
    anim: { ampX: 6, ampY: 10, ampRot: 4, freqX: 0.8, freqY: 0.6, freqRot: 0.7, phase: 0.3 },
  },
  shade: {
    bodyKey: 'enemy-shade-body', animKey: 'enemy-shade-aura', animBehind: true,
    scale: 0.06,
    anim: { ampX: 14, ampY: 8, ampRot: 5, freqX: 1.0, freqY: 0.8, freqRot: 0.9, phase: 0.5 },
  },
  comet: {
    bodyKey: 'enemy-comet-body', animKey: 'enemy-comet-tail', animBehind: true,
    scale: 0.055,
    anim: { ampX: 4, ampY: 6, ampRot: 6, freqX: 3.0, freqY: 3.5, freqRot: 2.5, phase: 0.1 },
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// ENEMY CLASS — 2-layer animated container (body + animated element)
// ═════════════════════════════════════════════════════════════════════════════

export class Enemy {
  // Container replaces the old single sprite
  private container: Phaser.GameObjects.Container;
  private bodyLayer: Phaser.GameObjects.Image;
  private animLayer: Phaser.GameObjects.Image;
  private allLayers: Phaser.GameObjects.Image[];

  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive = true;
  readonly score: number;

  /** Unique ID used to track laser ownership so we can cancel on death. */
  readonly laserOwnerId: string;

  readonly hW: number;
  readonly hH: number;

  private phase: 'delay' | 'enter' | 'hover' | 'exit' = 'enter';
  private hoverTimer: number;
  private shootTimer: number;
  private readonly def: EnemyDef;
  private readonly scene: Phaser.Scene;
  private flashTimer = 0;
  private readonly behavior: 'hover' | 'sweep' | 'strafe';
  private readonly config: EnemyTypeConfig;
  private strafeDir: number = 0;

  // Animation time
  private animTime = 0;

  // Smooth curved entry
  private enterT = 0;
  private readonly enterDur: number;
  private readonly startX: number;
  private readonly startY: number;
  private readonly ctrlX: number;
  private readonly ctrlY: number;

  // Per-enemy random seeds for organic hover
  private readonly phaseOff: number;
  private readonly hoverAmpX: number;
  private readonly hoverAmpY: number;

  // Spawn delay
  private delayTimer: number;

  constructor(scene: Phaser.Scene, def: EnemyDef) {
    this.scene      = scene;
    this.def        = def;
    this.startX     = def.x;
    this.startY     = def.y;
    this.x          = def.x;
    this.y          = def.y;
    this.hp         = def.hp;
    this.maxHp      = def.hp;
    this.score      = def.score;
    this.laserOwnerId = `enemy_${nextEnemyId++}`;
    this.hoverTimer = def.hoverDur;
    this.behavior   = def.behavior ?? 'hover';
    this.config     = ENEMY_CONFIG[def.type];

    this.shootTimer = def.shootInt * 0.15;

    this.delayTimer = def.delay ?? 0;
    if (this.delayTimer > 0) this.phase = 'delay';

    this.phaseOff  = Math.random() * Math.PI * 2;
    this.hoverAmpX = 40 + Math.random() * 60;
    this.hoverAmpY = 20 + Math.random() * 35;

    const dx   = def.targetX - def.x;
    const dy   = def.targetY - def.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.enterDur = dist / Math.max(def.speed, 100);

    const perpX = -dy / dist;
    const perpY =  dx / dist;
    const curveMag = 80 + Math.random() * 120;
    const curveDir = Math.random() > 0.5 ? 1 : -1;
    const midX = (def.x + def.targetX) / 2;
    const midY = (def.y + def.targetY) / 2;
    this.ctrlX = midX + perpX * curveMag * curveDir;
    this.ctrlY = midY + perpY * curveMag * curveDir;

    const hbMap: Record<EnemyDef['type'], [number, number]> = {
      fairy:   [36, 36],
      soul:    [64, 64],
      wisp:    [28, 28],
      phantom: [44, 44],
      knight:  [38, 38],
      bat:     [24, 24],
      drone:   [30, 30],
      gunner:  [32, 32],
      bloom:   [40, 40],
      prism:   [34, 34],
      seraph:  [48, 48],
      shade:   [30, 30],
      comet:   [26, 26],
    };
    [this.hW, this.hH] = hbMap[def.type];

    const cfg = this.config;

    // ── Build 2-layer container ──────────────────────────────────────
    this.container = scene.add.container(def.x, def.y).setDepth(DEPTH.ENEMY);

    this.bodyLayer = scene.add.image(0, 0, cfg.bodyKey);
    this.animLayer = scene.add.image(0, 0, cfg.animKey);

    if (cfg.animBehind) {
      this.container.add([this.animLayer, this.bodyLayer]);
    } else {
      this.container.add([this.bodyLayer, this.animLayer]);
    }
    this.allLayers = [this.bodyLayer, this.animLayer];

    this.container.setScale(0);  // starts at 0 for pop-in

    if (def.tint  !== undefined) for (const l of this.allLayers) l.setTint(def.tint);
    if (def.alpha !== undefined) this.container.setAlpha(def.alpha);

    // Spawn pop-in tween
    scene.tweens.add({
      targets:  this.container,
      scaleX:   cfg.scale,
      scaleY:   cfg.scale,
      duration: 250,
      ease:     'Back.easeOut',
      delay:    (def.delay ?? 0) * 1000,
    });

    if (this.delayTimer > 0) this.container.setVisible(false);
  }

  // Quadratic bezier helper
  private bezier(t: number): [number, number] {
    const u = 1 - t;
    const bx = u * u * this.startX + 2 * u * t * this.ctrlX + t * t * this.def.targetX;
    const by = u * u * this.startY + 2 * u * t * this.ctrlY + t * t * this.def.targetY;
    return [bx, by];
  }

  update(dt: number, playerX: number, playerY: number, fireFn: EnemyFireFn, laserFn?: LaserFireFn): void {
    if (!this.alive) return;

    this.animTime += dt;

    // Flash timer (damage feedback)
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        if (this.def.tint !== undefined) {
          for (const l of this.allLayers) l.setTint(this.def.tint);
        } else {
          for (const l of this.allLayers) l.clearTint();
        }
      }
    }

    const now = this.scene.time.now;

    // ── Delay phase ─────────────────────────────────────────────────
    if (this.phase === 'delay') {
      this.delayTimer -= dt;
      if (this.delayTimer <= 0) {
        this.phase = 'enter';
        this.container.setVisible(true);
      } else {
        return;
      }
    }

    // ── Sweep behaviour (bats) ──────────────────────────────────────
    if (this.behavior === 'sweep') {
      const dx = this.def.targetX - this.startX;
      const dy = this.def.targetY - this.startY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      this.x += (dx / d) * this.def.speed * dt;
      this.y += (dy / d) * this.def.speed * dt;
      this.y += Math.sin(now * 0.006 + this.phaseOff) * 1.5;

      this.container.angle = Phaser.Math.Linear(this.container.angle, (dy / d) * 18, 0.08);

      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = this.def.shootInt;
        this.firePattern(playerX, playerY, fireFn, laserFn);
      }

      if (this.x < -200 || this.x > W + 200 || this.y < -200 || this.y > H + 200) {
        this.alive = false;
      }

    // ── Enter phase ─────────────────────────────────────────────────
    } else if (this.phase === 'enter') {
      this.enterT += dt / this.enterDur;

      if (this.enterT >= 1) {
        this.enterT = 1;
        this.x = this.def.targetX;
        this.y = this.def.targetY;
        this.phase = 'hover';
      } else {
        const eased = 1 - Math.pow(1 - this.enterT, 2.5);
        [this.x, this.y] = this.bezier(eased);
      }

      if (this.enterT > 0.5) {
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
          this.shootTimer = this.def.shootInt;
          this.firePattern(playerX, playerY, fireFn, laserFn);
        }
      }

      if (this.enterT < 0.95) {
        const nextT = Math.min(this.enterT + 0.02, 1);
        const easedN = 1 - Math.pow(1 - nextT, 2.5);
        const [nx, ny] = this.bezier(easedN);
        const tiltAngle = Math.atan2(ny - this.y, nx - this.x) * (180 / Math.PI);
        this.container.angle = Phaser.Math.Linear(this.container.angle, tiltAngle * 0.3, 0.12);
      } else {
        this.container.angle = Phaser.Math.Linear(this.container.angle, 0, 0.15);
      }

    // ── Hover phase ─────────────────────────────────────────────────
    } else if (this.phase === 'hover') {
      const hT = now * 0.001;

      if (this.def.type === 'wisp') {
        this.x = this.def.targetX + Math.sin(hT * 1.8 + this.phaseOff) * this.hoverAmpX * 1.5;
        this.y = this.def.targetY + Math.sin(hT * 2.6 + this.phaseOff) * 90;
      } else if (this.def.type === 'phantom') {
        this.x -= 0.35 * dt * 60;
        this.y = this.def.targetY + Math.sin(hT * 0.8 + this.phaseOff) * 50;
        const ghostAlpha = 0.55 + Math.sin(hT * 2 + this.phaseOff) * 0.2;
        this.container.setAlpha(ghostAlpha);
      } else if (this.def.type === 'knight') {
        this.x = this.def.targetX + Math.sin(hT * 0.7 + this.phaseOff) * this.hoverAmpX * 0.6;
        this.y = this.def.targetY + Math.sin(hT * 1.4 + this.phaseOff) * 15;
      } else if (this.def.type === 'soul') {
        this.x = this.def.targetX + Math.sin(hT * 1.0 + this.phaseOff) * 55;
        this.y = this.def.targetY + Math.cos(hT * 1.3 + this.phaseOff) * 40;
      } else {
        this.x = this.def.targetX + Math.sin(hT * 2.0 + this.phaseOff) * this.hoverAmpX * 0.4;
        this.y = this.def.targetY + Math.sin(hT * 2.8 + this.phaseOff * 1.3) * this.hoverAmpY;
      }

      // Strafe: slide vertically within bounds
      if (this.def.behavior === 'strafe') {
        if (!this.strafeDir) this.strafeDir = Math.random() > 0.5 ? 1 : -1;
        this.y += this.strafeDir * 120 * dt;
        if (this.y < 120 || this.y > H - 120) this.strafeDir *= -1;
      }

      const tiltX = this.x - this.def.targetX;
      this.container.angle = Phaser.Math.Linear(this.container.angle, tiltX * 0.08, 0.06);

      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = this.def.shootInt;
        this.firePattern(playerX, playerY, fireFn, laserFn);
      }

      this.hoverTimer -= dt;
      if (this.hoverTimer <= 0) {
        this.phase = 'exit';
      }

    // ── Exit phase ──────────────────────────────────────────────────
    } else {
      const exitDir = this.def.targetY < H / 2 ? -1 : 1;
      this.x -= 320 * dt;
      this.y += exitDir * 100 * dt;
      this.container.setAlpha(Math.max(0, this.container.alpha - dt * 0.8));
      this.container.angle = Phaser.Math.Linear(this.container.angle, exitDir * -20, 0.04);

      if (this.x < -200 || this.container.alpha <= 0) this.alive = false;
    }

    this.container.setPosition(this.x, this.y);

    // ── Animate the secondary layer ─────────────────────────────────
    this.applyAnim();
  }

  /** Route pattern to either bullet fireFn or laser laserFn. */
  private firePattern(
    px: number, py: number,
    fireFn: EnemyFireFn, laserFn: LaserFireFn | undefined,
  ): void {
    const ex = this.x;
    const ey = this.y;
    const pattern = this.def.pattern;
    const angle = Math.atan2(py - ey, px - ex);

    const oid = { ownerId: this.laserOwnerId };

    switch (pattern) {
      case 'laser_aimed': {
        // Single laser aimed at player
        laserFn?.(ex, ey, angle, 10, 1.0, 1.6, 0x00ccaa, oid);
        break;
      }
      case 'laser_sweep': {
        // Single rotating laser — sweeps 45° during active phase
        // rotSpeed: 0.4 rad over 2.0s active = 0.2 rad/s
        laserFn?.(ex, ey, angle - 0.2, 10, 0.8, 2.0, 0x00ccaa,
          { ownerId: this.laserOwnerId, rotSpeed: 0.2 });
        break;
      }
      case 'laser_cross': {
        // Two perpendicular lasers
        laserFn?.(ex, ey, angle, 10, 1.0, 1.6, 0x00ccaa, oid);
        laserFn?.(ex, ey, angle + Math.PI / 2, 10, 1.0, 1.6, 0x00ccaa, oid);
        break;
      }
      case 'laser_fan': {
        // Three lasers in 60-degree spread
        laserFn?.(ex, ey, angle - 0.52, 8, 0.8, 1.5, 0x00ccaa, oid);
        laserFn?.(ex, ey, angle, 8, 0.8, 1.5, 0x00ccaa, oid);
        laserFn?.(ex, ey, angle + 0.52, 8, 0.8, 1.5, 0x00ccaa, oid);
        break;
      }
      default:
        // Normal bullet pattern — delegate to GameScene
        fireFn(ex, ey, angle, pattern);
        break;
    }
  }

  private applyAnim(): void {
    const a = this.config.anim;
    const t = this.animTime + this.phaseOff;
    this.animLayer.x = Math.sin(t * a.freqX * TWO_PI + a.phase) * a.ampX;
    this.animLayer.y = Math.sin(t * a.freqY * TWO_PI) * a.ampY;
    this.animLayer.angle = Math.sin(t * a.freqRot * TWO_PI + a.phase) * a.ampRot;
  }

  hit(dmg: number, onDie: (e: Enemy) => void): void {
    if (!this.alive) return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.alive = false;
      onDie(this);

      for (const l of this.allLayers) l.setTint(0xffffff);
      this.scene.tweens.add({
        targets:  this.container,
        scaleX:   this.container.scaleX * 1.6,
        scaleY:   this.container.scaleY * 1.6,
        alpha:    0,
        duration: 120,
        ease:     'Power2',
        onComplete: () => { if (this.container.active) this.container.destroy(); },
      });
    } else {
      for (const l of this.allLayers) l.setTint(0xffffff);
      this.flashTimer = 0.06;
    }
  }

  destroy(): void {
    if (this.container.active) this.container.destroy();
  }
}

export class EnemyManager {
  private enemies: Enemy[] = [];
  private readonly scene: Phaser.Scene;
  private readonly fireFn: EnemyFireFn;

  /** Optional laser-fire callback — set by GameScene when a laser pool is available. */
  laserFn?: LaserFireFn;

  constructor(scene: Phaser.Scene, fireFn: EnemyFireFn) {
    this.scene   = scene;
    this.fireFn  = fireFn;
  }

  spawn(def: EnemyDef): Enemy {
    const e = new Enemy(this.scene, def);
    this.enemies.push(e);
    return e;
  }

  spawnWave(defs: EnemyDef[]): void {
    defs.forEach(d => this.spawn(d));
  }

  update(dt: number, playerX: number, playerY: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) { this.enemies.splice(i, 1); continue; }
      e.update(dt, playerX, playerY, this.fireFn, this.laserFn);
    }
  }

  getActive(): Enemy[] { return this.enemies; }
  count():     number  { return this.enemies.length; }

  clearAll(): void {
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
  }
}
