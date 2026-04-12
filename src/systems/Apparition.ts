import Phaser from 'phaser';
import { W, H, DEPTH } from '../constants';
import type { BossFireFn } from './Boss';
import type { LaserFireFn } from './Laser';

const TWO_PI = Math.PI * 2;

// ═══════════════════════════════════════════════════════════════════════════════
// APPARITION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
//
// The "Harbinger" — the true final boss — periodically appears during each
// stage, clears all enemies, casts an elaborate bullet-hell pattern, then
// retreats. Each appearance uses a unique named spell card.
//
// Lifecycle:
//   ENTER  → fly in from right (1.2s)
//   CAST   → telegraph (0.6s), then execute spell pattern
//   ACTIVE → pattern plays out (3-6s, pattern-dependent)
//   EXIT   → fly out right (0.8s), then callback to resume waves
//
// The Apparition does NOT take damage and cannot be killed during these
// interludes. It's a pure dodge challenge.
// ═══════════════════════════════════════════════════════════════════════════════

export type ApparitionPhase = 'enter' | 'telegraph' | 'active' | 'exit' | 'done';

// ─── Spell Card definition ──────────────────────────────────────────────────
export interface SpellCard {
  /** Display name shown on HUD */
  name: string;
  /** Duration of the active pattern in seconds */
  duration: number;
  /** Execute the pattern — called once when transitioning to 'active' */
  execute: (app: Apparition, fire: BossFireFn, laserFire: LaserFireFn, px: number, py: number) => void;
}

// ─── VFX helpers ─────────────────────────────────────────────────────────────

function shockwave(scene: Phaser.Scene, x: number, y: number, color = 0xcc44ff, maxR = 300): void {
  const ring = scene.add.graphics().setDepth(DEPTH.FX);
  const tw = { progress: 0 };
  scene.tweens.add({
    targets: tw, progress: 1, duration: 500, ease: 'Sine.easeOut',
    onUpdate: () => {
      ring.clear();
      const r = maxR * tw.progress;
      ring.lineStyle(Phaser.Math.Linear(6, 1, tw.progress), color, 1 - tw.progress);
      ring.strokeCircle(x, y, r);
    },
    onComplete: () => ring.destroy(),
  });
}

// ─── Attack pattern helpers (standalone — don't require Boss instance) ───────

export function ringAt(fire: BossFireFn, cx: number, cy: number, count: number, speed: number, offset = 0, sc = 1, tint = 0xcc66ff): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TWO_PI + offset;
    fire(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, sc, tint);
  }
}

export function aimFanAt(fire: BossFireFn, cx: number, cy: number, px: number, py: number, count: number, spread: number, speed: number, tint = 0xcc66ff): void {
  const base = Math.atan2(py - cy, px - cx);
  const step = count > 1 ? spread / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const a = base - spread / 2 + step * i;
    fire(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, 1, tint);
  }
}

