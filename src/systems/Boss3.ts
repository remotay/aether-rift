import Phaser from 'phaser';
import { W, H, DEPTH } from '../constants';
import { BALANCE } from '../balance';
import { BossFireFn } from './Boss';
import type { LaserFireFn } from './Laser';

export type { LaserFireFn };

const B3  = BALANCE.stage3.boss;
const MB3 = BALANCE.stage3.miniboss;
const TWO_PI = Math.PI * 2;

// ─── VFX helpers ─────────────────────────────────────────────────────────────

function shockwave(scene: Phaser.Scene, x: number, y: number, color = 0xff66cc, maxR = 260): void {
  const ring = scene.add.graphics().setDepth(DEPTH.FX);
  const tween = { progress: 0 };
  scene.tweens.add({
    targets: tween,
    progress: 1,
    duration: 420,
    ease: 'Sine.easeOut',
    onUpdate: () => {
      ring.clear();
      const r = maxR * tween.progress;
      const alpha = 1 - tween.progress;
      const lw = Phaser.Math.Linear(6, 1, tween.progress);
      ring.lineStyle(lw, color, alpha);
      ring.strokeCircle(x, y, r);
    },
    onComplete: () => ring.destroy(),
  });
}

function pulsingRing(scene: Phaser.Scene, getX: () => number, getY: () => number, color = 0xff99dd): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics().setDepth(DEPTH.FX);
  const state = { scale: 1, alpha: 0.7 };
  scene.tweens.add({
    targets: state,
    scale: 1.35,
    alpha: 0.15,
    duration: 320,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  const cb = () => {
    if (!gfx.active) return;
    gfx.clear();
    const r = 140 * state.scale;
    gfx.lineStyle(3, color, state.alpha);
    gfx.strokeCircle(getX(), getY(), r);
  };
  scene.events.on('update', cb);
  gfx.once('destroy', () => scene.events.off('update', cb));
  return gfx;
}

// ─── Attack helpers ──────────────────────────────────────────────────────────

function ringB(entity: { x: number; y: number }, fire: BossFireFn, count: number, speed: number, offset = 0, sc = 1, tint = 0xff66cc): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TWO_PI + offset;
    fire(entity.x, entity.y, Math.cos(a) * speed, Math.sin(a) * speed, sc, tint);
  }
}

function aimFanB(entity: { x: number; y: number }, fire: BossFireFn, px: number, py: number, count: number, spread: number, speed: number, tint = 0x88ccff): void {
  const base = Math.atan2(py - entity.y, px - entity.x);
  const step = count > 1 ? spread / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const a = base - spread / 2 + step * i;
    fire(entity.x, entity.y, Math.cos(a) * speed, Math.sin(a) * speed, 1, tint);
  }
}

// ─── Boss3 attack types ──────────────────────────────────────────────────────
type Boss3Phase = 1 | 2 | 3;
type AttackState = 'idle' | 'telegraph' | 'firing' | 'pause';

interface Attack3 {
  name:      string;
  telegraph: number;
  execute:   (b: Boss3, fire: BossFireFn, laserFire: LaserFireFn, px: number, py: number) => void;
  pause:     number;
}

// ─── Phase 1 attacks: "Awakening" ────────────────────────────────────────────
const P1 = B3.phase1speed;

