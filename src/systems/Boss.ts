import Phaser from 'phaser';
import { W, H, DEPTH } from '../constants';
import { BALANCE } from '../balance';

const BOSS_HOME_X = BALANCE.boss.homeX;
const BOSS_HOME_Y = BALANCE.boss.homeY;

// ─── VFX helpers ──────────────────────────────────────────────────────────
function shockwave(scene: Phaser.Scene, x: number, y: number, color = 0xff44cc, maxR = 260): void {
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

function pulsingRing(scene: Phaser.Scene, getX: () => number, getY: () => number, color = 0xffddff): Phaser.GameObjects.Graphics {
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

export type BossFireFn = (
  x: number, y: number,
  vx: number, vy: number,
  scale?: number, tint?: number,
) => void;

type BossPhase   = 1 | 2 | 3;
type AttackState = 'idle' | 'telegraph' | 'firing' | 'pause';

interface Attack {
  name:      string;
  telegraph: number;
  execute:   (b: Boss, fire: BossFireFn, px: number, py: number) => void;
  pause:     number;
}

// ─── Attack helpers ────────────────────────────────────────────────────────
function ring(b: Boss, fire: BossFireFn, count: number, speed: number, offset = 0, sc = 1, tint = 0xff88cc): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + offset;
    fire(b.x, b.y, Math.cos(a) * speed, Math.sin(a) * speed, sc, tint);
  }
}

function aimFan(b: Boss, fire: BossFireFn, px: number, py: number, count: number, spread: number, speed: number, tint = 0xff66bb): void {
  const base = Math.atan2(py - b.y, px - b.x);
  const step = count > 1 ? spread / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const a = base - spread / 2 + step * i;
    fire(b.x, b.y, Math.cos(a) * speed, Math.sin(a) * speed, 1, tint);
  }
}

// ─── Phase 1 attacks: teach patterns (slow, readable, gaps to dodge) ──────
const P1 = BALANCE.boss.phase1speed;

