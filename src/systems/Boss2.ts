import Phaser from 'phaser';
import { W, H, DEPTH } from '../constants';
import { BALANCE } from '../balance';
import { BossFireFn } from './Boss';

const B2  = BALANCE.stage2.boss;
const MB2 = BALANCE.stage2.miniboss;
const TWO_PI = Math.PI * 2;

// ─── Laser fire callback ─────────────────────────────────────────────────────
export type LaserFireFn = (
  ox: number, oy: number,
  angle: number, width: number,
  telegraphDur: number, activeDur: number,
  tint: number,
) => void;

// ─── VFX helpers (mirrored from Boss.ts) ─────────────────────────────────────
function shockwave(scene: Phaser.Scene, x: number, y: number, color = 0x00ccaa, maxR = 260): void {
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

function pulsingRing(scene: Phaser.Scene, getX: () => number, getY: () => number, color = 0x88ffee): Phaser.GameObjects.Graphics {
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
function ringB(entity: { x: number; y: number }, fire: BossFireFn, count: number, speed: number, offset = 0, sc = 1, tint = 0x00ccaa): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TWO_PI + offset;
    fire(entity.x, entity.y, Math.cos(a) * speed, Math.sin(a) * speed, sc, tint);
  }
}

function aimFanB(entity: { x: number; y: number }, fire: BossFireFn, px: number, py: number, count: number, spread: number, speed: number, tint = 0xff6600): void {
  const base = Math.atan2(py - entity.y, px - entity.x);
  const step = count > 1 ? spread / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const a = base - spread / 2 + step * i;
    fire(entity.x, entity.y, Math.cos(a) * speed, Math.sin(a) * speed, 1, tint);
  }
}

// ─── Boss2 attack types ──────────────────────────────────────────────────────
type Boss2Phase = 1 | 2 | 3;
type AttackState = 'idle' | 'telegraph' | 'firing' | 'pause';

interface Attack2 {
  name:      string;
  telegraph: number;
  execute:   (b: Boss2, fire: BossFireFn, laserFire: LaserFireFn, px: number, py: number) => void;
  pause:     number;
}

// ─── Phase 1 attacks: "Calibration" ──────────────────────────────────────────
const P1 = B2.phase1speed;

const BOSS2_PHASE1: Attack2[] = [
  {
    name: 'Gear Rings',
    telegraph: B2.phase1telegraph,
    execute(b, fire) {
      // Two concentric rings: 16-outer fast, 12-inner slow, offset half-step
      ringB(b, fire, 16, P1 * 1.0, 0, 1, 0x00ccaa);
      ringB(b, fire, 12, P1 * 0.7, Math.PI / 12, 0.9, 0x00ccaa);
    },
    pause: B2.phase1pause,
  },
  {
    name: 'Conduit Stream',
    telegraph: B2.phase1telegraph,
    execute(b, fire, _lf, px, py) {
      // Aimed fan of 5, 3 volleys at 450ms
      let volley = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 5, Math.PI / 4, P1 * 0.9, 0xff6600);
        volley++;
        if (volley < 3) b.scene.time.delayedCall(450, shoot);
      };
      shoot();
    },
    pause: B2.phase1pause,
  },
  {
    name: 'Piston Barrage',
    telegraph: B2.phase1telegraph,
    execute(b, fire) {
      // Curtain of 5 columns moving left
      let rows = 0;
      const shoot = () => {
        if (!b.alive) return;
        for (let col = 0; col < 5; col++) {
          const oy = -160 + col * 80;
          fire(b.x, b.y + oy, -P1 * 0.95, 0, 1, 0x00ccaa);
        }
        rows++;
        if (rows < 6) b.scene.time.delayedCall(180, shoot);
      };
      shoot();
    },
    pause: B2.phase1pause,
  },
  {
    name: 'Tracer Laser',
    telegraph: B2.phase1telegraph,
    execute(b, _fire, laserFire, px, py) {
      // Single aimed laser — first laser in the fight
      const angle = Math.atan2(py - b.y, px - b.x);
      laserFire(b.x, b.y, angle, 12, 1.2, 2.0, 0x00ccaa);
    },
    pause: B2.phase1pause + 0.3,
  },
  {
    name: '"Rift Pulse"',
    telegraph: B2.phase1telegraph + 0.2,
    execute(b, fire, _lf, px, py) {
      // Spell card: alternating ring16 + aimed3, 8 steps at 350ms
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        if (step % 2 === 0) {
          ringB(b, fire, 16, P1 * 0.85, step * 0.2, 1, 0x00ccaa);
        } else {
          aimFanB(b, fire, px, py, 3, Math.PI / 5, P1 * 0.95, 0xff6600);
        }
        step++;
        if (step < 8) b.scene.time.delayedCall(350, shoot);
      };
      shoot();
    },
    pause: B2.phase1pause + 0.5,
  },
];

