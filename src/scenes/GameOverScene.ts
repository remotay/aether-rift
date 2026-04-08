import Phaser from 'phaser';
import { W, H, DEPTH, FONT } from '../constants';
import { sfx } from '../audio/SoundSynth';

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  init(data: { score: number; hiScore: number }): void {
    this.registry.set('go_score',   data.score   ?? 0);
    this.registry.set('go_hiScore', data.hiScore ?? 0);
  }

  create(): void {
    const score   = this.registry.get('go_score')   as number;
    const hiScore = this.registry.get('go_hiScore') as number;

    this.cameras.main.fadeIn(500, 0, 0, 0);

    // Background dim
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setDepth(0);

    // GAME OVER text
    const go = this.add.text(W / 2, H / 2 - 200, 'GAME OVER', {
      fontFamily: FONT,
      fontSize: '104px',
      color: '#ff2244',
      stroke: '#000',
      strokeThickness: 14,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY).setAlpha(0);

    this.tweens.add({ targets: go, alpha: 1, duration: 500, ease: 'Power2' });

    // Score
    this.add.text(W / 2, H / 2, `SCORE  ${String(score).padStart(8, '0')}`, {
      fontFamily: FONT,
      fontSize: '44px',
      color: '#e8f4ff',
      stroke: '#000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    // Hi-score
    const hiCol = score >= hiScore && score > 0 ? '#ffdd00' : '#aabbcc';
    const hiLabel = score >= hiScore && score > 0 ? '★ NEW BEST!' : `BEST  ${String(hiScore).padStart(8, '0')}`;
    this.add.text(W / 2, H / 2 + 72, hiLabel, {
      fontFamily: FONT,
      fontSize: '32px',
      color: hiCol,
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    // Retry / Quit
    const retry = this.add.text(W / 2 - 180, H / 2 + 200, '[Z]  RETRY', {
      fontFamily: FONT,
      fontSize: '36px',
      color: '#88ddff',
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    const quit = this.add.text(W / 2 + 180, H / 2 + 200, '[X]  TITLE', {
      fontFamily: FONT,
      fontSize: '36px',
      color: '#cc88ff',
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    this.tweens.add({
      targets: [retry, quit],
      alpha: { from: 1, to: 0.35 },
      duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    sfx.playerDeath();

    // Input (slight delay so accidental Z doesn't skip)
    this.time.delayedCall(800, () => {
      const kb = this.input.keyboard!;
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z).once('down', () => {
        sfx.uiConfirm();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(320, () => this.scene.start('GameScene'));
      });
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.X).once('down', () => {
        sfx.uiCancel();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(320, () => this.scene.start('TitleScene'));
      });
    });
  }
}