const BOSS3_PHASE1: Attack3[] = [
  {
    name: 'Petal Rings',
    telegraph: B3.phase1telegraph,
    execute(b, fire) {
      // Two concentric rings: 14 outer rose pink, 10 inner crystal blue, offset half-step
      ringB(b, fire, 14, P1 * 1.0, 0, 1, 0xff66cc);
      ringB(b, fire, 10, P1 * 0.7, Math.PI / 10, 0.9, 0x88ccff);
    },
    pause: B3.phase1pause,
  },
  {
    name: 'Vine Stream',
    telegraph: B3.phase1telegraph,
    execute(b, fire, _lf, px, py) {
      // Aimed fan of 5, 3 volleys at 400ms
      let volley = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 5, Math.PI / 4, P1 * 0.9, 0x88ccff);
        volley++;
        if (volley < 3) b.scene.time.delayedCall(400, shoot);
      };
      shoot();
    },
    pause: B3.phase1pause,
  },
  {
    name: 'Thorn Barrage',
    telegraph: B3.phase1telegraph,
    execute(b, fire) {
      // Curtain of 5 columns moving left
      let rows = 0;
      const shoot = () => {
        if (!b.alive) return;
        for (let col = 0; col < 5; col++) {
          const oy = -160 + col * 80;
          fire(b.x, b.y + oy, -P1 * 0.95, 0, 1, 0xff66cc);
        }
        rows++;
        if (rows < 6) b.scene.time.delayedCall(180, shoot);
      };
      shoot();
    },
    pause: B3.phase1pause,
  },
  {
    name: 'Tracer Laser',
    telegraph: B3.phase1telegraph,
    execute(b, _fire, laserFire, px, py) {
      // Single aimed laser -- first laser in the fight
      const angle = Math.atan2(py - b.y, px - b.x);
      laserFire(b.x, b.y, angle, 12, 1.2, 2.0, 0xff66cc);
    },
    pause: B3.phase1pause + 0.3,
  },
  {
    name: '"Garden Waltz"',
    telegraph: B3.phase1telegraph + 0.2,
    execute(b, fire, laserFire, px, py) {
      // Spell card: single rotating laser sweeps 180° over 3s + ring bursts
      const startAngle = Math.PI * 0.5;
      const sweepRange = Math.PI;
      const sweepDur   = 3.0;
      const rotSpeed   = -sweepRange / sweepDur;

      laserFire(b.x, b.y, startAngle, 18, 0.6, sweepDur, 0xff66cc,
        { ownerId: 'boss3', rotSpeed });

      // Ring bursts during sweep
      let ringStep = 0;
      const ringShoot = () => {
        if (!b.alive) return;
        ringB(b, fire, 10, P1 * 0.8, ringStep * 0.3, 1, 0x88ccff);
        ringStep++;
        if (ringStep < 6) b.scene.time.delayedCall(500, ringShoot);
      };
      b.scene.time.delayedCall(800, ringShoot);

      // Aimed volleys
      let aimStep = 0;
      const aimShoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 3, Math.PI / 5, P1 * 0.85, 0x88ccff);
        aimStep++;
        if (aimStep < 4) b.scene.time.delayedCall(600, aimShoot);
      };
      b.scene.time.delayedCall(1000, aimShoot);
    },
    pause: B3.phase1pause + 0.5,
  },
];

// ─── Phase 2 attacks: "Corruption" ───────────────────────────────────────────
const P2 = B3.phase2speed;

const BOSS3_PHASE2: Attack3[] = [
  {
    name: 'Double Ring',
    telegraph: B3.phase2telegraph,
    execute(b, fire) {
      ringB(b, fire, 22, P2 * 1.0, 0, 1.1, 0xff66cc);
      ringB(b, fire, 22, P2 * 1.0, Math.PI / 22, 1.1, 0x88ccff);
    },
    pause: B3.phase2pause,
  },
  {
    name: 'Cross Laser',
    telegraph: B3.phase2telegraph,
    execute(b, _fire, laserFire, px, py) {
      // Two lasers at 90-degree angles, player-aimed
      const base = Math.atan2(py - b.y, px - b.x);
      laserFire(b.x, b.y, base + Math.PI / 4, 16, 0.8, 2.5, 0xff66cc);
      laserFire(b.x, b.y, base - Math.PI / 4, 16, 0.8, 2.5, 0x88ccff);
    },
    pause: B3.phase2pause + 0.2,
  },
  {
    name: 'Rapid Fan',
    telegraph: B3.phase2telegraph,
    execute(b, fire, _lf, px, py) {
      // Aimed 9-shot fan, 5 volleys at 280ms
      let volley = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 9, Math.PI / 3, P2 * 0.95, 0x88ccff);
        volley++;
        if (volley < 5) b.scene.time.delayedCall(280, shoot);
      };
      shoot();
    },
    pause: B3.phase2pause,
  },
  {
    name: 'Spiral Thorns',
    telegraph: B3.phase2telegraph,
    execute(b, fire) {
      // Twin counter-rotating spirals, 30 shots each
      let t = 0;
      const shoot = () => {
        if (!b.alive) return;
        const a = t * 0.42;
        fire(b.x, b.y, Math.cos(a) * P2 * 1.0, Math.sin(a) * P2 * 1.0, 1, 0xff66cc);
        fire(b.x, b.y, Math.cos(-a + Math.PI) * P2 * 1.0, Math.sin(-a + Math.PI) * P2 * 1.0, 1, 0x88ccff);
        t++;
        if (t < 30) b.scene.time.delayedCall(55, shoot);
      };
      shoot();
    },
    pause: B3.phase2pause,
  },
  {
    name: '"Withered Rose"',
    telegraph: B3.phase2telegraph + 0.15,
    execute(b, fire, laserFire, px, py) {
      // Spell card: single rotating laser 180° sweep + ring10 + aimed5
      const startAngle = Math.PI * 0.5;
      const sweepRange = Math.PI;
      const sweepDur   = 3.0;
      const rotSpeed   = -sweepRange / sweepDur;

      laserFire(b.x, b.y, startAngle, 20, 0.5, sweepDur, 0xff66cc,
        { ownerId: 'boss3', rotSpeed });

      // Ring10 bursts during sweep
      let ringStep = 0;
      const ringShoot = () => {
        if (!b.alive) return;
        ringB(b, fire, 10, P2 * 0.8, ringStep * 0.3, 1, 0x88ccff);
        ringStep++;
        if (ringStep < 6) b.scene.time.delayedCall(500, ringShoot);
      };
      b.scene.time.delayedCall(700, ringShoot);

      // Aimed5 during sweep
      let aimStep = 0;
      const aimShoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 5, Math.PI / 4, P2 * 1.0, 0x88ccff);
        aimStep++;
        if (aimStep < 5) b.scene.time.delayedCall(500, aimShoot);
      };
      b.scene.time.delayedCall(800, aimShoot);
    },
    pause: B3.phase2pause + 0.4,
  },
];

