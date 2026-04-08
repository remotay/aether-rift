import Phaser from 'phaser';
import { W, H, DEPTH, FONT } from '../constants';
import { sfx } from '../audio/SoundSynth';

export class PauseScene extends Phaser.Scene {
  private items = ['RESUME', 'RETRY', 'QUIT TO TITLE'];
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
    this.labels = this.items.map((label, i) =>
      this.add.text(W / 2, H / 2 - 40 + i * 88, label, {
        fontFamily: FONT,
        fontSize: '40px',
        color: '#aabbcc',
        stroke: '#000',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(DEPTH.OVERLAY),
    );

    // Selection cursor
    this.cursor = this.add.text(W / 2 - 180, H / 2 - 40, '\u25B6', {
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
    this.labels.forEach((l, i) => {
      l.setColor(i === this.sel ? '#ffffff' : '#556677');
      l.setScale(i === this.sel ? 1.08 : 1);
    });
    // Move cursor to selected item
    this.cursor.setY(H / 2 - 40 + this.sel * 88);
  }

  private confirm(): void {
    switch (this.sel) {
      case 0: this.resume(); break;
      case 1:
        this.scene.stop('PauseScene');
        this.scene.stop('GameScene');
        this.scene.start('GameScene');
        break;
      case 2:
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
