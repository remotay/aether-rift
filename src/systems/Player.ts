import Phaser from 'phaser';
import {
  W, H, DEPTH,
  PLAYER_SPEED, PLAYER_FOCUS_SPEED,
  SHOOT_INTERVAL,
  HITBOX_R, GRAZE_R,
  IFRAMES, BOMB_DURATION,
  START_LIVES, START_BOMBS,
} from '../constants';
import { BALANCE, getPlayerDamage, getPowerLevel } from '../balance';

export type FireFn  = (x: number, y: number, power: number, focused: boolean) => void;
export type BombFn  = () => void;

// ═════════════════════════════════════════════════════════════════════════════
// CENTRALIZED MOTION TUNING — adjust any value to change animation feel
// ═════════════════════════════════════════════════════════════════════════════

const TWO_PI = Math.PI * 2;

export const PLAYER_MOTION = {
  /** Base display scale for the container (shared-crop layers fill 1024×1024) */
  baseScale: 0.049,

  /** Idle vertical bob (whole character, always active) */
  idleBob: { amp: 2.5, freq: 0.85 },

  // ── CUTOUT LAYER CONFIGS ──────────────────────────────────────────────
  // Hair, body, skirt share the same crop region → all at (0,0).
  // Ribbon is a standalone generation → needs manual offset.

  /** Body core — head with bangs + torso + white haori (static anchor) */
  body: { localScale: 1.0 },

  /** Flowing back hair — behind body, ambient drift + movement lag */
  hair: {
    localScale: 1.0,
    drift: {
      ampX: 28, ampY: 14,
      freqX: 0.75, freqY: 0.55,
      phase: 0,
    },
  },

  /** Red hakama skirt — subtle sway from the waist */
  skirt: {
    localScale: 1.0,
    sway: {
      ampRot: 3.5,    // degrees of rotation
      ampX: 6,
      ampY: 4,
      freqRot: 0.85,
      freqY: 1.1,
      phase: 0.3,
    },
  },

  /** Big Touhou-style red ribbon — on top of head, animated flutter */
  ribbon: {
    localScale: 0.32,
    offsetX: 60,        // tuned: sits on top of head
    offsetY: -380,      // tuned: above the head
    flutter: {
      ampRot: 8.0,      // degrees of rotation flutter
      ampX: 10,
      ampY: 12,
      freqRot: 2.0,
      freqY: 1.3,
      phase: 0.7,
    },
  },

  /** State multipliers for all secondary motion */
  states: {
    idle:   1.0  as number,
    moving: 1.8  as number,
    focus:  0.25 as number,
    hit:    0.0  as number,
  },

  /** Movement-reactive lag (local-space pixels per dx/dy unit) */
  moveLag: { hair: 50, skirt: 20, ribbon: 35 },

  /** Tilt (degrees) */
  tiltH:    12,
  tiltV:    4,
  tiltLerp: 0.16,

  /** Squash & stretch */
  squash: {
    hStretch: 0.07,
    hSquash:  0.04,
    vStretch: 0.07,
    vSquash:  0.02,
    lerp:     0.18,
  },

  /** Thruster offset from center (world-space pixels) */
  thrusterOff: -10,

  /** Trail ghost settings */
  trail: {
    count:    5,
    interval: 0.048,
    alpha:    0.17,
    fadeDur:  190,
    tint:     0x99bbff,
  },
};

type AnimState = 'idle' | 'moving' | 'focus' | 'hit';

// ═════════════════════════════════════════════════════════════════════════════
// PLAYER CLASS — 4-layer cutout rig (hair + body + skirt + ribbon)
// ═════════════════════════════════════════════════════════════════════════════

export class Player {
  readonly scene: Phaser.Scene;

  // ── Layered container (back→front: hair → body → skirt → ribbon) ──
  private container: Phaser.GameObjects.Container;
  private hairLayer!:   Phaser.GameObjects.Image;
  private bodyLayer!:   Phaser.GameObjects.Image;
  private skirtLayer!:  Phaser.GameObjects.Image;
  private ribbonLayer!: Phaser.GameObjects.Image;
  private allLayers:    Phaser.GameObjects.Image[] = [];