// ─── Phase 3 attacks: "Shattered Bloom" ──────────────────────────────────────
const P3 = B3.phase3speed;

const BOSS3_PHASE3: Attack3[] = [
  {
    name: 'Annihilation Ring',
    telegraph: B3.phase3telegraph,
    execute(b, fire, _lf, px, py) {
      // 30-ring + aimed 8-fan overlay
      ringB(b, fire, 30, P3 * 1.0, 0, 1.2, 0xff66cc);
      aimFanB(b, fire, px, py, 8, Math.PI / 2, P3 * 1.1, 0x88ccff);
    },
    pause: B3.phase3pause,
  },
  {
    name: 'Triple Laser',
    telegraph: B3.phase3telegraph,
    execute(b, _fire, laserFire, px, py) {
      // Three lasers in 120-deg spread, player-aimed center
      const base = Math.atan2(py - b.y, px - b.x);
      const spread = (2 * Math.PI) / 3;
      laserFire(b.x, b.y, base, 16, 0.7, 2.0, 0xff66cc);
      laserFire(b.x, b.y, base + spread * 0.25, 14, 0.7, 2.0, 0x88ccff);
      laserFire(b.x, b.y, base - spread * 0.25, 14, 0.7, 2.0, 0x88ccff);
    },
    pause: B3.phase3pause + 0.15,
  },
  {
    name: 'Cascade Storm',
    telegraph: B3.phase3telegraph,
    execute(b, fire, _lf, px, py) {
      // Aimed9 + ring10 + spiral, 6 steps at 240ms
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 9, Math.PI / 2.5, P3 * 1.05, 0x88ccff);
        ringB(b, fire, 10, P3 * 0.8, step * 0.25, 0.9, 0xff66cc);
        const a = step * 0.55;
        fire(b.x, b.y, Math.cos(a) * P3 * 0.9, Math.sin(a) * P3 * 0.9, 1, 0xff66cc);
        fire(b.x, b.y, Math.cos(a + Math.PI) * P3 * 0.9, Math.sin(a + Math.PI) * P3 * 0.9, 1, 0xff66cc);
        step++;
        if (step < 6) b.scene.time.delayedCall(240, shoot);
      };
      shoot();
    },
    pause: B3.phase3pause,
  },
  {
    name: 'Convergence',
    telegraph: B3.phase3telegraph,
    execute(b, fire, _lf, px, py) {
      // Top/bottom curtains converging + aimed pairs
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        const yTop = 100 + step * 30;
        const yBot = H - 100 - step * 30;
        fire(b.x, yTop, -P3 * 0.9, P3 * 0.2, 1, 0xff66cc);
        fire(b.x, yBot, -P3 * 0.9, -P3 * 0.2, 1, 0xff66cc);
        fire(b.x - 40, yTop + 40, -P3 * 0.85, P3 * 0.15, 0.8, 0x88ccff);
        fire(b.x - 40, yBot - 40, -P3 * 0.85, -P3 * 0.15, 0.8, 0x88ccff);
        // Aimed pair every other step
        if (step % 2 === 0) {
          const base = Math.atan2(py - b.y, px - b.x);
          fire(b.x, b.y, Math.cos(base + 0.15) * P3 * 1.0, Math.sin(base + 0.15) * P3 * 1.0, 1, 0x88ccff);
          fire(b.x, b.y, Math.cos(base - 0.15) * P3 * 1.0, Math.sin(base - 0.15) * P3 * 1.0, 1, 0x88ccff);
        }
        step++;
        if (step < 14) b.scene.time.delayedCall(90, shoot);
      };
      shoot();
    },
    pause: B3.phase3pause,
  },
  {
    name: '"Eden\'s End"',
    telegraph: B3.phase3telegraph + 0.15,
    execute(b, fire, laserFire, px, py) {
      // Grand finale: single rotating laser full 360° over 4s
      const sweepDur = 4.0;
      const rotSpeed  = TWO_PI / sweepDur;

      laserFire(b.x, b.y, 0, 22, 0.5, sweepDur, 0xff44cc,
        { ownerId: 'boss3', rotSpeed });

      // Ring14 every 400ms
      let ringStep = 0;
      const ringShoot = () => {
        if (!b.alive) return;
        ringB(b, fire, 14, P3 * 0.85, ringStep * 0.22, 1.1, 0xff66cc);
        ringStep++;
        if (ringStep < 10) b.scene.time.delayedCall(400, ringShoot);
      };
      b.scene.time.delayedCall(700, ringShoot);

      // Aimed5 every 300ms
      let aimStep = 0;
      const aimShoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 5, Math.PI / 4, P3 * 1.1, 0x88ccff);
        aimStep++;
        if (aimStep < 12) b.scene.time.delayedCall(300, aimShoot);
      };
      b.scene.time.delayedCall(800, aimShoot);
    },
    pause: B3.phase3pause + 0.3,
  },
];

