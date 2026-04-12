import Phaser from 'phaser';
import { W, H, DEPTH } from '../constants';
import { BALANCE } from '../balance';
import { BossFireFn } from './Boss';
import type { LaserFireFn } from './Laser';

export type { LaserFireFn };

const B4  = BALANCE.stage4.boss;
const MB4 = BALANCE.stage4.miniboss;
const TWO_PI = Math.PI * 2;

// ─── VFX helpers ─────────────────────────────────────────────────────────────

function shockwave(scene: Phaser.Scene, x: number, y: number, color = 0xffcc00, maxR = 260): void {
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

function pulsingRing(scene: Phaser.Scene, getX: () => number, getY: () => number, color = 0xffcc00): Phaser.GameObjects.Graphics {
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

function ringB(entity: { x: number; y: number }, fire: BossFireFn, count: number, speed: number, offset = 0, sc = 1, tint = 0xffcc00): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TWO_PI + offset;
    fire(entity.x, entity.y, Math.cos(a) * speed, Math.sin(a) * speed, sc, tint);
  }
}

function aimFanB(entity: { x: number; y: number }, fire: BossFireFn, px: number, py: number, count: number, spread: number, speed: number, tint = 0xffcc00): void {
  const base = Math.atan2(py - entity.y, px - entity.x);
  const step = count > 1 ? spread / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const a = base - spread / 2 + step * i;
    fire(entity.x, entity.y, Math.cos(a) * speed, Math.sin(a) * speed, 1, tint);
  }
}

// ─── Boss4 attack types ──────────────────────────────────────────────────────
type Boss4Phase = 1 | 2 | 3;
type AttackState = 'idle' | 'telegraph' | 'firing' | 'pause';

interface Attack4 {
  name:      string;
  telegraph: number;
  execute:   (b: Boss4, fire: BossFireFn, laserFire: LaserFireFn, px: number, py: number) => void;
  pause:     number;
}

// ─── Phase 1 attacks: "Dawn" ─────────────────────────────────────────────────
const P1 = B4.phase1speed;

const BOSS4_PHASE1: Attack4[] = [
  {
    name: 'Solar Flare',
    telegraph: B4.phase1telegraph,
    execute(b, fire, _lf, px, py) {
      // Aimed 5-shot fan, spread PI/4
      aimFanB(b, fire, px, py, 5, Math.PI / 4, P1, 0xffcc00);
    },
    pause: B4.phase1pause,
  },
  {
    name: 'Ring of Light',
    telegraph: B4.phase1telegraph,
    execute(b, fire) {
      // 12-ring at slightly slower speed
      ringB(b, fire, 12, P1 * 0.85, 0, 1, 0xffcc00);
    },
    pause: B4.phase1pause,
  },
  {
    name: 'Tracer Laser',
    telegraph: B4.phase1telegraph,
    execute(b, _fire, laserFire, px, py) {
      // Single aimed laser
      const angle = Math.atan2(py - b.y, px - b.x);
      laserFire(b.x, b.y, angle, 12, B4.phase1telegraph + 0.2, 2.0, 0xffcc00);
    },
    pause: B4.phase1pause + 0.3,
  },
  {
    name: 'Radiant Burst',
    telegraph: B4.phase1telegraph,
    execute(b, fire, _lf, px, py) {
      // Aimed 3-fan + ring 8 simultaneous
      aimFanB(b, fire, px, py, 3, Math.PI / 5, P1 * 0.95, 0xffcc00);
      ringB(b, fire, 8, P1 * 0.8, 0, 1, 0x00ddff);
    },
    pause: B4.phase1pause,
  },
  {
    name: '"Solar Waltz"',
    telegraph: B4.phase1telegraph + 0.2,
    execute(b, fire, laserFire, px, py) {
      // Spell card: single rotating laser sweeps 180° over 3s + ring bursts + aimed volleys
      const startAngle = Math.PI * 0.5;
      const sweepRange = Math.PI;
      const sweepDur   = 3.0;
      const rotSpeed   = -sweepRange / sweepDur;

      laserFire(b.x, b.y, startAngle, 18, 0.6, sweepDur, 0xffcc00,
        { ownerId: 'boss4', rotSpeed });

      // Ring10 bursts during sweep every 500ms
      let ringStep = 0;
      const ringShoot = () => {
        if (!b.alive) return;
        ringB(b, fire, 10, P1 * 0.8, ringStep * 0.3, 1, 0x00ddff);
        ringStep++;
        if (ringStep < 6) b.scene.time.delayedCall(500, ringShoot);
      };
      b.scene.time.delayedCall(800, ringShoot);

      // Aimed3 volleys every 600ms
      let aimStep = 0;
      const aimShoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 3, Math.PI / 5, P1 * 0.85, 0xffcc00);
        aimStep++;
        if (aimStep < 4) b.scene.time.delayedCall(600, aimShoot);
      };
      b.scene.time.delayedCall(1000, aimShoot);
    },
    pause: B4.phase1pause + 0.5,
  },
];

