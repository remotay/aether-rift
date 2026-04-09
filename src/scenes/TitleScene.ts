import Phaser from 'phaser';
import { W, H, DEPTH, FONT } from '../constants';
import { sfx } from '../audio/SoundSynth';
import { bgm } from '../audio/BGMManager';

export class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create(): void {
    // ── Background ─────────────────────────────────────────────────────────
    // Solid base so no checkerboard ever shows
    this.add.rectangle(W / 2, H / 2, W, H, 0x06010e).setDepth(DEPTH.BG_FAR - 1);

    if (this.textures.exists('bg-sky')) {
      this.add.image(W / 2, H / 2, 'bg-sky')
        .setDisplaySize(W, H)
        .setDepth(DEPTH.BG_FAR);
    }

    // Dark vignette overlay
    const vign = this.add.graphics().setDepth(DEPTH.BG_MID);
    vign.fillStyle(0x000000, 0.35);
    vign.fillRect(0, 0, W, H);

    // ── Stars ──────────────────────────────────────────────────────────────
    const starGfx = this.add.graphics().setDepth(DEPTH.BG_NEAR);
    const rng = new Phaser.Math.RandomDataGenerator(['stars-title']);
    for (let i = 0; i < 100; i++) {
      const a = 0.25 + rng.frac() * 0.75;
      const sz = rng.frac() < 0.65 ? 1 : 2;
      starGfx.fillStyle(0xffffff, a);
      starGfx.fillRect(rng.integerInRange(0, W), rng.integerInRange(0, H * 0.75), sz, sz);
    }

    // ── Decorative rings ───────────────────────────────────────────────────
    const ringGfx = this.add.graphics().setDepth(DEPTH.BG_NEAR + 1);
    ringGfx.lineStyle(3, 0x9966ff, 0.2);
    ringGfx.strokeCircle(W / 2, H / 2 - 40, 420);
    ringGfx.lineStyle(2, 0xcc88ff, 0.12);
    ringGfx.strokeCircle(W / 2, H / 2 - 40, 560);
    this.tweens.add({ targets: ringGfx, angle: 360, duration: 22000, repeat: -1, ease: 'Linear' });

    // ── Title text ─────────────────────────────────────────────────────────
    const title = this.add.text(W / 2, H / 2 - 190, 'AETHER RIFT', {
      fontFamily: FONT,
      fontSize: '116px',
      color: '#eef4ff',
      stroke: '#6622cc',
      strokeThickness: 14,
      shadow: { offsetX: 0, offsetY: 0, color: '#aa44ff', blur: 36, fill: true },
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.tweens.add({
      targets: title,
      alpha: { from: 0.82, to: 1 },
      duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Subtitle — show available stages
    const s1Cleared = this.registry.get('stage1Cleared') ?? false;
    const subtitleText = s1Cleared
      ? '— STAGES:  I  ·  II —'
      : '— STAGE I:  THRESHOLD OF ETERNITY —';
    this.add.text(W / 2, H / 2 - 64, subtitleText, {
      fontFamily: FONT,
      fontSize: '26px',
      color: '#bb99ee',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    // ── Press Z prompt ─────────────────────────────────────────────────────
    const prompt = this.add.text(W / 2, H / 2 + 120, 'PRESS  Z  TO BEGIN', {
      fontFamily: FONT,
      fontSize: '40px',
      color: '#ccddff',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.08 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Controls hint
    this.add.text(W / 2, H / 2 + 216, 'ARROWS/WASD · move     Z · shoot     X · bomb     SHIFT · focus', {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#556677',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.add.text(W / 2, H - 32, 'AETHER RIFT  ©2026', {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#2a3a4a',
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    // ── BGM ────────────────────────────────────────────────────────────────
    bgm.bind(this);
    bgm.play('title');

    // ── Input ──────────────────────────────────────────────────────────────
    const zKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    zKey.once('down', () => {
      sfx.uiConfirm();
      bgm.stop(400);
      // Clear any carried state from a previous run so Stage 1 starts fresh
      this.registry.set('carryScore', undefined);
      this.registry.set('carryLives', undefined);
      this.registry.set('carryBombs', undefined);
      this.registry.set('carryPower', undefined);
      this.registry.set('currentStage', 1);
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => this.scene.start('GameScene', { stage: 1 }));
    });

    this.cameras.main.fadeIn(600, 0, 0, 0);
  }
}
