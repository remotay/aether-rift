import Phaser from 'phaser';
import { W, H, DEPTH, COL, FONT, START_LIVES, START_BOMBS } from '../constants';

export interface HUDData {
  score:    number;
  hiScore:  number;
  lives:    number;
  bombs:    number;
  power:    number;   // 0–128
  graze:    number;
  maxPower: number;
}

export class HUD {
  private scene: Phaser.Scene;

  // Top bar
  private scoreTxt!: Phaser.GameObjects.Text;
  private hiTxt!:    Phaser.GameObjects.Text;

  // Bottom bar
  private livesTxt!: Phaser.GameObjects.Text;
  private bombsTxt!: Phaser.GameObjects.Text;
  private powerFill!:Phaser.GameObjects.Rectangle;
  private powerGlow!:Phaser.GameObjects.Rectangle;
  private grazeTxt!: Phaser.GameObjects.Text;

  // Score flash state
  private scoreFlashTween: Phaser.Tweens.Tween | null = null;
  private scoreBaseColor: string = '';

  // Power glow state
  private powerGlowTween: Phaser.Tweens.Tween | null = null;
  private lastPowerPct = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.build();
  }

  private t(x: number, y: number, txt: string, size: number, color: number, origin = 0): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, txt, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(origin, 0.5).setDepth(DEPTH.HUD);
  }

  private build(): void {
    const barH = 52;
    const topY  = barH / 2;
    const botY  = H - barH / 2;

    // ── Top bar background with gradient fade ──────────────────────────────
    // Main solid bar
    this.scene.add.rectangle(W / 2, topY, W, barH, 0x000011, 0.72).setDepth(DEPTH.HUD - 1);
    // Gradient fade strips below top bar (fade toward play area)
    this.scene.add.rectangle(W / 2, barH + 6, W, 12, 0x000011, 0.35).setDepth(DEPTH.HUD - 1);
    this.scene.add.rectangle(W / 2, barH + 16, W, 10, 0x000011, 0.15).setDepth(DEPTH.HUD - 1);
    // Accent line
    this.scene.add.rectangle(W / 2, barH, W, 1, 0x334466, 0.9).setDepth(DEPTH.HUD - 1);

    // ── Bottom bar background with gradient fade ───────────────────────────
    // Main solid bar
    this.scene.add.rectangle(W / 2, botY, W, barH, 0x000011, 0.72).setDepth(DEPTH.HUD - 1);
    // Gradient fade strips above bottom bar (fade toward play area)
    this.scene.add.rectangle(W / 2, H - barH - 6, W, 12, 0x000011, 0.35).setDepth(DEPTH.HUD - 1);
    this.scene.add.rectangle(W / 2, H - barH - 16, W, 10, 0x000011, 0.15).setDepth(DEPTH.HUD - 1);
    // Accent line
    this.scene.add.rectangle(W / 2, H - barH, W, 1, 0x334466, 0.9).setDepth(DEPTH.HUD - 1);

    // ── Score ──────────────────────────────────────────────────────────────
    this.scoreTxt = this.t(20, topY, 'SCORE  00000000', 26, COL.SCORE);
    this.scoreBaseColor = Phaser.Display.Color.IntegerToColor(COL.SCORE).rgba;

    // ── Hi score ───────────────────────────────────────────────────────────
    this.hiTxt = this.t(W / 2, topY, 'HI  00000000', 26, 0xaabbcc, 0.5);

    // ── Lives label + icons ────────────────────────────────────────────────
    this.t(24, botY - 16, 'LIFE', 16, 0x88aacc);
    this.livesTxt = this.t(24, botY + 4, '♥ ♥ ♥', 28, COL.LIVES);

    // Separator line after lives
    this.scene.add.rectangle(200, botY, 1, barH * 0.6, 0x334466, 0.6).setDepth(DEPTH.HUD);

    // ── Bombs label + icons ────────────────────────────────────────────────
    this.t(224, botY - 16, 'BOMB', 16, 0x88aacc);
    this.bombsTxt = this.t(224, botY + 4, '◆ ◆ ◆', 28, COL.BOMBS);

    // Separator line after bombs
    this.scene.add.rectangle(420, botY, 1, barH * 0.6, 0x334466, 0.6).setDepth(DEPTH.HUD);

    // ── Power bar ──────────────────────────────────────────────────────────
    const pwX = W / 2 - 120;
    this.scene.add.text(pwX - 8, botY, 'PWR', {
      fontFamily: FONT, fontSize: '22px', color: '#88ddff',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(1, 0.5).setDepth(DEPTH.HUD);

    // Power bar background
    this.scene.add.rectangle(pwX + 120, botY, 240, 16, 0x113355, 1).setDepth(DEPTH.HUD);

    // Power bar tick marks at 25%, 50%, 75%
    for (let i = 1; i <= 3; i++) {
      const tickX = pwX + (240 * i * 0.25);
      this.scene.add.rectangle(tickX, botY, 1, 16, 0x88bbdd, 0.5).setDepth(DEPTH.HUD + 2);
    }

    // Power glow (slightly larger rect behind the fill, invisible until near max)
    this.powerGlow = this.scene.add.rectangle(pwX, botY, 2, 22, COL.POWER, 0)
      .setOrigin(0, 0.5).setDepth(DEPTH.HUD + 0.5);

    // Power bar fill
    this.powerFill = this.scene.add.rectangle(pwX, botY, 2, 16, COL.POWER, 1)
      .setOrigin(0, 0.5).setDepth(DEPTH.HUD + 1);

    // Separator line after power bar
    this.scene.add.rectangle(W / 2 + 160, botY, 1, barH * 0.6, 0x334466, 0.6).setDepth(DEPTH.HUD);

    // ── Graze counter ──────────────────────────────────────────────────────
    this.grazeTxt = this.t(W - 20, botY, 'GRAZE  0', 26, COL.GRAZE, 1);
  }

  /** Flash the score text bright white momentarily. */
  flashScore(): void {
    if (this.scoreFlashTween) {
      this.scoreFlashTween.stop();
    }
    this.scoreTxt.setColor('#ffffff');
    this.scoreFlashTween = this.scene.tweens.add({
      targets: this.scoreTxt,
      duration: 350,
      ease: 'Cubic.easeOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const p = tween.progress;
        // Lerp from white (255,255,255) back to base color
        const base = Phaser.Display.Color.IntegerToColor(COL.SCORE);
        const r = Math.round(255 + (base.red - 255) * p);
        const g = Math.round(255 + (base.green - 255) * p);
        const b = Math.round(255 + (base.blue - 255) * p);
        this.scoreTxt.setColor(Phaser.Display.Color.RGBToString(r, g, b));
      },
      onComplete: () => {
        this.scoreTxt.setColor(this.scoreBaseColor);
        this.scoreFlashTween = null;
      },
    });
  }

  private updatePowerGlow(pct: number): void {
    const pwX = W / 2 - 120;
    const fillW = Math.max(2, pct * 240);

    // Update glow size to match fill
    this.powerGlow.setX(pwX);
    this.powerGlow.setSize(fillW, 22);

    if (pct >= 0.85) {
      // Near max: pulsing glow
      if (!this.powerGlowTween || this.lastPowerPct < 0.85) {
        if (this.powerGlowTween) this.powerGlowTween.stop();
        this.powerGlow.setAlpha(0.4);
        this.powerGlowTween = this.scene.tweens.add({
          targets: this.powerGlow,
          alpha: { from: 0.4, to: 0.15 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    } else {
      // Not near max: no glow
      if (this.powerGlowTween) {
        this.powerGlowTween.stop();
        this.powerGlowTween = null;
      }
      this.powerGlow.setAlpha(0);
    }

    this.lastPowerPct = pct;
  }

  private lastScore = 0;

  update(data: HUDData): void {
    // Score with flash on increase
    if (data.score > this.lastScore) {
      this.flashScore();
    }
    this.lastScore = data.score;
    this.scoreTxt.setText(`SCORE  ${String(data.score).padStart(8, '0')}`);
    this.hiTxt.setText(`HI  ${String(data.hiScore).padStart(8, '0')}`);

    // Lives icons
    const heartStr = '♥ '.repeat(data.lives) + '♡ '.repeat(Math.max(0, START_LIVES - data.lives));
    this.livesTxt.setText(heartStr.trimEnd());

    // Bomb icons
    const bombStr = '◆ '.repeat(data.bombs) + '◇ '.repeat(Math.max(0, START_BOMBS - data.bombs));
    this.bombsTxt.setText(bombStr.trimEnd());

    // Power bar (fill from left, max 240px wide)
    const pct = data.power / data.maxPower;
    this.powerFill.setSize(Math.max(2, pct * 240), 16);
    this.powerFill.setX(W / 2 - 120);

    // Power glow effect
    this.updatePowerGlow(pct);

    // Graze
    this.grazeTxt.setText(`GRAZE  ${data.graze}`);
  }

  showMessage(text: string, duration = 1500, color = 0xffffff, size = 56): void {
    const msg = this.scene.add.text(W / 2, H / 2, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      stroke: '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY).setAlpha(0).setScale(1.4);

    // Punch-in then float up and fade
    this.scene.tweens.add({
      targets: msg,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: msg,
          alpha: 0,
          y: msg.y - 70,
          duration: duration,
          ease: 'Power2',
          onComplete: () => msg.destroy(),
        });
      },
    });
  }
}
