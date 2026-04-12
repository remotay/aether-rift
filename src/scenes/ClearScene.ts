import Phaser from 'phaser';
import { W, H, DEPTH, FONT } from '../constants';
import { sfx } from '../audio/SoundSynth';

/** Maximum stage number currently in the game. */
const FINAL_STAGE = 4;

const STAGE_SUBTITLES: Record<number, string> = {
  1: '— THRESHOLD OF ETERNITY CONQUERED —',
  2: '— AETHER RIFT SEALED —',
  3: '— SHATTERED EDEN RESTORED —',
  4: '— CELESTIAL RIFT SEALED —',
};

export class ClearScene extends Phaser.Scene {
  constructor() { super({ key: 'ClearScene' }); }

  init(data: { score: number; hiScore: number }): void {
    this.registry.set('clear_score',   data.score   ?? 0);
    this.registry.set('clear_hiScore', data.hiScore ?? 0);
  }

  create(): void {
    const score   = this.registry.get('clear_score')   as number;
    const hiScore = this.registry.get('clear_hiScore') as number;
    const stageId = (this.registry.get('currentStage') as number | undefined) ?? 1;
    const canContinue = stageId < FINAL_STAGE;

    this.cameras.main.fadeIn(600, 0, 0, 0);

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, 0x06010e).setDepth(DEPTH.BG_FAR - 1);
    if (this.textures.exists('bg-sky')) {
      this.add.image(W / 2, H / 2, 'bg-sky').setDisplaySize(W, H).setDepth(DEPTH.BG_FAR);
    }
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setDepth(1);

    sfx.stageClear();

    // Stage clear banner
    const stageLabels: Record<number, string> = { 1: 'STAGE I  CLEAR', 2: 'STAGE II  CLEAR', 3: 'STAGE III  CLEAR', 4: 'STAGE IV  CLEAR' };
    const bannerText = stageLabels[stageId] ?? 'STAGE CLEAR';
    const banner = this.add.text(W / 2, H / 2 - 220, bannerText, {
      fontFamily: FONT,
      fontSize: '100px',
      color: '#ffee44',
      stroke: '#000',
      strokeThickness: 14,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY).setAlpha(0);

    this.tweens.add({ targets: banner, alpha: 1, duration: 600, ease: 'Power2' });

    const subtitle = STAGE_SUBTITLES[stageId] ?? '';
    if (subtitle) {
      this.add.text(W / 2, H / 2 - 100, subtitle, {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#cc99ff',
        stroke: '#000',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);
    }

    // Score display
    this.add.text(W / 2, H / 2 + 20, canContinue ? 'SCORE' : 'FINAL SCORE', {
      fontFamily: FONT,
      fontSize: '28px',
      color: '#8899aa',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    this.add.text(W / 2, H / 2 + 84, String(score).padStart(8, '0'), {
      fontFamily: FONT,
      fontSize: '68px',
      color: '#e8f4ff',
      stroke: '#000',
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    // Hi-score
    const newBest = score > 0 && score >= hiScore;
    this.add.text(W / 2, H / 2 + 160, newBest ? '★  NEW BEST SCORE  ★' : `BEST  ${String(hiScore).padStart(8, '0')}`, {
      fontFamily: FONT,
      fontSize: '30px',
      color: newBest ? '#ffdd00' : '#667788',
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    // ── Action prompts ─────────────────────────────────────────────────────
    if (canContinue) {
      // Primary: continue to next stage
      const nextStageLabels: Record<number, string> = { 2: 'STAGE II', 3: 'STAGE III' };
      const nextLabel = nextStageLabels[stageId + 1] ?? `STAGE ${stageId + 1}`;
      const promptContinue = this.add.text(W / 2, H / 2 + 248, `PRESS  Z  TO CONTINUE TO ${nextLabel}`, {
        fontFamily: FONT,
        fontSize: '32px',
        color: '#aaccff',
        stroke: '#000',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

      this.tweens.add({
        targets: promptContinue,
        alpha: { from: 1, to: 0.2 },
        duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      // Secondary: return to title
      this.add.text(W / 2, H / 2 + 304, 'PRESS  X  TO RETURN TO TITLE', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#667788',
        stroke: '#000',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

      // Input
      this.time.delayedCall(800, () => {
        const kb = this.input.keyboard!;

        kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z).once('down', () => {
          sfx.uiConfirm();
          // Mark stages as cleared so title scene can reflect it
          this.registry.set('stage1Cleared', true);
          if (stageId >= 2) this.registry.set('stage2Cleared', true);
          if (stageId >= 3) this.registry.set('stage3Cleared', true);
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.time.delayedCall(420, () => {
            this.scene.start('GameScene', { stage: stageId + 1 });
          });
        });

        kb.addKey(Phaser.Input.Keyboard.KeyCodes.X).once('down', () => {
          sfx.uiCancel();
          this.registry.set('stage1Cleared', true);
          if (stageId >= 2) this.registry.set('stage2Cleared', true);
          if (stageId >= 3) this.registry.set('stage3Cleared', true);
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.time.delayedCall(420, () => this.scene.start('TitleScene'));
        });
      });
    } else {
      // Final stage cleared — only option is return to title
      const prompt = this.add.text(W / 2, H / 2 + 260, 'PRESS  Z  TO RETURN TO TITLE', {
        fontFamily: FONT,
        fontSize: '32px',
        color: '#aaccff',
        stroke: '#000',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

      this.tweens.add({
        targets: prompt,
        alpha: { from: 1, to: 0.2 },
        duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      this.time.delayedCall(800, () => {
        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z).once('down', () => {
          sfx.uiConfirm();
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.time.delayedCall(420, () => this.scene.start('TitleScene'));
        });
      });
    }

    // Particle celebration
    const particles = this.add.particles(W / 2, H / 2 - 160, 'particle', {
      speed: { min: 120, max: 440 },
      angle: { min: 0, max: 360 },
      scale: { start: 2.4, end: 0 },
      lifespan: 1200,
      frequency: 60,
      tint: [0xffee44, 0xff88cc, 0xaaccff, 0xcc88ff],
      quantity: 3,
      alpha: { start: 1, end: 0 },
    }).setDepth(DEPTH.FX);

    this.time.delayedCall(3000, () => particles.stop());
  }
}
