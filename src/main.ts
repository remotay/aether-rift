import Phaser from 'phaser';
import { W, H } from './constants';
import { PreloadScene }  from './scenes/PreloadScene';
import { TitleScene }    from './scenes/TitleScene';
import { GameScene }     from './scenes/GameScene';
import { PauseScene }    from './scenes/PauseScene';
import { GameOverScene } from './scenes/GameOverScene';
import { ClearScene }    from './scenes/ClearScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width:  W,
  height: H,
  parent: 'game',
  backgroundColor: '#080014',
  scene: [PreloadScene, TitleScene, GameScene, PauseScene, GameOverScene, ClearScene],
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias:  true,
    pixelArt:   false,
  },
};

const game = new Phaser.Game(config);
// Dev helper — expose for console testing (harmless in production)
(window as any).__game = game;