// ─── Phase 2 attacks: "Corona" ───────────────────────────────────────────────
const P2 = B4.phase2speed;

const BOSS4_PHASE2: Attack4[] = [
  {
    name: 'Double Ring',
    telegraph: B4.phase2telegraph,
    execute(b, fire) {
      // ring12 + ring10 offset at different speeds
      ringB(b, fire, 12, P2 * 1.0, 0, 1, 0xffcc00);
      ringB(b, fire, 10, P2 * 0.8, Math.PI / 12, 0.9, 0x00ddff);
    },
    pause: B4.phase2pause,
  },
  {
    name: 'Cross Laser',
    telegraph: B4.phase2telegraph,
    execute(b, _fire, laserFire, px, py) {
      // 2 perpendicular aimed lasers
      const base = Math.atan2(py - b.y, px - b.x);
      laserFire(b.x, b.y, base + Math.PI / 4, 16, B4.phase2telegraph, 2.5, 0xffcc00);
      laserFire(b.x, b.y, base - Math.PI / 4, 16, B4.phase2telegraph, 2.5, 0x6622cc);
    },
    pause: B4.phase2pause + 0.2,
  },
  {
    name: 'Rapid Fan',
    telegraph: B4.phase2telegraph,
    execute(b, fire, _lf, px, py) {
      // 3 aimed7 volleys at 250ms intervals
      let volley = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 7, Math.PI / 3, P2 * 0.95, 0x00ddff);
        volley++;
        if (volley < 3) b.scene.time.delayedCall(250, shoot);
      };
      shoot();
    },
    pause: B4.phase2pause,
  },
  {
    name: 'Spiral Stars',
    telegraph: B4.phase2telegraph,
    execute(b, fire) {
      // 4 aimed streams at 120ms intervals with rotating offset
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        const a = step * 0.45;
        fire(b.x, b.y, Math.cos(a) * P2 * 1.0, Math.sin(a) * P2 * 1.0, 1, 0xffcc00);
        fire(b.x, b.y, Math.cos(a + Math.PI * 0.5) * P2 * 1.0, Math.sin(a + Math.PI * 0.5) * P2 * 1.0, 1, 0xffcc00);
        fire(b.x, b.y, Math.cos(a + Math.PI) * P2 * 1.0, Math.sin(a + Math.PI) * P2 * 1.0, 1, 0xffcc00);
        fire(b.x, b.y, Math.cos(a + Math.PI * 1.5) * P2 * 1.0, Math.sin(a + Math.PI * 1.5) * P2 * 1.0, 1, 0xffcc00);
        step++;
        if (step < 24) b.scene.time.delayedCall(120, shoot);
      };
      shoot();
    },
    pause: B4.phase2pause,
  },
  {
    name: '"Corona Flare"',
    telegraph: B4.phase2telegraph + 0.15,
    execute(b, fire, laserFire, px, py) {
      // Spell card: rotating laser 180° over 3s + ring10 + aimed5
      const startAngle = Math.PI * 0.5;
      const sweepRange = Math.PI;
      const sweepDur   = 3.0;
      const rotSpeed   = -sweepRange / sweepDur;

      laserFire(b.x, b.y, startAngle, 20, 0.5, sweepDur, 0xffcc00,
        { ownerId: 'boss4', rotSpeed });

      // Ring10 bursts during sweep every 500ms
      let ringStep = 0;
      const ringShoot = () => {
        if (!b.alive) return;
        ringB(b, fire, 10, P2 * 0.8, ringStep * 0.3, 1, 0x00ddff);
        ringStep++;
        if (ringStep < 6) b.scene.time.delayedCall(500, ringShoot);
      };
      b.scene.time.delayedCall(700, ringShoot);

      // Aimed5 during sweep every 500ms
      let aimStep = 0;
      const aimShoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 5, Math.PI / 4, P2 * 1.0, 0x00ddff);
        aimStep++;
        if (aimStep < 5) b.scene.time.delayedCall(500, aimShoot);
      };
      b.scene.time.delayedCall(800, aimShoot);
    },
    pause: B4.phase2pause + 0.4,
  },
];