// ─── Phase 2 attacks: "Overclock" ────────────────────────────────────────────
const P2 = B2.phase2speed;

const BOSS2_PHASE2: Attack2[] = [
  {
    name: 'Double Ring',
    telegraph: B2.phase2telegraph,
    execute(b, fire) {
      ringB(b, fire, 22, P2 * 1.0, 0, 1.1, 0x00ccaa);
      ringB(b, fire, 22, P2 * 1.0, Math.PI / 22, 1.1, 0x009988);
    },
    pause: B2.phase2pause,
  },
  {
    name: 'Cross Laser',
    telegraph: B2.phase2telegraph,
    execute(b, _fire, laserFire, px, py) {
      // Two lasers at 90-degree angles, player-aimed
      const base = Math.atan2(py - b.y, px - b.x);
      laserFire(b.x, b.y, base + Math.PI / 4, 16, 0.8, 2.5, 0x00ccaa);
      laserFire(b.x, b.y, base - Math.PI / 4, 16, 0.8, 2.5, 0xff6600);
    },
    pause: B2.phase2pause + 0.2,
  },
  {
    name: 'Rapid Fan',
    telegraph: B2.phase2telegraph,
    execute(b, fire, _lf, px, py) {
      // Aimed 9-shot fan, 5 volleys at 280ms
      let volley = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 9, Math.PI / 3, P2 * 0.95, 0xff6600);
        volley++;
        if (volley < 5) b.scene.time.delayedCall(280, shoot);
      };
      shoot();
    },
    pause: B2.phase2pause,
  },
  {
    name: 'Spiral Barrage',
    telegraph: B2.phase2telegraph,
    execute(b, fire) {
      // Twin counter-rotating spirals, 30 shots each
      let t = 0;
      const shoot = () => {
        if (!b.alive) return;
        const a = t * 0.42;
        fire(b.x, b.y, Math.cos(a) * P2 * 1.0, Math.sin(a) * P2 * 1.0, 1, 0x00ccaa);
        fire(b.x, b.y, Math.cos(-a + Math.PI) * P2 * 1.0, Math.sin(-a + Math.PI) * P2 * 1.0, 1, 0x009988);
        t++;
        if (t < 30) b.scene.time.delayedCall(55, shoot);
      };
      shoot();
    },
    pause: B2.phase2pause,
  },
  {
    name: '"Machina Waltz"',
    telegraph: B2.phase2telegraph + 0.15,
    execute(b, fire, laserFire, _px, _py) {
      // Spell card: sweeping laser (180 deg over 3s) + ring10 bursts every 500ms
      const sweepDuration = 3000;
      const sweepSteps = 30;
      const stepTime = sweepDuration / sweepSteps;
      const startAngle = Math.PI * 0.5;      // start pointing down-left
      const endAngle   = Math.PI * -0.5;     // end pointing up-left
      const laserActiveDur = stepTime / 1000 + 0.05;

      let sweepIdx = 0;
      const sweepShoot = () => {
        if (!b.alive) return;
        const frac = sweepIdx / sweepSteps;
        const angle = Phaser.Math.Linear(startAngle, endAngle, frac);
        laserFire(b.x, b.y, angle, 20, 0.0, laserActiveDur, 0x00ccaa);
        sweepIdx++;
        if (sweepIdx <= sweepSteps) b.scene.time.delayedCall(stepTime, sweepShoot);
      };
      sweepShoot();

      // Ring bursts during sweep
      let ringStep = 0;
      const ringShoot = () => {
        if (!b.alive) return;
        ringB(b, fire, 10, P2 * 0.8, ringStep * 0.3, 1, 0xff6600);
        ringStep++;
        if (ringStep < 6) b.scene.time.delayedCall(500, ringShoot);
      };
      b.scene.time.delayedCall(200, ringShoot);
    },
    pause: B2.phase2pause + 0.4,
  },
];