// =============================================================================
// Boss3: "Rosalia, the Shattered Bloom"
// 2-layer container: wings (behind) + body (center)
// =============================================================================
export class Boss3 {
  private container: Phaser.GameObjects.Container;
  private wingsLayer: Phaser.GameObjects.Image;
  private bodyLayer:  Phaser.GameObjects.Image;
  private allLayers:  Phaser.GameObjects.Image[];

  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive  = true;
  phase: Boss3Phase = 1;
  readonly hW = 85;
  readonly hH = 115;

  readonly scene: Phaser.Scene;
  private state: AttackState = 'idle';
  private stateTimer  = 1.5;
  private atkIndex    = 0;
  private attacks: Attack3[];
  private flashTimer  = 0;
  private animTime    = 0;
  private telegraphRing: Phaser.GameObjects.Graphics | null = null;
  private bossGlow!: Phaser.GameObjects.Graphics;

  private moveTimer  = 0;
  private targetX: number;
  private targetY: number;
  private readonly fireFn:      BossFireFn;
  private readonly laserFireFn: LaserFireFn;

  onPhaseChange?: (phase: Boss3Phase) => void;
  onDie?:          () => void;

  constructor(scene: Phaser.Scene, fire: BossFireFn, laserFire: LaserFireFn) {
    this.scene        = scene;
    this.fireFn       = fire;
    this.laserFireFn  = laserFire;
    this.x            = W + 300;
    this.y            = B3.homeY;
    this.hp           = B3.totalHp;
    this.maxHp        = B3.totalHp;
    this.attacks      = BOSS3_PHASE1;
    this.targetX      = B3.homeX;
    this.targetY      = B3.homeY;

    const targetScale = 0.20;

    // Build 2-layer container (wings -> body)
    this.container = scene.add.container(this.x, this.y).setDepth(DEPTH.ENEMY);

    this.wingsLayer = scene.add.image(0, 0, 'boss3-wings').setScale(1.8);
    this.bodyLayer  = scene.add.image(0, 0, 'boss3-body');

    this.allLayers = [this.wingsLayer, this.bodyLayer];
    this.container.add(this.allLayers);
    this.container.setScale(0);

    // Ambient glow aura (rose pink)
    this.bossGlow = scene.add.graphics().setDepth(DEPTH.ENEMY - 1);
    this.bossGlow.fillStyle(0xff66cc, 0.10);
    this.bossGlow.fillCircle(0, 0, 210);
    this.bossGlow.fillStyle(0xcc3399, 0.08);
    this.bossGlow.fillCircle(0, 0, 160);
    this.bossGlow.fillStyle(0xff99dd, 0.06);
    this.bossGlow.fillCircle(0, 0, 105);
    this.bossGlow.setPosition(B3.homeX, B3.homeY).setAlpha(0);
    scene.tweens.add({
      targets: this.bossGlow,
      alpha: 1,
      duration: 900,
      delay: 400,
      ease: 'Sine.easeOut',
    });
    scene.tweens.add({
      targets: this.bossGlow,
      alpha: { from: 0.75, to: 1.0 },
      scaleX: { from: 1.0, to: 1.12 },
      scaleY: { from: 1.0, to: 1.12 },
      duration: 1600,
      delay: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Dramatic entrance
    const overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5)
      .setDepth(DEPTH.OVERLAY);
    scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 900,
      ease: 'Power2',
      onComplete: () => overlay.destroy(),
    });

