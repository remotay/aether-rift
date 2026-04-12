import Phaser from 'phaser';
import { W, H, DEPTH, FONT, MAX_POWER } from '../constants';
import { sfx } from '../audio/SoundSynth';
import { bgm } from '../audio/BGMManager';

export class PauseScene extends Phaser.Scene {
  private items = ['RESUME', 'MAX POWER', 'SKIP TO NEXT STAGE', 'RETRY', 'QUIT TO TITLE'];
  private sel   = 0;
  private labels: Phaser.GameObjects.Text[] = [];
  private cursor!: Phaser.GameObjects.Text;
  private upKey!:   Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private zKey!:    Phaser.Input.Keyboard.Key;
  private xKey!:    Phaser.Input.Keyboard.Key;
  private wKey!:    Phaser.Input.Keyboard.Key;
  private sKey!:    Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'PauseScene' }); }

  create(): void {
    // Semi-transparent overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000011, 0.7).setDepth(DEPTH.OVERLAY - 10);

    this.add.text(W / 2, H / 2 - 180, 'PAUSED', {
      fontFamily: FONT,
      fontSize: '72px',
      color: '#e8f4ff',
      stroke: '#000',
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    // Decorative line
    const g = this.add.graphics().setDepth(DEPTH.OVERLAY);
    g.lineStyle(2, 0x6644aa, 0.7);
    g.lineBetween(W / 2 - 240, H / 2 - 124, W / 2 + 240, H / 2 - 124);

    // Menu items
    const startY = H / 2 - 80;
    const gap = 64;
    this.labels = this.items.map((label, i) =>
      this.add.text(W / 2, startY + i * gap, label, {
        fontFamily: FONT,
        fontSize: i === 1 || i === 2 ? '30px' : '40px',  // debug items smaller
        color: i === 1 || i === 2 ? '#66aa88' : '#aabbcc',
        stroke: '#000',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(DEPTH.OVERLAY),
    );

    // Selection cursor
    this.cursor = this.add.text(W / 2 - 220, startY, '\u25B6', {
      fontFamily: FONT,
      fontSize: '36px',
      color: '#aa88ff',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    this.tweens.add({
      targets: this.cursor,
      x: this.cursor.x + 8,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Keys
    const kb    = this.input.keyboard!;
    this.upKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey= kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.wKey   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.sKey   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.zKey   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.xKey   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    this.sel = 0;
    this.highlight();
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.upKey) || Phaser.Input.Keyboard.JustDown(this.wKey)) {
      this.sel = (this.sel - 1 + this.items.length) % this.items.length;
      sfx.uiMove();
      this.highlight();
    }
    if (Phaser.Input.Keyboard.JustDown(this.downKey) || Phaser.Input.Keyboard.JustDown(this.sKey)) {
      this.sel = (this.sel + 1) % this.items.length;
      sfx.uiMove();
      this.highlight();
    }
    if (Phaser.Input.Keyboard.JustDown(this.zKey)) {
      sfx.uiConfirm();
      this.confirm();
    }
    if (Phaser.Input.Keyboard.JustDown(this.xKey)) {
      sfx.uiCancel();
      this.resume();
    }
  }

  private highlight(): void {
    const startY = H / 2 - 80;
    const gap = 64;
    this.labels.forEach((l, i) => {
      const isDebug = i === 1 || i === 2;
      l.setColor(i === this.sel ? '#ffffff' : (isDebug ? '#33665a' : '#556677'));
      l.setScale(i === this.sel ? 1.08 : 1);
    });
    this.cursor.setY(startY + this.sel * gap);
  }

  private confirm(): void {
    switch (this.sel) {
      case 0: // RESUME
        this.resume();
        break;
      case 1: { // MAX POWER
        const gameScene = this.scene.get('GameScene') as { player?: { power: number } };
        if (gameScene?.player) {
          gameScene.player.power = MAX_POWER;
        }
        this.resume();
        break;
      }
      case 2: { // SKIP TO NEXT STAGE
        const currentStage = (this.registry.get('currentStage') as number | undefined) ?? 1;
        const nextStage = currentStage + 1;
        const gameSceneSkip = this.scene.get('GameScene') as { player?: { power: number; lives: number; bombs: number }; score?: number };
        this.registry.set('carryScore', gameSceneSkip?.score ?? 0);
        this.registry.set('carryLives', gameSceneSkip?.player?.lives ?? 3);
        this.registry.set('carryBombs', gameSceneSkip?.player?.bombs ?? 3);
        this.registry.set('carryPower', gameSceneSkip?.player?.power ?? 0);
        this.registry.set('currentStage', nextStage);
        this.registry.set('stage1Cleared', true);
        if (currentStage >= 2) this.registry.set('stage2Cleared', true);
        if (currentStage >= 3) this.registry.set('stage3Cleared', true);
        bgm.stop(0);
        this.scene.stop('PauseScene');
        this.scene.stop('GameScene');
        this.scene.start('GameScene', { stage: nextStage });
        break;
      }
      case 3: // RETRY
        bgm.stop(0);
        this.scene.stop('PauseScene');
        this.scene.stop('GameScene');
        this.scene.start('GameScene');
        break;
      case 4: // QUIT TO TITLE
        bgm.stop(0);
        this.scene.stop('PauseScene');
        this.scene.stop('GameScene');
        this.scene.start('TitleScene');
        break;
    }
  }

  private resume(): void {
    this.scene.resume('GameScene');
    this.scene.stop('PauseScene');
  }
}