  // ── FX objects (outside container, world space) ───────────────────────
  private hitGfx:            Phaser.GameObjects.Graphics;
  private thrusterOuter!:    Phaser.GameObjects.Graphics;
  private thrusterInner!:    Phaser.GameObjects.Graphics;
  private thrusterCore!:     Phaser.GameObjects.Graphics;
  private thrusterOuterTw!:  Phaser.Tweens.Tween;
  private thrusterInnerTw!:  Phaser.Tweens.Tween;
  private thrusterCoreTw!:   Phaser.Tweens.Tween;
  private focusRing!:        Phaser.GameObjects.Image;
  private focusGlow!:        Phaser.GameObjects.Graphics;
  private focusGlowTw!:      Phaser.Tweens.Tween;
  private focusRingRotTw!:   Phaser.Tweens.Tween;
  private trailGhosts:       Phaser.GameObjects.Image[] = [];
  private trailTimer = 0;

  // ── Animation ─────────────────────────────────────────────────────────
  private animTime  = 0;
  private animState: AnimState = 'idle';
  private smoothDx  = 0;
  private smoothDy  = 0;

  // ── Game state (public API) ───────────────────────────────────────────
  x = 0;
  y = 0;
  lives:      number;
  bombs:      number;
  power       = 0;
  invincible  = false;
  bombActive  = false;
  dead        = false;
  frozen      = false;

  private iTimer     = 0;
  private bombTimer  = 0;
  private shootTimer = 0;

  // ── Input ─────────────────────────────────────────────────────────────
  private up!:    Phaser.Input.Keyboard.Key;
  private down!:  Phaser.Input.Keyboard.Key;
  private left!:  Phaser.Input.Keyboard.Key;
  private right!: Phaser.Input.Keyboard.Key;
  private wKey!:  Phaser.Input.Keyboard.Key;
  private sKey!:  Phaser.Input.Keyboard.Key;
  private aKey!:  Phaser.Input.Keyboard.Key;
  private dKey!:  Phaser.Input.Keyboard.Key;
  private zKey!:  Phaser.Input.Keyboard.Key;
  private xKey!:  Phaser.Input.Keyboard.Key;
  private shift!: Phaser.Input.Keyboard.Key;

  private onFire: FireFn;
  private onBomb: BombFn;