    scene.tweens.add({
      targets: this.container,
      x: B3.homeX,
      duration: 1200,
      ease: 'Power2.easeOut',
      onComplete: () => { this.x = B3.homeX; },
    });

    scene.tweens.add({
      targets: this.container,
      scaleX: -targetScale,
      scaleY: targetScale,
      duration: 800,
      ease: 'Back.easeOut',
    });

    scene.time.delayedCall(750, () => {
      const flash = scene.add.circle(B3.homeX, B3.homeY, 200, 0xffffff, 0.85)
        .setDepth(DEPTH.FX)
        .setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: flash,
        alpha: 0,
        scaleX: 3,
        scaleY: 3,
        duration: 350,
        ease: 'Power2',
        onComplete: () => flash.destroy(),
      });
    });
  }

  update(dt: number, playerX: number, playerY: number): void {
    if (!this.alive) return;

    this.animTime += dt;

    // Flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        for (const l of this.allLayers) l.clearTint();
      }
    }

    // Drift toward target
    this.x = Phaser.Math.Linear(this.x, this.targetX, 0.025);
    this.y = Phaser.Math.Linear(this.y, this.targetY, 0.025);
    this.container.setPosition(this.x, this.y);
    this.bossGlow.setPosition(this.x, this.y);

    // Change drift target periodically
    this.moveTimer -= dt;
    if (this.moveTimer <= 0) {
      this.moveTimer  = 2 + Math.random() * 2;
      this.targetX = Phaser.Math.Between(1240, 1800);
      this.targetY = Phaser.Math.Between(200, H - 200);
    }

    // Layer animation
    const t = this.animTime;

    // Wings layer gentle flutter
    this.wingsLayer.y = Math.sin(t * 0.5 * TWO_PI) * 6;
    this.wingsLayer.angle = Math.sin(t * 0.3 * TWO_PI) * 5;

    // Body subtle bob
    this.bodyLayer.y = Math.sin(t * 0.7 * TWO_PI) * 4;

    // State machine
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) this.advanceState(playerX, playerY);
  }

  private advanceState(px: number, py: number): void {
    switch (this.state) {
      case 'idle':
        this.state      = 'telegraph';
        this.stateTimer = this.attacks[this.atkIndex].telegraph;
        for (const l of this.allLayers) l.setTint(0xffbbdd);
        this.telegraphRing = pulsingRing(
          this.scene,
          () => this.x,
          () => this.y,
          0xff99dd,
        );
        break;

      case 'telegraph':
        for (const l of this.allLayers) l.clearTint();
        if (this.telegraphRing) {
          this.telegraphRing.destroy();
          this.telegraphRing = null;
        }
        this.state      = 'firing';
        this.stateTimer = 0.1;
        this.attacks[this.atkIndex].execute(this, this.fireFn, this.laserFireFn, px, py);
        break;

      case 'firing':
        this.state      = 'pause';
        this.stateTimer = this.attacks[this.atkIndex].pause;
        this.atkIndex   = (this.atkIndex + 1) % this.attacks.length;
        break;

      case 'pause': {
        this.state      = 'idle';
        const idleTime = this.phase === 1 ? B3.phase1idle
          : this.phase === 2 ? B3.phase2idle
          : B3.phase3idle;
        this.stateTimer = idleTime;
        break;
      }
    }
  }

  hit(dmg: number): void {
    if (!this.alive) return;
    this.hp -= dmg;

    for (const l of this.allLayers) l.setTint(0xffffff);
    this.flashTimer = 0.05;

    if (this.phase === 1 && this.hp <= this.maxHp * B3.phase2at) this.enterPhase(2);
    else if (this.phase === 2 && this.hp <= this.maxHp * B3.phase3at) this.enterPhase(3);

    if (this.hp <= 0) this.die();
  }

  private enterPhase(p: Boss3Phase): void {
    this.phase    = p;
    this.atkIndex = 0;
    this.state    = 'idle';
    this.stateTimer = B3.phaseTransitionPause;
    this.attacks  = p === 2 ? BOSS3_PHASE2 : BOSS3_PHASE3;

    if (this.telegraphRing) {
      this.telegraphRing.destroy();
      this.telegraphRing = null;
    }

    this.scene.tweens.add({
      targets: this.container,
      scaleX: -0.23, scaleY: 0.23,
      duration: 150, yoyo: true, repeat: 3,
      ease: 'Sine.easeInOut',
    });

    shockwave(this.scene, this.x, this.y, p === 3 ? 0xff4488 : 0xff66cc, 320);

    this.onPhaseChange?.(p);
  }

  private die(): void {
    this.alive = false;

    if (this.telegraphRing) {
      this.telegraphRing.destroy();
      this.telegraphRing = null;
    }
    this.scene.tweens.add({
      targets: this.bossGlow,
      alpha: 0,
      duration: 600,
      onComplete: () => this.bossGlow.destroy(),
    });

    const offsets = [
      { dx: -60, dy: -50, delay: 0 },
      { dx:  70, dy:  30, delay: 180 },
      { dx: -30, dy:  70, delay: 360 },
      { dx:  50, dy: -70, delay: 520 },
    ];
    for (const o of offsets) {
      this.scene.time.delayedCall(o.delay, () => {
        const ex = this.x + o.dx;
        const ey = this.y + o.dy;

        const emitter = this.scene.add.particles(ex, ey, 'particle', {
          speed: { min: 100, max: 350 },
          scale: { start: 1.5, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 500,
          blendMode: Phaser.BlendModes.ADD,
          tint: [0xff66cc, 0xff99dd, 0xffffff],
          quantity: 14,
          emitting: false,
        });
        emitter.setDepth(DEPTH.FX);
        emitter.explode(14);
        this.scene.time.delayedCall(600, () => emitter.destroy());

        const flash = this.scene.add.circle(ex, ey, 60, 0xffffff, 0.9)
          .setDepth(DEPTH.FX)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({
          targets: flash,
          alpha: 0,
          scaleX: 2.5,
          scaleY: 2.5,
          duration: 300,
          ease: 'Power2',
          onComplete: () => flash.destroy(),
        });
      });
    }

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 800,
      delay: 600,
      ease: 'Power2',
      onComplete: () => this.container.destroy(),
    });

    this.onDie?.();
  }

  getHpFraction(): number { return Math.max(0, this.hp / this.maxHp); }
}

