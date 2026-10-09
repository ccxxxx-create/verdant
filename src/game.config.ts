import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';

// 设计基准分辨率 1920×1080（GDD §10.4）：FIT + AUTO_CENTER，
// 平板 16:10 出现信箱边时由菜单背景层 overscan 延伸（M2 落实）。
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#F4F1EA',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, MenuScene],
};