  constructor(scene: Phaser.Scene, x: number, y: number, onFire: FireFn, onBomb: BombFn) {
    this.scene  = scene;
    this.x      = x;
    this.y      = y;
    this.lives  = START_LIVES;
    this.bombs  = START_BOMBS;
    this.onFire = onFire;
    this.onBomb = onBomb;

    const M = PLAYER_MOTION;

    // ── Build layered Container (4-piece cutout paper-doll) ────────────
    this.container = scene.add.container(x, y).setDepth(DEPTH.PLAYER);

    // Layer 1 (behind): flowing back hair — co-aligned with body
    this.hairLayer = scene.add.image(0, 0, 'player-hair')
      .setScale(M.hair.localScale);

    // Layer 2 (center): head + bangs + torso + haori — the static anchor
    this.bodyLayer = scene.add.image(0, 0, 'player-body')
      .setScale(M.body.localScale);

    // Layer 3: red hakama skirt — co-aligned, animated sway
    this.skirtLayer = scene.add.image(0, 0, 'player-skirt')
      .setScale(M.skirt.localScale);

    // Layer 4 (front): big red ribbon — standalone, manual offset
    this.ribbonLayer = scene.add.image(M.ribbon.offsetX, M.ribbon.offsetY, 'player-ribbon')
      .setScale(M.ribbon.localScale);

    // Back-to-front order: hair → body → skirt → ribbon
    this.allLayers = [this.hairLayer, this.bodyLayer, this.skirtLayer, this.ribbonLayer];
    this.container.add(this.allLayers);
    this.container.setScale(M.baseScale);

    // ── Hitbox graphics ────────────────────────────────────────────────
    this.hitGfx = scene.add.graphics().setDepth(DEPTH.PLAYER + 1);

    // ── Engine/thruster glow (multi-layered) ───────────────────────────
    this.thrusterOuter = scene.add.graphics().setDepth(DEPTH.PLAYER - 1);
    this.thrusterOuter.fillStyle(0x44ccff, 0.15);
    this.thrusterOuter.fillCircle(0, 0, 20);
    this.thrusterOuter.setPosition(x + M.thrusterOff, y);
    this.thrusterOuterTw = scene.tweens.add({
      targets: this.thrusterOuter,
      alpha: { from: 0.25, to: 0.08 },
      scaleX: { from: 1.3, to: 0.8 }, scaleY: { from: 1.0, to: 0.7 },
      duration: 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.thrusterInner = scene.add.graphics().setDepth(DEPTH.PLAYER - 1);
    this.thrusterInner.fillStyle(0xaaeeff, 0.5);
    this.thrusterInner.fillCircle(0, 0, 8);
    this.thrusterInner.setPosition(x + M.thrusterOff, y);
    this.thrusterInnerTw = scene.tweens.add({
      targets: this.thrusterInner,
      alpha: { from: 0.6, to: 0.25 },
      scaleX: { from: 1.2, to: 0.7 }, scaleY: { from: 1.0, to: 0.8 },
      duration: 220, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.thrusterCore = scene.add.graphics().setDepth(DEPTH.PLAYER - 1);
    this.thrusterCore.fillStyle(0xffffff, 0.7);
    this.thrusterCore.fillCircle(0, 0, 4);
    this.thrusterCore.setPosition(x + M.thrusterOff, y);
    this.thrusterCoreTw = scene.tweens.add({
      targets: this.thrusterCore,
      alpha: { from: 0.8, to: 0.4 },
      scaleX: { from: 1.0, to: 0.6 }, scaleY: { from: 1.0, to: 0.8 },
      duration: 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Focus mode ring + glow ─────────────────────────────────────────
    this.focusRing = scene.add.image(x, y, 'graze-ring')
      .setDepth(DEPTH.PLAYER + 2).setScale(0.5).setAlpha(0.6).setVisible(false);
    this.focusRingRotTw = scene.tweens.add({
      targets: this.focusRing, angle: 360,
      duration: 2400, repeat: -1, ease: 'Linear',
    });

    this.focusGlow = scene.add.graphics().setDepth(DEPTH.PLAYER - 1);
    this.focusGlow.fillStyle(0x88ddff, 0.18);
    this.focusGlow.fillCircle(0, 0, 48);
    this.focusGlow.fillStyle(0xaaeeff, 0.10);
    this.focusGlow.fillCircle(0, 0, 32);
    this.focusGlow.setPosition(x, y).setVisible(false);
    this.focusGlowTw = scene.tweens.add({
      targets: this.focusGlow,
      alpha: { from: 0.7, to: 0.3 },
      scaleX: { from: 1.0, to: 1.15 }, scaleY: { from: 1.0, to: 1.15 },
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Movement trail ghost pool (uses body texture) ──────────────────
    for (let i = 0; i < M.trail.count; i++) {
      this.trailGhosts.push(
        scene.add.image(x, y, 'player-body')
          .setDepth(DEPTH.PLAYER - 2)
          .setScale(M.baseScale)
          .setAlpha(0)
          .setTint(M.trail.tint)
          .setBlendMode(Phaser.BlendModes.ADD),
      );
    }

    // ── Input bindings ─────────────────────────────────────────────────
    const kb = scene.input.keyboard!;
    this.up    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.down  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.left  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.right = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.wKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.sKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.aKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.dKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.zKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.xKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.shift = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════════════

  update(dt: number): void {
    if (this.dead) return;

    const M = PLAYER_MOTION;
    this.animTime += dt;

    // ── Invincibility blink ──────────────────────────────────────────
    if (this.invincible) {
      this.iTimer -= dt;
      if (this.iTimer <= 0) {
        this.invincible = false;
        this.container.setAlpha(1);
        for (const l of this.allLayers) l.clearTint();
      } else {
        const blink = Math.sin(this.iTimer * 22);
        if (blink > 0) {
          this.container.setAlpha(1);
          for (const l of this.allLayers) l.setTint(0xccddff);
        } else {
          this.container.setAlpha(0.35);
          for (const l of this.allLayers) l.setTint(0x88aaff);
        }
      }
    }

    // ── Bomb timer ───────────────────────────────────────────────────
    if (this.bombActive) {
      this.bombTimer -= dt;
      if (this.bombTimer <= 0) this.bombActive = false;
    }

    // ── Frozen (dialogue / cutscene) ─────────────────────────────────
    if (this.frozen) {
      this.applyLayerAnim(0, 0, false);
      const bob = Math.sin(this.animTime * M.idleBob.freq * TWO_PI) * M.idleBob.amp;
      this.container.setPosition(this.x, this.y + bob);
      const tx = this.x + M.thrusterOff;
      this.thrusterOuter.setPosition(tx, this.y + bob);
      this.thrusterInner.setPosition(tx, this.y + bob);
      this.thrusterCore.setPosition(tx,  this.y + bob);
      this.hitGfx.clear();
      return;
    }

    // ── Movement ─────────────────────────────────────────────────────
    const focused = this.shift.isDown;
    const speed   = focused ? PLAYER_FOCUS_SPEED : PLAYER_SPEED;

    let dx = 0, dy = 0;
    if (this.left.isDown  || this.aKey.isDown)  dx -= 1;
    if (this.right.isDown || this.dKey.isDown)  dx += 1;
    if (this.up.isDown    || this.wKey.isDown)  dy -= 1;
    if (this.down.isDown  || this.sKey.isDown)  dy += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    this.x = Phaser.Math.Clamp(this.x + dx * speed * dt, 40, W - 40);
    this.y = Phaser.Math.Clamp(this.y + dy * speed * dt, 40, H - 40);

    // ── Container tilt ───────────────────────────────────────────────
    const targetAngle = dx * M.tiltH + dy * M.tiltV;
    this.container.angle = Phaser.Math.Linear(this.container.angle, targetAngle, M.tiltLerp);

    // ── Squash & stretch ─────────────────────────────────────────────
    const S = M.squash;
    const tgtSX = M.baseScale * (1 + Math.abs(dx) * S.hStretch - Math.abs(dy) * S.vSquash);
    const tgtSY = M.baseScale * (1 - Math.abs(dx) * S.hSquash  + Math.abs(dy) * S.vStretch);
    this.container.scaleX = Phaser.Math.Linear(this.container.scaleX, tgtSX, S.lerp);
    this.container.scaleY = Phaser.Math.Linear(this.container.scaleY, tgtSY, S.lerp);

    // ── Idle bob ─────────────────────────────────────────────────────
    const bob = Math.sin(this.animTime * M.idleBob.freq * TWO_PI) * M.idleBob.amp;
    this.container.setPosition(this.x, this.y + bob);

    // ── Cutout layer animation ───────────────────────────────────────
    this.applyLayerAnim(dx, dy, focused);

    // ── Movement trail ───────────────────────────────────────────────
    const isMoving = dx !== 0 || dy !== 0;
    if (isMoving && !this.invincible) {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = M.trail.interval;
        const ghost = this.trailGhosts.reduce((a, b) => a.alpha < b.alpha ? a : b);
        this.scene.tweens.killTweensOf(ghost);
        ghost.setPosition(this.x, this.y + bob)
          .setAngle(this.container.angle)
          .setScale(this.container.scaleX, this.container.scaleY)
          .setAlpha(M.trail.alpha);
        this.scene.tweens.add({
          targets: ghost, alpha: 0,
          duration: M.trail.fadeDur, ease: 'Cubic.easeIn',
        });
      }
    }

    // ── Thruster glow ────────────────────────────────────────────────
    const thrusterX = this.x + M.thrusterOff;
    const dispY     = this.y + bob;
    const thrStr    = dx > 0 ? 1.6 : 1.0;
    this.thrusterOuter.setPosition(thrusterX, dispY);
    this.thrusterInner.setPosition(thrusterX, dispY);
    this.thrusterCore.setPosition(thrusterX,  dispY);
    this.thrusterOuter.scaleX = Phaser.Math.Linear(this.thrusterOuter.scaleX, thrStr * 1.3, 0.15);
    this.thrusterInner.scaleX = Phaser.Math.Linear(this.thrusterInner.scaleX, thrStr * 1.1, 0.15);
    this.thrusterCore.scaleX  = Phaser.Math.Linear(this.thrusterCore.scaleX,  thrStr,       0.15);

    // ── Focus ring & glow ────────────────────────────────────────────
    this.focusRing.setPosition(this.x, dispY).setVisible(focused);
    this.focusGlow.setPosition(this.x, dispY).setVisible(focused);

    if (focused && !this.invincible) {
      const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now * 0.005);
      const r = Math.round(0xee + (0xff - 0xee) * pulse);
      const g = Math.round(0xf8 + (0xff - 0xf8) * pulse);
      const tint = (r << 16) | (g << 8) | 0xff;
      for (const l of this.allLayers) l.setTint(tint);
    } else if (!this.invincible) {
      for (const l of this.allLayers) l.clearTint();
    }

    // ── Hitbox visual ────────────────────────────────────────────────
    this.hitGfx.clear();
    if (focused) {
      this.hitGfx.lineStyle(1.5, 0xffffff, 0.9);
      this.hitGfx.strokeCircle(this.x, this.y, HITBOX_R);
      this.hitGfx.lineStyle(1, 0x88ddff, 0.3);
      this.hitGfx.strokeCircle(this.x, this.y, GRAZE_R);
    }

    // ── Shooting ─────────────────────────────────────────────────────
    this.shootTimer -= dt;
    if (this.zKey.isDown && this.shootTimer <= 0) {
      this.shootTimer = SHOOT_INTERVAL;
      this.onFire(this.x, this.y, this.power, focused);
    }

    // ── Bomb ─────────────────────────────────────────────────────────
    if (Phaser.Input.Keyboard.JustDown(this.xKey) && this.bombs > 0 && !this.bombActive) {
      this.bombs--;
      this.bombActive = true;
      this.bombTimer  = BOMB_DURATION;
      this.invincible = true;
      this.iTimer     = BOMB_DURATION + 0.5;
      this.onBomb();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CUTOUT LAYER ANIMATION — hair drift + skirt sway + ribbon flutter
  // ═══════════════════════════════════════════════════════════════════════

  private applyLayerAnim(dx: number, dy: number, focused: boolean): void {
    const M = PLAYER_MOTION;
    const t = this.animTime;

    // Determine animation state
    if (this.invincible && this.iTimer > IFRAMES - 0.3) {
      this.animState = 'hit';
    } else if (focused) {
      this.animState = 'focus';
    } else if (dx !== 0 || dy !== 0) {
      this.animState = 'moving';
    } else {
      this.animState = 'idle';
    }

    const mult = M.states[this.animState];

    // Smooth movement input for reactive lag
    this.smoothDx = Phaser.Math.Linear(this.smoothDx, dx, 0.1);
    this.smoothDy = Phaser.Math.Linear(this.smoothDy, dy, 0.1);

    // ── Hair: ambient drift + movement-reactive lag ──────────────────
    const h = M.hair.drift;
    this.hairLayer.x = Math.sin(t * h.freqX * TWO_PI + h.phase) * h.ampX * mult
      - this.smoothDx * M.moveLag.hair;
    this.hairLayer.y = Math.sin(t * h.freqY * TWO_PI) * h.ampY * mult
      - this.smoothDy * M.moveLag.hair * 0.4;

    // ── Skirt: subtle rotation sway + position shift + movement lag ──
    const sk = M.skirt.sway;
    this.skirtLayer.angle = Math.sin(t * sk.freqRot * TWO_PI + sk.phase) * sk.ampRot * mult;
    this.skirtLayer.x = Math.sin(t * sk.freqRot * TWO_PI + sk.phase + 0.5) * sk.ampX * mult
      - this.smoothDx * M.moveLag.skirt * 0.5;
    this.skirtLayer.y = Math.sin(t * sk.freqY * TWO_PI + sk.phase) * sk.ampY * mult;

    // ── Ribbon: rotation flutter + position bob + movement lag ───────
    const r = M.ribbon.flutter;
    this.ribbonLayer.angle = Math.sin(t * r.freqRot * TWO_PI + r.phase) * r.ampRot * mult;
    this.ribbonLayer.x = M.ribbon.offsetX
      + Math.sin(t * r.freqRot * TWO_PI + r.phase + 1.0) * r.ampX * mult
      - this.smoothDx * M.moveLag.ribbon * 0.5;
    this.ribbonLayer.y = M.ribbon.offsetY
      + Math.sin(t * r.freqY * TWO_PI + r.phase * 1.3) * r.ampY * mult;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GAME LOGIC
  // ═══════════════════════════════════════════════════════════════════════

  hit(): boolean {
    if (this.invincible || this.dead) return false;
    this.lives--;
    this.power = Math.max(0, this.power - 32);
    if (this.lives <= 0) {
      this.dead = true;
      this.playDeathEffect();
      return true;
    }
    this.playDeathEffect();
    this.invincible = true;
    this.iTimer     = IFRAMES;
    this.bombs      = Math.max(this.bombs, 2);
    return false;
  }

  playDeathEffect(): void {
    const { scene, x, y } = this;

    const ring = scene.add.image(x, y, 'bomb-ring')
      .setDepth(DEPTH.FX).setScale(0).setAlpha(0.95).setTint(0xffffff);
    scene.tweens.add({
      targets: ring, scaleX: 6, scaleY: 6, alpha: 0,
      duration: 500, ease: 'Power2',
      onComplete: () => ring.destroy(),
    });

    const em = scene.add.particles(x, y, 'particle', {
      speed: { min: 120, max: 560 }, scale: { start: 1.6, end: 0 },
      lifespan: { min: 350, max: 800 }, alpha: { start: 1, end: 0 },
      tint: [0xff4444, 0xff6644, 0xff8866, 0xffaa88],
      angle: { min: 0, max: 360 }, emitting: false,
    }).setDepth(DEPTH.FX);
    em.explode(28);
    scene.time.delayedCall(900, () => { if (em.active) em.destroy(); });

    const flash = scene.add.graphics().setDepth(DEPTH.FX + 1);
    flash.fillStyle(0xffffff, 0.35);
    flash.fillCircle(x, y, 60);
    scene.tweens.add({
      targets: flash, alpha: 0, duration: 250, ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  addPower(amount: number): void {
    this.power = Math.min(BALANCE.player.maxPower, this.power + amount);
  }

  getPowerLevel(): 1 | 2 | 3 | 4 {
    return getPowerLevel(this.power);
  }

  getDamage(): number {
    return getPlayerDamage(this.getPowerLevel());
  }

  respawn(x: number, y: number): void {
    this.x    = x;
    this.y    = y;
    this.dead = false;
    this.invincible = true;
    this.iTimer     = IFRAMES;

    const M = PLAYER_MOTION;
    this.container.setPosition(x, y).setAlpha(1).setAngle(0).setVisible(true);
    this.container.setScale(M.baseScale);
    for (const l of this.allLayers) l.clearTint();
    // Reset layer positions
    this.hairLayer.setPosition(0, 0).setAngle(0);
    this.bodyLayer.setPosition(0, 0);
    this.skirtLayer.setPosition(0, 0).setAngle(0);
    this.ribbonLayer.setPosition(M.ribbon.offsetX, M.ribbon.offsetY).setAngle(0);

    const tx = x + M.thrusterOff;
    this.thrusterOuter.setPosition(tx, y).setVisible(true);
    this.thrusterInner.setPosition(tx, y).setVisible(true);
    this.thrusterCore.setPosition(tx,  y).setVisible(true);
    this.focusRing.setPosition(x, y);
    this.focusGlow.setPosition(x, y);

    this.smoothDx = 0;
    this.smoothDy = 0;
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
    this.thrusterOuter.setVisible(v);
    this.thrusterInner.setVisible(v);
    this.thrusterCore.setVisible(v);
    if (!v) {
      this.focusRing.setVisible(false);
      this.focusGlow.setVisible(false);
      for (const g of this.trailGhosts) g.setAlpha(0);
    }
  }

  destroy(): void {
    for (const g of this.trailGhosts) g.destroy();
    this.container.destroy();
    this.hitGfx.destroy();
    this.thrusterOuter.destroy();
    this.thrusterInner.destroy();
    this.thrusterCore.destroy();
    if (this.thrusterOuterTw)  this.thrusterOuterTw.destroy();
    if (this.thrusterInnerTw)  this.thrusterInnerTw.destroy();
    if (this.thrusterCoreTw)   this.thrusterCoreTw.destroy();
    if (this.focusRingRotTw)   this.focusRingRotTw.destroy();
    if (this.focusGlowTw)      this.focusGlowTw.destroy();
    this.focusRing.destroy();
    this.focusGlow.destroy();
    const kb = this.scene.input.keyboard;
    if (kb) kb.removeAllKeys();
  }
}
