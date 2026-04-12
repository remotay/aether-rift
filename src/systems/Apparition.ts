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

/** Fire a ring with speed variation — some bullets fast, some slow — creating layered walls */
export function layeredRing(fire: BossFireFn, cx: number, cy: number, count: number, slowSpeed: number, fastSpeed: number, offset = 0, tintSlow = 0x66ccff, tintFast = 0xcc66ff): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TWO_PI + offset;
    const speed = i % 2 === 0 ? fastSpeed : slowSpeed;
    const tint = i % 2 === 0 ? tintFast : tintSlow;
    fire(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, 1, tint);
  }
}

/** Fire a line of bullets at fixed angles (horizontal/vertical) to create grid-like walls */
export function bulletLine(fire: BossFireFn, cx: number, cy: number, angle: number, count: number, spacing: number, speed: number, tint = 0xcc66ff): void {
  const perpA = angle + Math.PI / 2;
  const startOffset = -(count - 1) / 2 * spacing;
  for (let i = 0; i < count; i++) {
    const ox = Math.cos(perpA) * (startOffset + i * spacing);
    const oy = Math.sin(perpA) * (startOffset + i * spacing);
    fire(cx + ox, cy + oy, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, tint);
  }
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
  // Phase 1: rings only. Phase 2: adds aimed fans. Phase 3: denser rings.
  {
    name: 'Twilight Cascade',
    duration: 15.0,
    execute(app, fire, _lf, px, py) {
      // Phase 1: gentle alternating rings (0-6s)
      let step = 0;
      const burst = () => {
        if (app.phase !== 'active') return;
        const count = step % 2 === 0 ? 12 : 10;
        const speed = S1_SPEED * (0.8 + (step % 3) * 0.1);
        const offset = step * 0.35;
        ringAt(fire, app.x, app.y, count, speed, offset, 1, step % 2 === 0 ? 0xcc88ff : 0x88ccff);
        step++;
        if (step < 30) app.scene.time.delayedCall(450, burst);
      };
      app.scene.time.delayedCall(200, burst);

      // Phase 2: aimed fans join in (after 5s)
      let aimStep = 0;
      const aimVolley = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 5, Math.PI / 3, S1_SPEED * 0.85, 0xaa88ff);
        aimStep++;
        if (aimStep < 10) app.scene.time.delayedCall(700, aimVolley);
      };
      app.scene.time.delayedCall(5000, aimVolley);

      // Phase 3: denser rings with faster rotation (after 10s)
      app.scene.time.delayedCall(10000, () => {
        if (app.phase !== 'active') return;
        let lateStep = 0;
        const lateBurst = () => {
          if (app.phase !== 'active') return;
          ringAt(fire, app.x, app.y, 14, S1_SPEED * 0.9, lateStep * 0.5, 1, 0xddaaff);
          lateStep++;
          if (lateStep < 10) app.scene.time.delayedCall(400, lateBurst);
        };
        lateBurst();
      });
    },
  },

  // ─── Spell 2: "Astral Helix" ─────────────────────────────────────────────
  // Twin spirals that evolve: Phase 1 = two spirals. Phase 2 = third spiral
  // joins. Phase 3 = ring bursts layered on top of spirals.
  {
    name: 'Astral Helix',
    duration: 15.5,
    execute(app, fire) {
      // Phase 1: twin spirals, opposite spin (0-5s)
      spiralStream(
        app.scene, fire,
        () => app.x, () => app.y,
        2, 60, 140, S1_SPEED * 0.9, 0.28, 0xbb66ff,
      );
      app.scene.time.delayedCall(600, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          2, 55, 160, S1_SPEED * 0.85, -0.32, 0x66bbff,
        );
      });

      // Phase 2: third spiral joins (after 5s)
      app.scene.time.delayedCall(5000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          3, 40, 150, S1_SPEED * 0.8, 0.2, 0x9944ff,
        );
      });

      // Phase 3: ring bursts layered on spirals (after 9s)
      let ringStep = 0;
      const ringBurst = () => {
        if (app.phase !== 'active') return;
        ringAt(fire, app.x, app.y, 10, S1_SPEED * 0.7, ringStep * 0.4, 0.9, 0xaa88ff);
        ringStep++;
        if (ringStep < 8) app.scene.time.delayedCall(700, ringBurst);
      };
      app.scene.time.delayedCall(9000, ringBurst);
    },
  },

  // ─── Spell 3: "Stellar Curtain" ──────────────────────────────────────────
  // Aimed fans sweep in waves. Phase 1: fans only. Phase 2: adds ring
  // accents. Phase 3: dual-source fans from offset positions.
  {
    name: 'Stellar Curtain',
    duration: 15.0,
    execute(app, fire, _lf, px, py) {
      // Phase 1 + 2: continuous aimed fans with escalation (0-15s)
      let step = 0;
      const volley = () => {
        if (app.phase !== 'active') return;
        const spread = Math.PI * 0.6;
        const count = step < 15 ? 7 : 9;  // more bullets later
        const speed = S1_SPEED * (0.85 + step * 0.015);
        if (step % 2 === 0) {
          aimFanAt(fire, app.x, app.y, px, py, count, spread, speed, 0xcc66ff);
        } else {
          const baseAngle = Math.atan2(py - app.y, px - app.x);
          const sideOffset = step % 4 === 1 ? 0.4 : -0.4;
          for (let i = 0; i < count; i++) {
            const a = baseAngle + sideOffset - spread / 2 + (spread / (count - 1)) * i;
            fire(app.x, app.y, Math.cos(a) * speed, Math.sin(a) * speed, 1, 0x9966ff);
          }
        }
        if (step % 3 === 2) {
          ringAt(fire, app.x, app.y, 8, S1_SPEED * 0.7, step * 0.5, 0.8, 0x88aaff);
        }
        step++;
        if (step < 30) app.scene.time.delayedCall(420, volley);
      };
      app.scene.time.delayedCall(200, volley);

      // Phase 3: dual-source offset fans (after 8s)
      let dualStep = 0;
      const dualFan = () => {
        if (app.phase !== 'active') return;
        const yOff = 160;
        aimFanAt(fire, app.x, app.y - yOff, px, py, 4, Math.PI / 4, S1_SPEED * 0.8, 0xbb88ff);
        aimFanAt(fire, app.x, app.y + yOff, px, py, 4, Math.PI / 4, S1_SPEED * 0.8, 0xbb88ff);
        dualStep++;
        if (dualStep < 7) app.scene.time.delayedCall(900, dualFan);
      };
      app.scene.time.delayedCall(8000, dualFan);
    },
  },

  // ─── Spell 4: "Void Requiem" ─────────────────────────────────────────────
  // Grand climax spell — 3 phases layered on top of each other.
  // Phase 1: spiral. Phase 2: aimed fans. Phase 3: dense ring finale.
  {
    name: 'Void Requiem',
    duration: 16.0,
    execute(app, fire, _lf, px, py) {
      // Phase A: long accelerating spiral (0-12s)
      spiralStream(
        app.scene, fire,
        () => app.x, () => app.y,
        3, 80, 120, S1_SPEED * 1.0, 0.22, 0xaa44ff,
      );

      // Phase B: aimed fans throughout (1-14s)
      let aimStep = 0;
      const aimShoot = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 5, Math.PI / 4, S1_SPEED * 0.95, 0x66ccff);
        aimStep++;
        if (aimStep < 22) app.scene.time.delayedCall(550, aimShoot);
      };
      app.scene.time.delayedCall(1000, aimShoot);

      // Phase C: ring bursts (2-14s)
      let ringStep = 0;
      const ringShoot = () => {
        if (app.phase !== 'active') return;
        ringAt(fire, app.x, app.y, 14, S1_SPEED * 0.85, ringStep * 0.4, 1, 0xdd88ff);
        ringStep++;
        if (ringStep < 14) app.scene.time.delayedCall(800, ringShoot);
      };
      app.scene.time.delayedCall(2000, ringShoot);

      // Phase D: second spiral opposite direction (after 7s)
      app.scene.time.delayedCall(7000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          3, 50, 130, S1_SPEED * 0.9, -0.25, 0x8844ff,
        );
      });

      // Phase E: dense finale rings (after 12s)
      app.scene.time.delayedCall(12000, () => {
        if (app.phase !== 'active') return;
        let finaleStep = 0;
        const finale = () => {
          if (app.phase !== 'active') return;
          ringAt(fire, app.x, app.y, 16, S1_SPEED * 0.75, finaleStep * 0.3, 1, 0xeeccff);
          finaleStep++;
          if (finaleStep < 6) app.scene.time.delayedCall(500, finale);
        };
        finale();
      });
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 2 SPELL CARDS — "Clockwork Abyss" — mechanical, precise, gear-like
// ═══════════════════════════════════════════════════════════════════════════════

