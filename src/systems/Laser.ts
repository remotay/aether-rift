import Phaser from 'phaser';
import { DEPTH } from '../constants';

// ─── Types ──────────────────────────────────────────────────────────────────

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
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_LASERS = 8;
const BEAM_LENGTH = 3000;
const FIRING_DUR = 0.1;
const FADEOUT_DUR = 0.3;

const TINT_TEAL   = 0x00ccaa;
const TINT_ORANGE  = 0xff6600;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Decompose a hex color into { r, g, b } in 0-255 range. */
function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

/** Lerp between two colors component-wise, return hex. */
function lerpColor(a: number, b: number, t: number): number {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Lighten a color toward white by factor t (0 = original, 1 = white). */
function lightenColor(hex: number, t: number): number {
  return lerpColor(hex, 0xffffff, t);
}

// ─── LaserPool ──────────────────────────────────────────────────────────────

export class LaserPool {
  private scene: Phaser.Scene;
  private lasers: LaserInstance[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Fire a new laser beam.
   * @param ox           Origin x
   * @param oy           Origin y
   * @param angle        Beam angle in radians
   * @param width        Collision width of the beam (pixels)
   * @param telegraphDur Duration of the telegraph warning (seconds)
   * @param activeDur    Duration the beam stays fully active (seconds)
   * @param tint         Color tint (default: teal 0x00ccaa)
   */
  fireLaser(
    ox: number,
    oy: number,
    angle: number,
    width: number,
    telegraphDur: number,
    activeDur: number,
    tint: number = TINT_TEAL,
  ): void {
    // Enforce pool cap
    if (this.lasers.length >= MAX_LASERS) return;

    const gfx = this.scene.add.graphics();
    gfx.setDepth(DEPTH.FX);

    const glowGfx = this.scene.add.graphics();
    glowGfx.setDepth(DEPTH.FX - 1);
    glowGfx.setBlendMode(Phaser.BlendModes.ADD);

    this.lasers.push({
      ox,
      oy,
      angle,
      width,
      state: 'telegraph',
      timer: 0,
      telegraphDur,
      activeDur,
      tint,
      gfx,
      glowGfx,
    });
  }

  /** Advance all laser state machines and redraw their graphics. */
  update(dt: number): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.timer += dt;
      this.advanceState(laser);

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
   * Check if any active laser overlaps the player hitbox.
   * @returns true if the player is hit by at least one active laser.
   */
  checkPlayerHit(px: number, py: number, hitboxR: number): boolean {
    for (const laser of this.lasers) {
      if (laser.state !== 'active' && laser.state !== 'firing') continue;
      if (this.pointIntersectsBeam(px, py, hitboxR, laser)) return true;
    }
    return false;
  }

  /** Release all active lasers immediately (used for bombs / phase transitions). */
  releaseAll(): void {
    for (const laser of this.lasers) {
      laser.gfx.destroy();
      laser.glowGfx.destroy();
    }
    this.lasers.length = 0;
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

  /** Telegraph: thin flickering line pulsing between alpha 0.2 and 0.5. */
  private drawTelegraph(laser: LaserInstance): void {
    const { ox, oy, angle, tint, gfx, timer, telegraphDur } = laser;

    // Pulsing alpha: fast flicker using a high-frequency sine
    const pulse = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(timer * 18));
    // Grow slightly brighter toward the end of telegraph
    const ramp = 0.5 + 0.5 * (timer / telegraphDur);
    const alpha = pulse * ramp;

    const ex = ox + Math.cos(angle) * BEAM_LENGTH;
    const ey = oy + Math.sin(angle) * BEAM_LENGTH;

    gfx.lineStyle(2, tint, alpha);
    gfx.beginPath();
    gfx.moveTo(ox, oy);
    gfx.lineTo(ex, ey);
    gfx.strokePath();
  }

  /** Firing: rapid expansion from thin line to full width with white flash. */
  private drawFiring(laser: LaserInstance): void {
    const t = laser.timer / FIRING_DUR; // 0 → 1
    const currentWidth = 2 + (laser.width - 2) * Phaser.Math.Easing.Cubic.Out(t);
    const flashColor = lerpColor(0xffffff, laser.tint, t);
    const flashAlpha = 1 - t * 0.3; // start fully bright, ease down slightly

    this.drawBeamLayers(laser, currentWidth, flashColor, flashAlpha);
  }

  /** Active/fadeout: full multi-layer beam. Intensity goes from 0→1 during ramp. */
  private drawActive(laser: LaserInstance, intensity: number): void {
    this.drawBeamLayers(laser, laser.width * intensity, laser.tint, intensity);
  }

  /**
   * Draw the three-layer beam effect:
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

    // Perpendicular normal
    const nx = -sin;
    const ny = cos;

    // ── Layer 1: outer glow (additive blend, on glowGfx) ──
    const outerW = width * 2;
    const outerAlpha = alpha * 0.25;
    this.fillBeamRect(glowGfx, ox, oy, ex, ey, nx, ny, outerW, color, outerAlpha);

    // ── Layer 2: core ──
    const coreColor = lightenColor(color, 0.4);
    const coreAlpha = alpha * 0.7;
    this.fillBeamRect(gfx, ox, oy, ex, ey, nx, ny, width, coreColor, coreAlpha);

    // ── Layer 3: hot center (white) ──
    const centerW = width * 0.3;
    const centerAlpha = alpha * 0.9;
    this.fillBeamRect(gfx, ox, oy, ex, ey, nx, ny, centerW, 0xffffff, centerAlpha);
  }

  /** Draw a filled rectangle along the beam axis using four-corner polygon. */
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

  /**
   * Point-vs-beam collision.
   * Projects the player position onto the beam's infinite line, then checks
   * perpendicular distance against (laserHalfWidth + hitboxR).
   * The beam extends from (ox, oy) along `angle` for BEAM_LENGTH pixels;
   * the projection is clamped to that segment.
   */
  private pointIntersectsBeam(
    px: number,
    py: number,
    hitboxR: number,
    laser: LaserInstance,
  ): boolean {
    const { ox, oy, angle, width } = laser;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Vector from origin to player
    const vx = px - ox;
    const vy = py - oy;

    // Project onto beam direction (dot product)
    const proj = vx * dx + vy * dy;

    // Clamp projection to beam segment [0, BEAM_LENGTH]
    if (proj < 0 || proj > BEAM_LENGTH) return false;

    // Perpendicular distance (cross product magnitude)
    const perpDist = Math.abs(vx * dy - vy * dx);

    // Effective collision radius during fadeout shrinks with visual width
    let effectiveHalfWidth = width * 0.5;
    if (laser.state === 'firing') {
      const t = laser.timer / FIRING_DUR;
      effectiveHalfWidth = (2 + (width - 2) * Phaser.Math.Easing.Cubic.Out(t)) * 0.5;
    }

    return perpDist < effectiveHalfWidth + hitboxR;
  }
}

// Re-export default tint constants for convenience
export { TINT_TEAL, TINT_ORANGE };