export function spiralStream(scene: Phaser.Scene, fire: BossFireFn, getX: () => number, getY: () => number, arms: number, bulletsPer: number, interval: number, speed: number, spinRate: number, tint = 0xcc66ff): void {
  let step = 0;
  const shoot = () => {
    const x = getX(), y = getY();
    for (let arm = 0; arm < arms; arm++) {
      const a = step * spinRate + (arm / arms) * TWO_PI;
      fire(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 1, tint);
    }
    step++;
    if (step < bulletsPer) scene.time.delayedCall(interval, shoot);
  };
  shoot();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Apparition class
// ═══════════════════════════════════════════════════════════════════════════════
export class Apparition {
  readonly scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private cloakLayer: Phaser.GameObjects.Image;
  private bodyLayer: Phaser.GameObjects.Image;
  private allLayers: Phaser.GameObjects.Image[];
  private glow: Phaser.GameObjects.Graphics;

  x: number;
  y: number;
  phase: ApparitionPhase = 'enter';
  private phaseTimer = 0;
  private animTime = 0;
  private spell: SpellCard;
  private fireFn: BossFireFn;
  private laserFireFn: LaserFireFn;
  private playerX = W / 2;
  private playerY = H / 2;

  // Spell card name display
  private spellLabel: Phaser.GameObjects.Text | null = null;
  private spellBg: Phaser.GameObjects.Rectangle | null = null;

  // Drift targets for gentle movement during active phase
  private driftTargetX: number;
  private driftTargetY: number;
  private driftTimer = 0;

  /** Called when the apparition has fully exited */
  onComplete?: () => void;

  // ─── ENTER position ────────────────────────────────────────────────────
  private static readonly HOME_X = W * 0.72;   // right-of-center
  private static readonly HOME_Y = H * 0.45;

  constructor(
    scene: Phaser.Scene,
    spell: SpellCard,
    fire: BossFireFn,
    laserFire: LaserFireFn,
  ) {
    this.scene = scene;
    this.spell = spell;
    this.fireFn = fire;
    this.laserFireFn = laserFire;

    this.x = W + 300;
    this.y = Apparition.HOME_Y;
    this.driftTargetX = Apparition.HOME_X;
    this.driftTargetY = Apparition.HOME_Y;

    const scale = 0.18;

    // Build 2-layer container: cloak behind, body front
    this.container = scene.add.container(this.x, this.y).setDepth(DEPTH.ENEMY);

    this.cloakLayer = scene.add.image(0, 0, 'harbinger-cloak').setScale(1.6);
    this.bodyLayer  = scene.add.image(0, 0, 'harbinger-body');
    this.allLayers  = [this.cloakLayer, this.bodyLayer];
    this.container.add(this.allLayers);
    this.container.setScale(0);

    // Ambient glow (deep violet/magenta)
    this.glow = scene.add.graphics().setDepth(DEPTH.ENEMY - 1);
    this.glow.fillStyle(0xaa22ff, 0.12);
    this.glow.fillCircle(0, 0, 220);
    this.glow.fillStyle(0x8800cc, 0.08);
    this.glow.fillCircle(0, 0, 160);
    this.glow.fillStyle(0xdd88ff, 0.06);
    this.glow.fillCircle(0, 0, 100);
    this.glow.setPosition(Apparition.HOME_X, Apparition.HOME_Y).setAlpha(0);

    // ── Entrance animation ──────────────────────────────────────────────
    // Dim the screen slightly
    const overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0x110022, 0.4)
      .setDepth(DEPTH.FX - 1);
    scene.tweens.add({
      targets: overlay, alpha: 0, duration: 1200, delay: 800,
      ease: 'Power2', onComplete: () => overlay.destroy(),
    });

    // Slide in from right
    scene.tweens.add({
      targets: this.container, x: Apparition.HOME_X,
      duration: 1200, ease: 'Power2.easeOut',
      onComplete: () => { this.x = Apparition.HOME_X; },
    });

    // Scale up with overshoot
    scene.tweens.add({
      targets: this.container,
      scaleX: -scale, scaleY: scale,
      duration: 900, ease: 'Back.easeOut',
    });

    // Glow fade in
    scene.tweens.add({
      targets: this.glow, alpha: 1,
      duration: 800, delay: 400, ease: 'Sine.easeOut',
    });
    // Glow pulse loop
    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.7, to: 1.0 },
      scaleX: { from: 1.0, to: 1.15 },
      scaleY: { from: 1.0, to: 1.15 },
      duration: 1400, delay: 1200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Entrance flash
    scene.time.delayedCall(700, () => {
      const flash = scene.add.circle(Apparition.HOME_X, Apparition.HOME_Y, 180, 0xffffff, 0.8)
        .setDepth(DEPTH.FX)
        .setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: flash, alpha: 0, scaleX: 3, scaleY: 3,
        duration: 350, ease: 'Power2',
        onComplete: () => flash.destroy(),
      });
      shockwave(scene, Apparition.HOME_X, Apparition.HOME_Y, 0xaa44ff, 300);
    });

    // Enter phase lasts 1.5s before telegraphing
    this.phase = 'enter';
    this.phaseTimer = 1.5;
  }

  update(dt: number, px: number, py: number): void {
    this.playerX = px;
    this.playerY = py;
    this.animTime += dt;

    // Secondary animation — cloak flutter & body bob
    const t = this.animTime;
    this.cloakLayer.y = Math.sin(t * 0.4 * TWO_PI) * 8;
    this.cloakLayer.angle = Math.sin(t * 0.25 * TWO_PI) * 6;
    this.bodyLayer.y = Math.sin(t * 0.6 * TWO_PI) * 4;

    // Drift movement during active phase
    if (this.phase === 'active' || this.phase === 'telegraph') {
      this.x = Phaser.Math.Linear(this.x, this.driftTargetX, 0.02);
      this.y = Phaser.Math.Linear(this.y, this.driftTargetY, 0.02);
      this.container.setPosition(this.x, this.y);
      this.glow.setPosition(this.x, this.y);

      this.driftTimer -= dt;
      if (this.driftTimer <= 0) {
        this.driftTimer = 2 + Math.random() * 2;
        this.driftTargetX = Phaser.Math.Between(Math.round(W * 0.55), Math.round(W * 0.85));
        this.driftTargetY = Phaser.Math.Between(200, H - 200);
      }
    }

    // Phase timer
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0) this.advancePhase();
  }

  private advancePhase(): void {
    switch (this.phase) {
      case 'enter':
        this.phase = 'telegraph';
        this.phaseTimer = 0.7;
        // Flash tint to indicate incoming attack
        for (const l of this.allLayers) l.setTint(0xffddff);
        // Show spell card name
        this.showSpellName();
        break;

      case 'telegraph':
        this.phase = 'active';
        this.phaseTimer = this.spell.duration;
        for (const l of this.allLayers) l.clearTint();
        // Execute the spell card pattern
        this.spell.execute(this, this.fireFn, this.laserFireFn, this.playerX, this.playerY);
        break;

      case 'active':
        this.phase = 'exit';
        this.phaseTimer = 1.0;
        this.beginExit();
        break;

      case 'exit':
        this.phase = 'done';
        this.destroy();
        this.onComplete?.();
        break;
    }
  }

  private showSpellName(): void {
    // Spell card banner — dramatic reveal from right
    const nameText = `✦ ${this.spell.name} ✦`;
    this.spellBg = this.scene.add.rectangle(W + 300, 90, 700, 52, 0x110022, 0.85)
      .setDepth(DEPTH.HUD + 1)
      .setStrokeStyle(2, 0xaa66ff, 0.7);

    this.spellLabel = this.scene.add.text(W + 300, 90, nameText, {
      fontFamily: '"Consolas", "SF Mono", monospace',
      fontSize: '28px',
      color: '#ddaaff',
      stroke: '#220044',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH.HUD + 2);

    // Slide in
    this.scene.tweens.add({
      targets: [this.spellBg, this.spellLabel],
      x: W / 2, duration: 400, ease: 'Power2.easeOut',
    });

    // Pulse the label
    this.scene.tweens.add({
      targets: this.spellLabel,
      alpha: { from: 0.7, to: 1 },
      scaleX: { from: 1.0, to: 1.05 },
      scaleY: { from: 1.0, to: 1.05 },
      duration: 600, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private beginExit(): void {
    // Hide spell name
    if (this.spellLabel) {
      this.scene.tweens.add({
        targets: [this.spellBg, this.spellLabel],
        x: W + 400, alpha: 0, duration: 400, ease: 'Power2.easeIn',
        onComplete: () => {
          this.spellLabel?.destroy();
          this.spellBg?.destroy();
          this.spellLabel = null;
          this.spellBg = null;
        },
      });
    }

    // Fly out to the right
    this.scene.tweens.add({
      targets: this.container,
      x: W + 400, duration: 800, ease: 'Power2.easeIn',
    });

    // Fade glow
    this.scene.tweens.add({
      targets: this.glow, alpha: 0, duration: 600, ease: 'Power2',
    });
  }

  destroy(): void {
    this.container?.destroy();
    this.glow?.destroy();
    this.spellLabel?.destroy();
    this.spellBg?.destroy();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 1 SPELL CARDS — 4 unique patterns for the Harbinger's Stage 1 visits
// ═══════════════════════════════════════════════════════════════════════════════

const S1_SPEED = 260;   // base bullet speed for stage 1 apparition patterns

export const STAGE1_SPELLS: SpellCard[] = [
  // ─── Spell 1: "Twilight Cascade" ─────────────────────────────────────────
  // Gentle introduction — alternating rings with gaps, offset each burst.
  // Safe zones rotate around the player. Teaches: watch for gaps, micro-dodge.
  {
    name: 'Twilight Cascade',
    duration: 5.0,
    execute(app, fire) {
      let step = 0;
      const burst = () => {
        if (app.phase !== 'active') return;
        // Alternating 12-ring and 10-ring, offset each time for rotating gaps
        const count = step % 2 === 0 ? 12 : 10;
        const speed = S1_SPEED * (0.8 + (step % 3) * 0.1);
        const offset = step * 0.35;
        ringAt(fire, app.x, app.y, count, speed, offset, 1, step % 2 === 0 ? 0xcc88ff : 0x88ccff);
        step++;
        if (step < 10) app.scene.time.delayedCall(450, burst);
      };
      app.scene.time.delayedCall(200, burst);
    },
  },

  // ─── Spell 2: "Astral Helix" ─────────────────────────────────────────────
  // Two interleaving spiral streams, aimed loosely at the player.
  // Creates a helical double-spiral that the player must weave through.
  {
    name: 'Astral Helix',
    duration: 5.5,
    execute(app, fire) {
      // Twin spirals, 2 arms each, opposite spin
      spiralStream(
        app.scene, fire,
        () => app.x, () => app.y,
        2, 30, 140, S1_SPEED * 0.9, 0.28, 0xbb66ff,
      );
      // Delayed second spiral, opposite rotation
      app.scene.time.delayedCall(600, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          2, 25, 160, S1_SPEED * 0.85, -0.32, 0x66bbff,
        );
      });
    },
  },

  // ─── Spell 3: "Stellar Curtain" ──────────────────────────────────────────
  // Aimed fans that sweep across the screen in waves, alternating from
  // the harbinger's position. Requires side-to-side movement.
  {
    name: 'Stellar Curtain',
    duration: 5.0,
    execute(app, fire, _lf, px, py) {
      let step = 0;
      const volley = () => {
        if (app.phase !== 'active') return;
        // Wide aimed fan — 7 bullets, alternating spread direction
        const spread = Math.PI * 0.6;
        const count = 7;
        const speed = S1_SPEED * (0.85 + step * 0.03);
        // Alternate between aimed at player and aimed at fixed angles
        if (step % 2 === 0) {
          aimFanAt(fire, app.x, app.y, px, py, count, spread, speed, 0xcc66ff);
        } else {
          // Offset fan aimed to the side of player — forces movement
          const baseAngle = Math.atan2(py - app.y, px - app.x);
          const sideOffset = step % 4 === 1 ? 0.4 : -0.4;
          for (let i = 0; i < count; i++) {
            const a = baseAngle + sideOffset - spread / 2 + (spread / (count - 1)) * i;
            fire(app.x, app.y, Math.cos(a) * speed, Math.sin(a) * speed, 1, 0x9966ff);
          }
        }
        // Additional ring burst every 3rd volley
        if (step % 3 === 2) {
          ringAt(fire, app.x, app.y, 8, S1_SPEED * 0.7, step * 0.5, 0.8, 0x88aaff);
        }
        step++;
        if (step < 12) app.scene.time.delayedCall(380, volley);
      };
      app.scene.time.delayedCall(200, volley);
    },
  },

  // ─── Spell 4: "Void Requiem" ─────────────────────────────────────────────
  // Grand climax spell — fast spinning rings + aimed streams converging.
  // Intense but always has narrow lanes to dodge through.
  {
    name: 'Void Requiem',
    duration: 6.0,
    execute(app, fire, _lf, px, py) {
      // Phase A: accelerating spiral (3 arms, 40 bullets, fast spin)
      spiralStream(
        app.scene, fire,
        () => app.x, () => app.y,
        3, 40, 120, S1_SPEED * 1.0, 0.22, 0xaa44ff,
      );

      // Phase B: aimed 5-fans every 500ms starting after 1s
      let aimStep = 0;
      const aimShoot = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 5, Math.PI / 4, S1_SPEED * 0.95, 0x66ccff);
        aimStep++;
        if (aimStep < 8) app.scene.time.delayedCall(500, aimShoot);
      };
      app.scene.time.delayedCall(1000, aimShoot);

      // Phase C: ring bursts every 800ms starting after 2s
      let ringStep = 0;
      const ringShoot = () => {
        if (app.phase !== 'active') return;
        ringAt(fire, app.x, app.y, 14, S1_SPEED * 0.85, ringStep * 0.4, 1, 0xdd88ff);
        ringStep++;
        if (ringStep < 5) app.scene.time.delayedCall(800, ringShoot);
      };
      app.scene.time.delayedCall(2000, ringShoot);
    },
  },
];
