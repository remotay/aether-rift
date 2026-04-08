import Phaser from 'phaser';

export class BulletPool {
  private sprites: Phaser.GameObjects.Image[];
  private velX: Float32Array;
  private velY: Float32Array;
  /** bit0 = active, bit1 = grazed */
  private flags: Uint8Array;
  readonly size: number;
  private free: number[];

  constructor(
    scene: Phaser.Scene,
    texture: string,
    count: number,
    depth: number,
  ) {
    this.size  = count;
    this.velX  = new Float32Array(count);
    this.velY  = new Float32Array(count);
    this.flags = new Uint8Array(count);
    this.free  = Array.from({ length: count }, (_, i) => count - 1 - i);
    this.sprites = [];

    for (let i = 0; i < count; i++) {
      this.sprites.push(
        scene.add.image(0, 0, texture).setVisible(false).setDepth(depth),
      );
    }
  }

  fire(
    x: number, y: number,
    vx: number, vy: number,
    scaleX = 1, scaleY = 1,
    tint = 0xffffff,
    alpha = 1,
  ): boolean {
    if (this.free.length === 0) return false;
    const i = this.free.pop()!;
    this.flags[i] = 1;
    this.velX[i]  = vx;
    this.velY[i]  = vy;
    // Rotate bullet to face its travel direction
    const angle = Math.atan2(vy, vx) * (180 / Math.PI);
    this.sprites[i]
      .setPosition(x, y)
      .setScale(scaleX, scaleY)
      .setTint(tint)
      .setAlpha(alpha)
      .setAngle(angle)
      .setVisible(true);
    return true;
  }

  release(i: number): void {
    if (!(this.flags[i] & 1)) return;
    this.flags[i] = 0;
    this.sprites[i].setVisible(false);
    this.free.push(i);
  }

  releaseAll(): void {
    for (let i = 0; i < this.size; i++) if (this.flags[i] & 1) this.release(i);
  }

  setGrazed(i: number): void { this.flags[i] |= 2; }
  isActive(i: number): boolean { return !!(this.flags[i] & 1); }
  isGrazed(i: number): boolean { return !!(this.flags[i] & 2); }
  getSprite(i: number): Phaser.GameObjects.Image { return this.sprites[i]; }
  freeCount(): number { return this.free.length; }

  update(dt: number, minX = -80, maxX = 1060, minY = -80, maxY = 640): void {
    for (let i = 0; i < this.size; i++) {
      if (!(this.flags[i] & 1)) continue;
      const s = this.sprites[i];
      s.x += this.velX[i] * dt;
      s.y += this.velY[i] * dt;
      if (s.x < minX || s.x > maxX || s.y < minY || s.y > maxY) this.release(i);
    }
  }

  forEach(fn: (i: number, s: Phaser.GameObjects.Image) => void): void {
    for (let i = 0; i < this.size; i++) if (this.flags[i] & 1) fn(i, this.sprites[i]);
  }

  setDepth(d: number): void {
    for (const s of this.sprites) s.setDepth(d);
  }
}
