import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Asset loading will go here
  }

  create(): void {
    const cx = (this.scale.width / 2);
    const cy = (this.scale.height / 2);

    this.add.text(cx, cy - 40, 'MODERN DANMAKU SHOOTER', {
      color: '#e0e8ff',
      fontSize: '18px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      letterSpacing: 3,
    }).setOrigin(0.5);

    this.add.text(cx, cy + 10, 'scaffold ready', {
      color: '#445566',
      fontSize: '12px',
      fontFamily: 'monospace',
      letterSpacing: 2,
    }).setOrigin(0.5);
  }
}
