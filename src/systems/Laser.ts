import Phaser from 'phaser';
import { DEPTH } from '../constants';

// ─── Public types (shared by bosses, enemies, GameScene) ───────────────────

export interface LaserOpts {
  /** Owner identifier — lets us cancel lasers when the source dies. */
  ownerId?: string;
  /** Rotation speed in radians/second during the active phase (positive = CW). */
  rotSpeed?: number;
}

export type LaserFireFn = (
  ox: number, oy: number, angle: number, width: number,
  telegraphDur: number, activeDur: number, tint: number,
  opts?: LaserOpts,
) => void;

// ─── Internal types ────────────────────────────────────────────────────────

type LaserState = 'telegraph' | 'firing' | 'active' | 'fadeout' | 'done';

interface LaserInstance {
  ox: number;
  oy: number;
  angle: number;
  width: number;
  state: LaserState;
  timer: number;
  telegraphDur: number;
  activeDur: number;
  tint: number;
  gfx: Phaser.GameObjects.Graphics;
  glowGfx: Phaser.GameObjects.Graphics;
  /** Optional owner — used to cancel lasers when the entity that fired them dies. */
  ownerId?: string;
  /** Rotation speed during active phase (radians/sec). 0 = static beam. */
  rotSpeed: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_LASERS = 12;
const BEAM_LENGTH = 3000;
const FIRING_DUR = 0.18;      // smoother expansion (was 0.1)
const FADEOUT_DUR = 0.35;
const CANCEL_FADEOUT = 0.2;   // faster fade when owner dies

export const TINT_TEAL   = 0x00ccaa;
export const TINT_ORANGE = 0xff6600;

// ─── Helpers ───────────────────────────────────────────────────────────────

function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

function lerpColor(a: number, b: number, t: number): number {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return (r << 16) | (g << 8) | bl;
}

function lightenColor(hex: number, t: number): number {
  return lerpColor(hex, 0xffffff, t);
}

// ─── LaserPool ─────────────────────────────────────────────────────────────

export class LaserPool {
  private scene: Phaser.Scene;
  private lasers: LaserInstance[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Fire a new laser beam.
   * @param ox           Origin x
   * @param oy           Origin y
   * @param angle        Beam angle in radians
   * @param width        Collision width of the beam (pixels)
   * @param telegraphDur Duration of the telegraph warning (seconds). 0 = skip telegraph.
   * @param activeDur    Duration the beam stays fully active (seconds)
   * @param tint         Color tint (default: teal)
   * @param opts         Optional owner / rotation config
   */
  fireLaser(
    ox: number,
    oy: number,
    angle: number,
    width: number,
    telegraphDur: number,
    activeDur: number,
    tint: number = TINT_TEAL,
    opts?: LaserOpts,
  ): void {
    if (this.lasers.length >= MAX_LASERS) return;

    const gfx = this.scene.add.graphics();
    gfx.setDepth(DEPTH.FX);

    const glowGfx = this.scene.add.graphics();
    glowGfx.setDepth(DEPTH.FX - 1);
    glowGfx.setBlendMode(Phaser.BlendModes.ADD);

    const startState: LaserState = telegraphDur > 0 ? 'telegraph' : 'firing';

    this.lasers.push({
      ox,
      oy,
      angle,
      width,
      state: startState,
      timer: 0,
      telegraphDur: Math.max(telegraphDur, 0),
      activeDur,
      tint,
      gfx,
      glowGfx,
      ownerId: opts?.ownerId,
      rotSpeed: opts?.rotSpeed ?? 0,
    });
  }

  /** Advance all laser state machines, handle rotation, and redraw. */
  update(dt: number): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.timer += dt;
      this.advanceState(laser);

      // Rotate during active phase
      if (laser.state === 'active' && laser.rotSpeed !== 0) {
        laser.angle += laser.rotSpeed * dt;
      }

      if (laser.state === 'done') {
        laser.gfx.destroy();
        laser.glowGfx.destroy();
        this.lasers.splice(i, 1);
        continue;
      }

      this.drawLaser(laser);
    }
  }

  /**
   * Check if any active/firing laser overlaps the player hitbox.
   * Returns true if hit.
   */
  checkPlayerHit(px: number, py: number, hitboxR: number): boolean {
    for (const laser of this.lasers) {
      if (laser.state !== 'active' && laser.state !== 'firing') continue;
      if (this.pointIntersectsBeam(px, py, hitboxR, laser)) return true;
    }
    return false;
  }

  /** Release all active lasers immediately (bombs / phase transitions). */
  releaseAll(): void {
    for (const laser of this.lasers) {
      laser.gfx.destroy();
      laser.glowGfx.destroy();
    }
    this.lasers.length = 0;
  }