// ─── Phase 3 attacks: "Meltdown" ─────────────────────────────────────────────
const P3 = B2.phase3speed;

const BOSS2_PHASE3: Attack2[] = [
  {
    name: 'Annihilation Ring',
    telegraph: B2.phase3telegraph,
    execute(b, fire, _lf, px, py) {
      // 30-ring + aimed 8-fan overlay
      ringB(b, fire, 30, P3 * 1.0, 0, 1.2, 0x00ccaa);
      aimFanB(b, fire, px, py, 8, Math.PI / 2, P3 * 1.1, 0xff6600);
    },
    pause: B2.phase3pause,
  },
  {
    name: 'Triple Laser',
    telegraph: B2.phase3telegraph,
    execute(b, _fire, laserFire, px, py) {
      // Three lasers in 120-deg spread, player-aimed center
      const base = Math.atan2(py - b.y, px - b.x);
      const spread = (2 * Math.PI) / 3;
      laserFire(b.x, b.y, base, 16, 0.6, 2.0, 0x00ccaa);
      laserFire(b.x, b.y, base + spread * 0.25, 14, 0.6, 2.0, 0xff6600);
      laserFire(b.x, b.y, base - spread * 0.25, 14, 0.6, 2.0, 0xff6600);
    },
    pause: B2.phase3pause + 0.15,
  },
  {
    name: 'Cascade Storm',
    telegraph: B2.phase3telegraph,
    execute(b, fire, _lf, px, py) {
      // Aimed9 + ring10 + spiral, 6 steps at 240ms
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 9, Math.PI / 2.5, P3 * 1.05, 0xff6600);
        ringB(b, fire, 10, P3 * 0.8, step * 0.25, 0.9, 0x00ccaa);
        const a = step * 0.55;
        fire(b.x, b.y, Math.cos(a) * P3 * 0.9, Math.sin(a) * P3 * 0.9, 1, 0x009988);
        fire(b.x, b.y, Math.cos(a + Math.PI) * P3 * 0.9, Math.sin(a + Math.PI) * P3 * 0.9, 1, 0x009988);
        step++;
        if (step < 6) b.scene.time.delayedCall(240, shoot);
      };
      shoot();
    },
    pause: B2.phase3pause,
  },
  {
    name: 'Convergence',
    telegraph: B2.phase3telegraph,
    execute(b, fire, _lf, px, py) {
      // Top/bottom curtains converging + aimed pairs
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        const yTop = 100 + step * 30;
        const yBot = H - 100 - step * 30;
        fire(b.x, yTop, -P3 * 0.9, P3 * 0.2, 1, 0x00ccaa);
        fire(b.x, yBot, -P3 * 0.9, -P3 * 0.2, 1, 0x00ccaa);
        fire(b.x - 40, yTop + 40, -P3 * 0.85, P3 * 0.15, 0.8, 0x009988);
        fire(b.x - 40, yBot - 40, -P3 * 0.85, -P3 * 0.15, 0.8, 0x009988);
        // Aimed pair every other step
        if (step % 2 === 0) {
          const base = Math.atan2(py - b.y, px - b.x);
          fire(b.x, b.y, Math.cos(base + 0.15) * P3 * 1.0, Math.sin(base + 0.15) * P3 * 1.0, 1, 0xff6600);
          fire(b.x, b.y, Math.cos(base - 0.15) * P3 * 1.0, Math.sin(base - 0.15) * P3 * 1.0, 1, 0xff6600);
        }
        step++;
        if (step < 14) b.scene.time.delayedCall(90, shoot);
      };
      shoot();
    },
    pause: B2.phase3pause,
  },
  {
    name: '"Rift Annihilation"',
    telegraph: B2.phase3telegraph + 0.15,
    execute(b, fire, laserFire, px, py) {
      // Grand finale: sweeping laser full 360 over 4s + ring14 every 400ms + aimed5 every 300ms
      const sweepDuration = 4000;
      const sweepSteps = 40;
      const stepTime = sweepDuration / sweepSteps;
      const startAngle = 0;
      const endAngle   = TWO_PI;
      const laserActiveDur = stepTime / 1000 + 0.05;

      let sweepIdx = 0;
      const sweepShoot = () => {
        if (!b.alive) return;
        const frac = sweepIdx / sweepSteps;
        const angle = Phaser.Math.Linear(startAngle, endAngle, frac);
        laserFire(b.x, b.y, angle, 24, 0.0, laserActiveDur, 0xff4400);
        sweepIdx++;
        if (sweepIdx <= sweepSteps) b.scene.time.delayedCall(stepTime, sweepShoot);
      };
      sweepShoot();

      // Ring14 every 400ms
      let ringStep = 0;
      const ringShoot = () => {
        if (!b.alive) return;
        ringB(b, fire, 14, P3 * 0.85, ringStep * 0.22, 1.1, 0x00ccaa);
        ringStep++;
        if (ringStep < 10) b.scene.time.delayedCall(400, ringShoot);
      };
      b.scene.time.delayedCall(150, ringShoot);

      // Aimed5 every 300ms
      let aimStep = 0;
      const aimShoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 5, Math.PI / 4, P3 * 1.1, 0xff6600);
        aimStep++;
        if (aimStep < 12) b.scene.time.delayedCall(300, aimShoot);
      };
      b.scene.time.delayedCall(250, aimShoot);
    },
    pause: B2.phase3pause + 0.3,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// Boss2: "Vortex, the Rift Engine"