// ─── Phase 3 attacks: "Supernova" ────────────────────────────────────────────
const P3 = B4.phase3speed;

const BOSS4_PHASE3: Attack4[] = [
  {
    name: 'Annihilation Ring',
    telegraph: B4.phase3telegraph,
    execute(b, fire) {
      // ring16 at phase3 speed, golden, scale 1.1
      ringB(b, fire, 16, P3 * 1.0, 0, 1.1, 0xffcc00);
    },
    pause: B4.phase3pause,
  },
  {
    name: 'Triple Laser',
    telegraph: B4.phase3telegraph,
    execute(b, _fire, laserFire, px, py) {
      // 3 lasers at 120° spread, aimed center
      const base = Math.atan2(py - b.y, px - b.x);
      const spread = (2 * Math.PI) / 3;
      laserFire(b.x, b.y, base, 16, B4.phase3telegraph, 2.0, 0xffcc00);
      laserFire(b.x, b.y, base + spread * 0.25, 14, B4.phase3telegraph, 2.0, 0x00ddff);
      laserFire(b.x, b.y, base - spread * 0.25, 14, B4.phase3telegraph, 2.0, 0x00ddff);
    },
    pause: B4.phase3pause + 0.15,
  },
  {
    name: 'Cascade Storm',
    telegraph: B4.phase3telegraph,
    execute(b, fire, _lf, px, py) {
      // Alternating ring10 and aimed5 at 350ms intervals, 5 volleys
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        if (step % 2 === 0) {
          ringB(b, fire, 10, P3 * 0.85, step * 0.25, 1, 0xffcc00);
        } else {
          aimFanB(b, fire, px, py, 5, Math.PI / 4, P3 * 1.05, 0x00ddff);
        }
        step++;
        if (step < 5) b.scene.time.delayedCall(350, shoot);
      };
      shoot();
    },
    pause: B4.phase3pause,
  },
  {
    name: 'Convergence',
    telegraph: B4.phase3telegraph,
    execute(b, fire, _lf, px, py) {
      // 4 aimed streams offset by ±0.15 and ±0.4 rad
      const base = Math.atan2(py - b.y, px - b.x);
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        fire(b.x, b.y, Math.cos(base + 0.15) * P3 * 1.1, Math.sin(base + 0.15) * P3 * 1.1, 1, 0x6622cc);
        fire(b.x, b.y, Math.cos(base - 0.15) * P3 * 1.1, Math.sin(base - 0.15) * P3 * 1.1, 1, 0x6622cc);
        fire(b.x, b.y, Math.cos(base + 0.4) * P3 * 1.1, Math.sin(base + 0.4) * P3 * 1.1, 1, 0x6622cc);
        fire(b.x, b.y, Math.cos(base - 0.4) * P3 * 1.1, Math.sin(base - 0.4) * P3 * 1.1, 1, 0x6622cc);
        step++;
        if (step < 8) b.scene.time.delayedCall(120, shoot);
      };
      shoot();
    },
    pause: B4.phase3pause,
  },
  {
    name: '"Stellar Collapse"',
    telegraph: B4.phase3telegraph + 0.15,
    execute(b, fire, laserFire, px, py) {
      // Grand finale: rotating laser full 360° over 4s
      const sweepDur = 4.0;
      const rotSpeed  = TWO_PI / sweepDur;

      laserFire(b.x, b.y, 0, 22, 0.5, sweepDur, 0xff6600,
        { ownerId: 'boss4', rotSpeed });

      // Ring14 every 400ms
      let ringStep = 0;
      const ringShoot = () => {
        if (!b.alive) return;
        ringB(b, fire, 14, P3 * 0.85, ringStep * 0.22, 1.1, 0xffcc00);
        ringStep++;
        if (ringStep < 10) b.scene.time.delayedCall(400, ringShoot);
      };
      b.scene.time.delayedCall(700, ringShoot);

      // Aimed5 every 300ms
      let aimStep = 0;
      const aimShoot = () => {
        if (!b.alive) return;
        aimFanB(b, fire, px, py, 5, Math.PI / 4, P3 * 1.1, 0x00ddff);
        aimStep++;
        if (aimStep < 12) b.scene.time.delayedCall(300, aimShoot);
      };
      b.scene.time.delayedCall(800, aimShoot);
    },
    pause: B4.phase3pause + 0.3,
  },
];