const S2_SPEED = 290;

export const STAGE2_SPELLS: SpellCard[] = [
  // ─── Spell 1: "Clockwork Mandala" ──────────────────────────────────────────
  // Phase 1: counter-rotating rings. Phase 2: adds aimed snipes.
  // Phase 3: triple-layer rings with tighter gaps.
  {
    name: 'Clockwork Mandala',
    duration: 15.5,
    execute(app, fire, _lf, px, py) {
      // Phase 1: counter-rotating ring bursts throughout (0-15s)
      let step = 0;
      const burst = () => {
        if (app.phase !== 'active') return;
        const cwOffset = step * 0.3;
        ringAt(fire, app.x, app.y, 16, S2_SPEED * 0.85, cwOffset, 1, 0x00ccdd);
        app.scene.time.delayedCall(120, () => {
          if (app.phase !== 'active') return;
          const ccwOffset = -step * 0.35 + Math.PI / 14;
          ringAt(fire, app.x, app.y, 14, S2_SPEED * 0.7, ccwOffset, 0.9, 0x44ffcc);
        });
        step++;
        if (step < 30) app.scene.time.delayedCall(450, burst);
      };
      app.scene.time.delayedCall(200, burst);

      // Phase 2: aimed snipes (after 5s)
      let aimStep = 0;
      const aimSnipe = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 3, Math.PI / 8, S2_SPEED * 1.1, 0x88ffee);
        aimStep++;
        if (aimStep < 12) app.scene.time.delayedCall(650, aimSnipe);
      };
      app.scene.time.delayedCall(5000, aimSnipe);

      // Phase 3: triple-layer denser rings (after 10s)
      app.scene.time.delayedCall(10000, () => {
        if (app.phase !== 'active') return;
        let lateStep = 0;
        const lateBurst = () => {
          if (app.phase !== 'active') return;
          ringAt(fire, app.x, app.y, 18, S2_SPEED * 0.6, lateStep * 0.22, 1, 0x22eedd);
          lateStep++;
          if (lateStep < 10) app.scene.time.delayedCall(450, lateBurst);
        };
        lateBurst();
      });
    },
  },

  // ─── Spell 2: "Abyssal Gears" ─────────────────────────────────────────────
  // Phase 1: two interlocking spirals. Phase 2: aimed fans.
  // Phase 3: third spiral + ring accents.
  {
    name: 'Abyssal Gears',
    duration: 16.0,
    execute(app, fire, _lf, px, py) {
      // Phase 1: Gear A — 4-arm spiral, fast spin (0-10s)
      spiralStream(
        app.scene, fire,
        () => app.x, () => app.y,
        4, 65, 130, S2_SPEED * 0.85, 0.24, 0x00aacc,
      );
      // Gear B — 3-arm spiral, opposite dir (0.8-10s)
      app.scene.time.delayedCall(800, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          3, 55, 150, S2_SPEED * 0.75, -0.18, 0x44ddaa,
        );
      });

      // Phase 2: aimed snipe fans (1.2-14s)
      let aimStep = 0;
      const aimFan = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 3, Math.PI / 6, S2_SPEED * 1.1, 0x88ffee);
        aimStep++;
        if (aimStep < 18) app.scene.time.delayedCall(700, aimFan);
      };
      app.scene.time.delayedCall(1200, aimFan);

      // Phase 3: third gear + rings (after 8s)
      app.scene.time.delayedCall(8000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          2, 40, 140, S2_SPEED * 0.7, 0.3, 0x00ddff,
        );
      });
      let ringStep = 0;
      const ringAccent = () => {
        if (app.phase !== 'active') return;
        ringAt(fire, app.x, app.y, 12, S2_SPEED * 0.6, ringStep * 0.4, 0.9, 0x66ffdd);
        ringStep++;
        if (ringStep < 7) app.scene.time.delayedCall(900, ringAccent);
      };
      app.scene.time.delayedCall(10000, ringAccent);
    },
  },

  // ─── Spell 3: "Temporal Fracture" ─────────────────────────────────────────
  // Phase 1: layered speed rings. Phase 2: aimed tracking. Phase 3: dense
  // converging ring finale with cross-streams.
  {
    name: 'Temporal Fracture',
    duration: 16.5,
    execute(app, fire, _lf, px, py) {
      // Phase 1: layered speed rings throughout (0-12s)
      let ringStep = 0;
      const layered = () => {
        if (app.phase !== 'active') return;
        const offset = ringStep * 0.25;
        ringAt(fire, app.x, app.y, 12, S2_SPEED * 1.1, offset, 1, 0x00ccff);
        ringAt(fire, app.x, app.y, 12, S2_SPEED * 0.55, offset + 0.15, 0.8, 0x88eeff);
        app.scene.time.delayedCall(180, () => {
          if (app.phase !== 'active') return;
          ringAt(fire, app.x, app.y, 10, S2_SPEED * 0.8, offset + Math.PI / 10, 0.9, 0x44ddcc);
        });
        ringStep++;
        if (ringStep < 22) app.scene.time.delayedCall(550, layered);
      };
      app.scene.time.delayedCall(200, layered);

      // Phase 2: aimed tracking streams (1.5-14s)
      let trackStep = 0;
      const track = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 5, Math.PI / 5, S2_SPEED * 0.95, 0xaaffdd);
        trackStep++;
        if (trackStep < 15) app.scene.time.delayedCall(800, track);
      };
      app.scene.time.delayedCall(1500, track);

      // Phase 3: cross-streams + dense finale (after 10s)
      let crossStep = 0;
      const cross = () => {
        if (app.phase !== 'active') return;
        const yOff = 180;
        aimFanAt(fire, app.x, app.y - yOff, px, py, 4, Math.PI / 5, S2_SPEED * 0.85, 0x66ffcc);
        aimFanAt(fire, app.x, app.y + yOff, px, py, 4, Math.PI / 5, S2_SPEED * 0.85, 0x66ffcc);
        crossStep++;
        if (crossStep < 6) app.scene.time.delayedCall(900, cross);
      };
      app.scene.time.delayedCall(10000, cross);
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 3 SPELL CARDS — "Shattered Eden" — organic, splitting, chaotic
// ═══════════════════════════════════════════════════════════════════════════════