// =============================================================================
// Miniboss3: "Thorn Sentinel"
// 2-layer container: thorns (behind) + body (center)
// =============================================================================
export class Miniboss3 {
  private container: Phaser.GameObjects.Container;
  private thornsLayer: Phaser.GameObjects.Image;
  private bodyLayer:   Phaser.GameObjects.Image;
  private allLayers:   Phaser.GameObjects.Image[];

  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive     = true;
  readonly hW = 55;
  readonly hH = 70;

  private phase: 1 | 2 = 1;
  private atkTimer: number;
  private atkIndex  = 0;
  private flashTimer = 0;
  private animTime   = 0;
  private moveTimer = 0;
  private targetY: number;
  private readonly fire:      BossFireFn;
  private readonly laserFire: LaserFireFn;
  private readonly scene:     Phaser.Scene;

  onDie?: () => void;

  constructor(scene: Phaser.Scene, fire: BossFireFn, laserFire: LaserFireFn) {
    this.scene     = scene;
    this.fire      = fire;
    this.laserFire = laserFire;
    this.x         = W + 200;
    this.y         = H / 2;
    this.hp        = MB3.hp;
    this.maxHp     = MB3.hp;
    this.atkTimer  = MB3.attackTimer;
    this.targetY   = H / 2;

    // Build 2-layer container (thorns -> body)
    this.container = scene.add.container(this.x, this.y).setDepth(DEPTH.ENEMY);

    this.thornsLayer = scene.add.image(0, 0, 'miniboss3-thorns').setScale(1.2);
    this.bodyLayer   = scene.add.image(0, 0, 'miniboss3-body');

    this.allLayers = [this.thornsLayer, this.bodyLayer];
    this.container.add(this.allLayers);
    this.container.setScale(0.15);
    this.container.scaleX = -0.15;

    scene.tweens.add({
      targets: this.container,
      x: W * 0.75,
      duration: 1000,
      ease: 'Power2.easeOut',
      onComplete: () => { this.x = W * 0.75; },
    });
  }