  /**
   * Cancel all lasers belonging to a specific owner (e.g. when an enemy dies).
   * Lasers in telegraph or firing phase are removed instantly.
   * Active lasers get a fast fadeout so they don't just pop.
   */
  releaseByOwner(ownerId: string): void {
    for (const laser of this.lasers) {
      if (laser.ownerId !== ownerId) continue;
      if (laser.state === 'telegraph' || laser.state === 'firing') {
        // Not yet dangerous — remove immediately
        laser.state = 'done';
      } else if (laser.state === 'active') {
        // Already visible — quick fadeout
        laser.state = 'fadeout';
        laser.timer = 0;
        laser.activeDur = CANCEL_FADEOUT; // repurpose for fast fade
      }
      // fadeout state — let it finish naturally
    }
  }

  /** Full cleanup — call on scene shutdown. */
  destroy(): void {
    this.releaseAll();
  }

  /** Number of active lasers (any state except done). */
  get count(): number {
    return this.lasers.length;
  }

  // ── State machine ──────────────────────────────────────────────────────

  private advanceState(laser: LaserInstance): void {
    switch (laser.state) {
      case 'telegraph':
        if (laser.timer >= laser.telegraphDur) {
          laser.state = 'firing';
          laser.timer = 0;
        }
        break;
      case 'firing':
        if (laser.timer >= FIRING_DUR) {
          laser.state = 'active';
          laser.timer = 0;
        }
        break;
      case 'active':
        if (laser.timer >= laser.activeDur) {
          laser.state = 'fadeout';
          laser.timer = 0;
        }
        break;
      case 'fadeout':
        if (laser.timer >= FADEOUT_DUR) {
          laser.state = 'done';
        }
        break;
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  private drawLaser(laser: LaserInstance): void {
    laser.gfx.clear();
    laser.glowGfx.clear();

    switch (laser.state) {
      case 'telegraph':
        this.drawTelegraph(laser);
        break;
      case 'firing':
        this.drawFiring(laser);
        break;
      case 'active':
        this.drawActive(laser, 1);
        break;
      case 'fadeout':
        this.drawActive(laser, 1 - laser.timer / FADEOUT_DUR);
        break;
    }
  }

  /**
   * Telegraph: clear danger-zone preview + pulsing origin marker.
   *
   * Shows a faint wide band (beam width preview) so the player knows
   * exactly how wide the danger zone will be, plus a bright thin center
   * line and a pulsing circle at the origin.
   */
  private drawTelegraph(laser: LaserInstance): void {
    const { ox, oy, angle, tint, width, gfx, glowGfx, timer, telegraphDur } = laser;

    const progress = Math.min(timer / telegraphDur, 1);

    // Fast flicker pulse — increasingly intense toward the end
    const flicker = 0.5 + 0.5 * Math.sin(timer * 16);
    const ramp = 0.3 + 0.7 * progress;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ex = ox + cos * BEAM_LENGTH;
    const ey = oy + sin * BEAM_LENGTH;
    const nx = -sin;
    const ny = cos;

    // ── Layer 1: Faint danger-zone band (shows beam width) ──
    const zoneAlpha = 0.04 + 0.08 * progress;
    const zoneW = width * (0.6 + 0.4 * progress);
    this.fillBeamRect(glowGfx, ox, oy, ex, ey, nx, ny, zoneW, tint, zoneAlpha);

    // ── Layer 2: Bright center line ──
    const lineAlpha = (0.25 + 0.45 * flicker) * ramp;
    const lineWidth = 2 + 2 * progress; // grows from 2px to 4px
    gfx.lineStyle(lineWidth, tint, lineAlpha);
    gfx.beginPath();
    gfx.moveTo(ox, oy);
    gfx.lineTo(ex, ey);
    gfx.strokePath();

    // ── Layer 3: Pulsing origin circle (charge-up indicator) ──
    const circleR = 6 + 10 * progress + 4 * flicker;
    const circleAlpha = (0.2 + 0.5 * progress) * (0.6 + 0.4 * flicker);
    gfx.lineStyle(2, tint, circleAlpha);
    gfx.strokeCircle(ox, oy, circleR);

    // Inner bright dot
    gfx.fillStyle(0xffffff, circleAlpha * 0.8);
    gfx.fillCircle(ox, oy, 3 + 2 * progress);

    // ── Final 20%: "about to fire" intensification ──
    if (progress > 0.8) {
      const urgency = (progress - 0.8) / 0.2; // 0→1 over last 20%
      const flashAlpha = urgency * 0.15 * (0.5 + 0.5 * Math.sin(timer * 30));
      this.fillBeamRect(gfx, ox, oy, ex, ey, nx, ny, width * 0.5, 0xffffff, flashAlpha);
    }
  }

  /** Firing: rapid expansion from thin line to full width with white flash. */
  private drawFiring(laser: LaserInstance): void {
    const t = laser.timer / FIRING_DUR; // 0 → 1
    const ease = Phaser.Math.Easing.Cubic.Out(t);
    const currentWidth = 2 + (laser.width - 2) * ease;
    const flashColor = lerpColor(0xffffff, laser.tint, t * 0.7);
    const flashAlpha = 1 - t * 0.2;

    this.drawBeamLayers(laser, currentWidth, flashColor, flashAlpha);

    // Origin flash burst during expansion
    const { ox, oy, gfx } = laser;
    const burstR = laser.width * (1.5 - t);
    const burstAlpha = (1 - t) * 0.4;
    gfx.fillStyle(0xffffff, burstAlpha);
    gfx.fillCircle(ox, oy, burstR);
  }

  /** Active/fadeout: full multi-layer beam. */
  private drawActive(laser: LaserInstance, intensity: number): void {
    if (intensity < 0.01) return;
    this.drawBeamLayers(laser, laser.width * intensity, laser.tint, intensity);

    // Subtle origin glow during active phase
    if (intensity > 0.3) {
      const { ox, oy, gfx, tint } = laser;
      const glowR = laser.width * 0.6 * intensity;
      gfx.fillStyle(tint, 0.15 * intensity);
      gfx.fillCircle(ox, oy, glowR);
    }
  }

  /**
   * Three-layer beam effect:
   *   1. Outer glow (additive blend, wide, low alpha)
   *   2. Core (medium alpha, lighter color)
   *   3. Hot center (high alpha, white)
   */
  private drawBeamLayers(
    laser: LaserInstance,
    width: number,
    color: number,
    alpha: number,
  ): void {
    if (width < 0.5 || alpha < 0.01) return;

    const { ox, oy, angle, gfx, glowGfx } = laser;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ex = ox + cos * BEAM_LENGTH;
    const ey = oy + sin * BEAM_LENGTH;
    const nx = -sin;
    const ny = cos;

    // Layer 1: outer glow (additive blend)
    const outerW = width * 2.2;
    const outerAlpha = alpha * 0.2;
    this.fillBeamRect(glowGfx, ox, oy, ex, ey, nx, ny, outerW, color, outerAlpha);

    // Layer 2: core
    const coreColor = lightenColor(color, 0.35);
    const coreAlpha = alpha * 0.65;
    this.fillBeamRect(gfx, ox, oy, ex, ey, nx, ny, width, coreColor, coreAlpha);

    // Layer 3: hot center (white)
    const centerW = width * 0.3;
    const centerAlpha = alpha * 0.85;
    this.fillBeamRect(gfx, ox, oy, ex, ey, nx, ny, centerW, 0xffffff, centerAlpha);
  }

  /** Draw a filled rectangle along the beam axis. */
  private fillBeamRect(
    gfx: Phaser.GameObjects.Graphics,
    ox: number,
    oy: number,
    ex: number,
    ey: number,
    nx: number,
    ny: number,
    width: number,
    color: number,
    alpha: number,
  ): void {
    const hw = width * 0.5;

    gfx.fillStyle(color, alpha);
    gfx.beginPath();
    gfx.moveTo(ox + nx * hw, oy + ny * hw);
    gfx.lineTo(ex + nx * hw, ey + ny * hw);
    gfx.lineTo(ex - nx * hw, ey - ny * hw);
    gfx.lineTo(ox - nx * hw, oy - ny * hw);
    gfx.closePath();
    gfx.fillPath();
  }

  // ── Collision ──────────────────────────────────────────────────────────

  private pointIntersectsBeam(
    px: number,
    py: number,
    hitboxR: number,
    laser: LaserInstance,
  ): boolean {
    const { ox, oy, angle, width } = laser;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const vx = px - ox;
    const vy = py - oy;

    const proj = vx * dx + vy * dy;
    if (proj < 0 || proj > BEAM_LENGTH) return false;

    const perpDist = Math.abs(vx * dy - vy * dx);

    let effectiveHalfWidth = width * 0.5;
    if (laser.state === 'firing') {
      const t = laser.timer / FIRING_DUR;
      effectiveHalfWidth = (2 + (width - 2) * Phaser.Math.Easing.Cubic.Out(t)) * 0.5;
    }

    return perpDist < effectiveHalfWidth + hitboxR;
  }
}