const S3_SPEED = 310;

export const STAGE3_SPELLS: SpellCard[] = [
  // ─── Spell 1: "Bloom Spiral" ──────────────────────────────────────────────
  // Phase 1: spiral + bloom bursts. Phase 2: second spiral joins.
  // Phase 3: dense bloom bursts + aimed fans.
  {
    name: 'Bloom Spiral',
    duration: 16.0,
    execute(app, fire, _lf, px, py) {
      // Phase 1: base spiral (0-16s)
      spiralStream(
        app.scene, fire,
        () => app.x, () => app.y,
        3, 80, 130, S3_SPEED * 0.8, 0.26, 0xff66aa,
      );

      // Bloom bursts throughout (0.5-14s)
      let bloomStep = 0;
      const bloom = () => {
        if (app.phase !== 'active') return;
        const count = 18 + bloomStep * 1;
        const offset = bloomStep * 0.45;
        ringAt(fire, app.x, app.y, count, S3_SPEED * (0.6 + bloomStep * 0.04), offset, 1,
          bloomStep % 2 === 0 ? 0xff88cc : 0x88ff66);
        bloomStep++;
        if (bloomStep < 12) app.scene.time.delayedCall(1100, bloom);
      };
      app.scene.time.delayedCall(500, bloom);

      // Phase 2: second counter-spiral (after 5s)
      app.scene.time.delayedCall(5000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          2, 50, 150, S3_SPEED * 0.7, -0.22, 0xaa44ff,
        );
      });

      // Phase 3: aimed fans (after 9s)
      let aimStep = 0;
      const aimFan = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 5, Math.PI / 3, S3_SPEED * 0.85, 0xff44aa);
        aimStep++;
        if (aimStep < 8) app.scene.time.delayedCall(750, aimFan);
      };
      app.scene.time.delayedCall(9000, aimFan);
    },
  },

  // ─── Spell 2: "Thorn Lattice" ─────────────────────────────────────────────
  // Phase 1: alternating bullet walls. Phase 2: adds ring accents.
  // Phase 3: adds aimed fans from offset positions.
  {
    name: 'Thorn Lattice',
    duration: 16.5,
    execute(app, fire, _lf, px, py) {
      // Phase 1+2: continuous lattice weave (0-15s)
      let step = 0;
      const weave = () => {
        if (app.phase !== 'active') return;
        if (step % 2 === 0) {
          const yPositions = [0.2, 0.4, 0.6, 0.8];
          const yOff = (step * 37) % 60 - 30;
          for (const yRatio of yPositions) {
            const y = H * yRatio + yOff;
            bulletLine(fire, app.x, y, Math.PI, 5, 50, S3_SPEED * 0.75, 0x66ff88);
          }
        } else {
          const angles = [-0.4, -0.15, 0.15, 0.4];
          for (const aOff of angles) {
            const a = Math.PI + aOff + step * 0.12;
            for (let j = 0; j < 3; j++) {
              const speed = S3_SPEED * (0.65 + j * 0.15);
              fire(app.x, app.y, Math.cos(a) * speed, Math.sin(a) * speed, 1, 0xccff44);
            }
          }
        }
        if (step % 3 === 0) {
          ringAt(fire, app.x, app.y, 10, S3_SPEED * 0.5, step * 0.3, 0.8, 0xaaff88);
        }
        step++;
        if (step < 35) app.scene.time.delayedCall(400, weave);
      };
      app.scene.time.delayedCall(200, weave);

      // Phase 2: spiral from offset (after 6s)
      app.scene.time.delayedCall(6000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          2, 40, 160, S3_SPEED * 0.6, 0.2, 0x88ffaa,
        );
      });

      // Phase 3: aimed fans from offset positions (after 10s)
      let aimStep = 0;
      const aimDual = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y - 150, px, py, 4, Math.PI / 4, S3_SPEED * 0.8, 0xddff44);
        aimFanAt(fire, app.x, app.y + 150, px, py, 4, Math.PI / 4, S3_SPEED * 0.8, 0xddff44);
        aimStep++;
        if (aimStep < 7) app.scene.time.delayedCall(850, aimDual);
      };
      app.scene.time.delayedCall(10000, aimDual);
    },
  },

  // ─── Spell 3: "Overgrown Cascade" ─────────────────────────────────────────
  // Phase 1: escalating aimed fans. Phase 2: twin offset spirals.
  // Phase 3: dense ring bursts + triple spiral climax.
  {
    name: 'Overgrown Cascade',
    duration: 17.0,
    execute(app, fire, _lf, px, py) {
      // Phase 1: escalating aimed fans (0-12s)
      let fanStep = 0;
      const cascade = () => {
        if (app.phase !== 'active') return;
        const count = 5 + Math.floor(fanStep / 3);
        const spread = Math.PI * (0.4 + fanStep * 0.02);
        const speed = S3_SPEED * (0.8 + fanStep * 0.025);
        aimFanAt(fire, app.x, app.y, px, py, count, spread, speed,
          fanStep % 2 === 0 ? 0xff44aa : 0x44ffaa);
        fanStep++;
        if (fanStep < 25) app.scene.time.delayedCall(450, cascade);
      };
      app.scene.time.delayedCall(200, cascade);

      // Phase 2: offset spirals (after 4s)
      app.scene.time.delayedCall(4000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y - 180,
          2, 45, 160, S3_SPEED * 0.7, 0.3, 0xddff66,
        );
      });
      app.scene.time.delayedCall(6000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y + 180,
          2, 40, 170, S3_SPEED * 0.65, -0.28, 0x88ff44,
        );
      });

      // Phase 3: dense ring finale (after 11s)
      let ringStep = 0;
      const ringFinale = () => {
        if (app.phase !== 'active') return;
        ringAt(fire, app.x, app.y, 16 + ringStep, S3_SPEED * (0.5 + ringStep * 0.05),
          ringStep * 0.35, 1, 0xff88dd);
        ringStep++;
        if (ringStep < 8) app.scene.time.delayedCall(600, ringFinale);
      };
      app.scene.time.delayedCall(11000, ringFinale);

      // Phase 3b: third spiral center (after 12s)
      app.scene.time.delayedCall(12000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          3, 30, 140, S3_SPEED * 0.75, 0.2, 0xffaa66,
        );
      });
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 4 SPELL CARDS — "Celestial Rift" — cosmic, overwhelming, ultimate
// ═══════════════════════════════════════════════════════════════════════════════