// =============================================================================
// Boss4: "Solaris, the Eternal Flame"
// 2-layer container: wings (behind) + body (center)
// =============================================================================
export class Boss4 {
  private container: Phaser.GameObjects.Container;
  private wingsLayer: Phaser.GameObjects.Image;
  private bodyLayer:  Phaser.GameObjects.Image;
  private allLayers:  Phaser.GameObjects.Image[];

  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive  = true;
  phase: Boss4Phase = 1;
  readonly hW = 85;
  readonly hH = 115;

  readonly scene: Phaser.Scene;
  private state: AttackState = 'idle';
  private stateTimer  = 1.5;
  private atkIndex    = 0;
  private attacks: Attack4[];
  private flashTimer  = 0;
  private animTime    = 0;
  private telegraphRing: Phaser.GameObjects.Graphics | null = null;
  private bossGlow!: Phaser.GameObjects.Graphics;

  private moveTimer  = 0;
  private targetX: number;
  private targetY: number;
  private readonly fireFn:      BossFireFn;
  private readonly laserFireFn: LaserFireFn;

  onPhaseChange?: (phase: Boss4Phase) => void;
  onDie?:          () => void;

  constructor(scene: Phaser.Scene, fire: BossFireFn, laserFire: LaserFireFn) {
    this.scene        = scene;
    this.fireFn       = fire;
    this.laserFireFn  = laserFire;
    this.x            = W + 300;
    this.y            = B4.homeY;
    this.hp           = B4.totalHp;
    this.maxHp        = B4.totalHp;
    this.attacks      = BOSS4_PHASE1;
    this.targetX      = B4.homeX;
    this.targetY      = B4.homeY;

    const targetScale = 0.20;

    // Build 2-layer container (wings -> body)
    this.container = scene.add.container(this.x, this.y).setDepth(DEPTH.ENEMY);

    this.wingsLayer = scene.add.image(0, 0, 'boss4-wings').setScale(1.8);
    this.bodyLayer  = scene.add.image(0, 0, 'boss4-body');

    this.allLayers = [this.wingsLayer, this.bodyLayer];
    this.container.add(this.allLayers);
    this.container.setScale(0);

    // Ambient glow aura (golden)
    this.bossGlow = scene.add.graphics().setDepth(DEPTH.ENEMY - 1);
    this.bossGlow.fillStyle(0xffcc00, 0.10);
    this.bossGlow.fillCircle(0, 0, 210);
    this.bossGlow.fillStyle(0xcc9900, 0.08);
    this.bossGlow.fillCircle(0, 0, 160);
    this.bossGlow.fillStyle(0xffdd55, 0.06);
    this.bossGlow.fillCircle(0, 0, 105);
    this.bossGlow.setPosition(B4.homeX, B4.homeY).setAlpha(0);
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
      x: B4.homeX,
      duration: 1200,
      ease: 'Power2.easeOut',
      onComplete: () => { this.x = B4.homeX; },
    });

    scene.tweens.add({
      targets: this.container,
      scaleX: -targetScale,
      scaleY: targetScale,
      duration: 800,
      ease: 'Back.easeOut',
    });

    scene.time.delayedCall(750, () => {
      const flash = scene.add.circle(B4.homeX, B4.homeY, 200, 0xffffff, 0.85)
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
        for (const l of this.allLayers) l.setTint(0xffdd88);
        this.telegraphRing = pulsingRing(
          this.scene,
          () => this.x,
          () => this.y,
          0xffcc00,
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
        const idleTime = this.phase === 1 ? B4.phase1idle
          : this.phase === 2 ? B4.phase2idle
          : B4.phase3idle;
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

    if (this.phase === 1 && this.hp <= this.maxHp * B4.phase2at) this.enterPhase(2);
    else if (this.phase === 2 && this.hp <= this.maxHp * B4.phase3at) this.enterPhase(3);

    if (this.hp <= 0) this.die();
  }

  private enterPhase(p: Boss4Phase): void {
    this.phase    = p;
    this.atkIndex = 0;
    this.state    = 'idle';
    this.stateTimer = B4.phaseTransitionPause;
    this.attacks  = p === 2 ? BOSS4_PHASE2 : BOSS4_PHASE3;

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

    shockwave(this.scene, this.x, this.y, p === 3 ? 0xff6600 : 0xffcc00, 320);

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
          tint: [0xffcc00, 0xffdd55, 0xffffff],
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
// Miniboss4: "Void Herald"
// 2-layer container: orbs (behind) + body (center)
// =============================================================================
export class Miniboss4 {
  private container: Phaser.GameObjects.Container;
  private orbsLayer: Phaser.GameObjects.Image;
  private bodyLayer: Phaser.GameObjects.Image;
  private allLayers: Phaser.GameObjects.Image[];

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
    this.hp        = MB4.hp;
    this.maxHp     = MB4.hp;
    this.atkTimer  = MB4.attackTimer;
    this.targetY   = H / 2;

    // Build 2-layer container (orbs -> body)
    this.container = scene.add.container(this.x, this.y).setDepth(DEPTH.ENEMY);

    this.orbsLayer = scene.add.image(0, 0, 'miniboss4-orbs').setScale(1.5);
    this.bodyLayer = scene.add.image(0, 0, 'miniboss4-body');

    this.allLayers = [this.orbsLayer, this.bodyLayer];
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

    // Orbs orbit slowly
    this.orbsLayer.x = Math.sin(t * 0.4 * TWO_PI) * 14;
    this.orbsLayer.angle = Math.sin(t * 0.3 * TWO_PI) * 6;
    this.orbsLayer.y = Math.sin(t * 0.5 * TWO_PI) * 10;

    // Body bobs slightly
    this.bodyLayer.y = Math.sin(t * 0.65 * TWO_PI) * 4;

    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.doAttack(playerX, playerY);
    }
  }

  private doAttack(px: number, py: number): void {
    const spdMult = this.phase === 2 ? MB4.phase2speedMult : 1.0;
    const mbSpd = BALANCE.stage4.bulletSpeed.base * MB4.bulletSpeedMult * spdMult;

    // Phase 1: 4 attacks
    const phase1 = [
      () => {
        // Void Pulse: aimed laser + ring8
        const angle = Math.atan2(py - this.y, px - this.x);
        this.laserFire(this.x, this.y, angle, 10, 1.2, 1.5, 0x00ddff);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.9, Math.sin(a) * mbSpd * 0.9, 1, 0x00ddff);
        }
        this.atkTimer = 1.2;
      },
      () => {
        // Star Scatter: aimed5 fan (spread PI/3.5)
        const base = Math.atan2(py - this.y, px - this.x);
        const spread = Math.PI / 3.5;
        for (let i = -2; i <= 2; i++) {
          const a = base + i * (spread / 4);
          this.fire(this.x, this.y, Math.cos(a) * mbSpd, Math.sin(a) * mbSpd, 1, 0xffcc00);
        }
        this.atkTimer = 1.0;
      },
      () => {
        // Gravity Ring: ring10 + ring10 offset at different speeds
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.9, Math.sin(a) * mbSpd * 0.9, 1, 0x00ddff);
        }
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI + Math.PI / 10;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.7, Math.sin(a) * mbSpd * 0.7, 0.8, 0xffcc00);
        }
        this.atkTimer = 1.3;
      },
      () => {
        // Cosmic Sweep: rotating laser 90° over 1.4s
        const base = Math.atan2(py - this.y, px - this.x);
        const startA = base - Math.PI / 4;
        const sweepRange = Math.PI / 2;
        const sweepDur   = 1.4;
        this.laserFire(this.x, this.y, startA, 10, 0.8, sweepDur, 0x00ddff,
          { ownerId: 'miniboss4', rotSpeed: sweepRange / sweepDur });
        this.atkTimer = 2.4;
      },
    ];

    // Phase 2: 6 attacks -- faster, denser
    const phase2 = [
      () => {
        // Void Pulse (fast): laser width 12, telegraph 0.8s, active 1.2s
        const angle = Math.atan2(py - this.y, px - this.x);
        this.laserFire(this.x, this.y, angle, 12, 0.8, 1.2, 0x00ddff);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.95, Math.sin(a) * mbSpd * 0.95, 1, 0x00ddff);
        }
        this.atkTimer = 1.2;
      },
      () => {
        // Dense Star Scatter: aimed7 fan (spread PI/3)
        const base = Math.atan2(py - this.y, px - this.x);
        const spread = Math.PI / 3;
        for (let i = -3; i <= 3; i++) {
          const a = base + i * (spread / 6);
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.05, Math.sin(a) * mbSpd * 1.05, 1, 0xffcc00);
        }
        this.atkTimer = 0.7;
      },
      () => {
        // Gravity Ring (tight): ring12 + ring10 offset
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.9, Math.sin(a) * mbSpd * 0.9, 1, 0x00ddff);
        }
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TWO_PI + Math.PI / 10;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.75, Math.sin(a) * mbSpd * 0.75, 0.8, 0xffcc00);
        }
        this.atkTimer = 1.0;
      },
      () => {
        // Cosmic Sweep (fast): 90° over 1.2s, telegraph 0.6s
        const base = Math.atan2(py - this.y, px - this.x);
        const startA = base - Math.PI / 4;
        const sweepRange = Math.PI / 2;
        const sweepDur   = 1.2;
        this.laserFire(this.x, this.y, startA, 10, 0.6, sweepDur, 0x00ddff,
          { ownerId: 'miniboss4', rotSpeed: sweepRange / sweepDur });
        this.atkTimer = 2.0;
      },
      () => {
        // Double Lance: 2 V-pattern lasers at 60° spread
        const base = Math.atan2(py - this.y, px - this.x);
        const spread = Math.PI / 3;
        this.laserFire(this.x, this.y, base + spread, 10, 0.7, 1.5, 0x00ddff);
        this.laserFire(this.x, this.y, base - spread, 10, 0.7, 1.5, 0xffcc00);
        this.scene.time.delayedCall(300, () => {
          if (!this.alive) return;
          for (let i = 0; i < 3; i++) {
            const aUp   = base + spread + 0.15 + i * 0.2;
            const aDown = base - spread - 0.15 - i * 0.2;
            this.fire(this.x, this.y, Math.cos(aUp) * mbSpd * 0.95, Math.sin(aUp) * mbSpd * 0.95, 1, 0x00ddff);
            this.fire(this.x, this.y, Math.cos(aDown) * mbSpd * 0.95, Math.sin(aDown) * mbSpd * 0.95, 1, 0x00ddff);
          }
        });
        this.atkTimer = 1.5;
      },
      () => {
        // Nova Burst: ring14 at 0.85x speed, scale 1.1
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TWO_PI;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.85, Math.sin(a) * mbSpd * 0.85, 1.1, 0xffcc00);
        }
        let burst = 0;
        const shoot = () => {
          if (!this.alive) return;
          const base = Math.atan2(py - this.y, px - this.x);
          for (let i = -1; i <= 1; i++) {
            const a = base + i * 0.25;
            this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.1, Math.sin(a) * mbSpd * 1.1, 1, 0x00ddff);
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
    if (this.phase === 1 && this.hp <= this.maxHp * MB4.phase2at) {
      this.enterPhase2();
    }

    if (this.hp <= 0) this.die();
  }

  private enterPhase2(): void {
    this.phase = 2;
    this.atkIndex = 0;

    // Visual flash + shockwave
    shockwave(this.scene, this.x, this.y, 0xffcc00, 200);
    for (const l of this.allLayers) l.setTint(0xffcc00);
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