// 2-layer container: gears (behind) + body (center)
// ═════════════════════════════════════════════════════════════════════════════
export class Boss2 {
  private container: Phaser.GameObjects.Container;
  private gearsLayer: Phaser.GameObjects.Image;
  private bodyLayer:  Phaser.GameObjects.Image;
  private allLayers:  Phaser.GameObjects.Image[];

  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive  = true;
  phase: Boss2Phase = 1;
  readonly hW = 85;
  readonly hH = 115;

  readonly scene: Phaser.Scene;
  private state: AttackState = 'idle';
  private stateTimer  = 1.5;
  private atkIndex    = 0;
  private attacks: Attack2[];
  private flashTimer  = 0;
  private animTime    = 0;
  private telegraphRing: Phaser.GameObjects.Graphics | null = null;
  private bossGlow!: Phaser.GameObjects.Graphics;

  private moveTimer  = 0;
  private targetX: number;
  private targetY: number;
  private readonly fireFn:      BossFireFn;
  private readonly laserFireFn: LaserFireFn;

  onPhaseChange?: (phase: Boss2Phase) => void;
  onDie?:          () => void;

  constructor(scene: Phaser.Scene, fire: BossFireFn, laserFire: LaserFireFn) {
    this.scene        = scene;
    this.fireFn       = fire;
    this.laserFireFn  = laserFire;
    this.x            = W + 300;
    this.y            = B2.homeY;
    this.hp           = B2.totalHp;
    this.maxHp        = B2.totalHp;
    this.attacks      = BOSS2_PHASE1;
    this.targetX      = B2.homeX;
    this.targetY      = B2.homeY;

    const targetScale = 0.20;

    // ── Build 2-layer container (gears -> body) ──────────────────────
    this.container = scene.add.container(this.x, this.y).setDepth(DEPTH.ENEMY);

    this.gearsLayer = scene.add.image(0, 0, 'boss2-gears').setScale(1.8);
    this.bodyLayer  = scene.add.image(0, 0, 'boss2-body');

    this.allLayers = [this.gearsLayer, this.bodyLayer];
    this.container.add(this.allLayers);
    this.container.setScale(0);

    // ── Ambient glow aura (teal) ─────────────────────────────────────
    this.bossGlow = scene.add.graphics().setDepth(DEPTH.ENEMY - 1);
    this.bossGlow.fillStyle(0x00ccaa, 0.10);
    this.bossGlow.fillCircle(0, 0, 210);
    this.bossGlow.fillStyle(0x006655, 0.08);
    this.bossGlow.fillCircle(0, 0, 160);
    this.bossGlow.fillStyle(0x88ffee, 0.06);
    this.bossGlow.fillCircle(0, 0, 105);
    this.bossGlow.setPosition(B2.homeX, B2.homeY).setAlpha(0);
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

    // ── Dramatic entrance ────────────────────────────────────────────
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
      x: B2.homeX,
      duration: 1200,
      ease: 'Power2.easeOut',
      onComplete: () => { this.x = B2.homeX; },
    });

    scene.tweens.add({
      targets: this.container,
      scaleX: -targetScale,
      scaleY: targetScale,
      duration: 800,
      ease: 'Back.easeOut',
    });

    scene.time.delayedCall(750, () => {
      const flash = scene.add.circle(B2.homeX, B2.homeY, 200, 0xffffff, 0.85)
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

    // ── Layer animation ──────────────────────────────────────────────
    const t = this.animTime;

    // Gear layer ROTATES continuously
    this.gearsLayer.angle += dt * 15;
    this.gearsLayer.y = Math.sin(t * 0.5 * TWO_PI) * 6;

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
        for (const l of this.allLayers) l.setTint(0xaaffee);
        this.telegraphRing = pulsingRing(
          this.scene,
          () => this.x,
          () => this.y,
          0x88ffee,
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
        const idleTime = this.phase === 1 ? B2.phase1idle
          : this.phase === 2 ? B2.phase2idle
          : B2.phase3idle;
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

    if (this.phase === 1 && this.hp <= this.maxHp * B2.phase2at) this.enterPhase(2);
    else if (this.phase === 2 && this.hp <= this.maxHp * B2.phase3at) this.enterPhase(3);

    if (this.hp <= 0) this.die();
  }

  private enterPhase(p: Boss2Phase): void {
    this.phase    = p;
    this.atkIndex = 0;
    this.state    = 'idle';
    this.stateTimer = B2.phaseTransitionPause;
    this.attacks  = p === 2 ? BOSS2_PHASE2 : BOSS2_PHASE3;

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

    shockwave(this.scene, this.x, this.y, p === 3 ? 0xff4400 : 0x00ccaa, 320);

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
          tint: [0x00ccaa, 0x88ffee, 0xffffff],
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

// ═════════════════════════════════════════════════════════════════════════════
// Miniboss2: "Warden Automaton"
// 3-layer container: shield (behind) + body (center) + lance (front)
// ═════════════════════════════════════════════════════════════════════════════
export class Miniboss2 {
  private container: Phaser.GameObjects.Container;
  private shieldLayer: Phaser.GameObjects.Image;
  private bodyLayer:   Phaser.GameObjects.Image;
  private lanceLayer:  Phaser.GameObjects.Image;
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
    this.hp        = MB2.hp;
    this.maxHp     = MB2.hp;
    this.atkTimer  = MB2.attackTimer;
    this.targetY   = H / 2;

    // ── Build 3-layer container (shield -> body -> lance) ────────────
    this.container = scene.add.container(this.x, this.y).setDepth(DEPTH.ENEMY);

    this.shieldLayer = scene.add.image(-120, 0, 'miniboss2-shield').setScale(0.7);
    this.bodyLayer   = scene.add.image(0, 0, 'miniboss2-body');
    this.lanceLayer  = scene.add.image(140, 60, 'miniboss2-lance').setScale(0.6);

    this.allLayers = [this.shieldLayer, this.bodyLayer, this.lanceLayer];
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

    // ── Layer animation ──────────────────────────────────────────────
    const t = this.animTime;

    // Shield sways slowly
    const shieldBaseX = -120;
    this.shieldLayer.x = shieldBaseX + Math.sin(t * 0.4 * TWO_PI) * 18;
    this.shieldLayer.angle = Math.sin(t * 0.3 * TWO_PI) * 6;
    this.shieldLayer.y = Math.sin(t * 0.5 * TWO_PI) * 10;

    // Lance oscillates and angles
    const lanceBaseX = 140;
    const lanceBaseY = 60;
    this.lanceLayer.x = lanceBaseX + Math.sin(t * 0.9 * TWO_PI + 0.3) * 15;
    this.lanceLayer.y = lanceBaseY + Math.sin(t * 0.7 * TWO_PI) * 8;
    this.lanceLayer.angle = Math.sin(t * 1.2 * TWO_PI + 0.5) * 10;

    // Body bobs slightly
    this.bodyLayer.y = Math.sin(t * 0.65 * TWO_PI) * 4;

    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.doAttack(playerX, playerY);
    }
  }

  private doAttack(px: number, py: number): void {
    const spdMult = this.phase === 2 ? MB2.phase2speedMult : 1.0;
    const mbSpd = BALANCE.stage2.bulletSpeed.base * MB2.bulletSpeedMult * spdMult;

    // Phase 1: 4 attacks
    const phase1 = [
      () => {
        // Lance Thrust: single aimed laser + 8-ring bullets
        // Generous telegraph — this is the player's first miniboss laser
        const angle = Math.atan2(py - this.y, px - this.x);
        this.laserFire(this.x, this.y, angle, 10, 1.2, 1.5, 0x00ccaa);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.9, Math.sin(a) * mbSpd * 0.9, 1, 0x00ccaa);
        }
        this.atkTimer = 1.2;
      },
      () => {
        // Shield Salvo: 7-shot aimed fan
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -3; i <= 3; i++) {
          const a = base + i * 0.2;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd, Math.sin(a) * mbSpd, 1, 0xff6600);
        }
        this.atkTimer = 1.0;
      },
      () => {
        // Clockwork Ring: 10-ring + 10-ring offset, alternating teal/orange
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.85, Math.sin(a) * mbSpd * 0.85, 1, 0x00ccaa);
        }
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI + Math.PI / 10;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.7, Math.sin(a) * mbSpd * 0.7, 0.8, 0xff6600);
        }
        this.atkTimer = 1.3;
      },
      () => {
        // Guard Counter: aimed3 fan, then sweeping laser after a readable delay
        // Fire the aimed bullets first as a warning that "something is coming"
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.3;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.05, Math.sin(a) * mbSpd * 1.05, 1, 0xff6600);
        }
        // Delay the sweep so the player sees the aimed shots first, then the
        // laser telegraph appears — two distinct threats, not simultaneous chaos
        this.scene.time.delayedCall(600, () => {
          if (!this.alive) return;
          // Fire a single wide-telegraph laser along the sweep's starting angle
          // so the player sees WHERE the sweep will begin
          const startA = base - Math.PI / 4;
          this.laserFire(this.x, this.y, startA, 10, 0.8, 0.15, 0x00ccaa);
          // Then begin the actual sweep after the telegraph resolves
          this.scene.time.delayedCall(900, () => {
            if (!this.alive) return;
            const sweepSteps = 12;
            const stepTime = 120;
            let idx = 0;
            const sweep = () => {
              if (!this.alive) return;
              const angle = startA + (idx / sweepSteps) * (Math.PI / 2);
              this.laserFire(this.x, this.y, angle, 10, 0.0, stepTime / 1000 + 0.05, 0x00ccaa);
              idx++;
              if (idx <= sweepSteps) this.scene.time.delayedCall(stepTime, sweep);
            };
            sweep();
          });
        });
        this.atkTimer = 2.4;
      },
    ];

    // Phase 2: 6 attacks — faster, denser
    const phase2 = [
      () => {
        // Lance Thrust (fast): laser + 8-ring
        // Phase 2 is harder but still needs readable telegraph —
        // 0.8s is shorter than P1's 1.2s but still gives time to react
        const angle = Math.atan2(py - this.y, px - this.x);
        this.laserFire(this.x, this.y, angle, 12, 0.8, 1.2, 0x00ccaa);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.95, Math.sin(a) * mbSpd * 0.95, 1, 0x00ccaa);
        }
        this.atkTimer = 1.2;
      },
      () => {
        // Shield Salvo (fast): 7-shot aimed fan
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -3; i <= 3; i++) {
          const a = base + i * 0.18;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.05, Math.sin(a) * mbSpd * 1.05, 1, 0xff6600);
        }
        this.atkTimer = 0.7;
      },
      () => {
        // Clockwork Ring (fast): tighter offset
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.9, Math.sin(a) * mbSpd * 0.9, 1, 0x00ccaa);
        }
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI + Math.PI / 10;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.75, Math.sin(a) * mbSpd * 0.75, 0.8, 0xff6600);
        }
        this.atkTimer = 1.0;
      },
      () => {
        // Guard Counter (Phase 2): aimed3 fan, then sweeping laser after delay
        // Same structure as Phase 1 Guard Counter but tighter timing:
        //   - Aimed shots fire first as a warning
        //   - 400ms delay (vs P1's 600ms) before telegraph appears
        //   - 0.6s telegraph (vs P1's 0.8s) — player already learned this in P1
        //   - 700ms delay (vs P1's 900ms) before sweep begins
        //   - 15 steps at 80ms (vs P1's 12 at 120ms) — faster, denser sweep
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.25;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.1, Math.sin(a) * mbSpd * 1.1, 1, 0xff6600);
        }
        // Delay before telegraph — shorter than P1 because the player has seen this before
        this.scene.time.delayedCall(400, () => {
          if (!this.alive) return;
          const startA = base - Math.PI / 4;
          // Show telegraph at sweep start angle so the player knows where to avoid
          this.laserFire(this.x, this.y, startA, 10, 0.6, 0.15, 0x00ccaa);
          // Begin actual sweep after telegraph resolves
          this.scene.time.delayedCall(700, () => {
            if (!this.alive) return;
            const sweepSteps = 12;
            const stepTime = 100;
            let idx = 0;
            const sweep = () => {
              if (!this.alive) return;
              const angle = startA + (idx / sweepSteps) * (Math.PI / 2);
              this.laserFire(this.x, this.y, angle, 10, 0.0, stepTime / 1000 + 0.05, 0x00ccaa);
              idx++;
              if (idx <= sweepSteps) this.scene.time.delayedCall(stepTime, sweep);
            };
            sweep();
          });
        });
        this.atkTimer = 2.0;
      },
      () => {
        // Double Lance: two V-pattern lasers + aimed fan outside the V
        // The V creates safe space BETWEEN the lasers — the player reads the
        // telegraph and moves into the gap. Aimed bullets go OUTSIDE the V
        // so the corridor between the lasers is the intended safe zone.
        // 60-deg spread (was 30) gives a wide, readable corridor.
        const base = Math.atan2(py - this.y, px - this.x);
        const spread = Math.PI / 3; // 60 degrees — wide V with clear safe zone
        this.laserFire(this.x, this.y, base + spread, 10, 0.7, 1.5, 0x00ccaa);
        this.laserFire(this.x, this.y, base - spread, 10, 0.7, 1.5, 0x00ccaa);
        // Aimed bullets go OUTSIDE the V — punish players who dodge the wrong way
        this.scene.time.delayedCall(300, () => {
          if (!this.alive) return;
          for (let i = 0; i < 3; i++) {
            const aUp  = base + spread + 0.15 + i * 0.2;
            const aDown = base - spread - 0.15 - i * 0.2;
            this.fire(this.x, this.y, Math.cos(aUp) * mbSpd * 0.95, Math.sin(aUp) * mbSpd * 0.95, 1, 0xff6600);
            this.fire(this.x, this.y, Math.cos(aDown) * mbSpd * 0.95, Math.sin(aDown) * mbSpd * 0.95, 1, 0xff6600);
          }
        });
        this.atkTimer = 1.5;
      },
      () => {
        // Overcharge: 14-ring + rapid aimed3 bursts (3 volleys)
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.85, Math.sin(a) * mbSpd * 0.85, 1.1, 0x00ccaa);
        }
        let burst = 0;
        const shoot = () => {
          if (!this.alive) return;
          const base = Math.atan2(py - this.y, px - this.x);
          for (let i = -1; i <= 1; i++) {
            const a = base + i * 0.25;
            this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.1, Math.sin(a) * mbSpd * 1.1, 1, 0xff6600);
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
    if (this.phase === 1 && this.hp <= this.maxHp * MB2.phase2at) {
      this.enterPhase2();
    }

    if (this.hp <= 0) this.die();
  }

  private enterPhase2(): void {
    this.phase = 2;
    this.atkIndex = 0;

    // Visual flash + shockwave
    shockwave(this.scene, this.x, this.y, 0x00ccaa, 200);
    for (const l of this.allLayers) l.setTint(0x00ccaa);
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