  update(dt: number, playerX: number, playerY: number): void {
    if (!this.alive) return;

    this.animTime += dt;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        for (const l of this.allLayers) l.clearTint();
      }
    }

    // Vertical drift
    this.x = Phaser.Math.Linear(this.x, W * 0.75, 0.03);
    this.y = Phaser.Math.Linear(this.y, this.targetY, 0.03);
    this.container.setPosition(this.x, this.y);

    this.moveTimer -= dt;
    if (this.moveTimer <= 0) {
      this.moveTimer  = 1.5 + Math.random() * 1.5;
      this.targetY = Phaser.Math.Between(160, H - 160);
    }

    // Layer animation
    const t = this.animTime;

    // Thorns sway slowly
    this.thornsLayer.x = Math.sin(t * 0.4 * TWO_PI) * 14;
    this.thornsLayer.angle = Math.sin(t * 0.3 * TWO_PI) * 6;
    this.thornsLayer.y = Math.sin(t * 0.5 * TWO_PI) * 10;

    // Body bobs slightly
    this.bodyLayer.y = Math.sin(t * 0.65 * TWO_PI) * 4;

    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.doAttack(playerX, playerY);
    }
  }

  private doAttack(px: number, py: number): void {
    const spdMult = this.phase === 2 ? MB3.phase2speedMult : 1.0;
    const mbSpd = BALANCE.stage3.bulletSpeed.base * MB3.bulletSpeedMult * spdMult;

    // Phase 1: 4 attacks
    const phase1 = [
      () => {
        // Crystal Thrust: aimed laser + 8-ring bullets
        const angle = Math.atan2(py - this.y, px - this.x);
        this.laserFire(this.x, this.y, angle, 10, 1.2, 1.5, 0xff66cc);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.9, Math.sin(a) * mbSpd * 0.9, 1, 0xff66cc);
        }
        this.atkTimer = 1.2;
      },
      () => {
        // Thorn Spread: 5-shot aimed fan
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.22;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd, Math.sin(a) * mbSpd, 1, 0x88ccff);
        }
        this.atkTimer = 1.0;
      },
      () => {
        // Rose Ring: 10-ring teal + 10-ring offset pink
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.85, Math.sin(a) * mbSpd * 0.85, 1, 0x00ccaa);
        }
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI + Math.PI / 10;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.7, Math.sin(a) * mbSpd * 0.7, 0.8, 0xff66cc);
        }
        this.atkTimer = 1.3;
      },
      () => {
        // Guard Bloom: aimed3 warning, then single rotating laser sweep
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.3;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.05, Math.sin(a) * mbSpd * 1.05, 1, 0x88ccff);
        }
        this.scene.time.delayedCall(600, () => {
          if (!this.alive) return;
          const startA = base - Math.PI / 4;
          const sweepRange = Math.PI / 2;
          const sweepDur   = 1.4;
          this.laserFire(this.x, this.y, startA, 10, 0.8, sweepDur, 0xff66cc,
            { ownerId: 'miniboss3', rotSpeed: sweepRange / sweepDur });
        });
        this.atkTimer = 2.4;
      },
    ];

    // Phase 2: 6 attacks -- faster, denser
    const phase2 = [
      () => {
        // Crystal Thrust (fast): laser + 8-ring
        const angle = Math.atan2(py - this.y, px - this.x);
        this.laserFire(this.x, this.y, angle, 12, 0.8, 1.2, 0xff66cc);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.95, Math.sin(a) * mbSpd * 0.95, 1, 0xff66cc);
        }
        this.atkTimer = 1.2;
      },
      () => {
        // Thorn Spread (fast): 7-shot aimed fan
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -3; i <= 3; i++) {
          const a = base + i * 0.18;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.05, Math.sin(a) * mbSpd * 1.05, 1, 0x88ccff);
        }
        this.atkTimer = 0.7;
      },
      () => {
        // Rose Ring (fast): tighter offset
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.9, Math.sin(a) * mbSpd * 0.9, 1, 0x00ccaa);
        }
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI + Math.PI / 10;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.75, Math.sin(a) * mbSpd * 0.75, 0.8, 0xff66cc);
        }
        this.atkTimer = 1.0;
      },
      () => {
        // Guard Bloom P2: tighter timing
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.25;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.1, Math.sin(a) * mbSpd * 1.1, 1, 0x88ccff);
        }
        this.scene.time.delayedCall(400, () => {
          if (!this.alive) return;
          const startA = base - Math.PI / 4;
          const sweepRange = Math.PI / 2;
          const sweepDur   = 1.2;
          this.laserFire(this.x, this.y, startA, 10, 0.6, sweepDur, 0xff66cc,
            { ownerId: 'miniboss3', rotSpeed: sweepRange / sweepDur });
        });
        this.atkTimer = 2.0;
      },
      () => {
        // Double Thorn: two V-lasers at 60-deg spread
        const base = Math.atan2(py - this.y, px - this.x);
        const spread = Math.PI / 3;
        this.laserFire(this.x, this.y, base + spread, 10, 0.7, 1.5, 0xff66cc);
        this.laserFire(this.x, this.y, base - spread, 10, 0.7, 1.5, 0x88ccff);
        this.scene.time.delayedCall(300, () => {
          if (!this.alive) return;
          for (let i = 0; i < 3; i++) {
            const aUp   = base + spread + 0.15 + i * 0.2;
            const aDown = base - spread - 0.15 - i * 0.2;
            this.fire(this.x, this.y, Math.cos(aUp) * mbSpd * 0.95, Math.sin(aUp) * mbSpd * 0.95, 1, 0x88ccff);
            this.fire(this.x, this.y, Math.cos(aDown) * mbSpd * 0.95, Math.sin(aDown) * mbSpd * 0.95, 1, 0x88ccff);
          }
        });
        this.atkTimer = 1.5;
      },
      () => {
        // Petal Storm: 14-ring + 3 aimed bursts
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.85, Math.sin(a) * mbSpd * 0.85, 1.1, 0xff66cc);
        }
        let burst = 0;
        const shoot = () => {
          if (!this.alive) return;
          const base = Math.atan2(py - this.y, px - this.x);
          for (let i = -1; i <= 1; i++) {
            const a = base + i * 0.25;
            this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.1, Math.sin(a) * mbSpd * 1.1, 1, 0x88ccff);
          }
          burst++;
          if (burst < 3) this.scene.time.delayedCall(250, shoot);
        };
        this.scene.time.delayedCall(200, shoot);
        this.atkTimer = 1.5;
      },
    ];

    const patterns = this.phase === 2 ? phase2 : phase1;
    patterns[this.atkIndex % patterns.length]();
    this.atkIndex++;
  }

  hit(dmg: number): void {
    if (!this.alive) return;
    this.hp -= dmg;
    for (const l of this.allLayers) l.setTint(0xffffff);
    this.flashTimer = 0.06;

    // Phase transition at threshold
    if (this.phase === 1 && this.hp <= this.maxHp * MB3.phase2at) {
      this.enterPhase2();
    }

    if (this.hp <= 0) this.die();
  }

  private enterPhase2(): void {
    this.phase = 2;
    this.atkIndex = 0;

    // Visual flash + shockwave
    shockwave(this.scene, this.x, this.y, 0xff66cc, 200);
    for (const l of this.allLayers) l.setTint(0xff66cc);
    this.scene.time.delayedCall(400, () => {
      if (this.alive) for (const l of this.allLayers) l.clearTint();
    });

    // Scale pulse
    this.scene.tweens.add({
      targets: this.container,
      scaleX: -0.18, scaleY: 0.18,
      duration: 120, yoyo: true, repeat: 2,
      ease: 'Sine.easeInOut',
    });

    // Brief attack pause for transition
    this.atkTimer = 1.5;
  }

  private die(): void {
    this.alive = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0, scaleX: -1.5, scaleY: 1.5,
      duration: 600,
      onComplete: () => this.container.destroy(),
    });
    this.onDie?.();
  }

  getHpFraction(): number { return Math.max(0, this.hp / this.maxHp); }
}
