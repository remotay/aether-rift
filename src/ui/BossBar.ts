import Phaser from 'phaser';
import { W, DEPTH, COL, FONT } from '../constants';

export class BossBar {
  private scene:     Phaser.Scene;
  private bg:        Phaser.GameObjects.Rectangle;
  private glow:      Phaser.GameObjects.Rectangle;
  private fill:      Phaser.GameObjects.Rectangle;
  private nameTxt:   Phaser.GameObjects.Text;
  private phaseTxt:  Phaser.GameObjects.Text;
  private shown = false;

  // Lerped display HP
  private currentDisplayHp = 1;
  private targetHp         = 1;

  // Phase pips
  private phasePips: Phaser.GameObjects.Arc[] = [];
  private totalPhases = 1;
  private currentPhase = 1;

  // Glow tween
  private glowTween: Phaser.Tweens.Tween | null = null;

  private static readonly BAR_W = 1000;
  private static readonly BAR_H = 20;
  private static readonly Y     = 100;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const cx   = W / 2;
    const y    = BossBar.Y;

    // Pulsing glow behind the bar (slightly larger)
    this.glow = scene.add.rectangle(cx, y, BossBar.BAR_W + 24, BossBar.BAR_H + 24, COL.HP_BAR, 0)
      .setDepth(DEPTH.HUD - 0.5);

    this.bg = scene.add.rectangle(cx, y, BossBar.BAR_W + 8, BossBar.BAR_H + 8, 0x110022, 0.9)
      .setDepth(DEPTH.HUD);

    this.fill = scene.add.rectangle(
      cx - BossBar.BAR_W / 2, y, BossBar.BAR_W, BossBar.BAR_H, COL.HP_BAR, 1,
    ).setOrigin(0, 0.5).setDepth(DEPTH.HUD + 1);

    this.nameTxt = scene.add.text(cx, y - 28, '', {
      fontFamily: FONT,
      fontSize: '26px',
      color: '#ffbbdd',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5, 1).setDepth(DEPTH.HUD + 2);

    this.phaseTxt = scene.add.text(cx + BossBar.BAR_W / 2 + 20, y, '', {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#ff88cc',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(DEPTH.HUD + 2);

    this.hide();
  }

  show(name: string, totalPhases = 3): void {
    this.shown = true;
    this.totalPhases = totalPhases;
    this.currentPhase = 1;
    this.currentDisplayHp = 1;
    this.targetHp = 1;
    this.nameTxt.setText(name);

    [this.bg, this.fill, this.nameTxt, this.phaseTxt, this.glow].forEach(o => o.setVisible(true));

    // Build phase pips
    this.buildPhasePips();

    // Start glow pulse
    this.startGlowPulse();
  }

  hide(): void {
    this.shown = false;
    [this.bg, this.fill, this.nameTxt, this.phaseTxt, this.glow].forEach(o => o.setVisible(false));

    // Hide pips
    this.phasePips.forEach(p => p.setVisible(false));

    // Stop glow
    if (this.glowTween) {
      this.glowTween.stop();
      this.glowTween = null;
    }
  }

  private buildPhasePips(): void {
    // Destroy old pips
    this.phasePips.forEach(p => p.destroy());
    this.phasePips = [];

    const cx = W / 2;
    const y  = BossBar.Y;
    const pipRadius = 6;
    const pipSpacing = 20;
    const totalWidth = (this.totalPhases - 1) * pipSpacing;
    const startX = cx - totalWidth / 2;

    for (let i = 0; i < this.totalPhases; i++) {
      const pip = this.scene.add.circle(startX + i * pipSpacing, y + 26, pipRadius, 0x442244, 1)
        .setStrokeStyle(1.5, 0xff88cc, 0.8)
        .setDepth(DEPTH.HUD + 2);
      this.phasePips.push(pip);
    }

    this.updatePhasePips();
  }

  private updatePhasePips(): void {
    for (let i = 0; i < this.phasePips.length; i++) {
      const pip = this.phasePips[i];
      if (i < this.currentPhase) {
        // Active / completed phase: filled bright
        const col = this.getPhaseColor(i + 1);
        pip.setFillStyle(col, 1);
        pip.setStrokeStyle(1.5, 0xffffff, 0.9);
      } else {
        // Upcoming phase: dim hollow
        pip.setFillStyle(0x221133, 0.6);
        pip.setStrokeStyle(1.5, 0x664477, 0.5);
      }
    }
  }

  private getPhaseColor(phase: number): number {
    if (phase === 1) return COL.HP_BAR;
    if (phase === 2) return 0xff8800;
    return 0xff2200;
  }

  private startGlowPulse(): void {
    if (this.glowTween) {
      this.glowTween.stop();
    }
    this.glow.setAlpha(0.18);
    this.glowTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.18, to: 0.06 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(hpFrac: number, phase = 1): void {
    if (!this.shown) return;

    // Set target HP for smooth lerp
    this.targetHp = hpFrac;

    // Lerp current display toward target (smooth drain)
    const lerpSpeed = 0.08;
    this.currentDisplayHp += (this.targetHp - this.currentDisplayHp) * lerpSpeed;

    // Snap when very close
    if (Math.abs(this.currentDisplayHp - this.targetHp) < 0.002) {
      this.currentDisplayHp = this.targetHp;
    }

    this.fill.setSize(Math.max(0, this.currentDisplayHp * BossBar.BAR_W), BossBar.BAR_H);

    // Phase color
    const col = this.getPhaseColor(phase);
    this.fill.setFillStyle(col);
    this.glow.setFillStyle(col);

    // Update phase pips if phase changed
    if (phase !== this.currentPhase) {
      this.currentPhase = phase;
      // When phase changes, snap the display HP so the bar resets cleanly
      this.currentDisplayHp = hpFrac;
      this.updatePhasePips();
    }

    this.phaseTxt.setText(`PHASE ${phase}`);
  }
}