const S4_SPEED = 330;

export const STAGE4_SPELLS: SpellCard[] = [
  // ─── Spell 1: "Stellar Convergence" ───────────────────────────────────────
  // Phase 1: spiral + rings. Phase 2: aimed fans. Phase 3: second spiral
  // + denser rings. Phase 4: finale burst.
  {
    name: 'Stellar Convergence',
    duration: 16.5,
    execute(app, fire, _lf, px, py) {
      // Phase 1: converging spirals (0-14s)
      spiralStream(
        app.scene, fire,
        () => app.x, () => app.y,
        5, 85, 120, S4_SPEED * 0.85, 0.2, 0xffcc44,
      );

      // Dense ring bursts throughout (0.4-14s)
      let ringStep = 0;
      const ringBurst = () => {
        if (app.phase !== 'active') return;
        ringAt(fire, app.x, app.y, 18, S4_SPEED * 0.7, ringStep * 0.35, 1, 0xffffaa);
        ringStep++;
        if (ringStep < 22) app.scene.time.delayedCall(600, ringBurst);
      };
      app.scene.time.delayedCall(400, ringBurst);

      // Phase 2: aimed fans (1-15s)
      let aimStep = 0;
      const aimed = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 7, Math.PI / 3, S4_SPEED * 1.0, 0xffaa00);
        aimStep++;
        if (aimStep < 16) app.scene.time.delayedCall(800, aimed);
      };
      app.scene.time.delayedCall(1000, aimed);

      // Phase 3: second counter-spiral (after 7s)
      app.scene.time.delayedCall(7000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          4, 50, 130, S4_SPEED * 0.75, -0.22, 0xffee88,
        );
      });

      // Phase 4: finale dense rings (after 13s)
      app.scene.time.delayedCall(13000, () => {
        if (app.phase !== 'active') return;
        let fStep = 0;
        const finale = () => {
          if (app.phase !== 'active') return;
          ringAt(fire, app.x, app.y, 22, S4_SPEED * 0.6, fStep * 0.25, 1, 0xffffff);
          fStep++;
          if (fStep < 5) app.scene.time.delayedCall(500, finale);
        };
        finale();
      });
    },
  },

  // ─── Spell 2: "Cosmic Annihilation" ───────────────────────────────────────
  // Phase 1: dense rings + spiral. Phase 2: counter-spiral + aimed.
  // Phase 3: cross-streams. Phase 4: ultimate density.
  {
    name: 'Cosmic Annihilation',
    duration: 17.0,
    execute(app, fire, _lf, px, py) {
      // Phase 1: dense rings throughout (0-15s)
      let ringStep = 0;
      const denseRings = () => {
        if (app.phase !== 'active') return;
        ringAt(fire, app.x, app.y, 20, S4_SPEED * 0.65, ringStep * 0.28, 1,
          ringStep % 2 === 0 ? 0xffdd44 : 0xff8800);
        ringStep++;
        if (ringStep < 28) app.scene.time.delayedCall(500, denseRings);
      };
      app.scene.time.delayedCall(200, denseRings);

      // Phase 1b: first spiral (0-10s)
      spiralStream(
        app.scene, fire,
        () => app.x, () => app.y,
        3, 65, 140, S4_SPEED * 0.8, 0.22, 0xffcc00,
      );

      // Phase 2: counter-spiral (after 3s)
      app.scene.time.delayedCall(3000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          3, 55, 150, S4_SPEED * 0.75, -0.26, 0xffee88,
        );
      });

      // Phase 2b: aimed fans (1.5-15s)
      let aimStep = 0;
      const trackFan = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 5, Math.PI / 4, S4_SPEED * 1.05, 0xffffff);
        aimStep++;
        if (aimStep < 18) app.scene.time.delayedCall(750, trackFan);
      };
      app.scene.time.delayedCall(1500, trackFan);

      // Phase 3: cross-streams (after 8s)
      let crossStep = 0;
      const cross = () => {
        if (app.phase !== 'active') return;
        const yOff = 200;
        aimFanAt(fire, app.x, app.y - yOff, px, py, 4, Math.PI / 5, S4_SPEED * 0.9, 0xffddaa);
        aimFanAt(fire, app.x, app.y + yOff, px, py, 4, Math.PI / 5, S4_SPEED * 0.9, 0xffddaa);
        crossStep++;
        if (crossStep < 8) app.scene.time.delayedCall(800, cross);
      };
      app.scene.time.delayedCall(8000, cross);

      // Phase 4: third spiral (after 12s)
      app.scene.time.delayedCall(12000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          4, 30, 120, S4_SPEED * 0.85, 0.3, 0xffaa44,
        );
      });
    },
  },

  // ─── Spell 3: "Event Horizon" ─────────────────────────────────────────────
  // The ultimate spell. Phase 1: layered speed rings. Phase 2: gravity
  // spiral. Phase 3: cross-pincer streams. Phase 4: dense ring finale.
  {
    name: 'Event Horizon',
    duration: 17.5,
    execute(app, fire, _lf, px, py) {
      // Phase 1: layered speed rings throughout (0-14s)
      let layerStep = 0;
      const layers = () => {
        if (app.phase !== 'active') return;
        layeredRing(fire, app.x, app.y, 20,
          S4_SPEED * 0.5, S4_SPEED * 1.1,
          layerStep * 0.3, 0xffee66, 0xff6600);
        layerStep++;
        if (layerStep < 24) app.scene.time.delayedCall(550, layers);
      };
      app.scene.time.delayedCall(200, layers);

      // Phase 2: gravity well spiral (0-16s)
      spiralStream(
        app.scene, fire,
        () => app.x, () => app.y,
        6, 100, 110, S4_SPEED * 0.9, 0.18, 0xffaa44,
      );

      // Phase 3: cross-streams (2-14s)
      let crossStep = 0;
      const cross = () => {
        if (app.phase !== 'active') return;
        const yOff = 200;
        aimFanAt(fire, app.x, app.y - yOff, px, py, 4, Math.PI / 5, S4_SPEED * 0.9, 0xffddaa);
        aimFanAt(fire, app.x, app.y + yOff, px, py, 4, Math.PI / 5, S4_SPEED * 0.9, 0xffddaa);
        crossStep++;
        if (crossStep < 14) app.scene.time.delayedCall(900, cross);
      };
      app.scene.time.delayedCall(2000, cross);

      // Phase 4: counter-spiral (after 6s)
      app.scene.time.delayedCall(6000, () => {
        if (app.phase !== 'active') return;
        spiralStream(
          app.scene, fire,
          () => app.x, () => app.y,
          4, 60, 120, S4_SPEED * 0.8, -0.22, 0xffcc88,
        );
      });

      // Phase 5: aimed fans (after 8s)
      let aimStep = 0;
      const aimFan = () => {
        if (app.phase !== 'active') return;
        aimFanAt(fire, app.x, app.y, px, py, 7, Math.PI / 3, S4_SPEED * 1.0, 0xffffff);
        aimStep++;
        if (aimStep < 10) app.scene.time.delayedCall(800, aimFan);
      };
      app.scene.time.delayedCall(8000, aimFan);

      // Phase 6: finale dense burst (after 14s)
      app.scene.time.delayedCall(14000, () => {
        if (app.phase !== 'active') return;
        let fStep = 0;
        const finale = () => {
          if (app.phase !== 'active') return;
          ringAt(fire, app.x, app.y, 24, S4_SPEED * 0.6, fStep * 0.25, 1, 0xffffff);
          app.scene.time.delayedCall(200, () => {
            if (app.phase !== 'active') return;
            ringAt(fire, app.x, app.y, 24, S4_SPEED * 0.55, fStep * 0.25 + Math.PI / 24, 1, 0xffcc88);
          });
          fStep++;
          if (fStep < 6) app.scene.time.delayedCall(500, finale);
        };
        finale();
      });
    },
  },
];