const PHASE1_ATTACKS: Attack[] = [
  {
    name: 'Radial Bloom',
    telegraph: BALANCE.boss.phase1telegraph,
    execute(b, fire) {
      // Simple ring — teaches "find the gap"
      ring(b, fire, 14, P1 * 0.9, 0, 1, 0xcc88ff);
    },
    pause: BALANCE.boss.phase1pause,
  },
  {
    name: 'Aimed Fan',
    telegraph: BALANCE.boss.phase1telegraph,
    execute(b, fire, px, py) {
      // 3 slow fan volleys — teaches "dodge sideways"
      let i = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFan(b, fire, px, py, 5, Math.PI / 4, P1 * 0.85, 0xff88cc);
        i++;
        if (i < 3) b.scene.time.delayedCall(500, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase1pause,
  },
  {
    name: 'Slow Sweep',
    telegraph: BALANCE.boss.phase1telegraph,
    execute(b, fire) {
      // Arc sweep — teaches "move with the pattern"
      let shots = 0;
      const shoot = () => {
        if (!b.alive) return;
        const angle = -Math.PI / 2 + (shots / 20) * Math.PI * 0.8 - Math.PI * 0.4;
        fire(b.x, b.y, Math.cos(angle) * P1 * 0.65, Math.sin(angle) * P1 * 0.65, 1.2, 0xaa66ff);
        shots++;
        if (shots < 20) b.scene.time.delayedCall(90, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase1pause,
  },
  {
    name: 'Petal Scatter',
    telegraph: BALANCE.boss.phase1telegraph,
    execute(b, fire) {
      // Two offset rings — teaches "overlapping patterns have smaller gaps"
      ring(b, fire, 12, P1 * 0.8, 0, 1, 0xffaacc);
      b.scene.time.delayedCall(400, () => {
        if (!b.alive) return;
        ring(b, fire, 12, P1 * 0.8, Math.PI / 12, 1, 0xddaaff);
      });
    },
    pause: BALANCE.boss.phase1pause + 0.3,
  },
  {
    // Signature attack for Phase 1
    name: '"Gentle Cascade"',
    telegraph: BALANCE.boss.phase1telegraph + 0.2,
    execute(b, fire, px, py) {
      // Named spell card: gentle aimed volleys alternating with rings
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        if (step % 2 === 0) {
          aimFan(b, fire, px, py, 4, Math.PI / 5, P1 * 0.8, 0xffccee);
        } else {
          ring(b, fire, 10, P1 * 0.7, step * 0.15, 0.9, 0xcc88ff);
        }
        step++;
        if (step < 8) b.scene.time.delayedCall(380, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase1pause + 0.5,
  },
];

// ─── Phase 2 attacks: mix patterns (medium speed, tighter gaps) ───────────
const P2 = BALANCE.boss.phase2speed;

const PHASE2_ATTACKS: Attack[] = [
  {
    name: 'Double Ring',
    telegraph: BALANCE.boss.phase2telegraph,
    execute(b, fire) {
      ring(b, fire, 20, P2 * 1.0, 0, 1.1, 0xff44aa);
      ring(b, fire, 20, P2 * 1.0, Math.PI / 20, 1.1, 0xdd22cc);
    },
    pause: BALANCE.boss.phase2pause,
  },
  {
    name: 'Rapid Fan',
    telegraph: BALANCE.boss.phase2telegraph,
    execute(b, fire, px, py) {
      let i = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFan(b, fire, px, py, 7, Math.PI / 3, P2 * 0.95, 0xff6699);
        i++;
        if (i < 5) b.scene.time.delayedCall(320, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase2pause,
  },
  {
    name: 'Curtain',
    telegraph: BALANCE.boss.phase2telegraph,
    execute(b, fire) {
      let rows = 0;
      const shoot = () => {
        if (!b.alive) return;
        for (let col = 0; col < 5; col++) {
          const oy = -160 + col * 80;
          fire(b.x, b.y + oy, -P2 * 0.95, 0, 1, 0xee44ff);
        }
        rows++;
        if (rows < 8) b.scene.time.delayedCall(150, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase2pause,
  },
  {
    name: 'Spiral Stream',
    telegraph: BALANCE.boss.phase2telegraph,
    execute(b, fire) {
      let t = 0;
      const shoot = () => {
        if (!b.alive) return;
        const a  = t * 0.4;
        const sp = P2 * 1.0;
        fire(b.x, b.y, Math.cos(a) * sp, Math.sin(a) * sp, 1, 0xff44cc);
        fire(b.x, b.y, Math.cos(a + Math.PI) * sp, Math.sin(a + Math.PI) * sp, 1, 0xcc44ff);
        t++;
        if (t < 28) b.scene.time.delayedCall(60, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase2pause,
  },
  {
    // Signature attack for Phase 2
    name: '"Butterfly Waltz"',
    telegraph: BALANCE.boss.phase2telegraph + 0.15,
    execute(b, fire, px, py) {
      // Named spell card: alternating spirals + aimed bursts
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        // Spiral ring that rotates
        const offset = step * 0.3;
        ring(b, fire, 16, P2 * 0.9, offset, 1, 0xff55bb);
        // Plus aimed pair
        if (step % 2 === 0) {
          aimFan(b, fire, px, py, 3, Math.PI / 6, P2 * 1.05, 0xffaadd);
        }
        step++;
        if (step < 10) b.scene.time.delayedCall(280, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase2pause + 0.4,
  },
];

// ─── Phase 3 attacks: intense (fast, dense, overlapping patterns) ─────────
const P3 = BALANCE.boss.phase3speed;

const PHASE3_ATTACKS: Attack[] = [
  {
    name: 'Death Blossom',
    telegraph: BALANCE.boss.phase3telegraph,
    execute(b, fire, px, py) {
      ring(b, fire, 28, P3 * 1.0, 0, 1.2, 0xff2299);
      aimFan(b, fire, px, py, 8, Math.PI / 2, P3 * 1.1, 0xffaaff);
    },
    pause: BALANCE.boss.phase3pause,
  },
  {
    name: 'Cascade',
    telegraph: BALANCE.boss.phase3telegraph,
    execute(b, fire, px, py) {
      let i = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFan(b, fire, px, py, 9, Math.PI / 2.5, P3 * 1.05, 0xff3388);
        ring(b, fire, 8, P3 * 0.8, i * 0.2, 0.9, 0xdd11bb);
        i++;
        if (i < 6) b.scene.time.delayedCall(260, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase3pause,
  },
  {
    name: 'Void Storm',
    telegraph: BALANCE.boss.phase3telegraph,
    execute(b, fire, px, py) {
      let t = 0;
      const shoot = () => {
        if (!b.alive) return;
        aimFan(b, fire, px, py, 3, Math.PI / 6, P3 * 1.15, 0xff1177);
        const a = t * 0.55;
        fire(b.x, b.y, Math.cos(a) * P3 * 0.95, Math.sin(a) * P3 * 0.95, 1.3, 0xee00cc);
        fire(b.x, b.y, Math.cos(a + Math.PI) * P3 * 0.95, Math.sin(a + Math.PI) * P3 * 0.95, 1.3, 0xee00cc);
        t++;
        if (t < 22) b.scene.time.delayedCall(75, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase3pause,
  },
  {
    name: 'Converging Walls',
    telegraph: BALANCE.boss.phase3telegraph,
    execute(b, fire) {
      // Two curtains from top and bottom converging
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        const yTop = 100 + step * 30;
        const yBot = H - 100 - step * 30;
        fire(b.x, yTop, -P3 * 0.9, P3 * 0.2, 1, 0xff4488);
        fire(b.x, yBot, -P3 * 0.9, -P3 * 0.2, 1, 0xff4488);
        fire(b.x - 40, yTop + 40, -P3 * 0.85, P3 * 0.15, 0.8, 0xdd2277);
        fire(b.x - 40, yBot - 40, -P3 * 0.85, -P3 * 0.15, 0.8, 0xdd2277);
        step++;
        if (step < 12) b.scene.time.delayedCall(100, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase3pause,
  },
  {
    // Signature attack for Phase 3
    name: '"Aether Annihilation"',
    telegraph: BALANCE.boss.phase3telegraph + 0.15,
    execute(b, fire, px, py) {
      // Grand finale spell card: dense rings + aimed streams + spiral overlay
      let step = 0;
      const shoot = () => {
        if (!b.alive) return;
        // Dense ring every other step
        if (step % 2 === 0) {
          ring(b, fire, 24, P3 * 0.95, step * 0.25, 1.1, 0xff1188);
        }
        // Aimed stream every step
        aimFan(b, fire, px, py, 5, Math.PI / 4, P3 * 1.1, 0xffaaee);
        // Spiral bullets every 3 steps
        if (step % 3 === 0) {
          const a = step * 0.6;
          fire(b.x, b.y, Math.cos(a) * P3 * 1.05, Math.sin(a) * P3 * 1.05, 1.2, 0xff00aa);
          fire(b.x, b.y, Math.cos(a + Math.PI) * P3 * 1.05, Math.sin(a + Math.PI) * P3 * 1.05, 1.2, 0xff00aa);
        }
        step++;
        if (step < 16) b.scene.time.delayedCall(180, shoot);
      };
      shoot();
    },
    pause: BALANCE.boss.phase3pause + 0.3,
  },
];

const TWO_PI = Math.PI * 2;

// ─── Boss class — 3-layer rig (wings + hair + body) ────────────────────────
export class Boss {
  private container: Phaser.GameObjects.Container;
  private wingsLayer: Phaser.GameObjects.Image;
  private bodyLayer:  Phaser.GameObjects.Image;
  private allLayers:  Phaser.GameObjects.Image[];

  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive  = true;
  phase: BossPhase = 1;
  readonly hW = 80;
  readonly hH = 110;

  // Expose scene for attack callbacks
  readonly scene: Phaser.Scene;
  private state: AttackState = 'idle';
  private stateTimer  = 1.5;
  private atkIndex    = 0;
  private attacks: Attack[];
  private flashTimer  = 0;
  private animTime    = 0;
  private telegraphRing: Phaser.GameObjects.Graphics | null = null;
  private bossGlow!: Phaser.GameObjects.Graphics;

  private moveTimer  = 0;
  private targetX: number;
  private targetY: number;
  private readonly fireFn: BossFireFn;

  onPhaseChange?: (phase: BossPhase) => void;
  onDie?:          () => void;

  constructor(scene: Phaser.Scene, fire: BossFireFn) {
    this.scene   = scene;
    this.fireFn  = fire;
    this.x       = W + 300;
    this.y       = BOSS_HOME_Y;
    this.hp      = BALANCE.boss.totalHp;
    this.maxHp   = BALANCE.boss.totalHp;
    this.attacks = PHASE1_ATTACKS;
    this.targetX = BOSS_HOME_X;
    this.targetY = BOSS_HOME_Y;

    const targetScale = 0.20;

    // ── Build 2-layer container (wings -> body) ────────────────────────
    this.container = scene.add.container(this.x, this.y).setDepth(DEPTH.ENEMY);

    this.wingsLayer = scene.add.image(0, 20, 'boss-wings').setScale(1.6);
    this.bodyLayer  = scene.add.image(0, 0, 'boss-body');

    this.allLayers = [this.wingsLayer, this.bodyLayer];
    this.container.add(this.allLayers);
    this.container.setScale(0);

    // ── Ambient glow aura ────────────────────────────────────────────
    this.bossGlow = scene.add.graphics().setDepth(DEPTH.ENEMY - 1);
    this.bossGlow.fillStyle(0xff22cc, 0.10);
    this.bossGlow.fillCircle(0, 0, 210);
    this.bossGlow.fillStyle(0x8800ff, 0.08);
    this.bossGlow.fillCircle(0, 0, 160);
    this.bossGlow.fillStyle(0xffaaff, 0.06);
    this.bossGlow.fillCircle(0, 0, 105);
    this.bossGlow.setPosition(BOSS_HOME_X, BOSS_HOME_Y).setAlpha(0);
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
      x: BOSS_HOME_X,
      duration: 1200,
      ease: 'Power2.easeOut',
      onComplete: () => { this.x = BOSS_HOME_X; },
    });

    scene.tweens.add({
      targets: this.container,
      scaleX: -targetScale,
      scaleY: targetScale,
      duration: 800,
      ease: 'Back.easeOut',
    });

    scene.time.delayedCall(750, () => {
      const flash = scene.add.circle(BOSS_HOME_X, BOSS_HOME_Y, 200, 0xffffff, 0.85)
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
    const wingBaseScale = 1.6;
    const wingPulse = wingBaseScale * (1.0 + Math.sin(t * 1.0 * TWO_PI) * 0.08);
    this.wingsLayer.setScale(wingPulse);
    this.wingsLayer.angle = Math.sin(t * 0.6 * TWO_PI) * 5;
    this.wingsLayer.y = 20 + Math.sin(t * 0.8 * TWO_PI) * 10;
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
        for (const l of this.allLayers) l.setTint(0xffddff);
        this.telegraphRing = pulsingRing(
          this.scene,
          () => this.x,
          () => this.y,
          0xffddff,
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
        this.attacks[this.atkIndex].execute(this, this.fireFn, px, py);
        break;

      case 'firing':
        this.state      = 'pause';
        this.stateTimer = this.attacks[this.atkIndex].pause;
        this.atkIndex   = (this.atkIndex + 1) % this.attacks.length;
        break;

      case 'pause': {
        this.state      = 'idle';
        // Phase-appropriate idle time between attack cycles
        const idleTime = this.phase === 1 ? BALANCE.boss.phase1idle
          : this.phase === 2 ? BALANCE.boss.phase2idle
          : BALANCE.boss.phase3idle;
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

    if (this.phase === 1 && this.hp <= this.maxHp * BALANCE.boss.phase2at) this.enterPhase(2);
    else if (this.phase === 2 && this.hp <= this.maxHp * BALANCE.boss.phase3at) this.enterPhase(3);

    if (this.hp <= 0) this.die();
  }

  private enterPhase(p: BossPhase): void {
    this.phase    = p;
    this.atkIndex = 0;
    this.state    = 'idle';
    this.stateTimer = BALANCE.boss.phaseTransitionPause;
    this.attacks  = p === 2 ? PHASE2_ATTACKS : PHASE3_ATTACKS;

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

    shockwave(this.scene, this.x, this.y, p === 3 ? 0xff2266 : 0xff44cc, 320);

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
          tint: [0xff44aa, 0xffaaff, 0xffffff],
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

// ─── Miniboss — 3-layer rig (hair + body + gohei) ─────────────────────────
export class Miniboss {
  private container: Phaser.GameObjects.Container;
  private hairLayer:  Phaser.GameObjects.Image;
  private bodyLayer:  Phaser.GameObjects.Image;
  private goheiLayer: Phaser.GameObjects.Image;
  private allLayers:  Phaser.GameObjects.Image[];

  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive     = true;
  readonly hW = 50;
  readonly hH = 66;

  private atkTimer: number;
  private atkIndex  = 0;
  private flashTimer = 0;
  private animTime   = 0;
  private moveTimer = 0;
  private targetY: number;
  private readonly fire: BossFireFn;
  private readonly scene: Phaser.Scene;

  onDie?: () => void;

  constructor(scene: Phaser.Scene, fire: BossFireFn) {
    this.scene   = scene;
    this.fire    = fire;
    this.x       = W + 200;
    this.y       = H / 2;
    this.hp      = BALANCE.miniboss.hp;
    this.maxHp   = BALANCE.miniboss.hp;
    this.atkTimer = BALANCE.miniboss.attackTimer;
    this.targetY = H / 2;

    // ── Build 3-layer container (hair -> body -> gohei) ────────────────
    this.container = scene.add.container(this.x, this.y).setDepth(DEPTH.ENEMY);

    this.hairLayer  = scene.add.image(-180, -220, 'miniboss-hair').setScale(0.6);
    this.bodyLayer  = scene.add.image(0, 0, 'miniboss-body');
    this.goheiLayer = scene.add.image(-140, 60, 'miniboss-gohei').setScale(0.55);

    this.allLayers = [this.hairLayer, this.bodyLayer, this.goheiLayer];
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
    const mbHairBaseX = -180;
    const mbHairBaseY = -220;
    this.hairLayer.x = mbHairBaseX + Math.sin(t * 0.55 * TWO_PI) * 28;
    this.hairLayer.y = mbHairBaseY + Math.sin(t * 0.4 * TWO_PI) * 14;
    this.hairLayer.angle = Math.sin(t * 0.35 * TWO_PI) * 5;
    const mbGoheiBaseX = -140;
    const mbGoheiBaseY = 60;
    this.goheiLayer.angle = Math.sin(t * 1.2 * TWO_PI + 0.5) * 10;
    this.goheiLayer.x = mbGoheiBaseX + Math.sin(t * 0.9 * TWO_PI + 0.3) * 15;
    this.goheiLayer.y = mbGoheiBaseY + Math.sin(t * 0.7 * TWO_PI) * 8;

    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.doAttack(playerX, playerY);
    }
  }

  private doAttack(px: number, py: number): void {
    const mbSpd = BALANCE.bulletSpeed.base * BALANCE.miniboss.bulletSpeedMult;
    const patterns = [
      () => {
        // Aimed 3-shot fan
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.3;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd, Math.sin(a) * mbSpd, 1, 0x55ddff);
        }
        this.atkTimer = 0.8;
      },
      () => {
        // 8-shot ring
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.9, Math.sin(a) * mbSpd * 0.9, 1, 0x44ffee);
        }
        this.atkTimer = 1.5;
      },
      () => {
        // 5-shot wide aimed fan
        const base = Math.atan2(py - this.y, px - this.x);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.22;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 1.05, Math.sin(a) * mbSpd * 1.05, 1, 0x66eeff);
        }
        this.atkTimer = 1.0;
      },
      () => {
        // 12-shot ring + aimed shot — pressure combo
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          this.fire(this.x, this.y, Math.cos(a) * mbSpd * 0.8, Math.sin(a) * mbSpd * 0.8, 0.9, 0x55ccff);
        }
        const base = Math.atan2(py - this.y, px - this.x);
        this.fire(this.x, this.y, Math.cos(base) * mbSpd * 1.1, Math.sin(base) * mbSpd * 1.1, 1.2, 0x88eeff);
        this.atkTimer = 1.3;
      },
    ];
    patterns[this.atkIndex % patterns.length]();
    this.atkIndex++;
  }

  hit(dmg: number): void {
    if (!this.alive) return;
    this.hp -= dmg;
    for (const l of this.allLayers) l.setTint(0xffffff);
    this.flashTimer = 0.06;
    if (this.hp <= 0) this.die();
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
