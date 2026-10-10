import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { CodexScene } from './scenes/CodexScene';
import { BattleScene } from './scenes/BattleScene';

// 设计基准分辨率 1920×1080（GDD §10.4）：FIT + AUTO_CENTER。
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#A5DFF7', // 晨天蓝（明亮草原基调，M1C 提亮）
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, MenuScene, CodexScene, BattleScene],
};
